import type { ExamResult } from "../types/exam";
import { getStoredSubmissions, mergeSubmissions } from "./storage";
import { DRAFT_KEY, TASK_KEYS, isPracticeSession } from "./practice";
export function isSubmission(value: any): value is ExamResult {
  return (
    !!value &&
    typeof value.year === "string" &&
    typeof value.month === "string" &&
    typeof value.timeUsedSeconds === "number" &&
    Number.isFinite(value.timeUsedSeconds) &&
    value.timeUsedSeconds >= 0 &&
    !!value.combination?.tasks &&
    TASK_KEYS.every(
      (k) =>
        typeof value.answers?.[k] === "string" &&
        typeof value.combination.tasks[k]?.instruction === "string" &&
        typeof value.combination.tasks[k]?.minWords === "number" &&
        typeof value.combination.tasks[k]?.maxWords === "number",
    )
  );
}
export function createBackup() {
  const read = (key: string) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  return {
    app: "ecriture",
    version: 3,
    exportedAt: new Date().toISOString(),
    submissions: getStoredSubmissions(),
    draft: read(DRAFT_KEY),
    mistakes: read("tcf_saved_mistakes_v1") || [],
    reviewed: read("tcf_reviewed_corrections") || [],
    mistakeLifecycle: read("tcf_mistake_lifecycle_v1"),
    favorites: read("tcf_favorite_topics") || [],
  };
}
/** Backups contain practice data only. Never export API keys or auth state. */
export function importBackup(value: unknown): number {
  const data = value as ReturnType<typeof createBackup>;
  if (
    !data ||
    data.app !== "ecriture" ||
    ![1, 2, 3].includes(data.version) ||
    !Array.isArray(data.submissions) ||
    !data.submissions.every(isSubmission)
  )
    throw new Error("Invalid Écriture backup.");
  const combined = mergeSubmissions(getStoredSubmissions(), data.submissions);
  const readArray = (key: string): any[] => {
    try {
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  };
  const updates: Record<string, string> = {
    tcf_exam_submissions_v1: JSON.stringify(combined),
  };
  // Keep deletions when restoring practice data on another browser, so saved
  // feedback cannot silently repopulate corrections the learner removed.
  if (data.mistakeLifecycle && typeof data.mistakeLifecycle === "object") {
    let old: any;
    try { old = JSON.parse(localStorage.getItem("tcf_mistake_lifecycle_v1") || "null"); } catch { old = null; }
    const incoming = data.mistakeLifecycle;
    const validTimes = (value: any) => value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).filter(([, time]) => typeof time === "number" && Number.isFinite(time) && time > 0)) : {};
    updates.tcf_mistake_lifecycle_v1 = JSON.stringify({
      deleted: [...new Set([...(Array.isArray(old?.deleted) ? old.deleted : []), ...(Array.isArray(incoming.deleted) ? incoming.deleted : [])]
        .filter(id => typeof id === "string" && /^[0-9a-f]{16}$/.test(id)))],
      reviewedAt: { ...validTimes(incoming.reviewedAt), ...validTimes(old?.reviewedAt) },
      askAfterDays: [0, 30, 90].includes(old?.askAfterDays) ? old.askAfterDays
        : [0, 30, 90].includes(incoming.askAfterDays) ? incoming.askAfterDays : 30,
      remindAfter: Math.max(Number.isFinite(old?.remindAfter) ? old.remindAfter : 0, Number.isFinite(incoming.remindAfter) ? incoming.remindAfter : 0),
    });
  }
  if (
    Array.isArray(data.reviewed) &&
    data.reviewed.every((id) => typeof id === "string")
  )
    updates.tcf_reviewed_corrections = JSON.stringify([
      ...new Set([...readArray("tcf_reviewed_corrections"), ...data.reviewed]),
    ]);
  if (
    Array.isArray(data.favorites) &&
    data.favorites.every((id) => typeof id === "string")
  )
    updates.tcf_favorite_topics = JSON.stringify([
      ...new Set([...readArray("tcf_favorite_topics"), ...data.favorites]),
    ]);
  if (Array.isArray(data.mistakes)) {
    const valid = data.mistakes.filter(
      (m: any) =>
        m &&
        [
          "id",
          "category",
          "original_text",
          "corrected_text",
          "explanation",
        ].every((k) => typeof m[k] === "string") &&
        Number.isFinite(m.timestamp),
    );
    const old = readArray("tcf_saved_mistakes_v1");
    const ids = new Set(old.map((m) => m.id));
    updates.tcf_saved_mistakes_v1 = JSON.stringify([
      ...old,
      ...valid.filter((m: any) => !ids.has(m.id)),
    ]);
  }
  // Do not overwrite an unfinished session.
  if (!localStorage.getItem(DRAFT_KEY) && isPracticeSession(data.draft))
    updates[DRAFT_KEY] = JSON.stringify(data.draft);
  const previous = Object.fromEntries(
    Object.keys(updates).map((key) => [key, localStorage.getItem(key)]),
  );
  try {
    for (const [key, value] of Object.entries(updates))
      localStorage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of Object.entries(previous)) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {}
    }
    throw error;
  }
  return combined.length;
}
