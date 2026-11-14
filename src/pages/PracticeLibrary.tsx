import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import data from "../data/questions.json";
import type { ExamResult, QuestionsDB, TaskKey } from "../types/exam";
import { QuestionEntry, questionEntries, TASK_INFO } from "../utils/practice";
import { useLanguage } from "../context/LanguageContext";
import { normalizeParagraphText } from "../utils/cleanText";
export const allQuestions = questionEntries(data as QuestionsDB);
export const PracticeLibrary: React.FC<{
  onStart: (entry: QuestionEntry, task: TaskKey | "exam") => void;
  submissions: ExamResult[];
}> = ({ onStart, submissions }) => {
  const { language } = useLanguage();
  const en = language === "en";
  const [task, setTask] = useState<TaskKey | "exam">("task1");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("tcf_favorite_topics") || "[]",
      );
      return Array.isArray(value) && value.every((id) => typeof id === "string")
        ? value
        : [];
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState("");
  const filtered = useMemo(
    () =>
      allQuestions.filter(
        (entry) =>
          (year === "all" || entry.year === year) &&
          (!savedOnly || saved.includes(entry.id)) &&
          (!query.trim() ||
            (task === "exam"
              ? Object.values(entry.combination.tasks)
              : [entry.combination.tasks[task]]
            ).some((t) =>
              (t.instruction + " " + (t.title || ""))
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase()),
            )),
      ),
    [year, savedOnly, saved, query, task],
  );
  const update = (action: () => void) => {
    action();
    setPage(1);
  };
  const bookmark = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("tcf_favorite_topics", JSON.stringify(next));
    } catch {
      setNotice(
        en
          ? "Bookmark could not be saved. Browser storage is full."
          : "Favori non enregistré : stockage du navigateur indisponible.",
      );
    }
  };
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en
              ? "A PLACE TO PUT IDEAS INTO WORDS"
              : "DES IDÉES À METTRE EN MOTS"}
          </p>
          <h1>
            {en
              ? "What will you write today?"
              : "Qu’allez-vous écrire aujourd’hui ?"}
          </h1>
          <p>
            {en
              ? "Choose a topic. Practise one task, or put all three together."
              : "Choisissez un sujet. Travaillez une tâche, ou réunissez les trois."}
          </p>
        </div>
        <span className="outline-badge">
          {allQuestions.length} {en ? "topic sets" : "séries de sujets"}
        </span>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          {(["task1", "task2", "task3", "exam"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={task === k}
              onClick={() => update(() => setTask(k))}
            >
              {k === "exam" ? (
                <>
                  <Clock3 size={15} />
                  {en ? "Full mock" : "Examen blanc"}
                </>
              ) : (
                `Tâche ${TASK_INFO[k].number}`
              )}
            </button>
          ))}
        </div>
        <p className="muted text-small">
          {task === "exam"
            ? en
              ? "3 tasks · 60 minutes · No writing aids"
              : "3 tâches · 60 minutes · Sans aide à la rédaction"
            : en
              ? "Guided writing · Templates & checklist included"
              : "Rédaction guidée · Modèles et liste de vérification"}
        </p>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label={en ? "Search topics" : "Rechercher un sujet"}
            value={query}
            onChange={(e) => update(() => setQuery(e.target.value))}
            placeholder={
              en
                ? "Travel, work, the environment…"
                : "Voyage, travail, environnement…"
            }
          />
        </label>
        <label className="select-field">
          <SlidersHorizontal size={16} />
          <select
            aria-label={en ? "Filter by year" : "Filtrer par année"}
            value={year}
            onChange={(e) => update(() => setYear(e.target.value))}
          >
            <option value="all">
              {en ? "All years" : "Toutes les années"}
            </option>
            {[...new Set(allQuestions.map((q) => q.year))].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button
          className={`button secondary ${savedOnly ? "selected" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => update(() => setSavedOnly(!savedOnly))}
        >
          <Bookmark size={16} />
          {en ? "Saved" : "Favoris"}
        </button>
      </div>
      <div className="row between library-count">
        <span className="muted text-small">
          {filtered.length} {en ? "sets found" : "séries disponibles"}
        </span>
        <span className="muted text-small">
          {en
            ? "From your existing practice collection"
            : "Votre collection de sujets de pratique"}
        </span>
      </div>
      {notice && (
        <p className="notice warning" role="status">
          {notice}
        </p>
      )}
      {filtered.length ? (
        <>
          <div className="topic-grid">
            {filtered.slice((page - 1) * 12, page * 12).map((entry) => {
              const key = task === "exam" ? "task1" : task;
              const requirement = entry.combination.tasks[key];
              const completed = submissions.some(
                (s) =>
                  s.year === entry.year &&
                  s.month === entry.month &&
                  s.combination.combinationNumber ===
                    entry.combination.combinationNumber &&
                  (!s.isPracticeMode || s.practiceTasks?.includes(key)),
              );
              const hasSources = Boolean(
                entry.combination.tasks.task3.document1?.trim() &&
                entry.combination.tasks.task3.document2?.trim(),
              );
              const unavailable =
                (task === "task3" || task === "exam") && !hasSources;
              return (
                <article className="topic-card" key={entry.id}>
                  <div className="row between">
                    <span
                      className={`badge ${task === "exam" ? "sand" : TASK_INFO[key].color}`}
                    >
                      {task === "exam"
                        ? en
                          ? "Full mock"
                          : "Examen blanc"
                        : `Tâche ${TASK_INFO[key].number}`}
                    </span>
                    <button
                      className={`icon-button ${saved.includes(entry.id) ? "bookmarked" : ""}`}
                      aria-label={
                        saved.includes(entry.id)
                          ? en
                            ? "Remove bookmark"
                            : "Retirer des favoris"
                          : en
                            ? "Bookmark topic"
                            : "Ajouter aux favoris"
                      }
                      aria-pressed={saved.includes(entry.id)}
                      onClick={() => bookmark(entry.id)}
                    >
                      <Bookmark
                        size={18}
                        fill={
                          saved.includes(entry.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                  </div>
                  <span className="eyebrow topic-origin">
                    {entry.month} {entry.year} · {en ? "SET" : "SÉRIE"}{" "}
                    {entry.combination.combinationNumber}
                  </span>
                  <h3>
                    {normalizeParagraphText(
                      requirement.title || requirement.instruction,
                    ).slice(0, 120)}
                    {requirement.instruction.length > 120 && !requirement.title
                      ? "…"
                      : ""}
                  </h3>
                  <p>
                    {task === "exam"
                      ? en
                        ? "Write a message, recount an experience, then compare two viewpoints."
                        : "Rédigez un message, racontez une expérience, puis confrontez deux points de vue."
                      : en
                        ? TASK_INFO[key].en
                        : TASK_INFO[key].description}
                  </p>
                  {unavailable && (
                    <p className="text-small error-text">
                      {en
                        ? "Source documents missing for Task 3. Choose another set."
                        : "Documents de la tâche 3 manquants. Choisissez une autre série."}
                    </p>
                  )}
                  <div className="topic-meta">
                    <span>
                      <Clock3 size={13} />
                      {task === "exam" ? 60 : TASK_INFO[key].minutes} min
                    </span>
                    <span>
                      {task === "exam"
                        ? "3 tâches"
                        : `${requirement.minWords}–${requirement.maxWords} ${en ? "words" : "mots"}`}
                    </span>
                    {completed && (
                      <span className="completed-label">
                        <Check size={13} />
                        {en ? "Practised" : "Travaillé"}
                      </span>
                    )}
                  </div>
                  <button
                    className="topic-start"
                    disabled={unavailable}
                    onClick={() => onStart(entry, task)}
                  >
                    {en ? "Start writing" : "Commencer à écrire"}
                    <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {en ? "Previous" : "Précédent"}
            </button>
            <span>
              {page} / {Math.ceil(filtered.length / 12)}
            </span>
            <button
              className="button secondary"
              disabled={page >= Math.ceil(filtered.length / 12)}
              onClick={() => setPage(page + 1)}
            >
              {en ? "Next" : "Suivant"}
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state panel">
          <Search size={30} />
          <h2>{en ? "No matching topics" : "Aucun sujet correspondant"}</h2>
          <p>
            {en
              ? "Try a broader search or clear your filters."
              : "Essayez une recherche plus large ou réinitialisez les filtres."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setYear("all");
              setSavedOnly(false);
              setPage(1);
            }}
          >
            {en ? "Clear filters" : "Réinitialiser les filtres"}
          </button>
        </div>
      )}
    </div>
  );
};
