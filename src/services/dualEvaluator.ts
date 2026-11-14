import { buildEvaluationInstructions, instructionFingerprint } from './evaluationInstructions';
import { getActiveEvaluatedTasks } from './geminiEvaluator';
import { crosscheckedPrimary } from '../utils/nclcComparison';
import { ExamResult } from '../types/exam';
import { AIEvaluation } from '../types/aiEvaluation';
import { evaluateTcfSubmissionWithGemini, getGeminiApiKey } from './geminiEvaluator';
import { evaluateTcfSubmissionWithGroq, getGroqApiKey } from './groqEvaluator';

export type AIProvider = 'gemini' | 'groq';

export interface DualEvaluationResult {
  gemini: AIEvaluation | null;
  groq: AIEvaluation | null;
  geminiError: string | null;
  groqError: string | null;
  /** Saved review with a comparison of independent NCLC estimates */
  primary: AIEvaluation | null;
}

/**
 * Check which providers have valid API keys configured.
 */
export function getAvailableProviders(): { gemini: boolean; groq: boolean } {
  return {
    gemini: !!getGeminiApiKey(),
    groq: !!getGroqApiKey(),
  };
}

/**
 * Run a single provider evaluation.
 */
export async function evaluateWithProvider(
  provider: AIProvider,
  result: ExamResult,
  customApiKey?: string
): Promise<AIEvaluation> {
  if (provider === 'groq') {
    return evaluateTcfSubmissionWithGroq(result, customApiKey);
  }
  return evaluateTcfSubmissionWithGemini(result, customApiKey);
}

/**
 * Run BOTH Gemini and Groq evaluations in parallel.
 * Returns whichever succeed; errors are captured but don't block the other provider.
 */
export async function evaluateDual(result: ExamResult, previous?: DualEvaluationResult | null): Promise<DualEvaluationResult> {
  const available = getAvailableProviders();
  const language = localStorage.getItem('tcf_language') === 'en' ? 'en' : 'fr';
  const instructions = buildEvaluationInstructions(result, getActiveEvaluatedTasks(result), language);
  const hash = await instructionFingerprint(instructions.systemPrompt + "\n" + instructions.userPrompt);
  const reuse = (review: AIEvaluation | null | undefined) =>
    review?.prompt_hash === hash && review.rubric_version === instructions.rubricVersion ? review : null;
  const savedGemini = reuse(previous?.gemini);
  const savedGroq = reuse(previous?.groq);

  const geminiPromise = available.gemini
    ? (savedGemini ? Promise.resolve(savedGemini) : evaluateTcfSubmissionWithGemini(result))
        .then<[AIEvaluation, null]>(r => [r, null])
        .catch<[null, string]>(e => [null, e?.message || 'Gemini evaluation failed'])
    : Promise.resolve<[null, string]>([null, 'No Gemini API key configured']);

  const groqPromise = available.groq
    ? (savedGroq ? Promise.resolve(savedGroq) : evaluateTcfSubmissionWithGroq(result))
        .then<[AIEvaluation, null]>(r => [r, null])
        .catch<[null, string]>(e => [null, e?.message || 'Groq evaluation failed'])
    : Promise.resolve<[null, string]>([null, 'No Groq API key configured']);

  const [[geminiResult, geminiError], [groqResult, groqError]] = await Promise.all([
    geminiPromise,
    groqPromise,
  ]);

  return {
    gemini: geminiResult,
    groq: groqResult,
    geminiError,
    groqError,
    primary: crosscheckedPrimary(geminiResult, groqResult),
  };
}

