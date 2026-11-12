import React, { useState, useEffect, useRef } from 'react';
import { TaskKey, TaskRequirement } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';
import { cleanDocumentText, fixMojibake, normalizeParagraphText } from '../utils/cleanText';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface TaskEditorProps {
  taskKey: TaskKey;
  taskRequirement: TaskRequirement;
  value: string;
  onChange: (val: string) => void;
  onPrevTask: () => void;
  onNextTask: () => void;
  onFinishExam: () => void;
  isFirstTask: boolean;
  isLastTask: boolean;
  disabled?: boolean;
  isPracticeMode?: boolean;
  onInsertCharacter?: (char: string) => void;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({
  taskKey,
  taskRequirement,
  value,
  onChange,
  onPrevTask,
  onNextTask,
  onFinishExam,
  isFirstTask,
  isLastTask,
  disabled = false,
  isPracticeMode = false,
  onInsertCharacter
}) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState<boolean>(true);
  const wordCount = countFrenchWords(value);

  // Allow copy/cut/paste and keyboard shortcuts exclusively for Admin
  const allowCopyPaste = Boolean(
    isAdmin || (typeof window !== 'undefined' && localStorage.getItem('tcf_admin_logged_in') === 'true')
  );

  // Keep focus on textarea when task changes
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [taskKey, disabled]);

  const taskNumberMap: Record<TaskKey, number> = {
    task1: 1,
    task2: 2,
    task3: 3
  };

  const taskTypeMap: Record<TaskKey, string> = {
    task1: 'Description / Message',
    task2: 'Narration / Récit',
    task3: 'Argumentation'
  };

  const isWithinRange = wordCount >= taskRequirement.minWords && wordCount <= taskRequirement.maxWords;
  const isTooLow = wordCount < taskRequirement.minWords;
  const isTooHigh = wordCount > taskRequirement.maxWords;

  const doc1Clean = cleanDocumentText(taskRequirement.document1);
  const doc2Clean = cleanDocumentText(taskRequirement.document2);
  const task3Title = normalizeParagraphText(taskRequirement.title || taskRequirement.instruction || '');

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-slate-300">
      {/* Banner if Timer Finished */}
      {disabled && (
        <div className="bg-red-600 text-white font-bold text-xs px-4 py-2 flex items-center justify-between shadow-xs shrink-0">
          <span>{t("⏱️ Temps écoulé ! La rédaction est désormais bloquée.")}</span>
          <span>{t('Veuillez cliquer sur "Terminer l\'examen" ci-dessous.')}</span>
        </div>
      )}

      {/* Task Prompt Area */}
      <div className={`p-3 sm:p-5 border-b border-slate-300 bg-slate-50 transition-all ${
        isPromptExpanded ? 'max-h-[34vh] sm:max-h-[46vh]' : 'max-h-14 sm:max-h-[46vh]'
      } overflow-y-auto ${allowCopyPaste ? 'select-text' : ''}`}>
        {/* Header Bar matching Reference Website */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-2xs">
              {taskNumberMap[taskKey]}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              {t(`Tâche ${taskNumberMap[taskKey]}`)}
            </h2>

            {/* Mobile Prompt Toggle */}
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="sm:hidden text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer ml-1"
            >
              {isPromptExpanded ? t('▲ Réduire') : t('▼ Sujet')}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>{t(taskTypeMap[taskKey])}</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{taskRequirement.minWords}-{taskRequirement.maxWords} {t('mots')}</span>
          </div>
        </div>

        {/* Task Content */}
        {taskKey === 'task3' ? (
          <div className="space-y-3">
            {/* Centered Large Blue Title */}
            {task3Title && (
              <h3 className="text-center text-lg sm:text-xl font-extrabold text-blue-600 my-3 leading-snug">
                {task3Title}
              </h3>
            )}

            {/* Document 1 Card */}
            {doc1Clean && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-4.5 text-slate-800 text-sm leading-relaxed shadow-2xs hover:border-slate-300 transition-colors">
                <div className="font-bold text-xs text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  <span>{t('Document 1 :').replace(' :', '')}</span>
                </div>
                <p className="whitespace-pre-line text-slate-800">{doc1Clean}</p>
              </div>
            )}

            {/* Document 2 Card */}
            {doc2Clean && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-4.5 text-slate-800 text-sm leading-relaxed shadow-2xs hover:border-slate-300 transition-colors">
                <div className="font-bold text-xs text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  <span>{t('Document 2 :').replace(' :', '')}</span>
                </div>
                <p className="whitespace-pre-line text-slate-800">{doc2Clean}</p>
              </div>
            )}
          </div>
        ) : (
          /* Task 1 & Task 2 Instructions */
          <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-line border-l-4 border-blue-600 pl-3.5 py-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
            {normalizeParagraphText(taskRequirement.instruction) || t("Veuillez rédiger votre texte ci-dessous.")}
          </div>
        )}
      </div>

      {/* Writing Textarea Area */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col relative bg-white min-h-0">
        {/* Mobile Quick Accents Ribbon */}
        <div className="sm:hidden flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 mb-1.5 border-b border-slate-100 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            {t('Accents')} :
          </span>
          {['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ô', 'ù', 'û', 'ç', 'œ', '«', '»'].map((char) => (
            <button
              key={char}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (onInsertCharacter) {
                  onInsertCharacter(char);
                } else if (textareaRef.current) {
                  const start = textareaRef.current.selectionStart ?? value.length;
                  const end = textareaRef.current.selectionEnd ?? value.length;
                  const nextVal = value.substring(0, start) + char + value.substring(end);
                  onChange(nextVal);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + char.length;
                      textareaRef.current.focus();
                    }
                  }, 0);
                }
              }}
              className="h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 active:bg-blue-100 text-slate-800 text-sm font-semibold border border-slate-200 shrink-0 cursor-pointer"
            >
              {char}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? t("Temps écoulé — Rédaction désactivée.") : t("Saisissez votre texte ici...")}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          onCopy={allowCopyPaste ? undefined : (e) => e.preventDefault()}
          onCut={allowCopyPaste ? undefined : (e) => e.preventDefault()}
          onPaste={allowCopyPaste ? undefined : (e) => e.preventDefault()}
          onDrop={allowCopyPaste ? undefined : (e) => e.preventDefault()}
          onContextMenu={allowCopyPaste ? undefined : (e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (allowCopyPaste) return;
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (isCtrlOrCmd) {
              const key = e.key.toLowerCase();
              // Block Ctrl/Cmd + A (select all), Z (undo), Y (redo), C (copy), V (paste), X (cut)
              if (['a', 'z', 'y', 'c', 'v', 'x'].includes(key)) {
                e.preventDefault();
              }
            }
          }}
          className={`w-full flex-1 p-3 border rounded focus:outline-none resize-none font-sans text-base leading-relaxed ${
            disabled
              ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
              : 'bg-white text-slate-900 border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
          } ${allowCopyPaste ? 'select-text' : ''}`}
        />
      </div>

      {/* Footer / Status Bar */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-slate-300 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-sm shrink-0">
        {/* Word Counter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`font-bold font-mono text-base px-2 py-0.5 rounded border ${
              isWithinRange
                ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                : 'text-red-600 bg-red-50 border-red-300'
            }`}>
              {wordCount}
            </span>
            <span className="text-slate-600 font-medium whitespace-nowrap">
              / ({taskRequirement.minWords}-{taskRequirement.maxWords} {t('mots')})
            </span>
          </div>

          {isWithinRange && (
            <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs px-2.5 py-0.5 rounded font-bold whitespace-nowrap">
              {t('✓ Nombre de mots conforme')}
            </span>
          )}

          {isTooLow && (
            <span className="bg-red-100 border border-red-300 text-red-800 text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap">
              {t('⚠️ Mots insuffisants')} ({wordCount}/{taskRequirement.minWords})
            </span>
          )}

          {isTooHigh && (
            <span className="bg-red-100 border border-red-300 text-red-800 text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap">
              {t('⚠️ Limite dépassée')} ({wordCount}/{taskRequirement.maxWords})
            </span>
          )}

          {allowCopyPaste && (
            <span
              title={t('Le copier-coller et les raccourcis clavier sont débloqués pour le compte administrateur.')}
              className="hidden sm:inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-800 text-xs px-2.5 py-0.5 rounded font-bold ml-1 shadow-2xs"
            >
              👑 {t('Admin : Copier-coller autorisé')}
            </span>
          )}
        </div>

        {/* Navigation & Submit Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!isPracticeMode && (
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={onPrevTask}
                disabled={isFirstTask}
                className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
                  isFirstTask
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {t('Précédent')}
              </button>

              <button
                type="button"
                onClick={onNextTask}
                disabled={isLastTask}
                className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
                  isLastTask
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {t('Suivant')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onFinishExam}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg bg-blue-600 border border-blue-700 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 transition-colors shadow-xs cursor-pointer text-center whitespace-nowrap ${
              !isPracticeMode ? 'sm:ml-2' : ''
            }`}
          >
            {isPracticeMode ? t("Terminer l'entraînement") : t("Terminer l'examen")}
          </button>
        </div>
      </div>
    </div>
  );
};
