import type { CombinationProgress, QuestionEntry } from "./practice";
import { TASK_KEYS } from "./practice";
import type { WorkspaceStorage } from "./workspaceStorage";

function completeSets(entries: QuestionEntry[]) {
  return entries.filter(entry =>
    TASK_KEYS.every(key => entry.combination.tasks[key]?.instruction?.trim()) &&
    entry.combination.tasks.task3.document1?.trim() &&
    entry.combination.tasks.task3.document2?.trim()
  );
}

function pick(entries: QuestionEntry[], previousId?: string, random = Math.random) {
  const pool = entries.length > 1 ? entries.filter(entry => entry.id !== previousId) : entries;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

export function selectRandomCombination(entries: QuestionEntry[], previousId?: string, random = Math.random) {
  return pick(completeSets(entries), previousId, random);
}

const historyKey = "tcf_combination_draws_v1";
const unsavedDraws = new WeakMap<WorkspaceStorage, string[]>();

export function drawPracticeCombination(
  entries: QuestionEntry[],
  progress: Map<string, CombinationProgress>,
  store: WorkspaceStorage,
  random = Math.random,
) {
  const complete = completeSets(entries);
  if (!complete.length) return null;
  let history = unsavedDraws.get(store);
  if (!history) {
    try {
      const stored: unknown = JSON.parse(store.getItem(historyKey) || "[]");
      if (Array.isArray(stored)) history = stored.filter(id => typeof id === "string");
    } catch { /* An in-memory cycle also works when storage is unavailable. */ }
  }
  history ??= [];
  const last = history[history.length - 1];
  const seen = new Set(history);
  let remaining = complete.filter(entry => !seen.has(entry.id));
  if (!remaining.length) {
    for (const entry of complete) seen.delete(entry.id);
    remaining = complete.length > 1 ? complete.filter(entry => entry.id !== last) : complete;
  }
  const tier = (entry: QuestionEntry) => {
    const record = progress.get(entry.id);
    return !record ? 0 : record.tasks.size < TASK_KEYS.length ? 1 : 2;
  };
  const best = remaining.reduce((min, entry) => Math.min(min, tier(entry)), 2);
  const selected = pick(remaining.filter(entry => tier(entry) === best), undefined, random);
  if (selected) {
    const next = [...seen, selected.id];
    try {
      store.setItem(historyKey, JSON.stringify(next));
      unsavedDraws.delete(store);
    } catch {
      unsavedDraws.set(store, next);
    }
  }
  return selected;
}
