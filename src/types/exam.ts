export interface TaskRequirement {
  instruction: string;
  title?: string;
  document1?: string;
  document2?: string;
  minWords: number;
  maxWords: number;
}

export interface ExamCombination {
  combination: number;
  combinationNumber: number;
  tasks: {
    task1: TaskRequirement;
    task2: TaskRequirement;
    task3: TaskRequirement;
  };
}

export type QuestionsDB = {
  [year: string]: {
    [month: string]: ExamCombination[];
  };
};

export type TaskKey = 'task1' | 'task2' | 'task3';

export interface ExamAnswers {
  task1: string;
  task2: string;
  task3: string;
}

import { AIEvaluation } from './aiEvaluation';

export interface ExamResult {
  id?: string;
  date?: string;
  combination: ExamCombination;
  year: string;
  month: string;
  timeUsedSeconds: number;
  answers: ExamAnswers;
  wordCounts: {
    task1: number;
    task2: number;
    task3: number;
  };
  isPracticeMode?: boolean;
  practiceTask?: TaskKey | string;
  practiceTasks?: TaskKey[];
  allocatedMinutes?: number;
  aiEvaluation?: AIEvaluation;
}

