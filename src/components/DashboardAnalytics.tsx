import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { ExamResult } from '../types/exam';
import { SavedMistake, CefrLevel } from '../types/aiEvaluation';
import { mapScoreToTcfCanadaLevels } from '../services/geminiEvaluator';
import { CANONICAL_CATEGORIES, normalizeCategory } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import {
  TrendingUp,
  Award,
  Zap,
  Target,
  Sparkles,
  CheckCircle,
  Info,
  ChevronDown,
  Calendar,
  Filter
} from 'lucide-react';

interface DashboardAnalyticsProps {
  submissions: ExamResult[];
  mistakes: SavedMistake[];
  onStartNewExam: () => void;
  onViewSubmission?: (sub: ExamResult) => void;
}

export interface ProgressDataPoint {
  id?: string;
  sessionIndex: number;
  date: string;
  shortDate: string;
  title: string;
  score: number; // Positive integer 0 to 20
  rawScore: number;
  cefr: CefrLevel;
  clb: string;
  year?: string;
  month?: string;
  task1Score?: number;
  task2Score?: number;
  task3Score?: number;
  task1Level?: CefrLevel;
  task2Level?: CefrLevel;
  task3Level?: CefrLevel;
  wordCounts?: { task1?: number; task2?: number; task3?: number };
  isPractice?: boolean;
  rawSubmission?: ExamResult;
}

// CEFR Bands scale definitions for TCF Canada Expression Écrite
export const CEFR_BANDS: {
  level: CefrLevel;
  clb: string;
  minScore: number;
  maxScore: number;
  targetThreshold: number; // Score threshold for setting as target
  targetMasteryPct: number; // Benchmark percentage for radar
  labelFr: string;
  labelEn: string;
}[] = [
  { level: 'C2', clb: 'CLB 10', minScore: 18, maxScore: 20, targetThreshold: 18, targetMasteryPct: 95, labelFr: 'Maîtrise supérieure', labelEn: 'Mastery / Advanced' },
  { level: 'C1', clb: 'CLB 9-10', minScore: 14, maxScore: 17, targetThreshold: 14, targetMasteryPct: 85, labelFr: 'Autonome avancé', labelEn: 'Effective Operational' },
  { level: 'B2', clb: 'CLB 7-8', minScore: 10, maxScore: 13, targetThreshold: 10, targetMasteryPct: 75, labelFr: 'Indépendant (Express Entry)', labelEn: 'Independent (Express Entry)' },
  { level: 'B1', clb: 'CLB 5-6', minScore: 7, maxScore: 9, targetThreshold: 7, targetMasteryPct: 60, labelFr: 'Seuil intermédiaire', labelEn: 'Threshold / Intermediate' },
  { level: 'A2', clb: 'CLB 4', minScore: 4, maxScore: 6, targetThreshold: 4, targetMasteryPct: 45, labelFr: 'Élémentaire', labelEn: 'Elementary' },
  { level: 'A1', clb: '< CLB 4', minScore: 0, maxScore: 3, targetThreshold: 2, targetMasteryPct: 30, labelFr: 'Débutant', labelEn: 'Beginner' },
];

const TARGET_GOAL_STORAGE_KEY = 'tcf_user_target_goal_v1';

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  submissions,
  mistakes,
  onStartNewExam,
  onViewSubmission
}) => {
  const { language, t } = useLanguage();
  const [radarMode, setRadarMode] = useState<'target' | 'latest'>('target');
  const [showDemoPreview, setShowDemoPreview] = useState<boolean>(false);

  // Target Goal State (default B2, stored in localStorage)
  const [targetGoal, setTargetGoal] = useState<CefrLevel>(() => {
    try {
      const stored = localStorage.getItem(TARGET_GOAL_STORAGE_KEY);
      if (stored && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(stored)) {
        return stored as CefrLevel;
      }
    } catch (e) {
      // ignore
    }
    return 'B2';
  });

  const handleSelectTargetGoal = (level: CefrLevel) => {
    setTargetGoal(level);
    try {
      localStorage.setItem(TARGET_GOAL_STORAGE_KEY, level);
      window.dispatchEvent(new Event('tcf_target_goal_updated'));
    } catch (e) {
      // ignore
    }
  };

  // Time scope filter state
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Dropdown menu open states and refs
  const [yearDropdownOpen, setYearDropdownOpen] = useState<boolean>(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState<boolean>(false);

  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) {
        setMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Filter and sort evaluated submissions chronologically (oldest to newest)
  // Ensure scores are strict POSITIVE INTEGERS (no decimals)
  const evaluatedSubmissions = useMemo<ProgressDataPoint[]>(() => {
    const list = submissions
      .filter((s) => s.aiEvaluation && typeof s.aiEvaluation.overall_score === 'number')
      .map((s, idx) => {
        const rawDate = s.date || '';
        const comboNum = s.combination?.combinationNumber || s.combination?.combination || (idx + 1);
        const title = `${t(s.month || '')} ${s.year || ''} — Comb. ${comboNum}`.trim();
        const shortDate = rawDate.split(/(?: à |[ ,]+)/)[0] || `S${idx + 1}`;
        const rawScore = s.aiEvaluation!.overall_score!;
        // Strict integer positive score: 0 to 20
        const intScore = Math.max(0, Math.min(20, Math.round(rawScore)));
        const levels = mapScoreToTcfCanadaLevels(intScore);
        const cefr = s.aiEvaluation!.estimated_cefr_level || levels.cefr;
        const clb = s.aiEvaluation!.clb_level || levels.clb;

        const t1Score = s.aiEvaluation!.tasks?.task1?.score;
        const t2Score = s.aiEvaluation!.tasks?.task2?.score;
        const t3Score = s.aiEvaluation!.tasks?.task3?.score;

        const t1Level = s.aiEvaluation!.tasks?.task1?.estimated_level ||
          (typeof t1Score === 'number' ? mapScoreToTcfCanadaLevels(t1Score).cefr : undefined);
        const t2Level = s.aiEvaluation!.tasks?.task2?.estimated_level ||
          (typeof t2Score === 'number' ? mapScoreToTcfCanadaLevels(t2Score).cefr : undefined);
        const t3Level = s.aiEvaluation!.tasks?.task3?.estimated_level ||
          (typeof t3Score === 'number' ? mapScoreToTcfCanadaLevels(t3Score).cefr : undefined);

        return {
          id: s.id,
          sessionIndex: idx + 1,
          date: rawDate,
          shortDate,
          title,
          score: intScore,
          rawScore,
          cefr,
          clb,
          year: s.year,
          month: s.month,
          task1Score: typeof t1Score === 'number' ? Math.round(t1Score) : undefined,
          task2Score: typeof t2Score === 'number' ? Math.round(t2Score) : undefined,
          task3Score: typeof t3Score === 'number' ? Math.round(t3Score) : undefined,
          task1Level: t1Level as CefrLevel | undefined,
          task2Level: t2Level as CefrLevel | undefined,
          task3Level: t3Level as CefrLevel | undefined,
          wordCounts: s.wordCounts,
          isPractice: !!s.isPracticeMode,
          rawSubmission: s
        };
      });

    // Submissions are typically stored newest first, so we reverse for chronological trend
    return list.slice().reverse();
  }, [submissions, t]);

  const hasEvaluatedData = evaluatedSubmissions.length > 0;

  const ALL_FRENCH_MONTHS = [
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

  // Extract available years from exams, questions database, and submissions
  const availableYears = useMemo(() => {
    const years = new Set<string>(['2026', '2025', '2024']);
    evaluatedSubmissions.forEach((s) => {
      if (s.year) years.add(s.year);
    });
    return Array.from(years).sort().reverse();
  }, [evaluatedSubmissions]);

  // All 12 calendar months always selectable
  const availableMonths = ALL_FRENCH_MONTHS;

  // Demo data spanning multiple years and months with strict INTEGER positive scores (no decimals)
  const demoEvaluatedSubmissions = useMemo<ProgressDataPoint[]>(() => [
    {
      id: 'demo-1',
      sessionIndex: 1,
      date: '15/11/2025',
      shortDate: '15/11/25',
      title: 'Novembre 2025 — Comb. 1',
      score: 9,
      rawScore: 9.0,
      cefr: 'B1' as CefrLevel,
      clb: 'CLB 6',
      year: '2025',
      month: 'Novembre',
      task1Score: 10,
      task2Score: 9,
      task3Score: 8,
      task1Level: 'B1' as CefrLevel,
      task2Level: 'B1' as CefrLevel,
      task3Level: 'A2' as CefrLevel,
      wordCounts: { task1: 90, task2: 130, task3: 145 },
      isPractice: false
    },
    {
      id: 'demo-2',
      sessionIndex: 2,
      date: '20/12/2025',
      shortDate: '20/12/25',
      title: 'Décembre 2025 — Comb. 2',
      score: 11,
      rawScore: 10.8,
      cefr: 'B2' as CefrLevel,
      clb: 'CLB 7',
      year: '2025',
      month: 'Décembre',
      task1Score: 12,
      task2Score: 11,
      task3Score: 10,
      task1Level: 'B2' as CefrLevel,
      task2Level: 'B2' as CefrLevel,
      task3Level: 'B1' as CefrLevel,
      wordCounts: { task1: 98, task2: 138, task3: 155 },
      isPractice: false
    },
    {
      id: 'demo-3',
      sessionIndex: 3,
      date: '10/02/2026',
      shortDate: '10/02/26',
      title: 'Février 2026 — Comb. 1',
      score: 12,
      rawScore: 12.0,
      cefr: 'B2' as CefrLevel,
      clb: 'CLB 7',
      year: '2026',
      month: 'Février',
      task1Score: 13,
      task2Score: 12,
      task3Score: 11,
      task1Level: 'B2' as CefrLevel,
      task2Level: 'B2' as CefrLevel,
      task3Level: 'B2' as CefrLevel,
      wordCounts: { task1: 105, task2: 142, task3: 165 },
      isPractice: false
    },
    {
      id: 'demo-4',
      sessionIndex: 4,
      date: '18/08/2026',
      shortDate: '18/08/26',
      title: 'Août 2026 — Comb. 3',
      score: 13,
      rawScore: 13.2,
      cefr: 'B2' as CefrLevel,
      clb: 'CLB 8',
      year: '2026',
      month: 'Août',
      task1Score: 14,
      task2Score: 13,
      task3Score: 12,
      task1Level: 'B2' as CefrLevel,
      task2Level: 'B2' as CefrLevel,
      task3Level: 'B2' as CefrLevel,
      wordCounts: { task1: 108, task2: 144, task3: 170 },
      isPractice: false
    },
    {
      id: 'demo-5',
      sessionIndex: 5,
      date: '12/09/2026',
      shortDate: '12/09/26',
      title: 'Septembre 2026 — Comb. 2',
      score: 14,
      rawScore: 14.0,
      cefr: 'C1' as CefrLevel,
      clb: 'CLB 9',
      year: '2026',
      month: 'Septembre',
      task1Score: 15,
      task2Score: 14,
      task3Score: 13,
      task1Level: 'C1' as CefrLevel,
      task2Level: 'C1' as CefrLevel,
      task3Level: 'B2' as CefrLevel,
      wordCounts: { task1: 112, task2: 146, task3: 174 },
      isPractice: false
    },
    {
      id: 'demo-6',
      sessionIndex: 6,
      date: '24/10/2026',
      shortDate: '24/10/26',
      title: 'Octobre 2026 — Comb. 4',
      score: 16,
      rawScore: 15.8,
      cefr: 'C1' as CefrLevel,
      clb: 'CLB 10',
      year: '2026',
      month: 'Octobre',
      task1Score: 17,
      task2Score: 16,
      task3Score: 15,
      task1Level: 'C1' as CefrLevel,
      task2Level: 'C1' as CefrLevel,
      task3Level: 'C1' as CefrLevel,
      wordCounts: { task1: 118, task2: 150, task3: 180 },
      isPractice: false
    }
  ], []);

  // Apply Year/Month Filter
  const filteredSubmissions = useMemo(() => {
    const base = hasEvaluatedData
      ? evaluatedSubmissions
      : showDemoPreview
      ? demoEvaluatedSubmissions
      : [];

    if (selectedYear === 'all' && selectedMonth === 'all') {
      return base;
    }

    return base.filter((s) => {
      const matchYear = selectedYear === 'all' || s.year === selectedYear;
      const matchMonth = selectedMonth === 'all' || s.month?.toLowerCase() === selectedMonth.toLowerCase();
      return matchYear && matchMonth;
    });
  }, [hasEvaluatedData, evaluatedSubmissions, showDemoPreview, demoEvaluatedSubmissions, selectedYear, selectedMonth]);

  const activeProgressData = filteredSubmissions;

  // Summary calculation for Progress Graph (All scores & average as STRICT INTEGERS)
  const progressStats = useMemo(() => {
    if (activeProgressData.length === 0) {
      return {
        avgScore: 0,
        avgCefr: '—' as CefrLevel | '—',
        avgClb: '—',
        latestScore: 0,
        latestCefr: '—',
        bestScore: 0,
        bestCefr: '—',
        progression: 0
      };
    }

    const scores = activeProgressData.map((d) => d.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    // Strict integer average
    const avgScore = Math.round(sum / scores.length);
    const avgLevels = mapScoreToTcfCanadaLevels(avgScore);

    const latest = activeProgressData[activeProgressData.length - 1];
    const first = activeProgressData[0];
    const bestScore = Math.max(...scores);
    const bestLevels = mapScoreToTcfCanadaLevels(bestScore);
    const progression = Math.round(latest.score - first.score);

    return {
      avgScore,
      avgCefr: avgLevels.cefr,
      avgClb: avgLevels.clb,
      latestScore: latest.score,
      latestCefr: latest.cefr,
      bestScore,
      bestCefr: bestLevels.cefr,
      progression
    };
  }, [activeProgressData]);

  // Target Goal Information
  const currentTargetInfo = useMemo(() => {
    return CEFR_BANDS.find((b) => b.level === targetGoal) || CEFR_BANDS[2]; // Default B2
  }, [targetGoal]);

  // 2. Data Calculation for Radar Chart (6 Competence Axes based on Mistakes)
  const radarData = useMemo(() => {
    const isDemo = !hasEvaluatedData && showDemoPreview;
    const targetBenchmark = currentTargetInfo.targetMasteryPct;

    if (isDemo) {
      return {
        chartData: [
          { axis: language === 'en' ? 'Grammar' : 'Grammaire', current: 75, target: targetBenchmark, latest: 80, scoreOutOf20: 15, mistakesCount: 3 },
          { axis: language === 'en' ? 'Spelling' : 'Orthographe', current: 65, target: targetBenchmark, latest: 70, scoreOutOf20: 13, mistakesCount: 6 },
          { axis: language === 'en' ? 'Conjugation' : 'Conjugaison', current: 60, target: targetBenchmark, latest: 65, scoreOutOf20: 12, mistakesCount: 7 },
          { axis: language === 'en' ? 'Structure' : 'Structure', current: 85, target: targetBenchmark, latest: 90, scoreOutOf20: 17, mistakesCount: 2 },
          { axis: language === 'en' ? 'Vocabulary' : 'Vocabulaire', current: 90, target: targetBenchmark, latest: 88, scoreOutOf20: 18, mistakesCount: 1 },
          { axis: language === 'en' ? 'Coherence' : 'Cohérence', current: 80, target: targetBenchmark, latest: 85, scoreOutOf20: 16, mistakesCount: 2 },
        ],
        strengths: [
          { name: language === 'en' ? 'Vocabulary' : 'Vocabulaire', score: 18, pct: 90, icon: '💡' },
          { name: language === 'en' ? 'Structure' : 'Structure de phrase', score: 17, pct: 85, icon: '🧩' }
        ],
        weaknesses: [
          { name: language === 'en' ? 'Conjugation' : 'Conjugaison / Temps', score: 12, pct: 60, mistakesCount: 7, icon: '⏱️' },
          { name: language === 'en' ? 'Spelling' : 'Orthographe / Accents', score: 13, pct: 65, mistakesCount: 6, icon: '🔤' }
        ]
      };
    }

    if (!hasEvaluatedData) {
      // Return empty radar data so charts still render their structure for new users
      const emptyAxes = [
        { axis: language === 'en' ? 'Grammar' : 'Grammaire', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
        { axis: language === 'en' ? 'Spelling' : 'Orthographe', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
        { axis: language === 'en' ? 'Conjugation' : 'Conjugaison', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
        { axis: language === 'en' ? 'Structure' : 'Structure', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
        { axis: language === 'en' ? 'Vocabulary' : 'Vocabulaire', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
        { axis: language === 'en' ? 'Coherence' : 'Cohérence', current: 0, target: targetBenchmark, latest: 0, scoreOutOf20: 0, mistakesCount: 0 },
      ];
      return {
        chartData: emptyAxes,
        strengths: [],
        weaknesses: []
      };
    }

    // Tally mistakes by canonical category
    const categoryCounts: Record<string, number> = {
      'Grammaire': 0,
      'Orthographe / Accents': 0,
      'Conjugaison / Temps': 0,
      'Structure de phrase': 0,
      'Vocabulaire': 0,
      'Autres': 0
    };

    const latestSub = evaluatedSubmissions[evaluatedSubmissions.length - 1];
    const latestSubId = latestSub?.id;
    const latestCategoryCounts: Record<string, number> = {
      'Grammaire': 0,
      'Orthographe / Accents': 0,
      'Conjugaison / Temps': 0,
      'Structure de phrase': 0,
      'Vocabulaire': 0,
      'Autres': 0
    };

    mistakes.forEach((m) => {
      const cat = normalizeCategory(m.category);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (latestSubId && (m.submission_id === latestSubId || m.exam_title?.includes(latestSub.title))) {
        latestCategoryCounts[cat] = (latestCategoryCounts[cat] || 0) + 1;
      }
    });

    const totalWords = evaluatedSubmissions.reduce((acc, sub) => {
      const w = sub.wordCounts;
      return acc + (w ? (w.task1 || 0) + (w.task2 || 0) + (w.task3 || 0) : 350);
    }, 0) || 400;

    const latestWords = latestSub?.wordCounts
      ? (latestSub.wordCounts.task1 || 0) + (latestSub.wordCounts.task2 || 0) + (latestSub.wordCounts.task3 || 0)
      : 350;

    // Helper to calculate mastery % and integer score/20 given mistakes and words
    const calcMastery = (mistakeCount: number, wordsCount: number) => {
      const safeWords = Math.max(wordsCount, 250);
      const densityPer100 = (mistakeCount / safeWords) * 100;
      const rawScore = 20 - densityPer100 * 2.8;
      const scoreOutOf20 = Math.max(5, Math.min(20, Math.round(rawScore)));
      const pct = Math.round((scoreOutOf20 / 20) * 100);
      return { scoreOutOf20, pct };
    };

    const avgScore = progressStats.avgScore || 13;
    const coherenceOutOf20 = Math.max(6, Math.min(20, Math.round(avgScore)));
    const coherencePct = Math.round((coherenceOutOf20 / 20) * 100);

    const latestCoherenceOutOf20 = Math.max(6, Math.min(20, Math.round(latestSub?.score || avgScore)));
    const latestCoherencePct = Math.round((latestCoherenceOutOf20 / 20) * 100);

    const axesConfig = [
      {
        key: 'Grammaire',
        labelFr: 'Grammaire',
        labelEn: 'Grammar',
        icon: '📘',
        count: categoryCounts['Grammaire'],
        latestCount: latestCategoryCounts['Grammaire'],
      },
      {
        key: 'Orthographe / Accents',
        labelFr: 'Orthographe',
        labelEn: 'Spelling',
        icon: '🔤',
        count: categoryCounts['Orthographe / Accents'],
        latestCount: latestCategoryCounts['Orthographe / Accents'],
      },
      {
        key: 'Conjugaison / Temps',
        labelFr: 'Conjugaison',
        labelEn: 'Conjugation',
        icon: '⏱️',
        count: categoryCounts['Conjugaison / Temps'],
        latestCount: latestCategoryCounts['Conjugaison / Temps'],
      },
      {
        key: 'Structure de phrase',
        labelFr: 'Structure',
        labelEn: 'Structure',
        icon: '🧩',
        count: categoryCounts['Structure de phrase'],
        latestCount: latestCategoryCounts['Structure de phrase'],
      },
      {
        key: 'Vocabulaire',
        labelFr: 'Vocabulaire',
        labelEn: 'Vocabulary',
        icon: '💡',
        count: categoryCounts['Vocabulaire'],
        latestCount: latestCategoryCounts['Vocabulaire'],
      },
      {
        key: 'Cohérence',
        labelFr: 'Cohérence',
        labelEn: 'Coherence',
        icon: '🎯',
        count: 0,
        latestCount: 0,
        customCurrent: coherencePct,
        customScore: coherenceOutOf20,
        customLatest: latestCoherencePct,
      }
    ];

    const chartData = axesConfig.map((item) => {
      const axisName = language === 'en' ? item.labelEn : item.labelFr;
      if (item.key === 'Cohérence') {
        return {
          axis: axisName,
          current: item.customCurrent!,
          target: targetBenchmark,
          latest: item.customLatest!,
          scoreOutOf20: item.customScore!,
          mistakesCount: 0,
          icon: item.icon
        };
      }

      const mastery = calcMastery(item.count, totalWords);
      const latestMastery = calcMastery(item.latestCount, latestWords);

      return {
        axis: axisName,
        current: mastery.pct,
        target: targetBenchmark,
        latest: latestMastery.pct,
        scoreOutOf20: mastery.scoreOutOf20,
        mistakesCount: item.count,
        icon: item.icon
      };
    });

    const sorted = [...chartData].sort((a, b) => b.current - a.current);
    const strengths = sorted.slice(0, 2).map((s) => ({
      name: s.axis,
      score: s.scoreOutOf20,
      pct: s.current,
      icon: s.icon
    }));
    const weaknesses = sorted.slice(-2).reverse().map((w) => ({
      name: w.axis,
      score: w.scoreOutOf20,
      pct: w.current,
      mistakesCount: w.mistakesCount,
      icon: w.icon
    }));

    return {
      chartData,
      strengths,
      weaknesses
    };
  }, [hasEvaluatedData, showDemoPreview, evaluatedSubmissions, mistakes, progressStats, language, currentTargetInfo]);

  return (
    <div className="space-y-6 mb-8">
      {/* Neomorphic Outer Container with soft 3D elevation */}
      <div className="bg-white border border-white/80 rounded-3xl p-4 sm:p-6 ">
        {/* Filter Toolbar: Throughout Year, Months, and Overall */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-white/60 ">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-extrabold text-slate-700 mr-1">
                    {language === 'en' ? 'Filter:' : 'Filtrer :'}
                  </span>
                  
                  {/* Option 1: All History */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear('all');
                      setSelectedMonth('all');
                      setYearDropdownOpen(false);
                      setMonthDropdownOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedYear === 'all' && selectedMonth === 'all'
                        ? 'bg-blue-600 text-white '
                        : 'bg-white text-slate-700 border border-white/80  hover:text-slate-900'
                    }`}
                  >
                    {language === 'en' ? 'All History' : 'Tout l’historique'}
                  </button>

                  {/* Option 2: Year Dropdown Menu */}
                  <div className="relative" ref={yearDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setYearDropdownOpen((prev) => !prev);
                        setMonthDropdownOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedYear !== 'all'
                          ? 'bg-blue-600 text-white '
                          : 'bg-white text-slate-700 border border-white/80  hover:text-slate-900'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {selectedYear !== 'all'
                          ? `${language === 'en' ? 'Year' : 'Année'} : ${selectedYear}`
                          : (language === 'en' ? 'By Year' : 'Par Année')}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {yearDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl py-1.5 z-50 text-xs font-semibold">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                          {language === 'en' ? 'Select Year' : 'Sélectionner l’année'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYear('all');
                            setYearDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer ${
                            selectedYear === 'all' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{language === 'en' ? 'All Years' : 'Toutes les années'}</span>
                          {selectedYear === 'all' && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                        {availableYears.map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setSelectedYear(yr);
                              setYearDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer ${
                              selectedYear === yr ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                            }`}
                          >
                            <span>{yr}</span>
                            {selectedYear === yr && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Option 3: Month Dropdown Menu */}
                  <div className="relative" ref={monthDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonthDropdownOpen((prev) => !prev);
                        setYearDropdownOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedMonth !== 'all'
                          ? 'bg-blue-600 text-white '
                          : 'bg-white text-slate-700 border border-white/80  hover:text-slate-900'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>
                        {selectedMonth !== 'all'
                          ? `${language === 'en' ? 'Month' : 'Mois'} : ${t(selectedMonth)}`
                          : (language === 'en' ? 'By Month' : 'Par Mois')}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {monthDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-52 max-h-64 overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl py-1.5 z-50 text-xs font-semibold custom-scrollbar">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xs">
                          {language === 'en' ? 'Select Month' : 'Sélectionner le mois'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonth('all');
                            setMonthDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer ${
                            selectedMonth === 'all' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{language === 'en' ? 'All Months' : 'Tous les mois'}</span>
                          {selectedMonth === 'all' && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                        {availableMonths.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(m);
                              setMonthDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer ${
                              selectedMonth === m ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                            }`}
                          >
                            <span>{t(m)}</span>
                            {selectedMonth === m && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side info & Reset button */}
                <div className="flex items-center gap-2">
                  {(!hasEvaluatedData || showDemoPreview) && (
                    <button
                      type="button"
                      onClick={() => setShowDemoPreview(!showDemoPreview)}
                      className="px-2.5 py-1 rounded-xl bg-white/90 border border-indigo-200 text-indigo-700 text-[11px] font-bold hover:bg-white transition-all cursor-pointer flex items-center gap-1 shadow-2xs mr-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>{showDemoPreview ? (language === 'en' ? 'Hide Demo' : 'Masquer démo') : (language === 'en' ? 'Sample Preview' : 'Aperçu démo')}</span>
                    </button>
                  )}
                  <span className="text-[11px] font-bold text-slate-600">
                    ({activeProgressData.length} {activeProgressData.length > 1 ? (language === 'en' ? 'sessions' : 'examens') : (language === 'en' ? 'session' : 'examen')})
                  </span>
                  {(selectedYear !== 'all' || selectedMonth !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedYear('all');
                        setSelectedMonth('all');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      {language === 'en' ? 'Reset' : 'Effacer'}
                    </button>
                  )}
                </div>
              </div>

              {/* Both Graphs Grid with Neomorphic Popping-Out Blue Theme Cards — always visible */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

                
                {/* ----------------- GRAPH 1: SCORE PROGRESS OVER TIME (THEME BLUE CARD) ----------------- */}
                <div className="flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#ebf3fc] via-[#e6f0fa] to-[#e0ecf8] border border-blue-200/80  transition-all">
                  <div>
                    {/* Graph 1 Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span>{language === 'en' ? 'Score Progress & CEFR Band Levels' : 'Évolution des Scores & Niveaux CECRL'}</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {language === 'en'
                            ? 'Scaled out of 20 (integer 0-20), with CEFR thresholds and user target line.'
                            : 'Échelle sur 20 (entiers positifs 0 à 20) avec paliers CECRL et ligne d’objectif.'}
                        </p>
                      </div>

                      {/* Average Pill (Strict Integer No Decimals) */}
                      {progressStats.avgScore > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
                            {language === 'en' ? 'Average' : 'Moyenne'}
                          </span>
                          <span className="text-xs font-black text-blue-700 bg-white/95 border border-blue-200  px-3 py-1 rounded-2xl inline-block mt-0.5">
                            {progressStats.avgScore}/20 • {progressStats.avgCefr}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Axis Labels Guide Info Banner */}
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-white/80 px-3 py-1.5 rounded-xl border border-blue-200/70 shadow-2xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span><strong>Axe Y (Vertical) :</strong> Note sur 20 & Paliers CECRL</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span><strong>Axe X (Horizontal) :</strong> Date des Sessions</span>
                      </div>
                    </div>

                    {/* Progress Chart Container */}
                    {activeProgressData.length === 0 && !hasEvaluatedData && selectedYear === 'all' && selectedMonth === 'all' ? (
                      /* New user: show empty chart structure with grid/axes but no data */
                      <div className="h-64 sm:h-72 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={[]}
                            margin={{ top: 15, right: 35, left: 0, bottom: 24 }}
                          >
                          <defs>
                            <linearGradient id="scoreGradientNeomorphEmpty" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.6} vertical={false} />
                          <YAxis
                            domain={[0, 20]}
                            ticks={[0, 4, 7, 10, 14, 18, 20]}
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickFormatter={(val) => `${Math.round(val)}`}
                            label={{
                              value: language === 'en' ? 'Score (/20)' : 'Note (/20)',
                              angle: -90,
                              position: 'insideLeft',
                              offset: 12,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />
                          <YAxis
                            yAxisId="cefr"
                            orientation="right"
                            domain={[0, 20]}
                            ticks={[2, 5, 8.5, 12, 16, 19]}
                            stroke="#64748b"
                            fontSize={10}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              if (val >= 18) return 'C2';
                              if (val >= 14) return 'C1';
                              if (val >= 10) return 'B2';
                              if (val >= 7) return 'B1';
                              if (val >= 4) return 'A2';
                              return 'A1';
                            }}
                            label={{
                              value: language === 'en' ? 'CEFR Level' : 'Niveau CECRL',
                              angle: 90,
                              position: 'insideRight',
                              offset: 12,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />
                          <XAxis
                            dataKey="shortDate"
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            label={{
                              value: language === 'en' ? 'Exam Sessions (Date)' : 'Sessions d\'examen (Date)',
                              position: 'insideBottom',
                              offset: -14,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />
                          <ReferenceArea y1={currentTargetInfo.targetThreshold} y2={20} fill="#3b82f6" fillOpacity={0.04} />
                          <ReferenceLine
                            y={currentTargetInfo.targetThreshold}
                            stroke="#10b981"
                            strokeDasharray="3 3"
                            strokeWidth={1.8}
                            label={{
                              value: `\uD83C\uDFAF Cible ${currentTargetInfo.level} (${currentTargetInfo.clb})`,
                              position: 'insideBottomRight',
                              fill: '#059669',
                              fontSize: 10,
                              fontWeight: '700'
                            }}
                          />
                          <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2.8} fill="url(#scoreGradientNeomorphEmpty)" />
                          </AreaChart>
                        </ResponsiveContainer>
                        {/* Subtle overlay hint for new users */}
                        <div className="text-center -mt-32 relative z-10">
                          <p className="text-xs font-bold text-slate-400">
                            {language === 'en' ? 'Your score progress will appear here' : 'Votre progression apparaîtra ici'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {language === 'en' ? 'Submit & evaluate an exam to start tracking' : 'Soumettez et évaluez un examen pour commencer'}
                          </p>
                        </div>
                      </div>
                    ) : activeProgressData.length === 0 ? (
                      /* Filtered to zero: show filter message */
                      <div className="h-64 sm:h-72 w-full mt-2 flex flex-col items-center justify-center p-6 text-center rounded-2xl bg-white/70 border border-blue-200/60 shadow-inner">
                        <Calendar className="w-8 h-8 text-blue-500 mb-2" />
                        <p className="text-xs font-bold text-slate-800 mb-1">
                          {language === 'en'
                            ? 'No sessions found for the selected period.'
                            : 'Aucun examen trouvé pour la période sélectionnée.'}
                        </p>
                        <p className="text-[11px] text-slate-500 mb-3 max-w-xs">
                          {language === 'en'
                            ? 'Try picking a different year or month, or reset to view all.'
                            : 'Choisissez une autre année ou un autre mois, ou réinitialisez le filtre.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedYear('all');
                            setSelectedMonth('all');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          {language === 'en' ? 'Show All History' : 'Afficher tout l’historique'}
                        </button>
                      </div>
                    ) : (
                      <div className="h-64 sm:h-72 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={activeProgressData}
                            margin={{ top: 15, right: 35, left: 0, bottom: 24 }}
                          >
                          <defs>
                            <linearGradient id="scoreGradientNeomorph" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.6} vertical={false} />
                          
                          {/* Left Y-Axis: Score / 20 (Strict Integer positive 0 to 20) with Explicit Axis Label */}
                          <YAxis
                            domain={[0, 20]}
                            ticks={[0, 4, 7, 10, 14, 18, 20]}
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            tickFormatter={(val) => `${Math.round(val)}`}
                            label={{
                              value: language === 'en' ? 'Score (/20)' : 'Note (/20)',
                              angle: -90,
                              position: 'insideLeft',
                              offset: 12,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />

                          {/* Right Y-Axis: CEFR Band Levels corresponding to scores */}
                          <YAxis
                            yAxisId="cefr"
                            orientation="right"
                            domain={[0, 20]}
                            ticks={[2, 5, 8.5, 12, 16, 19]}
                            stroke="#64748b"
                            fontSize={10}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                              if (val >= 18) return 'C2';
                              if (val >= 14) return 'C1';
                              if (val >= 10) return 'B2';
                              if (val >= 7) return 'B1';
                              if (val >= 4) return 'A2';
                              return 'A1';
                            }}
                            label={{
                              value: language === 'en' ? 'CEFR Level' : 'Niveau CECRL',
                              angle: 90,
                              position: 'insideRight',
                              offset: 12,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />

                          {/* X-Axis: Exam Sessions with Explicit Axis Label */}
                          <XAxis
                            dataKey="shortDate"
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            label={{
                              value: language === 'en' ? 'Exam Sessions (Date)' : 'Sessions d’examen (Date)',
                              position: 'insideBottom',
                              offset: -14,
                              fill: '#475569',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />

                          {/* Highlighted Target Zone from target threshold up to 20 */}
                          <ReferenceArea
                            y1={currentTargetInfo.targetThreshold}
                            y2={20}
                            fill="#3b82f6"
                            fillOpacity={0.04}
                          />

                          {/* Horizontal Reference Line for User's Average Score (INTEGER) */}
                          {progressStats.avgScore > 0 && (
                            <ReferenceLine
                              y={progressStats.avgScore}
                              stroke="#6366f1"
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{
                                value: `${language === 'en' ? 'Avg' : 'Moy'}: ${progressStats.avgScore}/20 (${progressStats.avgCefr})`,
                                position: 'insideTopLeft',
                                fill: '#4338ca',
                                fontSize: 10,
                                fontWeight: 'bold'
                              }}
                            />
                          )}

                          {/* Dynamic Target Goal Line set by the user */}
                          <ReferenceLine
                            y={currentTargetInfo.targetThreshold}
                            stroke="#10b981"
                            strokeDasharray="3 3"
                            strokeWidth={1.8}
                            label={{
                              value: `🎯 Cible ${currentTargetInfo.level} (${currentTargetInfo.clb})`,
                              position: 'insideBottomRight',
                              fill: '#059669',
                              fontSize: 10,
                              fontWeight: '700'
                            }}
                          />

                          {/* Custom Tooltip showing INTEGER scores */}
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as ProgressDataPoint;
                                return (
                                  <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl text-xs border border-slate-700 space-y-1.5 max-w-xs">
                                    <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 gap-2">
                                      <span className="font-bold text-slate-200 truncate">{data.title}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{data.date}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between pt-0.5">
                                      <span className="text-slate-300">{language === 'en' ? 'Score' : 'Note'} :</span>
                                      <span className="text-base font-black text-blue-400">
                                        {Math.round(data.score)} <span className="text-xs font-normal text-slate-400">/ 20</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-300">{language === 'en' ? 'CEFR Level' : 'Palier CECRL'} :</span>
                                      <span className="px-2 py-0.5 rounded-xl font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {data.cefr} ({data.clb})
                                      </span>
                                    </div>
                                    {(data.task1Level || data.task2Level || data.task3Level) && (
                                      <div className="pt-2 border-t border-slate-700/80">
                                        <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">
                                          {language === 'en' ? 'Tasks CEFR Level:' : 'Niveau CECRL par tâche :'}
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                                          <div className="bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
                                            <span className="text-slate-400 text-[10px] font-semibold block">T1</span>
                                            <span className="font-black text-blue-400">{data.task1Level ?? '—'}</span>
                                          </div>
                                          <div className="bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
                                            <span className="text-slate-400 text-[10px] font-semibold block">T2</span>
                                            <span className="font-black text-blue-400">{data.task2Level ?? '—'}</span>
                                          </div>
                                          <div className="bg-slate-800/90 px-2 py-1 rounded-xl border border-slate-700">
                                            <span className="text-slate-400 text-[10px] font-semibold block">T3</span>
                                            <span className="font-black text-blue-400">{data.task3Level ?? '—'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />

                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#2563eb"
                            strokeWidth={2.8}
                            fill="url(#scoreGradientNeomorph)"
                            activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2.5 }}
                            dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    )}
                  </div>

                  {/* CEFR Level Bands Guide Bar: ALL CLICKABLE TO SET TARGET GOAL, FULLY ROUNDED SHAPES */}
                  <div className="mt-4 pt-3.5 border-t border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                          {language === 'en' ? 'Choose Your Target Goal (Click Level):' : 'Choisissez Votre Objectif (Cliquez un niveau) :'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{language === 'en' ? `Target: ${targetGoal} (${currentTargetInfo.clb})` : `Objectif actif : ${targetGoal} (${currentTargetInfo.clb})`}</span>
                      </span>
                    </div>

                    {/* 6 Clickable, Rounded Neomorphic Pills */}
                    <div className="grid grid-cols-6 gap-2 text-center">
                      {CEFR_BANDS.slice().reverse().map((band) => {
                        const isTarget = targetGoal === band.level;
                        const isUserAverage = progressStats.avgCefr === band.level;

                        return (
                          <button
                            key={band.level}
                            type="button"
                            onClick={() => handleSelectTargetGoal(band.level)}
                            className={`py-2 px-1 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                              isTarget
                                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black border border-blue-400  scale-105'
                                : 'bg-white/95 text-slate-700 border border-blue-200/80  hover: hover:scale-[1.02] hover:border-blue-300'
                            }`}
                            title={`Cliquez pour définir votre objectif sur ${band.level} (${band.clb}) : ${band.minScore}-${band.maxScore}/20`}
                          >
                            {/* Current user average indicator dot */}
                            {isUserAverage && !isTarget && (
                              <span
                                className="absolute -top-1.5 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white shadow-xs"
                                title="Votre niveau moyen actuel"
                              />
                            )}
                            <div className="text-xs font-black leading-tight flex items-center gap-0.5">
                              <span>{band.level}</span>
                              {isTarget && <span className="text-[10px]">🎯</span>}
                            </div>
                            <div className={`text-[9px] font-semibold mt-0.5 ${isTarget ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {band.minScore}-{band.maxScore}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ----------------- GRAPH 2: STRENGTH & WEAKNESS RADAR CHART (THEME BLUE CARD) ----------------- */}
                {radarData && (
                  <div className="flex flex-col justify-between p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#ebf3fc] via-[#e6f0fa] to-[#e0ecf8] border border-blue-200/80  transition-all">
                    <div>
                      {/* Graph 2 Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-600" />
                            <span>{language === 'en' ? 'Competency Profile: Strengths & Weaknesses' : 'Profil de Compétences : Forces & Faiblesses'}</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {language === 'en'
                              ? 'Spider radar based on mistake frequency across 6 criteria.'
                              : 'Radar hexagonal basé sur vos fautes par rapport à votre objectif.'}
                          </p>
                        </div>

                        {/* Top-Right Legend matching user's image */}
                        <div className="flex items-center gap-3 text-xs font-bold bg-white/95 px-3 py-1.5 rounded-2xl border border-blue-200 ">
                          <div className="flex items-center gap-1.5 text-blue-600">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-xs"></span>
                            <span className="text-[11px] font-extrabold">
                              {radarMode === 'latest'
                                ? (language === 'en' ? 'Latest' : 'Dernier')
                                : (language === 'en' ? 'Your Level' : 'Votre Niveau')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs"></span>
                            <span className="text-[11px] font-extrabold">
                              {radarMode === 'latest'
                                ? (language === 'en' ? 'Average' : 'Moyenne')
                                : (language === 'en' ? `Target ${targetGoal}` : `Objectif ${targetGoal}`)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Goal Selector directly beside/above strength & weakness */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/80 border border-blue-200/80 shadow-2xs my-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-700">
                            {language === 'en' ? 'Target Goal Benchmark:' : 'Palier de référence cible :'}
                          </span>
                        </div>
                        {/* Target Selection Pills */}
                        <div className="flex items-center gap-1">
                          {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CefrLevel[]).map((lvl) => {
                            const isSelected = targetGoal === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleSelectTargetGoal(lvl)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500 text-white  scale-105'
                                    : 'bg-white/95 text-slate-700 border border-blue-200/70 hover:border-blue-400 hover:text-slate-900 '
                                }`}
                              >
                                {lvl}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Radar Chart Container */}
                      <div className="h-64 sm:h-72 w-full mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart
                            cx="50%"
                            cy="50%"
                            outerRadius="75%"
                            data={radarData.chartData}
                          >
                            {/* Concentric hexagonal grid lines */}
                            <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                            
                            {/* Axes Labels */}
                            <PolarAngleAxis
                              dataKey="axis"
                              tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                            />
                            
                            {/* Concentric radius axis (0% to 100%) */}
                            <PolarRadiusAxis
                              angle={30}
                              domain={[0, 100]}
                              tick={{ fill: '#64748b', fontSize: 9 }}
                              tickFormatter={(val) => `${Math.round(val)}%`}
                              stroke="#94a3b8"
                            />

                            {/* Series 1: Blue Radar (User Current / Latest) */}
                            <Radar
                              name={radarMode === 'latest' ? (language === 'en' ? 'Latest' : 'Dernier') : (language === 'en' ? 'Your Level' : 'Votre Niveau')}
                              dataKey={radarMode === 'latest' ? 'latest' : 'current'}
                              stroke="#2563eb"
                              fill="#3b82f6"
                              fillOpacity={0.28}
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#2563eb', strokeWidth: 1.5, stroke: '#ffffff' }}
                            />

                            {/* Series 2: Orange Radar (Target Goal Benchmark or Average) */}
                            <Radar
                              name={radarMode === 'latest' ? (language === 'en' ? 'Average' : 'Moyenne') : (language === 'en' ? `Target ${targetGoal}` : `Objectif ${targetGoal}`)}
                              dataKey={radarMode === 'latest' ? 'current' : 'target'}
                              stroke="#f59e0b"
                              fill="#f59e0b"
                              fillOpacity={0.18}
                              strokeWidth={2.5}
                              dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 1.5, stroke: '#ffffff' }}
                            />

                            {/* Radar Tooltip */}
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const isStrong = data.current >= (currentTargetInfo.targetMasteryPct - 10);
                                  return (
                                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl text-xs border border-slate-700 space-y-1 max-w-xs">
                                      <div className="flex items-center justify-between border-b border-slate-700 pb-1 font-bold text-slate-200">
                                        <span>{data.axis}</span>
                                        <span className={isStrong ? 'text-emerald-400' : 'text-amber-400'}>
                                          {isStrong ? '💪 Force' : '⚠️ Point à travailler'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between pt-0.5">
                                        <span className="text-slate-300">{language === 'en' ? 'Mastery' : 'Maîtrise'} :</span>
                                        <span className="font-black text-blue-400">{Math.round(data.current)}% ({Math.round(data.scoreOutOf20)}/20)</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-300">{language === 'en' ? `Target ${targetGoal}` : `Cible ${targetGoal}`} :</span>
                                        <span className="font-black text-amber-400">{Math.round(data.target)}%</span>
                                      </div>
                                      {data.axis !== (language === 'en' ? 'Coherence' : 'Cohérence') && (
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                                          <span>{language === 'en' ? 'Total mistakes' : 'Fautes enregistrées'} :</span>
                                          <span className="font-mono text-slate-200">{data.mistakesCount}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Strengths & Weaknesses Key Insights Breakdown with Neomorphic Inset Cards */}
                    <div className="mt-4 pt-3.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Top Strengths */}
                      <div className="p-3 rounded-2xl bg-[#eef8f2] border border-white/80 ">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 mb-1.5">
                          <span>💪</span>
                          <span>{language === 'en' ? 'Key Strengths' : 'Vos Points Forts'}</span>
                        </div>
                        <div className="space-y-1">
                          {radarData.strengths.length > 0 ? radarData.strengths.map((str) => (
                            <div key={str.name} className="flex items-center justify-between text-[11px] text-emerald-900">
                              <span className="truncate font-semibold">{str.name}</span>
                              <span className="font-mono font-black">{Math.round(str.score)}/20 ({Math.round(str.pct)}%)</span>
                            </div>
                          )) : (
                            <p className="text-[11px] text-emerald-600 italic">
                              {language === 'en' ? 'Evaluate exams to discover your strengths' : 'Évaluez des examens pour découvrir vos forces'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Priority Weaknesses */}
                      <div className="p-3 rounded-2xl bg-[#fff8eb] border border-white/80 ">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 mb-1.5">
                          <span>⚠️</span>
                          <span>{language === 'en' ? 'Areas to Improve' : 'Points à Travailler'}</span>
                        </div>
                        <div className="space-y-1">
                          {radarData.weaknesses.length > 0 ? radarData.weaknesses.map((w) => (
                            <div key={w.name} className="flex items-center justify-between text-[11px] text-amber-900">
                              <span className="truncate font-semibold">{w.name}</span>
                              <span className="font-mono font-black">
                                {Math.round(w.score)}/20 {w.mistakesCount !== undefined && w.mistakesCount > 0 ? `(${w.mistakesCount} err.)` : `(${Math.round(w.pct)}%)`}
                              </span>
                            </div>
                          )) : (
                            <p className="text-[11px] text-amber-600 italic">
                              {language === 'en' ? 'Evaluate exams to identify areas to improve' : 'Évaluez des examens pour identifier les points à travailler'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
      </div>
    </div>
  );
};
