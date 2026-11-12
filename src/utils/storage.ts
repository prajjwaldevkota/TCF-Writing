import { ExamResult } from '../types/exam';

const STORAGE_KEY = 'tcf_exam_submissions_v1';

export function getStoredSubmissions(): ExamResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading submissions from localStorage:', e);
    return [];
  }
}

export function saveSubmission(result: ExamResult): ExamResult {
  const submissions = getStoredSubmissions();
  
  const dateFormatted = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const newSubmission: ExamResult = {
    ...result,
    id: result.id || `sub_${Date.now()}`,
    date: result.date || dateFormatted
  };

  // Add to beginning of array
  const updated = [newSubmission, ...submissions];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving submission to localStorage:', e);
  }

  return newSubmission;
}

export function updateStoredSubmission(updatedResult: ExamResult): void {
  try {
    const submissions = getStoredSubmissions();
    const index = submissions.findIndex((s) => s.id === updatedResult.id);
    if (index !== -1) {
      submissions[index] = { ...submissions[index], ...updatedResult };
    } else {
      submissions.unshift(updatedResult);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error('Error updating submission in localStorage:', e);
  }
}

export function deleteStoredSubmission(id: string): void {
  try {
    const submissions = getStoredSubmissions();
    const updated = submissions.filter((sub) => sub.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting submission from localStorage:', e);
  }
}

export function clearSubmissions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing submissions:', e);
  }
}

export function syncStoredSubmissions(submissions: ExamResult[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error('Error syncing submissions to localStorage:', e);
  }
}

/**
 * Merges primary (e.g. Supabase) and secondary (e.g. LocalStorage) submissions
 * deduplicating by ID as well as matching combination & content.
 */
export function mergeSubmissions(primary: ExamResult[], secondary: ExamResult[]): ExamResult[] {
  const byId = new Map<string, ExamResult>();
  const byContent = new Map<string, ExamResult>();

  const getContentKey = (sub: ExamResult): string => {
    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
    const t1 = sub.answers?.task1 || '';
    const t2 = sub.answers?.task2 || '';
    const t3 = sub.answers?.task3 || '';
    return JSON.stringify([sub.year, sub.month, comboNum, sub.timeUsedSeconds, t1, t2, t3]);
  };

  // Primary (Supabase) is source of truth
  for (const sub of primary) {
    if (sub.id) byId.set(sub.id, sub);
    byContent.set(getContentKey(sub), sub);
  }

  // Secondary (LocalStorage) added only if not duplicate
  for (const sub of secondary) {
    const cKey = getContentKey(sub);
    const existing = (sub.id ? byId.get(sub.id) : undefined) || byContent.get(cKey);
    if (existing) {
      // Only merge evaluations of the exact same complete answers.
      const sameAnswers = (['task1', 'task2', 'task3'] as const).every(
        (key) => (existing.answers[key] || '') === (sub.answers[key] || '')
      );
      if (sameAnswers && sub.aiEvaluation && (!existing.aiEvaluation ||
        Date.parse(sub.aiEvaluation.created_at) > Date.parse(existing.aiEvaluation.created_at))) {
        existing.aiEvaluation = sub.aiEvaluation;
      }
      continue;
    }
    if (sub.id) byId.set(sub.id, sub);
    byContent.set(cKey, sub);
  }

  return Array.from(byContent.values());
}
