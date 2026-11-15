import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";
const source = ts.transpileModule(fs.readFileSync("api/gemini.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { default: handler } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const oldKey = process.env.GEMINI_BACKUP_KEY,
  oldFetch = globalThis.fetch;
const body = {
  model: "gemini-3.8-flash",
  request: {
    contents: [{ role: "user", parts: [{ text: "Test" }] }],
    generationConfig: { responseMimeType: "application/json" },
  },
};
const request = (value = body, headers = {}) =>
  new Request("https://fixture/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(value),
  });
let calls = [];
try {
  delete process.env.GEMINI_BACKUP_KEY;
  assert.equal((await handler(request())).status, 401);
  process.env.GEMINI_BACKUP_KEY = "private-server-sentinel";
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response('{"candidates":[]}', { status: 200 });
  };
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].options.headers["x-goog-api-key"],
    "private-server-sentinel",
  );
  assert(calls[0].url.includes("gemini-3.8-flash:generateContent"));
  assert(
    !JSON.stringify([...response.headers]).includes("private-server-sentinel"),
  );
  assert(!(await response.text()).includes("private-server-sentinel"));
  const identicalHash = createHash("sha256")
    .update(body.model + "\nprivate-server-sentinel")
    .digest("hex");
  assert.equal(
    (await handler(request(body, { "x-tcf-primary-key-hash": identicalHash })))
      .status,
    409,
  );
  assert.equal(
    calls.length,
    1,
    "An identical backup key must not replay generation",
  );
  assert.equal(
    (await handler(request({ ...body, model: "arbitrary-model" }))).status,
    400,
  );
  assert.equal(
    (await handler(new Request("https://fixture/api/gemini"))).status,
    405,
  );
  globalThis.fetch = async () =>
    new Response("private-server-sentinel", {
      status: 429,
      headers: { "Retry-After": "90" },
    });
  const quota = await handler(request());
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("Retry-After"), "90");
  assert(!(await quota.text()).includes("private-server-sentinel"));
  let failureCalls = 0;
  globalThis.fetch = async () => {
    failureCalls++;
    throw new Error("private-server-sentinel");
  };
  const failed = await handler(request());
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get("X-TCF-No-Retry"), "1");
  assert.equal(failureCalls, 1);
  assert(!(await failed.text()).includes("private-server-sentinel"));
  console.log(
    "PASS: Vercel GEMINI_BACKUP_KEY stays server-side, same-model transport, identical-key rejection, error redaction, preserved cooldown and no network replay.",
  );
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.GEMINI_BACKUP_KEY;
  else process.env.GEMINI_BACKUP_KEY = oldKey;
}
