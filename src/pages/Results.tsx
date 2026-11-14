import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  AlertCircle,
  FilePenLine,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import { useLanguage } from "../context/LanguageContext";
import { getStoredSubmissions } from "../utils/storage";
import { countFrenchWords, formatTime } from "../utils/wordCount";
import { practicedKeys, TASK_INFO, TASK_KEYS } from "../utils/practice";
import {
  providerReview,
  ReviewProvider,
  withProviderReview,
} from "../utils/reviewState";
import { reviewSubmission } from "../services/reviewWorkflow";
import { getAvailableProviders } from "../services/dualEvaluator";
import { mockProjectionEligibility } from "../services/pedagogicalAssessment";
import { NclcCrosscheck } from "../components/NclcCrosscheck";
import { AIEvaluationView } from "../components/AIEvaluationView";
export function Results({
  result,
  onSave,
  onRevise,
  onHomeClick,
  onSettings,
  onNotebook,
}: {
  result: ExamResult;
  onSave: (result: ExamResult) => void;
  onRevise: (result: ExamResult, key: TaskKey) => void;
  onHomeClick: () => void;
  onSettings: () => void;
  onNotebook: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const keys = result.isPracticeMode ? practicedKeys(result) : TASK_KEYS;
  const [active, setActive] = useState<TaskKey>(keys[0] || "task1");
  const [provider, setProvider] = useState<ReviewProvider>("gemini");
  const [busy, setBusy] = useState<ReviewProvider | null>(null);
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
  const available = getAvailableProviders();
  const chosen = providerReview(result, provider) || result.aiEvaluation;
  const assessment = chosen?.pedagogical;
  const feedback = assessment?.tasks[active];
  const projection = result.aiEvaluation?.pedagogical?.mock_projection;
  const eligibility = mockProjectionEligibility(
    result,
    result.isPracticeMode ? keys : ["task1", "task2", "task3"],
  );
  const review = async (next: ReviewProvider, force = false) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(next);
    setError("");
    try {
      const data = await reviewSubmission(result, next, force);
      onSave(withProviderReview(result, next, data));
      setProvider(next);
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
      setBusy(null);
    }
  };
  const startProvider = available.gemini ? "gemini" : "groq";
  const words = countFrenchWords(result.answers[active]);
  const requirement = result.combination.tasks[active];
  return (
    <div className="page-enter">
      <button className="text-button back-link" onClick={onHomeClick}>
        <ArrowLeft size={15} />
        {en ? "Back to my practice" : "Retour à mon entraînement"}
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en ? "WRITE. REFLECT. TRY AGAIN." : "ÉCRIRE. RELIRE. RECOMMENCER."}
          </p>
          <h1>
            {en
              ? "A page closer to your goal."
              : "Une page de plus vers votre objectif."}
          </h1>
          <p>
            {en
              ? "Your writing is saved. Now turn it into your next improvement."
              : "Votre rédaction est sauvegardée. Transformez-la en prochaine piste de progrès."}
          </p>
        </div>
        <span className="outline-badge">
          <Check size={15} />
          {en ? "Saved in this browser" : "Enregistré dans ce navigateur"}
        </span>
      </div>
      <div className="review-summary">
        <div>
          <span className="eyebrow">{en ? "SESSION" : "SÉANCE"}</span>
          <strong>
            {result.revisionOf
              ? en
                ? "Revision"
                : "Réécriture"
              : result.isPracticeMode
                ? en
                  ? "Guided practice"
                  : "Pratique guidée"
                : en
                  ? "Full mock exam"
                  : "Examen blanc complet"}
          </strong>
        </div>
        <div>
          <span className="eyebrow">{en ? "TIME USED" : "TEMPS UTILISÉ"}</span>
          <strong>{formatTime(result.timeUsedSeconds)}</strong>
        </div>
        <div>
          <span className="eyebrow">
            {en ? "WORD COUNTS" : "NOMBRE DE MOTS"}
          </span>
          <strong>
            {keys
              .map(
                (k) =>
                  `T${TASK_INFO[k].number} : ${countFrenchWords(result.answers[k])}`,
              )
              .join(" · ")}
          </strong>
        </div>
        <div>
          <span className="eyebrow">
            {en ? "NEXT STEP" : "PROCHAINE ÉTAPE"}
          </span>
          <strong>
            {result.aiEvaluation
              ? en
                ? "Rewrite with feedback"
                : "Réécrire avec le bilan"
              : en
                ? "Request my review"
                : "Demander mon bilan"}
          </strong>
        </div>
      </div>
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
      {!result.aiEvaluation && (
        <section className="review-intro panel">
          <span className="resource-icon">
            <Sparkles size={21} />
          </span>
          <div>
            <h2>
              {en
                ? "Feedback you can put to work."
                : "Un bilan à mettre en pratique."}
            </h2>
            <p>
              {en
                ? "Get a task-level range, evidence from your text, verified corrections, and a few clear priorities. No automatic API calls."
                : "Obtenez une plage de niveau, des preuves tirées de votre texte, des corrections vérifiées et quelques priorités claires. Aucun appel IA automatique."}
            </p>
          </div>
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() =>
              available.gemini || available.groq
                ? void review(startProvider)
                : onSettings()
            }
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
              : available.gemini || available.groq
                ? en
                  ? "Get my feedback"
                  : "Obtenir mon bilan"
                : en
                  ? "Connect AI"
                  : "Configurer l’IA"}
          </button>
        </section>
      )}
      <div className="review-nclc panel">
        <div className="nclc-heading">
          <span className="eyebrow">
            {en ? "FULL-MOCK WRITING ESTIMATE" : "ESTIMATION DE L’EXAMEN BLANC"}
          </span>
          <span className="badge sand">
            {en ? "NON-OFFICIAL" : "NON OFFICIEL"}
          </span>
        </div>
        <div className="nclc-body">
          <h2>
            {projection ? (
              <>
                NCLC{" "}
                <em>
                  {projection.lower === 3 ? "<4" : projection.lower}–
                  {projection.upper === 10 ? "10+" : projection.upper}
                </em>
              </>
            ) : en ? (
              "Your NCLC estimate"
            ) : (
              "Votre estimation NCLC"
            )}
          </h2>
          <p>
            {projection
              ? projection.rationale
              : !eligibility.eligible
                ? en
                  ? eligibility.reason_en
                  : eligibility.reason_fr
                : result.aiEvaluation?.pedagogical
                    ?.projection_withholding_reason ||
                  (en
                    ? "Complete all three tasks. Then request one holistic review of the full mock. Gemini can provide an estimate without Groq."
                    : "Complétez les trois tâches, puis demandez un bilan de l’ensemble. Gemini peut fournir une estimation sans Groq.")}
          </p>
        </div>
        {result.aiEvaluation?.nclc_crosscheck &&
          result.dualAiEvaluation?.gemini &&
          result.dualAiEvaluation?.groq && (
            <NclcCrosscheck comparison={result.aiEvaluation.nclc_crosscheck} />
          )}
        <p className="footnote">
          {en
            ? "An uncalibrated practice range, not an official result. One isolated task cannot determine a final /20 score or NCLC level."
            : "Plage de pratique non calibrée, sans valeur officielle. Une tâche isolée ne détermine ni la note finale sur 20 ni le niveau NCLC."}
        </p>
      </div>
      <div className="review-controls">
        <div className="segmented">
          {(keys.length ? keys : (["task1"] as TaskKey[])).map((k) => (
            <button
              key={k}
              aria-pressed={active === k}
              onClick={() => setActive(k)}
            >
              Tâche {TASK_INFO[k].number}
            </button>
          ))}
        </div>
        <div className="row">
          {result.dualAiEvaluation?.gemini && result.dualAiEvaluation?.groq && (
            <select
              aria-label={en ? "Choose reviewer" : "Choisir le bilan"}
              value={provider}
              onChange={(e) => setProvider(e.target.value as ReviewProvider)}
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
            </select>
          )}
          <button
            className="button primary"
            onClick={() => onRevise(result, active)}
            disabled={!!busy}
          >
            <FilePenLine size={16} />
            {en ? "Rewrite this task" : "Réécrire cette tâche"}
          </button>
        </div>
      </div>
      <div className="review-grid">
        <section className="review-original panel">
          <div className="section-head">
            <h2>{en ? "Your writing" : "Votre rédaction"}</h2>
            <span
              className={`badge ${words >= requirement.minWords && words <= requirement.maxWords ? "sage" : "sand"}`}
            >
              {words} {en ? "words" : "mots"}
            </span>
          </div>
          <details className="review-prompt">
            <summary>
              {en ? "See the prompt" : "Revoir la consigne"}
              <ChevronDown size={14} />
            </summary>
            <p>{requirement.instruction}</p>
            {active === "task3" &&
              [requirement.document1, requirement.document2].map((doc, i) => (
                <div key={i}>
                  <strong>Document {i + 1}</strong>
                  <p>{doc || "—"}</p>
                </div>
              ))}
          </details>
          {original && (
            <details className="revision-reference">
              <summary>
                {en
                  ? "Compare with the previous version"
                  : "Comparer avec la version précédente"}
              </summary>
              <p>{original.answers[active]}</p>
            </details>
          )}
          <div className="original-writing">
            {result.answers[active] ||
              (en
                ? "No response was written for this task."
                : "Aucune réponse rédigée pour cette tâche.")}
          </div>
          <div className="original-caption">
            {result.month} {result.year} · Série{" "}
            {result.combination.combinationNumber}
          </div>
        </section>
        <section className="feedback-column">
          {busy && (
            <div className="notice" role="status">
              <Loader2 className="spin" size={20} />
              <span>
                {en
                  ? "Reading your communication, then your language control. This may take a moment."
                  : "Lecture de votre communication, puis de votre maîtrise de la langue. Cela peut prendre un moment."}
              </span>
            </div>
          )}
          {feedback ? (
            <>
              <div className="feedback-level panel">
                <div>
                  <span className="eyebrow">
                    {en
                      ? "PEDAGOGICAL LEVEL RANGE · THIS TASK"
                      : "PLAGE DE NIVEAU PÉDAGOGIQUE · CETTE TÂCHE"}
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
                <span className="feedback-model">
                  {chosen?.model} ·{" "}
                  {en
                    ? "Not an official assessment"
                    : "Évaluation non officielle"}
                </span>
              </div>
              {!!feedback.strengths?.length && (
                <div className="feedback-box">
                  <span className="badge sage">
                    <Check size={13} />
                    {en ? "KEEP DOING THIS" : "À CONSERVER"}
                  </span>
                  {feedback.strengths.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </div>
              )}
              <div className="feedback-box priorities">
                <span className="badge sand">
                  {en
                    ? "YOUR NEXT IMPROVEMENTS"
                    : "VOS PROCHAINES AMÉLIORATIONS"}
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
                <button
                  className="text-button"
                  onClick={() => onRevise(result, active)}
                >
                  {en
                    ? "Put these into a new version"
                    : "Les appliquer dans une nouvelle version"}
                  <ArrowRight size={15} />
                </button>
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
                <h3>{en ? "Why this range?" : "Pourquoi cette plage ?"}</h3>
                {feedback.level_evidence?.map((e, i) => (
                  <div className="evidence-item" key={i}>
                    <blockquote>« {e.quote} »</blockquote>
                    <p>{e.explanation}</p>
                    <small>{e.domain}</small>
                  </div>
                ))}
                <details>
                  <summary>
                    {en
                      ? "Read the full assessment"
                      : "Lire les observations détaillées"}
                    <ChevronDown size={14} />
                  </summary>
                  <h4>{en ? "Communication" : "Communication"}</h4>
                  <p>{feedback.communication_pass}</p>
                  <h4>{en ? "Language control" : "Maîtrise de la langue"}</h4>
                  <p>{feedback.language_pass}</p>
                  {Object.entries(feedback.domains).map(([domain, text]) => (
                    <div key={domain}>
                      <h4>{domain}</h4>
                      <p>{text}</p>
                    </div>
                  ))}
                  {feedback.source_checks &&
                    Object.entries(feedback.source_checks).map(
                      ([key, value]) => (
                        <p key={key}>
                          <strong>{key} :</strong> {value}
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
          ) : (
            <div className="feedback-placeholder panel">
              <BookOpen size={28} />
              <h3>
                {en
                  ? "Your feedback will appear here."
                  : "Votre bilan apparaîtra ici."}
              </h3>
              <p>
                {en
                  ? "Read it once for the main ideas, then choose one improvement for your revision."
                  : "Lisez-le pour comprendre l’essentiel, puis choisissez une amélioration à appliquer."}
              </p>
            </div>
          )}
        </section>
      </div>
      {feedback && (
        <section className="panel corrections-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                {en
                  ? "LEARN FROM YOUR OWN WORDS"
                  : "APPRENDRE À PARTIR DE VOS MOTS"}
              </p>
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
          {feedback.model_answer && (
            <details className="model-answer">
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
        </section>
      )}
      {result.aiEvaluation && (
        <details className="review-options panel">
          <summary>
            {en ? "Review options" : "Options de correction"}
            <ChevronDown size={16} />
          </summary>
          <p>
            {en
              ? "A second model is optional and does not guarantee accuracy. Reusing a matching review consumes no additional quota."
              : "Un second modèle est facultatif et ne garantit pas l’exactitude. Réutiliser un bilan identique ne consomme pas de quota supplémentaire."}
          </p>
          <div className="row wrap">
            <button
              className="button secondary"
              disabled={!!busy || !available.groq}
              onClick={() => void review("groq")}
            >
              {busy === "groq" ? <Loader2 className="spin" size={14} /> : null}
              {busy === "groq"
                ? en
                  ? "Reviewing…"
                  : "Analyse en cours…"
                : en
                  ? "Groq second opinion"
                  : "Second avis Groq"}
            </button>
            <button
              className="button secondary"
              disabled={!!busy || !available.gemini}
              onClick={() => void review("gemini", true)}
            >
              <RotateCcw size={14} />
              {en ? "New Gemini review" : "Nouvelle correction Gemini"}
            </button>
            <button className="text-button" onClick={onSettings}>
              {en ? "AI settings" : "Réglages IA"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
