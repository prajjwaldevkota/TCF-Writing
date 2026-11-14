import type { AIEvaluation } from "../types/aiEvaluation";
import type { ExamResult } from "../types/exam";
import { crosscheckedPrimary } from "./nclcComparison";
export type ReviewProvider = "gemini" | "groq";
export function providerReview(
  result: ExamResult,
  provider: ReviewProvider,
): AIEvaluation | null {
  const dual = result.dualAiEvaluation?.[provider];
  if (dual) return dual;
  const review = result.aiEvaluation;
  return review &&
    (provider === "groq"
      ? review.model?.startsWith("groq/")
      : review.model?.startsWith("gemini"))
    ? review
    : null;
}
/** Only compare judgments made against the same answer and instruction contract. */
export function withProviderReview(
  result: ExamResult,
  provider: ReviewProvider,
  review: AIEvaluation,
): ExamResult {
  const other = provider === "gemini" ? "groq" : "gemini";
  const previous = providerReview(result, other);
  const compatible =
    previous?.prompt_hash &&
    previous.prompt_hash === review.prompt_hash &&
    previous.rubric_version === review.rubric_version
      ? previous
      : null;
  const gemini = provider === "gemini" ? review : compatible;
  const groq = provider === "groq" ? review : compatible;
  return {
    ...result,
    aiEvaluation: crosscheckedPrimary(gemini, groq) || review,
    dualAiEvaluation: { gemini, groq },
  };
}

/** Keep practice context inside the existing feedback column; no database migration. */
export function feedbackWithContext(result: ExamResult) {
  if (!result.aiEvaluation) return null;
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
