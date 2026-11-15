import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const url = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const stored = new Map();
const oldStorage = globalThis.localStorage,
  oldFetch = globalThis.fetch;
globalThis.localStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
globalThis.__geminiEnv = {};
const settingsUrl = url(
  compile("src/utils/geminiSettings.ts").replaceAll(
    "import.meta.env",
    "globalThis.__geminiEnv",
  ),
);
const settings = await import(settingsUrl);
const rateUrl = url(compile("src/services/providerRateLimit.ts"));
const parserUrl = url(compile("src/services/aiJson.ts"));
globalThis.__geminiFixture = {
  buildEvaluationInstructions: () => ({
    systemPrompt: "rubric",
    userPrompt: "answers",
    rubricVersion: "current",
  }),
  instructionFingerprint: async (text) =>
    createHash("sha256").update(text).digest("hex"),
  validatePedagogicalAssessment: (raw) => {
    if (raw.invalid) throw new Error("Invalid evidence");
    return {
      ...raw,
      feedback_language: "fr",
      tasks: { task1: { feedback: "Bilan", mistakes: [], model_answer: "" } },
    };
  },
};
const source = compile("src/services/geminiEvaluator.ts")
  .replace(/^import .*;\n/gm, "")
  .replace(/^export \{.*\} from .*;\n/gm, "");
const setup = `import {safeParseGeminiJson} from ${JSON.stringify(parserUrl)};
import {getRateLimitDeadline,recordRateLimit,rateLimitMessage} from ${JSON.stringify(rateUrl)};
import {getGeminiApiKey,getGeminiBackupApiKey,getGeminiModel,getGeminiModelChain,hasServerGeminiBackup} from ${JSON.stringify(settingsUrl)};
const {buildEvaluationInstructions,instructionFingerprint,validatePedagogicalAssessment}=globalThis.__geminiFixture;
`;
const { evaluateTcfSubmissionWithGemini: evaluate } = await import(
  url(setup + source)
);
const input = {
  isPracticeMode: true,
  practiceTasks: ["task1"],
  answers: { task1: "Bonjour", task2: "", task3: "" },
};
const success = (content = "{}", reason = "STOP") =>
  new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: content }] }, finishReason: reason },
      ],
    }),
  );
let calls = [];
function arrange(primary, backup, responses) {
  settings.setGeminiApiKey(primary);
  settings.setGeminiBackupApiKey(backup);
  calls = [];
  globalThis.fetch = async (endpoint, options) => {
    calls.push({
      endpoint,
      key: options.headers["x-goog-api-key"],
      body: JSON.parse(options.body),
    });
    const next = responses.shift();
    assert(next, "No unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  };
}
try {
  assert.equal(settings.getGeminiModel(), "gemini-3.8-flash");
  globalThis.__geminiEnv.VITE_GEMINI_API_KEY = "deployment-primary";
  assert.equal(settings.getGeminiApiKey(), "deployment-primary");
  globalThis.__geminiEnv.GEMINI_BACKUP_KEY = "deployment-backup";
  assert.equal(
    settings.getGeminiBackupApiKey(),
    "",
    "Unprefixed server keys must not be read by browser code",
  );
  settings.setGeminiBackupApiKey("browser-backup");
  assert.equal(settings.getGeminiBackupApiKey(), "browser-backup");
  settings.setGeminiApiKey(" browser-primary ");
  assert.equal(settings.getGeminiApiKey(), "browser-primary");
  globalThis.__geminiEnv = {};
  settings.setGeminiModel("gemini-3.1-flash-lite");
  assert.equal(
    settings.getGeminiModel(),
    "gemini-3.8-flash",
    "Ignore obsolete manual model choices",
  );
  globalThis.__geminiEnv.VITE_GEMINI_MODEL = "gemini-3.5-flash-lite";
  assert.equal(settings.getGeminiModel(), "gemini-3.5-flash-lite");
  delete globalThis.__geminiEnv.VITE_GEMINI_MODEL;
  settings.setGeminiModel("gemini-3.8-flash");
  assert.equal(settings.getGeminiModel(), "gemini-3.8-flash");
  assert.throws(() => settings.setGeminiModel("unknown-model"));
  arrange("primary-ok", "backup-unused", [success()]);
  const first = await evaluate(input);
  assert.equal(first.model, "gemini-3.8-flash");
  assert.equal(first.key_source, "primary");
  assert.equal(calls.length, 1);
  assert(calls[0].endpoint.includes("/gemini-3.8-flash:"));
  assert.equal(
    calls[0].body.generationConfig.responseMimeType,
    "application/json",
  );
  for (const status of [401, 403, 429, 500, 502, 503, 504]) {
    arrange("primary-" + status, "backup-" + status, [
      new Response("{}", { status, headers: { "Retry-After": "120" } }),
      success(),
    ]);
    const result = await evaluate(input);
    assert.equal(result.key_source, "backup");
    assert.deepEqual(
      calls.map((call) => call.key),
      ["primary-" + status, "backup-" + status],
    );
    assert.equal(
      calls[0].endpoint,
      calls[1].endpoint,
      "Never change models during key fallback",
    );
  }
  arrange("primary-429", "backup-429", [success()]);
  await evaluate(input);
  assert.deepEqual(
    calls.map((call) => call.key),
    ["backup-429"],
    "Skip cooling primary",
  );
  for (const status of [400]) {
    arrange("no-fallback-" + status, "unused-" + status, [
      new Response("{}", { status }),
    ]);
    await assert.rejects(evaluate(input), new RegExp("HTTP " + status));
    assert.equal(calls.length, 1);
  }
  arrange("chain-middle", "", [new Response("{}", { status: 404 }), success()]);
  const middle = await evaluate(input);
  assert.equal(middle.model, "gemini-3.6-flash");
  assert.equal(middle.requested_model, "gemini-3.8-flash");
  assert.equal(calls.length, 2);
  arrange("chain-final", "", [
    new Response("{}", { status: 429 }),
    new Response("{}", { status: 503 }),
    success(),
  ]);
  const final = await evaluate(input);
  assert.equal(final.model, "gemini-3.5-flash-lite");
  assert.deepEqual(
    calls.map((call) => call.endpoint.match(/models\/(.*):generateContent/)[1]),
    ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
  );
  arrange(
    "chain-exhaust",
    "chain-backup",
    Array.from({ length: 6 }, () => new Response("{}", { status: 404 })),
  );
  await assert.rejects(evaluate(input), /gemini-3.5-flash-lite.*HTTP 404/);
  assert.equal(calls.length, 6, "Three models with at most two keys per model");
  assert(
    !calls.some((call) => call.endpoint.includes("3.1")),
    "The chain stops at 3.5",
  );
  arrange("chain-cooling", "", [
    new Response("{}", { status: 429 }),
    new Response("{}", { status: 429 }),
    new Response("{}", { status: 429 }),
  ]);
  await assert.rejects(evaluate(input), /Quota Gemini/);
  assert.equal(calls.length, 3);
  arrange("chain-cooling", "", []);
  await assert.rejects(evaluate(input), /Quota Gemini/);
  assert.equal(calls.length, 0, "Skip models whose quota is cooling down");
  globalThis.__geminiEnv.VITE_GEMINI_SERVER_BACKUP = true;
  arrange("chain-server", "", [
    new Response("{}", { status: 404 }),
    new Response("{}", { status: 404 }),
    new Response("{}", { status: 429 }),
    success(),
  ]);
  assert.equal((await evaluate(input)).model, "gemini-3.6-flash");
  assert.equal(calls[3].endpoint, "/api/gemini");
  assert.equal(calls[3].body.model, "gemini-3.6-flash");
  arrange("chain-ambiguous", "", [
    new Response("{}", { status: 429 }),
    new Response("{}", { status: 502, headers: { "X-TCF-No-Retry": "1" } }),
  ]);
  await assert.rejects(evaluate(input), /aucun autre modèle/);
  assert.equal(
    calls.length,
    2,
    "Never switch model after an ambiguous server timeout",
  );
  delete globalThis.__geminiEnv.VITE_GEMINI_SERVER_BACKUP;
  arrange("network", "unused", [new Error("Network interruption")]);
  await assert.rejects(evaluate(input), /Connexion Gemini/);
  assert.equal(calls.length, 1);
  arrange("invalid-json", "unused", [success("bad-json")]);
  const oldError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(evaluate(input));
  } finally {
    console.error = oldError;
  }
  assert.equal(calls.length, 1);
  arrange("invalid-evidence", "unused", [success('{"invalid":true}')]);
  await assert.rejects(evaluate(input), /Invalid evidence/);
  assert.equal(calls.length, 1);
  arrange("truncated", "unused", [success("{}", "MAX_TOKENS")]);
  await assert.rejects(evaluate(input), /tronquée/);
  assert.equal(calls.length, 1);
  arrange("blocked", "unused", [success("{}", "SAFETY")]);
  await assert.rejects(evaluate(input), /n’a pas pu évaluer/);
  assert.equal(calls.length, 1);
  arrange("same-key", "same-key", [new Response("{}", { status: 403 })]);
  await assert.rejects(evaluate(input));
  assert.equal(calls.length, 1, "Duplicate keys never repeat a request");
  arrange("fail-primary", "fail-backup", [
    new Response("{}", { status: 401 }),
    new Response("{}", { status: 403 }),
  ]);
  await assert.rejects(evaluate(input), /HTTP 403/);
  assert.equal(calls.length, 2, "At most two attempts");
  arrange("stored-primary", "stored-backup", [
    new Response("{}", { status: 401 }),
  ]);
  await assert.rejects(evaluate(input, "explicit-custom"));
  assert.deepEqual(
    calls.map((call) => call.key),
    ["explicit-custom"],
    "Custom calls do not silently use configured keys",
  );
  arrange("", "backup-only", [success()]);
  assert.equal((await evaluate(input)).key_source, "backup");
  assert.equal(calls.length, 1);
  for (const [key, value] of stored)
    if (key.startsWith("tcf_gemini_retry_")) {
      assert(!key.includes("primary"));
      assert(!key.includes("backup"));
      assert(Number(value) > Date.now());
    }
  globalThis.__geminiEnv.VITE_GEMINI_SERVER_BACKUP = true;
  arrange("server-route-primary", "", [
    new Response("{}", { status: 401 }),
    success(),
  ]);
  const serverResult = await evaluate(input);
  assert.equal(serverResult.key_source, "backup");
  assert.equal(calls[1].endpoint, "/api/gemini");
  assert.equal(
    calls[1].key,
    undefined,
    "Server backup credentials never enter the browser",
  );
  assert.equal(calls[1].body.model, "gemini-3.8-flash");
  assert(calls[1].body.request.contents);
  delete globalThis.__geminiEnv.VITE_GEMINI_SERVER_BACKUP;
  settings.setGeminiApiKey("");
  settings.setGeminiBackupApiKey("");
  assert.equal(settings.hasGeminiKey(), false);
  console.log(
    "PASS: Gemini model selection, key precedence, bounded backup fallback, cooldown, same-key deduplication, backup-only setup, no timeout/invalid-response replay and secret-free quota state.",
  );
} finally {
  globalThis.localStorage = oldStorage;
  globalThis.fetch = oldFetch;
  delete globalThis.__geminiFixture;
  delete globalThis.__geminiEnv;
}
