import React, { useEffect, useRef, useState } from "react";
import { Home } from "./pages/Home";
import { PracticeLibrary, allQuestions } from "./pages/PracticeLibrary";
import { Simulator } from "./pages/Simulator";
import { Results } from "./pages/Results";
import { Templates } from "./pages/Templates";
import { Progress } from "./pages/Progress";
import { Notebook } from "./pages/Notebook";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { AppLayout, AppView } from "./components/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import type { ExamResult, TaskKey } from "./types/exam";
import {
  DRAFT_KEY,
  QuestionEntry,
  loadPracticeSession,
  makeSession,
  PracticeSession,
  savePracticeSession,
  resultTimestamp,
  practicedKeys,
} from "./utils/practice";
import {
  getStoredSubmissions,
  saveSubmission,
  updateStoredSubmission,
  mergeSubmissions,
  syncStoredSubmissions,
} from "./utils/storage";
import { feedbackWithContext } from "./utils/reviewState";
import { saveEvaluationMistakes } from "./utils/mistakesStorage";
import {
  fetchSubmissionsFromSupabase,
  saveSubmissionToSupabase,
  updateSubmissionAiFeedback,
} from "./lib/supabase";
const validViews: AppView[] = [
  "home",
  "library",
  "templates",
  "simulator",
  "results",
  "dashboard",
  "notebook",
  "settings",
  "login",
];
function route() {
  const [view, id] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    view: validViews.includes(view as AppView)
      ? (view as AppView)
      : ("home" as AppView),
    id,
  };
}
function MainRouter() {
  const { user, userName, isConfigured } = useAuth();
  const { language } = useLanguage();
  const en = language === "en";
  const [view, setView] = useState<AppView>(() => route().view);
  const [submissions, setSubmissions] = useState(() =>
    getStoredSubmissions().sort(
      (a, b) => resultTimestamp(b) - resultTimestamp(a),
    ),
  );
  const [draft, setDraft] = useState<PracticeSession | null>(
    loadPracticeSession,
  );
  const [active, setActive] = useState<ExamResult | null>(
    () => getStoredSubmissions().find((s) => s.id === route().id) || null,
  );
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const syncedUser = useRef("");
  const refresh = () => {
    setSubmissions(
      getStoredSubmissions().sort(
        (a, b) => resultTimestamp(b) - resultTimestamp(a),
      ),
    );
    setDraft(loadPracticeSession());
  };
  const navigate = (next: AppView, result?: ExamResult) => {
    if (result) setActive(result);
    setView(next);
    location.hash = `/${next}${next === "results" && result?.id ? "/" + result.id : ""}`;
  };
  useEffect(() => {
    const onHash = () => {
      const next = route();
      setView(next.view);
      if (next.view === "results" && next.id)
        setActive(getStoredSubmissions().find((s) => s.id === next.id) || null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const sync = async () => {
    if (!user || !isConfigured) return;
    setSyncStatus(en ? "Syncing account…" : "Synchronisation du compte…");
    try {
      const response = await fetchSubmissionsFromSupabase(user.id);
      if (response.error) throw response.error;
      syncStoredSubmissions(
        mergeSubmissions(response.submissions, getStoredSubmissions()),
      );
      refresh();
      setSyncStatus(
        en
          ? "Account synced. Your local drafts stay on this device."
          : "Compte synchronisé. Vos brouillons locaux restent sur cet appareil.",
      );
    } catch (e) {
      setSyncStatus(
        en
          ? "Cloud sync unavailable. Your local work is still available."
          : "Synchronisation indisponible. Votre travail local reste accessible.",
      );
    }
  };
  useEffect(() => {
    if (user && isConfigured && syncedUser.current !== user.id) {
      syncedUser.current = user.id;
      void sync();
    }
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
  const quickStart = (task: TaskKey | "exam") => {
    const available = allQuestions.filter(
      (q) =>
        (task !== "exam" && task !== "task3") ||
        Boolean(
          q.combination.tasks.task3.document1?.trim() &&
          q.combination.tasks.task3.document2?.trim(),
        ),
    );
    const entry =
      available.find(
        (q) =>
          !submissions.some(
            (s) =>
              s.year === q.year &&
              s.month === q.month &&
              s.combination.combinationNumber ===
                q.combination.combinationNumber &&
              (task === "exam"
                ? !s.isPracticeMode
                : practicedKeys(s).includes(task)),
          ),
      ) || available[0];
    if (entry) start(entry, task);
  };
  const saveReview = (result: ExamResult) => {
    const stored = updateStoredSubmission(result);
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
    if (user && isConfigured && result.id) {
      void updateSubmissionAiFeedback(
        result.cloudId || result.id,
        user.id,
        feedbackWithContext(result),
      ).then(({ error }) => {
        if (error)
          setSyncStatus(
            en
              ? "Feedback saved locally. Cloud sync failed."
              : "Bilan sauvegardé localement. Synchronisation du cloud échouée.",
          );
      });
    }
  };
  const finish = (result: ExamResult): boolean => {
    const saved = saveSubmission(result);
    if (!getStoredSubmissions().some((s) => s.id === saved.id)) {
      setNotice(
        en
          ? "Your response could not be saved. Keep this page open and export a backup."
          : "Votre texte n’a pas pu être enregistré. Gardez cette page ouverte et exportez une sauvegarde.",
      );
      return false;
    }
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    refresh();
    navigate("results", saved);
    if (user && isConfigured) {
      void saveSubmissionToSupabase(user.id, saved)
        .then(async ({ data, error }) => {
          if (error) {
            setSyncStatus(
              en
                ? "Writing saved locally. Cloud copy unavailable."
                : "Texte enregistré localement. Copie cloud indisponible.",
            );
            return;
          }
          if (data?.id) {
            const latest = getStoredSubmissions().find(
              (s) => s.id === saved.id,
            );
            if (latest) {
              const updated = { ...latest, cloudId: data.id };
              updateStoredSubmission(updated);
              setActive((previous) =>
                previous?.id === updated.id ? updated : previous,
              );
              refresh();
              if (latest.aiEvaluation)
                await updateSubmissionAiFeedback(
                  data.id,
                  user.id,
                  feedbackWithContext(latest),
                );
            }
          }
        })
        .catch(() =>
          setSyncStatus(
            en
              ? "Writing saved locally. Cloud copy unavailable."
              : "Texte enregistré localement. Copie cloud indisponible.",
          ),
        );
    }
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
          key={active.id}
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
        />
      );
    if (view === "library")
      return <PracticeLibrary onStart={start} submissions={submissions} />;
    if (view === "templates")
      return <Templates onPractice={() => navigate("library")} />;
    if (view === "dashboard")
      return (
        <Progress
          submissions={submissions}
          onOpen={(s) => navigate("results", s)}
          onPractice={() => navigate("library")}
        />
      );
    if (view === "notebook")
      return <Notebook onPractice={() => navigate("library")} />;
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
        <Login
          onSuccess={() => navigate("home")}
          onHomeClick={() => navigate("home")}
        />
      );
    return (
      <Home
        name={user ? userName : ""}
        submissions={submissions}
        draft={draft}
        onResume={() => navigate("simulator")}
        onPractice={quickStart}
        onLibrary={() => navigate("library")}
        onTemplates={() => navigate("templates")}
        onOpen={(s) => navigate("results", s)}
        onNotebook={() => navigate("notebook")}
      />
    );
  };
  return (
    <AppLayout view={view} onNavigate={navigate} name={name} hasDraft={!!draft}>
      {notice && (
        <div className="notice warning" role="alert">
          {notice}
          <button className="text-button" onClick={() => navigate("settings")}>
            {en ? "Open settings" : "Ouvrir les réglages"}
          </button>
        </div>
      )}
      {content()}
    </AppLayout>
  );
}
export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}
