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
globalThis.__reviewErrors = [];
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
import {getGeminiModel,getGeminiModelChain} from ${JSON.stringify(settingsUrl)};
const {buildEvaluationInstructions,instructionFingerprint,validatePedagogicalAssessment}=globalThis.__geminiFixture;
const createLogRequestId=()=>crypto.randomUUID();
const getClientDiagnostics=()=>({browser:"chrome",platform:"windows",viewport_width:1536,viewport_height:740,online:true});
const reportReviewError=entry=>globalThis.__reviewErrors.push(entry);
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
    { headers: { "Content-Type": "application/json" } },
  );
let calls = [];
const oldNow = Date.now;
let clock = oldNow();
Date.now = () => clock;
function arrange(primary, backup, responses) {
  clock += 1_000_000;
  stored.clear();
  stored.set("tcf_gemini_api_key", primary);
  stored.set("tcf_gemini_backup_api_key", backup);
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
  settings.setGeminiModel("gemini-3.1-flash-lite");
  assert.equal(
    settings.getGeminiModel(),
    "gemini-3.8-flash",
    "Ignore obsolete manual model choices",
  );
  globalThis.__geminiEnv.VITE_GEMINI_MODEL = "gemini-3.5-flash-lite";
  assert.equal(settings.getGeminiModel(), "gemini-3.5-flash-lite");
  delete globalThis.__geminiEnv.VITE_GEMINI_MODEL;
  assert.throws(() => settings.setGeminiModel("unknown-model"));
  for (const [primary, backup] of [
    ["", ""],
    ["stale-primary", "stale-backup"],
  ]) {
    arrange(primary, backup, [success()]);
    const result = await evaluate(input);
    assert.equal(result.model, "gemini-3.8-flash");
    assert.equal(result.key_source, "primary");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].endpoint, "/api/gemini");
    assert.equal(
      calls[0].key,
      undefined,
      "Browser sends no provider credentials",
    );
    assert.equal(calls[0].body.model, "gemini-3.8-flash");
    assert.equal(
      calls[0].body.request.generationConfig.responseMimeType,
      "application/json",
    );
    assert(!JSON.stringify(calls).includes("stale-"));
  }
  arrange("", "", [
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "{}" }] }, finishReason: "STOP" },
        ],
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-TCF-Key-Source": "backup",
        },
      },
    ),
  ]);
  assert.equal((await evaluate(input)).key_source, "backup");
  arrange("", "", [
    new Response("{}", {
      status: 503,
      headers: {
        "X-TCF-Error": "server_not_configured",
        "X-TCF-No-Retry": "1",
      },
    }),
  ]);
  await assert.rejects(
    evaluate(input),
    /administrateur.*Aucune clé personnelle/,
  );
  assert.equal(
    calls.length,
    1,
    "Do not try every model for missing deployment configuration",
  );
  arrange("", "", [new Response("{}", { status: 401 })]);
  await assert.rejects(evaluate(input), /administrateur.*serveur/);
  arrange("", "", [
    new Response("<!doctype html>", {
      headers: { "Content-Type": "text/html" },
    }),
  ]);
  await assert.rejects(evaluate(input), /déploiement \/api\/gemini/);
  for (const status of [404, 429, 503]) {
    arrange("", "", [new Response("{}", { status }), success()]);
    assert.equal((await evaluate(input)).model, "gemini-3.6-flash");
    assert.deepEqual(
      calls.map((call) => call.endpoint),
      ["/api/gemini", "/api/gemini"],
    );
  }
  arrange(
    "",
    "",
    Array.from({ length: 3 }, () => new Response("{}", { status: 404 })),
  );
  await assert.rejects(evaluate(input), /gemini-3.5-flash-lite.*HTTP 404/);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => call.body.model),
    ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
  );
  const providerTimeout = () => new Response("{}", {
    status: 504,
    headers: { "X-TCF-Error-Source": "provider", "X-TCF-Model-Unavailable": "1" },
  });
  arrange("", "", [providerTimeout(), success()]);
  assert.equal((await evaluate(input)).model, "gemini-3.6-flash");
  assert.equal(calls.length, 2);
  arrange("", "", Array.from({ length: 3 }, providerTimeout));
  await assert.rejects(evaluate(input), /gemini-3.5-flash-lite.*HTTP 504/);
  assert.equal(calls.length, 3, "Provider deadline fallback is bounded");
  for (const headers of [{}, { "Content-Type": "text/html" }]) {
    arrange("", "", [new Response("Gateway timeout", { status: 504, headers })]);
    await assert.rejects(evaluate(input), /délai dépassé.*aucun autre modèle/);
    assert.equal(calls.length, 1, "Hosting timeouts must not replay accepted work");
    assert.equal(globalThis.__reviewErrors.at(-1).code, "timeout");
  }
  arrange("", "", [providerTimeout(), success()]);
  assert.equal((await evaluate(input, "explicit-diagnostic-key")).model, "gemini-3.6-flash");
  assert.equal(calls.length, 2, "Direct provider deadlines can advance models");
  arrange("", "", [
    new Response("{}", { status: 502, headers: { "X-TCF-No-Retry": "1" } }),
  ]);
  await assert.rejects(evaluate(input), /aucun autre modèle/);
  assert.equal(calls.length, 1);
  arrange("", "", [new Error("Network interruption")]);
  await assert.rejects(evaluate(input), /Connexion Gemini/);
  assert.equal(calls.length, 1);
  assert(
    globalThis.__reviewErrors.some(
      (entry) =>
        entry.stage === "client_network" && entry.code === "network_error",
    ),
  );
  assert(
    globalThis.__reviewErrors.every(
      (entry) => !JSON.stringify(entry).includes("obsolete"),
    ),
  );
  arrange("", "", [success("bad-json")]);
  const oldError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(evaluate(input));
  } finally {
    console.error = oldError;
  }
  assert.equal(calls.length, 1);
  arrange("", "", [success('{"invalid":true}')]);
  await assert.rejects(evaluate(input), /Invalid evidence/);
  assert.equal(calls.length, 1);
  arrange("", "", [success("{}", "MAX_TOKENS")]);
  await assert.rejects(evaluate(input), /tronquée/);
  arrange("", "", [success("{}", "SAFETY")]);
  await assert.rejects(evaluate(input), /n’a pas pu évaluer/);
  arrange(
    "",
    "",
    Array.from(
      { length: 3 },
      () =>
        new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
    ),
  );
  await assert.rejects(evaluate(input), /Quota Gemini/);
  calls = [];
  await assert.rejects(evaluate(input), /Quota Gemini/);
  assert.equal(calls.length, 0, "Skip server/model cooldowns");
  arrange("", "", [success()]);
  await evaluate(input, "explicit-diagnostic-key");
  assert.equal(calls[0].key, "explicit-diagnostic-key");
  console.log(
    "PASS: server reviews without browser keys, stale-key isolation, primary/backup metadata, deployment diagnostics, model fallback, cooldowns and no ambiguous replay.",
  );
} finally {
  Date.now = oldNow;
  globalThis.localStorage = oldStorage;
  globalThis.fetch = oldFetch;
  delete globalThis.__geminiFixture;
  delete globalThis.__geminiEnv;
  delete globalThis.__reviewErrors;
}
