import React, { useState, useEffect, useRef } from 'react';
import { Home } from './pages/Home';
import { Simulator } from './pages/Simulator';
import { Results } from './pages/Results';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Feedback } from './pages/Feedback';
import { AppLayout } from './components/AppLayout';
import { ExamCombination, ExamResult, TaskKey } from './types/exam';
import { saveSubmission, getStoredSubmissions, syncStoredSubmissions, mergeSubmissions } from './utils/storage';
import { getStoredMistakes } from './utils/mistakesStorage';
import { MistakesRevisionModal } from './components/MistakesRevisionModal';
import { saveSubmissionToSupabase, fetchSubmissionsFromSupabase } from './lib/supabase';
import { getLocalISOString } from './utils/dateUtils';
import { AuthProvider, useAuth } from './context/AuthContext';
import { sendSubmissionNotification } from './services/notificationService';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

const MainRouter: React.FC = () => {
  const { user, loading, isEmailVerified, signOut, isAdmin, isConfigured } = useAuth();
  const { t } = useLanguage();

  const [view, setView] = useState<'home' | 'simulator' | 'results' | 'dashboard' | 'feedback'>('home');
  const [dashboardTab, setDashboardTab] = useState<'submissions' | 'mistakes' | 'admin'>('submissions');

  // Auto-redirect returning users with evaluated submissions to Dashboard on first load
  const hasAutoRedirected = useRef(false);
  const [activeCombo, setActiveCombo] = useState<ExamCombination | null>(null);
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [activeMonth, setActiveMonth] = useState<string>('Septembre');
  const [startedAt, setStartedAt] = useState<string>('');
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [practiceTask, setPracticeTask] = useState<TaskKey>('task1');
  const [practiceTasks, setPracticeTasks] = useState<TaskKey[]>(['task1']);
  const [practiceDuration, setPracticeDuration] = useState<number>(60);
  const [submissionsCount, setSubmissionsCount] = useState<number>(() => {
    try {
      return getStoredSubmissions().length;
    } catch {
      return 0;
    }
  });
  const [mistakesCount, setMistakesCount] = useState<number>(() => {
    try {
      return getStoredMistakes().length;
    } catch {
      return 0;
    }
  });
  const [retakePendingCombo, setRetakePendingCombo] = useState<{ combo: ExamCombination; year: string; month: string } | null>(null);
  const [showRetakeMistakesModal, setShowRetakeMistakesModal] = useState<boolean>(false);

  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    try {
      setSubmissionsCount(getStoredSubmissions().length);
      setMistakesCount(getStoredMistakes().length);
    } catch {}
  }, [view]);

  // Auto-redirect: if user is authenticated and has past AI-evaluated submissions,
  // send them to the Dashboard (with analytics) instead of the Exam Selector on first load.
  useEffect(() => {
    if (hasAutoRedirected.current) return;
    if (loading || !user) return;

    try {
      const stored = getStoredSubmissions();
      const hasEvaluated = stored.some(
        (s) => s.aiEvaluation && (s.aiEvaluation.pedagogical || typeof s.aiEvaluation.overall_score === 'number')
      );
      if (hasEvaluated) {
        hasAutoRedirected.current = true;
        setDashboardTab('submissions');
        setView('dashboard');
        return;
      }

      // If local storage is empty, also check Supabase for returning users on a new device or cleared cache
      if (isConfigured) {
        fetchSubmissionsFromSupabase(user.id).then(({ submissions: dbSubs }) => {
          if (dbSubs && dbSubs.length > 0) {
            const merged = mergeSubmissions(dbSubs, stored);
            syncStoredSubmissions(merged);
            const hasEvalDb = merged.some(
              (s) => s.aiEvaluation && (s.aiEvaluation.pedagogical || typeof s.aiEvaluation.overall_score === 'number')
            );
            if (hasEvalDb && !hasAutoRedirected.current) {
              hasAutoRedirected.current = true;
              setDashboardTab('submissions');
              setView('dashboard');
            }
          }
        }).catch(() => {});
      }
    } catch {
      // fail silently — just stay on exam selector
    }
  }, [loading, user, isConfigured]);

  useEffect(() => {
    let t: any;
    if (loading) {
      t = setTimeout(() => setShowSlowNotice(true), 3500);
    } else {
      setShowSlowNotice(false);
    }
    return () => clearTimeout(t);
  }, [loading]);

  // Automatically scroll to the top of the page whenever the view/route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view]);

  // Keep Neumorphism UI theme active on root
  useEffect(() => {
    document.documentElement.classList.remove('theme-neumorphism', 'neu-theme');
    document.documentElement.classList.remove('dark', 'theme-ocean', 'theme-classic');
    try {
      localStorage.removeItem('tcf_color_theme');
    } catch {}
  }, []);

  // 1. Loading screen while determining auth session
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 text-center"
        style={{ backgroundColor: '#e8edf5', color: '#1e293b' }}
      >
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium text-sm mb-2">Chargement de votre session...</p>
        {showSlowNotice && (
          <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg max-w-xs text-xs text-slate-500 shadow-xs">
            <p className="mb-2">La vérification réseau prend du temps en raison de votre connexion.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-blue-600 text-white font-medium rounded text-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Recharger
            </button>
          </div>
        )}
      </div>
    );
  }

  // 1.5. If view is feedback and user is not authenticated, show standalone Feedback
  if (view === 'feedback' && (!user || !isEmailVerified)) {
    return (
      <Feedback
        onHomeClick={() => setView('home')}
        userEmail={user?.email}
      />
    );
  }

  // 2. Gatekeeper: If user is not logged in OR email is not verified, show Login page as the 1st page
  if (!user || !isEmailVerified) {
    return (
      <Login
        onSuccess={() => {
          hasAutoRedirected.current = false;
          setView('home');
        }}
        onFeedbackClick={() => setView('feedback')}
      />
    );
  }

  // 3. User is authenticated and verified -> give full access to Home, Simulator, Dashboard, and Results
  const handleStartExam = (
    combo: ExamCombination,
    year: string,
    month: string,
    practiceMode: boolean = false,
    task: TaskKey | TaskKey[] = 'task1',
    duration: number = 60
  ) => {
    setActiveCombo(combo);
    setActiveYear(year);
    setActiveMonth(month);
    setIsPracticeMode(practiceMode);
    if (Array.isArray(task)) {
      setPracticeTasks(task);
      setPracticeTask(task[0] || 'task1');
    } else {
      setPracticeTasks([task]);
      setPracticeTask(task);
    }
    setPracticeDuration(duration);
    setStartedAt(getLocalISOString());
    setView('simulator');
  };

  const handleFinishExam = async (result: ExamResult) => {
    let finalResult = result;

    if (user) {
      try {
        const { data, error } = await saveSubmissionToSupabase(
          user.id,
          result,
          startedAt || getLocalISOString(new Date(Date.now() - (result.timeUsedSeconds || 0) * 1000))
        );
        if (data?.id) {
          finalResult = {
            ...result,
            id: data.id
          };
        }
      } catch (err) {
        console.error('Error saving submission to Supabase:', err);
      }
    }

    setStartedAt('');
    const savedLocal = saveSubmission(finalResult);
    setExamResult(savedLocal);
    try {
      setSubmissionsCount(getStoredSubmissions().length);
    } catch {}

    // Trigger Admin Notification for monitored users
    try {
      const candidateEmail = user?.email || localStorage.getItem('tcf_demo_user') || 'utilisateur@tcf.local';
      await Promise.race([
        sendSubmissionNotification(candidateEmail, finalResult),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
    } catch (notifErr) {
      console.warn('Notification execution caught error:', notifErr);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setView('results');
  };

  const handleViewPastSubmission = (result: ExamResult) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setExamResult(result);
    setView('results');
  };

  const handleNavigateToMistakes = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setDashboardTab('mistakes');
    setView('dashboard');
  };

  const handleRetakeCombination = (combo: ExamCombination, year: string, month: string) => {
    const storedMistakes = getStoredMistakes();
    if (storedMistakes && storedMistakes.length > 0) {
      setRetakePendingCombo({ combo, year, month });
      setShowRetakeMistakesModal(true);
    } else {
      handleStartExam(combo, year, month, false, 'task1', 60);
    }
  };

  const handleGoHome = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setView('home');
    setActiveCombo(null);
    setExamResult(null);
    setStartedAt('');
    setIsPracticeMode(false);
  };

  const handleSignOut = async () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await signOut();
    setView('home');
  };

  // Determine layout subtitle and combinationTitle
  const getLayoutSubtitle = () => {
    if (view === 'home') {
      return undefined;
    }
    if (view === 'dashboard') {
      return isAdmin ? t("Espace Administrateur avec gestion des alertes.") : t("Bienvenue sur votre tableau de bord personnel.");
    }
    if (view === 'simulator') {
      return isPracticeMode ? t("Entraînement chronométré") : t("Examen en cours (60 minutes)");
    }
    if (view === 'results') {
      return examResult?.isPracticeMode ? t("Compte-rendu d'entraînement") : t("Compte-rendu de votre session d'examen");
    }
    if (view === 'feedback') {
      return t("Vos retours, suggestions et messages de remerciements");
    }
    return undefined;
  };

  const getLayoutComboTitle = () => {
    if (view === 'simulator' && activeCombo) {
      return `${t('Combinaison')} ${activeCombo.combinationNumber} — ${t(activeMonth)} ${activeYear}`;
    }
    if (view === 'results' && examResult) {
      const comboNum = examResult.combination?.combinationNumber || examResult.combination?.combination;
      return `${t('Combinaison')} ${comboNum} — ${t(examResult.month)} ${examResult.year}`;
    }
    return undefined;
  };

  return (
    <AppLayout
      currentView={view}
      subtitle={getLayoutSubtitle()}
      combinationTitle={getLayoutComboTitle()}
      onNavigateHome={handleGoHome}
      onNavigateDashboard={() => {
        setDashboardTab('submissions');
        setView('dashboard');
      }}
      onNavigateMistakes={handleNavigateToMistakes}
      mistakesCount={mistakesCount}
      isMistakesTabActive={view === 'dashboard' && dashboardTab === 'mistakes'}
      onNavigateFeedback={() => setView('feedback')}
      onStartNewExam={handleGoHome}
      onSignOut={handleSignOut}
      submissionsCount={submissionsCount}
    >
      {view === 'home' && (
        <Home
          hideHeader
          onStartExam={handleStartExam}
          onViewSubmission={handleViewPastSubmission}
          onDashboardClick={() => {
            setDashboardTab('submissions');
            setView('dashboard');
          }}
          onNavigateToMistakes={handleNavigateToMistakes}
          onFeedbackClick={() => setView('feedback')}
          onLogoutClick={handleSignOut}
          userEmail={user.email}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard
          initialTab={dashboardTab}
          onTabChange={(tab) => setDashboardTab(tab === 'mistakes' ? 'mistakes' : 'submissions')}
          onStartNewExam={handleGoHome}
          onViewSubmission={handleViewPastSubmission}
          onRetakeCombination={handleRetakeCombination}
          onHomeClick={handleGoHome}
          onFeedbackClick={() => setView('feedback')}
        />
      )}

      {/* Retake Combination Mistakes Check Modal */}
      {showRetakeMistakesModal && retakePendingCombo && (
        <MistakesRevisionModal
          isOpen={showRetakeMistakesModal}
          mistakes={getStoredMistakes()}
          trainingModeLabel={t('Examen complet (60 minutes)')}
          combinationLabel={`${t('Combinaison')} ${retakePendingCombo.combo.combinationNumber || (retakePendingCombo.combo as any)?.combination || 1} (${t(retakePendingCombo.month)} ${retakePendingCombo.year})`}
          onConfirmStart={() => {
            setShowRetakeMistakesModal(false);
            handleStartExam(retakePendingCombo.combo, retakePendingCombo.year, retakePendingCombo.month, false, 'task1', 60);
            setRetakePendingCombo(null);
          }}
          onGoToMistakes={() => {
            setShowRetakeMistakesModal(false);
            setRetakePendingCombo(null);
            handleNavigateToMistakes();
          }}
          onCancel={() => {
            setShowRetakeMistakesModal(false);
            setRetakePendingCombo(null);
          }}
        />
      )}

      {view === 'simulator' && activeCombo && (
        <Simulator
          hideHeader
          combination={activeCombo}
          year={activeYear}
          month={activeMonth}
          isPracticeMode={isPracticeMode}
          practiceTask={practiceTasks.join(',')}
          practiceTasks={practiceTasks}
          durationMinutes={practiceDuration}
          onFinishExam={handleFinishExam}
          onCancelExam={handleGoHome}
        />
      )}

      {view === 'results' && examResult && (
        <Results
          hideHeader
          result={examResult}
          onHomeClick={handleGoHome}
          onDashboardClick={() => setView('dashboard')}
          onFeedbackClick={() => setView('feedback')}
        />
      )}

      {view === 'feedback' && (
        <Feedback
          hideHeader
          onHomeClick={handleGoHome}
          userEmail={user?.email}
        />
      )}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </LanguageProvider>
  );
};
