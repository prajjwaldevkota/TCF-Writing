import { safeParseGeminiJson } from './aiJson';
export { safeParseGeminiJson } from './aiJson';
import { buildEvaluationInstructions, instructionFingerprint } from './evaluationInstructions';
import { validatePedagogicalAssessment } from './pedagogicalAssessment';
import { ExamResult, TaskKey } from '../types/exam';
import { AIEvaluation, TaskEvaluation, CefrLevel } from '../types/aiEvaluation';
import { countFrenchWords } from '../utils/wordCount';

const GEMINI_API_KEY_STORAGE = 'tcf_gemini_api_key';

export function getGeminiApiKey(): string {
  // 1. Check Vite env variable
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  // 2. Check LocalStorage
  const localKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  // 3. Built-in default key
  return '';
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_API_KEY_STORAGE);
}

/**
 * Determine which tasks were actively practiced / attempted
 */
export function getActiveEvaluatedTasks(result: ExamResult): TaskKey[] {
  if (result.isPracticeMode) {
    if (result.practiceTasks && result.practiceTasks.length > 0) {
      return result.practiceTasks as TaskKey[];
    }
    if (result.practiceTask) {
      const keys = typeof result.practiceTask === 'string'
        ? (result.practiceTask.split(',').map((s) => s.trim()) as TaskKey[])
        : [result.practiceTask as TaskKey];
      if (keys.length > 0) return keys;
    }
    // Fallback: check which tasks have non-empty text
    const filled = (['task1', 'task2', 'task3'] as TaskKey[]).filter(
      (k) => Boolean(result.answers[k]?.trim())
    );
    return filled.length > 0 ? filled : ['task1'];
  }

  // Full Exam: evaluate all tasks
  return ['task1', 'task2', 'task3'];
}

/**
 * Official TCF Canada EE (Expression Écrite / Writing) Score Conversion
 * Source: France Éducation international & IRCC
 */
export function mapScoreToTcfCanadaLevels(score: number): { cefr: CefrLevel; clb: string } {
  const rounded = Math.round(Math.max(0, Math.min(20, score)));
  if (rounded >= 18) return { cefr: 'C2', clb: 'CLB 10' };
  if (rounded >= 16) return { cefr: 'C1', clb: 'CLB 10' };
  if (rounded >= 14) return { cefr: 'C1', clb: 'CLB 9' };
  if (rounded >= 12) return { cefr: 'B2', clb: 'CLB 8' };
  if (rounded >= 10) return { cefr: 'B2', clb: 'CLB 7' }; // Benchmark for Express Entry bonus points
  if (rounded >= 7)  return { cefr: 'B1', clb: 'CLB 6' };
  if (rounded === 6) return { cefr: 'B1', clb: 'CLB 5' };
  if (rounded >= 4)  return { cefr: 'A2', clb: 'CLB 4' };
  return { cefr: 'A1', clb: '< CLB 4' };
}

export async function evaluateTcfSubmissionWithGemini(
  result: ExamResult,
  customApiKey?: string
): Promise<AIEvaluation> {
  const apiKey = (customApiKey || getGeminiApiKey()).trim();

  if (!apiKey) {
    throw new Error("Clé API Gemini introuvable. Veuillez renseigner votre clé API Google Gemini gratuite pour lancer l'évaluation.");
  }

  const activeTaskKeys = getActiveEvaluatedTasks(result);

  const feedbackLanguage = localStorage.getItem('tcf_language') === 'en' ? 'en' : 'fr';

  const {systemPrompt,userPrompt,rubricVersion}=buildEvaluationInstructions(result,activeTaskKeys,feedbackLanguage);
  const promptHash=await instructionFingerprint(systemPrompt + "\n" + userPrompt);

  // Pin a verified accessible model; never silently switch grading engines.
  const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(120000), // 2 min for the more thorough model
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15 }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini ${modelName}: HTTP ${response.status}. Évaluation non enregistrée.`);
  const payload = await response.json();
  const rawText = payload?.candidates?.[0]?.content?.parts
    ?.filter((part: any) => typeof part.text === 'string' && !part.thought)
    .map((part: any) => part.text).join('');
  const assessment = validatePedagogicalAssessment(safeParseGeminiJson(rawText), activeTaskKeys, result);
  if (assessment.feedback_language !== feedbackLanguage) throw new Error('AI returned the wrong feedback language.');
  const tasks: AIEvaluation['tasks'] = {};
  for (const key of activeTaskKeys) {
    const task = assessment.tasks[key]!;
    tasks[key] = {task_key:key,task_name:key,score:null,estimated_level:null,
      general_feedback:task.feedback, mistakes:task.mistakes,c1_c2_model_answer:task.model_answer};
  }
  return {
    id: `eval_${Date.now()}`, created_at:new Date().toISOString(),
    evaluated_tasks:activeTaskKeys, estimated_cefr_level:null,overall_score:null,
    overall_feedback:feedbackLanguage === 'en' ? 'This assessment is not official.' : 'Cette évaluation n\u2019est pas officielle.',
    model:modelName,rubric_version:rubricVersion,prompt_hash:promptHash,pedagogical:assessment,tasks
  };
}
