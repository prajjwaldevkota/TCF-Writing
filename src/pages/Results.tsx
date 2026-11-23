import { useWorkspace } from "../context/WorkspaceContext";
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  AlertCircle,
  FilePenLine,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

import { countFrenchWords, formatTime } from "../utils/wordCount";
import { practicedKeys, TASK_INFO, TASK_KEYS } from "../utils/practice";
import { withGeminiReview } from "../utils/reviewState";
import { reviewSubmission, resumeSubmissionReview } from "../services/reviewWorkflow";
import { hasPendingEvaluationJob } from "../services/evaluationJobs";
import { mockProjectionEligibility } from "../services/pedagogicalAssessment";
import { AIEvaluationView } from "../components/AIEvaluationView";
import { LEVEL_UP_DATA } from "../components/PedagogicalEvaluationView";
import { RevisionComparison } from "../components/RevisionComparison";
import { AnnotatedAnswer } from "../components/AnnotatedAnswer";
import { SubmissionExport } from "../components/SubmissionExport";
import { EvaluationStepper } from "../components/EvaluationStepper";
export function Results({
  result,
  onSave,
  onRevise,
  onHomeClick,
  onSettings,
  onNotebook,
  onLogin,
}: {
  result: ExamResult;
  onSave: (result: ExamResult) => void;
  onRevise: (result: ExamResult, key: TaskKey) => void;
  onHomeClick: () => void;
  onSettings: () => void;
  onNotebook: () => void;
  onLogin?: () => void;
}) {
  const { getStoredSubmissions } = useWorkspace();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const en = language === "en";
  const keys = result.isPracticeMode ? practicedKeys(result) : TASK_KEYS;
  const [active, setActive] = useState<TaskKey>(keys[0] || "task1");
  const [section, setSection] = useState<"feedback" | "answer" | "corrections" | "examples" | null>(null);
  const [busy, setBusy] = useState(false);
  const [background, setBackground] = useState(() => hasPendingEvaluationJob(result.id, user?.id));
  const [error, setError] = useState("");
  const locked = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error)
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [error]);
  const original = result.revisionOf
    ? getStoredSubmissions().find((s) => s.id === result.revisionOf)
    : null;
  const chosen = result.aiEvaluation;
  const assessment = chosen?.pedagogical;
  const feedback = assessment?.tasks[active];
  const hasFeedback = Boolean(feedback || (chosen && !assessment));
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const layout = window.matchMedia("(min-width: 1024px)");
    const resize = () => setWide(layout.matches);
    resize();
    layout.addEventListener("change", resize);
    return () => layout.removeEventListener("change", resize);
  }, []);
  const visibleSection = !hasFeedback ? "answer"
    : section === "answer" && !wide ? "answer"
    : feedback && (section === "corrections" || section === "examples") ? section : "feedback";
  const assessmentLabels: Record<string, string> = {
    linguistic: en ? "Language" : "Langue",
    pragmatic: en ? "Structure and meaning" : "Structure et sens",
    sociolinguistic: en ? "Tone and register" : "Ton et registre",
    document1: "Document 1",
    document2: "Document 2",
    comparison: en ? "Comparison" : "Comparaison",
    reformulation: en ? "Paraphrasing" : "Reformulation",
  };
  const projection = result.aiEvaluation?.pedagogical?.mock_projection;
  const eligibility = mockProjectionEligibility(
    result,
    result.isPracticeMode ? keys : ["task1", "task2", "task3"],
  );
  const review = async (force = false, resume = false) => {
    if (!user) {
      setError(
        en
          ? "An account is required to generate AI reviews. Please sign in or create a free account."
          : "Un compte est requis pour générer un bilan par IA. Veuillez vous connecter ou créer un compte gratuit.",
      );
      if (onLogin) onLogin();
      return;
    }
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const data = resume ? await resumeSubmissionReview(result, user.id) : await reviewSubmission(result, force, user.id);
      if (data) onSave(withGeminiReview(result, data));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : en
            ? "The review failed. Your writing is saved."
            : "La correction a échoué. Votre texte est sauvegardé.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    const queued = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.submissionId === result.id && detail.owner === user?.id) setBackground(true);
    };
    window.addEventListener("tcf-review-queued", queued);
    return () => window.removeEventListener("tcf-review-queued", queued);
  }, [result.id, user?.id]);
  useEffect(() => {
    if (authLoading || !user) return;
    // Resuming a saved job reads its existing result; it never creates a new
    // evaluation just because the learner opened this page.
    if (hasPendingEvaluationJob(result.id, user?.id)) void review(true, true);
  }, [result.id, authLoading, user?.id]);
  const words = countFrenchWords(result.answers[active]);
  const requirement = result.combination.tasks[active];
  return (
    <div className="page-enter writing-report">
      <button className="text-button back-link" onClick={onHomeClick}>
        <ArrowLeft size={15} />
        {en ? "Back to my practice" : "Retour à mon entraînement"}
      </button>
      <div className="page-heading">
        <div>
          <h1>{en ? "Writing review" : "Bilan de rédaction"}</h1>
          <p>{result.revisionOf ? (en ? "Revision" : "Réécriture") : result.isPracticeMode ? (en ? "Guided practice" : "Pratique guidée") : (en ? "Full mock" : "Examen blanc")} · {formatTime(result.timeUsedSeconds)} · {result.month} {result.year} · {en ? "Set" : "Série"} {result.combination.combinationNumber}</p>
        </div>
        <span className="outline-badge">
          <Check size={15} />
          {en ? "Saved in this browser" : "Enregistré dans ce navigateur"}
        </span>
      </div>
      {!result.isPracticeMode && projection && (
        <section className="exam-estimate" aria-labelledby="estimate-heading">
          <div className="estimate-range">
            <h2 id="estimate-heading">{en ? "Full mock estimate" : "Estimation de l’examen blanc"}</h2>
            <div className="estimate-score"><span>NCLC</span> <strong>{projection.lower === 3 ? "<4" : projection.lower}–{projection.upper === 10 ? "10+" : projection.upper}</strong></div>
          </div>
          <div className="estimate-reading">
            <h3>{en ? "Basis for the estimate" : "Justification de l’estimation"}</h3>
            <p>{projection.rationale}</p>
            <small className="estimate-note">{en ? "Uncalibrated practice estimate based on the three tasks. Only the TCF issues an official result." : "Estimation de pratique non calibrée, fondée sur les trois tâches. Seul le TCF délivre un résultat officiel."}</small>
          </div>
        </section>
      )}
      {busy && (
        <EvaluationStepper en={en} isBackground={background} />
      )}
      {error && (
        <div ref={errorRef} className="notice warning" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>
              {en
                ? "The AI review could not finish."
                : "La correction IA n’a pas pu aboutir."}
            </strong>
            <p>{error}</p>
            <p>
              {en
                ? "Your writing and any previous successful review remain saved."
                : "Votre rédaction et tout bilan déjà obtenu restent sauvegardés."}
            </p>
            <button className="text-button" onClick={onSettings}>
              {en ? "Check AI settings" : "Vérifier les réglages IA"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      <section className="task-report" aria-labelledby="task-report-title">
        <div className="task-report-heading">
          <div>
            {keys.length > 1 && <div className="review-task-picker" role="group" aria-label={en ? "Select a task" : "Choisir une tâche"}>
              {keys.map(k => <button key={k} aria-pressed={active === k} onClick={() => setActive(k)}>
                {en ? "Task" : "Tâche"} {TASK_INFO[k].number}
              </button>)}
            </div>}
            <h2 id="task-report-title">{en ? "Task" : "Tâche"} {TASK_INFO[active].number} · {en ? TASK_INFO[active].en : TASK_INFO[active].fr}</h2>
          </div>
          <button className="button secondary" onClick={() => onRevise(result, active)} disabled={busy}>
            <FilePenLine size={16} />{en ? "Rewrite this task" : "Réécrire cette tâche"}
          </button>
        </div>
      <div className="task-report-panes" key={active}>
      {hasFeedback && <div className="report-sections" role="group" aria-label={en ? "Review sections" : "Rubriques du bilan"}>
        <button aria-pressed={visibleSection === "feedback"} onClick={() => setSection("feedback")}>{en ? "Assessment" : "Évaluation"}</button>
        {!wide && <button aria-pressed={visibleSection === "answer"} onClick={() => setSection("answer")}>{en ? "Your text" : "Votre texte"}</button>}
        {feedback && <button aria-pressed={visibleSection === "corrections"} onClick={() => setSection("corrections")}>Corrections <span>{feedback.mistakes.length}</span></button>}
        {feedback && <button aria-pressed={visibleSection === "examples"} onClick={() => setSection("examples")}>{en ? "Examples" : "Exemples"}</button>}
      </div>}

        {(wide || visibleSection === "answer") && <section className="review-original panel">
          <div className="section-head">
            <h2>{en ? "Your writing" : "Votre rédaction"}</h2>
            <span
              className={`badge ${words >= requirement.minWords && words <= requirement.maxWords ? "sage" : words < requirement.minWords ? "rose" : "sand"}`}
            >
              {words} / {requirement.minWords}–{requirement.maxWords} {en ? "words" : "mots"}
            </span>
          </div>
          {words < requirement.minWords && (
            <div className="length-check-banner is-under" role="note">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                {en
                  ? `Add ${requirement.minWords - words} ${requirement.minWords - words === 1 ? "word" : "words"} to reach the minimum.`
                  : `Il manque ${requirement.minWords - words} ${requirement.minWords - words === 1 ? "mot" : "mots"} pour atteindre le minimum.`}
              </span>
            </div>
          )}
          {original && (
            <RevisionComparison
              before={original.answers[active]}
              after={result.answers[active]}
              priorities={original.aiEvaluation?.pedagogical?.tasks[active]?.priorities}
              en={en}
            />
          )}
          <AnnotatedAnswer key={active} answer={result.answers[active]} mistakes={feedback?.mistakes} en={en} />
          <details className="review-prompt">
            <summary>
              {en ? "See the prompt" : "Revoir la consigne"}
              <ChevronDown size={14} />
            </summary>
            <p>{requirement.instruction}</p>
            {active === "task3" &&
              [requirement.document1, requirement.document2].map((doc, i) => doc && (
                <div key={i}>
                  <strong>Document {i + 1}</strong>
                  <p>{doc}</p>
                </div>
              ))}
          </details>


        </section>}
        <div className="review-reading-pane">

      {!result.aiEvaluation && (
        <section className="review-intro panel">
          <span className="resource-icon">
            <Sparkles size={21} />
          </span>
          <div>
            <h2>
              {en
                ? "Get feedback on your writing"
                : "Obtenir un bilan de votre rédaction"}
            </h2>
            <p>
              {en
                ? "See which passages support your estimated level and what to work on in your next draft."
                : "Repérez les passages qui étayent votre niveau estimé et les points à travailler dans votre prochaine version."}
            </p>
          </div>
          {user ? (
            <div className="review-provider-actions">
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() => void review()}
              >
                {busy ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}{" "}
                {busy
                  ? en
                    ? "Reviewing…"
                    : "Analyse en cours…"
                  : en
                    ? "Get my feedback"
                    : "Obtenir mon bilan"}
              </button>
            </div>
          ) : (
              <button
                type="button"
                className="button primary"
                onClick={onLogin}
              >
                <Lock size={15} />
                <span>
                  {en
                    ? "Sign in for feedback"
                    : "Se connecter pour obtenir le bilan"}
                </span>
              </button>
          )}
        </section>
      )}
        {chosen && !hasFeedback && <p className="notice">{en ? "This saved review contains no assessment for this task." : "Le bilan enregistré ne contient pas d’évaluation pour cette tâche."}</p>}
        {visibleSection === "feedback" && <section className="feedback-column">
          {feedback ? (
            <>
              <div className="feedback-level panel">
                <div>
                  <span className="eyebrow">
                    {en
                      ? "Estimated CEFR range"
                      : "Plage de niveau CECRL estimée"}
                  </span>
                  <h2>
                    {feedback.range
                      ? `${feedback.range.lower}–${feedback.range.upper}`
                      : en
                        ? "Range withheld"
                        : "Niveau suspendu"}
                  </h2>
                </div>
                <p>{feedback.feedback}</p>
                {feedback.withholding_reason && (
                  <p className="notice warning">
                    {feedback.withholding_reason}
                  </p>
                )}
                {!feedback.range && !!chosen && (
                  <div className="feedback-retry">
                    <p>
                      {en
                        ? "A withheld level is not a low grade. You can request a fresh review or copy your work for another AI or tutor. A new review uses API quota."
                        : "Un niveau suspendu n’est pas une mauvaise note. Demandez un nouveau bilan ou copiez votre travail pour une autre IA ou un tuteur. Un nouveau bilan consomme du quota API."}
                    </p>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void review(true)}
                    >
                      <RotateCcw size={15} />
                      {en
                        ? "Request a new review"
                        : "Demander un nouveau bilan"}
                    </button>
                  </div>
                )}
              </div>
              {!!feedback.strengths?.length && (
                <div className="feedback-box">
                  <span className="badge sage">
                    <Check size={13} />
                    {en ? "Strengths" : "Points forts"}
                  </span>
                  {feedback.strengths.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </div>
              )}
              <div className="feedback-box priorities">
                <span className="badge sand">
                  {en
                    ? "Revision priorities"
                    : "Priorités de réécriture"}
                </span>
                {feedback.priorities.length ? (
                  <ol>
                    {feedback.priorities.map((p, i) => (
                      <li key={i}>
                        <span>{i + 1}</span>
                        {p}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    {en
                      ? "No specific priority was returned. Read the evidence below."
                      : "Aucune priorité spécifique fournie. Consultez les observations ci-dessous."}
                  </p>
                )}

              </div>
              {!!feedback.risks.length && (
                <div className="notice warning">
                  <AlertCircle size={18} />
                  <div>
                    <strong>
                      {en
                        ? "Task requirements to check"
                        : "Points de conformité à vérifier"}
                    </strong>
                    {feedback.risks.map((risk, i) => (
                      <p key={i}>{risk}</p>
                    ))}
                  </div>
                </div>
              )}
              {!!feedback.validation_warnings?.length && (
                <div className="notice warning">
                  <div>
                    {feedback.validation_warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="panel feedback-evidence">
                <h3>{en ? "Evidence from your text" : "Observations sur votre texte"}</h3>
                {feedback.level_evidence?.map((e, i) => (
                  <div className="evidence-item" key={i}>
                    <blockquote>« {e.quote} »</blockquote>
                    <p>{e.explanation}</p>
                    <small>{assessmentLabels[e.domain] || e.domain}</small>
                  </div>
                ))}
                <details>
                  <summary>
                    {en
                      ? "Read the full assessment"
                      : "Lire les observations détaillées"}
                    <ChevronDown size={14} />
                  </summary>
                  {!!feedback.task_fulfilment_audit?.length && <div className="task-audit">
                    <h4>{en ? "Prompt requirements" : "Respect de la consigne"}</h4>
                    {feedback.task_fulfilment_audit.map((item, i) => <div key={i}>
                      <strong>{item.requirement}</strong>
                      <small>{item.met ? (en ? "Met" : "Respecté") : (en ? "To revisit" : "À revoir")}</small>
                      <p>{item.finding}</p>
                    </div>)}
                  </div>}
                  <h4>Communication</h4>
                  <p>{feedback.communication_pass}</p>
                  <h4>{en ? "Language control" : "Maîtrise de la langue"}</h4>
                  <p>{feedback.language_pass}</p>
                  {Object.entries(feedback.domains).map(([domain, text]) => (
                    <div key={domain}>
                      <h4>{assessmentLabels[domain] || domain}</h4>
                      <p>{text}</p>
                    </div>
                  ))}
                  {feedback.source_checks &&
                    Object.entries(feedback.source_checks).map(
                      ([key, value]) => (
                        <p key={key}>
                          <strong>{assessmentLabels[key] || key} :</strong> {value}
                        </p>
                      ),
                    )}
                  {!!feedback.limiting_evidence.length && (
                    <ul>
                      {feedback.limiting_evidence.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            </>
          ) : chosen && !chosen.pedagogical ? (
            <AIEvaluationView evaluation={chosen} />
          ) : null}
        </section>}
      {visibleSection === "corrections" && feedback && (
        <section className="panel corrections-section">
          <div className="section-head">
            <div>
              <h2>
                {en ? "Corrections to remember" : "Les corrections à retenir"}
              </h2>
            </div>
            <button className="text-button" onClick={onNotebook}>
              {en ? "Practise my corrections" : "Réviser mes corrections"}
              <ArrowRight size={15} />
            </button>
          </div>
          {feedback.mistakes.length ? (
            <div className="correction-grid">
              {feedback.mistakes.map((m, i) => (
                <article className="correction-card" key={i}>
                  <span className="badge neutral">{m.category}</span>
                  <p className="before-text">{m.original_text}</p>
                  <p className="after-text">
                    <ArrowRight size={14} />
                    {m.corrected_text}
                  </p>
                  <p>{m.explanation}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted text-small">
              {feedback.corrections_incomplete
                ? en
                  ? "No corrections could be verified. This does not mean the text is error-free."
                  : "Aucune correction n’a pu être vérifiée. Cela ne signifie pas que le texte est sans faute."
                : en
                  ? "The reviewer returned no corrections for this task."
                  : "Le bilan ne contient pas de correction pour cette tâche."}
            </p>
          )}
        </section>
      )}
      {visibleSection === "examples" && feedback && (
        <section className="panel review-examples">
          <h3>{en ? "Examples for this task" : "Exemples pour cette tâche"}</h3>
          {feedback.model_answer && (
            <details className="model-answer" open>
              <summary>
                {en
                  ? "See an illustrative response"
                  : "Voir un exemple de réponse"}
                <ChevronDown size={15} />
              </summary>
              <p className="footnote">
                {en
                  ? "A study example, not a certified level exemplar. Try revising your own response first."
                  : "Exemple de travail, sans niveau certifié. Essayez d’abord de réécrire votre propre texte."}
              </p>
              <p>{feedback.model_answer}</p>
            </details>
          )}
          {feedback.model_answer_warning && (
            <p className="footnote">{feedback.model_answer_warning}</p>
          )}
          {LEVEL_UP_DATA[active] && (
            <details className="level-up-drawer">
              <summary>
                <span className="row">
                  <ArrowUpRight size={16} aria-hidden="true" />
                  <span>
                    {en
                      ? "NCLC 7+ phrasing upgrades (B1 → B2/C1)"
                      : "Tournures NCLC 7+ (passer de B1 à B2/C1)"}
                  </span>
                </span>
                <ChevronDown size={15} />
              </summary>
              <div className="level-up-grid">
                {LEVEL_UP_DATA[active].map((item, i) => (
                  <article className="level-up-card" key={i}>
                    <div className="row between">
                      <strong>{en ? item.category.en : item.category.fr}</strong>
                      <span className="badge sage">B1 → B2/C1</span>
                    </div>
                    <p className="level-up-b1">
                      <span>B1</span> {item.b1}
                    </p>
                    <p className="level-up-b2">
                      <span>B2/C1</span> {item.b2_c1}
                    </p>
                    <small>{en ? item.note.en : item.note.fr}</small>
                  </article>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      </div>
      </div>
      </section>
      {!result.isPracticeMode && !projection && (
        <details className="review-options panel mock-estimate">
          <summary>{en ? "Full mock NCLC estimate" : "Estimation NCLC de l’examen blanc"} <ChevronDown size={16} /></summary>
          <div className="review-nclc">
              <p>
                {!eligibility.eligible
                    ? en
                      ? eligibility.reason_en
                      : eligibility.reason_fr
                    : result.aiEvaluation?.pedagogical
                        ?.projection_withholding_reason ||
                      (en
                        ? "Request a review of this mock exam to see its estimated range."
                        : "Demandez le bilan de cet examen blanc pour consulter sa plage estimée.")}
              </p>
            <p className="footnote">
              {en
                ? "An uncalibrated practice range, not an official result. One isolated task cannot determine a final /20 score or NCLC level."
                : "Plage de pratique non calibrée, sans valeur officielle. Une tâche isolée ne détermine ni la note finale sur 20 ni le niveau NCLC."}
            </p>
          </div>
        </details>
      )}
      {result.aiEvaluation && (
        <details className="review-options panel">
          <summary>
            {en ? "Review options" : "Options de correction"}
            <ChevronDown size={16} />
          </summary>
                {chosen?.requested_model &&
                  chosen.model !== chosen.requested_model && (
                    <p className="notice">
                      {en
                        ? `Automatic fallback: ${chosen.model} produced this review.`
                        : `Relais automatique : ce bilan a été réalisé par ${chosen.model}.`}
                    </p>
                  )}
                {chosen?.key_source === "backup" && (
                  <p className="notice">
                    {en
                      ? "The backup Gemini key was used for this review."
                      : "La clé Gemini de secours a été utilisée pour ce bilan."}
                  </p>
                )}
                <span className="feedback-model">
                  {chosen?.model} ·{" "}
                  {en
                    ? "Not an official assessment"
                    : "Évaluation non officielle"}
                </span>
          {user ? (
            <>
              <p>
                {en
                  ? "A new Gemini review uses the app’s automatic model selection and consumes API quota. Your saved feedback stays available if the request fails."
                  : "Un nouveau bilan Gemini utilise la sélection automatique du modèle et consomme du quota API. Votre bilan enregistré reste disponible si la demande échoue."}
              </p>
              <div className="row wrap">
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void review(true)}
                >
                  <RotateCcw size={14} />
                  {en ? "New Gemini review" : "Nouvelle correction Gemini"}
                </button>
                <button className="text-button" onClick={onSettings}>
                  {en ? "AI settings" : "Réglages IA"}
                </button>
              </div>
            </>
          ) : (
            <div className="review-options-guest">
              <p className="muted text-small">
                {en
                  ? "Sign in to request additional AI evaluations."
                  : "Connectez-vous pour demander de nouveaux bilans IA."}
              </p>
              <button className="button primary" onClick={onLogin}>
                <Lock size={14} />
                <span>{en ? "Sign in to review" : "Se connecter pour évaluer"}</span>
              </button>
            </div>
          )}
        </details>
      )}
      <SubmissionExport key={result.id} result={result} />
    </div>
  );
}
