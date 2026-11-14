import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FilePenLine,
  Repeat2,
  Target,
} from "lucide-react";
import type { ExamResult } from "../types/exam";
import { useLanguage } from "../context/LanguageContext";
import {
  practiceSummary,
  TASK_KEYS,
  TASK_INFO,
  practicedKeys,
  resultTimestamp,
  formatSessionDate,
} from "../utils/practice";
import { SessionList } from "../components/SessionList";
export function Progress({
  submissions,
  onOpen,
  onPractice,
}: {
  submissions: ExamResult[];
  onOpen: (s: ExamResult) => void;
  onPractice: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const summary = practiceSummary(submissions);
  const reviewed = submissions.filter((s) => s.aiEvaluation);
  const revisions = submissions.filter((s) => s.revisionOf);
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(12);
  const filtered = submissions.filter(
    (s) =>
      filter === "all" ||
      (filter === "exam" && !s.isPracticeMode) ||
      (filter === "revision" && s.revisionOf) ||
      (filter === "pending" && !s.aiEvaluation),
  );
  const projected = summary.latestProjection;
  const projection = projected?.aiEvaluation?.pedagogical?.mock_projection;
  const history = [...submissions]
    .filter((s) => s.aiEvaluation?.pedagogical?.mock_projection)
    .sort((a, b) => resultTimestamp(a) - resultTimestamp(b))
    .slice(-6);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en
              ? "PROGRESS YOU CAN TRACE"
              : "DES PROGRÈS QUE VOUS POUVEZ SUIVRE"}
          </p>
          <h1>
            {en ? "Look how far your words go." : "Vos mots font leur chemin."}
          </h1>
          <p>
            {en
              ? "Your practice, revisions, and supported estimates. Every number comes from your saved work."
              : "Vos séances, vos réécritures et vos estimations étayées. Chaque chiffre vient de votre travail enregistré."}
          </p>
        </div>
        <button className="button primary" onClick={onPractice}>
          <FilePenLine size={16} />
          {en ? "New practice" : "Nouvelle séance"}
        </button>
      </div>
      <div className="stat-grid">
        {[
          {
            icon: FilePenLine,
            n: submissions.length,
            label: en ? "Finished sessions" : "Séances terminées",
            color: "sage",
          },
          {
            icon: Check,
            n: reviewed.length,
            label: en ? "AI reviews saved" : "Bilans IA enregistrés",
            color: "sand",
          },
          {
            icon: Repeat2,
            n: revisions.length,
            label: en ? "Revisions written" : "Réécritures réalisées",
            color: "lavender",
          },
          {
            icon: Target,
            n: summary.weekCount,
            label: en ? "Sessions in 7 days" : "Séances sur 7 jours",
            color: "rose",
          },
        ].map(({ icon: Icon, n, label, color }) => (
          <section className="stat-card panel" key={label}>
            <span className={`stat-icon ${color}`}>
              <Icon size={19} />
            </span>
            <strong>{n}</strong>
            <span>{label}</span>
          </section>
        ))}
      </div>
      <div className="progress-grid">
        <section className="panel nclc-progress">
          <div className="section-head">
            <h2>
              {en ? "Writing estimate" : "Estimation en expression écrite"}
            </h2>
            <span className="badge sand">Objectif 7</span>
          </div>
          {projection ? (
            <>
              <p className="big-nclc">
                NCLC{" "}
                <em>
                  {projection.lower === 3 ? "<4" : projection.lower}–
                  {projection.upper === 10 ? "10+" : projection.upper}
                </em>
              </p>
              <p>
                {en
                  ? "Latest supported full-mock range"
                  : "Dernière plage étayée d’examen blanc"}{" "}
                · {projected && formatSessionDate(projected, language)}
              </p>
              <button
                className="text-button"
                onClick={() => projected && onOpen(projected)}
              >
                {en
                  ? "Read the supporting review"
                  : "Lire le bilan et ses preuves"}
                <ArrowUpRight size={15} />
              </button>
              {history.length > 1 && (
                <div
                  className="range-history"
                  aria-label={
                    en ? "Recent NCLC estimates" : "Estimations NCLC récentes"
                  }
                >
                  {history.map((s) => {
                    const p = s.aiEvaluation!.pedagogical!.mock_projection!;
                    return (
                      <button key={s.id} onClick={() => onOpen(s)}>
                        <span>
                          NCLC {p.lower === 3 ? "<4" : p.lower}–
                          {p.upper === 10 ? "10+" : p.upper}
                        </span>
                        <small>{formatSessionDate(s, language)}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="empty-inline compact">
              <Target size={28} />
              <h3>
                {en
                  ? "Start with a full mock."
                  : "Commencez par un examen blanc."}
              </h3>
              <p>
                {en
                  ? "An NCLC estimate needs a supported review of all three tasks. No estimate is shown until one is available."
                  : "Une estimation NCLC nécessite un bilan étayé des trois tâches. Aucune valeur n’est affichée tant qu’elle n’est pas disponible."}
              </p>
            </div>
          )}
          <p className="footnote">
            {en
              ? "AI estimates are uncalibrated and non-official. These ranges are not averaged and do not certify readiness."
              : "Estimations IA non calibrées et non officielles. Ces plages ne sont pas moyennées et ne certifient pas votre préparation."}
          </p>
        </section>
        <section className="panel task-balance">
          <div className="section-head">
            <h2>
              {en
                ? "Keep all three in play."
                : "Gardez les trois tâches en jeu."}
            </h2>
          </div>
          <p>
            {en
              ? "A finished response counts as practice, whether or not it has an AI review."
              : "Un texte terminé compte comme séance, avec ou sans correction IA."}
          </p>
          {TASK_KEYS.map((key) => (
            <div key={key}>
              <div className="row between">
                <span>
                  <span className={`task-dot ${TASK_INFO[key].color}`}>
                    {TASK_INFO[key].number}
                  </span>
                  {en ? TASK_INFO[key].en : TASK_INFO[key].fr}
                </span>
                <strong>{summary.counts[key]}</strong>
              </div>
              <div className="balance-bar">
                <span
                  className={TASK_INFO[key].color}
                  style={{
                    width: `${(summary.counts[key] / Math.max(1, ...Object.values(summary.counts))) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="panel progress-history">
        <div className="section-head">
          <h2>{en ? "Your writing journal" : "Votre journal de rédaction"}</h2>
          <select
            aria-label={en ? "Filter sessions" : "Filtrer les séances"}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(12);
            }}
          >
            <option value="all">
              {en ? "All sessions" : "Toutes les séances"}
            </option>
            <option value="exam">{en ? "Full mocks" : "Examens blancs"}</option>
            <option value="revision">{en ? "Revisions" : "Réécritures"}</option>
            <option value="pending">
              {en ? "Awaiting feedback" : "À corriger"}
            </option>
          </select>
        </div>
        {filtered.length ? (
          <>
            <SessionList sessions={filtered.slice(0, limit)} onOpen={onOpen} />
            {filtered.length > limit && (
              <button
                className="button secondary load-more"
                onClick={() => setLimit(limit + 12)}
              >
                {en ? "Show more" : "Afficher la suite"}
              </button>
            )}
          </>
        ) : (
          <div className="empty-inline">
            <FilePenLine size={27} />
            <h3>
              {en
                ? "Your next chapter is unwritten."
                : "Le prochain chapitre reste à écrire."}
            </h3>
            <p>
              {en
                ? "Your finished sessions will appear here."
                : "Vos séances terminées apparaîtront ici."}
            </p>
            <button className="text-button" onClick={onPractice}>
              {en ? "Choose a topic" : "Choisir un sujet"}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
