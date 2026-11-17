import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { randomUUID } from "node:crypto";

const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, setTimeout: globalThis.setTimeout, document: globalThis.document };
const stored = new Map();
const references = [];
let removeCount = 0;
let realtimeListener;
let eventOnSubscribe = null;
const channel = {
  on(_event, _filter, listener) { realtimeListener = listener; return this; },
  subscribe() { if (eventOnSubscribe) realtimeListener({ new: { status: eventOnSubscribe } }); return this; },
};
globalThis.__jobClient = {
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "owner-session" } } }) },
    channel: () => channel,
    removeChannel: () => { removeCount++; },
  },
  createLogRequestId: randomUUID,
};
globalThis.localStorage = {
  get length() { return stored.size; },
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: key => stored.delete(key),
  key: index => [...stored.keys()][index] ?? null,
};
const pollDelays = [];
globalThis.document = { visibilityState: "visible" };
globalThis.setTimeout = (callback, ms, ...args) => {
  if ([30_000, 120_000].includes(ms)) {
    pollDelays.push(ms);
    return original.setTimeout(callback, 0, ...args);
  }
  return original.setTimeout(callback, ms === 3000 ? 0 : ms, ...args);
};
const source = ts.transpileModule(fs.readFileSync("src/services/evaluationJobs.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import .*;\n/gm, "");
const { queueEvaluation, hasPendingEvaluationJob, pendingEvaluationJobMatches } = await import(
  "data:text/javascript;base64," + Buffer.from("const {supabase,createLogRequestId}=globalThis.__jobClient;\n" + source).toString("base64"),
);
const input = {
  result: { id: "submission-1", answers: { task1: "Essay" }, combination: { tasks: {} } },
  model: "gemini-3.6-flash", fingerprint: "essay-and-language-hash", language: "en",
  request: { contents: [] },
};
const response = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const done = id => ({ id, status: "completed", model: "gemini-3.6-flash", key_source: "backup", response: { candidates: [] } });
try {
  // Explicitly disabled queues fall back to the existing synchronous transport.
  globalThis.fetch = async () => response({}, 409, { "X-TCF-Queue-Disabled": "1" });
  assert.equal(await queueEvaluation(input), null);
  assert.equal(hasPendingEvaluationJob(input.result.id), false);

  let polls = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      const body = JSON.parse(options.body); references.push(body);
      assert.equal(options.headers.Authorization, "Bearer owner-session");
      return response({ id: body.id, status: "queued" }, 202);
    }
    polls++;
    assert.equal(options.headers["X-TCF-Job-Token"], references.at(-1).token);
    return response(done(references.at(-1).id));
  };
  const complete = await queueEvaluation(input);
  assert.equal(complete.model, "gemini-3.6-flash");
  assert.equal(complete.keySource, "backup");
  assert.equal(polls, 1);
  assert.equal(pollDelays.at(-1), 30_000, "Visible tabs poll at most once every 30 seconds");
  assert.equal(removeCount, 1, "Realtime subscriptions must be cleaned up");
  assert.equal(hasPendingEvaluationJob(input.result.id), false);

  globalThis.document.visibilityState = "hidden";
  await queueEvaluation({ ...input, fingerprint: "hidden-tab" });
  assert.equal(pollDelays.at(-1), 120_000, "Background tabs poll only every two minutes");
  globalThis.document.visibilityState = "visible";
  const beforeRealtime = pollDelays.length;
  eventOnSubscribe = "completed";
  await queueEvaluation({ ...input, fingerprint: "realtime-complete" });
  assert.equal(pollDelays.length, beforeRealtime, "Realtime completion must not wait for the polling timer");
  eventOnSubscribe = "running";
  await queueEvaluation({ ...input, fingerprint: "realtime-running" });
  assert.equal(pollDelays.length, beforeRealtime + 1, "Intermediate Realtime events must not trigger extra status reads");
  eventOnSubscribe = null;

  // A failed POST acknowledgement keeps its capability, even before success
  // is known. Reopening must submit exactly the same id, not spend new quota.
  globalThis.fetch = async (_url, options) => {
    references.push(JSON.parse(options.body));
    throw new TypeError("connection lost after enqueue");
  };
  await assert.rejects(queueEvaluation(input), /reopen|Reopen/);
  const interrupted = references.at(-1);
  assert.equal(hasPendingEvaluationJob(input.result.id), true);
  assert.equal(pendingEvaluationJobMatches(input.result.id, input.model, input.fingerprint), true);
  assert.equal(pendingEvaluationJobMatches(input.result.id, input.model, "changed-answer-or-language"), false);
  assert.equal(pendingEvaluationJobMatches("different-submission", input.model, input.fingerprint), false);
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); references.push(body);
    return response(done(body.id));
  };
  await queueEvaluation(input);
  assert.equal(references.at(-1).id, interrupted.id);
  assert.equal(references.at(-1).token, interrupted.token);
  assert.equal(hasPendingEvaluationJob(input.result.id), false);

  globalThis.fetch = async (_url, options) => {
    references.push(JSON.parse(options.body));
    throw new TypeError("lost acknowledgement");
  };
  await assert.rejects(queueEvaluation(input));
  globalThis.fetch = async () => response({}, 409, { "X-TCF-Queue-Disabled": "1" });
  await assert.rejects(queueEvaluation(input), /reopen/i, "Never start synchronous work while a saved job may still be running");

  globalThis.fetch = async (_url, options) => options.method === "POST"
    ? response({}, 409, { "X-TCF-Queue-Disabled": "1" })
    : response(done(references.at(-1).id));
  assert.equal((await queueEvaluation(input)).model, "gemini-3.6-flash", "Previously queued results remain collectable when enqueue is disabled");

  globalThis.fetch = async (_url, options) => {
    references.push(JSON.parse(options.body));
    throw new TypeError("lost acknowledgement");
  };
  await assert.rejects(queueEvaluation(input));

  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    return response({ id: body.id, status: "failed", error_code: "delivery_exhausted" });
  };
  await assert.rejects(queueEvaluation(input), /delivery_exhausted/);
  assert.equal(hasPendingEvaluationJob(input.result.id), false);
  const before = references.at(-1).id;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); references.push(body);
    return response(done(body.id));
  };
  await queueEvaluation(input);
  assert.notEqual(references.at(-1).id, before, "An explicit request after failure can start a new job");
  console.log("PASS: queue opt-in, owner Realtime/polling, persistent recovery after lost acknowledgement, exact input matching, cleanup, and no duplicate synchronous fallback.");
} finally {
  Object.assign(globalThis, original);
  delete globalThis.__jobClient;
}
