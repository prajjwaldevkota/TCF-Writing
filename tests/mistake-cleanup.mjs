import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = file => ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const url = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const original = globalThis.localStorage;
const values = new Map();
let failKey = "";
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { if (key === failKey) throw new Error("Storage full"); values.set(key, value); },
  removeItem: key => values.delete(key),
};
const lifecycleUrl = url(compile("src/utils/mistakeLifecycle.ts"));
const lifecycle = await import(lifecycleUrl);
const storageUrl = url(compile("src/utils/storage.ts"));
const mistakes = await import(url(compile("src/utils/mistakesStorage.ts")
  .replaceAll(/(["'])\.\/mistakeLifecycle\1/g, JSON.stringify(lifecycleUrl))
  .replace(/(["'])\.\/storage\1/, JSON.stringify(storageUrl))));
const practiceUrl = url(compile("src/utils/practice.ts"));
const backup = await import(url(compile("src/utils/backup.ts")
  .replace(/(["'])\.\/storage\1/, JSON.stringify(storageUrl))
  .replace(/(["'])\.\/practice\1/, JSON.stringify(practiceUrl))));
const day = 86400_000;
const now = Date.now();
const first = { id: "one", original_text: "je suis aller", corrected_text: "je suis allé", explanation: "Accord", category: "Grammaire", submission_id: "essay-one", task_key: "task1", date: "today", timestamp: now - 365 * day };
const second = { ...first, id: "two", original_text: "il vont", corrected_text: "ils vont", task_key: "task2" };
const submission = {
  id: "essay-one", year: "2026", month: "Novembre", timeUsedSeconds: 60,
  combination: { combination: 1, combinationNumber: 1, tasks: Object.fromEntries(["task1", "task2", "task3"].map(key => [key, { instruction: "Test", minWords: 60, maxWords: 120 }])) },
  answers: { task1: "je suis aller", task2: "il vont", task3: "" },
  aiEvaluation: { tasks: { task1: { mistakes: [first] }, task2: { mistakes: [second] } } },
};
try {
  values.set("tcf_exam_submissions_v1", JSON.stringify([submission]));
  values.set(lifecycle.MISTAKES_STORAGE_KEY, JSON.stringify([first, second]));
  assert.equal(mistakes.getStoredMistakes().length, 2);
  lifecycle.markMistakeReviewed(first.id, now);
  assert.equal(lifecycle.getCleanupCandidates([first, second], now + 29 * day).length, 0);
  assert.deepEqual(lifecycle.getCleanupCandidates([first, second], now + 30 * day).map(m => m.id), [first.id]);
  assert.equal(mistakes.getStoredMistakes().length, 2, "An overdue reminder never deletes without consent");
  lifecycle.postponeMistakeCleanup(now + 30 * day);
  assert.equal(lifecycle.getCleanupCandidates([first, second], now + 36 * day).length, 0);
  assert.equal(lifecycle.getCleanupCandidates([first, second], now + 37 * day).length, 1);
  lifecycle.setMistakeCleanupDays(0, now);
  assert.equal(lifecycle.getCleanupCandidates([first, second], now + 500 * day).length, 0);
  lifecycle.setMistakeCleanupDays(90, now);
  assert.equal(lifecycle.getCleanupCandidates([first, second], now + 89 * day).length, 0);

  assert.deepEqual(mistakes.deleteStoredMistake(first.id).map(m => m.id), [second.id]);
  assert.equal(lifecycle.getReviewedMistakeIds().length, 0);
  assert.deepEqual(mistakes.getStoredMistakes().map(m => m.id), [second.id], "Reloading source feedback must not recreate a deleted correction");
  assert.equal(mistakes.mergeMistakesFromSubmissions([], [submission]).length, 1);
  const repeated = { ...submission, id: "a-new-practice" };
  assert.equal(mistakes.mergeMistakesFromSubmissions([], [repeated]).length, 2, "The same error in a later practice should still be saved");
  assert(!JSON.stringify(lifecycle.getMistakeLifecycle().deleted).includes(first.original_text), "Deleted text must not be kept in the deletion record");
  const exported = backup.createBackup();
  values.clear();
  backup.importBackup(exported);
  assert.equal(mistakes.getStoredMistakes().length, 1, "Backup restore preserves deleted corrections");
  mistakes.clearAllStoredMistakes();
  assert.equal(mistakes.getStoredMistakes().length, 0, "Clear all survives source reconstruction");

  values.clear();
  values.set(lifecycle.MISTAKES_STORAGE_KEY, JSON.stringify([first, second]));
  lifecycle.markMistakeReviewed(first.id, now);
  const before = new Map(values);
  failKey = lifecycle.MISTAKES_STORAGE_KEY;
  assert.throws(() => mistakes.deleteStoredMistake(first.id), /Storage full/);
  failKey = "";
  assert.deepEqual(values, before, "Failed deletion preserves mistakes, timestamps and review status");
  values.set(lifecycle.REVIEWED_KEY, JSON.stringify(["legacy-review"]));
  lifecycle.initializeReviewedMistakeDates(now);
  assert.equal(lifecycle.getMistakeLifecycle().reviewedAt["legacy-review"], now);
  values.set(lifecycle.LIFECYCLE_KEY, "corrupt-json");
  assert.equal(mistakes.getStoredMistakes().length, 2, "Invalid reminder preferences must not hide saved corrections");
  console.log("PASS: consent-only cleanup, review-date reminders, postponement, deletion surviving reload/sync/backup, new-practice preservation, legacy migration and storage-error rollback.");
} finally { globalThis.localStorage = original; }
