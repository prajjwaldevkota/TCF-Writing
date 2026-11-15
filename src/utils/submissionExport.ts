import type { ExamResult, TaskKey } from "../types/exam";
import { cleanDocumentText, normalizeParagraphText } from "./cleanText";
import { practicedKeys, TASK_INFO, TASK_KEYS } from "./practice";
import { countFrenchWords, formatTime } from "./wordCount";

/** Plain text for a tutor or another AI. Preserve answers exactly as written. */
export function submissionExport(
  result: ExamResult,
  onlyTask?: TaskKey,
): string {
  const keys = onlyTask
    ? [onlyTask]
    : result.isPracticeMode
      ? practicedKeys(result)
      : TASK_KEYS;
  const heading = [
    `TCF CANADA - ${result.isPracticeMode ? "ENTRAÎNEMENT PRATIQUE" : "EXPRESSION ÉCRITE"}`,
    `Combinaison ${result.combination.combinationNumber} (${result.month} ${result.year})`,
    `Temps utilisé : ${formatTime(result.timeUsedSeconds)}`,
  ].join("\n");
  return (
    heading +
    "\n\n" +
    keys
      .map((key) => {
        const requirement = result.combination.tasks[key];
        const answer = result.answers[key] || "";
        const instruction = normalizeParagraphText(requirement.instruction);
        const title = normalizeParagraphText(requirement.title);
        return [
          `--- TÂCHE ${TASK_INFO[key].number} (${countFrenchWords(answer)} mots / ${requirement.minWords}-${requirement.maxWords}) ---`,
          title && title !== instruction ? `Sujet : ${title}` : "",
          `Consigne : ${instruction || title}`,
          ...[requirement.document1, requirement.document2].map((doc, index) =>
            doc ? `Document ${index + 1} :\n${cleanDocumentText(doc)}` : "",
          ),
          `Réponse :\n${answer || "(Aucune réponse)"}`,
        ]
          .filter(Boolean)
          .join("\n\n");
      })
      .join("\n\n")
  );
}
