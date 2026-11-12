import { ExamResult, TaskKey } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';
import { DimensionScore } from '../types/aiEvaluation';

export const LEVELS = ['A1 not achieved', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const DIMENSION_KEYS = ['task_fulfilment', 'coherence_cohesion', 'lexical_resource', 'grammar_accuracy'] as const;
export const DIMENSION_WEIGHTS: Record<typeof DIMENSION_KEYS[number], number> = {
  task_fulfilment: 0.30,
  coherence_cohesion: 0.25,
  lexical_resource: 0.20,
  grammar_accuracy: 0.25,
};

export interface PedagogicalTask {
  range: { lower: string; upper: string } | null;
  withholding_reason: string;
  communication_pass: string;
  language_pass: string;
  domains: { linguistic: string; pragmatic: string; sociolinguistic: string };
  limiting_evidence: string[];
  priorities: string[];
  risks: string[];
  source_checks: { document1: string; document2: string; comparison: string; reformulation: string } | null;
  feedback: string;
  strengths: string[];
  dimension_scores: DimensionScore[];
  indicative_score: number | null; // /20 indicative score
  model_answer: string;
  mistakes: { category: string; original_text: string; corrected_text: string; explanation: string }[];
}

export interface PedagogicalAssessment {
  feedback_language: 'en' | 'fr';
  mock_projection?: { lower: number; upper: number; rationale: string } | null;
  projection_withholding_reason?: string;
  overall_indicative_score?: number | null;
  tasks: Partial<Record<TaskKey, PedagogicalTask>>;
}

/**
 * Compute the indicative /20 from dimension scores using the fixed weights.
 */
export function computeIndicativeScore(dimensions: DimensionScore[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const d of dimensions) {
    const w = DIMENSION_WEIGHTS[d.dimension as keyof typeof DIMENSION_WEIGHTS] ?? 0.25;
    weightedSum += d.score * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  // Normalize to /20: each dimension is 0-5, weighted sum gives 0-5, multiply by 4
  const raw = (weightedSum / totalWeight) * 4;
  return Math.round(raw * 10) / 10; // one decimal
}

export function validatePedagogicalAssessment(raw: any, keys: TaskKey[], result: ExamResult): PedagogicalAssessment {
  if (!raw || !['en', 'fr'].includes(raw.feedback_language) || !raw.tasks) throw new Error('Incomplete AI assessment.');
  if (Object.keys(raw.tasks).some(k => !keys.includes(k as TaskKey))) throw new Error('AI assessed an unrequested task.');
  if (['overall_score', 'clb_level', 'nclc_level', 'official_score'].some(k => raw[k] != null)) throw new Error('AI must not return official or numerical results.');

  for (const key of keys) {
    const task = raw.tasks[key]; const req = result.combination.tasks[key];
    if (task && ['score', 'clb_level', 'nclc_level', 'official_score'].some(k => task[k] != null)) throw new Error('Task scores and NCLC estimates are not allowed.');
    if (!task || typeof task.feedback !== 'string' || !task.feedback.trim()) throw new Error(`Missing feedback: ${key}`);
    for (const name of ['communication_pass', 'language_pass']) if (typeof task[name] !== 'string' || !task[name].trim()) throw new Error(`Missing evidence: ${key}/${name}`);
    for (const name of ['linguistic', 'pragmatic', 'sociolinguistic']) if (typeof task.domains?.[name] !== 'string' || !task.domains[name].trim()) throw new Error(`Missing domain: ${name}`);
    for (const name of ['limiting_evidence', 'priorities', 'risks']) if (!Array.isArray(task[name]) || task[name].some((v: unknown) => typeof v !== 'string')) throw new Error(`Invalid ${name}`);
    if (task.priorities.length > 5) throw new Error('At most five priorities are allowed.');

    // Validate strengths (new field, graceful fallback)
    if (!Array.isArray(task.strengths)) task.strengths = [];
    task.strengths = task.strengths.filter((s: unknown) => typeof s === 'string' && (s as string).trim());

    // Validate dimension scores (new field)
    if (Array.isArray(task.dimension_scores)) {
      for (const dim of task.dimension_scores) {
        if (!DIMENSION_KEYS.includes(dim.dimension)) throw new Error(`Unknown dimension: ${dim.dimension}`);
        if (typeof dim.score !== 'number' || dim.score < 0 || dim.score > 5) throw new Error(`Dimension score out of range: ${dim.dimension} = ${dim.score}`);
        if (typeof dim.evidence !== 'string') dim.evidence = '';
        dim.weight = DIMENSION_WEIGHTS[dim.dimension as keyof typeof DIMENSION_WEIGHTS] ?? 0.25;
      }
      // Compute indicative /20 from dimensions
      task.indicative_score = computeIndicativeScore(task.dimension_scores);
    } else {
      task.dimension_scores = [];
      task.indicative_score = null;
    }

    // Validate model answer (new field, graceful fallback)
    if (typeof task.model_answer !== 'string') task.model_answer = '';

    const hasRange = task.range !== null;
    if (hasRange && (!task.range || !LEVELS.includes(task.range.lower) || !LEVELS.includes(task.range.upper) || LEVELS.indexOf(task.range.lower) > LEVELS.indexOf(task.range.upper))) throw new Error('Invalid pedagogical range.');
    // Enforce limitations even when a model ignores the instruction.
    const missingSource = key === 'task3' && (!req.document1?.trim() || !req.document2?.trim() || !(req.title || req.instruction)?.trim());
    const blank = countFrenchWords(result.answers[key] || '') === 0;
    if (missingSource || blank) {
      task.range = null;
      task.indicative_score = null;
      task.dimension_scores = [];
      task.withholding_reason = raw.feedback_language === 'en'
        ? (blank ? 'No response provided; a level cannot be assessed.' : 'The prompt and both documents are required to assess source fidelity and comparison.')
        : (blank ? 'Aucune réponse fournie : le niveau ne peut pas être évalué.' : 'La consigne et les deux documents sont nécessaires pour évaluer la fidélité et la comparaison.');
    }
    if (task.range === null && (typeof task.withholding_reason !== 'string' || !task.withholding_reason.trim())) throw new Error('A withheld range requires a reason.');
    if (key === 'task3' && !missingSource && !blank && (!task.source_checks || ['document1', 'document2', 'comparison', 'reformulation'].some(k => typeof task.source_checks[k] !== 'string' || !task.source_checks[k].trim()))) throw new Error('Missing Task 3 source checks.');
    if (!Array.isArray(task.mistakes)) throw new Error('Missing corrections.');
    if (blank) task.mistakes = [];
    for (const m of task.mistakes) {
      if (['category', 'original_text', 'corrected_text', 'explanation'].some(k => typeof m[k] !== 'string' || !m[k].trim())) throw new Error('Incomplete correction.');
      if (!(result.answers[key] || '').includes(m.original_text)) throw new Error('Correction quotes text absent from the response.');
    }
    if (blank) task.mistakes = [];
    // Deterministic word-limit risk, never an invented official penalty.
    const words = countFrenchWords(result.answers[key] || '');
    if (words < req.minWords || words > req.maxWords) task.risks.push(raw.feedback_language === 'en' ? `Word count ${words}; requested range ${req.minWords}–${req.maxWords}.` : `${words} mots ; plage demandée ${req.minWords}–${req.maxWords}.`);
  }

  // Compute overall indicative score from task scores
  const taskScores = keys
    .map(k => raw.tasks[k]?.indicative_score)
    .filter((s): s is number => typeof s === 'number');
  raw.overall_indicative_score = taskScores.length > 0
    ? Math.round((taskScores.reduce((a, b) => a + b, 0) / taskScores.length) * 10) / 10
    : null;

  const eligibility = mockProjectionEligibility(result, keys);
  if (!eligibility.eligible) {
    raw.mock_projection = null;
    raw.projection_withholding_reason = raw.feedback_language === 'en' ? eligibility.reason_en : eligibility.reason_fr;
  } else if (raw.mock_projection != null) {
    const p = raw.mock_projection;
    if (!Number.isInteger(p.lower) || !Number.isInteger(p.upper) || p.lower < 3 || p.upper > 10 || p.lower >= p.upper || typeof p.rationale !== 'string' || !p.rationale.trim()) {
      throw new Error('Invalid NCLC mock-exam projection: a justified range is required.');
    }
    raw.projection_withholding_reason = '';
  } else {
    raw.mock_projection = null;
    raw.projection_withholding_reason = typeof raw.projection_withholding_reason === 'string' && raw.projection_withholding_reason.trim()
      ? raw.projection_withholding_reason
      : (raw.feedback_language === 'en' ? 'The assessor withheld the full-exam projection because the evidence was insufficient.' : 'La projection globale est suspendue : les éléments disponibles sont insuffisants.');
  }
  return raw;
}

/** These checks establish enough input for an estimate, not official admissibility. */
export function mockProjectionEligibility(result: ExamResult, keys: TaskKey[]) {
  const allKeys: TaskKey[] = ['task1', 'task2', 'task3'];
  if (result.isPracticeMode || !allKeys.every(key => keys.includes(key))) return {
    eligible: false, reason_en: 'A complete three-task mock exam is required for an estimated NCLC range.',
    reason_fr: 'Un examen blanc complet de trois tâches est nécessaire pour estimer une plage NCLC.'
  };
  for (const key of allKeys) {
    const req = result.combination.tasks[key]; const words = countFrenchWords(result.answers[key] || '');
    if (!req.instruction?.trim() || words < req.minWords || words > req.maxWords) return {
      eligible: false, reason_en: 'All three tasks must have a prompt and a response within the requested word range.',
      reason_fr: 'Chaque tâche doit comporter une consigne et une réponse respectant la plage de mots demandée.'
    };
  }
  const task3 = result.combination.tasks.task3;
  if (!task3.document1?.trim() || !task3.document2?.trim()) return {
    eligible: false, reason_en: 'Both Task 3 documents are required for a full-exam estimate.',
    reason_fr: 'Les deux documents de la tâche 3 sont nécessaires pour une estimation globale.'
  };
  return { eligible: true, reason_en: '', reason_fr: '' };
}
