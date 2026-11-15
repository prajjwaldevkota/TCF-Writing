import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  RotateCcw,
  Shuffle,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import type { ExamResult, TaskKey } from "../types/exam";
import {
  PracticeSession,
  QuestionEntry,
  TASK_INFO,
  TASK_KEYS,
} from "../utils/practice";
import { selectRandomCombination } from "../utils/randomCombination";
import { normalizeParagraphText } from "../utils/cleanText";
import { SessionList } from "../components/SessionList";
import { PracticeTracker } from "../components/PracticeTracker";
export const Home: React.FC<{
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
  const { language } = useLanguage();
  const en = language === "en";
  const [selected, setSelected] = useState<QuestionEntry | null>(null);
  const draw = () =>
    setSelected(selectRandomCombination(questions, selected?.id));
  return (
    <div className="page-enter simple-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {name
              ? `${en ? "Hello" : "Bonjour"}, ${name.split(" ")[0]}`
              : "Expression écrite · TCF Canada"}
          </p>
          <h1>
            {en
              ? "What would you like to practise?"
              : "Qu’allez-vous pratiquer ?"}
          </h1>
          <p>
            {en
              ? "Choose a task, write your response, then use feedback to improve it."
              : "Choisissez une tâche, rédigez votre réponse, puis améliorez-la avec le bilan."}
          </p>
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
          {en ? "Random combination" : "Combinaison au hasard"}
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
              <span>
                {en
                  ? "All three tasks below belong to this set. Choose a task or start the full mock."
                  : "Les trois tâches ci-dessous viennent de cette série. Choisissez une tâche ou l’examen complet."}
              </span>
            </>
          ) : (
            <p>
              {en
                ? "Draw one complete set of three tasks. You choose when to begin."
                : "Tirez une seule série de trois tâches. Vous choisissez quand commencer."}
            </p>
          )}
        </div>
      </section>
      <div className="section-head simple-practice-heading">
        <h2>{en ? "One task at a time" : "Une tâche à la fois"}</h2>
        <button className="text-button" onClick={onLibrary}>
          {en ? "Choose a specific topic" : "Choisir un sujet précis"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="simple-task-grid">
        {TASK_KEYS.map((key) => {
          const info = TASK_INFO[key];
          return (
            <button
              key={key}
              className="simple-task-card"
              onClick={() =>
                selected ? onStart(selected, key) : onPractice(key)
              }
            >
              <span className={`task-token ${info.color}`}>{info.number}</span>
              <span className="eyebrow">
                {en ? "Task" : "Tâche"} {info.number}
              </span>
              <h3>{en ? info.en : info.fr}</h3>
              <p>
                {selected
                  ? normalizeParagraphText(
                      selected.combination.tasks[key].instruction,
                    ).slice(0, 180) +
                    (selected.combination.tasks[key].instruction.length > 180
                      ? "…"
                      : "")
                  : en
                    ? [
                        "A message with clear details and the right tone.",
                        "An experience, concrete details and your opinion.",
                        "Two documents, a comparison and your position.",
                      ][info.number - 1]
                    : info.description}
              </p>
              <div className="simple-task-meta">
                <span>
                  {info.min}–{info.max} {en ? "words" : "mots"}
                </span>
                <span>~{info.minutes} min</span>
              </div>
              <span className="simple-task-action">
                {en ? "Start writing" : "Commencer à écrire"}
                <ArrowRight size={17} />
              </span>
            </button>
          );
        })}
      </div>
      <button
        className="simple-mock-card"
        onClick={() =>
          selected ? onStart(selected, "exam") : onPractice("exam")
        }
      >
        <span className="simple-mock-icon">
          <Clock3 size={24} />
        </span>
        <span>
          <strong>
            {en ? "Practise the full exam" : "S’entraîner à l’examen complet"}
          </strong>
          <small>
            {en
              ? "3 tasks · 60 minutes · A supported NCLC estimate after review"
              : "3 tâches · 60 minutes · Estimation NCLC si le bilan le permet"}
          </small>
        </span>
        <span className="simple-mock-action">
          {en ? "Start mock exam" : "Commencer l’examen"}
          <ArrowRight size={17} />
        </span>
      </button>
      <PracticeTracker submissions={submissions} onProgress={onProgress} />
      {!!submissions.length && (
        <section className="panel simple-recent">
          <div className="section-head">
            <h2>{en ? "Your recent writing" : "Vos dernières rédactions"}</h2>
            <span className="muted text-small">
              {en
                ? "Open to review or rewrite"
                : "Ouvrir pour corriger ou réécrire"}
            </span>
          </div>
          <SessionList sessions={submissions.slice(0, 3)} onOpen={onOpen} />
        </section>
      )}
    </div>
  );
};
