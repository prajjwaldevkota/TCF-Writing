import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import { useLanguage } from "../context/LanguageContext";
import { CATEGORY_INFO } from "../utils/mistakesStorage";
import { TASK_INFO, TASK_KEYS, formatSessionDate } from "../utils/practice";
import { CorrectionDrill } from "../components/CorrectionDrill";
import { writingAnalytics } from "../utils/writingAnalytics";

function levelRange(range: { lower: string; upper: string }) {
  return range.lower === range.upper ? range.lower : range.lower + "–" + range.upper;
}

export function Analytics({ submissions, onOpen, onPractice }: {
  submissions: ExamResult[];
  onOpen: (result: ExamResult, task: TaskKey) => void;
  onPractice: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const [filter, setFilter] = useState<TaskKey | "all">("all");
  const [historyLimit, setHistoryLimit] = useState(8);
  const { recent, previous, domains, tasks, latestRewrite, original, recommendation, practiceSessions } = useMemo(() => writingAnalytics(submissions, filter), [submissions, filter]);
  const originalRange = latestRewrite && original?.aiEvaluation?.pedagogical?.tasks[latestRewrite.key]?.range;
  const peak = domains[0].examples.length;
  const leaders = domains.filter(d => d.examples.length === peak && peak > 0);
  const number = new Intl.NumberFormat(en ? "en-CA" : "fr-CA", { maximumFractionDigits: 2 });
  const rate = (n: number | null) => n === null ? "—" : number.format(n);
  const recentTotal = recent.words ? recent.corrections.length * 100 / recent.words : null;
  const previousTotal = previous.words ? previous.corrections.length * 100 / previous.words : null;
  const maxRate = Math.max(...domains.flatMap(d => [d.recentRate || 0, d.previousRate || 0]));
  const rateCell = (value: number | null) => <td><span>{rate(value)}</span>
    <span className="analytics-bar" aria-hidden="true"><i style={{ width: maxRate && value ? (value / maxRate * 100) + "%" : 0 }} /></span>
  </td>;
  const rubricVersions = [...new Set([...previous.samples, ...recent.samples].map(sample => sample.result.aiEvaluation?.rubric_version?.trim()).filter(Boolean))];
  const change = recentTotal !== null && previousTotal !== null ? recentTotal - previousTotal : null;
  const period = (window: typeof recent) => {
    const dates = window.samples;
    if (!dates.length) return "—";
    const first = formatSessionDate(dates[dates.length - 1].result, language);
    const last = formatSessionDate(dates[0].result, language);
    return first === last ? last : first + " – " + last;
  };
  return <div className="page-enter learning-analytics">
    <div className="page-heading"><div>
      <h1>{en ? "Writing analytics" : "Analyse de mes rédactions"}</h1>
      <p>{en ? "See what keeps coming up in your reviews and how your writing changes over time." : "Repérez les difficultés récurrentes dans vos bilans et suivez l’évolution de vos rédactions."}</p>
    </div></div>
    <div className="segmented" role="group" aria-label={en ? "Compare writing tasks" : "Comparer les tâches"}>
      {(["all", ...TASK_KEYS] as const).map(key => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setHistoryLimit(8); }}>
        {key === "all" ? (en ? "All tasks" : "Toutes les tâches") : (en ? "Task " : "Tâche ") + TASK_INFO[key].number}
      </button>)}
    </div>
    {!tasks.length ? <section className="empty-state panel">
      <h2>{en ? "No reviewed writing here yet" : "Aucune rédaction évaluée ici"}</h2>
      <p>{en ? "Save a task-level review to see its corrections and estimated level here." : "Enregistrez un bilan de tâche pour retrouver ici les corrections et le niveau estimé."}</p>
      <button className="button secondary" onClick={onPractice}>{en ? "Browse topics" : "Parcourir les sujets"}</button>
    </section> : <>
      {recommendation ? <CorrectionDrill key={filter + recommendation.category} en={en} focus={{
        cards: recommendation.cards,
        description: en
          ? `${CATEGORY_INFO[recommendation.category].en} came up in ${recommendation.reviewCount} of your last ${practiceSessions} reviewed sessions. Try correcting your own wording from memory.`
          : `${CATEGORY_INFO[recommendation.category].fr} · Ce domaine revient dans ${recommendation.reviewCount} de vos ${practiceSessions} dernières séances évaluées. Essayez de corriger votre formulation de mémoire.`,
      }} /> : <p className="analytics-practice-note">{practiceSessions < 2
        ? (en ? "A practice suggestion needs at least two sessions with complete, dated reviews." : "Une suggestion de révision nécessite au moins deux séances avec un bilan complet et daté.")
        : (en ? "No recurring correction area in your latest reviewed sessions." : "Aucun domaine de correction récurrent dans vos dernières séances évaluées.")}</p>}
      <div className="analytics-grid">
        <section className="panel analytics-domains">
          <h2>{en ? "Where to focus" : "Points à travailler"}</h2>
          <p>{leaders.length
            ? (en ? "Most frequently corrected: " : "Corrections les plus fréquentes : ") + leaders.map(d => CATEGORY_INFO[d.category][en ? "en" : "fr"]).join(", ") + "."
            : recent.words ? (en ? "No corrections recorded in the recent group." : "Aucune correction relevée dans le groupe récent.")
            : (en ? "No complete, dated correction lists for this selection." : "Aucune liste de corrections complète et datée pour cette sélection.")}</p>
          {recent.words > 0 && <table><caption>{en ? "Flagged corrections per 100 words" : "Corrections relevées pour 100 mots"}</caption>
            <thead><tr><th>{en ? "Area" : "Domaine"}</th><th>{en ? "Earlier" : "Avant"}</th><th>{en ? "Recent" : "Récemment"}</th></tr></thead>
            <tbody>{domains.filter(d => d.category !== "Autres" || d.examples.length || d.earlier).map(d => <tr key={d.category}>
              <th scope="row">{CATEGORY_INFO[d.category][en ? "en" : "fr"]}</th>{rateCell(d.previousRate)}{rateCell(d.recentRate)}
            </tr>)}</tbody></table>}
          <small>{en ? "Counts reflect what the reviewer flagged. A zero means that no correction was recorded in that area." : "Ces chiffres reflètent les observations du bilan. Un zéro signifie qu’aucune correction n’a été relevée dans ce domaine."}</small>
        </section>
        <section className="panel analytics-trend">
          <h2>{en ? "Change over time" : "Évolution dans le temps"}</h2>
          <p>{en ? "Corrections per 100 words across two consecutive groups of up to five reviewed sessions each." : "Corrections pour 100 mots dans deux groupes successifs de cinq séances évaluées au maximum."}</p>
          <div className="analytics-periods">{[previous, recent].map((group, index) => <div key={index}>
            <h3>{index ? (en ? "Recent" : "Récemment") : (en ? "Earlier" : "Avant")}</h3>
            <strong>{rate(index ? recentTotal : previousTotal)}</strong>
            <span>{period(group)}</span>
            <small>{group.sessions} {en ? "sessions" : "séances"} · {group.words} {en ? "words" : "mots"}</small>
          </div>)}</div>
          {rubricVersions.length > 1 && <p className="notice warning">{en
            ? "These sessions used different grading rubrics. A change in correction rate may partly reflect how the writing was graded."
            : "Ces séances ont été évaluées avec des grilles différentes. L’évolution du taux de corrections peut en partie refléter ce changement."} ({rubricVersions.join(", ")})</p>}
          {change !== null && <strong className="analytics-change">{Math.abs(change) < .005
            ? (en ? "Same correction rate" : "Taux de corrections stable")
            : en ? `${rate(Math.abs(change))} ${change < 0 ? "fewer" : "more"} corrections per 100 words`
            : `${rate(Math.abs(change))} correction${Math.abs(change) >= 2 ? "s" : ""} de ${change < 0 ? "moins" : "plus"} pour 100 mots`}</strong>}
          {previousTotal === null ? <p>{en ? "A second comparable review unlocks the comparison." : "Un deuxième bilan comparable permettra de suivre l’évolution."}</p> :
            <p>{en ? "A lower rate means fewer flagged corrections for the same amount of writing. Use the task filter to compare similar prompts." : "Un taux plus bas indique moins de corrections relevées à longueur égale. Filtrez par tâche pour comparer des consignes similaires."}</p>}
        </section>
      </div>
      {latestRewrite?.feedback.range && original && originalRange && <section className="panel analytics-rewrite">
        <div><h2>{en ? "Latest rewrite of the same prompt" : "Dernière réécriture du même sujet"}</h2>
          <p>{en ? "Task" : "Tâche"} {TASK_INFO[latestRewrite.key].number} · {en ? "Estimated CEFR range" : "Niveau CECRL estimé"}</p>
        </div>
        <button className="text-button" onClick={() => onOpen(original, latestRewrite.key)}>{en ? "Previous draft" : "Version précédente"} · {levelRange(originalRange)} <ArrowUpRight size={14}/></button>
        <button className="text-button" onClick={() => onOpen(latestRewrite.result, latestRewrite.key)}>{en ? "Rewrite" : "Réécriture"} · {levelRange(latestRewrite.feedback.range)} <ArrowUpRight size={14}/></button>
      </section>}
      {peak > 0 && <section className="panel analytics-examples"><h2>{en ? "Examples from your recent writing" : "Exemples tirés de vos rédactions récentes"}</h2>
        {domains.filter(d => d.examples.length).map(d => <details key={d.category}>
          <summary>{CATEGORY_INFO[d.category][en ? "en" : "fr"]} ({d.examples.length})</summary>
          {d.examples.map((m, i) => <article key={i}><p><del>{m.original_text}</del> → <ins>{m.corrected_text}</ins></p><p>{m.explanation}</p>
            <button className="text-button" onClick={() => onOpen(m.result, m.key)}>{en ? "Open review" : "Ouvrir le bilan"} · {en ? "Task" : "Tâche"} {TASK_INFO[m.key].number} <ArrowUpRight size={14}/></button></article>)}
        </details>)}
      </section>}
      <section className="panel analytics-history"><h2>{en ? "Task-level history" : "Historique des niveaux par tâche"}</h2>
        {tasks.slice(0, historyLimit).map(({ key, result, feedback, words }, i) => <button key={i} onClick={() => onOpen(result,key)}>
          <span>{formatSessionDate(result, language)} · {en ? "Task" : "Tâche"} {TASK_INFO[key].number}{result.revisionOf && (en ? " · Rewrite" : " · Réécriture")}</span>
          <small>{words} {en ? "words" : "mots"}</small><strong>{feedback.range ? levelRange(feedback.range) : (en ? "Range withheld" : "Niveau non attribué")}</strong><ArrowUpRight size={15}/>
        </button>)}
        {tasks.length > historyLimit && <button className="text-button" onClick={() => setHistoryLimit(historyLimit + 8)}>{en ? "Show older tasks" : "Voir les tâches précédentes"}</button>}
      </section>
    </>}
  </div>;
}
