import type { QuestionEntry } from "./practice";
import { TASK_KEYS } from "./practice";

/** Draw one whole source set. Never draw the three tasks independently. */
export function selectRandomCombination(
  entries: QuestionEntry[],
  previousId?: string,
  random: () => number = Math.random,
): QuestionEntry | null {
  const complete = entries.filter(
    (entry) =>
      TASK_KEYS.every((key) =>
        entry.combination.tasks[key]?.instruction?.trim(),
      ) &&
      entry.combination.tasks.task3.document1?.trim() &&
      entry.combination.tasks.task3.document2?.trim(),
  );
  const candidates =
    complete.length > 1
      ? complete.filter((entry) => entry.id !== previousId)
      : complete;
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
