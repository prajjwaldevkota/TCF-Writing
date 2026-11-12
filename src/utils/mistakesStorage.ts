import { AIEvaluation, MistakeItem, SavedMistake } from '../types/aiEvaluation';
import { ExamResult, TaskKey } from '../types/exam';
import { getStoredSubmissions } from './storage';

export const MISTAKES_STORAGE_KEY = 'tcf_saved_mistakes_v1';

export const CANONICAL_CATEGORIES = [
  'Orthographe / Accents',
  'Grammaire',
  'Conjugaison / Temps',
  'Structure de phrase',
  'Vocabulaire',
  'Autres'
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

export function normalizeCategory(cat?: string): CanonicalCategory {
  if (!cat) return 'Autres';
  const c = cat.toLowerCase();
  if (c.includes('ortho') || c.includes('accent') || c.includes('spell')) {
    return 'Orthographe / Accents';
  }
  if (c.includes('temps') || c.includes('conjug') || c.includes('tense')) {
    return 'Conjugaison / Temps';
  }
  if (c.includes('struct') || c.includes('phrase') || c.includes('syntax')) {
    return 'Structure de phrase';
  }
  if (c.includes('gramm')) {
    return 'Grammaire';
  }
  if (c.includes('vocab') || c.includes('lexiq')) {
    return 'Vocabulaire';
  }
  return 'Autres';
}

export const CATEGORY_INFO: Record<
  CanonicalCategory,
  {
    icon: string;
    fr: string;
    en: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  'Orthographe / Accents': {
    icon: '🔤',
    fr: 'Orthographe / Accents',
    en: 'Spelling / Accents',
    bg: 'bg-purple-50/50',
    text: 'text-purple-900',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300'
  },
  'Grammaire': {
    icon: '📘',
    fr: 'Grammaire',
    en: 'Grammar',
    bg: 'bg-blue-50/50',
    text: 'text-blue-900',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300'
  },
  'Conjugaison / Temps': {
    icon: '⏱️',
    fr: 'Conjugaison / Temps',
    en: 'Conjugation / Tenses',
    bg: 'bg-amber-50/50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300'
  },
  'Structure de phrase': {
    icon: '🧩',
    fr: 'Structure de phrase',
    en: 'Sentence Structure',
    bg: 'bg-emerald-50/50',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300'
  },
  'Vocabulaire': {
    icon: '💡',
    fr: 'Vocabulaire',
    en: 'Vocabulary',
    bg: 'bg-teal-50/50',
    text: 'text-teal-900',
    border: 'border-teal-200',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-300'
  },
  'Autres': {
    icon: '📌',
    fr: 'Autres / Divers',
    en: 'Other',
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    border: 'border-slate-200',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300'
  }
};

/**
 * Read stored mistakes from localStorage, auto-syncing from past submissions if empty.
 */
export function getStoredMistakes(): SavedMistake[] {
  try {
    const raw = localStorage.getItem(MISTAKES_STORAGE_KEY);
    let mistakes: SavedMistake[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        mistakes = parsed;
      }
    }

    // Auto-seed/sync from stored submissions if any exist
    const submissions = getStoredSubmissions();
    if (submissions && submissions.length > 0) {
      const synced = mergeMistakesFromSubmissions(mistakes, submissions);
      if (synced.length !== mistakes.length) {
        localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(synced));
        return synced;
      }
    }

    return mistakes;
  } catch (err) {
    console.error('Error reading mistakes from localStorage:', err);
    return [];
  }
}

/**
 * Save mistakes found in a newly performed AI evaluation.
 */
export function saveEvaluationMistakes(evaluation: AIEvaluation, result: ExamResult): SavedMistake[] {
  if (!evaluation || !evaluation.tasks) {
    return getStoredMistakes();
  }

  const existingMistakes = getStoredMistakes();
  const newMistakes: SavedMistake[] = [];

  const comboNum = result.combination?.combinationNumber || result.combination?.combination || 1;
  const examTitle = `Combinaison ${comboNum} (${result.month} ${result.year})`;
  const dateFormatted = result.date || new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const now = Date.now();

  const taskKeys: TaskKey[] = ['task1', 'task2', 'task3'];
  let counter = 0;

  for (const tKey of taskKeys) {
    const taskEval = evaluation.tasks[tKey];
    if (!taskEval || !Array.isArray(taskEval.mistakes)) continue;

    const taskLabel = tKey === 'task1' ? 'Tâche 1' : tKey === 'task2' ? 'Tâche 2' : 'Tâche 3';

    for (const item of taskEval.mistakes) {
      if (!item.original_text && !item.corrected_text) continue;

      const normCategory = normalizeCategory(item.category);
      counter++;

      const savedItem: SavedMistake = {
        id: `mst_${now}_${counter}_${Math.random().toString(36).slice(2, 7)}`,
        category: normCategory,
        original_text: item.original_text || '',
        corrected_text: item.corrected_text || '',
        explanation: item.explanation || '',
        task_key: tKey,
        task_name: taskLabel,
        submission_id: result.id,
        exam_title: examTitle,
        date: dateFormatted,
        timestamp: now
      };

      // Check if duplicate already exists
      const isDuplicate = existingMistakes.some(
        (m) =>
          m &&
          (m.original_text || '').trim() === (savedItem.original_text || '').trim() &&
          (m.corrected_text || '').trim() === (savedItem.corrected_text || '').trim() &&
          m.submission_id === savedItem.submission_id
      ) || newMistakes.some(
        (m) =>
          m &&
          (m.original_text || '').trim() === (savedItem.original_text || '').trim() &&
          (m.corrected_text || '').trim() === (savedItem.corrected_text || '').trim() &&
          m.task_key === savedItem.task_key
      );

      if (!isDuplicate) {
        newMistakes.push(savedItem);
      }
    }
  }

  const updated = [...newMistakes, ...existingMistakes];
  try {
    localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving mistakes to localStorage:', e);
  }

  return updated;
}

/**
 * Merge mistakes from an array of submissions into existing mistakes
 */
export function mergeMistakesFromSubmissions(
  existing: SavedMistake[],
  submissions: ExamResult[]
): SavedMistake[] {
  if (!Array.isArray(existing) || !Array.isArray(submissions)) {
    return Array.isArray(existing) ? existing : [];
  }

  const result: SavedMistake[] = [...existing];
  let counter = 0;

  for (const sub of submissions) {
    if (!sub || !sub.aiEvaluation || !sub.aiEvaluation.tasks) continue;

    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination || 1;
    const examTitle = `Combinaison ${comboNum} (${sub.month || ''} ${sub.year || ''})`;
    const dateFormatted = sub.date || '—';

    const taskKeys: TaskKey[] = ['task1', 'task2', 'task3'];
    for (const tKey of taskKeys) {
      const taskEval = sub.aiEvaluation.tasks[tKey];
      if (!taskEval || !Array.isArray(taskEval.mistakes)) continue;

      const taskLabel = tKey === 'task1' ? 'Tâche 1' : tKey === 'task2' ? 'Tâche 2' : 'Tâche 3';

      for (const item of taskEval.mistakes) {
        if (!item || (!item.original_text && !item.corrected_text)) continue;

        const isDuplicate = result.some(
          (m) =>
            m &&
            (m.original_text || '').trim() === (item.original_text || '').trim() &&
            (m.corrected_text || '').trim() === (item.corrected_text || '').trim() &&
            (m.submission_id === sub.id || m.exam_title === examTitle)
        );

        if (!isDuplicate) {
          counter++;
          result.push({
            id: `mst_sync_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 6)}`,
            category: normalizeCategory(item.category),
            original_text: item.original_text || '',
            corrected_text: item.corrected_text || '',
            explanation: item.explanation || '',
            task_key: tKey,
            task_name: taskLabel,
            submission_id: sub.id,
            exam_title: examTitle,
            date: dateFormatted,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  return result;
}

/**
 * Delete a mistake by id
 */
export function deleteStoredMistake(id: string): SavedMistake[] {
  try {
    const mistakes = getStoredMistakes();
    const updated = mistakes.filter((m) => m.id !== id);
    localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error deleting mistake:', e);
    return [];
  }
}

/**
 * Clear all stored mistakes
 */
export function clearAllStoredMistakes(): void {
  try {
    localStorage.removeItem(MISTAKES_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing mistakes:', e);
  }
}
