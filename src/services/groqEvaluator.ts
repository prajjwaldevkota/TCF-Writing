import { getRateLimitDeadline, recordRateLimit, rateLimitMessage } from './providerRateLimit';
import { buildEvaluationInstructions, instructionFingerprint } from './evaluationInstructions';
import { validatePedagogicalAssessment } from './pedagogicalAssessment';
import { getActiveEvaluatedTasks } from './geminiEvaluator';
import { safeParseGeminiJson } from './aiJson';
import { ExamResult, TaskKey } from '../types/exam';
import { AIEvaluation } from '../types/aiEvaluation';
import { countFrenchWords } from '../utils/wordCount';

const inFlight = new Map<string, Promise<AIEvaluation>>();

const GROQ_API_KEY_STORAGE = 'tcf_groq_api_key';

export function getGroqApiKey(): string {
  const localKey = localStorage.getItem(GROQ_API_KEY_STORAGE);
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return '';
}

export function setGroqApiKey(key: string): void {
  localStorage.setItem(GROQ_API_KEY_STORAGE, key.trim());
}

export function clearGroqApiKey(): void {
  localStorage.removeItem(GROQ_API_KEY_STORAGE);
}

/**
 * Evaluate using Groq Cloud (OpenAI-compatible API).
 */
export async function evaluateTcfSubmissionWithGroq(
  result: ExamResult,
  customApiKey?: string
): Promise<AIEvaluation> {
  const apiKey = (customApiKey || getGroqApiKey()).trim();

  if (!apiKey) {
    throw new Error("Clé API Groq introuvable. Veuillez renseigner votre clé API Groq pour lancer l'évaluation.");
  }

  const activeTaskKeys = getActiveEvaluatedTasks(result);
  const feedbackLanguage = localStorage.getItem('tcf_language') === 'en' ? 'en' : 'fr';
  const {systemPrompt,userPrompt,rubricVersion}=buildEvaluationInstructions(result,activeTaskKeys,feedbackLanguage);
  const promptHash=await instructionFingerprint(systemPrompt + "\n" + userPrompt);

  const modelName = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';

  const requestBody = JSON.stringify({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.15,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  });

  // Scope quota state to a key/model without persisting the API key itself.
  const quotaIdentity = await instructionFingerprint(`${modelName}\n${apiKey}`);
  const deadline = getRateLimitDeadline(quotaIdentity);
  if (deadline > Date.now()) throw new Error(rateLimitMessage(deadline, feedbackLanguage));
  const requestIdentity = `${quotaIdentity}:${promptHash}`;
  const existing = inFlight.get(requestIdentity);
  if (existing) return existing;

  async function run(): Promise<AIEvaluation> {
    async function requestAssessment() {
      // Try /api/groq endpoint first (Vercel Edge function & Vite dev proxy prevent browser CORS)
      let response: Response;
      response = await fetch('/api/groq', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
        signal: AbortSignal.timeout(120000),
        body: requestBody,
      });
      // Only a missing local endpoint warrants a direct request. A timeout can
      // occur after Groq accepted the job, so replaying it can consume quota twice.
      if (response.status === 404) {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
          signal: AbortSignal.timeout(120000),
          body: requestBody,
        });
      }
      if (response.status === 429) {
        const until = recordRateLimit(quotaIdentity, response.headers.get('Retry-After'));
        throw new Error(rateLimitMessage(until, feedbackLanguage));
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Groq ${modelName}: HTTP ${response.status}. ${errorBody.slice(0, 200)}. Évaluation non enregistrée.`);
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new Error('Réponse Groq tronquée : la limite de sortie a été atteinte. Veuillez relancer l’évaluation.');
      }
      return safeParseGeminiJson(choice?.message?.content);
    }
    // One generation per explicit attempt, including malformed/truncated output.
    const parsed = await requestAssessment();

    const assessment = validatePedagogicalAssessment(parsed, activeTaskKeys, result);
    if (assessment.feedback_language !== feedbackLanguage) throw new Error('AI returned the wrong feedback language.');

    const tasks: AIEvaluation['tasks'] = {};
    for (const key of activeTaskKeys) {
      const task = assessment.tasks[key]!;
      tasks[key] = {
        task_key: key, task_name: key, score: null, estimated_level: null,
        general_feedback: task.feedback, mistakes: task.mistakes, c1_c2_model_answer: task.model_answer
      };
    }

    return {
      id: `eval_groq_${Date.now()}`, created_at: new Date().toISOString(),
      evaluated_tasks: activeTaskKeys, estimated_cefr_level: null, overall_score: null,
      overall_feedback: feedbackLanguage === 'en' ? 'This assessment is not official.' : 'Cette évaluation n\u2019est pas officielle.',
      model: `groq/${modelName}`, rubric_version: rubricVersion, prompt_hash: promptHash, pedagogical: assessment, tasks
    };
  }
  const pending = run();
  inFlight.set(requestIdentity, pending);
  try { return await pending; }
  finally { inFlight.delete(requestIdentity); }

}

