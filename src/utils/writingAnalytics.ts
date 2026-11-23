import type { ExamResult, TaskKey } from "../types/exam";
import { CANONICAL_CATEGORIES, normalizeCategory } from "./mistakesStorage";
import { resultTimestamp, TASK_KEYS } from "./practice";
import { countFrenchWords } from "./wordCount";

export function writingAnalytics(submissions: ExamResult[], filter: TaskKey | "all") {
  const tasks = submissions.flatMap(result =>
    TASK_KEYS.flatMap(key => {
      if (filter !== "all" && filter !== key) return [];
      const answer = result.answers[key];
      const words = countFrenchWords(answer || "");
      const feedback = result.aiEvaluation?.pedagogical?.tasks[key];
      if (!words || !feedback) return [];
      return [{ result, key, words, feedback, date: resultTimestamp(result) }];
    }),
  ).sort((a, b) => b.date - a.date);

  // Split by submission so all three tasks from a mock stay in the same period.
  const comparable = tasks.filter(t => t.date > 0 && !t.feedback.corrections_incomplete && Array.isArray(t.feedback.mistakes));
  const sessions = [...new Set(comparable.map(t => t.result))];
  const size = Math.min(5, Math.ceil(sessions.length / 2));
  function windowStats(group: ExamResult[]) {
    const samples = comparable.filter(t => group.includes(t.result));
    const words = samples.reduce((sum, t) => sum + t.words, 0);
    const corrections = samples.flatMap(t => t.feedback.mistakes.map(m => ({
      ...m, category: normalizeCategory(m.category), key: t.key, result: t.result,
    })));
    return { sessions: group.length, words, corrections, samples };
  }
  const recent = windowStats(sessions.slice(0, size));
  const previous = windowStats(sessions.slice(size, size * 2));
  const domains = CANONICAL_CATEGORIES.map(category => {
    const examples = recent.corrections.filter(m => m.category === category);
    const earlier = previous.corrections.filter(m => m.category === category).length;
    return {
      category, examples, earlier,
      recentRate: recent.words ? examples.length * 100 / recent.words : null,
      previousRate: previous.words ? earlier * 100 / previous.words : null,
    };
  }).sort((a, b) => b.examples.length - a.examples.length || b.earlier - a.earlier);
  const byId = new Map(submissions.filter(s => s.id).map(s => [s.id, s]));
  const latestRewrite = tasks.find(t => t.result.revisionOf && t.feedback.range &&
    byId.get(t.result.revisionOf)?.aiEvaluation?.pedagogical?.tasks[t.key]?.range);
  const original = latestRewrite?.result.revisionOf ? byId.get(latestRewrite.result.revisionOf) : undefined;
  return { recent, previous, domains, tasks, latestRewrite, original };
}
