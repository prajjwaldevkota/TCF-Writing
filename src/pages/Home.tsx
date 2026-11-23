import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  MessageSquareText,
  BookOpen,
  Scale,
  RotateCcw,
  Shuffle,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import type { ExamResult, TaskKey } from "../types/exam";
import {
  type CombinationProgress,
  PracticeSession,
  QuestionEntry,
  TASK_INFO,
  TASK_KEYS,
} from "../utils/practice";
import { useWorkspace } from "../context/WorkspaceContext";
import { drawPracticeCombination } from "../utils/randomCombination";
import { loadQuestions } from "../utils/questionsLoader";
import { normalizeParagraphText } from "../utils/cleanText";
import { SessionList } from "../components/SessionList";
import { PracticeTracker } from "../components/PracticeTracker";
import { CombinationStatus } from "../components/CombinationStatus";

export const Home: React.FC<{
  progressBySet: Map<string, CombinationProgress>;
  name: string;
  submissions: ExamResult[];
  draft: PracticeSession | null;
  onResume: () => void;
  onPractice: (task: TaskKey | "exam") => void;
  onLibrary: () => void;
  onProgress: () => void;
  questions: QuestionEntry[];
  onStart: (entry: QuestionEntry, task: TaskKey | "exam") => void;
  onOpen: (s: ExamResult) => void;
}> = ({
  progressBySet,
  name,
  submissions,
  draft,
  onResume,
  onPractice,
  onLibrary,
  onProgress,
  questions,
  onStart,
  onOpen,
}) => {
  const { store } = useWorkspace();
  const { language } = useLanguage();
  const en = language === "en";
  const [selected, setSelected] = useState<QuestionEntry | null>(null);
  const progress = selected ? progressBySet.get(selected.id) : undefined;
  const draw = async () => {
    const pool = questions.length ? questions : await loadQuestions();
    setSelected(drawPracticeCombination(pool, progressBySet, store));
  };
  return (
    <div className="page-enter simple-home">
      <div className="page-heading">
        <div>
          {name && <p className="home-greeting">{en ? "Hello" : "Bonjour"}, {name.split(" ")[0]}</p>}
          <h1>{en ? "Writing practice" : "Atelier de rédaction"}</h1>
        </div>
      </div>
      {draft && (
        <div className="resume-banner">
          <span className="resume-icon">
            <RotateCcw size={20} />
          </span>
          <div>
            <strong>
              {en ? "Continue your saved draft" : "Reprendre votre brouillon"}
            </strong>
            <p>
              {draft.mode === "exam"
                ? en
                  ? "Full mock exam"
                  : "Examen blanc"
                : `Tâche ${TASK_INFO[draft.activeTask].number}`}{" "}
              · {draft.month} {draft.year}
            </p>
          </div>
          <button className="button primary" onClick={onResume}>
            {en ? "Continue" : "Reprendre"}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <section
        className="random-combination-bar"
        aria-label={en ? "Random combination" : "Combinaison au hasard"}
      >
        <button
          type="button"
          className="button secondary random-combination-button"
          onClick={draw}
        >
          <Shuffle size={18} />
          {selected ? (en ? "Draw another set" : "Tirer une autre série") : (en ? "Random combination" : "Combinaison au hasard")}
        </button>
        <div
          className="random-selection-status"
          role="status"
          aria-live="polite"
          data-combination-id={selected?.id || ""}
        >
          {selected ? (
            <>
              <strong>
                {en ? "Selected combination" : "Combinaison sélectionnée"}{" "}
                {selected.combination.combinationNumber} · {selected.month}{" "}
                {selected.year}
              </strong>
              <CombinationStatus progress={progress} en={en} />
              <span>
                {en
                  ? "All three tasks below belong to this set. Choose a task or start the full mock."
                  : "Les trois tâches ci-dessous viennent de cette série. Choisissez une tâche ou l’examen complet."}
              </span>
            </>
          ) : (
            <p>
              {en
                ? "Unstarted sets come first. Each draw includes all three tasks."
                : "Les séries jamais travaillées passent en premier. Chaque tirage réunit trois tâches."}
            </p>
          )}
        </div>
      </section>
      <div className="practice-choices">
        <section className="task-menu">
          <div className="section-head">
            <h2>{en ? "Guided tasks" : "Tâches guidées"}</h2>
            <button className="text-button" onClick={onLibrary}>
              {en ? "Browse topics" : "Parcourir les sujets"} <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="guided-task-list">
          {TASK_KEYS.map(key => {
            const info = TASK_INFO[key];
            const Icon = { task1: MessageSquareText, task2: BookOpen, task3: Scale }[key];
            return (
              <button key={key} className="practice-task-row" onClick={() => selected ? onStart(selected, key) : onPractice(key)}>
                <span className={`practice-task-icon ${info.color}`}><Icon size={21} /></span>
                <span className="task-row-copy">
                  <small>{en ? "Task" : "Tâche"} {info.number}</small>
                  <strong>{en ? info.en : info.fr}</strong>
                  <small className="task-duration">{info.minutes} min · {info.min}–{info.max} {en ? "words" : "mots"}</small>
                  {selected && <span className="task-preview">{normalizeParagraphText(selected.combination.tasks[key].instruction)}</span>}
                  {progress?.tasks.has(key) && <small className="task-repeat">{en ? "Practise again" : "Refaire la tâche"}</small>}
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            );
          })}
          </div>
        </section>
        <section className="mock-invitation">
          <h2>{en ? "Full mock exam" : "Examen blanc"}</h2>
          <div className="mock-duration"><Clock3 size={26} /><strong>60</strong> min</div>
          <p>{en ? "Write all three responses against one clock. You choose how to divide your time." : "Rédigez les trois réponses dans le temps imparti. Répartissez votre temps librement."}</p>
          <button className="button" onClick={() => selected ? onStart(selected, "exam") : onPractice("exam")}>
            {progress?.mockCompleted ? (en ? "Retake mock exam" : "Refaire l’examen") : (en ? "Start mock exam" : "Commencer l’examen")} <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <PracticeTracker submissions={submissions} onProgress={onProgress} />
      {!!submissions.length && (
        <section className="panel simple-recent">
          <div className="section-head">
            <h2>{en ? "Your recent writing" : "Vos dernières rédactions"}</h2>
            <button className="text-button" onClick={onProgress}>
              {en ? "View all writings" : "Voir toutes les rédactions"} ({submissions.length})
              <ArrowRight size={15} />
            </button>
          </div>
          <SessionList sessions={submissions.slice(0, 3)} onOpen={onOpen} />
        </section>
      )}
    </div>
  );
};
