import type { SavedMistake } from "../types/aiEvaluation";

export const MISTAKES_STORAGE_KEY = "tcf_saved_mistakes_v1";
export const REVIEWED_KEY = "tcf_reviewed_corrections";
export const LIFECYCLE_KEY = "tcf_mistake_lifecycle_v1";
export type CleanupDays = 0 | 30 | 90;
interface Lifecycle {
  deleted: string[];
  reviewedAt: Record<string, number>;
  askAfterDays: CleanupDays;
  remindAfter: number;
}

export function getReviewedMistakeIds(): string[] {
  const value = JSON.parse(localStorage.getItem(REVIEWED_KEY) || "[]");
  return Array.isArray(value) ? value.filter(id => typeof id === "string") : [];
}
export function getMistakeLifecycle(): Lifecycle {
  const value = JSON.parse(localStorage.getItem(LIFECYCLE_KEY) || "{}");
  return {
    deleted: Array.isArray(value?.deleted) ? value.deleted.filter((id: unknown) => typeof id === "string" && /^[0-9a-f]{16}$/.test(id)) : [],
    reviewedAt: value?.reviewedAt && typeof value.reviewedAt === "object"
      ? Object.fromEntries(Object.entries(value.reviewedAt).filter(([, time]) => typeof time === "number" && Number.isFinite(time) && time > 0)) as Record<string, number> : {},
    askAfterDays: [0, 30, 90].includes(value?.askAfterDays) ? value.askAfterDays : 30,
    remindAfter: Number.isFinite(value?.remindAfter) ? value.remindAfter : 0,
  };
}

// Stable fingerprints remember which source correction was removed, without
// keeping its original/corrected text in the deletion record. These are local
// identity hashes, not security tokens. A new submission can repeat the error.
export function mistakeFingerprint(m: SavedMistake): string {
  const text = JSON.stringify([m.submission_id || m.exam_title || "", m.task_key || m.task_name || "", m.original_text.trim(), m.corrected_text.trim()]);
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 0x01000193);
    second = Math.imul(second ^ text.charCodeAt(index), 0x85ebca6b);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}
export function filterDeletedMistakes(mistakes: SavedMistake[]): SavedMistake[] {
  const deleted = new Set(getMistakeLifecycle().deleted);
  return mistakes.filter(m => !deleted.has(mistakeFingerprint(m)));
}

// A failed write must not look like a successful deletion or review.
function writeTogether(updates: Record<string, unknown>) {
  const previous = Object.fromEntries(Object.keys(updates).map(key => [key, localStorage.getItem(key)]));
  try {
    for (const [key, value] of Object.entries(updates)) localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    for (const [key, value] of Object.entries(previous)) {
      try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Best-effort rollback. */ }
    }
    throw error;
  }
}

export function markMistakeReviewed(id: string, now = Date.now()): string[] {
  const state = getMistakeLifecycle();
  const reviewed = [...new Set([...getReviewedMistakeIds(), id])];
  state.reviewedAt[id] ??= now;
  writeTogether({ [LIFECYCLE_KEY]: state, [REVIEWED_KEY]: reviewed });
  return reviewed;
}
export function removeMistakes(mistakes: SavedMistake[], ids: string[]): SavedMistake[] {
  const selected = new Set(ids);
  const state = getMistakeLifecycle();
  state.deleted = [...new Set([...state.deleted, ...mistakes.filter(m => selected.has(m.id)).map(mistakeFingerprint)])];
  for (const id of selected) delete state.reviewedAt[id];
  const remaining = mistakes.filter(m => !selected.has(m.id));
  writeTogether({
    [LIFECYCLE_KEY]: state,
    [MISTAKES_STORAGE_KEY]: remaining,
    [REVIEWED_KEY]: getReviewedMistakeIds().filter(id => !selected.has(id)),
  });
  return remaining;
}

export function setMistakeCleanupDays(days: CleanupDays, now = Date.now()) {
  if (![0, 30, 90].includes(days)) throw new Error("Invalid cleanup period");
  const state = getMistakeLifecycle();
  state.askAfterDays = days;
  state.remindAfter = 0;
  // Old review IDs have no reliable review date. Start their reminder clock
  // now, instead of treating the mistake's creation date as its learning date.
  for (const id of getReviewedMistakeIds()) state.reviewedAt[id] ??= now;
  localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(state));
}
export function getCleanupCandidates(mistakes: SavedMistake[], now = Date.now()): SavedMistake[] {
  const state = getMistakeLifecycle();
  if (!state.askAfterDays || state.remindAfter > now) return [];
  const reviewed = new Set(getReviewedMistakeIds());
  const cutoff = now - state.askAfterDays * 86400_000;
  return mistakes.filter(m => reviewed.has(m.id) && state.reviewedAt[m.id] > 0 && state.reviewedAt[m.id] <= cutoff);
}
export function postponeMistakeCleanup(now = Date.now()) {
  const state = getMistakeLifecycle();
  state.remindAfter = now + 7 * 86400_000;
  localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(state));
}
