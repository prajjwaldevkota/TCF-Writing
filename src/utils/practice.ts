import type {
  ExamAnswers,
  ExamCombination,
  ExamResult,
  QuestionsDB,
  TaskKey,
} from "../types/exam";

export const TASK_KEYS: TaskKey[] = ["task1", "task2", "task3"];
export const TASK_INFO = {
  task1: {
    number: 1,
    fr: "Écrire un message",
    en: "Write a message",
    minutes: 15,
    min: 60,
    max: 120,
    color: "sage",
    description: "Un destinataire, un objectif, des détails précis.",
  },
  task2: {
    number: 2,
    fr: "Raconter une expérience",
    en: "Share an experience",
    minutes: 20,
    min: 120,
    max: 150,
    color: "sand",
    description: "Un récit structuré, des détails, votre point de vue.",
  },
  task3: {
    number: 3,
    fr: "Comparer et argumenter",
    en: "Compare and argue",
    minutes: 25,
    min: 120,
    max: 180,
    color: "lavender",
    description: "Deux documents, une comparaison, votre position.",
  },
} as const;
export interface QuestionEntry {
  id: string;
  year: string;
  month: string;
  combination: ExamCombination;
}
const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];
export function questionEntries(data: QuestionsDB): QuestionEntry[] {
  return Object.entries(data)
    .flatMap(([year, months]) =>
      Object.entries(months).flatMap(([month, combinations]) =>
        combinations.map((combination) => ({
          id: `${year}-${month}-${combination.combinationNumber}`,
          year,
          month,
          combination,
        })),
      ),
    )
    .sort(
      (a, b) =>
        Number(b.year) - Number(a.year) ||
        MONTHS.indexOf(
          b.month
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ) -
          MONTHS.indexOf(
            a.month
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ) ||
        a.combination.combinationNumber - b.combination.combinationNumber,
    );
}
export interface PracticeSession extends QuestionEntry {
  sessionId: string;
  mode: "guided" | "exam";
  keys: TaskKey[];
  activeTask: TaskKey;
  answers: ExamAnswers;
  elapsedSeconds: number;
  runningSince: number | null;
  savedAt: string;
  revisionOf?: string;
  previousAnswer?: string;
  priorities?: string[];
}
export const DRAFT_KEY = "tcf_practice_session_v2";
export const emptyAnswers = (): ExamAnswers => ({
  task1: "",
  task2: "",
  task3: "",
});
export function isPracticeSession(session: any): session is PracticeSession {
  return (
    !!session?.sessionId &&
    !!session.combination?.tasks &&
    Array.isArray(session.keys) &&
    session.keys.length > 0 &&
    session.keys.every((k: TaskKey) => TASK_KEYS.includes(k)) &&
    session.keys.includes(session.activeTask) &&
    TASK_KEYS.every(
      (k) =>
        typeof session.answers?.[k] === "string" &&
        typeof session.combination.tasks[k]?.instruction === "string" &&
        Number.isFinite(session.combination.tasks[k]?.minWords) &&
        Number.isFinite(session.combination.tasks[k]?.maxWords),
    ) &&
    ["guided", "exam"].includes(session.mode) &&
    Number.isFinite(session.elapsedSeconds) &&
    session.elapsedSeconds >= 0 &&
    (session.runningSince === null || Number.isFinite(session.runningSince)) &&
    typeof session.year === "string" &&
    typeof session.month === "string"
  );
}
export function loadPracticeSession(): PracticeSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return isPracticeSession(session) ? session : null;
  } catch {
    return null;
  }
}
export function savePracticeSession(session: PracticeSession): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
export function sessionElapsed(
  session: PracticeSession,
  now = Date.now(),
): number {
  return Math.max(
    0,
    session.elapsedSeconds +
      (session.runningSince
        ? Math.floor((now - session.runningSince) / 1000)
        : 0),
  );
}
export function makeSession(
  entry: QuestionEntry,
  task: TaskKey | "exam",
  revision?: ExamResult,
): PracticeSession {
  const key = task === "exam" ? "task1" : task;
  return {
    ...entry,
    sessionId: crypto.randomUUID(),
    mode: task === "exam" ? "exam" : "guided",
    keys: task === "exam" ? [...TASK_KEYS] : [task],
    activeTask: key,
    answers: revision
      ? { ...emptyAnswers(), [key]: revision.answers[key] }
      : emptyAnswers(),
    elapsedSeconds: 0,
    runningSince: task === "exam" ? Date.now() : null,
    savedAt: new Date().toISOString(),
    revisionOf: revision?.id,
    previousAnswer: revision?.answers[key],
    priorities:
      revision?.aiEvaluation?.pedagogical?.tasks[key]?.priorities || [],
  };
}
export function resultTimestamp(result: ExamResult): number {
  if (result.createdAt) return Date.parse(result.createdAt) || 0;
  const date = result.date?.match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:.*?(\d{2}):(\d{2}))?/,
  );
  if (date)
    return new Date(
      +date[3],
      +date[2] - 1,
      +date[1],
      +(date[4] || 0),
      +(date[5] || 0),
    ).getTime();
  return Date.parse(result.aiEvaluation?.created_at || result.date || "") || 0;
}
export function practicedKeys(result: ExamResult): TaskKey[] {
  if (result.isPracticeMode)
    return result.practiceTasks?.length
      ? result.practiceTasks
      : TASK_KEYS.filter((k) => result.answers[k]?.trim());
  return TASK_KEYS.filter((k) => result.answers[k]?.trim());
}
export function practiceSummary(submissions: ExamResult[], now = new Date()) {
  const counts = Object.fromEntries(
    TASK_KEYS.map((k) => [
      k,
      submissions.filter((s) => practicedKeys(s).includes(k)).length,
    ]),
  ) as Record<TaskKey, number>;
  const nextTask = [...TASK_KEYS].sort((a, b) => counts[a] - counts[b])[0];
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - 6 + i);
    return {
      date: day,
      count: submissions.filter(
        (s) =>
          new Date(resultTimestamp(s)).toDateString() === day.toDateString(),
      ).length,
    };
  });
  const latestProjection = [...submissions]
    .sort((a, b) => resultTimestamp(b) - resultTimestamp(a))
    .find((s) => s.aiEvaluation?.pedagogical?.mock_projection);
  return {
    counts,
    nextTask,
    days,
    weekCount: days.reduce((n, d) => n + d.count, 0),
    latestProjection,
  };
}
export function formatSessionDate(
  result: ExamResult,
  language: string,
): string {
  const timestamp = resultTimestamp(result);
  return timestamp
    ? new Intl.DateTimeFormat(language === "en" ? "en-CA" : "fr-CA", {
        month: "short",
        day: "numeric",
      }).format(timestamp)
    : result.date || "—";
}
