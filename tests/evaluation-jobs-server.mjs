import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { serverRuntime } from "./helpers/server-runtime.mjs";

const runtime = await serverRuntime();
const envNames = ["EVALUATION_QUEUE_ENABLED", "EVALUATION_PUBLIC_URL", "EVALUATION_WORKER_SECRET", "QSTASH_TOKEN", "SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "GEMINI_BACKUP_KEY", "GEMINI_BACKUP_API_KEY", "VITE_GEMINI_API_KEY"];
const savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const oldFetch = globalThis.fetch;
const oldWarn = console.warn;
const jobs = new Map();
const publications = [];
const providerCalls = [];
const statusSelections = [];
let providerResponses = [];
let publishFails = false;
let claimFails = false;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const clone = value => JSON.parse(JSON.stringify(value));
const requestBody = () => ({
  id: randomUUID(), token: randomUUID(), model: "gemini-4-hydrogen",
  request: { contents: [{ role: "user", parts: [{ text: "private essay" }] }] },
  submission: { id: "local-submission", answers: { task1: "private essay" } },
});
const enqueue = (body, headers = { Authorization: "Bearer valid-session" }) => runtime.evaluate(new Request("https://app.example/api/evaluate", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
}));
const status = (body, token = body.token) => runtime.evaluate(new Request(`https://app.example/api/evaluate?id=${body.id}`, {
  headers: { "X-TCF-Job-Token": token },
}));
const acceptCache = (body, token = body.token) => runtime.evaluate(new Request("https://app.example/api/evaluate", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: body.id, token }),
}));
const work = (id, authorized = true) => runtime.worker(new Request("https://app.example/api/evaluation-worker", {
  method: "POST", headers: authorized ? { Authorization: `Bearer ${process.env.EVALUATION_WORKER_SECRET}` } : {},
  body: JSON.stringify({ id }),
}));
const failureCallback = id => runtime.worker(new Request(`https://app.example/api/evaluation-worker?failed=${id}`, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.EVALUATION_WORKER_SECRET}` }, body: JSON.stringify({ sourceMessageId: `message-${id}`, dlqId: "dead-letter-1" }),
}));

try {
  for (const name of envNames) delete process.env[name];
  Object.assign(process.env, {
    EVALUATION_QUEUE_ENABLED: "true", EVALUATION_PUBLIC_URL: "https://app.example",
    EVALUATION_WORKER_SECRET: "a-test-worker-secret-with-at-least-32-characters",
    QSTASH_TOKEN: "qstash-sentinel", SUPABASE_URL: "https://database.example",
    SUPABASE_SERVICE_ROLE_KEY: "service-sentinel", GEMINI_API_KEY: "primary-sentinel", GEMINI_BACKUP_KEY: "backup-sentinel",
  });
  console.warn = () => {};
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.hostname === "qstash.upstash.io") {
      publications.push({ url: input, options, body });
      return publishFails ? response({}, 503) : response({ messageId: `message-${body.id}` });
    }
    if (url.hostname === "generativelanguage.googleapis.com") {
      providerCalls.push({ url: input, options });
      assert(providerResponses.length, "Unexpected provider attempt");
      const next = providerResponses.shift();
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next() : next;
    }
    assert.equal(url.hostname, "database.example");
    if (url.pathname === "/auth/v1/user") return response({ id: options.headers.Authorization === "Bearer other-session" ? "other-user" : "verified-user" }, ["Bearer valid-session", "Bearer other-session"].includes(options.headers.Authorization) ? 200 : 401);
    if (url.pathname === "/rest/v1/error_logs") return response([]);
    if (url.pathname === "/rest/v1/rpc/claim_evaluation_job") {
      if (claimFails) return response({}, 503);
      const job = jobs.get(body.job_id);
      if (!job || ["completed", "failed"].includes(job.status) ||
        (job.status === "running" && job.lease_until > Date.now()) || job.attempts >= 9) return response([]);
      Object.assign(job, { status: "running", attempts: job.attempts + 1, lease_token: body.claim_token, lease_until: Date.now() + 180000 });
      return response([clone(job)]);
    }
    assert.equal(url.pathname, "/rest/v1/evaluation_jobs");
    if (options.method === "POST") {
      if (!jobs.has(body.id)) jobs.set(body.id, { status: "queued", attempts: 0, next_step: 0, message_id: null, lease_token: null, lease_until: null, response: null, error_code: null, ...body });
      return response([]);
    }
    const id = url.searchParams.get("id")?.slice(3);
    const job = jobs.get(id);
    if (options.method === "PATCH") {
      if (!job || (url.searchParams.has("lease_token") && url.searchParams.get("lease_token") !== `eq.${job.lease_token}`) ||
        (url.searchParams.get("status") === "in.(queued,running,retrying)" && ["completed", "failed"].includes(job.status)) ||
        (url.searchParams.get("status") === "eq.completed" && job.status !== "completed") ||
        (url.searchParams.get("cache_expires_at") === "is.null" && job.cache_expires_at)) return response([]);
      Object.assign(job, body);
      return response([clone(job)]);
    }
    const selection = url.searchParams.get("select");
    if (url.searchParams.has("cache_key")) {
      const matches = [...jobs.values()].filter(item => item.cache_key === url.searchParams.get("cache_key").slice(3) &&
        item.cache_scope === url.searchParams.get("cache_scope").slice(3) && item.status === "completed" &&
        Date.parse(item.cache_expires_at) > Date.parse(url.searchParams.get("cache_expires_at").slice(3))).reverse();
      return response(matches.slice(0, 1).map(item => Object.fromEntries(selection.split(",").map(field => [field, item[field]]))));
    }
    if (selection) {
      statusSelections.push(selection.split(","));
      return response(job ? [Object.fromEntries(selection.split(",").map(field => [field, job[field]]))] : []);
    }
    return response(job ? [clone(job)] : []);
  };
  const first = requestBody();
  assert.equal((await enqueue(first, {})).status, 401);
  assert.equal((await enqueue(first)).status, 202);
  assert.equal(providerCalls.length, 0, "Enqueue must never wait for Gemini");
  assert.equal(jobs.get(first.id).input.submission.answers.task1, "private essay");
  assert.notEqual(jobs.get(first.id).token_hash, first.token);
  assert.deepEqual(publications[0].body, { id: first.id }, "Only the opaque job id leaves for QStash");
  assert.equal(publications[0].options.headers["Upstash-Retries"], "8");
  assert.equal(publications[0].options.headers["Upstash-Timeout"], "150s");
  assert.equal((await enqueue(first)).status, 202);
  assert.equal(publications.length, 1, "Lost acknowledgements reuse the published job");
  assert.equal((await enqueue({ ...first, request: { contents: [] } })).status, 409);
  assert.equal((await status(first, randomUUID())).status, 404);
  const visible = await (await status(first)).json();
  assert(!JSON.stringify(visible).includes("private essay"));
  assert(!JSON.stringify(visible).includes("sentinel"));
  assert(statusSelections.length > 0);
  for (const fields of statusSelections) {
    assert(!fields.includes("input"), "Polling must not download the full essay/prompt from Supabase");
    assert(fields.includes("token_hash"), "Projected reads must still check the job capability");
    assert(fields.includes("response"), "Completed results remain retrievable");
  }
  assert.equal((await work(first.id, false)).status, 401);
  assert.equal(providerCalls.length, 0);

  // Transient failures are persisted between invocations; no in-handler retries.
  providerResponses = [response({}, 503), response({ candidates: [] })];
  assert.equal((await work(first.id)).status, 503);
  assert.equal(providerCalls.length, 1);
  assert.equal(jobs.get(first.id).status, "retrying");
  assert.equal((await work(first.id)).status, 200);
  assert.equal(jobs.get(first.id).status, "completed");
  assert.equal(providerCalls.at(-1).options.headers["x-goog-api-key"], "primary-sentinel");
  assert.equal(JSON.parse(providerCalls[0].options.body).generationConfig.thinkingConfig.thinkingLevel, "HIGH");
  assert.equal(JSON.parse(providerCalls[1].options.body).generationConfig?.thinkingConfig, undefined);
  assert.equal(jobs.get(first.id).model, "gemini-3.6-flash");
  assert.equal((await work(first.id)).status, 200);
  assert.equal(providerCalls.length, 2, "Duplicate completed delivery does not spend quota");
  await failureCallback(first.id);
  assert.equal(jobs.get(first.id).status, "completed", "Late failure callback cannot erase success");
  assert.deepEqual((await (await status(first)).json()).response, { candidates: [] });

  const timeoutJob = requestBody();
  await enqueue(timeoutJob);
  const timeout = new Error("primary-sentinel"); timeout.name = "TimeoutError";
  providerResponses = [timeout, response({ candidates: [] })];
  assert.equal((await work(timeoutJob.id)).status, 503);
  assert.equal(jobs.get(timeoutJob.id).next_step, 2, "Deadline skips the same model's backup key");
  assert.equal((await work(timeoutJob.id)).status, 200);
  assert(providerCalls.at(-1).url.includes("gemini-3.6-flash"));

  // Headers can arrive before the provider's body finishes. A 200 header
  // must not turn a body deadline into a permanent job failure.
  const stalledBodyJob = requestBody();
  await enqueue(stalledBodyJob);
  providerResponses = [
    { status: 200, ok: true, text: async () => { throw timeout; } },
    response({ candidates: [] }),
  ];
  assert.equal((await work(stalledBodyJob.id)).status, 503);
  assert.equal(jobs.get(stalledBodyJob.id).status, "retrying");
  assert.equal(jobs.get(stalledBodyJob.id).next_step, 2);
  assert.equal((await work(stalledBodyJob.id)).status, 200);
  assert.equal(jobs.get(stalledBodyJob.id).model, "gemini-3.6-flash");

  const lite = { ...requestBody(), model: "gemini-3.5-flash-lite" };
  await enqueue(lite);
  const beforeLite = providerCalls.length;
  providerResponses = [response({}, 503), response({}, 503), response({ candidates: [] })];
  for (const expectedStatus of [503, 503, 200]) {
    assert.equal((await work(lite.id)).status, expectedStatus);
  }
  assert.deepEqual(providerCalls.slice(beforeLite).map(call => new URL(call.url).pathname.split("/").pop().split(":")[0]),
    ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]);
  assert.equal(jobs.get(lite.id).model, "gemini-3.8-flash");
  assert.equal(jobs.get(lite.id).status, "completed");

  // Resume a pre-deployment Lite job after its primary model returned 503.
  const resumed = { ...requestBody(), model: "gemini-3.5-flash-lite" };
  await enqueue(resumed);
  Object.assign(jobs.get(resumed.id), { status: "retrying", attempts: 1, next_step: 2 });
  providerResponses = [response({ candidates: [] })];
  assert.equal((await work(resumed.id)).status, 200);
  assert.equal(jobs.get(resumed.id).model, "gemini-3.6-flash");

  const concurrent = requestBody();
  await enqueue(concurrent);
  let release;
  providerResponses = [() => new Promise(resolve => { release = () => resolve(response({ candidates: [] })); })];
  const active = work(concurrent.id);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const before = providerCalls.length;
  assert.equal((await work(concurrent.id)).status, 503);
  assert.equal(providerCalls.length, before, "An active lease suppresses concurrent delivery");
  release(); await active;

  for (const providerResponse of [response({}, 400), new Response("broken-json")]) {
    const invalid = requestBody(); await enqueue(invalid);
    providerResponses = [providerResponse];
    assert.equal((await work(invalid.id)).status, 200);
    assert.equal(jobs.get(invalid.id).status, "failed", "Permanent failures do not retry generation");
  }
  const exhausted = requestBody(); await enqueue(exhausted);
  providerResponses = Array.from({ length: 8 }, () => response({}, 429));
  for (let i = 0; i < 8; i++) await work(exhausted.id);
  assert.equal(jobs.get(exhausted.id).status, "failed");
  assert.equal(providerResponses.length, 0);
  assert.equal((await work(exhausted.id)).status, 200);

  const missed = requestBody();
  publishFails = true;
  assert.equal((await enqueue(missed)).status, 503);
  assert(jobs.has(missed.id), "A queue outage must not discard the essay");
  publishFails = false;
  assert.equal((await enqueue(missed)).status, 202);
  assert.equal(jobs.get(missed.id).attempts, 0);
  await failureCallback(missed.id);
  assert.equal(jobs.get(missed.id).error_code, "delivery_exhausted");
  assert.equal(jobs.get(missed.id).dead_letter_id, "dead-letter-1");
  const ownerJob = requestBody();
  assert.equal((await enqueue(ownerJob, { Authorization: "Bearer valid-session" })).status, 202);
  assert.equal(jobs.get(ownerJob.id).user_id, "verified-user");
  assert.equal((await enqueue(requestBody(), { Authorization: "Bearer forged-session" })).status, 401);
  assert.equal((await enqueue(requestBody(), { Origin: "https://other.example" })).status, 403);
  claimFails = true;
  assert.equal((await work(ownerJob.id)).status, 503, "Storage errors must not acknowledge queue delivery");
  claimFails = false;

  const cachePayload = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ feedback_language: "en", tasks: { task1: { feedback: "Clear writing" } } }) }] } }] };
  const privateCache = { Authorization: "Bearer valid-session" };
  const cacheRequest = { ...requestBody(), rubricVersion: "rubric-v1" };
  await enqueue(cacheRequest, privateCache);
  providerResponses = [response(cachePayload)];
  await work(cacheRequest.id);
  const completedCache = jobs.get(cacheRequest.id);
  assert(completedCache.cache_key);
  assert.equal(completedCache.cache_expires_at, null, "Provider output must not be cached before browser validation");
  assert.equal((await acceptCache(cacheRequest, randomUUID())).status, 404);
  assert.equal(completedCache.cache_expires_at, null);
  assert.equal((await enqueue({ ...cacheRequest, id: randomUUID(), token: randomUUID() }, privateCache)).status, 202, "Unvalidated output must not be reused");
  assert.equal((await acceptCache(cacheRequest)).status, 200);
  assert(completedCache.cache_expires_at);
  const beforeCache = publications.length;
  const providerCount = providerCalls.length;
  const duplicate = { ...cacheRequest, id: randomUUID(), token: randomUUID(), submission: { ...cacheRequest.submission, id: "another-copy" } };
  const hit = await enqueue(duplicate, privateCache);
  assert.equal(hit.status, 200);
  assert.deepEqual((await hit.json()).response, cachePayload);
  assert.equal(publications.length, beforeCache, "A cache hit must not publish another queue message");
  assert.equal(providerCalls.length, providerCount, "A cache hit must not call Gemini");
  assert.equal(jobs.get(duplicate.id).attempts, 0);
  assert.equal(jobs.get(duplicate.id).cache_expires_at, completedCache.cache_expires_at, "Reading a cache entry must not extend its lifetime");
  await acceptCache(duplicate);
  assert.equal(jobs.get(duplicate.id).cache_expires_at, completedCache.cache_expires_at);
  assert.equal((await status(duplicate)).status, 200, "Cached jobs retain their own read capability");
  assert.equal((await status(duplicate, cacheRequest.token)).status, 404);

  for (const change of [
    { request: { contents: [{ role: "user", parts: [{ text: "changed essay or question" }] }] } },
    { model: "gemini-3.6-flash" },
    { rubricVersion: "rubric-v2" },
    { request: { ...cacheRequest.request, generationConfig: { temperature: 0.9 } } },
    { request: { ...cacheRequest.request, systemInstruction: { parts: [{ text: "Reply in French" }] } } },
    { force: true },
  ]) {
    const changed = { ...cacheRequest, ...change, id: randomUUID(), token: randomUUID() };
    assert.equal((await enqueue(changed, privateCache)).status, 202, "Changed input and explicit fresh requests must bypass completed cache entries");
  }
  assert.equal((await enqueue({ ...cacheRequest, id: randomUUID(), token: randomUUID() }, { "X-TCF-Cache-Token": randomUUID() })).status, 401, "A guest capability cannot authorize a review");
  completedCache.cache_expires_at = new Date(Date.now() - 1000).toISOString();
  jobs.get(duplicate.id).cache_expires_at = completedCache.cache_expires_at;
  assert.equal((await enqueue({ ...cacheRequest, id: randomUUID(), token: randomUUID() }, privateCache)).status, 202, "Expired cache entries must not be used");

  const ownerCache = { ...requestBody(), rubricVersion: "rubric-v1" };
  await enqueue(ownerCache, { Authorization: "Bearer valid-session" });
  providerResponses = [response(cachePayload)];
  await work(ownerCache.id);
  await acceptCache(ownerCache);
  assert.equal((await enqueue({ ...ownerCache, id: randomUUID(), token: randomUUID() }, { Authorization: "Bearer valid-session" })).status, 200, "A signed-in owner can reuse cached output across browser capabilities");
  assert.equal((await enqueue({ ...ownerCache, id: randomUUID(), token: randomUUID() }, { Authorization: "Bearer other-session" })).status, 202, "Owners must not share private cache entries");
  assert.equal((await enqueue({ ...ownerCache, id: randomUUID(), token: randomUUID() }, { Authorization: "Bearer forged-session" })).status, 401);

  const blocked = { ...requestBody(), rubricVersion: "blocked-rubric" };
  await enqueue(blocked, privateCache);
  providerResponses = [response({ candidates: [{ finishReason: "MAX_TOKENS", content: cachePayload.candidates[0].content }] })];
  await work(blocked.id);
  assert.equal(jobs.get(blocked.id).cache_key, null, "Truncated or blocked provider output must not enter the cache");
  assert.equal((await enqueue({ ...blocked, id: randomUUID(), token: randomUUID() }, privateCache)).status, 202);

  process.env.EVALUATION_QUEUE_ENABLED = "false";
  assert.equal((await enqueue(requestBody())).headers.get("X-TCF-Queue-Disabled"), "1");
  assert.equal((await status(first)).status, 200, "Existing jobs remain readable when new queued jobs are disabled");

  const sql = await readFile("supabase/evaluation-jobs.sql", "utf8");
  assert(sql.includes("enable row level security"));
  assert(sql.includes("revoke all on function public.claim_evaluation_job(uuid, uuid) from public, anon, authenticated"));
  assert(sql.includes("supabase_realtime add table public.evaluation_jobs"));
  console.log("PASS: durable enqueue, capability/owner isolation, one provider call per delivery, leases, retry/fallback, terminal failures, queue outages, and safe job recovery.");
} finally {
  globalThis.fetch = oldFetch;
  console.warn = oldWarn;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  await runtime.cleanup();
}
