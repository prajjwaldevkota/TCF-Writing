import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

function moduleUrl(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from "([.][^"]+)"/g, (_, name) =>
    "from " + JSON.stringify(dependencies[name] ?? moduleUrl(path.resolve(path.dirname(file), name + ".ts"), dependencies)));
  return "data:text/javascript;base64," + Buffer.from(source).toString("base64");
}
const { workspaceStorage, mergeProgress } = await import(moduleUrl("src/utils/workspaceStorage.ts"));
const { submissionStorage } = await import(moduleUrl("src/utils/storage.ts"));
const { backupStorage } = await import(moduleUrl("src/utils/backup.ts"));
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const historyKey = "tcf_exam_submissions_v1";
const favorites = "tcf_favorite_topics";
const draft = "tcf_practice_session_v2";
localStorage.setItem(historyKey, JSON.stringify([{ id: "unowned" }]));
localStorage.setItem(favorites, '["unowned"]');
const alice = workspaceStorage("alice");
const bob = workspaceStorage("bob");
const guest = workspaceStorage(null);
const aliceHistory = submissionStorage(alice);
aliceHistory.saveSubmission({ id: "same-id", answers: { task1: "Alice" } });
alice.setItem(favorites, '["Alice"]');
alice.setItem(draft, '{"text":"Alice"}');
const lateSave = () => aliceHistory.updateStoredSubmission({ id: "same-id", answers: { task1: "Alice reviewed" } });
for (const other of [bob, guest]) {
  const exported = backupStorage(other).createBackup();
  assert.deepEqual(exported.submissions, []);
  assert.deepEqual(exported.favorites, []);
  assert.equal(exported.draft, null);
}
submissionStorage(bob).saveSubmission({ id: "same-id", answers: { task1: "Bob" } });
lateSave();
assert.equal(backupStorage(bob).createBackup().submissions[0].answers.task1, "Bob");
assert.equal(submissionStorage(workspaceStorage("alice")).getStoredSubmissions()[0].answers.task1, "Alice reviewed");
assert.equal(localStorage.getItem(favorites), '["unowned"]');
const base = { [favorites]: '["one","two"]' };
const local = { [favorites]: '["one","three"]' };
const cloud = { [favorites]: '["one","two","four"]', ecriture_personal_notes: "Other device" };
const merged = mergeProgress(base, local, cloud);
assert.deepEqual(JSON.parse(merged[favorites]), ["one", "four", "three"]);
assert.equal(merged.ecriture_personal_notes, "Other device");
assert.deepEqual(mergeProgress(base, base, cloud), cloud);
// Delay the first cloud fetch until another workspace is open. A retry must
// recover the owner's unsent writing, including a review added while offline.
const remoteRows = new Map();
const writes = [];
let online = false;
let release;
globalThis.historyBackend = {
  async fetchSubmissionsFromSupabase(owner) {
    if (!online) return { error: Error("offline") };
    await new Promise(resolve => { release = resolve; });
    return { submissions: [...remoteRows.values()].filter(row => row.owner === owner) };
  },
  async saveSubmissionToSupabase(owner, result) {
    writes.push(owner);
    remoteRows.set(result.id, { ...result, owner });
    return { data: { id: result.id } };
  },
  async updateSubmissionAiFeedback(id, owner, feedback) {
    assert.equal(remoteRows.get(id).owner, owner);
    remoteRows.get(id).aiEvaluation = feedback;
    return {};
  },
};
const backendUrl = "data:text/javascript," + encodeURIComponent(
  "export const { fetchSubmissionsFromSupabase, saveSubmissionToSupabase, updateSubmissionAiFeedback } = globalThis.historyBackend",
);
const { syncAccountHistory } = await import(moduleUrl("src/services/submissionSync.ts", { "../lib/supabase": backendUrl }));
aliceHistory.saveSubmission({ id: "offline-id", answers: { task1: "offline" }, pendingAccountSave: true });
await assert.rejects(syncAccountHistory(alice), /offline/);
assert.equal(aliceHistory.getStoredSubmissions()[0].pendingAccountSave, true);
online = true;
const sync = syncAccountHistory(alice);
const bobBefore = backupStorage(bob).createBackup().submissions;
release();
await sync;
assert.deepEqual(writes, ["alice"]);
assert.equal(aliceHistory.getStoredSubmissions()[0].pendingAccountSave, false);
assert.deepEqual(backupStorage(bob).createBackup().submissions, bobBefore);
await syncAccountHistory(guest);
console.log("PASS: isolated accounts, guests, backups, legacy records, delayed sync, offline retry and concurrent progress edits.");
