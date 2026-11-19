import assert from "node:assert/strict";
import fs from "node:fs";
import {
  compile,
  moduleUrl,
  errorLogsUrl,
  logger,
} from "./helpers/error-log-modules.mjs";
const { default: { fetch: handler } } = await import(
  moduleUrl(
    compile("api/error-logs.ts").replace(
      /(["'])\.\.\/server\/errorLogs\.js\1/,
      JSON.stringify(errorLogsUrl),
    ),
  )
);
const clientLogger = await import(
  moduleUrl(compile("src/services/errorLogging.ts"))
);
assert.match(
  clientLogger.createLogRequestId(),
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);
const oldRandomUUID = crypto.randomUUID;
crypto.randomUUID = undefined;
try {
  assert.match(
    clientLogger.createLogRequestId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
} finally {
  crypto.randomUUID = oldRandomUUID;
}
const oldFetch = globalThis.fetch,
  oldWarn = console.warn;
const envNames = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const saved = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);
const reference = crypto.randomUUID();
const entry = {
  request_id: reference,
  source: "server",
  stage: "provider_http",
  code: "http_error",
  model: "gemini-4-hydrogen",
  key_source: "primary",
  attempt: 1,
  http_status: 429,
  duration_ms: 1250,
  retry_after_seconds: 90,
  provider_code: "RESOURCE_EXHAUSTED",
  client_context: {
    browser: "edge",
    platform: "windows",
    viewport_width: 1536,
    viewport_height: 740,
    online: true,
  },
};
let calls = [],
  warnings = [];
console.warn = (label, row) => warnings.push({ label, row: JSON.parse(row) });
try {
  const hostile = {
    ...entry,
    api_key: "secret-sentinel",
    writing: "student-sentinel",
    stack: "token-sentinel",
    error_type: "secret-sentinel",
    model: "secret-sentinel",
    provider_code: "secret-sentinel",
    request_id: "secret-sentinel",
    attempt: 999,
    duration_ms: NaN,
    http_status: 999,
    retry_after_seconds: Infinity,
    client_context: {
      ...entry.client_context,
      browser: "secret-sentinel",
      user_agent: "student-sentinel",
      viewport_width: 1e9,
    },
  };
  const safe = logger.sanitizeErrorLog(hostile);
  assert(!JSON.stringify(safe).includes("sentinel"));
  assert.equal(safe.model, null);
  assert.equal(safe.attempt, 2);
  assert.equal(safe.duration_ms, 0);
  assert.equal(safe.http_status, null);
  assert.equal(safe.client_context.viewport_width, 16000);
  assert.equal(safe.retry_after_seconds, null);
  assert.equal(logger.sanitizeErrorLog(entry).request_id, reference);
  assert.equal(logger.requestId("malformed").length, 36);
  assert.equal(
    logger.errorType(new DOMException("secret-sentinel", "TimeoutError")),
    "TimeoutError",
  );
  assert.equal(logger.retrySeconds("90"), 90);
  assert.equal(logger.retrySeconds("bad"), null);
  for (const name of envNames) delete process.env[name];
  assert.equal(await logger.persistErrorLog(entry), false);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].row.storage_status, "missing_database_url");
  let health = await handler(new Request("https://app.fixture/api/error-logs"));
  assert.equal(health.status, 503);
  assert.equal((await health.json()).storage, "missing_database_url");
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  assert.equal(await logger.errorLogStorageStatus(), "missing_server_key");
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-sentinel";
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 201 });
  };
  assert.equal(await logger.persistErrorLog(hostile), true);
  assert.equal(calls[0].url, "https://fixture.supabase.co/rest/v1/error_logs");
  assert.equal(calls[0].options.headers.apikey, "service-role-sentinel");
  assert(!calls[0].options.body.includes("sentinel"));
  assert(calls[0].options.signal instanceof AbortSignal);
  assert.equal(await logger.errorLogStorageStatus(), "ready");
  for (const [status, expected] of [
    [401, "database_access_denied"],
    [403, "database_access_denied"],
    [404, "missing_table"],
    [500, "database_rejected"],
  ]) {
    globalThis.fetch = async () => new Response("secret-sentinel", { status });
    health = await handler(new Request("https://app.fixture/api/error-logs"));
    assert.equal(health.status, 503);
    assert.equal((await health.json()).storage, expected);
  }
  globalThis.fetch = async () => {
    throw new Error("service-role-sentinel");
  };
  assert.equal(await logger.persistErrorLog(entry), false);
  assert.equal(warnings.at(-1).row.storage_status, "database_unreachable");
  assert.equal(await logger.errorLogStorageStatus(), "database_unreachable");
  assert(!JSON.stringify(warnings).includes("service-role-sentinel"));
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 201 });
  };
  const request = (body, headers = {}) =>
    new Request("https://app.fixture/api/error-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://app.fixture",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const client = {
    ...hostile,
    source: "server",
    stage: "client_network",
    code: "timeout",
    model: "gemini-4-hydrogen",
    request_id: reference,
  };
  const accepted = await handler(request(client));
  assert.equal(accepted.status, 201);
  assert.deepEqual(await accepted.json(), { stored: true });
  const stored = JSON.parse(calls.at(-1).options.body);
  assert.equal(stored.source, "client");
  assert.equal(stored.key_source, null);
  assert.equal(stored.attempt, 0);
  assert.equal(stored.http_status, null);
  assert(!JSON.stringify(stored).includes("sentinel"));
  const before = calls.length;
  assert.equal(
    (await handler(request(client, { Origin: "https://other.fixture" })))
      .status,
    403,
  );
  assert.equal(
    (await handler(request({ ...client, stage: "provider_http" }))).status,
    400,
  );
  assert.equal(
    (await handler(request({ ...client, extra: "x".repeat(5000) }))).status,
    413,
  );
  assert.equal(
    (await handler(new Request("https://app.fixture/api/error-logs", { method: "PUT" }))).status,
    405,
  );
  assert.equal(calls.length, before);
  globalThis.fetch = async () => new Response("secret-sentinel", { status: 403 });
  const rejected = await handler(request(client));
  assert.equal(rejected.status, 503, "Never acknowledge a failed database insert");
  assert.deepEqual(await rejected.json(), { stored: false });
  assert.equal(warnings.at(-1).row.storage_http_status, 403);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unconfigured = await handler(request(client));
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { stored: false });
  const sql = fs.readFileSync("supabase/error-logs.sql", "utf8");
  assert(sql.includes("enable row level security"));
  assert(
    sql.includes("revoke all on public.error_logs from anon, authenticated"),
  );
  assert(sql.includes("auth.jwt() -> 'app_metadata' ->> 'role'"));
  assert(!/for\s+(insert|update|delete)/i.test(sql));
  console.log(
    "PASS: safe diagnostic allowlist, bounded non-fatal persistence, service-only writes, client source isolation, origin/size validation, and admin policy migration contract.",
  );
} finally {
  globalThis.fetch = oldFetch;
  console.warn = oldWarn;
  for (const name of envNames) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
}
