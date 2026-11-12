import { PedagogicalEvaluationView } from './PedagogicalEvaluationView';
import React, { useState } from 'react';
import { AIEvaluation, CefrLevel, MistakeItem, TaskEvaluation } from '../types/aiEvaluation';
import { ExamAnswers, ExamCombination, TaskKey } from '../types/exam';
import { cleanDocumentText, normalizeParagraphText } from '../utils/cleanText';
import { countFrenchWords } from '../utils/wordCount';
import { useLanguage } from '../context/LanguageContext';

interface AIEvaluationViewProps {
  evaluation: AIEvaluation;
  combination?: ExamCombination;
  userAnswers?: ExamAnswers | Record<string, string>;
  wordCounts?: { task1: number; task2: number; task3: number } | Record<string, number>;
}

const CEFR_STYLES: Record<CefrLevel, { bg: string; text: string; border: string }> = {
  A1: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  A2: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  B1: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
  B2: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300' },
  C1: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  C2: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-300' }
};

const LegacyAIEvaluationView: React.FC<AIEvaluationViewProps> = ({
  evaluation,
  combination,
  userAnswers,
  wordCounts
}) => {
  const { language, t } = useLanguage();

  // Determine which tasks were actually evaluated (only active practiced tasks)
  const availableTasks = (evaluation.evaluated_tasks && evaluation.evaluated_tasks.length > 0)
    ? evaluation.evaluated_tasks
    : (['task1', 'task2', 'task3'] as TaskKey[]).filter((k) => Boolean(evaluation.tasks[k]));

  const [activeTaskKey, setActiveTaskKey] = useState<TaskKey>(availableTasks[0] || 'task1');
  const [copiedModel, setCopiedModel] = useState<boolean>(false);
  const [copiedUser, setCopiedUser] = useState<boolean>(false);

  const currentTask: TaskEvaluation | undefined = evaluation.tasks[activeTaskKey];
  const taskReq = combination?.tasks?.[activeTaskKey];
  const userText = userAnswers?.[activeTaskKey] || '';
  const currentWordCount = wordCounts?.[activeTaskKey] || countFrenchWords(userText);

  const isWithinWordTarget = taskReq
    ? currentWordCount >= taskReq.minWords && currentWordCount <= taskReq.maxWords
    : true;

  const handleCopyModel = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 2000);
  };

  const handleCopyUser = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const resolvedOverallFeedback = language === 'en'
    ? (evaluation.overall_feedback_en || t(evaluation.overall_feedback))
    : (evaluation.overall_feedback || evaluation.overall_feedback_en);

  const resolvedGeneralFeedback = currentTask
    ? (language === 'en'
      ? (currentTask.general_feedback_en || t(currentTask.general_feedback))
      : (currentTask.general_feedback || currentTask.general_feedback_en))
    : '';

  const getCategoryBadge = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('ortho') || c.includes('accent') || c.includes('spell')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">{t('Orthographe / Accents')}</span>;
    }
    if (c.includes('temps') || c.includes('conjug')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">{t('Conjugaison / Temps')}</span>;
    }
    if (c.includes('struct') || c.includes('phrase') || c.includes('syntax')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">{t('Structure de phrase')}</span>;
    }
    if (c.includes('gramm')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">{t('Grammaire')}</span>;
    }
    if (c.includes('vocab')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">{t('Vocabulaire')}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">{t(category)}</span>;
  };

  const taskTitleMap: Record<TaskKey, string> = {
    task1: 'Tâche 1 : Description / Message',
    task2: 'Tâche 2 : Narration / Récit',
    task3: 'Tâche 3 : Argumentation'
  };

  const taskShortLabel: Record<TaskKey, string> = {
    task1: 'Tâche 1',
    task2: 'Tâche 2',
    task3: 'Tâche 3'
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Overall Score & Level Banner */}
      <div className="bg-white border border-slate-300 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🤖</span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {t('Évaluation Détaillée par l’IA')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              {resolvedOverallFeedback || t("Consultez l'analyse des fautes, votre note globale et la réponse modèle C1-C2.")}
            </p>
          </div>

          {/* Overall Badges */}
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            {/* Overall Score Badge: displayed ONLY for full/multi-task exam */}
            {availableTasks.length > 1 && (
              <div className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-center shadow-2xs min-w-[120px] whitespace-nowrap shrink-0">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider whitespace-nowrap">
                  {t('Note globale')}
                </div>
                <div className="text-2xl font-black font-mono text-slate-900 whitespace-nowrap mt-0.5 flex items-baseline justify-center gap-1">
                  <span>{evaluation.overall_score}</span>
                  <span className="text-sm font-sans font-normal text-slate-400">/ 20</span>
                </div>
              </div>
            )}

            {/* CEFR / CLB Level Badge */}
            <div className={`px-4 py-2.5 rounded-xl border text-center shadow-2xs min-w-[135px] whitespace-nowrap shrink-0 ${CEFR_STYLES[evaluation.estimated_cefr_level || 'A1']?.bg || 'bg-indigo-50'} ${CEFR_STYLES[evaluation.estimated_cefr_level || 'A1']?.border || 'border-indigo-300'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider whitespace-nowrap">
                {availableTasks.length === 1 ? t('Niveau CLB / CECRL') : t('Niveau estimé')}
              </div>
              <div className={`text-xl sm:text-2xl font-black ${CEFR_STYLES[evaluation.estimated_cefr_level || 'A1']?.text || 'text-indigo-800'} whitespace-nowrap mt-0.5 flex items-baseline justify-center gap-1.5`}>
                <span className="whitespace-nowrap">{evaluation.clb_level || ((evaluation.overall_score ?? 0) >= 10 ? 'CLB 7' : 'CLB 6')}</span>
                <span className="text-xs sm:text-sm font-bold opacity-80 whitespace-nowrap">({evaluation.estimated_cefr_level})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Task Selector Tabs (Only shows Task1, Task2, Task3 without individual scores) */}
        {availableTasks.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
              {t('Tâches évaluées')} :
            </span>
            {availableTasks.map((tKey) => {
              const isActive = activeTaskKey === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => setActiveTaskKey(tKey)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t(taskShortLabel[tKey])}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Active Task Evaluation Block */}
      {currentTask && (
        <div className="space-y-5">
          {/* Task Header Banner (No individual note /20 here) */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-2xs">
                {activeTaskKey.slice(-1)}
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {t(taskTitleMap[activeTaskKey] || currentTask.task_name)}
                </h3>
                {resolvedGeneralFeedback && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {resolvedGeneralFeedback}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center pl-8 sm:pl-0">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                currentWordCount === 0 || !userText.trim()
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'text-slate-600 bg-slate-100 border-slate-200'
              }`}>
                {currentWordCount === 0 || !userText.trim()
                  ? (language === 'en' ? '⚠️ 0 words (Failed)' : '⚠️ 0 mot (Non réalisé)')
                  : `${currentWordCount} ${t('mots rédigés')}`}
              </span>
              {taskReq && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {taskReq.minWords}–{taskReq.maxWords} {t('exigés')}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* User Submitted Response for THIS active task only */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>✍️</span>
                <span>{t('Votre texte rédigé')} ({t(taskShortLabel[activeTaskKey])})</span>
              </h4>
              <button
                type="button"
                onClick={() => handleCopyUser(userText)}
                className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>📋</span>
                <span>{copiedUser ? t('Copié !') : t('Copier votre texte')}</span>
              </button>
            </div>

            {/* Task Consigne / Documents preview */}
            {taskReq && (
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed space-y-1.5">
                {taskReq.title && (
                  <div className="font-bold text-blue-800">
                    {normalizeParagraphText(taskReq.title)}
                  </div>
                )}
                {taskReq.instruction && activeTaskKey !== 'task3' && (
                  <div>
                    <strong className="text-slate-800">{t('Consigne :')} </strong>
                    {normalizeParagraphText(taskReq.instruction)}
                  </div>
                )}
                {taskReq.document1 && (
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600 whitespace-pre-line">
                    <strong className="text-slate-800 block mb-0.5">{t('Document 1 :')}</strong>
                    {cleanDocumentText(taskReq.document1)}
                  </div>
                )}
                {taskReq.document2 && (
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600 whitespace-pre-line">
                    <strong className="text-slate-800 block mb-0.5">{t('Document 2 :')}</strong>
                    {cleanDocumentText(taskReq.document2)}
                  </div>
                )}
              </div>
            )}

            {/* Student's written answer */}
            <div className="text-slate-900 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 font-sans min-h-[70px]">
              {userText ? userText : <span className="italic text-slate-400">{t('Aucune réponse rédigée.')}</span>}
            </div>
          </div>

          {/* Section: Mistakes Breakdown (Compact list with English explanation) */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🔍</span>
                <span>{t('Fautes détectées')}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {currentTask.mistakes.length}
                </span>
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {t('Explications en anglais')}
              </span>
            </div>

            {currentWordCount === 0 || !userText.trim() ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm flex items-start gap-3">
                <span className="text-xl shrink-0">⚠️</span>
                <div className="space-y-1">
                  <h5 className="font-bold text-red-800 text-sm">
                    {language === 'en'
                      ? 'Task Achievement Failed — 0 Words Submitted'
                      : 'Échec de réalisation de la tâche — 0 mot rédigé'}
                  </h5>
                  <p className="text-xs text-red-700 leading-relaxed">
                    {language === 'en'
                      ? 'You did not write any response for this task (0 words). The prompt was not attempted, resulting in a failing score of 0/20. No grammatical mistakes can be evaluated. Please review the C1-C2 model answer below to learn how to fulfill this prompt.'
                      : 'Aucun texte n’a été rédigé pour cette tâche (0 mot). La consigne n’a pas été traitée, ce qui entraîne une note éliminatoire de 0/20. Aucune faute linguistique ne peut être évaluée. Consultez la réponse modèle C1-C2 ci-dessous pour étudier la structure attendue.'}
                  </p>
                </div>
              </div>
            ) : currentTask.mistakes.length === 0 ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2">
                <span>🎉</span>
                <span className="font-semibold">
                  {t('Excellent travail ! Aucune faute majeure de grammaire ou d’orthographe détectée.')}
                </span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white divide-y divide-slate-100 shadow-2xs">
                {currentTask.mistakes.map((m: MistakeItem, idx: number) => (
                  <div key={idx} className="p-3 hover:bg-slate-50/70 transition-colors text-xs sm:text-sm space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="shrink-0">
                        {getCategoryBadge(m.category)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                        <span className="line-through text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          {m.original_text || '—'}
                        </span>
                        <span className="text-slate-400 font-sans">→</span>
                        <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.5 rounded">
                          {m.corrected_text || '—'}
                        </span>
                      </div>
                    </div>

                    {m.explanation && (
                      <p className="text-slate-600 text-xs leading-relaxed pl-0.5 pt-0.5">
                        <span className="font-semibold text-slate-700">💡 {language === 'en' ? 'Rule:' : 'Règle :'} </span>
                        {m.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: AI Generated Model Answer (C1-C2 only) */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>💎</span>
                  <span>{t('Réponse modèle — Niveau C1 - C2')}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('Exemple enrichi au niveau C1/C2 respectant les consignes et le format officiel.')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyModel(currentTask.c1_c2_model_answer)}
                className="px-3 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>📋</span>
                <span>{copiedModel ? t('Copié !') : t('Copier l’exemple')}</span>
              </button>
            </div>

            {currentTask.c1_c2_model_answer ? (
              <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-lg border border-slate-200 font-sans">
                {normalizeParagraphText(currentTask.c1_c2_model_answer)}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 text-center">
                {t('Exemple non disponible.')}
              </p>
            )}

            {currentTask.c1_c2_model_answer && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span className="font-mono font-medium">{countFrenchWords(currentTask.c1_c2_model_answer)} {t('mots')}</span>
                {taskReq && (
                  <span>
                    {t('Cible exigée')} : {taskReq.minWords}–{taskReq.maxWords} {t('mots')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AIEvaluationView: React.FC<AIEvaluationViewProps> = (props) => props.evaluation.pedagogical
  ? <PedagogicalEvaluationView evaluation={props.evaluation}/>
  : <><p className="p-4 bg-amber-50 text-sm">Ancienne estimation IA / Legacy AI estimate — non officielle. Relancez une séance pour obtenir le nouveau bilan pédagogique.</p><LegacyAIEvaluationView {...props}/></>;
