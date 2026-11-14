import React from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  Feather,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import type { ExamResult, TaskKey } from "../types/exam";
import {
  PracticeSession,
  practiceSummary,
  TASK_INFO,
  TASK_KEYS,
} from "../utils/practice";
import { SessionList } from "../components/SessionList";
export const Home: React.FC<{
  name: string;
  submissions: ExamResult[];
  draft: PracticeSession | null;
  onResume: () => void;
  onPractice: (task: TaskKey | "exam") => void;
  onLibrary: () => void;
  onTemplates: () => void;
  onOpen: (s: ExamResult) => void;
  onNotebook: () => void;
}> = ({
  name,
  submissions,
  draft,
  onResume,
  onPractice,
  onLibrary,
  onTemplates,
  onOpen,
  onNotebook,
}) => {
  const { language } = useLanguage();
  const en = language === "en";
  const summary = practiceSummary(submissions);
  const latest = submissions.find((s) => s.aiEvaluation?.pedagogical);
  const focus =
    latest?.aiEvaluation?.pedagogical?.tasks[summary.nextTask]?.priorities[0] ||
    Object.values(latest?.aiEvaluation?.pedagogical?.tasks || {}).flatMap(
      (t) => t?.priorities || [],
    )[0];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat(en ? "en-CA" : "fr-CA", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
          <h1>
            {name
              ? en
                ? "Welcome back,"
                : "Bonjour,"
              : en
                ? "A good day to write"
                : "Une belle journée pour écrire"}
            {name ? " " + name.split(" ")[0] : ""}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {en
              ? "Let’s make your next piece of writing a little better."
              : "Et si votre prochain texte était un peu meilleur que le précédent ?"}
          </p>
        </div>
        <span className="outline-badge">
          <Target size={15} /> Objectif NCLC 7
        </span>
      </div>
      {draft && (
        <div className="resume-banner">
          <span className="resume-icon">
            <RotateCcw size={20} />
          </span>
          <div>
            <strong>
              {en
                ? "Your words are waiting for you."
                : "Votre brouillon vous attend."}
            </strong>
            <p>
              {draft.mode === "exam"
                ? en
                  ? "Full mock exam"
                  : "Examen blanc"
                : `Tâche ${TASK_INFO[draft.activeTask].number}`}{" "}
              · {draft.month} {draft.year} ·{" "}
              {en ? "Saved in this browser" : "Sauvegardé dans ce navigateur"}
            </p>
          </div>
          <button className="button primary" onClick={onResume}>
            {en ? "Resume" : "Reprendre"}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="home-top-grid">
        <section className="today-card">
          <div className="row between">
            <span className="pill-light">
              <Sparkles size={13} />
              {en ? "YOUR NEXT SESSION" : "VOTRE PROCHAINE SÉANCE"}
            </span>
            <span className="today-card-number">
              0{TASK_INFO[summary.nextTask].number}
            </span>
          </div>
          <h2>
            {en ? "One session." : "Une séance."}
            <br />
            <em>{en ? "Real progress." : "Un vrai progrès."}</em>
          </h2>
          <p>
            {en
              ? `Focus on Task ${TASK_INFO[summary.nextTask].number}. Plan your ideas, write your response, then use feedback to revise it.`
              : `Aujourd’hui, concentrez-vous sur la tâche ${TASK_INFO[summary.nextTask].number}. Préparez vos idées, rédigez, puis améliorez votre texte avec le bilan.`}
          </p>
          <div className="today-action">
            <button
              className="button cream"
              onClick={() => onPractice(summary.nextTask)}
            >
              {en ? "Start my practice" : "Commencer ma séance"}
              <ArrowRight size={17} />
            </button>
            <span>
              <Clock3 size={14} /> ~{TASK_INFO[summary.nextTask].minutes} min
            </span>
          </div>
          <div className="today-deco" aria-hidden="true">
            é
          </div>
        </section>
        <section className="week-card panel">
          <div className="section-head">
            <h2>{en ? "A little, often." : "Un peu, souvent."}</h2>
            <span className="badge sand">
              {en ? "THIS WEEK" : "CETTE SEMAINE"}
            </span>
          </div>
          <p>
            {en
              ? "Aim for 3 writing sessions in 7 days. A suggested routine, at your pace."
              : "Visez 3 séances sur 7 jours. Un rythme conseillé, à votre mesure."}
          </p>
          <div className="week-number">
            <strong>{summary.weekCount}</strong>
            <span>/ 3 {en ? "sessions" : "séances"}</span>
            <Feather size={28} />
          </div>
          <div className="week-days">
            {summary.days.map((day) => (
              <div key={day.date.toDateString()}>
                <span
                  className={
                    day.count
                      ? "done"
                      : day.date.toDateString() === new Date().toDateString()
                        ? "today"
                        : ""
                  }
                >
                  {day.count ? <Check size={17} /> : day.date.getDate()}
                </span>
                <small>
                  {new Intl.DateTimeFormat(en ? "en" : "fr", {
                    weekday: "narrow",
                  }).format(day.date)}
                </small>
              </div>
            ))}
          </div>
          <div className="week-foot">
            <span className="tiny-dot" />
            {summary.weekCount >= 3
              ? en
                ? "Your weekly routine is complete. Keep going at your pace."
                : "Votre routine de la semaine est complète. Continuez à votre rythme."
              : en
                ? "Every finished response counts."
                : "Chaque rédaction terminée compte."}
          </div>
        </section>
      </div>
      <div className="section-head section-spaced">
        <div>
          <p className="eyebrow">
            {en ? "BUILD THE FOUNDATIONS" : "TRAVAILLER LES ESSENTIELS"}
          </p>
          <h2>
            {en
              ? "Three tasks. One clear goal."
              : "Trois tâches. Un cap clair."}
          </h2>
        </div>
        <button className="text-button" onClick={onLibrary}>
          {en ? "Browse all topics" : "Tous les sujets"}
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="task-card-grid">
        {TASK_KEYS.map((key) => {
          const info = TASK_INFO[key];
          return (
            <button
              className="task-card"
              key={key}
              onClick={() => onPractice(key)}
            >
              <div className="row between">
                <span className={`task-token ${info.color}`}>
                  0{info.number}
                </span>
                <ArrowUpRight size={19} />
              </div>
              <span className="eyebrow">TÂCHE {info.number}</span>
              <h3>{en ? info.en : info.fr}</h3>
              <p>
                {en
                  ? [
                      "A clear purpose, the right tone, specific details.",
                      "A structured story, concrete details, your view.",
                      "Two sources, a comparison, your own position.",
                    ][info.number - 1]
                  : info.description}
              </p>
              <div className="task-card-foot">
                <span>
                  {info.min}–{info.max} {en ? "words" : "mots"}
                </span>
                <span>
                  {info.minutes} min <ArrowRight size={13} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="home-bottom-grid">
        <section className="panel">
          <div className="section-head">
            <h2>{en ? "Your recent writing" : "Vos dernières rédactions"}</h2>
            <span className="muted text-small">
              {submissions.length} {en ? "saved" : "enregistrées"}
            </span>
          </div>
          {submissions.length ? (
            <SessionList sessions={submissions.slice(0, 3)} onOpen={onOpen} />
          ) : (
            <div className="empty-inline">
              <Feather size={29} />
              <h3>
                {en
                  ? "Your first page starts here."
                  : "Tout commence par une première page."}
              </h3>
              <p>
                {en
                  ? "Finish a practice and find your writing and feedback here."
                  : "Terminez une séance pour retrouver ici vos textes et leurs bilans."}
              </p>
              <button
                className="text-button"
                onClick={() => onPractice("task1")}
              >
                {en ? "Write my first response" : "Écrire mon premier texte"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <div className="home-side-stack">
          <button
            className="resource-card"
            onClick={focus ? onNotebook : onTemplates}
          >
            <span className="resource-icon">
              <BookOpen size={20} />
            </span>
            <span className="eyebrow">
              {focus
                ? en
                  ? "YOUR NEXT IMPROVEMENT"
                  : "VOTRE PISTE DE PROGRÈS"
                : en
                  ? "NEVER START FROM ZERO"
                  : "NE PARTEZ PAS DE ZÉRO"}
            </span>
            <h3>
              {focus ||
                (en
                  ? "A structure for every task."
                  : "Une structure pour chaque tâche.")}
            </h3>
            <p>
              {focus
                ? en
                  ? "Revisit your corrections and put this priority into practice."
                  : "Retrouvez vos corrections et mettez cette priorité en pratique."
                : en
                  ? "Your TCFFormation templates, always within reach."
                  : "Vos modèles TCFFormation, toujours à portée de main."}
            </p>
            <span className="text-button">
              {focus
                ? en
                  ? "Open corrections"
                  : "Ouvrir mes corrections"
                : en
                  ? "Explore the templates"
                  : "Explorer les modèles"}
              <ArrowUpRight size={15} />
            </span>
          </button>
          <button className="mock-link" onClick={() => onPractice("exam")}>
            <Clock3 size={20} />
            <span>
              <strong>
                {en ? "Ready for a full mock?" : "Prêt pour un examen blanc ?"}
              </strong>
              <small>
                {en
                  ? "3 tasks · 60 minutes · Exam conditions"
                  : "3 tâches · 60 minutes · Conditions d’examen"}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
