import { createClient } from '@supabase/supabase-js';
import { ExamResult, ExamCombination } from '../types/exam';
import questionsData from '../data/questions.json';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

export function getSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('tcf_supabase_anon_key');
    if (local && local.trim().length > 0) return local.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

export function setSupabaseAnonKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key && key.trim().length > 0) {
      localStorage.setItem('tcf_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('tcf_supabase_anon_key');
    }
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && getSupabaseAnonKey());

export function getSupabase() {
  const key = getSupabaseAnonKey();
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key);
}

export const supabase = getSupabase();

export interface DBSubmission {
  id?: string;
  user_id: string;
  year: string;
  month: string;
  combination: number;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  task1_answer: string;
  task1_word_count: number;
  task2_answer: string;
  task2_word_count: number;
  task3_answer: string;
  task3_word_count: number;
  created_at?: string;
}

import { getLocalISOString } from '../utils/dateUtils';

/**
 * Saves a completed exam submission to Supabase
 */
export async function saveSubmissionToSupabase(
  userId: string,
  result: ExamResult,
  startedAt?: string
): Promise<{ data: DBSubmission | null; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase configuration missing.') };
  }

  const now = new Date();
  const completedAt = getLocalISOString(now);
  const calculatedStartedAt = startedAt
    ? startedAt
    : getLocalISOString(new Date(now.getTime() - (result.timeUsedSeconds || 0) * 1000));

  const payload = {
    user_id: userId,
    year: result.year,
    month: result.month,
    combination: result.combination.combinationNumber || result.combination.combination,
    started_at: calculatedStartedAt,
    completed_at: completedAt,
    duration_seconds: result.timeUsedSeconds,
    task1_answer: result.answers.task1 || '',
    task1_word_count: result.wordCounts.task1 || 0,
    task2_answer: result.answers.task2 || '',
    task2_word_count: result.wordCounts.task2 || 0,
    task3_answer: result.answers.task3 || '',
    task3_word_count: result.wordCounts.task3 || 0
  };

  const { data, error } = await supabase
    .from('submissions')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error inserting submission into Supabase:', error);
    return { data: null, error: new Error(error.message) };
  }

  return { data, error: null };
}

/**
 * Fetches past submissions for the logged in user from Supabase RLS
 */
export async function fetchSubmissionsFromSupabase(
  userId: string
): Promise<{ submissions: ExamResult[]; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { submissions: [], error: new Error('Supabase configuration missing.') };
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching submissions from Supabase:', error);
    return { submissions: [], error: new Error(error.message) };
  }

  const db = questionsData as any;

  const mappedSubmissions: ExamResult[] = (data || []).map((row: DBSubmission) => {
    // Reconstruct ExamCombination from questionsData if available, or build fallback
    const combosForMonth = (db[row.year] && db[row.year][row.month]) || [];
    const matchedCombo = combosForMonth.find(
      (c: ExamCombination) => (c.combinationNumber || c.combination) === row.combination
    );

    const fallbackCombo: ExamCombination = matchedCombo || {
      combination: row.combination,
      combinationNumber: row.combination,
      tasks: {
        task1: { instruction: "Instruction Tâche 1", minWords: 60, maxWords: 120 },
        task2: { instruction: "Instruction Tâche 2", minWords: 120, maxWords: 150 },
        task3: { instruction: "Instruction Tâche 3", minWords: 120, maxWords: 180 }
      }
    };

    const dateFormatted = new Date(row.completed_at || row.created_at || Date.now()).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      id: row.id,
      date: dateFormatted,
      combination: fallbackCombo,
      year: row.year,
      month: row.month,
      timeUsedSeconds: row.duration_seconds,
      answers: {
        task1: row.task1_answer,
        task2: row.task2_answer,
        task3: row.task3_answer
      },
      wordCounts: {
        task1: row.task1_word_count,
        task2: row.task2_word_count,
        task3: row.task3_word_count
      },
      aiEvaluation: (row as any).ai_feedback || undefined
    };
  });

  return { submissions: mappedSubmissions, error: null };
}

/**
 * Saves or updates AI evaluation feedback on an existing submission
 */
export async function updateSubmissionAiFeedback(
  submissionId: string,
  userId: string,
  aiFeedback: any
): Promise<{ error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: null };
  }

  const { error } = await supabase
    .from('submissions')
    .update({ ai_feedback: aiFeedback })
    .eq('id', submissionId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error) {
    console.error('Error updating AI feedback in Supabase:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Deletes a submission from Supabase by ID for the logged in user
 */
export async function deleteSubmissionFromSupabase(
  id: string,
  userId: string
): Promise<{ error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: null };
  }

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting submission from Supabase:', error);
    return { error: new Error(error.message) };
  }

  return { error: null };
}
