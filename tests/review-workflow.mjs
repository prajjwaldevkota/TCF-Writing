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
let model = "gemini-test";
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
  getGeminiModel: () => model,
  matchingJob: false,
  evaluateTcfSubmissionWithGemini: () => {
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
const setup = `import {savedGeminiReview} from ${JSON.stringify(state)};
const {buildEvaluationInstructions,instructionFingerprint,getActiveEvaluatedTasks,evaluateTcfSubmissionWithGemini,getGeminiModel}=globalThis.__reviewFixture;
const pendingEvaluationJobMatches=()=>globalThis.__reviewFixture.matchingJob;
`;
try {
  const { reviewSubmission, resumeSubmissionReview } = await import(url(setup + source));
  const result = { aiEvaluation: review };
  assert.equal(await reviewSubmission(result), review);
  assert.equal(calls, 0, "Matching saved review must not spend quota");
  const fallbackReview = {
    ...review,
    model: "gemini-fallback",
    requested_model: model,
  };
  assert.equal(
    await reviewSubmission({ aiEvaluation: fallbackReview }),
    fallbackReview,
    "Reuse a matching fallback assessment without starting the chain again",
  );
  assert.equal(calls, 0);
  const first = reviewSubmission({});
  const duplicate = reviewSubmission({});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  release();
  assert.equal(await first, await duplicate);
  const force = reviewSubmission(result, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  release();
  await force;
  hash = "changed";
  const changed = reviewSubmission(result);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 3);
  release();
  await changed;
  hash = "same";
  model = "gemini-other";
  const newModel = reviewSubmission(result);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 4, "Changing model must not reuse an older model review");
  release();
  await newModel;
  const beforeResume = calls;
  assert.equal(await resumeSubmissionReview(result), null);
  assert.equal(calls, beforeResume, "Opening a page must not create an unrequested review");
  globalThis.__reviewFixture.matchingJob = true;
  const resumed = resumeSubmissionReview(result);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, beforeResume + 1, "Recover a requested job even when older feedback is saved");
  release();
  assert.equal(await resumed, review);
} finally {
  globalThis.localStorage = storage;
  delete globalThis.__reviewFixture;
}
console.log(
  "PASS: saved-review reuse, concurrent-request suppression, explicit reassessment and changed-input invalidation.",
);
