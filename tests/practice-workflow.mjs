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
const { revisionDiff } = await import(url(compile("src/utils/revisionDiff.ts")));
for (const [before, after] of [
  ["Je suis aller.\nMerci !", "Je suis allé.\nMerci !"],
  ["Très très bien", "Très bien !"], ["", "Bienvenue"], ["Bonjour", ""],
  ["Identique.", "Identique."], ["un ".repeat(2000), "deux ".repeat(2000)],
]) {
  const spans = revisionDiff(before, after);
  assert.equal(spans.filter(s => s.change !== "added").map(s => s.text).join(""), before);
  assert.equal(spans.filter(s => s.change !== "removed").map(s => s.text).join(""), after);
}
assert.deepEqual(revisionDiff("Je suis aller.", "Je suis allé."), [
  { change: "same", text: "Je suis " }, { change: "removed", text: "aller" },
  { change: "added", text: "allé" }, { change: "same", text: "." },
]);
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const practiceUrl = url(compile("src/utils/practice.ts"));
const practiceModule = await import(practiceUrl);
const practice = { ...practiceModule, ...practiceModule.draftStorage(localStorage) };
const storageUrl = url(compile("src/utils/storage.ts"));
const storageModule = await import(storageUrl);
const storage = { ...storageModule, ...storageModule.submissionStorage(localStorage) };
const backupModule = await import(
  url(
    compile("src/utils/backup.ts")
      .replace(/(['"])\.\/practice\1/, JSON.stringify(practiceUrl))
      .replace(/(['"])\.\/storage\1/, JSON.stringify(storageUrl)),
  )
);
const backup = backupModule.backupStorage(localStorage);
const nclcUrl = url(compile("src/utils/nclcComparison.ts"));
const reviews = await import(
  url(
    compile("src/utils/reviewState.ts").replace(
      /(['"])\.\/nclcComparison\1/,
      JSON.stringify(nclcUrl),
    ),
  )
);
const combination = {
  combination: 1,
  combinationNumber: 1,
  tasks: {
    task1: { instruction: "Message", minWords: 60, maxWords: 120 },
    task2: { instruction: "Récit", minWords: 120, maxWords: 150 },
    task3: {
      instruction: "Comparez",
      document1: "Un",
      document2: "Deux",
      minWords: 120,
      maxWords: 180,
    },
  },
};
const entry = { id: "fixture", year: "2026", month: "Novembre", combination };
const draft = practice.makeSession(entry, "task1");
assert.equal(draft.mode, "guided");
assert.equal(draft.runningSince, null);
draft.answers.task1 = "Un brouillon à conserver.";
assert.equal(practice.savePracticeSession(draft), true);
assert.deepEqual(
  practice.loadPracticeSession(),
  JSON.parse(JSON.stringify(draft)),
);
assert.equal(
  practice.sessionElapsed(
    { ...draft, elapsedSeconds: 15, runningSince: 1000 },
    11000,
  ),
  25,
);
assert.equal(
  practice.sessionElapsed(
    { ...draft, elapsedSeconds: 15, runningSince: null },
    11000,
  ),
  15,
);
assert.equal(
  practice.isPracticeSession({ ...draft, activeTask: "wrong" }),
  false,
);
assert.equal(
  practice.isPracticeSession({ ...draft, elapsedSeconds: -1 }),
  false,
);
const exam = practice.makeSession(entry, "exam");
assert.equal(exam.keys.length, 3);
assert.ok(exam.runningSince);
const result = {
  ...entry,
  id: "one",
  createdAt: "2026-11-13T12:00:00Z",
  answers: { task1: "Bonjour, mon ami.", task2: "", task3: "" },
  wordCounts: { task1: 3, task2: 0, task3: 0 },
  timeUsedSeconds: 40,
  isPracticeMode: true,
  practiceTasks: ["task1"],
};
const setId = "2026-Novembre-1";
const legacy = { ...result, practiceTasks: undefined, answers: { task1: "", task2: "Récit", task3: "" } };
const partialMock = { ...result, isPracticeMode: false, answers: { task1: " ", task2: "", task3: "Avis" } };
const blank = { ...result, month: "Mai", answers: practice.emptyAnswers() };
const progress = practice.combinationProgress([result, result, legacy, partialMock, blank]);
assert.deepEqual([...progress.get(setId).tasks], practice.TASK_KEYS);
assert.equal(progress.get(setId).mockCompleted, false);
assert.equal(progress.has("2026-Mai-1"), false);
const fullMock = { ...partialMock, month: "Juin", answers: { task1: "A", task2: "B", task3: "C" } };
const separateSets = practice.combinationProgress([result, fullMock]);
assert.deepEqual([...separateSets.get(setId).tasks], ["task1"]);
assert.equal(separateSets.get("2026-Juin-1").mockCompleted, true);
const revision = practice.makeSession(entry, "task1", result);
assert.equal(revision.revisionOf, "one");
assert.equal(revision.answers.task1, result.answers.task1);
assert.equal(revision.previousAnswer, result.answers.task1);
const summary = practice.practiceSummary(
  [result],
  new Date("2026-11-13T12:30:00Z"),
);
assert.equal(summary.counts.task1, 1);
assert.equal(summary.nextTask, "task2");
assert.equal(summary.weekCount, 1);
assert.equal(summary.latestProjection, undefined);
storage.saveSubmission(result);
storage.saveSubmission(result);
assert.equal(storage.getStoredSubmissions().length, 1);
localStorage.setItem("tcf_gemini_api_key", "secret-fixture");
localStorage.setItem("tcf_gemini_backup_api_key", "backup-secret-fixture");
localStorage.setItem(
  "tcf_reviewed_corrections",
  JSON.stringify(["correction1"]),
);
localStorage.setItem("tcf_favorite_topics", JSON.stringify(["favorite1"]));
const exported = backup.createBackup();
assert.ok(!JSON.stringify(exported).includes("secret-fixture"));
assert.equal(exported.submissions.length, 1);
localStorage.removeItem("tcf_reviewed_corrections");
localStorage.removeItem("tcf_favorite_topics");
backup.importBackup(exported);
assert.equal(storage.getStoredSubmissions().length, 1);
assert.deepEqual(JSON.parse(localStorage.getItem("tcf_reviewed_corrections")), [
  "correction1",
]);
assert.deepEqual(JSON.parse(localStorage.getItem("tcf_favorite_topics")), [
  "favorite1",
]);
const preserved = localStorage.getItem(practice.DRAFT_KEY);
backup.importBackup({ ...exported, draft: exam });
assert.equal(localStorage.getItem(practice.DRAFT_KEY), preserved);
assert.throws(() =>
  backup.importBackup({
    app: "ecriture",
    version: 2,
    submissions: [{ bad: true }],
  }),
);
assert.equal(storage.getStoredSubmissions().length, 1);
const correction = {
  id: "correction1",
  category: "Grammaire",
  original_text: "je suis aller",
  corrected_text: "je suis allé",
  explanation: "Participe passé",
  timestamp: 1,
  date: "13/11/2026",
};
backup.importBackup({ ...exported, mistakes: [correction] });
assert.equal(
  JSON.parse(localStorage.getItem("tcf_saved_mistakes_v1"))[0].id,
  "correction1",
);
const snapshot = new Map(values);
const write = localStorage.setItem;
let failOnce = true;
localStorage.setItem = (key, value) => {
  if (key === "tcf_reviewed_corrections" && failOnce) {
    failOnce = false;
    throw new Error("Fixture quota exhausted");
  }
  write(key, value);
};
assert.throws(
  () =>
    backup.importBackup({
      ...exported,
      reviewed: ["new"],
      submissions: [
        {
          ...result,
          id: "new",
          answers: { ...result.answers, task1: "Une nouvelle réponse." },
        },
      ],
    }),
  /quota/,
);
localStorage.setItem = write;
assert.deepEqual(
  [...values.entries()].sort(),
  [...snapshot.entries()].sort(),
  "A failed import must restore prior data",
);
const savedReview = {
  id: "review",
  created_at: "2026-11-13T12:00:00Z",
  model: "gemini-fixture",
  prompt_hash: "same",
  rubric_version: "v5",
  pedagogical: {
    feedback_language: "en",
    mock_projection: { lower: 6, upper: 8, rationale: "Fixture evidence." },
  },
};
const oldGroq = {...savedReview, model: "groq/legacy", id: "historical"};
const first = reviews.withGeminiReview({...result, dualAiEvaluation: {gemini: null, groq: oldGroq}}, savedReview);
assert.equal(first.aiEvaluation.pedagogical.mock_projection.lower, 6);
assert.equal(first.aiEvaluation.nclc_crosscheck, undefined, "New Gemini reviews are never crosschecked against historical models");
assert.equal(first.dualAiEvaluation.groq.id, "historical", "Keep historical feedback readable");
assert.equal(reviews.savedGeminiReview(first).id, "review");
assert.equal(reviews.savedGeminiReview({...result, aiEvaluation: oldGroq}), null);
const local = {
  ...result,
  revisionOf: "parent",
  cloudId: "cloud",
  aiEvaluation: savedReview,
  dualAiEvaluation: first.dualAiEvaluation,
};
const merged = storage.mergeSubmissions(
  [{ ...result, isPracticeMode: undefined, practiceTasks: undefined }],
  [local],
)[0];
assert.equal(merged.revisionOf, "parent");
assert.equal(merged.isPracticeMode, true);
assert.equal(merged.dualAiEvaluation.gemini.id, "review");
assert.equal(
  reviews.feedbackWithContext({ ...result, aiEvaluation: savedReview })
    .practice_context.isPracticeMode,
  true,
);
assert.equal(
  reviews.feedbackWithContext({ ...result, aiEvaluation: savedReview })
    .practice_context.combination.tasks.task1.instruction,
  "Message",
);
console.log(
  "PASS: draft recovery, timer continuity, revision lineage, real practice counts, upsert, secret-free backup/import, active-draft preservation, provider matching and cloud/local metadata.",
);
