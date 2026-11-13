import React, { useState } from 'react';
import { AIEvaluation, DimensionScore } from '../types/aiEvaluation';
import { PedagogicalTask } from '../services/pedagogicalAssessment';
import { useLanguage } from '../context/LanguageContext';
import { countFrenchWords } from '../utils/wordCount';

/* ──────────────────────────────────────────────────
   Dimension labels & colour map
   ────────────────────────────────────────────────── */
const DIMENSION_META: Record<string, { en: string; fr: string; color: string; bg: string; border: string }> = {
  task_fulfilment:    { en: 'Task Fulfilment',    fr: 'Réalisation de la tâche', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  coherence_cohesion: { en: 'Coherence & Cohesion', fr: 'Cohérence et cohésion', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  lexical_resource:   { en: 'Lexical Resource',   fr: 'Ressource lexicale',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  grammar_accuracy:   { en: 'Grammar & Accuracy', fr: 'Grammaire et précision', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
};

/* ──────────────────────────────────────────────────
   Small helper components
   ────────────────────────────────────────────────── */

/** A horizontal progress gauge with score label */
const ScoreGauge: React.FC<{ score: number; max?: number; label: string; color: string }> = ({ score, max = 5, label, color }) => {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className={`font-bold font-mono ${color}`}>{score}/{max}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Indicative /20 badge */
const IndicativeScoreBadge: React.FC<{ score: number | null; en: boolean }> = ({ score, en }) => {
  if (score === null || score === undefined) return null;
  const rounded = Math.round(score * 10) / 10;
  const level = rounded >= 16 ? 'emerald' : rounded >= 12 ? 'blue' : rounded >= 8 ? 'amber' : 'red';
  return (
    <div className={`bg-${level}-50 border border-${level}-200 rounded-xl px-4 py-3 text-center min-w-[100px]`}>
      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
        {en ? 'Indicative Score' : 'Note indicative'}
      </div>
      <div className={`text-2xl font-black font-mono text-${level}-700 mt-0.5`}>
        {rounded}<span className="text-sm font-normal text-slate-400"> /20</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        {en ? 'Non-official estimate' : 'Estimation non officielle'}
      </div>
    </div>
  );
};

/** Expandable section wrapper */
const CollapsibleSection: React.FC<{ title: string; icon: string; defaultOpen?: boolean; badge?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, defaultOpen = false, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-semibold text-sm text-slate-800">{title}</span>
          {badge}
        </div>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
};

/* ──────────────────────────────────────────────────
   Task-level evaluation card
   ────────────────────────────────────────────────── */
const TaskCard: React.FC<{ taskKey: string; task: PedagogicalTask; en: boolean }> = ({ taskKey, task, en }) => {
  const [copiedModel, setCopiedModel] = useState(false);
  const taskNumber = taskKey.slice(-1);

  const handleCopyModel = () => {
    if (!task.model_answer) return;
    navigator.clipboard.writeText(task.model_answer);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 2000);
  };

  return (
    <article className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Task Header */}
      <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-extrabold shadow-sm">
              {taskNumber}
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              {en ? 'Task' : 'Tâche'} {taskNumber}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* CEFR Range Badge */}
            {task.range ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {en ? 'Level Range' : 'Plage de niveau'}
                </div>
                <div className="text-base font-bold text-emerald-700 font-mono">
                  {task.range.lower}–{task.range.upper}
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {en ? 'Level Range' : 'Plage de niveau'}
                </div>
                <div className="text-sm font-semibold text-slate-500">
                  {en ? 'Withheld' : 'Non attribuée'}
                </div>
              </div>
            )}

            {/* Indicative Score Badge */}
            <IndicativeScoreBadge score={task.indicative_score} en={en} />
          </div>
        </div>

        {/* Withholding reason */}
        {!task.range && task.withholding_reason && (
          <p className="text-sm text-slate-600 mt-2 pl-11">{task.withholding_reason}</p>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Admissibility Risks */}
        {task.risks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-sm text-amber-800 flex items-center gap-1.5">
              <span>⚠️</span>
              {en ? 'Admissibility Risks' : 'Risques de non-recevabilité'}
            </h4>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1.5 text-amber-900">
              {task.risks.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {task.level_evidence && task.level_evidence.length > 0 && <CollapsibleSection title={en ? 'Why this level range?' : 'Pourquoi cette plage de niveau ?'} icon="🔎" defaultOpen={true}><div className="space-y-3">{task.level_evidence.map((entry,i)=><div key={i} className="border-l-2 border-emerald-300 pl-3"><blockquote className="text-sm font-medium">« {entry.quote} »</blockquote><p className="text-sm leading-7 mt-1">{entry.explanation}</p></div>)}</div></CollapsibleSection>}
        {task.model_answer_warning && <p className="text-xs text-amber-800">{task.model_answer_warning}</p>}
        {task.validation_warnings && task.validation_warnings.length>0 && <div role="status" className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900"><p className="font-semibold mb-2">{en?'Some AI feedback could not be verified':'Certains éléments du bilan IA n’ont pas pu être vérifiés'}</p><ul className="list-disc pl-5 space-y-2">{task.validation_warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}
        {/* Strengths */}
        {task.strengths && task.strengths.length > 0 && (
          <CollapsibleSection
            title={en ? 'What You Did Well' : 'Vos points forts'}
            icon="✨"
            defaultOpen={true}
          >
            <ul className="space-y-2">
              {task.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Dimension Scores */}
        {task.dimension_scores && task.dimension_scores.length > 0 && (
          <CollapsibleSection
            title={en ? 'Scoring Breakdown' : 'Détail des scores'}
            icon="📊"
            defaultOpen={true}
            badge={
              task.indicative_score !== null ? (
                <span className="text-xs font-bold text-slate-500 ml-1">
                  ({task.indicative_score}/20)
                </span>
              ) : null
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {task.dimension_scores.map((dim: DimensionScore) => {
                const meta = DIMENSION_META[dim.dimension];
                if (!meta) return null;
                return (
                  <div key={dim.dimension} className={`${meta.bg} ${meta.border} border rounded-lg p-3 space-y-2`}>
                    <ScoreGauge
                      score={dim.score}
                      label={en ? meta.en : meta.fr}
                      color={meta.color}
                    />
                    {dim.evidence && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">{dim.evidence}</p>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      {en ? 'Weight' : 'Pondération'}: {Math.round((dim.weight || 0.25) * 100)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Overall Feedback */}
        <CollapsibleSection
          title={en ? 'Detailed Feedback' : 'Retour détaillé'}
          icon="💬"
          defaultOpen={true}
        >
          <p className="text-sm leading-7 text-slate-700">{task.feedback}</p>
        </CollapsibleSection>

        {/* Two Passes */}
        <CollapsibleSection
          title={en ? 'Two-Pass Analysis' : 'Analyse en deux passes'}
          icon="🔍"
          defaultOpen={false}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-blue-800">
                {en ? 'Pass 1 · Communication' : 'Passe 1 · Communication'}
              </h4>
              <p className="text-sm leading-7 text-slate-700">{task.communication_pass}</p>
            </div>
            <div className="bg-violet-50 border border-violet-100 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-violet-800">
                {en ? 'Pass 2 · Language Control' : 'Passe 2 · Maîtrise de la langue'}
              </h4>
              <p className="text-sm leading-7 text-slate-700">{task.language_pass}</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Evidence Domains */}
        <CollapsibleSection
          title={en ? 'Evidence Domains' : 'Domaines d\'observation'}
          icon="📐"
          defaultOpen={false}
        >
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(task.domains).map(([domain, text]) => {
              const domainLabels: Record<string, { en: string; fr: string }> = {
                linguistic: { en: 'Linguistic', fr: 'Linguistique' },
                pragmatic: { en: 'Pragmatic', fr: 'Pragmatique' },
                sociolinguistic: { en: 'Sociolinguistic', fr: 'Sociolinguistique' },
              };
              return (
                <div key={domain} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <h5 className="font-semibold text-xs text-slate-600 uppercase tracking-wider mb-2">
                    {en ? domainLabels[domain]?.en : domainLabels[domain]?.fr}
                  </h5>
                  <p className="text-sm leading-relaxed text-slate-700">{text}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* Source Checks (Task 3 only) */}
        {task.source_checks && (
          <CollapsibleSection
            title={en ? 'Source Fidelity & Comparison' : 'Fidélité aux sources et comparaison'}
            icon="📑"
            defaultOpen={false}
          >
            {Object.entries(task.source_checks).map(([label, text]) => {
              const sourceLabels: Record<string, string> = {
                document1: 'Document 1',
                document2: 'Document 2',
                comparison: en ? 'Comparison' : 'Comparaison',
                reformulation: en ? 'Reformulation' : 'Reformulation',
              };
              return (
                <p key={label} className="text-sm leading-7 text-slate-700">
                  <strong className="text-slate-800">{sourceLabels[label]} : </strong>{text}
                </p>
              );
            })}
          </CollapsibleSection>
        )}

        {/* Limiting Evidence & Priorities */}
        <div className="grid md:grid-cols-2 gap-4">
          <CollapsibleSection
            title={en ? 'Evidence Limiting the Range' : 'Éléments limitant la plage'}
            icon="🔻"
            defaultOpen={false}
          >
            <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">
              {task.limiting_evidence.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection
            title={en ? 'Your Next Priorities' : 'Vos prochaines priorités'}
            icon="🎯"
            defaultOpen={true}
          >
            <ol className="list-decimal pl-5 text-sm space-y-2 text-slate-700">
              {task.priorities.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
            </ol>
          </CollapsibleSection>
        </div>

        {/* Corrections */}
        {task.mistakes.length > 0 && (
          <CollapsibleSection
            title={en ? 'Corrections with Evidence' : 'Corrections avec exemples'}
            icon="✏️"
            defaultOpen={true}
            badge={
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                {task.mistakes.length}
              </span>
            }
          >
            <div className="space-y-3">
              {task.mistakes.map((m, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {m.category}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                    <span className="line-through text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      {m.original_text}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded">
                      {m.corrected_text}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    <span className="font-semibold text-slate-700">💡 {en ? 'Rule:' : 'Règle :'} </span>
                    {m.explanation}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Model Answer */}
        {task.model_answer && task.model_answer.trim() && (
          <CollapsibleSection
            title={en ? 'Illustrative Answer' : 'Exemple de réponse'}
            icon="💎"
            defaultOpen={false}
          >
            <div className="relative">
              <div className="text-sm leading-relaxed whitespace-pre-line bg-gradient-to-br from-slate-50 to-white p-4 rounded-lg border border-slate-200">
                {task.model_answer}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500 font-mono">
                  {countFrenchWords(task.model_answer)} {en ? 'words' : 'mots'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyModel}
                  className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-xs cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <span>📋</span>
                  <span>{copiedModel ? (en ? 'Copied!' : 'Copié !') : (en ? 'Copy' : 'Copier')}</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {en
                ? 'Illustrative answer for study, not a certified CEFR exemplar. Adapt the structure to the prompt.'
                : 'Exemple de rédaction non certifié, proposé pour votre entraînement. Utilisez-la pour l\'étude, pas pour la mémorisation.'}
            </p>
          </CollapsibleSection>
        )}
      </div>
    </article>
  );
};

/* ──────────────────────────────────────────────────
   Main PedagogicalEvaluationView
   ────────────────────────────────────────────────── */
export const PedagogicalEvaluationView: React.FC<{ evaluation: AIEvaluation }> = ({ evaluation }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const assessment = evaluation.pedagogical!;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase font-bold text-blue-600 tracking-widest">
              {en ? 'PEDAGOGICAL WRITING REVIEW' : 'BILAN PÉDAGOGIQUE'}
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              {en ? 'Evidence before a label.' : 'Des observations avant une étiquette.'}
            </h2>
            <p className="text-sm text-slate-600 mt-3">
              {en ? 'This assessment is not official.' : 'Cette évaluation n\u2019est pas officielle.'}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {en
                ? 'One isolated task cannot determine the final /20 score or NCLC level.'
                : 'Une tâche isolée ne permet pas de déterminer la note finale sur 20 ni le niveau NCLC.'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {en
                ? 'Two reading passes with quoted evidence. No invented points or task averaging. A complete mock may receive a separate estimated NCLC range.'
                : 'Deux passes de lecture avec citations. Aucun barème inventé ni moyenne des tâches. Un examen blanc complet peut recevoir une plage NCLC estimée distincte.'}
            </p>
          </div>

          {/* Overall Indicative Score */}
          {assessment.overall_indicative_score != null && (
            <IndicativeScoreBadge score={assessment.overall_indicative_score} en={en} />
          )}
        </div>
      </div>

      {evaluation.rubric_version !== 'pedagogical-evidence-v5' && <p className="p-4 rounded-lg bg-amber-50 text-sm">{en?'Earlier review: this used different rating instructions and may contain custom practice points. Reassess to use the current evidence-based guide.':'Ancien bilan : consignes différentes, avec possibles notes pédagogiques personnalisées. Relancez l’évaluation pour utiliser le guide actuel fondé sur les observations.'}</p>}
      {/* NCLC Projection */}
      <div className="border border-emerald-200 bg-emerald-50 p-5 rounded-xl">
        <h3 className="font-semibold text-emerald-900">
          {en ? 'Estimated NCLC · Full Mock Exam' : 'NCLC estimé · examen blanc complet'}
        </h3>
        {assessment.mock_projection ? (
          <>
            <p className="text-2xl mt-3 font-semibold text-emerald-800">
              NCLC {assessment.mock_projection.lower === 3 ? '<4' : assessment.mock_projection.lower}–
              {assessment.mock_projection.upper === 10 ? '10+' : assessment.mock_projection.upper}
            </p>
            <p className="text-sm leading-7 mt-3 text-slate-700">{assessment.mock_projection.rationale}</p>
            <p className="text-xs mt-3 text-slate-600">
              {en
                ? 'Uncalibrated AI projection, not an official result or a guarantee of your exam outcome.'
                : 'Projection IA non calibrée, sans valeur officielle ni garantie du résultat à l\u2019examen.'}
            </p>
          </>
        ) : (
          <p className="text-sm mt-3 text-slate-600">
            {assessment.projection_withholding_reason || (en ? 'A complete eligible mock is required.' : 'Un examen blanc complet est nécessaire.')}
          </p>
        )}
      </div>

      {/* Per-Task Cards */}
      {evaluation.evaluated_tasks.map(key => {
        const task = assessment.tasks[key];
        if (!task) return null;
        return <TaskCard key={key} taskKey={key} task={task} en={en} />;
      })}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 px-1">
        <span className="font-mono">{evaluation.model}</span>
        <span>·</span>
        <span className="font-mono">{evaluation.rubric_version}</span>
        {evaluation.prompt_hash && <span title="Assessment request fingerprint" className="font-mono">{evaluation.prompt_hash.slice(0,12)}</span>}
        <span>·</span>
        <span>{assessment.feedback_language.toUpperCase()}</span>
      </div>
    </section>
  );
};
