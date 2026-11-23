import { useEffect, useState } from "react";
import type { QuestionsDB, TaskKey } from "../types/exam";
import {
  detectTopicTheme,
  questionEntries,
  type QuestionEntry,
  type TopicThemeKey,
} from "./practice";

export interface TopicIndexMeta {
  theme: TopicThemeKey;
  hasSources: boolean;
  searchByTask: Record<TaskKey | "exam", string>;
}

let cachedEntries: QuestionEntry[] | null = null;
let pendingPromise: Promise<QuestionEntry[]> | null = null;
const metaCache = new WeakMap<QuestionEntry, TopicIndexMeta>();

function computeMeta(entry: QuestionEntry): TopicIndexMeta {
  const existing = metaCache.get(entry);
  if (existing) return existing;

  const t1 = `${entry.combination.tasks.task1.title || ""} ${entry.combination.tasks.task1.instruction}`.toLocaleLowerCase();
  const t2 = `${entry.combination.tasks.task2.title || ""} ${entry.combination.tasks.task2.instruction}`.toLocaleLowerCase();
  const t3 = `${entry.combination.tasks.task3.title || ""} ${entry.combination.tasks.task3.instruction}`.toLocaleLowerCase();
  const exam = `${t1} ${t2} ${t3}`;

  const meta: TopicIndexMeta = {
    theme: detectTopicTheme(exam),
    hasSources: Boolean(
      entry.combination.tasks.task3.document1?.trim() &&
        entry.combination.tasks.task3.document2?.trim(),
    ),
    searchByTask: {
      task1: t1,
      task2: t2,
      task3: t3,
      exam,
    },
  };
  metaCache.set(entry, meta);
  return meta;
}

export function getTopicMeta(entry: QuestionEntry): TopicIndexMeta {
  return computeMeta(entry);
}

export function getCachedQuestions(): QuestionEntry[] | null {
  return cachedEntries;
}

export function loadQuestions(): Promise<QuestionEntry[]> {
  if (cachedEntries) return Promise.resolve(cachedEntries);
  if (!pendingPromise) {
    pendingPromise = import("../data/questions.json")
      .then((mod) => {
        const entries = questionEntries((mod.default ?? mod) as QuestionsDB);
        cachedEntries = entries;
        return entries;
      })
      .catch((err) => {
        pendingPromise = null;
        throw err;
      });
  }
  return pendingPromise;
}

export function useQuestions(enabled = true): {
  questions: QuestionEntry[];
  loading: boolean;
} {
  const [questions, setQuestions] = useState<QuestionEntry[]>(
    () => cachedEntries || [],
  );
  const [loading, setLoading] = useState<boolean>(() => enabled && !cachedEntries);

  useEffect(() => {
    if (!enabled) return;
    if (cachedEntries) {
      setQuestions(cachedEntries);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadQuestions()
      .then((entries) => {
        if (active) {
          setQuestions(entries);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { questions, loading };
}
