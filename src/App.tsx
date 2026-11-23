import { useWorkspace, WorkspaceProvider } from "./context/WorkspaceContext";
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { Home } from "./pages/Home";
import { SplashScreen } from "./pages/SplashScreen";
import { AppLayout, AppView } from "./components/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import type { ExamResult, TaskKey } from "./types/exam";
import { DRAFT_KEY, QuestionEntry, makeSession, PracticeSession, resultTimestamp, combinationProgress } from "./utils/practice";
import {
  getCachedQuestions,
  loadQuestions,
  useQuestions,
} from "./utils/questionsLoader";

const PracticeLibrary = lazy(() =>
  import("./pages/PracticeLibrary").then((m) => ({ default: m.PracticeLibrary })),
);
const Simulator = lazy(() =>
  import("./pages/Simulator").then((m) => ({ default: m.Simulator })),
);
const Results = lazy(() =>
  import("./pages/Results").then((m) => ({ default: m.Results })),
);
const Templates = lazy(() =>
  import("./pages/Templates").then((m) => ({ default: m.Templates })),
);
const Analytics = lazy(() => import("./pages/Analytics").then(m => ({ default: m.Analytics })));
const Progress = lazy(() =>
  import("./pages/Progress").then((m) => ({ default: m.Progress })),
);
const Notebook = lazy(() =>
  import("./pages/Notebook").then((m) => ({ default: m.Notebook })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
import { syncAccountHistory } from "./services/submissionSync";
import { syncLearningProgress } from "./services/learningProgress";
const validViews: AppView[] = [
  "home",
  "library",
  "templates",
  "simulator",
  "results",
  "dashboard",
  "analytics",
  "notebook",
  "settings",
  "login",
];
function route() {
  const [view, id, task] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    view: validViews.includes(view as AppView)
      ? (view as AppView)
      : ("home" as AppView),
    id,
    task: task === "task1" || task === "task2" || task === "task3" ? task as TaskKey : undefined,
  };
}
function MainRouter() {
  const { getStoredSubmissions, saveSubmission, updateStoredSubmission, loadPracticeSession, savePracticeSession, saveEvaluationMistakes, store } = useWorkspace();
  const { user, userName, isConfigured, isPasswordRecovery, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const en = language === "en";
  const [reviewTask, setReviewTask] = useState(route().task);
  const [view, setView] = useState<AppView>(() => route().view);
  const [submissions, setSubmissions] = useState(() =>
    getStoredSubmissions().sort(
      (a, b) => resultTimestamp(b) - resultTimestamp(a),
    ),
  );
  const progressBySet = useMemo(() => combinationProgress(submissions), [submissions]);
  const [draft, setDraft] = useState<PracticeSession | null>(
    loadPracticeSession,
  );
  const [guestDismissed, setGuestDismissed] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem("tcf_splash_dismissed") === "1" ||
        (location.hash.length > 2 &&
          location.hash !== "#/home" &&
          location.hash !== "#/login")
      );
    } catch {
      return false;
    }
  });
  const [active, setActive] = useState<ExamResult | null>(
    () => getStoredSubmissions().find((s) => s.id === route().id) || null,
  );
  const showSplash =
    isPasswordRecovery ||
    view === "login" ||
    (!authLoading && !user && !guestDismissed && view === "home");
  const { questions } = useQuestions(view === "home" && !showSplash);
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [progressVersion, setProgressVersion] = useState(0);
  const [progressError, setProgressError] = useState(false);
  const syncProgress = async () => {
    try {
      if (await syncLearningProgress(store)) setProgressVersion(v => v + 1);
      setProgressError(false);
    } catch {
      setProgressError(true);
    }
  };
  useEffect(() => {
    if (!user || !isConfigured) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncProgress(), 250);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === store.progressKey) {
        setProgressVersion(v => v + 1);
        schedule();
      }
    };
    const unsubscribe = store.subscribe(schedule);
    window.addEventListener("storage", storageChanged);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("storage", storageChanged);
    };
  }, [store, isConfigured]);
  const syncedUser = useRef("");
  const refresh = () => {
    setSubmissions(
      getStoredSubmissions().sort(
        (a, b) => resultTimestamp(b) - resultTimestamp(a),
      ),
    );
    setDraft(loadPracticeSession());
  };
  const navigate = (next: AppView, result?: ExamResult, task?: TaskKey) => {
    setReviewTask(task);
    if (result) setActive(result);
    setView(next);
    location.hash = `/${next}${next === "results" && result?.id ? "/" + result.id + (task ? "/" + task : "") : ""}`;
  };
  useEffect(() => {
    const onHash = () => {
      const next = route();
      setView(next.view);
      setReviewTask(next.task);
      if (next.view === "results" && next.id)
        setActive(getStoredSubmissions().find((s) => s.id === next.id) || null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const syncQueue = useRef(Promise.resolve());
  const sync = () => {
    syncQueue.current = syncQueue.current.then(syncAccount, syncAccount);
    return syncQueue.current;
  };
  const syncAccount = async () => {
    if (!user || !isConfigured) return;
    const progress = syncProgress();
    setSyncStatus(en ? "Syncing account…" : "Synchronisation du compte…");
    try {
      await syncAccountHistory(store);
      refresh();
      if (route().view === "results") setActive(getStoredSubmissions().find(s => s.id === route().id) ?? null);
      setSyncStatus(
        en
          ? "Writing history synced. Your drafts stay on this device."
          : "Historique synchronisé. Vos brouillons restent sur cet appareil.",
      );
    } catch (e) {
      setSyncStatus(
        en
          ? "Cloud sync unavailable. Your local work is still available."
          : "Synchronisation indisponible. Votre travail local reste accessible.",
      );
    }
    await progress;
  };
  useEffect(() => {
    if (user && isConfigured && syncedUser.current !== user.id) {
      syncedUser.current = user.id;
      void sync();
    }
    const reconnect = () => void sync();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [user?.id, isConfigured]);
  const start = (
    entry: QuestionEntry,
    task: TaskKey | "exam",
    revision?: ExamResult,
  ) => {
    if (
      draft &&
      !window.confirm(
        en
          ? "Replace your unfinished session? Its current draft will be replaced. Export a backup in Settings first if you want to keep it."
          : "Remplacer la séance en cours ? Son brouillon sera remplacé. Exportez d’abord une sauvegarde dans les réglages si vous souhaitez le conserver.",
      )
    )
      return;
    const session = makeSession(entry, task, revision);
    if (!savePracticeSession(session)) {
      setNotice(
        en
          ? "Cannot save a draft. Browser storage is unavailable. Export a backup before continuing."
          : "Impossible de sauvegarder un brouillon. Le stockage est indisponible. Exportez une sauvegarde avant de continuer.",
      );
      return;
    }
    setDraft(session);
    setNotice("");
    navigate("simulator");
  };
  const quickStart = async (task: TaskKey | "exam") => {
    const pool = getCachedQuestions() || (await loadQuestions());
    const available = pool.filter(
      (q) =>
        (task !== "exam" && task !== "task3") ||
        Boolean(
          q.combination.tasks.task3.document1?.trim() &&
          q.combination.tasks.task3.document2?.trim(),
        ),
    );
    const entry =
      available.find(q => {
        const progress = progressBySet.get(q.id);
        return !(task === "exam" ? progress?.mockCompleted : progress?.tasks.has(task));
      }) || available[0];
    if (entry) start(entry, task);
  };
  const saveReview = (result: ExamResult) => {
    const stored = updateStoredSubmission({ ...result, pendingAccountSave: Boolean(user && isConfigured) });
    if (!stored) {
      setActive((previous) => (previous?.id === result.id ? result : previous));
      setNotice(
        en
          ? "The review was generated but could not be saved. Keep this page open and copy the feedback before freeing browser storage."
          : "Le bilan a été généré mais n’a pas pu être sauvegardé. Gardez cette page ouverte et copiez le bilan avant de libérer du stockage.",
      );
      return;
    }
    saveEvaluationMistakes(result.aiEvaluation!, result);
    setActive((previous) => (previous?.id === result.id ? result : previous));
    refresh();
    if (user && isConfigured) void sync();
  };
  const finish = (result: ExamResult): boolean => {
    const saved = saveSubmission({ ...result, pendingAccountSave: Boolean(user && isConfigured) });
    if (!getStoredSubmissions().some((s) => s.id === saved.id)) {
      setNotice(
        en
          ? "Your response could not be saved. Keep this page open and export a backup."
          : "Votre texte n’a pas pu être enregistré. Gardez cette page ouverte et exportez une sauvegarde.",
      );
      return false;
    }
    store.removeItem(DRAFT_KEY);
    setDraft(null);
    refresh();
    navigate("results", saved);
    if (user && isConfigured) void sync();
    return true;
  };
  const name = user ? userName : en ? "My workspace" : "Mon espace";
  const content = () => {
    if (view === "simulator" && draft)
      return (
        <Simulator
          key={draft.sessionId}
          initialSession={draft}
          onDraftChange={setDraft}
          onFinishExam={finish}
          onCancelExam={() => navigate("home")}
        />
      );
    if (view === "results" && active)
      return (
        <Results
          key={active.id + (reviewTask || "")}
          initialTask={reviewTask}
          result={active}
          onSave={saveReview}
          onRevise={(s, key) =>
            start(
              {
                id: `${s.year}-${s.month}-${s.combination.combinationNumber}`,
                year: s.year,
                month: s.month,
                combination: s.combination,
              },
              key,
              s,
            )
          }
          onHomeClick={() => navigate("home")}
          onSettings={() => navigate("settings")}
          onNotebook={() => navigate("notebook")}
          onLogin={() => navigate("login")}
        />
      );
    if (view === "library")
      return <PracticeLibrary key={progressVersion} onStart={start} progressBySet={progressBySet} />;
    if (view === "templates")
      return <Templates onPractice={() => navigate("library")} />;
    if (view === "analytics")
      return <Analytics submissions={submissions} onOpen={(s, task) => navigate("results", s, task)} onPractice={() => navigate("library")} />;
    if (view === "dashboard")
      return (
        <Progress
          submissions={submissions}
          onOpen={(s) => navigate("results", s)}
          onPractice={() => navigate("library")}
        />
      );
    if (view === "notebook")
      return <Notebook key={progressVersion} onPractice={() => navigate("library")} />;
    if (view === "settings")
      return (
        <Settings
          onLogin={() => navigate("login")}
          onDataChange={refresh}
          onSync={sync}
          syncStatus={syncStatus}
        />
      );
    if (view === "login")
      return (
        <SplashScreen
          onSuccess={() => {
            setGuestDismissed(true);
            navigate("home");
          }}
          onContinueGuest={() => {
            try {
              sessionStorage.setItem("tcf_splash_dismissed", "1");
            } catch { }
            setGuestDismissed(true);
            navigate("home");
          }}
        />
      );
    return (
      <Home
        progressBySet={progressBySet}
        name={user ? userName : ""}
        submissions={submissions}
        draft={draft}
        onResume={() => navigate("simulator")}
        onPractice={quickStart}
        questions={questions}
        onProgress={() => navigate("dashboard")}
        onStart={start}
        onLibrary={() => navigate("library")}
        onOpen={(s) => navigate("results", s)}
      />
    );
  };

  if (showSplash) {
    return (
      <SplashScreen
        onSuccess={() => {
          setGuestDismissed(true);
          navigate("home");
        }}
        onContinueGuest={() => {
          try {
            sessionStorage.setItem("tcf_splash_dismissed", "1");
          } catch { }
          setGuestDismissed(true);
          navigate("home");
        }}
      />
    );
  }

  return (
    <AppLayout view={view} onNavigate={navigate} name={name} hasDraft={!!draft}>
      {progressError && <p className="notice warning" role="status">{en
        ? "Learning progress sync is unavailable. Changes are saved on this device. Retry in Settings."
        : "La synchronisation de votre progression est indisponible. Les changements sont enregistrés sur cet appareil. Réessayez dans les réglages."}</p>}
      {notice && (
        <div className="notice warning" role="alert">
          {notice}
          <button className="text-button" onClick={() => navigate("settings")}>
            {en ? "Open settings" : "Ouvrir les réglages"}
          </button>
        </div>
      )}
      <Suspense
        fallback={
          <div className="panel" role="status" aria-live="polite">
            <p className="muted text-small">
              {en ? "Loading workspace…" : "Chargement de l’espace…"}
            </p>
          </div>
        }
      >
        {content()}
      </Suspense>
    </AppLayout>
  );
}
export function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider><MainRouter /></WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
