import type { SavedMistake } from "../types/aiEvaluation";
import type { WorkspaceStorage } from "./workspaceStorage";

import { mistakeFingerprint } from "./mistakeLifecycle";

const day = 24 * 60 * 60 * 1000;
const keyFor = (mistake: SavedMistake) => "tcf_drill_due:" + mistakeFingerprint({
  original_text: mistake.original_text, corrected_text: mistake.corrected_text,
});

export function dueCorrections(mistakes: SavedMistake[], store: WorkspaceStorage, now = Date.now()) {
  const seen = new Set<string>();
  return mistakes.flatMap(mistake => {
    if (!mistake.original_text?.trim() || !mistake.corrected_text?.trim()) return [];
    const key = keyFor(mistake);
    if (seen.has(key)) return [];
    seen.add(key);
    const due = Number(store.getItem(key)) || 0;
    return due <= now ? [{ mistake, due }] : [];
  }).sort((a, b) => {
    // Bring scheduled reviews back before introducing new corrections.
    if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
    return a.due - b.due || b.mistake.timestamp - a.mistake.timestamp;
  }).slice(0, 3).map(entry => entry.mistake);
}

export function scheduleCorrection(store: WorkspaceStorage, mistake: SavedMistake, matched: boolean, now = Date.now()) {
  store.setItem(keyFor(mistake), String(now + (matched ? 3 : 1) * day));
}

export function matchesCorrection(attempt: string, target: string) {
  const normalize = (text: string) => text.normalize("NFC").trim().replace(/[’‘]/gu, "'").replace(/\s+/gu, " ");
  return normalize(attempt) === normalize(target);
}
