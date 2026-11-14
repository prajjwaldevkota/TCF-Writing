import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  NotebookPen,
  RotateCcw,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { getStoredMistakes } from "../utils/mistakesStorage";
export function Notebook({ onPractice }: { onPractice: () => void }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [mistakes] = useState(() => getStoredMistakes());
  const [category, setCategory] = useState("all");
  const [reviewed, setReviewed] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("tcf_reviewed_corrections") || "[]",
      );
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const [onlyPending, setOnlyPending] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [notice, setNotice] = useState("");
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
    setAttempt("");
  };
  const mark = () => {
    if (!current) return;
    const next = [...new Set([...reviewed, current.id])];
    setReviewed(next);
    try {
      localStorage.setItem("tcf_reviewed_corrections", JSON.stringify(next));
    } catch {
      setNotice(
        en
          ? "Review status could not be saved."
          : "Le statut de révision n’a pas pu être sauvegardé.",
      );
    }
    setRevealed(false);
    setAttempt("");
    if (!onlyPending) setIndex(Math.min(index + 1, entries.length - 1));
  };
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en
              ? "SMALL CORRECTIONS, LASTING HABITS"
              : "DE PETITES CORRECTIONS, DE BONNES HABITUDES"}
          </p>
          <h1>
            {en
              ? "Make yesterday’s mistakes useful."
              : "Les erreurs d’hier vous font avancer."}
          </h1>
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
      {mistakes.length ? (
        <>
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
          {notice && (
            <p className="notice warning" role="status">
              {notice}
            </p>
          )}
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
              {revealed ? (
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
