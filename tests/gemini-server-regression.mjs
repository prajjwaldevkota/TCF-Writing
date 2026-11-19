import { errorLogsUrl } from "./helpers/error-log-modules.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = ts
  .transpileModule(fs.readFileSync("api/gemini.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(
    /(["'])\.\.\/server\/errorLogs\.js\1/,
    JSON.stringify(errorLogsUrl),
  );
const { default: { fetch: handler } } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const names = [
  "GEMINI_API_KEY",
  "VITE_GEMINI_API_KEY",
  "GEMINI_BACKUP_KEY",
  "GEMINI_BACKUP_API_KEY",
];
const saved = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
);
const oldFetch = globalThis.fetch;
const oldWarn = console.warn;
const oldLogKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
let logged = [];
console.warn = (_label, row) => logged.push(JSON.parse(row));
const body = {
  model: "gemini-4-hydrogen",
  request: { contents: [{ role: "user", parts: [{ text: "Test" }] }] },
};
const request = (value = body) =>
  new Request("https://fixture/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
let calls = [];
function arrange(primary, backup, responses, legacy = "") {
  for (const name of names) delete process.env[name];
  if (primary) process.env.GEMINI_API_KEY = primary;
  if (backup) process.env.GEMINI_BACKUP_KEY = backup;
  if (legacy) process.env.VITE_GEMINI_API_KEY = legacy;
  calls = [];
  logged = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    assert(response, "No unexpected provider request");
    if (response instanceof Error) throw response;
    return response;
  };
}
const success = () => new Response('{"candidates":[]}', { status: 200 });
try {
  arrange("", "", []);
  const missing = await handler(request());
  assert.equal(missing.status, 503);
  assert.equal(missing.headers.get("X-TCF-Error"), "server_not_configured");
  assert.equal(missing.headers.get("X-TCF-No-Retry"), "1");
  for (const [primary, backup, legacy, source, key] of [
    [
      "primary-sentinel",
      "backup-sentinel",
      "legacy-sentinel",
      "primary",
      "primary-sentinel",
    ],
    ["", "backup-sentinel", "", "backup", "backup-sentinel"],
    ["", "", "legacy-sentinel", "primary", "legacy-sentinel"],
  ]) {
    arrange(primary, backup, [success()], legacy);
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-TCF-Key-Source"), source);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers["x-goog-api-key"], key);
    assert(calls[0].url.includes("gemini-4-hydrogen:generateContent"));
    assert(!JSON.stringify([...response.headers]).includes("sentinel"));
    assert(!(await response.text()).includes("sentinel"));
  }
  arrange("", "", [success()]);
  process.env.GEMINI_BACKUP_API_KEY = "alternate-backup-sentinel";
  assert.equal((await handler(request())).status, 200);
  assert.equal(
    calls[0].options.headers["x-goog-api-key"],
    "alternate-backup-sentinel",
  );
  for (const status of [401, 403, 404, 429, 500]) {
    arrange("primary-sentinel", "backup-sentinel", [
      new Response("primary-sentinel", { status }),
      success(),
    ]);
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-TCF-Key-Source"), "backup");
    assert.deepEqual(
      calls.map((c) => c.options.headers["x-goog-api-key"]),
      ["primary-sentinel", "backup-sentinel"],
    );
    assert.equal(calls[0].url, calls[1].url);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].stage, "provider_http");
    assert.equal(logged[0].http_status, status);
    assert.equal(logged[0].key_source, "primary");
    assert.equal(
      logged[0].request_id,
      response.headers.get("X-TCF-Request-ID"),
    );
  }
  arrange("primary-sentinel", "backup-sentinel", [
    new Response("primary-sentinel", { status: 504 }),
  ]);
  const timeout = await handler(request());
  assert.equal(timeout.status, 504);
  assert.equal(timeout.headers.get("X-TCF-Error-Source"), "provider");
  assert.equal(timeout.headers.get("X-TCF-Model-Unavailable"), "1");
  assert.equal(calls.length, 1, "Advance models instead of repeating a slow model with another key");
  assert.equal(logged[0].http_status, 504);
  assert(!(await timeout.text()).includes("sentinel"));
  for (const status of [502, 503]) {
    arrange("primary-sentinel", "backup-sentinel", [new Response("{}", { status })]);
    const unavailable = await handler(request());
    assert.equal(unavailable.status, status);
    assert.equal(unavailable.headers.get("X-TCF-Error-Source"), "provider");
    assert.equal(unavailable.headers.get("X-TCF-Model-Unavailable"), "1");
    assert.equal(calls.length, 1);
  }
  arrange("same-sentinel", "same-sentinel", [
    new Response("same-sentinel", { status: 403 }),
  ]);
  const duplicate = await handler(request());
  assert.equal(duplicate.status, 403);
  assert.equal(calls.length, 1);
  assert(!(await duplicate.text()).includes("sentinel"));
  arrange("primary-sentinel", "backup-sentinel", [
    new Response("primary-sentinel", { status: 400 }),
  ]);
  assert.equal((await handler(request())).status, 400);
  assert.equal(calls.length, 1, "Invalid requests do not use backup quota");
  arrange("primary-sentinel", "backup-sentinel", []);
  assert.equal(
    (await handler(request({ ...body, model: "arbitrary-model" }))).status,
    400,
  );
  assert.equal((await handler(request(null))).status, 400);
  assert.equal(
    (
      await handler(
        new Request("https://fixture/api/gemini", {
          method: "POST",
          body: "invalid",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handler(new Request("https://fixture/api/gemini"))).status,
    405,
  );
  assert.equal(calls.length, 0);
  arrange("primary-sentinel", "backup-sentinel", [
    new Response("primary-sentinel", { status: 429 }),
    new Response("backup-sentinel", {
      status: 429,
      headers: { "Retry-After": "90" },
    }),
  ]);
  const quota = await handler(request());
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("Retry-After"), "90");
  assert(!(await quota.text()).includes("sentinel"));
  arrange("primary-sentinel", "backup-sentinel", [
    new Error("primary-sentinel"),
  ]);
  const failure = await handler(request());
  assert.equal(failure.status, 502);
  assert.equal(failure.headers.get("X-TCF-No-Retry"), "1");
  assert.equal(
    calls.length,
    1,
    "A network failure must not replay accepted work",
  );
  assert(!(await failure.text()).includes("sentinel"));
  for (const name of ["TimeoutError", "AbortError"]) {
    const error = new Error("primary-sentinel");
    error.name = name;
    arrange("primary-sentinel", "backup-sentinel", [error]);
    const expired = await handler(request());
    assert.equal(expired.status, 504);
    assert.equal(expired.headers.get("X-TCF-Error-Source"), "provider");
    assert.equal(expired.headers.get("X-TCF-Model-Unavailable"), "1");
    assert.equal(expired.headers.get("X-TCF-No-Retry"), null);
    assert.equal(calls.length, 1, "A server deadline must skip backup and allow a different model");
    assert.equal(logged[0].code, "timeout");
  }
  // Runtime variables are read for each request, independent of build-time flags.
  arrange("changed-runtime-sentinel", "", [success()]);
  assert.equal((await handler(request())).status, 200);
  assert.equal(
    calls[0].options.headers["x-goog-api-key"],
    "changed-runtime-sentinel",
  );
  console.log(
    "PASS: runtime server credentials, primary/backup/legacy support, bounded fallback, deduplication, safe diagnostics, validation and no ambiguous replay.",
  );
} finally {
  globalThis.fetch = oldFetch;
  console.warn = oldWarn;
  if (oldLogKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = oldLogKey;
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
