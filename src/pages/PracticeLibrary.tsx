import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Check,
  Clock3,
  Compass,
  Cpu,
  GraduationCap,
  Layers,
  Leaf,
  type LucideIcon,
  Search,
  SlidersHorizontal,
  Shuffle,
  Users,
} from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import { QuestionEntry, TASK_INFO, TASK_KEYS, TOPIC_THEMES, type TopicTheme, type TopicThemeKey } from "../utils/practice";
import { getTopicMeta, useQuestions } from "../utils/questionsLoader";
import { useLanguage } from "../context/LanguageContext";
import { selectRandomCombination } from "../utils/randomCombination";
import { normalizeParagraphText } from "../utils/cleanText";

const THEME_ICONS: Record<TopicThemeKey, LucideIcon> = {
  all: Layers,
  work: Briefcase,
  ecology: Leaf,
  education: GraduationCap,
  tech: Cpu,
  society: Users,
  culture: Compass,
};
const THEME_MAP = Object.fromEntries(
  TOPIC_THEMES.map((t) => [t.key, t]),
) as Record<TopicThemeKey, TopicTheme>;

export const PracticeLibrary: React.FC<{
  onStart: (entry: QuestionEntry, task: TaskKey | "exam") => void;
  submissions: ExamResult[];
}> = ({ onStart, submissions }) => {
  const { language } = useLanguage();
  const en = language === "en";
  const { questions: allQuestions, loading } = useQuestions();
  const [task, setTask] = useState<TaskKey | "exam">("task1");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [selectedTheme, setSelectedTheme] = useState<TopicThemeKey>("all");
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
  const [randomSelection, setRandomSelection] = useState<QuestionEntry | null>(
    null,
  );
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const years = useMemo(
    () => [...new Set(allQuestions.map((q) => q.year))],
    [allQuestions],
  );
  const completedSet = useMemo(() => {
    const keys = new Set<string>();
    for (const s of submissions) {
      const base = `${s.year}-${s.month}-${s.combination.combinationNumber}`;
      if (!s.isPracticeMode) {
        for (const k of TASK_KEYS) keys.add(`${base}:${k}`);
      } else if (s.practiceTasks) {
        for (const k of s.practiceTasks) keys.add(`${base}:${k}`);
      }
    }
    return keys;
  }, [submissions]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return allQuestions.filter((entry) => {
      if (year !== "all" && entry.year !== year) return false;
      if (savedOnly && !savedSet.has(entry.id)) return false;
      const meta = getTopicMeta(entry);
      if (selectedTheme !== "all" && meta.theme !== selectedTheme) return false;
      if (normalizedQuery && !meta.searchByTask[task].includes(normalizedQuery))
        return false;
      return true;
    });
  }, [allQuestions, year, savedOnly, savedSet, query, task, selectedTheme]);
  const displayed = randomSelection ? [randomSelection] : filtered;
  const drawRandom = () => {
    const entry = selectRandomCombination(filtered, randomSelection?.id);
    setRandomSelection(entry);
    setPage(1);
    setNotice(
      entry
        ? ""
        : en
          ? "No complete combination matches these filters."
          : "Aucune combinaison complète ne correspond à ces filtres.",
    );
  };
  const update = (action: () => void) => {
    setRandomSelection(null);
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
              onClick={() => {
                setTask(k);
                setPage(1);
              }}
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
        <button
          type="button"
          className="button secondary random-combination-button"
          onClick={drawRandom}
        >
          <Shuffle size={17} />
          {en ? "Random combination" : "Combinaison au hasard"}
        </button>
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
            {years.map((y) => (
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
      <div className="theme-filter-bar" role="group" aria-label={en ? "Filter by theme" : "Filtrer par thème"}>
        {TOPIC_THEMES.map((themeItem) => {
          const ThemeIcon = THEME_ICONS[themeItem.key];
          return (
            <button
              key={themeItem.key}
              type="button"
              className={`theme-pill ${selectedTheme === themeItem.key ? "active" : ""}`}
              aria-pressed={selectedTheme === themeItem.key}
              onClick={() => update(() => setSelectedTheme(themeItem.key))}
            >
              <ThemeIcon size={14} />
              <span>{en ? themeItem.en : themeItem.fr}</span>
            </button>
          );
        })}
      </div>
      <div className="row between library-count">
        <span className="muted text-small">
          {displayed.length} {en ? "sets found" : "séries disponibles"}
        </span>
        <span className="muted text-small">
          {en
            ? "From your existing practice collection"
            : "Votre collection de sujets de pratique"}
        </span>
      </div>
      {randomSelection && (
        <div
          className="library-random-selection"
          role="status"
          data-combination-id={randomSelection.id}
        >
          <span>
            {en ? "One combination selected" : "Une combinaison sélectionnée"} ·{" "}
            {randomSelection.month} {randomSelection.year} ·{" "}
            {en ? "Set" : "Série"}{" "}
            {randomSelection.combination.combinationNumber}
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => setRandomSelection(null)}
          >
            {en ? "Show all topics" : "Afficher tous les sujets"}
          </button>
        </div>
      )}
      {notice && (
        <p className="notice warning" role="status">
          {notice}
        </p>
      )}
      {loading && !displayed.length ? (
        <div className="empty-state panel" role="status" aria-live="polite">
          <p>{en ? "Loading topic collection…" : "Chargement de la collection de sujets…"}</p>
        </div>
      ) : displayed.length ? (
        <>
          <div className="topic-grid">
            {displayed.slice((page - 1) * 12, page * 12).map((entry) => {
              const key = task === "exam" ? "task1" : task;
              const requirement = entry.combination.tasks[key];
              const meta = getTopicMeta(entry);
              const completed = completedSet.has(`${entry.id}:${key}`);
              const unavailable =
                (task === "task3" || task === "exam") && !meta.hasSources;
              const themeMeta = THEME_MAP[meta.theme];
              const isBookmarked = savedSet.has(entry.id);
              return (
                <article className="topic-card" key={entry.id}>
                  <div className="row between">
                    <div className="row gap-2 items-center">
                      <span
                        className={`badge ${task === "exam" ? "sand" : TASK_INFO[key].color}`}
                      >
                        {task === "exam"
                          ? en
                            ? "Full mock"
                            : "Examen blanc"
                          : `Tâche ${TASK_INFO[key].number}`}
                      </span>
                      {themeMeta && themeMeta.key !== "all" && (() => {
                        const BadgeIcon = THEME_ICONS[themeMeta.key];
                        return (
                          <span className="topic-theme-badge">
                            <BadgeIcon size={12} />
                            <span>{en ? themeMeta.en : themeMeta.fr}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      className={`icon-button ${isBookmarked ? "bookmarked" : ""}`}
                      aria-label={
                        isBookmarked
                          ? en
                            ? "Remove bookmark"
                            : "Retirer des favoris"
                          : en
                            ? "Bookmark topic"
                            : "Ajouter aux favoris"
                      }
                      aria-pressed={isBookmarked}
                      onClick={() => bookmark(entry.id)}
                    >
                      <Bookmark
                        size={18}
                        fill={isBookmarked ? "currentColor" : "none"}
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
              {page} / {Math.ceil(displayed.length / 12)}
            </span>
            <button
              className="button secondary"
              disabled={page >= Math.ceil(displayed.length / 12)}
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
              setSelectedTheme("all");
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
