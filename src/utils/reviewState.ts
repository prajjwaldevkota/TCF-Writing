import type { AIEvaluation } from "../types/aiEvaluation";
import type { ExamResult } from "../types/exam";
export function savedGeminiReview(result: ExamResult): AIEvaluation | null {
  return (
    result.dualAiEvaluation?.gemini ||
    (result.aiEvaluation?.model?.startsWith("gemini")
      ? result.aiEvaluation
      : null)
  );
}
/** Retain historical reviews, but never combine a new Gemini assessment with them. */
export function withGeminiReview(
  result: ExamResult,
  review: AIEvaluation,
): ExamResult {
  return {
    ...result,
    aiEvaluation: review,
    dualAiEvaluation: {
      ...result.dualAiEvaluation,
      gemini: review,
      groq: result.dualAiEvaluation?.groq || null,
    },
  };
}

/** Keep practice context inside the existing feedback column; no database migration. */
export function feedbackWithContext(result: ExamResult) {
  return {
    ...result.aiEvaluation,
    practice_context: {
      isPracticeMode: !!result.isPracticeMode,
      practiceTasks: result.practiceTasks,
      practiceTask: result.practiceTask,
      allocatedMinutes: result.allocatedMinutes,
      revisionOf: result.revisionOf,
      createdAt: result.createdAt,
      combination: result.combination,
    },
  };
}
