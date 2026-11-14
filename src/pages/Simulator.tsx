import React, { useEffect, useRef, useState } from "react";
import {
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
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { ExamResult, TaskKey } from "../types/exam";
import {
  PracticeSession,
  savePracticeSession,
  sessionElapsed,
  TASK_INFO,
  TASK_KEYS,
} from "../utils/practice";
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
  const { language } = useLanguage();
  const en = language === "en";
  const [session, setSession] = useState(initialSession);
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(true);
  const [focusWriting, setFocusWriting] = useState(false);
  const [accentsOpen, setAccentsOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState(false);
  const [finish, setFinish] = useState(false);
  const [saveFailure, setSaveFailure] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const task = session.activeTask;
  const info = TASK_INFO[task];
  const requirement = session.combination.tasks[task];
  const elapsed = sessionElapsed(session, now);
  const isExam = session.mode === "exam";
  const timeLeft = Math.max(0, 3600 - elapsed);
  const words = countFrenchWords(session.answers[task]);
  const inRange =
    words >= requirement.minWords && words <= requirement.maxWords;
  const update = (patch: Partial<PracticeSession>) => {
    const next = { ...session, ...patch, savedAt: new Date().toISOString() };
    setSaved(savePracticeSession(next));
    setSession(next);
    onDraftChange(next);
  };
  const complete = () => {
    if (finished.current) return;
    const counts = Object.fromEntries(
      TASK_KEYS.map((k) => [k, countFrenchWords(session.answers[k])]),
    ) as ExamResult["wordCounts"];
    const result: ExamResult = {
      id: session.sessionId,
      createdAt: new Date().toISOString(),
      combination: session.combination,
      year: session.year,
      month: session.month,
      answers: session.answers,
      wordCounts: counts,
      timeUsedSeconds: isExam ? Math.min(elapsed, 3600) : elapsed,
      isPracticeMode: !isExam,
      practiceTask: session.keys.join(","),
      practiceTasks: session.keys,
      allocatedMinutes: isExam ? 60 : undefined,
      revisionOf: session.revisionOf,
    };
    if (onFinishExam(result)) finished.current = true;
    else setSaveFailure(true);
  };
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
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (isExam && timeLeft === 0 && !finished.current) complete();
  }, [timeLeft]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (!savePracticeSession(session)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [session]);
  const toggleTimer = () =>
    update(
      session.runningSince
        ? { elapsedSeconds: sessionElapsed(session), runningSince: null }
        : { runningSince: Date.now() },
    );
  const insert = (character: string) => {
    const editor = textRef.current;
    if (!editor) return;
    const a = editor.selectionStart;
    const b = editor.selectionEnd;
    update({
      answers: {
        ...session.answers,
        [task]:
          session.answers[task].slice(0, a) +
          character +
          session.answers[task].slice(b),
      },
    });
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
            onClick={onCancelExam}
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
            <h1>{en ? info.en : info.fr}</h1>
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
            </p>
          </div>
        </div>
        <div
          className={`writing-clock ${isExam && timeLeft < 300 ? "urgent" : ""}`}
        >
          <Clock3 size={17} />
          <span>{formatTime(isExam ? timeLeft : elapsed)}</span>
          <small>
            {isExam
              ? en
                ? "left"
                : "restantes"
              : en
                ? "optional timer"
                : "chrono facultatif"}
          </small>
          {!isExam && (
            <button
              className="icon-button"
              onClick={toggleTimer}
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
      </header>
      <div className="writing-session-bar">
        {session.keys.length > 1 ? (
          <div
            className="writing-task-switch"
            aria-label={en ? "Writing tasks" : "Tâches de rédaction"}
          >
            {session.keys.map((key) => (
              <button
                key={key}
                aria-pressed={task === key}
                onClick={() => update({ activeTask: key })}
              >
                Tâche {TASK_INFO[key].number}
                <small>
                  {countFrenchWords(session.answers[key])}{" "}
                  {en ? "words" : "mots"}
                </small>
              </button>
            ))}
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
      <div className="writing-layout">
        {!focusWriting && (
          <aside
            className="writing-reference"
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
            <div className="writing-reference-scroll">
              <section className="writing-prompt">
                <p>{normalizeParagraphText(requirement.instruction)}</p>
              </section>
              {task === "task3" && (
                <div className="writing-source-documents">
                  {[requirement.document1, requirement.document2].map(
                    (doc, i) => (
                      <section key={i}>
                        <h3>
                          <span>{i + 1}</span>Document {i + 1}
                        </h3>
                        <p>
                          {doc
                            ? cleanDocumentText(doc)
                            : en
                              ? "This source document is missing. Source comparison cannot be graded."
                              : "Document manquant : la comparaison des sources ne peut pas être évaluée."}
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
            <h2>{en ? "Your text" : "Votre texte"}</h2>
            <div className="row">
              <button
                className="writing-tool-button"
                aria-expanded={accentsOpen}
                aria-controls="writing-accents"
                onClick={() => setAccentsOpen(!accentsOpen)}
              >
                é<span>{en ? "Accents" : "Accents"}</span>
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
                        ? "Show documents"
                        : "Afficher les documents"
                      : en
                        ? "Show prompt"
                        : "Afficher la consigne"
                    : en
                      ? "Expand"
                      : "Agrandir"}
                </span>
              </button>
            </div>
          </div>
          {accentsOpen && (
            <div
              className="writing-accents"
              id="writing-accents"
              aria-label={en ? "French accents" : "Accents français"}
            >
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
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => insert(c)}
                  aria-label={`${en ? "Insert" : "Insérer"} ${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textRef}
            aria-label={
              en
                ? `Task ${info.number} response`
                : `Votre réponse à la tâche ${info.number}`
            }
            value={session.answers[task]}
            onChange={(e) =>
              update({
                answers: { ...session.answers, [task]: e.target.value },
              })
            }
            onPaste={isExam ? (e) => e.preventDefault() : undefined}
            spellCheck={!isExam}
            lang="fr"
            placeholder={
              en ? "Write your response here…" : "Rédigez votre réponse ici…"
            }
          />
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
                const n = countFrenchWords(session.answers[k]);
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
