import type { ExamResult } from "../types/exam";
import type { AIEvaluation } from "../types/aiEvaluation";
import { savedGeminiReview } from "../utils/reviewState";
import {
  buildEvaluationInstructions,
  instructionFingerprint,
} from "./evaluationInstructions";
import {
  getActiveEvaluatedTasks,
  evaluateTcfSubmissionWithGemini,
} from "./geminiEvaluator";
import { getGeminiModel } from "../utils/geminiSettings";
import { pendingEvaluationJobMatches } from "./evaluationJobs";
const pending = new Map<string, Promise<AIEvaluation>>();
export async function resumeSubmissionReview(result: ExamResult, owner?: string): Promise<AIEvaluation | null> {
  const language = localStorage.getItem("tcf_language") === "en" ? "en" : "fr";
  const instructions = buildEvaluationInstructions(result, getActiveEvaluatedTasks(result), language);
  const fingerprint = await instructionFingerprint(instructions.systemPrompt + "\n" + instructions.userPrompt);
  if (!pendingEvaluationJobMatches(result.id, getGeminiModel(getActiveEvaluatedTasks(result)), fingerprint, owner)) return null;
  return reviewSubmission(result, true, owner);
}
export async function reviewSubmission(
  result: ExamResult,
  force = false,
  owner?: string,
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
  const model = getGeminiModel(getActiveEvaluatedTasks(result));
  const saved = savedGeminiReview(result);
  if (
    !force &&
    (saved?.requested_model || saved?.model) === model &&
    saved?.prompt_hash === hash &&
    saved.rubric_version === instructions.rubricVersion
  )
    return saved;
  const key = JSON.stringify([owner, result.id, model, hash]);
  const running = pending.get(key);
  if (running) return running;
  const request = evaluateTcfSubmissionWithGemini(result, undefined, model, force, owner);
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
