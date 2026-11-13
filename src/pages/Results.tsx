import { crosscheckedPrimary } from '../utils/nclcComparison';
import { NclcCrosscheck } from '../components/NclcCrosscheck';
import { mockProjectionEligibility } from '../services/pedagogicalAssessment';
import React, { useState, useEffect } from 'react';
import { ExamResult, TaskKey } from '../types/exam';
import { formatTime } from '../utils/wordCount';
import { cleanDocumentText, fixMojibake, normalizeParagraphText } from '../utils/cleanText';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AIEvaluation } from '../types/aiEvaluation';
import { AIEvaluationView } from '../components/AIEvaluationView';
import { DualEvaluationView } from '../components/DualEvaluationView';
import { evaluateTcfSubmissionWithGemini, setGeminiApiKey, getActiveEvaluatedTasks } from '../services/geminiEvaluator';
import { evaluateDual, getAvailableProviders, DualEvaluationResult } from '../services/dualEvaluator';
import { evaluateTcfSubmissionWithGroq, setGroqApiKey } from '../services/groqEvaluator';
import { updateStoredSubmission } from '../utils/storage';
import { updateSubmissionAiFeedback } from '../lib/supabase';
import { saveEvaluationMistakes } from '../utils/mistakesStorage';

interface ResultsProps {
  result: ExamResult;
  onHomeClick: () => void;
  onDashboardClick?: () => void;
  onFeedbackClick?: () => void;
  hideHeader?: boolean;
}

export const Results: React.FC<ResultsProps> = ({
  result,
  onHomeClick,
  onDashboardClick,
  onFeedbackClick,
  hideHeader = false
}) => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [copiedTask, setCopiedTask] = useState<string | null>(null);

  // AI Evaluation states
  const [evaluation, setEvaluation] = useState<AIEvaluation | null>(result.dualAiEvaluation ? crosscheckedPrimary(result.dualAiEvaluation.gemini, result.dualAiEvaluation.groq) : result.aiEvaluation || null);
  const [dualResult, setDualResult] = useState<DualEvaluationResult | null>(
    result.dualAiEvaluation
      ? {
          gemini: result.dualAiEvaluation.gemini,
          groq: result.dualAiEvaluation.groq,
          geminiError: result.dualAiEvaluation.geminiError || null,
          groqError: result.dualAiEvaluation.groqError || null,
          primary: crosscheckedPrimary(result.dualAiEvaluation.gemini, result.dualAiEvaluation.groq),
        }
      : null
  );
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [availableProviders, setAvailableProviders] = useState(getAvailableProviders());
  const isDualAvailable = availableProviders.gemini && availableProviders.groq;
  const nclcEligibility = mockProjectionEligibility(result, getActiveEvaluatedTasks(result));
  const nclcEstimate = evaluation?.pedagogical?.mock_projection;


  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const handleConfigureKeys = () => {
    const choice = window.prompt(
      language === 'en'
        ? "Configure AI Keys:\n1 - Google Gemini API Key\n2 - Groq Cloud API Key\nType 1 or 2:"
        : "Configurer les clés IA :\n1 - Clé API Google Gemini\n2 - Clé API Groq Cloud\nTapez 1 ou 2 :"
    );

    if (choice === '1') {
      const gKey = window.prompt(
        language === 'en'
          ? "Enter Google Gemini API key (or leave empty to reset):"
          : "Entrez la clé API Google Gemini (ou laissez vide pour réinitialiser) :"
      );
      if (gKey !== null) {
        setGeminiApiKey(gKey);
        setAvailableProviders(getAvailableProviders());
      }
    } else if (choice === '2') {
      const qKey = window.prompt(
        language === 'en'
          ? "Enter Groq API key (from console.groq.com):"
          : "Entrez la clé API Groq (depuis console.groq.com) :"
      );
      if (qKey !== null) {
        setGroqApiKey(qKey);
        setAvailableProviders(getAvailableProviders());
      }
    }
  };

  /** Start Evaluation: runs dual if both keys available, or single */
  const handleStartEvaluation = async () => {
    setEvaluating(true);
    setEvalError(null);

    try {
      const providers = getAvailableProviders();
      if (!providers.gemini && !providers.groq) {
        throw new Error(
          language === 'en'
            ? "No AI API key found. Please configure a Gemini or Groq key."
            : "Aucune clé API IA trouvée. Veuillez configurer une clé Gemini ou Groq."
        );
      }

      // If both available, perform dual evaluation
      if (providers.gemini && providers.groq) {
        const dual = await evaluateDual(result);
        setDualResult(dual);

        if (dual.primary) {
          setEvaluation(dual.primary);
          const updatedResult: ExamResult = {
            ...result,
            aiEvaluation: dual.primary,
            dualAiEvaluation: {
              gemini: dual.gemini,
              groq: dual.groq,
              geminiError: dual.geminiError,
              groqError: dual.groqError,
            },
          };
          updateStoredSubmission(updatedResult);
          saveEvaluationMistakes(dual.primary, updatedResult);

          if (user && result.id) {
            try {
              const { error } = await updateSubmissionAiFeedback(result.id, user.id, dual.primary);
              if (error) throw error;
            } catch (dbErr) {
              console.warn('Could not sync AI evaluation to Supabase:', dbErr);
            }
          }
        } else {
          throw new Error(dual.geminiError || dual.groqError || "L'évaluation a échoué.");
        }
      } else {
        // Run whichever is available
        const evalData = providers.gemini
          ? await evaluateTcfSubmissionWithGemini(result)
          : await evaluateTcfSubmissionWithGroq(result);

        setEvaluation(evalData);
        const updatedResult: ExamResult = {
          ...result,
          aiEvaluation: evalData,
        };
        updateStoredSubmission(updatedResult);
        saveEvaluationMistakes(evalData, updatedResult);

        if (user && result.id) {
          try {
            const { error } = await updateSubmissionAiFeedback(result.id, user.id, evalData);
            if (error) throw error;
          } catch (dbErr) {
            console.warn('Could not sync AI evaluation to Supabase:', dbErr);
            setEvalError('Évaluation enregistrée dans ce navigateur. Synchronisation du compte échouée : ' + (dbErr instanceof Error ? dbErr.message : String(dbErr)));
          }
        }
      }
    } catch (err: any) {
      console.error('Error during AI evaluation:', err);
      setEvalError(err?.message || "Une erreur est survenue lors de l'évaluation avec l'IA.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleCopyAll = () => {
    const fullText = `TCF CANADA - EXPRESSION ÉCRITE
Combinaison ${result.combination.combinationNumber} (${result.month} ${result.year})
Temps utilisé : ${formatTime(result.timeUsedSeconds)}

--- TÂCHE 1 (${result.wordCounts.task1} mots / 60-120) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task1.instruction)}

Réponse :
${result.answers.task1 || '(Aucune réponse)'}

--- TÂCHE 2 (${result.wordCounts.task2} mots / 120-150) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task2.instruction)}

Réponse :
${result.answers.task2 || '(Aucune réponse)'}

--- TÂCHE 3 (${result.wordCounts.task3} mots / 120-180) ---
Consigne : ${normalizeParagraphText(result.combination.tasks.task3.title || result.combination.tasks.task3.instruction)}
${result.combination.tasks.task3.document1 ? `Document - 1 :\n${cleanDocumentText(result.combination.tasks.task3.document1)}\n\n` : ''}${result.combination.tasks.task3.document2 ? `Document - 2 :\n${cleanDocumentText(result.combination.tasks.task3.document2)}\n\n` : ''}
Réponse :
${result.answers.task3 || '(Aucune réponse)'}
`;
    navigator.clipboard.writeText(fullText);
    setCopiedTask('all');
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const handleCopy = (taskKey: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTask(taskKey);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const practiceKeys: TaskKey[] = result.practiceTasks && result.practiceTasks.length > 0
    ? result.practiceTasks
    : typeof result.practiceTask === 'string'
    ? (result.practiceTask.split(',').map((s) => s.trim()).filter(Boolean) as TaskKey[])
    : result.practiceTask
    ? [result.practiceTask as TaskKey]
    : [];

  const isPractice = !!result.isPracticeMode && practiceKeys.length > 0;

  const allTasksList = [
    { key: 'task1' as TaskKey, name: 'Tâche 1', req: result.combination.tasks.task1 },
    { key: 'task2' as TaskKey, name: 'Tâche 2', req: result.combination.tasks.task2 },
    { key: 'task3' as TaskKey, name: 'Tâche 3', req: result.combination.tasks.task3 }
  ];

  const tasksList = isPractice
    ? allTasksList.filter((t) => practiceKeys.includes(t.key))
    : allTasksList;

  const practiceTitle = practiceKeys
    .map((k) => t(k === 'task1' ? 'Tâche 1' : k === 'task2' ? 'Tâche 2' : 'Tâche 3'))
    .join(' + ');

  const handleCopyPracticed = () => {
    let fullText = `TCF CANADA - ENTRAÎNEMENT PRATIQUE
Combinaison ${result.combination.combinationNumber} (${result.month} ${result.year})
Temps utilisé : ${formatTime(result.timeUsedSeconds)}${result.allocatedMinutes ? ` / ${result.allocatedMinutes} min` : ''}
`;
    tasksList.forEach((tItem) => {
      const ans = result.answers[tItem.key] || '(Aucune réponse)';
      const wc = result.wordCounts[tItem.key];
      fullText += `\n--- ${tItem.name.toUpperCase()} (${wc} mots / ${tItem.req.minWords}-${tItem.req.maxWords}) ---\n`;
      fullText += `Consigne : ${normalizeParagraphText(tItem.req.title || tItem.req.instruction)}\n`;
      if (tItem.req.document1) fullText += `Document 1 :\n${cleanDocumentText(tItem.req.document1)}\n\n`;
      if (tItem.req.document2) fullText += `Document 2 :\n${cleanDocumentText(tItem.req.document2)}\n\n`;
      fullText += `Réponse :\n${ans}\n`;
    });

    navigator.clipboard.writeText(fullText);
    setCopiedTask('practiced_all');
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const isSinglePractice = isPractice && practiceKeys.length === 1;
  const singleTaskObj = tasksList[0] || allTasksList[0];
  const singleCount = result.wordCounts[singleTaskObj.key];
  const singleMin = singleTaskObj.req.minWords;
  const singleMax = singleTaskObj.req.maxWords;
  const isSingleWithin = singleCount >= singleMin && singleCount <= singleMax;

  return (
    <div className={`flex flex-col ${hideHeader ? 'w-full' : 'min-h-screen bg-slate-50'}`}>
      {!hideHeader && (
        <Header
          onHomeClick={onHomeClick}
          onDashboardClick={onDashboardClick}
          onFeedbackClick={onFeedbackClick}
          userEmail={user?.email}
          subtitle={isPractice ? t("Compte-rendu d'entraînement") : t("Compte-rendu de votre session")}
          combinationTitle={`${t('Combinaison')} ${result.combination.combinationNumber} — ${t(result.month)} ${result.year}`}
        />
      )}

      <div className="w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8 flex-1">
        {/* Main Summary Card */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-6 mb-8">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  {isPractice ? t('Entraînement Pratique') : t('Examen Complet')}
                </span>

                {isPractice && (
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                    {practiceKeys.map((k) => `T${k.slice(-1)}`).join(' + ')}
                  </span>
                )}

                <span className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded">
                  {t('Combinaison')} {result.combination.combinationNumber} • {t(result.month)} {result.year}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                {isPractice
                  ? `${t('Entraînement terminé')} : ${practiceTitle}`
                  : (language === 'en' ? 'Full mock completed' : 'Examen blanc terminé')}
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-500">
                {isPractice
                  ? t("Voici le récapitulatif de votre session. Vous pouvez copier votre texte pour l'évaluer ou le conserver.")
                  : t("Voici le récapitulatif complet de vos réponses pour évaluation avec votre tuteur.")}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
              {(!evaluation || !evaluation.pedagogical) && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartEvaluation()}
                    disabled={evaluating}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <span>{isDualAvailable ? '⚡🤖' : '🤖'}</span>
                    <span>
                      {evaluating
                        ? t('Évaluation en cours...')
                        : isDualAvailable
                        ? (language === 'en' ? 'Dual AI Evaluation (Gemini + Groq)' : 'Évaluation Double (Gemini + Groq)')
                        : t('Évaluer avec l’IA (Coach TCF)')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfigureKeys}
                    title={language === 'en' ? 'Configure Gemini / Groq API Keys' : 'Configurer les clés Gemini / Groq'}
                    className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    ⚙️
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={isPractice ? handleCopyPracticed : handleCopyAll}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>📋</span>
                <span>
                  {copiedTask === (isPractice ? 'practiced_all' : 'all')
                    ? t('Copié !')
                    : isPractice
                    ? t('Copier mes rédactions')
                    : t('Copier tout')}
                </span>
              </button>
            </div>
          </div>

          <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5" aria-label={language === 'en' ? 'Get your estimated NCLC' : 'Obtenir votre NCLC estimé'}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl"><p className="studio-eyebrow">{language === 'en' ? 'FULL-MOCK READINESS' : 'BILAN DE L’EXAMEN BLANC'}</p><h2 className="text-xl font-semibold mt-2">{language === 'en' ? 'Get your estimated NCLC writing range' : 'Obtenir votre plage NCLC estimée en expression écrite'}</h2>
                <p className="text-sm mt-3 leading-7">{language === 'en' ? 'Complete all three tasks, keep each response within its word range, and include both Task 3 documents. The assessor reviews the full set and explains an estimated NCLC range. Your practice /20 score is not converted into NCLC.' : 'Complétez les trois tâches dans les plages de mots demandées, avec les deux documents de la tâche 3. L’IA examine l’ensemble et justifie une plage NCLC estimée. La note pédagogique sur 20 n’est pas convertie en NCLC.'}</p>
                {!nclcEligibility.eligible && <p className="text-sm mt-3 font-medium" role="status">{language === 'en' ? nclcEligibility.reason_en : nclcEligibility.reason_fr}</p>}
                {nclcEstimate && <p className="text-lg font-semibold mt-3">NCLC {nclcEstimate.lower === 3 ? '<4' : nclcEstimate.lower}–{nclcEstimate.upper === 10 ? '10+' : nclcEstimate.upper} · {language === 'en' ? 'AI estimate' : 'estimation IA'}</p>}
              </div>
              <button type="button" className="studio-primary" disabled={evaluating || !nclcEligibility.eligible} onClick={handleStartEvaluation}>{evaluating ? (language === 'en' ? 'Assessing…' : 'Analyse en cours…') : nclcEstimate ? (language === 'en' ? 'Reassess NCLC' : 'Réévaluer le NCLC') : (language === 'en' ? 'Estimate NCLC' : 'Estimer le NCLC')}</button>
            </div>
            {evaluation?.nclc_crosscheck && <NclcCrosscheck comparison={evaluation.nclc_crosscheck}/> }
            <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">{language === 'en' ? 'How this estimate works' : 'Comment fonctionne cette estimation'}</summary><ol className="list-decimal pl-5 mt-3 space-y-2 leading-7"><li>{language === 'en' ? 'Choose Full Exam in the library, write all three responses, then finish the session.' : 'Choisissez Examen complet dans la bibliothèque, rédigez les trois réponses, puis terminez la séance.'}</li><li>{language === 'en' ? 'Click Estimate NCLC. This runs a new AI review using the configured provider(s).' : 'Cliquez sur Estimer le NCLC : une nouvelle analyse utilise le ou les modèles configurés.'}</li><li>{language === 'en' ? 'Read the range and its evidence. If both models run, compare their separate judgments; disagreement is not averaged away.' : 'Lisez la plage et sa justification. Avec deux modèles, comparez leurs jugements distincts : les désaccords ne sont pas masqués par une moyenne.'}</li></ol><p className="mt-3 text-xs text-slate-600">{language === 'en' ? 'This is an uncalibrated practice estimate, not an official result or a guarantee. The assessor can withhold it when serious task-fulfilment risks remain.' : 'Estimation de pratique non calibrée, sans valeur officielle ni garantie. L’IA peut la suspendre en présence de risques importants de non-respect des consignes.'}</p></details>
          </section>

          {/* Evaluating Loading State Indicator */}
          {evaluating && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-3 animate-pulse">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
              <div className="text-xs text-indigo-900">
                <p className="font-bold">
                  {isDualAvailable
                    ? (language === 'en' ? 'Dual AI review in progress (Gemini 2.5 + Groq Llama 3.3)...' : 'Évaluation double en cours (Gemini 2.5 + Groq Llama 3.3 en parallèle)...')
                    : t("Lecture pédagogique en cours...")}
                </p>
                <p className="text-indigo-700 mt-0.5">{t("Deux passes de lecture : communication, puis maîtrise de la langue. Aucun score officiel ni niveau NCLC ne sera attribué.")}</p>
              </div>
            </div>
          )}

          {/* AI Evaluation Error Alert */}
          {evalError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold">⚠️ {t("Erreur lors de l'évaluation :")}</p>
                <p className="mt-0.5">{evalError}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleConfigureKeys}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('Clés API')}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEvaluation()}
                  className="px-2.5 py-1 bg-white border border-red-300 rounded font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  {t('Réessayer')}
                </button>
              </div>
            </div>
          )}

          {/* Unified Clean Stats Grid */}
          <div className="mb-6 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className={`grid gap-3 ${
              isSinglePractice
                ? 'grid-cols-1 sm:grid-cols-3'
                : (isPractice && tasksList.length === 2)
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {/* Card 1: Time */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t('Temps utilisé')}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                    {formatTime(result.timeUsedSeconds)}
                    <span className="text-xs text-slate-400 font-normal font-sans">
                      / {result.allocatedMinutes || 60} min
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                  <span className="font-semibold text-slate-600 flex items-center gap-1 shrink-0">
                    ⏱️ {isPractice ? t('Entraînement') : t('Conditions réelles')}
                  </span>
                  <span className="text-slate-400 font-medium shrink-0">
                    {result.allocatedMinutes || 60} min
                  </span>
                </div>
              </div>

              {/* If Single Task Practice: Card 2 = Words, Card 3 = Objective */}
              {isSinglePractice ? (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {t('Nombre de mots')}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                        {singleCount} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span
                        className={`font-bold px-2 py-0.5 rounded border inline-flex items-center shrink-0 ${
                          isSingleWithin
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}
                      >
                        {isSingleWithin ? t('✓ Conforme') : t('⚠️ Non conforme')}
                      </span>
                      <span className="text-slate-400 font-medium font-mono shrink-0">
                        {singleMin}–{singleMax} {t('mots')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {t('Objectif exigé')}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                        {singleMin}–{singleMax} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <span className="text-slate-600 font-medium truncate">
                        {t(singleTaskObj.name)}
                      </span>
                      <span className="text-emerald-700 font-bold shrink-0">
                        TCF Canada
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Multi-Task Practice (2 or 3 tasks) OR Full Exam */
                (isPractice ? tasksList : allTasksList).map((tItem) => {
                  const count = result.wordCounts[tItem.key] || 0;
                  const min = tItem.req.minWords;
                  const max = tItem.req.maxWords;
                  const isWithin = count >= min && count <= max;

                  return (
                    <div key={tItem.key} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {t(tItem.name)}
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                          {count} <span className="text-xs text-slate-500 font-normal font-sans">{t('mots')}</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                        <span
                          className={`font-bold px-2 py-0.5 rounded border text-[10px] sm:text-[11px] inline-flex items-center shrink-0 ${
                            isWithin
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}
                        >
                          {isWithin ? t('✓ Conforme') : t('⚠️ Non conforme')}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] sm:text-[11px] shrink-0">
                          {min}–{max} {t('mots')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* AI Evaluation View Component */}
          {(dualResult || evaluation) && (
            <div className="mb-8 space-y-4">
              <div className="p-3 sm:p-4 rounded-xl bg-purple-50/90 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs text-purple-900">
                  <span className="text-base shrink-0">📝</span>
                  <p className="font-medium">
                    {language === 'en'
                      ? 'Mistakes from this evaluation are saved to your Mistakes Bank in the Dashboard.'
                      : 'Les fautes de cette évaluation sont enregistrées dans votre carnet de fautes (Tableau de bord).'}
                  </p>
                </div>
                {onDashboardClick && (
                  <button
                    type="button"
                    onClick={onDashboardClick}
                    className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 hover:bg-purple-100/80 text-purple-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1"
                  >
                    <span>{language === 'en' ? 'Open Mistakes Bank' : 'Ouvrir mon carnet'}</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              {dualResult ? (
                <DualEvaluationView
                  gemini={dualResult.gemini}
                  groq={dualResult.groq}
                  geminiError={dualResult.geminiError}
                  groqError={dualResult.groqError}
                />
              ) : evaluation ? (
                <AIEvaluationView
                  evaluation={evaluation}
                  combination={result.combination}
                  userAnswers={result.answers}
                  wordCounts={result.wordCounts}
                />
              ) : null}
            </div>
          )}

          {/* Individual Tasks Display (shown before AI evaluation is triggered) */}
          {!evaluation && !dualResult && (
            <div className="space-y-6">
              {tasksList.map((tItem) => {
                const text = result.answers[tItem.key];
                const count = result.wordCounts[tItem.key];
                const min = tItem.req.minWords;
                const max = tItem.req.maxWords;
                const isWithin = count >= min && count <= max;

                return (
                  <div key={tItem.key} className="border border-slate-300 rounded p-4 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <h3 className="font-bold text-slate-800 text-base">
                        {t(tItem.name)}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold border ${
                          isWithin
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 text-red-600 border-red-300'
                        }`}>
                          {count} / {min}-{max} {t('mots')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(tItem.key, `Sujet: ${tItem.req.instruction || tItem.req.title}\n\nRéponse:\n${text}`)}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded"
                        >
                          {copiedTask === tItem.key ? t('Copié !') : t('Copier cette tâche')}
                        </button>
                      </div>
                    </div>

                    {/* Task Instruction / Documents */}
                    <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-3 leading-relaxed">
                      {tItem.req.title && (
                        <div className="font-bold text-sm text-blue-700 mb-2">
                          {normalizeParagraphText(tItem.req.title)}
                        </div>
                      )}
                      {tItem.key !== 'task3' && (
                        <div>
                          <strong>{t('Consigne :')}</strong> {normalizeParagraphText(tItem.req.instruction)}
                        </div>
                      )}
                      {tItem.req.document1 && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                          <strong className="text-slate-900 block mb-1">{t('Document 1 :')}</strong>
                          <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(tItem.req.document1)}</p>
                        </div>
                      )}
                      {tItem.req.document2 && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                          <strong className="text-slate-900 block mb-1">{t('Document 2 :')}</strong>
                          <p className="whitespace-pre-line text-slate-700">{cleanDocumentText(tItem.req.document2)}</p>
                        </div>
                      )}
                    </div>

                    {/* User Response Text */}
                    <div className="bg-slate-50 border border-slate-200 rounded p-4 font-sans text-sm leading-relaxed text-slate-900 whitespace-pre-wrap min-h-[100px]">
                      {text ? text : <span className="italic text-slate-400">{t('Aucune réponse rédigée.')}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                onHomeClick();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded bg-blue-600 border border-blue-700 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              {t("Retour à l'accueil")}
            </button>

            {onFeedbackClick && (
              <button
                type="button"
                onClick={onFeedbackClick}
                className="w-full sm:w-auto px-4 py-2 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-xs hover:bg-blue-100 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>💌</span>
                <span>{t('Un mot pour le développeur / Feedback')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer onFeedbackClick={onFeedbackClick} />
    </div>
  );
};
