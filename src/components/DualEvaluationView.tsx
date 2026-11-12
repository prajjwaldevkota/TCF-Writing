import React, { useState } from 'react';
import { AIEvaluation, DimensionScore } from '../types/aiEvaluation';
import { PedagogicalTask } from '../services/pedagogicalAssessment';
import { PedagogicalEvaluationView } from './PedagogicalEvaluationView';
import { useLanguage } from '../context/LanguageContext';

interface DualEvaluationViewProps {
  gemini: AIEvaluation | null;
  groq: AIEvaluation | null;
  geminiError: string | null;
  groqError: string | null;
}

const DIMENSION_LABELS: Record<string, { en: string; fr: string }> = {
  task_fulfilment:    { en: 'Task Fulfilment',      fr: 'Réalisation de la tâche' },
  coherence_cohesion: { en: 'Coherence & Cohesion',  fr: 'Cohérence et cohésion' },
  lexical_resource:   { en: 'Lexical Resource',      fr: 'Ressource lexicale' },
  grammar_accuracy:   { en: 'Grammar & Accuracy',    fr: 'Grammaire et précision' },
};

/** Small bar comparing two values */
const ComparisonBar: React.FC<{ label: string; geminiScore: number | null; groqScore: number | null; max?: number }> = ({
  label, geminiScore, groqScore, max = 5
}) => {
  const gPct = geminiScore !== null ? (geminiScore / max) * 100 : 0;
  const qPct = groqScore !== null ? (groqScore / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-blue-600">{geminiScore !== null ? geminiScore : '—'}</span>
          <span className="text-slate-300">vs</span>
          <span className="text-orange-600">{groqScore !== null ? groqScore : '—'}</span>
        </div>
      </div>
      <div className="relative w-full h-3 rounded-full bg-slate-100 overflow-hidden">
        {/* Gemini bar */}
        <div
          className="absolute top-0 left-0 h-1.5 rounded-full bg-blue-400 transition-all duration-500"
          style={{ width: `${gPct}%` }}
        />
        {/* Groq bar */}
        <div
          className="absolute bottom-0 left-0 h-1.5 rounded-full bg-orange-400 transition-all duration-500"
          style={{ width: `${qPct}%` }}
        />
      </div>
    </div>
  );
};

/** Quick summary comparison card */
const ComparisonSummary: React.FC<{ gemini: AIEvaluation; groq: AIEvaluation; en: boolean }> = ({ gemini, groq, en }) => {
  const tasks = gemini.evaluated_tasks;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">
          {en ? 'Score Comparison' : 'Comparaison des scores'}
        </h3>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-400" />
            Gemini
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-400" />
            Groq
          </span>
        </div>
      </div>

      {/* Overall scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Gemini {en ? 'Overall' : 'Global'}
          </div>
          <div className="text-xl font-black font-mono text-blue-700 mt-1">
            {gemini.overall_score !== null ? `${gemini.overall_score}/20` : '—'}
          </div>
          <div className="text-xs text-blue-600 mt-0.5">{gemini.model}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Groq {en ? 'Overall' : 'Global'}
          </div>
          <div className="text-xl font-black font-mono text-orange-700 mt-1">
            {groq.overall_score !== null ? `${groq.overall_score}/20` : '—'}
          </div>
          <div className="text-xs text-orange-600 mt-0.5">{groq.model}</div>
        </div>
      </div>

      {/* Per-task dimension comparison */}
      {tasks.map(taskKey => {
        const geminiTask = gemini.pedagogical?.tasks[taskKey];
        const groqTask = groq.pedagogical?.tasks[taskKey];
        if (!geminiTask && !groqTask) return null;

        const taskNumber = taskKey.slice(-1);

        // Build dimension lookup maps
        const gDims = new Map<string, number>();
        const qDims = new Map<string, number>();
        geminiTask?.dimension_scores?.forEach(d => gDims.set(d.dimension, d.score));
        groqTask?.dimension_scores?.forEach(d => qDims.set(d.dimension, d.score));

        return (
          <div key={taskKey} className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-slate-800">
                {en ? 'Task' : 'Tâche'} {taskNumber}
              </h4>
              <div className="flex items-center gap-4 text-xs font-mono">
                {/* Level ranges */}
                <span className="text-blue-600">
                  {geminiTask?.range ? `${geminiTask.range.lower}–${geminiTask.range.upper}` : '—'}
                </span>
                <span className="text-slate-300">vs</span>
                <span className="text-orange-600">
                  {groqTask?.range ? `${groqTask.range.lower}–${groqTask.range.upper}` : '—'}
                </span>
              </div>
            </div>

            {/* Dimension bars */}
            {Object.entries(DIMENSION_LABELS).map(([dim, labels]) => (
              <ComparisonBar
                key={dim}
                label={en ? labels.en : labels.fr}
                geminiScore={gDims.get(dim) ?? null}
                groqScore={qDims.get(dim) ?? null}
              />
            ))}

            {/* Indicative scores side-by-side */}
            <div className="flex items-center gap-3 text-xs pt-1">
              <span className="text-slate-500 font-medium">{en ? 'Indicative:' : 'Indicatif :'}</span>
              <span className="font-bold text-blue-600 font-mono">
                {geminiTask?.indicative_score !== null && geminiTask?.indicative_score !== undefined
                  ? `${geminiTask.indicative_score}/20`
                  : '—'}
              </span>
              <span className="text-slate-300">vs</span>
              <span className="font-bold text-orange-600 font-mono">
                {groqTask?.indicative_score !== null && groqTask?.indicative_score !== undefined
                  ? `${groqTask.indicative_score}/20`
                  : '—'}
              </span>
            </div>
          </div>
        );
      })}

      {/* Agreement indicator */}
      {gemini.overall_score !== null && groq.overall_score !== null && (
        <div className={`rounded-lg p-3 text-sm ${
          Math.abs(gemini.overall_score - groq.overall_score) <= 2
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          <span className="font-semibold">
            {Math.abs(gemini.overall_score - groq.overall_score) <= 2
              ? (en ? '✓ High agreement' : '✓ Fort accord')
              : (en ? '⚠ Divergent scores' : '⚠ Scores divergents')}
          </span>
          <span className="ml-2">
            {en
              ? `Difference: ${Math.abs(Math.round((gemini.overall_score - groq.overall_score) * 10) / 10)} points. ${
                  Math.abs(gemini.overall_score - groq.overall_score) <= 2
                    ? 'Both AI assessors broadly agree on your level.'
                    : 'Review both evaluations carefully — the assessors disagree on your level.'
                }`
              : `Écart : ${Math.abs(Math.round((gemini.overall_score - groq.overall_score) * 10) / 10)} points. ${
                  Math.abs(gemini.overall_score - groq.overall_score) <= 2
                    ? 'Les deux évaluateurs IA sont globalement d\'accord sur votre niveau.'
                    : 'Examinez les deux évaluations attentivement — les évaluateurs ne sont pas d\'accord.'
                }`}
          </span>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────
   Main Dual Evaluation View
   ────────────────────────────────────────────────── */
export const DualEvaluationView: React.FC<DualEvaluationViewProps> = ({
  gemini, groq, geminiError, groqError
}) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const [activeTab, setActiveTab] = useState<'comparison' | 'gemini' | 'groq'>('comparison');

  const hasBoth = !!gemini && !!groq;
  const hasAny = !!gemini || !!groq;

  if (!hasAny) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <h3 className="font-bold text-red-800">
          {en ? 'Both evaluations failed' : 'Les deux évaluations ont échoué'}
        </h3>
        {geminiError && <p className="text-sm text-red-700 mt-2"><strong>Gemini:</strong> {geminiError}</p>}
        {groqError && <p className="text-sm text-red-700 mt-2"><strong>Groq:</strong> {groqError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provider Error Alerts */}
      {geminiError && gemini === null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
          <span>ℹ️</span>
          <span><strong>Gemini:</strong> {geminiError}</span>
        </div>
      )}
      {groqError && groq === null && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 flex items-center gap-2">
          <span>ℹ️</span>
          <span><strong>Groq:</strong> {groqError}</span>
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 w-fit">
        {hasBoth && (
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            📊 {en ? 'Comparison' : 'Comparaison'}
          </button>
        )}
        {gemini && (
          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gemini'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Gemini
            {gemini.overall_score !== null && (
              <span className="font-mono ml-1">{gemini.overall_score}/20</span>
            )}
          </button>
        )}
        {groq && (
          <button
            type="button"
            onClick={() => setActiveTab('groq')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'groq'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-orange-700 hover:bg-orange-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Groq
            {groq.overall_score !== null && (
              <span className="font-mono ml-1">{groq.overall_score}/20</span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'comparison' && hasBoth && (
        <ComparisonSummary gemini={gemini} groq={groq} en={en} />
      )}
      {activeTab === 'gemini' && gemini && (
        <PedagogicalEvaluationView evaluation={gemini} />
      )}
      {activeTab === 'groq' && groq && (
        <PedagogicalEvaluationView evaluation={groq} />
      )}

      {/* If only one provider succeeded, show it directly */}
      {!hasBoth && hasAny && activeTab === 'comparison' && (
        <PedagogicalEvaluationView evaluation={(gemini || groq)!} />
      )}
    </div>
  );
};

