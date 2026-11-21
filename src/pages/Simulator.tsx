import { useWorkspace } from "../context/WorkspaceContext";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  Pause,
  Play,
  Save,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import { PracticeSession, sessionElapsed, TASK_INFO, TASK_KEYS } from "../utils/practice";
import { countFrenchWords, formatTime } from "../utils/wordCount";
import { cleanDocumentText, normalizeParagraphText } from "../utils/cleanText";
import { WritingTemplatePanel } from "../components/WritingTemplatePanel";
import { useLanguage } from "../context/LanguageContext";
const CHECKS = {
  task1: [
    "Le destinataire et le but du message sont clairs.",
    "J’ai inclus tous les détails demandés.",
    "Mon introduction et ma fin conviennent au destinataire.",
    "J’ai relu les accords, les verbes et les accents.",
  ],
  task2: [
    "Mon récit suit une progression facile à suivre.",
    "J’ai donné des détails concrets.",
    "Mes commentaires répondent à l’objectif du texte.",
    "Le ton et la forme conviennent aux lecteurs.",
  ],
  task3: [
    "J’ai reformulé le point de vue de chaque document.",
    "J’ai établi un lien entre les deux points de vue.",
    "Ma position est claire, avec une raison ou un exemple.",
    "Ma conclusion correspond à mon argumentation.",
  ],
};
const CHECKS_EN = {
  task1: [
    "The reader and purpose are clear.",
    "I included all requested details.",
    "My opening and closing suit the recipient.",
    "I checked agreements, verbs and accents.",
  ],
  task2: [
    "My account has a clear progression.",
    "I included concrete details.",
    "My comments serve the purpose of the text.",
    "The tone and format suit the readership.",
  ],
  task3: [
    "I reformulated both documents’ viewpoints.",
    "I connected and compared the two views.",
    "My position has a reason or an example.",
    "My conclusion follows my argument.",
  ],
};
const SessionTimerControls: React.FC<{
  session: PracticeSession;
  en: boolean;
  onToggleTimer: () => void;
  onExpire: () => void;
}> = React.memo(({ session, en, onToggleTimer, onExpire }) => {
  const isExam = session.mode === "exam";
  const isTicking = isExam || Boolean(session.runningSince);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!isTicking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isTicking, session.runningSince, session.elapsedSeconds]);

  const elapsed = sessionElapsed(session, now);
  const timeLeft = Math.max(0, 3600 - elapsed);

  useEffect(() => {
    if (isExam && timeLeft === 0) onExpire();
  }, [isExam, timeLeft, onExpire]);

  return (
    <div className={`writing-clock ${isExam && timeLeft < 300 ? "urgent" : ""}`}>
      <Clock3 size={22} aria-hidden="true" />
      <span>{formatTime(isExam ? timeLeft : elapsed)}</span>
      <small>
        {isExam
          ? en
            ? "Time left"
            : "Temps restant"
          : en
            ? "optional timer"
            : "chrono facultatif"}
      </small>
      {!isExam && (
        <button
          className="icon-button"
          onClick={onToggleTimer}
          aria-label={
            session.runningSince
              ? en
                ? "Pause timer"
                : "Mettre le chrono en pause"
              : en
                ? "Start timer"
                : "Démarrer le chrono"
          }
        >
          {session.runningSince ? <Pause size={16} /> : <Play size={16} />}
        </button>
      )}
    </div>
  );
});

const ExamStatusBanner: React.FC<{
  session: PracticeSession;
  en: boolean;
}> = React.memo(({ session, en }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const timeLeft = Math.max(0, 3600 - sessionElapsed(session, now));

  return (
    <div
      role="status"
      className={`exam-simulation-banner ${
        timeLeft <= 300 ? "critical" : timeLeft <= 900 ? "warning" : "normal"
      }`}
    >
      <div className="exam-banner-left">
        <span className="exam-badge">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            {en ? "TCF Canada mock conditions" : "Conditions d’examen TCF Canada"}
          </span>
        </span>
        <span className="exam-conditions-tag">
          {en
            ? "60 min shared · Spell-check & paste disabled"
            : "60 min globales · Correcteur et collage désactivés"}
        </span>
      </div>
      <div className="exam-banner-right">
        {timeLeft <= 300 ? (
          <span className="exam-urgency-alert pulse">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              {en
                ? "Final 5 minutes — check agreements and accents."
                : "Dernières 5 minutes — relisez les accords et accents."}
            </span>
          </span>
        ) : timeLeft <= 900 ? (
          <span className="exam-urgency-alert">
            <Clock3 size={14} aria-hidden="true" />
            <span>
              {en
                ? "15 minutes left — reserve time for Task 3."
                : "15 minutes restantes — gardez du temps pour la tâche 3."}
            </span>
          </span>
        ) : (
          <span className="exam-hint">
            {en
              ? "Divide your 60 minutes freely across all three tasks."
              : "Répartissez librement vos 60 minutes entre les trois tâches."}
          </span>
        )}
      </div>
    </div>
  );
});

export function Simulator({
  initialSession,
  onFinishExam,
  onCancelExam,
  onDraftChange,
}: {
  initialSession: PracticeSession;
  onFinishExam: (result: ExamResult) => boolean;
  onCancelExam: () => void;
  onDraftChange: (session: PracticeSession) => void;
}) {
  const { savePracticeSession } = useWorkspace();
  const { language } = useLanguage();
  const en = language === "en";
  const [session, setSession] = useState(initialSession);
  const [saved, setSaved] = useState(true);
  const [focusWriting, setFocusWriting] = useState(false);
  const [mobilePromptOpen, setMobilePromptOpen] = useState(true);
  const [accentsOpen, setAccentsOpen] = useState(false);
  const [uppercaseAccents, setUppercaseAccents] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState(false);
  const [finish, setFinish] = useState(false);
  const [saveFailure, setSaveFailure] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef(initialSession);
  const dirtyRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  const flushDraft = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!dirtyRef.current || finished.current) return true;
    const ok = savePracticeSession(sessionRef.current);
    setSaved(ok);
    dirtyRef.current = false;
    onDraftChangeRef.current(sessionRef.current);
    return ok;
  }, []);

  const task = session.activeTask;
  const info = TASK_INFO[task];
  const requirement = session.combination.tasks[task];
  const isExam = session.mode === "exam";

  const count1 = useMemo(() => countFrenchWords(session.answers.task1), [session.answers.task1]);
  const count2 = useMemo(() => countFrenchWords(session.answers.task2), [session.answers.task2]);
  const count3 = useMemo(() => countFrenchWords(session.answers.task3), [session.answers.task3]);
  const wordCounts = useMemo(
    () => ({ task1: count1, task2: count2, task3: count3 }),
    [count1, count2, count3],
  );
  const words = wordCounts[task];
  const inRange =
    words >= requirement.minWords && words <= requirement.maxWords;
  const withinRangeCount = session.keys.filter((key) => {
    const count = wordCounts[key];
    const target = session.combination.tasks[key];
    return count >= target.minWords && count <= target.maxWords;
  }).length;

  const cleanedPrompt = useMemo(
    () => normalizeParagraphText(requirement.instruction || requirement.title),
    [requirement.instruction, requirement.title],
  );
  const cleanedDoc1 = useMemo(
    () => (requirement.document1 ? cleanDocumentText(requirement.document1) : ""),
    [requirement.document1],
  );
  const cleanedDoc2 = useMemo(
    () => (requirement.document2 ? cleanDocumentText(requirement.document2) : ""),
    [requirement.document2],
  );

  const responseHint = en
    ? {
        task1:
          "Write the message requested in the prompt. Adapt your greeting, details and closing to the reader.",
        task2:
          "Write the text requested in the prompt. Describe the experience in a clear order and include your impressions.",
        task3:
          "Compare the two documents in your own words, then explain and support your opinion. Write one connected response.",
      }[task]
    : {
        task1:
          "Rédigez le message demandé. Adaptez votre formule d’appel, vos détails et votre conclusion au destinataire.",
        task2:
          "Rédigez le texte demandé. Racontez l’expérience dans un ordre clair et donnez vos impressions.",
        task3:
          "Comparez les deux documents avec vos propres mots, puis expliquez et justifiez votre opinion. Rédigez un seul texte structuré.",
      }[task];

  const update = useCallback(
    (patch: Partial<PracticeSession>, immediate = true) => {
      const next: PracticeSession = {
        ...sessionRef.current,
        ...patch,
        savedAt: new Date().toISOString(),
      };
      sessionRef.current = next;
      setSession(next);

      if (immediate) {
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        dirtyRef.current = false;
        setSaved(savePracticeSession(next));
        onDraftChangeRef.current(next);
      } else {
        dirtyRef.current = true;
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null;
          if (!dirtyRef.current || finished.current) return;
          dirtyRef.current = false;
          setSaved(savePracticeSession(sessionRef.current));
          onDraftChangeRef.current(sessionRef.current);
        }, 250);
      }
    },
    [],
  );

  const complete = useCallback(() => {
    if (finished.current) return;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    dirtyRef.current = false;
    const current = sessionRef.current;
    const currentIsExam = current.mode === "exam";
    const totalElapsed = sessionElapsed(current, Date.now());
    const counts = Object.fromEntries(
      TASK_KEYS.map((k) => [k, countFrenchWords(current.answers[k])]),
    ) as ExamResult["wordCounts"];
    const result: ExamResult = {
      id: current.sessionId,
      createdAt: new Date().toISOString(),
      combination: current.combination,
      year: current.year,
      month: current.month,
      answers: current.answers,
      wordCounts: counts,
      timeUsedSeconds: currentIsExam ? Math.min(totalElapsed, 3600) : totalElapsed,
      isPracticeMode: !currentIsExam,
      practiceTask: current.keys.join(","),
      practiceTasks: current.keys,
      allocatedMinutes: currentIsExam ? 60 : undefined,
      revisionOf: current.revisionOf,
    };
    if (onFinishExam(result)) finished.current = true;
    else setSaveFailure(true);
  }, [onFinishExam]);

  useEffect(() => {
    if (!finish) return;
    const before = finishButtonRef.current;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFinish(false);
        return;
      }
      if (event.key === "Tab") {
        const controls = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]',
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      before?.focus();
    };
  }, [finish]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (finished.current) return;
      if (!savePracticeSession(sessionRef.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const onHide = () => {
      if (!finished.current) void flushDraft();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !finished.current) {
        void flushDraft();
      }
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!finished.current && dirtyRef.current) {
        savePracticeSession(sessionRef.current);
      }
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flushDraft]);

  const toggleTimer = useCallback(() => {
    const current = sessionRef.current;
    update(
      current.runningSince
        ? { elapsedSeconds: sessionElapsed(current), runningSince: null }
        : { runningSince: Date.now() },
      true,
    );
  }, [update]);

  const handleCancel = () => {
    flushDraft();
    onCancelExam();
  };

  const insert = (character: string) => {
    const editor = textRef.current;
    if (!editor) return;
    const a = editor.selectionStart;
    const b = editor.selectionEnd;
    update(
      {
        answers: {
          ...sessionRef.current.answers,
          [task]:
            sessionRef.current.answers[task].slice(0, a) +
            character +
            sessionRef.current.answers[task].slice(b),
        },
      },
      false,
    );
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(a + character.length, a + character.length);
    });
  };
  return (
    <div
      className={`writing-workspace focused-workspace ${focusWriting ? "writing-only" : ""}`}
    >
      <header className="writing-session-header">
        <div className="writing-session-title">
          <button
            className="writing-back icon-button"
            onClick={handleCancel}
            aria-label={
              en
                ? "Save and leave writing"
                : "Enregistrer et quitter la rédaction"
            }
            title={en ? "Save and leave" : "Enregistrer et quitter"}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>
              {focusWriting
                ? session.revisionOf
                  ? en
                    ? "Revision"
                    : "Réécriture"
                  : en
                    ? "Your writing"
                    : "Votre rédaction"
                : en
                  ? info.en
                  : info.fr}
            </h1>
            <p>
              {isExam
                ? en
                  ? "Full mock exam"
                  : "Examen blanc"
                : session.revisionOf
                  ? en
                    ? "Revision"
                    : "Réécriture"
                  : en
                    ? "Guided practice"
                    : "Pratique guidée"}{" "}
              · {session.month} {session.year}
              {" · "}
              {en ? "Set" : "Combinaison"}{" "}
              {session.combination.combinationNumber}
            </p>
          </div>
        </div>
        <SessionTimerControls
          session={session}
          en={en}
          onToggleTimer={toggleTimer}
          onExpire={complete}
        />
      </header>
      {isExam && <ExamStatusBanner session={session} en={en} />}
      <div className="writing-session-bar">
        {session.keys.length > 1 ? (
          <div
            className="writing-task-switch"
            aria-label={en ? "Writing tasks" : "Tâches de rédaction"}
          >
            {session.keys.map((key) => {
              const n = wordCounts[key];
              const r = session.combination.tasks[key];
              return (
                <button
                  key={key}
                  aria-pressed={task === key}
                  onClick={() => update({ activeTask: key }, true)}
                >
                  Tâche {TASK_INFO[key].number}
                  <small>
                    {n} {en ? "words" : "mots"}
                  </small>
                  {n >= r.minWords && n <= r.maxWords ? (
                    <Check
                      size={14}
                      aria-label={
                        en ? "Word target reached" : "Nombre de mots respecté"
                      }
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="writing-task-label">
            Tâche {info.number}
            <span>
              {" "}
              {requirement.minWords}–{requirement.maxWords}{" "}
              {en ? "words" : "mots"}
            </span>
          </span>
        )}
        <span
          className={`writing-save-status ${saved ? "" : "error-text"}`}
          role="status"
        >
          {saved ? <Check size={14} /> : <Save size={14} />}{" "}
          {saved
            ? en
              ? "Saved"
              : "Sauvegardé"
            : en
              ? "Storage full — copy your text"
              : "Stockage plein — copiez votre texte"}
        </span>
      </div>
      {isExam && (
        <div className="session-progress">
          <span>
            {en ? "Word targets" : "Objectifs de longueur"}:{" "}
            <strong>
              {withinRangeCount}/{session.keys.length}
            </strong>
          </span>
          <progress
            max={session.keys.length}
            value={withinRangeCount}
            aria-label={
              en
                ? "Tasks within the word range"
                : "Tâches respectant la plage de mots"
            }
          />
          <small>
            {en
              ? "Remember to review your content too."
              : "Pensez aussi à relire le contenu."}
          </small>
        </div>
      )}
      <div className="writing-layout">
        {!focusWriting && (
          <aside
            className={`writing-reference ${mobilePromptOpen ? "" : "prompt-collapsed"}`}
            aria-label={
              en ? "Prompt and source documents" : "Consigne et documents"
            }
          >
            <div className="writing-reference-header">
              <h2>
                {task === "task3"
                  ? en
                    ? "Prompt & documents"
                    : "Consigne et documents"
                  : en
                    ? "Your prompt"
                    : "La consigne"}
              </h2>
              {!isExam && (
                <button
                  className="text-button"
                  onClick={() => setTemplates(true)}
                >
                  <BookOpen size={15} />
                  {en ? "Templates" : "Modèles"}
                </button>
              )}
            </div>
            <div className="mobile-prompt-tools">
              <button
                aria-expanded={mobilePromptOpen}
                aria-controls="task-prompt-content"
                onClick={() => setMobilePromptOpen(!mobilePromptOpen)}
              >
                {mobilePromptOpen
                  ? en
                    ? "Collapse prompt"
                    : "Réduire la consigne"
                  : en
                    ? "Read the prompt"
                    : "Lire la consigne"}
                <ChevronDown size={15} />
              </button>
              <button
                onClick={() => {
                  textRef.current?.focus({ preventScroll: true });
                  textRef.current?.scrollIntoView({ block: "center" });
                }}
              >
                {en ? "Write" : "Écrire"}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="writing-reference-scroll" id="task-prompt-content">
              {!isExam && (
                <section className="task-brief">
                  <h3>
                    {en ? "What you need to write" : "Ce que vous devez écrire"}
                  </h3>
                  <p>{responseHint}</p>
                  <span>
                    {requirement.minWords}–{requirement.maxWords}{" "}
                    {en ? "words in French" : "mots en français"}
                  </span>
                </section>
              )}
              <section className="writing-prompt">
                <h3>
                  {task === "task3"
                    ? en
                      ? "Topic"
                      : "Le sujet"
                    : en
                      ? "Read the prompt"
                      : "Lisez la consigne"}
                </h3>
                <p lang="fr">
                  {cleanedPrompt}
                </p>
              </section>
              {task === "task3" && (
                <div className="writing-source-documents">
                  <p className="source-intro">
                    {en
                      ? "Read both documents. Use them to compare the viewpoints in your response."
                      : "Lisez les deux documents pour comparer leurs points de vue dans votre réponse."}
                  </p>
                  {[cleanedDoc1, cleanedDoc2].map(
                    (doc, i) => (
                      <section key={i}>
                        <h3>
                          <span>{i + 1}</span>Document {i + 1}
                        </h3>
                        <p lang="fr">
                          {doc ||
                            (en
                              ? "This source document is missing. Source comparison cannot be graded."
                              : "Document manquant : la comparaison des sources ne peut pas être évaluée.")}
                        </p>
                      </section>
                    ),
                  )}
                </div>
              )}
              {!isExam && (
                <details className="writing-help">
                  <summary>
                    {en ? "Need a little guidance?" : "Besoin d’un repère ?"}
                    <ChevronDown size={15} />
                  </summary>
                  <p>
                    {en
                      ? task === "task3"
                        ? "Reformulate both viewpoints, compare them, then defend your position with a reason or example."
                        : task === "task2"
                          ? "Set the scene, recount the experience, then explain what you think about it."
                          : "Identify the reader, include every requested detail, and finish with a suitable closing."
                      : task === "task3"
                        ? "Reformulez les deux points de vue, comparez-les, puis défendez votre position avec une raison ou un exemple."
                        : task === "task2"
                          ? "Plantez le décor, racontez l’expérience, puis expliquez ce que vous en pensez."
                          : "Identifiez le destinataire, incluez chaque détail demandé et terminez avec une formule adaptée."}
                  </p>
                  <div className="writing-checklist">
                    {(en ? CHECKS_EN : CHECKS)[task].map((text, i) => (
                      <label key={`${task}-${i}`}>
                        <input
                          type="checkbox"
                          checked={!!checked[`${task}-${i}`]}
                          onChange={(e) =>
                            setChecked({
                              ...checked,
                              [`${task}-${i}`]: e.target.checked,
                            })
                          }
                        />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
              {session.revisionOf && (
                <details className="writing-help revision-reference">
                  <summary>
                    {en
                      ? "Previous version & priorities"
                      : "Version précédente et priorités"}
                    <ChevronDown size={15} />
                  </summary>
                  {!!session.priorities?.length && (
                    <ul>
                      {session.priorities.map((priority, i) => (
                        <li key={i}>{priority}</li>
                      ))}
                    </ul>
                  )}
                  <p>{session.previousAnswer}</p>
                </details>
              )}
            </div>
          </aside>
        )}
        <section
          className="writing-desk"
          aria-label={en ? "Your writing" : "Votre rédaction"}
        >
          <div className="writing-editor-header">
            <h2>
              <label htmlFor="task-response">
                {focusWriting
                  ? en
                    ? "Your response"
                    : "Votre réponse"
                  : en
                    ? "Write your response"
                    : "Rédigez votre réponse"}
              </label>
            </h2>
            <div className="row">
              <button
                className="writing-tool-button writing-accent-toggle"
                aria-expanded={accentsOpen}
                aria-controls="writing-accents"
                onClick={() => setAccentsOpen(!accentsOpen)}
              >
                <b aria-hidden="true">é</b>
                <span>Accents</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <button
                className="writing-tool-button"
                aria-pressed={focusWriting}
                onClick={() => setFocusWriting(!focusWriting)}
                title={
                  focusWriting
                    ? en
                      ? "Show the prompt and documents"
                      : "Afficher la consigne et les documents"
                    : en
                      ? "Give all the space to writing"
                      : "Donner toute la place à la rédaction"
                }
              >
                {focusWriting ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
                <span>
                  {focusWriting
                    ? task === "task3"
                      ? en
                        ? "Documents"
                        : "Documents"
                      : en
                        ? "Prompt"
                        : "Consigne"
                    : en
                      ? "Expand"
                      : "Agrandir"}
                </span>
              </button>
            </div>
          </div>
          <p className="response-instructions" id="response-instructions">
            {focusWriting
              ? en
                ? `Task ${info.number} · ${requirement.minWords}–${requirement.maxWords} words in French`
                : `Tâche ${info.number} · ${requirement.minWords}–${requirement.maxWords} mots en français`
              : en
                ? `Task ${info.number} · ${requirement.minWords}–${requirement.maxWords} words in French. Your response is saved as you type.`
                : `Tâche ${info.number} · ${requirement.minWords}–${requirement.maxWords} mots en français. Votre réponse est enregistrée au fil de la saisie.`}
          </p>
          {accentsOpen && (
            <div
              className="writing-accents"
              id="writing-accents"
              aria-label={en ? "French accents" : "Accents français"}
            >
              <button
                className="writing-accent-case"
                aria-label={en ? "Uppercase accents" : "Accents majuscules"}
                title={en ? "Uppercase accents" : "Accents majuscules"}
                aria-pressed={uppercaseAccents}
                onClick={() => setUppercaseAccents(!uppercaseAccents)}
              >
                ABC
              </button>
              {[
                "é",
                "è",
                "ê",
                "ë",
                "à",
                "â",
                "ç",
                "î",
                "ï",
                "ô",
                "ù",
                "û",
                "œ",
                "«",
                "»",
              ].map((c) => {
                const character = uppercaseAccents ? c.toUpperCase() : c;
                return (
                  <button
                    key={c}
                    onClick={() => insert(character)}
                    aria-label={`${en ? "Insert" : "Insérer"} ${character}`}
                  >
                    {character}
                  </button>
                );
              })}
            </div>
          )}
          <textarea
            id="task-response"
            aria-describedby="response-instructions word-target-status"
            ref={textRef}
            aria-label={
              en
                ? `Task ${info.number} response`
                : `Votre réponse à la tâche ${info.number}`
            }
            value={session.answers[task]}
            onChange={(e) =>
              update(
                {
                  answers: { ...session.answers, [task]: e.target.value },
                },
                false,
              )
            }
            onPaste={isExam ? (e) => e.preventDefault() : undefined}
            spellCheck={!isExam}
            lang="fr"
            placeholder={
              en
                ? [
                    "Start your message here…",
                    "Tell your experience here…",
                    "Compare the viewpoints, then develop your opinion here…",
                  ][info.number - 1]
                : [
                    "Commencez votre message ici…",
                    "Racontez votre expérience ici…",
                    "Comparez les points de vue, puis développez votre opinion ici…",
                  ][info.number - 1]
            }
          />
          <div
            className={`word-target ${words > requirement.maxWords ? "is-over" : ""}`}
            id="word-target-status"
          >
            <progress
              max={requirement.maxWords}
              value={Math.min(words, requirement.maxWords)}
              aria-label={
                en ? "Response word count" : "Nombre de mots de la réponse"
              }
            />
            <span>
              {words > requirement.maxWords
                ? en
                  ? `Remove at least ${words - requirement.maxWords} ${words - requirement.maxWords === 1 ? "word" : "words"} to stay within the limit.`
                  : `Retirez au moins ${words - requirement.maxWords} ${words - requirement.maxWords === 1 ? "mot" : "mots"} pour respecter la limite.`
                : inRange
                  ? en
                    ? `Word target reached (${requirement.minWords}–${requirement.maxWords} words). Fully compliant.`
                    : `Longueur conforme aux exigences officielles (${requirement.minWords}–${requirement.maxWords} mots).`
                  : en
                    ? `${requirement.minWords - words} more words to reach the minimum (TCF penalty applies below ${requirement.minWords}).`
                    : `Encore ${requirement.minWords - words} mots pour atteindre le minimum (seuil officiel : ${requirement.minWords} mots).`}
            </span>
          </div>
          <div className="writing-editor-footer">
            <div
              className={`writing-word-count ${inRange ? "valid" : words > requirement.maxWords ? "over" : ""}`}
            >
              <strong>{words}</strong>
              <span>{en ? "words" : "mots"}</span>
              <small>
                {inRange ? (
                  <>
                    <Check size={12} />
                    {en ? "Within range" : "Dans la plage"}
                  </>
                ) : (
                  `${requirement.minWords}–${requirement.maxWords} ${en ? "expected" : "attendus"}`
                )}
              </small>
            </div>
            <button
              ref={finishButtonRef}
              className="button primary"
              onClick={() => setFinish(true)}
            >
              {isExam
                ? en
                  ? "Finish mock"
                  : "Terminer l’examen"
                : en
                  ? "Finish writing"
                  : "Terminer la rédaction"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
      {templates && !isExam && (
        <WritingTemplatePanel
          activeTask={task}
          isPracticeMode
          onClose={() => setTemplates(false)}
        />
      )}
      {finish && (
        <div className="modal-overlay" onClick={() => setFinish(false)}>
          <section
            ref={modalRef}
            className="lab-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="modal-icon">
              <FileCheck2 size={25} />
            </span>
            <h2 id="finish-title">
              {en
                ? "Ready to put down your pen?"
                : "Prêt à poser votre stylo ?"}
            </h2>
            <p>
              {en
                ? "Your writing will be saved. You can request feedback, then start a new revision."
                : "Votre rédaction sera enregistrée. Vous pourrez demander une correction, puis commencer une réécriture."}
            </p>
            {saveFailure && (
              <p className="notice warning" role="alert">
                {en
                  ? "The browser could not save your writing. Keep the editor open and copy your response before freeing storage."
                  : "Le navigateur n’a pas pu enregistrer votre texte. Gardez l’éditeur ouvert et copiez votre réponse avant de libérer du stockage."}
              </p>
            )}
            <div className="finish-counts">
              {session.keys.map((k) => {
                const n = wordCounts[k];
                const r = session.combination.tasks[k];
                return (
                  <div key={k}>
                    <strong>Tâche {TASK_INFO[k].number}</strong>
                    <span>
                      {n} {en ? "words" : "mots"}
                    </span>
                    <span
                      className={`badge ${n >= r.minWords && n <= r.maxWords ? "sage" : "sand"}`}
                    >
                      {n >= r.minWords && n <= r.maxWords
                        ? en
                          ? "Within range"
                          : "Dans la plage"
                        : `${r.minWords}–${r.maxWords} ${en ? "expected" : "attendus"}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button
                autoFocus
                className="button secondary"
                onClick={() => setFinish(false)}
              >
                {en ? "Keep writing" : "Continuer à écrire"}
              </button>
              <button className="button primary" onClick={complete}>
                {en ? "Save my writing" : "Enregistrer mon texte"}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
