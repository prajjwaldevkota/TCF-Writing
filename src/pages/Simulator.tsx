import React, { useState, useEffect, useCallback } from 'react';
import { ExamCombination, ExamAnswers, TaskKey, ExamResult } from '../types/exam';
import { useExamTimer } from '../hooks/useExamTimer';
import { TaskSidebar } from '../components/TaskSidebar';
import { TaskEditor } from '../components/TaskEditor';
import { SubmissionPanel } from '../components/SubmissionPanel';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { countFrenchWords, formatTime } from '../utils/wordCount';
import { CharacterPanel } from '../components/CharacterPanel';
import { Header } from '../components/Header';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface SimulatorProps {
  combination: ExamCombination;
  year: string;
  month: string;
  onFinishExam: (result: ExamResult) => void;
  onCancelExam: () => void;
  isPracticeMode?: boolean;
  practiceTask?: TaskKey | string;
  practiceTasks?: TaskKey[];
  durationMinutes?: number;
  hideHeader?: boolean;
}

export const Simulator: React.FC<SimulatorProps> = ({
  combination,
  year,
  month,
  onFinishExam,
  onCancelExam,
  isPracticeMode = false,
  practiceTask = 'task1',
  practiceTasks,
  durationMinutes = 60,
  hideHeader = false
}) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const allowCopyPaste = Boolean(
    isAdmin || (typeof window !== 'undefined' && localStorage.getItem('tcf_admin_logged_in') === 'true')
  );

  useEffect(() => {
    if (allowCopyPaste) {
      document.body.classList.remove('select-none');
    }
  }, [allowCopyPaste]);

  const activeTaskKeys: TaskKey[] = isPracticeMode && practiceTasks && practiceTasks.length > 0
    ? practiceTasks
    : isPracticeMode && practiceTask
    ? (typeof practiceTask === 'string' ? (practiceTask.split(',') as TaskKey[]) : [practiceTask])
    : ['task1', 'task2', 'task3'];

  const initialTask: TaskKey = activeTaskKeys[0] || 'task1';
  const [activeTask, setActiveTask] = useState<TaskKey>(initialTask);
  const [isMobileAccentsOpen, setIsMobileAccentsOpen] = useState<boolean>(false);
  const [answers, setAnswers] = useState<ExamAnswers>({
    task1: '',
    task2: '',
    task3: ''
  });
  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);

  const initialDurationMinutes = isPracticeMode ? (durationMinutes || 15) : 60;
  const initialDurationSeconds = initialDurationMinutes * 60;

  const draftKey = isPracticeMode
    ? `tcf_practice_${activeTaskKeys.join('_')}_${combination.combinationNumber}_${year}_${month}`
    : `tcf_draft_${combination.combinationNumber}_${year}_${month}`;

  // Load draft from localStorage if present
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        setAnswers(JSON.parse(savedDraft));
      }
    } catch (e) {}
  }, [draftKey]);

  const wordCounts = {
    task1: countFrenchWords(answers.task1),
    task2: countFrenchWords(answers.task2),
    task3: countFrenchWords(answers.task3)
  };

  const handleTimerExpire = useCallback(() => {
    localStorage.removeItem(draftKey);
    onFinishExam({
      combination,
      year,
      month,
      timeUsedSeconds: initialDurationSeconds,
      answers,
      wordCounts: {
        task1: countFrenchWords(answers.task1),
        task2: countFrenchWords(answers.task2),
        task3: countFrenchWords(answers.task3)
      },
      isPracticeMode,
      practiceTask: activeTaskKeys.join(','),
      practiceTasks: activeTaskKeys,
      allocatedMinutes: initialDurationMinutes
    });
  }, [combination, year, month, answers, onFinishExam, draftKey, isPracticeMode, activeTaskKeys, initialDurationMinutes, initialDurationSeconds]);

  const { secondsRemaining, timeUsedSeconds, isFinished } = useExamTimer({
    initialMinutes: initialDurationMinutes,
    onExpire: handleTimerExpire
  });

  const handleUpdateAnswer = (val: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [activeTask]: val };
      try {
        localStorage.setItem(draftKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleInsertCharacter = (char: string) => {
    const activeTextarea = document.querySelector('textarea');
    if (activeTextarea) {
      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      const text = activeTextarea.value;
      const newText = text.substring(0, start) + char + text.substring(end);
      handleUpdateAnswer(newText);
      
      setTimeout(() => {
        activeTextarea.focus();
        activeTextarea.setSelectionRange(start + char.length, start + char.length);
      }, 0);
    } else {
      handleUpdateAnswer(answers[activeTask] + char);
    }
  };

  const taskKeys: TaskKey[] = activeTaskKeys;
  const currentIndex = taskKeys.indexOf(activeTask);

  const handlePrevTask = () => {
    if (currentIndex > 0) {
      setActiveTask(taskKeys[currentIndex - 1]);
    }
  };

  const handleNextTask = () => {
    if (currentIndex < taskKeys.length - 1) {
      setActiveTask(taskKeys[currentIndex + 1]);
    }
  };

  const confirmFinish = () => {
    localStorage.removeItem(draftKey);
    setIsFinishModalOpen(false);
    onFinishExam({
      combination,
      year,
      month,
      timeUsedSeconds,
      answers,
      wordCounts,
      isPracticeMode,
      practiceTask: activeTaskKeys.join(','),
      practiceTasks: activeTaskKeys,
      allocatedMinutes: initialDurationMinutes
    });
  };

  const practiceTitleLabel = activeTaskKeys.map((k) => t(`Tâche ${k.slice(-1)}`)).join(' + ');

  return (
    <div className={`flex flex-col bg-white dark:bg-gray-900 ${hideHeader ? 'h-full w-full' : 'h-screen w-screen'} overflow-hidden ${allowCopyPaste ? 'select-text' : 'select-none'}`}>
      {/* Header */}
      {!hideHeader && (
        <Header
          onHomeClick={onCancelExam}
          subtitle={
            isPracticeMode
              ? `${t('Entraînement')} — ${practiceTitleLabel}`
              : t("Examen en cours")
          }
          combinationTitle={`${t('Combinaison')} ${combination.combinationNumber} — ${t(month)} ${year}`}
        />
      )}

      {/* Mobile Exam Navigation Bar (lg:hidden) */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-1.5 shrink-0 shadow-2xs select-none">
        {/* Task Switcher Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0">
          {activeTaskKeys.map((k) => {
            const num = k.slice(-1);
            const isActive = activeTask === k;
            const count = wordCounts[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveTask(k)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>T{num}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Timer & Accents Sheet Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded border ${
              secondsRemaining < 300
                ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <span>⏱️</span>
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileAccentsOpen(true)}
            className="p-1 px-2 rounded bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            title={t('Tableau de caractères & Conditions')}
          >
            <span>⌨️</span>
            <span className="hidden xs:inline">{t('Accents')}</span>
          </button>
        </div>
      </div>

      {/* Main Exam Grid */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar: Task Navigation (Desktop) */}
        <div className="hidden lg:flex shrink-0">
          <TaskSidebar
            activeTask={activeTask}
            onSelectTask={setActiveTask}
            wordCounts={wordCounts}
            isPracticeMode={isPracticeMode}
            practiceTask={activeTaskKeys.join(',')}
            practiceTasks={activeTaskKeys}
          />
        </div>

        {/* Center: Active Task Editor */}
        <TaskEditor
          taskKey={activeTask}
          taskRequirement={combination.tasks[activeTask]}
          value={answers[activeTask]}
          onChange={handleUpdateAnswer}
          onPrevTask={handlePrevTask}
          onNextTask={handleNextTask}
          onFinishExam={() => setIsFinishModalOpen(true)}
          isFirstTask={currentIndex === 0}
          isLastTask={currentIndex === taskKeys.length - 1}
          disabled={isFinished}
          isPracticeMode={isPracticeMode}
          onInsertCharacter={handleInsertCharacter}
        />

        {/* Right Sidebar: Timer, Accent Keyboard, Submission Conditions (Desktop) */}
        <div className="hidden lg:flex shrink-0">
          <SubmissionPanel
            timeRemainingSeconds={secondsRemaining}
            wordCounts={wordCounts}
            onInsertCharacter={handleInsertCharacter}
            isPracticeMode={isPracticeMode}
            practiceTask={activeTaskKeys.join(',')}
            practiceTasks={activeTaskKeys as any}
          />
        </div>
      </div>

      {/* Mobile Accents & Checklist Bottom Sheet */}
      {isMobileAccentsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileAccentsOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl shadow-2xl p-4 max-h-[82vh] overflow-y-auto z-10 space-y-4 animate-slideInUp border-t border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span>⌨️</span>
                <span>{t('Caractères français & Conditions')}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileAccentsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <CharacterPanel onInsertCharacter={handleInsertCharacter} />

            {/* Word count condition list */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
              <div className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                {t('Conditions de soumission')}
              </div>
              {activeTaskKeys.map((k) => {
                const req = combination.tasks[k];
                const count = wordCounts[k];
                const isWithin = count >= req.minWords && count <= req.maxWords;
                return (
                  <div key={k} className="flex items-center justify-between py-1 border-b border-slate-200 last:border-b-0">
                    <span className="font-semibold text-slate-700">{t(`Tâche ${k.slice(-1)}`)}:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      isWithin ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {count} / {req.minWords}-{req.maxWords} {t('mots')}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileAccentsOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
            >
              {t('Fermer et continuer')}
            </button>
          </div>
        </div>
      )}

      {/* Finish Confirmation Modal */}
      <ConfirmationModal
        isOpen={isFinishModalOpen}
        title={isPracticeMode ? "Terminer cet entraînement ?" : "Voulez-vous vraiment terminer l'examen ?"}
        message={
          isPracticeMode
            ? "Vous ne pourrez plus modifier votre réponse pour cette tâche."
            : "Vous ne pourrez plus modifier vos réponses une fois la soumission validée."
        }
        confirmLabel={isPracticeMode ? "Terminer l'entraînement" : "Terminer"}
        cancelLabel="Annuler"
        onConfirm={confirmFinish}
        onCancel={() => setIsFinishModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
};
