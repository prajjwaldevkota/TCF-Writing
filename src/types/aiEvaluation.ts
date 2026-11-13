import type { NclcComparison } from '../utils/nclcComparison';
import type { PedagogicalAssessment } from '../services/pedagogicalAssessment';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface MistakeItem {
  category: 'Grammaire' | 'Orthographe / Accents' | 'Conjugaison / Temps' | 'Structure de phrase' | 'Vocabulaire' | string;
  original_text: string;
  corrected_text: string;
  explanation: string;
}

/**
 * Per-dimension score (0–5 scale) with supporting evidence.
 * Four dimensions roll up to an indicative /20 task score.
 */
export interface DimensionScore {
  dimension: 'task_fulfilment' | 'coherence_cohesion' | 'lexical_resource' | 'grammar_accuracy';
  score: number;       // 0–5
  weight: number;      // e.g. 0.30
  evidence: string;    // brief justification
}

export interface TaskEvaluation {
  task_key: 'task1' | 'task2' | 'task3';
  task_name: string;
  score: number | null; // e.g. out of 20
  estimated_level: CefrLevel | null;
  clb_level?: string; // e.g. 'CLB 7', 'CLB 8', 'CLB 9', 'CLB 10'
  general_feedback: string;
  general_feedback_en?: string;
  mistakes: MistakeItem[];
  c1_c2_model_answer: string;
  b2_model_answer?: string;
}

export interface AIEvaluation {
  nclc_crosscheck?: NclcComparison;
  pedagogical?: PedagogicalAssessment;
  model?: string;
  rubric_version?: string;
  id: string;
  created_at: string;
  evaluated_tasks: ('task1' | 'task2' | 'task3')[];
  estimated_cefr_level: CefrLevel | null;
  clb_level?: string; // e.g. 'CLB 7', 'CLB 8', 'CLB 9', 'CLB 10'
  overall_score: number | null; // e.g. average or single task score out of 20
  overall_feedback: string;
  overall_feedback_en?: string;
  tasks: {
    task1?: TaskEvaluation;
    task2?: TaskEvaluation;
    task3?: TaskEvaluation;
  };
}

export interface SavedMistake {
  id: string;
  category: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
  task_key?: 'task1' | 'task2' | 'task3';
  task_name?: string;
  submission_id?: string;
  exam_title?: string;
  date: string;
  timestamp: number;
}
