import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function serverRuntime() {
  const directory = await mkdtemp(path.join(tmpdir(), "tcf-job-tests-"));
  await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
  const program = ts.createProgram(["api/evaluate.ts", "api/evaluation-worker.ts"], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, rootDir: process.cwd(),
    outDir: directory, strict: true, skipLibCheck: true, types: ["node"], noEmitOnError: true,
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
  }));
  return {
    evaluate: (await import(pathToFileURL(path.join(directory, "api/evaluate.js")).href)).default.fetch,
    worker: (await import(pathToFileURL(path.join(directory, "api/evaluation-worker.js")).href)).default.fetch,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
