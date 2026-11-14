import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const url = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const nclc = url(compile("src/utils/nclcComparison.ts"));
const state = url(
  compile("src/utils/reviewState.ts").replace(
    /(['"])\.\/nclcComparison\1/,
    JSON.stringify(nclc),
  ),
);
let calls = 0,
  release;
let hash = "same";
const review = {
  id: "review",
  model: "gemini-test",
  prompt_hash: "same",
  rubric_version: "current",
};
globalThis.__reviewFixture = {
  buildEvaluationInstructions: () => ({
    systemPrompt: "rubric",
    userPrompt: "answers",
    rubricVersion: "current",
  }),
  instructionFingerprint: async () => hash,
  getActiveEvaluatedTasks: () => ["task1"],
  evaluateWithProvider: () => {
    calls++;
    return new Promise((resolve) => {
      release = () => resolve(review);
    });
  },
};
const storage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => "en" };
const source = compile("src/services/reviewWorkflow.ts").replace(
  /^import .*;\n/gm,
  "",
);
const setup = `import {providerReview} from ${JSON.stringify(state)};
const {buildEvaluationInstructions,instructionFingerprint,getActiveEvaluatedTasks,evaluateWithProvider}=globalThis.__reviewFixture;
`;
try {
  const { reviewSubmission } = await import(url(setup + source));
  const result = { aiEvaluation: review };
  assert.equal(await reviewSubmission(result, "gemini"), review);
  assert.equal(calls, 0, "Matching saved review must not spend quota");
  const first = reviewSubmission({}, "gemini");
  const duplicate = reviewSubmission({}, "gemini");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  release();
  assert.equal(await first, await duplicate);
  const force = reviewSubmission(result, "gemini", true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  release();
  await force;
  hash = "changed";
  const changed = reviewSubmission(result, "gemini");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 3);
  release();
  await changed;
} finally {
  globalThis.localStorage = storage;
  delete globalThis.__reviewFixture;
}
console.log(
  "PASS: saved-review reuse, concurrent-request suppression, explicit reassessment and changed-input invalidation.",
);
