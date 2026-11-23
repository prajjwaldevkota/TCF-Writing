import { useWorkspace } from "../context/WorkspaceContext";
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  CheckCircle2,
  Eye,
  Info,
  NotebookPen,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

import { type CleanupDays } from "../utils/mistakeLifecycle";
export function Notebook({ onPractice }: { onPractice: () => void }) {
  const { getReviewedMistakeIds, markMistakeReviewed, getMistakeLifecycle, setMistakeCleanupDays, getCleanupCandidates, postponeMistakeCleanup, initializeReviewedMistakeDates, getStoredMistakes, deleteStoredMistakes } = useWorkspace();
  const { language } = useLanguage();
  const en = language === "en";
  const [mistakes, setMistakes] = useState(() => getStoredMistakes());
  const [category, setCategory] = useState("all");
  const [reviewed, setReviewed] = useState<string[]>(() => {
    try {
      return getReviewedMistakeIds();
    } catch {
      return [];
    }
  });
  const [onlyPending, setOnlyPending] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizSuccess, setQuizSuccess] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [notice, setNotice] = useState("");
  const [cleanupDays, setCleanupDays] = useState<CleanupDays>(() => {
    try { initializeReviewedMistakeDates(); return getMistakeLifecycle().askAfterDays; } catch { return 30; }
  });
  const [cleanupIds, setCleanupIds] = useState<string[]>([]);
  useEffect(() => {
    const check = () => {
      try { setCleanupIds(getCleanupCandidates(mistakes).map(m => m.id)); }
      catch { setNotice(en ? "Cleanup reminders could not be read." : "Impossible de lire les rappels de nettoyage."); }
    };
    check();
    const timer = window.setInterval(check, 60 * 60_000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [mistakes, reviewed, cleanupDays, en]);
  const entries = mistakes.filter(
    (m) =>
      (category === "all" || m.category === category) &&
      (!onlyPending || !reviewed.includes(m.id)),
  );
  const current = entries[Math.min(index, Math.max(0, entries.length - 1))];
  const categories = [...new Set(mistakes.map((m) => m.category))];
  const mastered = mistakes.filter((m) => reviewed.includes(m.id)).length;
  const move = (offset: number) => {
    setIndex(Math.max(0, Math.min(entries.length - 1, index + offset)));
    setRevealed(false);
    setQuizChecked(false);
    setQuizSuccess(false);
    setAttempt("");
  };
  const checkAnswer = () => {
    if (!current) return;
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[«»""''`]/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.,!?;:]/g, "");
    const match = norm(attempt) === norm(current.corrected_text);
    setQuizSuccess(match);
    setQuizChecked(true);
    setQuizScore((prev) => ({
      correct: prev.correct + (match ? 1 : 0),
      total: prev.total + 1,
    }));
  };
  const mark = () => {
    if (!current) return;
    try {
      setReviewed(markMistakeReviewed(current.id));
    } catch {
      setNotice(
        en
          ? "Review status could not be saved."
          : "Le statut de révision n’a pas pu être sauvegardé.",
      );
      return;
    }
    setRevealed(false);
    setQuizChecked(false);
    setQuizSuccess(false);
    setAttempt("");
    if (!onlyPending) setIndex(Math.min(index + 1, entries.length - 1));
  };
  const remove = (ids: string[]) => {
    try {
      const next = deleteStoredMistakes(ids);
      setMistakes(next);
      setReviewed(getReviewedMistakeIds());
      setIndex(0);
      setRevealed(false);
      setAttempt("");
      if (category !== "all" && !next.some(m => m.category === category)) setCategory("all");
      setNotice(en ? `${ids.length} correction(s) removed from this notebook.` : `${ids.length} correction(s) supprimée(s) de ce carnet.`);
    } catch {
      setNotice(en ? "The corrections could not be deleted. Please try again." : "Impossible de supprimer les corrections. Réessayez.");
    }
  };
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <h1>{en ? "Correction notebook" : "Carnet de corrections"}</h1>
          <p>
            {en
              ? "Rewrite a sentence, reveal the correction, then decide what needs another pass. No AI call required."
              : "Réécrivez une phrase, révélez la correction, puis décidez quoi revoir. Aucun appel IA nécessaire."}
          </p>
        </div>
        <span className="outline-badge">
          <CheckCheck size={16} />
          {mastered} / {mistakes.length} {en ? "reviewed" : "revues"}
        </span>
      </div>
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="filter-bar">
        <label className="select-field">
          <span>{en ? "Ask before cleanup" : "Demander avant de nettoyer"}</span>
          <select
            aria-label={en ? "Cleanup reminder" : "Rappel de nettoyage"}
            value={cleanupDays}
            onChange={event => {
              const days = Number(event.target.value) as CleanupDays;
              try { setMistakeCleanupDays(days); setCleanupDays(days); }
              catch { setNotice(en ? "The reminder preference could not be saved." : "Impossible d’enregistrer ce réglage."); }
            }}
          >
            <option value={0}>{en ? "Off" : "Désactivé"}</option>
            <option value={30}>{en ? "30 days after review" : "30 jours après révision"}</option>
            <option value={90}>{en ? "90 days after review" : "90 jours après révision"}</option>
          </select>
        </label>
        <button className="button secondary" disabled={!mastered} onClick={() => {
          const ids = mistakes.filter(m => reviewed.includes(m.id)).map(m => m.id);
          if (window.confirm(en ? `Delete ${ids.length} reviewed correction(s) from this notebook?` : `Supprimer ${ids.length} correction(s) revue(s) de ce carnet ?`)) remove(ids);
        }}>
          <Trash2 size={15} />{en ? "Delete reviewed" : "Supprimer les corrections revues"}
        </button>
      </div>
      <p className="footnote">{en
        ? "Cleanup asks first. Removing a notebook correction keeps the original writing and feedback."
        : "Le nettoyage demande votre accord. Supprimer une correction du carnet conserve la rédaction et son bilan."}</p>
      {cleanupIds.length > 0 && (
        <div className="notice" role="status">
          <div>
            <p>{en ? `${cleanupIds.length} correction(s) were reviewed at least ${cleanupDays} days ago. Remove them from your notebook?`
              : `${cleanupIds.length} correction(s) ont été revues il y a au moins ${cleanupDays} jours. Les supprimer du carnet ?`}</p>
            <div className="row wrap">
              <button className="button secondary" onClick={() => remove(cleanupIds)}>{en ? "Yes, delete these corrections" : "Oui, supprimer ces corrections"}</button>
              <button className="text-button" onClick={() => {
                try { postponeMistakeCleanup(); setCleanupIds([]); }
                catch { setNotice(en ? "The reminder could not be postponed." : "Impossible de reporter le rappel."); }
              }}>{en ? "Keep them · remind me in 7 days" : "Les garder · me rappeler dans 7 jours"}</button>
            </div>
          </div>
        </div>
      )}
      {mistakes.length ? (
        <>
          <div className="notebook-mode-row">
            <div className="segmented">
              <button
                type="button"
                aria-pressed={!quizMode}
                onClick={() => {
                  setQuizMode(false);
                  setQuizChecked(false);
                  setRevealed(false);
                }}
              >
                <BookOpen size={15} />
                {en ? "Flashcards" : "Mode fiche"}
              </button>
              <button
                type="button"
                aria-pressed={quizMode}
                onClick={() => {
                  setQuizMode(true);
                  setQuizChecked(false);
                  setRevealed(false);
                }}
              >
                <Zap size={15} />
                {en ? "Quiz sprint" : "Mode quiz"}
              </button>
            </div>
            {quizMode && quizScore.total > 0 && (
              <div className="quiz-score-pill" role="status">
                <span>
                  {en ? "Sprint score:" : "Score du sprint :"}{" "}
                  <strong>
                    {quizScore.correct} / {quizScore.total}
                  </strong>
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setQuizScore({ correct: 0, total: 0 })}
                >
                  {en ? "Reset" : "Réinitialiser"}
                </button>
              </div>
            )}
          </div>
          <div className="filter-bar">
            <label className="select-field">
              <NotebookPen size={17} />
              <select
                aria-label={
                  en ? "Correction category" : "Catégorie de correction"
                }
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setIndex(0);
                  setRevealed(false);
                  setAttempt("");
                }}
              >
                <option value="all">
                  {en ? "All categories" : "Toutes les catégories"}
                </option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => {
                  setOnlyPending(e.target.checked);
                  setIndex(0);
                  setRevealed(false);
                  setAttempt("");
                }}
              />
              {en ? "Not yet reviewed" : "Pas encore revues"}
            </label>
            <span className="muted text-small">
              {entries.length} {en ? "corrections" : "corrections"}
            </span>
          </div>
          {current ? (
            <div className="revision-card panel">
              <div className="row between">
                <span className="badge lavender">{current.category}</span>
                <span className="muted text-small">
                  {Math.min(index + 1, entries.length)} / {entries.length}
                </span>
              </div>
              <p className="eyebrow revision-label">
                {en
                  ? "HOW WOULD YOU IMPROVE THIS?"
                  : "COMMENT AMÉLIORER CETTE PHRASE ?"}
              </p>
              <blockquote>« {current.original_text} »</blockquote>
              <label className="field-label">
                {en ? "Your corrected version" : "Votre version corrigée"}
                <textarea
                  value={attempt}
                  onChange={(e) => setAttempt(e.target.value)}
                  lang="fr"
                  placeholder={
                    en
                      ? "Try rewriting before revealing the answer…"
                      : "Essayez de corriger avant de révéler la réponse…"
                  }
                />
              </label>
              {quizMode ? (
                <>
                  {!quizChecked ? (
                    <button
                      className="button primary"
                      disabled={!attempt.trim()}
                      onClick={checkAnswer}
                    >
                      <Check size={16} />
                      {en ? "Check my correction" : "Vérifier ma correction"}
                    </button>
                  ) : (
                    <div className="revealed-correction">
                      {quizSuccess ? (
                        <div className="quiz-feedback-card is-success">
                          <strong>
                            <CheckCircle2 size={16} aria-hidden="true" />
                            <span>
                              {en
                                ? "Exact match — correction verified."
                                : "Correction exacte validée."}
                            </span>
                          </strong>
                          <p>
                            {en
                              ? "Your rewrite matches the target phrasing."
                              : "Votre reformulation correspond à la tournure attendue."}
                          </p>
                        </div>
                      ) : (
                        <div className="quiz-feedback-card is-retry">
                          <strong>
                            <Info size={16} aria-hidden="true" />
                            <span>
                              {en
                                ? "Compare your rewrite with the target:"
                                : "Comparez votre essai avec la correction attendue :"}
                            </span>
                          </strong>
                          <div className="quiz-compare-rows">
                            <p>
                              <span>{en ? "Your try:" : "Votre essai :"}</span>{" "}
                              <code>{attempt || "—"}</code>
                            </p>
                            <p>
                              <span>{en ? "Target:" : "Attendu :"}</span>{" "}
                              <code>{current.corrected_text}</code>
                            </p>
                          </div>
                        </div>
                      )}
                      <span className="eyebrow">
                        {en ? "RULE & EXPLANATION" : "RÈGLE ET EXPLICATION"}
                      </span>
                      <p className="after-text">
                        <Check size={18} />
                        {current.corrected_text}
                      </p>
                      <p>{current.explanation}</p>
                      <div className="row wrap">
                        <button className="button primary" onClick={mark}>
                          <CheckCheck size={16} />
                          {quizSuccess
                            ? (en ? "Next · Mark reviewed" : "Suivant · Marquer comme maîtrisé")
                            : (en ? "Understood · Mark reviewed" : "J’ai compris · Marquer comme revu")}
                        </button>
                        {!quizSuccess && (
                          <button
                            className="button secondary"
                            onClick={() => {
                              setQuizChecked(false);
                              setAttempt("");
                            }}
                          >
                            <RotateCcw size={15} />
                            {en ? "Try again" : "Réessayer"}
                          </button>
                        )}
                        <button
                          className="button secondary"
                          onClick={() => move(1)}
                        >
                          <ArrowRight size={15} />
                          {en ? "Skip for now" : "Passer à la suivante"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : revealed ? (
                <div className="revealed-correction">
                  <span className="eyebrow">
                    {en ? "THE SAVED CORRECTION" : "LA CORRECTION ENREGISTRÉE"}
                  </span>
                  <p className="after-text">
                    <Check size={18} />
                    {current.corrected_text}
                  </p>
                  <p>{current.explanation}</p>
                  <p className="footnote">
                    {en
                      ? "Other phrasings can be correct. Compare the grammar and meaning, not just the exact words."
                      : "D’autres formulations peuvent être correctes. Comparez la grammaire et le sens, pas seulement les mots exacts."}
                  </p>
                  <div className="row wrap">
                    <button className="button primary" onClick={mark}>
                      <CheckCheck size={16} />
                      {en
                        ? "I understand · Mark reviewed"
                        : "J’ai compris · Marquer comme revue"}
                    </button>
                    <button className="button secondary" onClick={() => remove([current.id])}>
                      <Trash2 size={16} />{en ? "I’ve learned this · Remove" : "J’ai appris cette règle · Supprimer"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => move(1)}
                    >
                      <RotateCcw size={15} />
                      {en ? "Keep for another pass" : "À revoir plus tard"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button primary"
                  onClick={() => setRevealed(true)}
                >
                  <Eye size={16} />
                  {en ? "Reveal the correction" : "Révéler la correction"}
                </button>
              )}
              <div className="revision-card-footer">
                <button
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => move(-1)}
                  aria-label={
                    en ? "Previous correction" : "Correction précédente"
                  }
                >
                  <ArrowLeft size={19} />
                </button>
                <span>
                  {current.task_name} · {current.date}
                </span>
                <button className="text-button" onClick={() => remove([current.id])}>
                  <Trash2 size={15} />{en ? "Delete correction" : "Supprimer la correction"}
                </button>
                <button
                  className="icon-button"
                  disabled={index >= entries.length - 1}
                  onClick={() => move(1)}
                  aria-label={en ? "Next correction" : "Correction suivante"}
                >
                  <ArrowRight size={19} />
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state panel">
              <CheckCheck size={33} />
              <h2>{en ? "All caught up." : "Tout est revu."}</h2>
              <p>
                {en
                  ? "Try another category or return to your writing."
                  : "Essayez une autre catégorie ou reprenez la rédaction."}
              </p>
              <button className="button primary" onClick={onPractice}>
                {en ? "Back to practice" : "Retour à la pratique"}
              </button>
            </div>
          )}
          <p className="footnote">
            {en
              ? "Reviewed means you marked the correction yourself. It is not a measured mastery score."
              : "Le statut « revue » correspond à votre propre appréciation. Il ne s’agit pas d’un score de maîtrise."}
          </p>
        </>
      ) : (
        <div className="empty-state panel notebook-empty">
          <NotebookPen size={36} />
          <h2>
            {en
              ? "Your own words make the best exercises."
              : "Vos propres phrases font les meilleurs exercices."}
          </h2>
          <p>
            {en
              ? "Finish a writing practice and request feedback. Verified corrections will be saved here for you to revisit."
              : "Terminez une rédaction et demandez un bilan. Les corrections vérifiées seront enregistrées ici pour vos révisions."}
          </p>
          <button className="button primary" onClick={onPractice}>
            {en ? "Choose my first practice" : "Choisir ma première séance"}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
