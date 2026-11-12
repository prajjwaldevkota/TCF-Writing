import React, { useState, useEffect, useRef } from 'react';
import { QuestionsDB, ExamCombination, ExamResult, TaskKey } from '../types/exam';
import questionsData from '../data/questions.json';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { MistakesRevisionModal } from '../components/MistakesRevisionModal';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { UserProfileModal } from '../components/UserProfileModal';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase } from '../lib/supabase';
import {
  getStoredSubmissions,
  syncStoredSubmissions,
  mergeSubmissions
} from '../utils/storage';
import { getStoredMistakes } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';

export type TrainingMode = 'full_exam' | 'single_task';

interface HomeProps {
  onStartExam: (
    combo: ExamCombination,
    year: string,
    month: string,
    isPracticeMode?: boolean,
    practiceTask?: TaskKey | TaskKey[],
    durationMinutes?: number
  ) => void;
  onViewSubmission?: (result: ExamResult) => void;
  onDashboardClick?: () => void;
  onNavigateToMistakes?: () => void;
  onFeedbackClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  userEmail?: string | null;
  hideHeader?: boolean;
}

const FRENCH_MONTHS_ORDER = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

/**
 * Normalizes month names across French and English, removing accents and extra text
 * so "May 2026", "Mai", "May", "mai" all map cleanly to "mai".
 */
const normalizeMonth = (m?: string): string => {
  if (!m) return '';
  const firstWord = m.trim().split(/[\s_-]+/)[0];
  const cleaned = firstWord.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const MONTH_MAP: Record<string, string> = {
    january: 'janvier',
    janvier: 'janvier',
    february: 'fevrier',
    fevrier: 'fevrier',
    march: 'mars',
    mars: 'mars',
    april: 'avril',
    avril: 'avril',
    may: 'mai',
    mai: 'mai',
    june: 'juin',
    juin: 'juin',
    july: 'juillet',
    juillet: 'juillet',
    august: 'aout',
    aout: 'aout',
    september: 'septembre',
    septembre: 'septembre',
    october: 'octobre',
    octobre: 'octobre',
    november: 'novembre',
    novembre: 'novembre',
    december: 'decembre',
    decembre: 'decembre'
  };
  return MONTH_MAP[cleaned] || cleaned;
};

export const Home: React.FC<HomeProps> = ({
  onStartExam,
  onDashboardClick,
  onNavigateToMistakes,
  onFeedbackClick,
  onLoginClick,
  onLogoutClick,
  userEmail,
  hideHeader = false
}) => {
  const { user, userName, isConfigured } = useAuth();
  const { t } = useLanguage();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const db = questionsData as unknown as QuestionsDB;
  const years = Object.keys(db).sort((a, b) => Number(b) - Number(a));

  const [selectedYear, setSelectedYear] = useState<string>(years[0] || '2026');

  const getSortedMonthsForYear = (year: string): string[] => {
    if (!db[year]) return [];
    return Object.keys(db[year]).sort((a, b) => {
      const idxA = FRENCH_MONTHS_ORDER.indexOf(a);
      const idxB = FRENCH_MONTHS_ORDER.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  };

  const monthsForYear = getSortedMonthsForYear(selectedYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthsForYear[0] || '');

  const rawCombos = (db[selectedYear] && db[selectedYear][selectedMonth]) || [];
  const combinations = [...rawCombos].sort(
    (a, b) => (a.combinationNumber || 0) - (b.combinationNumber || 0)
  );

  const [selectedComboIndex, setSelectedComboIndex] = useState<number>(0);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('full_exam');
  const [selectedTasks, setSelectedTasks] = useState<TaskKey[]>(['task1']);
  const [customMinutes, setCustomMinutes] = useState<number>(15);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isMistakesModalOpen, setIsMistakesModalOpen] = useState<boolean>(false);
  const [currentMistakes, setCurrentMistakes] = useState<any[]>([]);
  const [pastSubmissions, setPastSubmissions] = useState<ExamResult[]>([]);
  const [comboDropdownOpen, setComboDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const TASK_DEFAULT_MINUTES: Record<TaskKey, number> = {
    task1: 15,
    task2: 20,
    task3: 30
  };

  const getRecommendedMinutes = (tasks: TaskKey[]): number => {
    return tasks.reduce((sum, t) => sum + (TASK_DEFAULT_MINUTES[t] || 0), 0);
  };

  const handleToggleTask = (task: TaskKey) => {
    let next: TaskKey[];
    if (selectedTasks.includes(task)) {
      if (selectedTasks.length === 1) {
        // Keep at least one task selected
        return;
      }
      next = selectedTasks.filter((t) => t !== task);
    } else {
      const all: TaskKey[] = ['task1', 'task2', 'task3'];
      next = all.filter((t) => t === task || selectedTasks.includes(t));
    }
    setSelectedTasks(next);
    setCustomMinutes(getRecommendedMinutes(next));
  };

  const handlePresetTasks = (tasks: TaskKey[]) => {
    setSelectedTasks(tasks);
    setCustomMinutes(getRecommendedMinutes(tasks));
  };

  const handlePickRandomCombo = () => {
    if (combinations.length > 0) {
      const randIdx = Math.floor(Math.random() * combinations.length);
      setSelectedComboIndex(randIdx);
      setComboDropdownOpen(false);
    }
  };

  // Ensure Home page loads from the top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setComboDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch submissions from Supabase and LocalStorage in the background
  // to power the combination completion indicators
  useEffect(() => {
    let isMounted = true;

    async function loadSubmissions() {
      const local = getStoredSubmissions();
      if (isMounted) {
        setPastSubmissions(local);
      }

      if (user && isConfigured) {
        try {
          const { submissions: dbSubs, error } = await fetchSubmissionsFromSupabase(user.id);
          if (!error && dbSubs && isMounted) {
            const merged = mergeSubmissions(dbSubs, local);
            setPastSubmissions(merged);
            syncStoredSubmissions(merged);
          }
        } catch (e) {
          console.error('Erreur lors du chargement des soumissions:', e);
        }
      }
    }

    loadSubmissions();

    return () => {
      isMounted = false;
    };
  }, [user, isConfigured]);

  const currentCombo: ExamCombination | undefined = combinations[selectedComboIndex] || combinations[0];

  // Helper: check if a combination has been submitted before
  const isCombinationCompleted = (comboNum: number): boolean => {
    return pastSubmissions.some((sub) => {
      if (!sub) return false;
      const matchYear = String(sub.year || '').trim() === String(selectedYear || '').trim();
      const matchMonth = normalizeMonth(sub.month) === normalizeMonth(selectedMonth);
      const subComboNum = Number(sub.combination?.combinationNumber ?? sub.combination?.combination);
      return matchYear && matchMonth && subComboNum === Number(comboNum);
    });
  };

  // Helper: count completed combinations for a given month
  const getCompletedCountForMonth = (monthName: string): number => {
    const finished = new Set<number>();
    pastSubmissions.forEach((sub) => {
      if (
        String(sub.year || '').trim() === String(selectedYear || '').trim() &&
        normalizeMonth(sub.month) === normalizeMonth(monthName)
      ) {
        const num = Number(sub.combination?.combinationNumber ?? sub.combination?.combination);
        if (!isNaN(num) && num > 0) finished.add(num);
      }
    });
    return finished.size;
  };

  const currentComboNum = currentCombo?.combinationNumber || selectedComboIndex + 1;
  const isCurrentComboDone = isCombinationCompleted(currentComboNum);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const sortedMonths = getSortedMonthsForYear(year);
    const firstMonth = sortedMonths[0] || '';
    setSelectedMonth(firstMonth);
    setSelectedComboIndex(0);
    setComboDropdownOpen(false);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setSelectedComboIndex(0);
    setComboDropdownOpen(false);
  };

  return (
    <div className={`flex flex-col justify-between ${hideHeader ? 'w-full' : 'min-h-screen bg-slate-50'}`}>
      {/* App Header */}
      {!hideHeader && (
        <Header
          onDashboardClick={onDashboardClick}
          onFeedbackClick={onFeedbackClick}
          onProfileClick={() => setShowProfileModal(true)}
          onLoginClick={onLoginClick}
          onLogoutClick={onLogoutClick}
          userEmail={userEmail}
        />
      )}

      {/* Main Container - Full Screen Width */}
      <div className="w-full px-3 sm:px-4 py-4 flex-1">
        {!hideHeader && <>
        {/* Banner if authenticated */}
        {userEmail ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="text-xs text-blue-900 font-medium">
              {t('Connecté en tant que')} <strong>{t(userName || userEmail || '')}</strong> {userName && <span className="text-slate-500 font-normal">({userEmail})</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                title={t('Mon Profil')}
              >
                <span>👤</span>
                <span>{t('Mon Profil')}</span>
              </button>
              <button
                type="button"
                onClick={onDashboardClick}
                className="text-xs font-bold text-blue-700 bg-white border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-50 cursor-pointer transition-colors shadow-2xs"
              >
                {t('Mon Dashboard (Mes soumissions) →')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-slate-100 border border-slate-200 rounded p-3 text-xs text-slate-600 flex items-center justify-between">
            <span>{t("Vous n'êtes pas connecté. Connectez-vous pour synchroniser vos examens avec Supabase.")}</span>
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 underline ml-2 cursor-pointer"
            >
              {t('Se connecter / Créer un compte')}
            </button>
          </div>
        )}

        {/* Header Title */}
        <div className="text-center mb-8 border-b border-slate-200 pb-6">
          <div className="inline-flex items-center justify-center gap-3.5 sm:gap-4.5 flex-wrap sm:flex-nowrap mb-2">
            <img
              src="./brand-mark.svg"
              alt="TCF Canada"
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain shrink-0 drop-shadow-sm select-none"
            />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight text-center sm:text-left">
              {t('TCF Canada — Expression Écrite Simulator')}
            </h1>
          </div>
          <p className="text-slate-600 text-sm sm:text-base font-normal">
            {t("Entraînez-vous dans les conditions de l'examen réel.")}
          </p>
        </div>

        </>}

        {/* Practice Selection Box */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 mb-6 gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {t("Mode d'entraînement")}
              </h2>
              <p className="text-xs text-slate-500">
                {trainingMode === 'full_exam'
                  ? t("Examen complet de 60 minutes avec les 3 tâches consécutives (conditions réelles).")
                  : t("Entraînement ciblé sur une seule tâche avec un minuteur personnalisé défini par vous-même.")}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-col sm:inline-flex sm:flex-row p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0 gap-1 sm:gap-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setTrainingMode('full_exam')}
                className={`flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  trainingMode === 'full_exam'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏆</span>
                <span>{t('Examen Complet (60 min)')}</span>
              </button>

              <button
                type="button"
                onClick={() => setTrainingMode('single_task')}
                className={`flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  trainingMode === 'single_task'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⏱️</span>
                <span>{t('Pratique par Tâche')}</span>
              </button>
            </div>
          </div>

          {/* Year Selection Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              {t('Année')}
            </label>
            <div className="flex gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleYearChange(year)}
                  className={`px-5 py-2 rounded text-sm font-semibold transition-colors border cursor-pointer ${
                    selectedYear === year
                      ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selection Grid */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              {t('Mois')} ({selectedYear})
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {monthsForYear.map((month) => {
                const count = db[selectedYear][month].length;
                const isSelected = selectedMonth === month;
                const completedCount = getCompletedCountForMonth(month);

                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthChange(month)}
                    className={`text-left p-3 rounded border transition-colors flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                        {t(month)}
                      </span>
                      {completedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-full">
                          ✓ {completedCount}/{count}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {count} {count > 1 ? t('combinaisons') : t('combinaison')}
                      {completedCount > 0 && (
                        <span className="text-emerald-700 font-semibold"> • {completedCount} {completedCount > 1 ? t('faites') : t('faite')}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combination Selector with Green Indicator for Completed Combinations */}
          {combinations.length > 0 && (
            <div className="mb-6" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Combinaison')} ({t(selectedMonth)} {selectedYear})
                </label>
              </div>

              {/* Interactive Custom Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setComboDropdownOpen(!comboDropdownOpen)}
                    className={`w-full sm:w-auto sm:min-w-[280px] px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between gap-3 text-sm font-semibold transition-all cursor-pointer shadow-2xs ${
                      isCurrentComboDone
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400/50'
                        : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-blue-600'
                    }`}
                    aria-expanded={comboDropdownOpen}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrentComboDone ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          ✓
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                      )}
                      <span>
                        {t('Combinaison')} {currentCombo?.combinationNumber || selectedComboIndex + 1}
                      </span>
                    </div>
                    <span
                      className="text-xs text-slate-500 transition-transform duration-200 inline-block"
                      style={{ transform: comboDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Dropdown Menu Options */}
                  {comboDropdownOpen && (
                    <div className="absolute z-30 mt-1.5 w-full sm:w-[380px] max-h-72 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-xl p-1.5 space-y-1 animate-fadeIn">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                        <span>{t('Sélectionner une combinaison')}</span>
                      </div>

                      {combinations.map((c, idx) => {
                        const comboNum = c.combinationNumber || idx + 1;
                        const isDone = isCombinationCompleted(comboNum);
                        const isSelected = selectedComboIndex === idx;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedComboIndex(idx);
                              setComboDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isDone
                                ? isSelected
                                  ? 'bg-emerald-100 text-emerald-950 font-bold border-2 border-emerald-500 shadow-xs'
                                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-semibold border border-emerald-300'
                                : isSelected
                                ? 'bg-blue-50 text-blue-900 font-bold border border-blue-300'
                                : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {isDone ? (
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                                  ✓
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full border border-slate-300 bg-white text-slate-400 flex items-center justify-center text-[10px] shrink-0">
                                  •
                                </span>
                              )}
                              <span className={isDone ? 'font-bold text-emerald-950 text-sm' : 'text-slate-800 font-medium text-sm'}>
                                {t('Combinaison')} {comboNum}
                              </span>
                            </div>

                            {isSelected && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                isDone
                                  ? 'text-emerald-800 bg-emerald-200/90 border border-emerald-400'
                                  : 'text-blue-700 bg-blue-100'
                              }`}>
                                {t('Sélectionnée')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {combinations.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePickRandomCombo}
                    className="w-full sm:w-auto justify-center px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title={t('Choisir une combinaison au hasard')}
                  >
                    <span>🎲</span>
                    <span>{t('Question au hasard')}</span>
                  </button>
                )}
              </div>

              {/* Informative Banner if Selected Combo is Already Done */}
              {isCurrentComboDone && trainingMode === 'full_exam' && (
                <div className="mt-3 p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 flex items-start gap-2.5 text-xs text-emerald-900 shadow-2xs">
                  <span className="text-base text-emerald-600 font-bold leading-none mt-0.5 shrink-0">✓</span>
                  <div>
                    <p className="font-bold text-emerald-950">
                      {t('Vous avez déjà complété la Combinaison')} {currentComboNum} ({t(selectedMonth)} {selectedYear}).
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      {t('Vous pouvez la refaire à tout moment pour vous réentraîner. Votre nouvelle tentative sera enregistrée séparément dans votre tableau de bord.')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Practice Options: Task Selection & Custom Timer */}
          {trainingMode === 'single_task' && currentCombo && (
            <div className="mt-6 p-5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-5 animate-fadeIn">
              {/* 1. Task Choice */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {t('1. Choisissez la ou les tâches à pratiquer')}
                  </label>
                  <span className="text-[11px] font-semibold text-blue-700">
                    {t('Sélectionnez 1 tâche ou combinez 2 tâches (ex: T1+T2, T1+T3, T2+T3)')}
                  </span>
                </div>

                {/* Quick Presets for 1 task and 2 tasks */}
                <div className="mb-3.5 p-2.5 bg-white border border-blue-100 rounded-lg flex flex-wrap items-center gap-1.5 shadow-2xs">
                  <span className="text-xs text-slate-500 font-bold mr-1 flex items-center gap-1">
                    <span>⚡</span> {t('Combinaisons rapides :')}
                  </span>
                  
                  {/* Single Tasks */}
                  {[
                    { label: 'T1', tasks: ['task1' as TaskKey], mins: 15 },
                    { label: 'T2', tasks: ['task2' as TaskKey], mins: 20 },
                    { label: 'T3', tasks: ['task3' as TaskKey], mins: 30 }
                  ].map((p) => {
                    const isActive = selectedTasks.length === 1 && selectedTasks[0] === p.tasks[0];
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handlePresetTasks(p.tasks)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 border-blue-700 text-white font-bold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p.label} ({p.mins} min)
                      </button>
                    );
                  })}

                  <span className="text-slate-300 font-bold mx-1">|</span>

                  {/* 2 Tasks combinations */}
                  {[
                    { label: 'T1 + T2', tasks: ['task1' as TaskKey, 'task2' as TaskKey], mins: 35 },
                    { label: 'T1 + T3', tasks: ['task1' as TaskKey, 'task3' as TaskKey], mins: 45 },
                    { label: 'T2 + T3', tasks: ['task2' as TaskKey, 'task3' as TaskKey], mins: 50 }
                  ].map((p) => {
                    const isActive =
                      selectedTasks.length === 2 &&
                      selectedTasks.includes(p.tasks[0]) &&
                      selectedTasks.includes(p.tasks[1]);
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handlePresetTasks(p.tasks)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 border-blue-700 text-white font-bold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p.label} ({p.mins} min)
                      </button>
                    );
                  })}

                  <span className="text-slate-300 font-bold mx-1">|</span>

                  {/* All 3 tasks */}
                  {(() => {
                    const isActive = selectedTasks.length === 3;
                    return (
                      <button
                        type="button"
                        onClick={() => handlePresetTasks(['task1', 'task2', 'task3'])}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 border-blue-700 text-white font-bold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        T1 + T2 + T3 (65 min)
                      </button>
                    );
                  })()}
                </div>

                {/* Task Selection Cards with Checkbox Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      key: 'task1' as TaskKey,
                      num: 1,
                      name: 'Tâche 1',
                      desc: 'Message / Description',
                      words: '60–120 mots',
                      rec: '15 min'
                    },
                    {
                      key: 'task2' as TaskKey,
                      num: 2,
                      name: 'Tâche 2',
                      desc: 'Narration / Récit',
                      words: '120–150 mots',
                      rec: '20 min'
                    },
                    {
                      key: 'task3' as TaskKey,
                      num: 3,
                      name: 'Tâche 3',
                      desc: 'Argumentation (2 documents)',
                      words: '120–180 mots',
                      rec: '30 min'
                    }
                  ].map((tItem) => {
                    const isSelected = selectedTasks.includes(tItem.key);
                    return (
                      <button
                        key={tItem.key}
                        type="button"
                        onClick={() => handleToggleTask(tItem.key)}
                        className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-white border-blue-600 ring-2 ring-blue-500 shadow-xs'
                            : 'bg-white/80 border-slate-200 hover:border-slate-400 hover:bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-slate-300 text-transparent bg-white'
                              }`}
                            >
                              ✓
                            </span>
                            <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                              {t(tItem.name)}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {tItem.words}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium ml-7">{t(tItem.desc)}</p>
                        <p className="text-[11px] text-blue-600 font-semibold mt-1 ml-7">
                          {t('Temps recommandé :')} {tItem.rec}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Custom Timer Setter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {t('2. Fixez votre minuteur (Temps libre par vous-même)')}
                  </label>
                  <span className="text-xs font-semibold text-slate-700">
                    {t('Minuteur réglé :')} <strong className="text-blue-700 font-mono text-sm">{customMinutes} {t('minutes')}</strong>
                  </span>
                </div>

                <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                  {/* Preset chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium mr-1">{t('Raccourcis :')}</span>
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 65].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setCustomMinutes(mins)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                          customMinutes === mins
                            ? 'bg-blue-600 border-blue-700 text-white shadow-2xs font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>

                  {/* Number Stepper Input */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomMinutes((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                      title="Diminuer d'une minute"
                    >
                      –
                    </button>
                    <div className="flex items-center gap-1 border border-slate-300 rounded px-2.5 py-1 bg-white focus-within:ring-1 focus-within:ring-blue-600">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={customMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0 && val <= 180) {
                            setCustomMinutes(val);
                          }
                        }}
                        className="w-12 text-center font-mono font-bold text-sm text-slate-900 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium">min</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomMinutes((prev) => Math.min(180, prev + 1))}
                      className="w-8 h-8 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                      title="Augmenter d'une minute"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Summary Card */}
          {currentCombo && (
            <div className="bg-slate-50 border border-slate-300 rounded p-4 mt-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {trainingMode === 'single_task'
                      ? `${t('Pratique ciblée :')} ${selectedTasks.map((k) => t(k === 'task1' ? 'Tâche 1' : k === 'task2' ? 'Tâche 2' : 'Tâche 3')).join(' + ')}`
                      : `${t('Combinaison')} ${currentCombo.combinationNumber || selectedComboIndex + 1}`}
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({t(selectedMonth)} {selectedYear})
                  </span>
                  {trainingMode === 'full_exam' && isCurrentComboDone && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      ✓ {t('Déjà complétée')}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-1 rounded font-mono shadow-2xs">
                  ⏱️ {trainingMode === 'single_task' ? `${customMinutes} ${t('minutes')}` : t('Durée: 60 minutes')}
                </span>
              </div>

              {trainingMode === 'single_task' ? (
                <div className="space-y-2 mb-6 text-sm text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">✓</span>
                    <div>
                      <strong>{selectedTasks.length > 1 ? t('Tâches sélectionnées :') : t('Tâche :')}</strong>
                      <div className="mt-1 space-y-1">
                        {selectedTasks.includes('task1') && (
                          <div className="text-xs text-slate-700">
                            • <strong>{t('Tâche 1')}</strong> — {t('Message / Description')} (60–120 {t('mots')})
                          </div>
                        )}
                        {selectedTasks.includes('task2') && (
                          <div className="text-xs text-slate-700">
                            • <strong>{t('Tâche 2')}</strong> — {t('Narration / Récit')} (120–150 {t('mots')})
                          </div>
                        )}
                        {selectedTasks.includes('task3') && (
                          <div className="text-xs text-slate-700">
                            • <strong>{t('Tâche 3')}</strong> — {t('Argumentation (2 documents)')} (120–180 {t('mots')})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>
                      <strong>{t('Minuteur personnalisé :')}</strong> {customMinutes} {t('minutes')} {selectedTasks.length > 1 ? t('allouées pour ces rédactions.') : t('allouées pour cette rédaction.')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>
                      <strong>{t('Conditions réelles :')}</strong> {t("Exacte même interface d'examen TCF avec décompte des mots et clavier d'accents.")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-6 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>{t('Tâche 1')}</strong> — {t('Message (60–120 mots)') || 'Message (60–120 mots)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>{t('Tâche 2')}</strong> — {t('Narration (120–150 mots)') || 'Narration (120–150 mots)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>{t('Tâche 3')}</strong> — {t('Argumentation (120–180 mots)') || 'Argumentation (120–180 mots)'}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  try {
                    const storedMistakes = getStoredMistakes();
                    if (storedMistakes && storedMistakes.length > 0) {
                      setCurrentMistakes(storedMistakes);
                      setIsMistakesModalOpen(true);
                      return;
                    }
                  } catch (e) {
                    console.error('Error checking mistakes:', e);
                  }
                  setIsConfirmOpen(true);
                }}
                className={`w-full sm:w-auto px-6 py-2.5 rounded font-bold text-sm transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                  trainingMode === 'full_exam' && isCurrentComboDone
                    ? 'bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700'
                    : 'bg-blue-600 border border-blue-700 text-white hover:bg-blue-700'
                }`}
              >
                {trainingMode === 'single_task' ? (
                  <span>{t("Commencer l'entraînement")} ({customMinutes} min)</span>
                ) : isCurrentComboDone ? (
                  <>
                    <span>{t('Refaire cet examen')}</span>
                    <span>↻</span>
                  </>
                ) : (
                  <span>{t("Commencer l'examen")}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dashboard Quick Access Card */}
        {userEmail && (
          <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {t('Consulter vos soumissions passées')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("Retrouvez l'historique complet de vos épreuves, vos décomptes de mots et vos rédactions dans votre tableau de bord personnel.")}
              </p>
            </div>
            <button
              type="button"
              onClick={onDashboardClick}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>{t('Accéder au Dashboard')}</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {/* Pop-up: Did you revise past mistakes before starting? */}
      <MistakesRevisionModal
        isOpen={isMistakesModalOpen}
        mistakes={currentMistakes}
        trainingModeLabel={
          trainingMode === 'single_task'
            ? `${t('Entraînement')} (${selectedTasks.map((k) => t(k === 'task1' ? 'Tâche 1' : k === 'task2' ? 'Tâche 2' : 'Tâche 3')).join(' + ')}) • ${customMinutes} min`
            : t('Examen complet (60 minutes)')
        }
        combinationLabel={
          currentCombo
            ? `${t('Combinaison')} ${currentComboNum} (${t(selectedMonth)} ${selectedYear})`
            : undefined
        }
        onConfirmStart={() => {
          setIsMistakesModalOpen(false);
          if (currentCombo) {
            if (trainingMode === 'single_task') {
              onStartExam(currentCombo, selectedYear, selectedMonth, true, selectedTasks, customMinutes);
            } else {
              onStartExam(currentCombo, selectedYear, selectedMonth, false, 'task1', 60);
            }
          }
        }}
        onGoToMistakes={() => {
          setIsMistakesModalOpen(false);
          if (onNavigateToMistakes) {
            onNavigateToMistakes();
          } else if (onDashboardClick) {
            onDashboardClick();
          }
        }}
        onCancel={() => setIsMistakesModalOpen(false)}
      />

      {/* Confirmation Modal before starting exam or practice (used if no past mistakes) */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title={
          trainingMode === 'single_task'
            ? `${t('Prêt pour l\'entraînement')} (${selectedTasks.map((k) => t(k === 'task1' ? 'Tâche 1' : k === 'task2' ? 'Tâche 2' : 'Tâche 3')).join(' + ')}) ?`
            : isCurrentComboDone
            ? `${t('Refaire la Combinaison')} ${currentComboNum} ?`
            : t("Vous êtes prêt à commencer l'examen ?")
        }
        message={
          trainingMode === 'single_task'
            ? `${t('Vous aurez')} ${customMinutes} ${t('minutes pour compléter')} ${selectedTasks.length > 1 ? t('ces tâches') : t('cette tâche')} ${t('dans les conditions d\'examen du TCF Canada.')}`
            : isCurrentComboDone
            ? t("Vous avez déjà soumis cette combinaison auparavant. Vous pouvez la refaire dans les conditions réelles (60 minutes). Votre nouvelle soumission sera enregistrée séparément dans votre tableau de bord.")
            : t("Vous aurez 60 minutes pour compléter les 3 tâches dans les conditions réelles.")
        }
        confirmLabel={
          trainingMode === 'single_task'
            ? t("Commencer l'entraînement")
            : isCurrentComboDone
            ? t('Refaire l’examen')
            : t('Commencer')
        }
        cancelLabel={t('Annuler')}
        onConfirm={() => {
          setIsConfirmOpen(false);
          if (currentCombo) {
            if (trainingMode === 'single_task') {
              onStartExam(currentCombo, selectedYear, selectedMonth, true, selectedTasks, customMinutes);
            } else {
              onStartExam(currentCombo, selectedYear, selectedMonth, false, 'task1', 60);
            }
          }
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Footer with Terms and Conditions */}
      <Footer onFeedbackClick={onFeedbackClick} />
    </div>
  );
};
