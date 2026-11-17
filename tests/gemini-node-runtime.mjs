import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

// Import real emitted files with Node's ESM resolver. The data-URL fixtures in
// other tests replace imports and cannot catch FUNCTION_INVOCATION_FAILED.
const output = await mkdtemp(path.join(tmpdir(), "tcf-node-runtime-"));
const oldFetch = globalThis.fetch;
const oldKey = process.env.GEMINI_API_KEY;
try {
  await writeFile(path.join(output, "package.json"), '{"type":"module"}');
  const program = ts.createProgram(["api/gemini.ts", "api/error-logs.ts", "api/evaluate.ts", "api/evaluation-worker.ts"], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    rootDir: process.cwd(),
    outDir: output,
    strict: true,
    skipLibCheck: true,
    types: ["node"],
    noEmitOnError: true,
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    }),
  );
  const { default: entry, config } = await import(
    pathToFileURL(path.join(output, "api/gemini.js")).href
  );
  assert.equal(typeof entry.fetch, "function");
  assert.equal(config.runtime, undefined, "Use the default Node.js runtime");
  const deployment = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.maxDuration, 300);
  assert.equal(deployment.functions["api/**/*.ts"].maxDuration, 300);

  process.env.GEMINI_API_KEY = "runtime-test-key";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.match(url, /generativelanguage\.googleapis\.com/);
    // Exercise the Web entry point while no response is available for >25s.
    await delay(26_000, undefined, { signal: options.signal });
    return new Response('{"candidates":[]}', {
      headers: { "Content-Type": "application/json" },
    });
  };
  const response = await entry.fetch(new Request("https://fixture/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.6-flash",
      request: { contents: [{ role: "user", parts: [{ text: "Test" }] }] },
    }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { candidates: [] });
  assert.equal(calls, 1);
  console.log("PASS: native Node ESM imports, Web fetch entry point, 300s configuration, and a mocked provider response after 26s.");
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = oldKey;
  await rm(output, { recursive: true, force: true });
}
