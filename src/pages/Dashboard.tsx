import { PedagogicalProgress } from '../components/PedagogicalProgress';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSubmissionsFromSupabase, deleteSubmissionFromSupabase } from '../lib/supabase';
import { getStoredSubmissions, deleteStoredSubmission, mergeSubmissions, syncStoredSubmissions } from '../utils/storage';
import { ExamResult, TaskKey } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { AdminPanel } from '../components/AdminPanel';
import { MistakesView } from '../components/MistakesView';
import { DashboardAnalytics } from '../components/DashboardAnalytics';
import { getStoredMistakes, mergeMistakesFromSubmissions } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import { mapScoreToTcfCanadaLevels } from '../services/geminiEvaluator';
import {
  BarChart3,
  CheckCircle2,
  Calendar,
  Award,
  Target,
  Trash2,
  Eye,
  TrendingUp,
  BookOpen,
  Flame
} from 'lucide-react';

interface DashboardProps {
  onStartNewExam: () => void;
  onViewSubmission: (result: ExamResult) => void;
  onRetakeCombination: (combo: any, year: string, month: string) => void;
  onHomeClick: () => void;
  onFeedbackClick?: () => void;
  initialTab?: 'submissions' | 'mistakes' | 'admin';
  onTabChange?: (tab: 'submissions' | 'mistakes' | 'admin') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartNewExam,
  onViewSubmission,
  initialTab,
  onTabChange
}) => {
  const { user, userName, isConfigured, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const [submissions, setSubmissions] = useState<ExamResult[]>([]);
  const [mistakes, setMistakes] = useState<SavedMistake[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'submissions' | 'mistakes' | 'admin'>(
    initialTab || (isAdmin ? 'admin' : 'submissions')
  );

  const handleSwitchTab = (tab: 'submissions' | 'mistakes' | 'admin') => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (isAdmin) {
      setActiveTab('admin');
    }
  }, [initialTab, isAdmin]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    async function loadData() {
      setLoading(true);
      const local = getStoredSubmissions();
      setSubmissions(local);

      const localMistakes = getStoredMistakes();
      setMistakes(localMistakes);

      if (user && isConfigured) {
        try {
          const { submissions: dbSubs, error } = await fetchSubmissionsFromSupabase(user.id);
          if (!error && dbSubs && dbSubs.length > 0) {
            const merged = mergeSubmissions(dbSubs, local);
            setSubmissions(merged);
            syncStoredSubmissions(merged);

            const syncedMistakes = mergeMistakesFromSubmissions(localMistakes, merged);
            setMistakes(syncedMistakes);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error fetching submissions for dashboard:', e);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [user, isConfigured]);

  const handleDeleteSubmission = async (sub: ExamResult) => {
    if (!sub.id) return;
    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer cette soumission (${sub.month} ${sub.year} — Combinaison ${comboNum}) ?`
    );
    if (!confirmed) return;

    deleteStoredSubmission(sub.id);

    if (user && isConfigured) {
      try {
        await deleteSubmissionFromSupabase(sub.id, user.id);
      } catch (err) {
        console.error('Erreur lors de la suppression sur Supabase:', err);
      }
    }

    setSubmissions((prev) => prev.filter((item) => item.id !== sub.id));
  };

  // Compute summary stats
  const totalSubmissions = submissions.length;
  const lastSubmissionDate = submissions[0]?.date ? submissions[0].date.split(' ')[0] : '—';

  // Compute Days of Streak functionality
  const streakData = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return { currentStreak: 0, practicedToday: false };
    }

    const parseDateToMidnight = (dateStr?: string): Date | null => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const clean = dateStr.trim();
      if (!clean) return null;

      // Extract DD/MM/YYYY or YYYY-MM-DD
      const datePart = clean.split(/(?: à |[ ,T]+)/)[0].trim();
      const dmy = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
      }

      const ymd = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) {
        return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
      }

      const parsed = new Date(clean);
      return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    const dateSet = new Set<string>();
    submissions.forEach((s) => {
      const d = parseDateToMidnight(s.date);
      if (d) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dateSet.add(key);
      }
    });

    if (dateSet.size === 0) {
      return { currentStreak: 0, practicedToday: false };
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const practicedToday = dateSet.has(todayKey);
    let currentStreak = 0;

    let checkDate: Date | null = practicedToday
      ? new Date(now)
      : dateSet.has(yesterdayKey)
      ? new Date(yesterday)
      : null;

    if (checkDate) {
      while (true) {
        const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (dateSet.has(key)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return { currentStreak, practicedToday };
  }, [submissions]);

  // Target Goal State (synced with localStorage key used in DashboardAnalytics)
  const [targetGoal, setTargetGoal] = useState<CefrLevel>(() => {
    try {
      const stored = localStorage.getItem('tcf_user_target_goal_v1');
      if (stored && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(stored)) {
        return stored as CefrLevel;
      }
    } catch {}
    return 'B2';
  });

  useEffect(() => {
    const syncGoal = () => {
      try {
        const stored = localStorage.getItem('tcf_user_target_goal_v1');
        if (stored && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(stored)) {
          setTargetGoal(stored as CefrLevel);
        }
      } catch {}
    };
    window.addEventListener('storage', syncGoal);
    window.addEventListener('tcf_target_goal_updated', syncGoal);
    return () => {
      window.removeEventListener('storage', syncGoal);
      window.removeEventListener('tcf_target_goal_updated', syncGoal);
    };
  }, []);

  const latestProjection = submissions
    .filter(s => s.aiEvaluation?.pedagogical?.mock_projection)
    .sort((a,b) => Date.parse(b.aiEvaluation!.created_at) - Date.parse(a.aiEvaluation!.created_at))[0]
    ?.aiEvaluation?.pedagogical?.mock_projection;
  const projectionLabel = latestProjection
    ? `${latestProjection.lower === 3 ? '<4' : latestProjection.lower}–${latestProjection.upper === 10 ? '10+' : latestProjection.upper}`
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 text-slate-900">
      {/* Stats Grid - Reduced by 50% */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Submitted Exams */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider truncate mb-0.5">
            {t('Examens Soumis')}
          </h3>
          <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{totalSubmissions}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5 truncate">
            {submissions.length > 0 ? t('Enregistrés sur votre compte') : t('Aucune soumission')}
          </p>
        </div>

        {/* Card 2: Days of Streak (Replaces Written Tasks) */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
            </div>
            {streakData.practicedToday ? (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 tracking-wide">
                🔥 ON
              </span>
            ) : (
              <Flame className="w-3.5 h-3.5 text-slate-300" />
            )}
          </div>
          <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider truncate mb-0.5">
            {t('Jours de Série')}
          </h3>
          <div className="flex items-baseline gap-1">
            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              {streakData.currentStreak}
            </p>
            <span className="text-[11px] font-bold text-slate-500">
              {streakData.currentStreak > 1 ? t('jours') : t('jour')}
            </span>
          </div>
          <p className={`text-[11px] mt-0.5 truncate ${streakData.currentStreak > 0 ? 'text-orange-600 font-semibold' : 'text-slate-400'}`}>
            {streakData.practicedToday
              ? t('Série active aujourd\'hui !')
              : streakData.currentStreak > 0
              ? t('Pratiquez aujourd\'hui pour continuer')
              : t('Prêt à débuter une série')}
          </p>
        </div>

        {/* Card 3: Last Session */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <Award className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider truncate mb-0.5">
            {t('Dernière Session')}
          </h3>
          <p className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">
            {lastSubmissionDate}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {submissions.length > 0 ? t('Entraînement régulier') : t('Prêt à débuter')}
          </p>
        </div>

        {/* Card 4: Score & Target Goal (Matches pattern of 1st 3 cards) */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              🎯 {targetGoal}
            </span>
          </div>
          <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider truncate mb-0.5">
            {projectionLabel ? (language === 'en' ? 'Estimated NCLC & Goal' : 'NCLC estimé et objectif') : (language === 'en' ? 'Reviews & Goal' : 'Bilans et objectif')}
          </h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              {projectionLabel || submissions.filter(s => s.aiEvaluation?.pedagogical).length}
              <span className="text-[11px] font-normal text-slate-400 ml-0.5">{projectionLabel ? 'NCLC' : (language === 'en' ? 'reviews' : 'bilans')}</span>
            </p>

          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {language === 'en' ? `Target: ${targetGoal} · not an assessed level` : `Objectif : ${targetGoal} · pas un niveau évalué`}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleSwitchTab('submissions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'submissions'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>📊</span>
          <span>{t('Mes Examens')} ({submissions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('mistakes')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'mistakes'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>📝</span>
          <span>{language === 'en' ? 'My Mistakes' : 'Mes Fautes'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'mistakes'
                ? 'bg-white text-purple-700'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {mistakes.length}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleSwitchTab('admin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>👑</span>
            <span>{t('Gestion des Notifications')}</span>
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      {isAdmin && activeTab === 'admin' ? (
        <AdminPanel />
      ) : activeTab === 'mistakes' ? (
        <MistakesView
          mistakes={mistakes}
          onMistakesChange={setMistakes}
          onStartExam={onStartNewExam}
          onGoToExams={() => setActiveTab('submissions')}
        />
      ) : (
        <div className="space-y-6">
          {/* Performance Analytics & Progress Visualizations */}
          <PedagogicalProgress submissions={submissions} onViewSubmission={onViewSubmission}/>


          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>{t('Mes examens précédents')}</span>
                <span className="text-xs font-normal text-slate-500">({submissions.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Consultez le détail de vos rédactions passées et leur nombre de mots.')}
              </p>
            </div>

            <button
              type="button"
              onClick={onStartNewExam}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+</span>
              <span>{t('Commencer un examen')}</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm font-medium">
              {t('Chargement de vos soumissions...')}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-8">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {t('Aucun examen enregistré pour le moment.')}
              </p>
              <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                {t("Entraînez-vous dans les conditions réelles du TCF Canada (60 minutes pour 3 tâches rédigées).")}
              </p>
              <button
                type="button"
                onClick={onStartNewExam}
                className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {t('Passer votre premier examen')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase font-bold text-slate-600 bg-slate-50/80">
                    <th className="py-3 px-3.5">{t('Date')}</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">{t('Série / Combinaison')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 1')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 2')}</th>
                    <th className="py-3 px-3.5">{t('Tâche 3')}</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">{t('Score IA')}</th>
                    <th className="py-3 px-3.5 text-left whitespace-nowrap">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {submissions.map((sub) => {
                    const comboNum = sub.combination?.combinationNumber || sub.combination?.combination;
                    const isPract = !!sub.isPracticeMode && (!!sub.practiceTasks || !!sub.practiceTask);

                    const activeTasksList: TaskKey[] = sub.practiceTasks && sub.practiceTasks.length > 0
                      ? sub.practiceTasks
                      : typeof sub.practiceTask === 'string'
                      ? (sub.practiceTask.split(',') as TaskKey[])
                      : sub.practiceTask
                      ? [sub.practiceTask as TaskKey]
                      : [];

                    const practLabel = activeTasksList.length > 0
                      ? `${t('Pratique')} ${activeTasksList.map((k) => `T${k.slice(-1)}`).join(' + ')}`
                      : t('Pratique');

                    const t1Ok = sub.wordCounts.task1 >= 60 && sub.wordCounts.task1 <= 120;
                    const t2Ok = sub.wordCounts.task2 >= 120 && sub.wordCounts.task2 <= 150;
                    const t3Ok = sub.wordCounts.task3 >= 120 && sub.wordCounts.task3 <= 180;

                    const dateParts = sub.date ? sub.date.split(/(?: à |[ ,]+)/) : [];
                    const dPart = dateParts[0] || sub.date || '—';
                    const tPart = dateParts.length >= 2 ? dateParts[1] : '';

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3.5 font-medium text-slate-800 text-xs whitespace-nowrap">
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold">{dPart}</span>
                            {tPart && (
                              <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {tPart}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{sub.year} / {t(sub.month)} / {t('Combinaison')} {comboNum}</span>
                            </div>
                            {isPract && (
                              <div>
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap inline-block">
                                  {practLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5">
                          {isPract && !activeTasksList.includes('task1') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t1Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task1} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5">
                          {isPract && !activeTasksList.includes('task2') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t2Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task2} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5">
                          {isPract && !activeTasksList.includes('task3') ? (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border inline-block ${
                              t3Ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-red-50 text-red-600 border-red-300'
                            }`}>
                              {sub.wordCounts.task3} {t('mots')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {sub.aiEvaluation ? (
                            (() => {
                              if (sub.aiEvaluation.pedagogical) {
                                const projection=sub.aiEvaluation.pedagogical.mock_projection;
                                return <span className="text-xs text-emerald-800">{projection ? `NCLC ${projection.lower === 3 ? '<4' : projection.lower}–${projection.upper === 10 ? '10+' : projection.upper} (${language === 'en' ? 'estimated' : 'estimé'})` : (language === 'en' ? 'Pedagogical review' : 'Bilan pédagogique')}</span>;
                              }
                              const evaluatedCount = sub.aiEvaluation.evaluated_tasks?.length || (isPract ? activeTasksList.length : 3);
                              const isSingle = evaluatedCount === 1;
                              const lvl = sub.aiEvaluation.estimated_cefr_level;
                              const clb = sub.aiEvaluation.clb_level;
                              const displayLevel = clb && lvl ? `${clb} (${lvl})` : (clb || lvl);

                              if (isSingle) {
                                return lvl ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {displayLevel}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic font-mono">—</span>
                                );
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded font-mono text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                                    {sub.aiEvaluation.overall_score} <span className="text-[10px] font-normal text-slate-400">/ 20</span>
                                  </span>
                                  {lvl && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {displayLevel}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-slate-400 text-xs italic font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 text-left whitespace-nowrap">
                          <div className="flex items-center justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => onViewSubmission(sub)}
                              className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('Voir')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub)}
                              className="w-7 h-7 flex items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title={t('Supprimer cette soumission')}
                              aria-label={t('Supprimer')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Confidentiality / Privacy Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
        🔒 <strong>{t('Respect de la vie privée :')}</strong> {t("Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques, aucun profil public n'est généré, et aucun classement n'est partagé.")}
      </div>
    </div>
  );
};
