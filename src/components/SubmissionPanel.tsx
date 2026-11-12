import React from 'react';
import { CharacterPanel } from './CharacterPanel';
import { formatTime } from '../utils/wordCount';
import { useLanguage } from '../context/LanguageContext';

interface SubmissionPanelProps {
  timeRemainingSeconds: number;
  wordCounts: { task1: number; task2: number; task3: number };
  onInsertCharacter: (char: string) => void;
  isPracticeMode?: boolean;
  practiceTask?: string;
  practiceTasks?: ('task1' | 'task2' | 'task3')[];
}

export const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  timeRemainingSeconds,
  wordCounts,
  onInsertCharacter,
  isPracticeMode = false,
  practiceTask,
  practiceTasks
}) => {
  const { t } = useLanguage();
  const isUrgent = timeRemainingSeconds < 300; // less than 5 min

  const allConditions = [
    {
      key: 'task1',
      name: 'Tâche 1',
      min: 60,
      max: 120,
      count: wordCounts.task1
    },
    {
      key: 'task2',
      name: 'Tâche 2',
      min: 120,
      max: 150,
      count: wordCounts.task2
    },
    {
      key: 'task3',
      name: 'Tâche 3',
      min: 120,
      max: 180,
      count: wordCounts.task3
    }
  ];

  const activeFilterList = practiceTasks && practiceTasks.length > 0
    ? practiceTasks
    : typeof practiceTask === 'string'
    ? (practiceTask.split(',') as ('task1' | 'task2' | 'task3')[])
    : practiceTask
    ? [practiceTask as ('task1' | 'task2' | 'task3')]
    : null;

  const conditions = isPracticeMode && activeFilterList
    ? allConditions.filter((c) => activeFilterList.includes(c.key as any))
    : allConditions;

  return (
    <div className="bg-slate-50 border-l border-slate-300 w-72 shrink-0 p-3 flex flex-col gap-4 overflow-y-auto select-none">
      {/* Timer Section */}
      <div>
        <h3 className="font-semibold text-slate-800 border-b border-slate-300 pb-1 mb-2 text-xs uppercase tracking-wide">
          {t('Temps restant')}
        </h3>
        <div
          className={`flex items-center gap-2 text-xl font-bold font-mono px-3 py-2 rounded border bg-white ${
            isUrgent
              ? 'text-red-600 border-red-300 animate-pulse'
              : 'text-slate-800 border-slate-300'
          }`}
        >
          <span className="text-red-500">🔴</span>
          <span>{formatTime(timeRemainingSeconds)}</span>
        </div>
      </div>

      {/* Tableau de caractere */}
      <CharacterPanel onInsertCharacter={onInsertCharacter} />

      {/* Conditions de soumission */}
      <div className="bg-white border border-slate-300 rounded p-3 text-xs">
        <h3 className="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">
          {t('Conditions de soumission')}
        </h3>
        <div className="space-y-3">
          {conditions.map((c) => {
            const isWithin = c.count >= c.min && c.count <= c.max;
            const isTooLow = c.count < c.min;
            return (
              <div key={c.key} className="border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                <div className="font-semibold text-slate-700 flex justify-between items-center mb-1">
                  <span>{t(c.name)}:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded font-bold text-[11px] border ${
                      isWithin
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-red-50 text-red-600 border-red-300'
                    }`}
                  >
                    {c.count} / {c.min}-{c.max}
                  </span>
                </div>
                <div
                  className={`text-[11px] font-semibold ${
                    isWithin ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {isWithin ? (
                    t('✓ Nombre de mots conforme')
                  ) : isTooLow ? (
                    `${t('⚠️ Nombre de mots insuffisant')} (${c.count}/${c.min}-${c.max})`
                  ) : (
                    `${t('⚠️ Limite dépassée')} (${c.count}/${c.max})`
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
