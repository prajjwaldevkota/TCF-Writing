import type { ExamResult } from "../types/exam";
import type { AIEvaluation } from "../types/aiEvaluation";
import { providerReview, ReviewProvider } from "../utils/reviewState";
import {
  buildEvaluationInstructions,
  instructionFingerprint,
} from "./evaluationInstructions";
import { getActiveEvaluatedTasks } from "./geminiEvaluator";
import { evaluateWithProvider } from "./dualEvaluator";
const pending = new Map<string, Promise<AIEvaluation>>();
export async function reviewSubmission(
  result: ExamResult,
  provider: ReviewProvider,
  force = false,
): Promise<AIEvaluation> {
  const language = localStorage.getItem("tcf_language") === "en" ? "en" : "fr";
  const instructions = buildEvaluationInstructions(
    result,
    getActiveEvaluatedTasks(result),
    language,
  );
  const hash = await instructionFingerprint(
    instructions.systemPrompt + "\n" + instructions.userPrompt,
  );
  const saved = providerReview(result, provider);
  if (
    !force &&
    saved?.prompt_hash === hash &&
    saved.rubric_version === instructions.rubricVersion
  )
    return saved;
  const key = provider + ":" + hash;
  const running = pending.get(key);
  if (running) return running;
  const request = evaluateWithProvider(provider, result);
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
