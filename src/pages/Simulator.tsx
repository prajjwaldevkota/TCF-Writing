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
  const [panel, setPanel] = useState<"plan" | "check">("plan");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState(false);
  const [finish, setFinish] = useState(false);
  const [saveFailure, setSaveFailure] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const coachRef = useRef<HTMLElement>(null);
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
    <div className="page-enter writing-workspace">
      <div className="workspace-heading">
        <button className="text-button" onClick={onCancelExam}>
          <ArrowLeft size={16} />
          {en ? "Save & leave" : "Enregistrer et quitter"}
        </button>
        <div className="row">
          <span className={`badge ${isExam ? "sand" : "sage"}`}>
            {isExam
              ? en
                ? "FULL MOCK · 60 MIN"
                : "EXAMEN BLANC · 60 MIN"
              : en
                ? "GUIDED PRACTICE"
                : "PRATIQUE GUIDÉE"}
          </span>
          <span className="muted text-small desktop-only">
            {session.month} {session.year} · Série{" "}
            {session.combination.combinationNumber}
          </span>
        </div>
      </div>
      <div className="writer-top">
        <div>
          <p className="eyebrow">
            {session.revisionOf
              ? en
                ? "MAKE THIS VERSION BETTER"
                : "AMÉLIOREZ CETTE VERSION"
              : "EXPRESSION ÉCRITE"}
          </p>
          <h1>
            {en ? info.en : info.fr}
            <span className="heading-dot">.</span>
          </h1>
        </div>
        <div
          className={`writer-timer ${isExam && timeLeft < 300 ? "urgent" : ""}`}
        >
          <Clock3 size={20} />
          <div>
            <strong>{formatTime(isExam ? timeLeft : elapsed)}</strong>
            <small>
              {isExam
                ? en
                  ? "remaining"
                  : "restantes"
                : session.runningSince
                  ? en
                    ? "writing time"
                    : "temps de rédaction"
                  : en
                    ? "timer optional"
                    : "chrono facultatif"}
            </small>
          </div>
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
              {session.runningSince ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
        </div>
      </div>
      <div
        className="writer-task-tabs"
        role="tablist"
        aria-label={en ? "Writing tasks" : "Tâches de rédaction"}
      >
        {session.keys.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={task === key}
            onClick={() => {
              update({ activeTask: key });
              setPanel("plan");
            }}
          >
            <span className={`task-dot ${TASK_INFO[key].color}`}>
              {TASK_INFO[key].number}
            </span>
            Tâche {TASK_INFO[key].number}
            <small>
              {countFrenchWords(session.answers[key])} {en ? "words" : "mots"}
            </small>
          </button>
        ))}
        <span className={`autosave ${saved ? "" : "error-text"}`} role="status">
          {saved ? <Check size={14} /> : <Save size={14} />}{" "}
          {saved
            ? en
              ? "Draft saved"
              : "Brouillon sauvegardé"
            : en
              ? "Storage full — copy your text"
              : "Stockage plein — copiez votre texte"}
        </span>
      </div>
      {!isExam && (
        <div className="writer-mobile-tools">
          <button
            className="button secondary"
            onClick={() => setTemplates(true)}
          >
            <BookOpen size={15} />
            {en ? "Writing templates" : "Modèles de rédaction"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setPanel("check");
              requestAnimationFrame(() =>
                coachRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              );
            }}
          >
            <Check size={15} />
            {en ? "My checklist" : "Ma liste de vérification"}
          </button>
        </div>
      )}
      <div className={`writer-grid ${isExam ? "exam-mode" : ""}`}>
        <div className="writer-main">
          <section className="prompt-card">
            <div className="row between">
              <span className="eyebrow">
                {en ? "YOUR WRITING PROMPT" : "VOTRE CONSIGNE"}
              </span>
              <span className="badge neutral">
                {requirement.minWords}–{requirement.maxWords}{" "}
                {en ? "words" : "mots"}
              </span>
            </div>
            <p>{normalizeParagraphText(requirement.instruction)}</p>
            {task === "task3" && (
              <div className="source-documents">
                {[requirement.document1, requirement.document2].map(
                  (doc, i) => (
                    <details open key={i}>
                      <summary>
                        Document {i + 1}
                        <ChevronDown size={15} />
                      </summary>
                      <p>
                        {doc
                          ? cleanDocumentText(doc)
                          : en
                            ? "This source document is missing. Source comparison cannot be graded."
                            : "Document manquant : la comparaison des sources ne peut pas être évaluée."}
                      </p>
                    </details>
                  ),
                )}
              </div>
            )}
          </section>
          {session.revisionOf && (
            <details className="revision-reference">
              <summary>
                {en
                  ? "Original response & revision priorities"
                  : "Texte initial et priorités de réécriture"}
              </summary>
              {session.priorities?.length ? (
                <ul>
                  {session.priorities.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <p>{session.previousAnswer}</p>
            </details>
          )}
          <section className="editor-paper">
            <div className="editor-toolbar">
              <span>
                <FeatherIcon />
                {en ? "YOUR RESPONSE" : "VOTRE RÉDACTION"}
              </span>
              <span className="muted text-small">
                {en ? "Write in French" : "Rédigez en français"}
              </span>
            </div>
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
                en
                  ? "Your ideas belong here. Take a breath, then begin…"
                  : "Vos idées ont leur place ici. Prenez une respiration, puis commencez…"
              }
            />
            <div className="accent-toolbar">
              <span className="muted text-small">
                {en ? "French accents" : "Accents"}
              </span>
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
            <div className="editor-footer">
              <div
                className={`word-count ${inRange ? "valid" : words > requirement.maxWords ? "over" : ""}`}
              >
                <strong>{words}</strong> {en ? "words" : "mots"}
                <span>
                  {inRange ? (
                    <>
                      <Check size={13} />
                      {en ? "Within range" : "Dans la plage"}
                    </>
                  ) : words > requirement.maxWords ? (
                    en ? (
                      "Over word limit"
                    ) : (
                      "Plage dépassée"
                    )
                  ) : (
                    `${requirement.minWords}–${requirement.maxWords} ${en ? "expected" : "attendus"}`
                  )}
                </span>
              </div>
              <span className="muted text-small">
                {en ? "Counted by spaces" : "Comptage par espaces"}
              </span>
            </div>
            <div className="word-progress">
              <span
                style={{
                  width: `${Math.min(100, (words / requirement.maxWords) * 100)}%`,
                  background:
                    words > requirement.maxWords ? "var(--rust)" : undefined,
                }}
              />
            </div>
          </section>
          <div className="writer-submit">
            <span className="muted text-small">
              {en
                ? "Feedback starts only when you ask for it."
                : "La correction IA démarre uniquement à votre demande."}
            </span>
            <button
              ref={finishButtonRef}
              className="button primary"
              onClick={() => setFinish(true)}
            >
              <FileCheck2 size={17} />
              {isExam
                ? en
                  ? "Finish mock exam"
                  : "Terminer l’examen blanc"
                : en
                  ? "Finish & review"
                  : "Terminer et faire le bilan"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        {!isExam && (
          <aside ref={coachRef} className="writer-coach">
            <div className="coach-card">
              <span className="eyebrow">
                {en ? "YOUR WRITING COMPANION" : "VOTRE COMPAGNON DE RÉDACTION"}
              </span>
              <h2>
                {en
                  ? "A thought before a sentence."
                  : "Une idée avant une phrase."}
              </h2>
              <div className="segmented">
                <button
                  aria-pressed={panel === "plan"}
                  onClick={() => setPanel("plan")}
                >
                  {en ? "Plan" : "Préparer"}
                </button>
                <button
                  aria-pressed={panel === "check"}
                  onClick={() => setPanel("check")}
                >
                  {en ? "Check" : "Vérifier"}
                </button>
              </div>
              {panel === "plan" ? (
                <div className="coach-plan">
                  {(task === "task1"
                    ? en
                      ? [
                          [
                            "01",
                            "Who am I writing to?",
                            "Choose the tone before you start.",
                          ],
                          [
                            "02",
                            "What must they know?",
                            "List every requested detail.",
                          ],
                          [
                            "03",
                            "What happens next?",
                            "End with a clear action or closing.",
                          ],
                        ]
                      : [
                          [
                            "01",
                            "À qui est-ce que j’écris ?",
                            "Choisissez le ton avant de commencer.",
                          ],
                          [
                            "02",
                            "Que doit savoir cette personne ?",
                            "Repérez chaque détail demandé.",
                          ],
                          [
                            "03",
                            "Et ensuite ?",
                            "Terminez avec une action ou une formule adaptée.",
                          ],
                        ]
                    : task === "task2"
                      ? en
                        ? [
                            [
                              "01",
                              "Set the scene",
                              "Who, where, when, and why?",
                            ],
                            [
                              "02",
                              "Tell the story",
                              "Connect the main events in order.",
                            ],
                            [
                              "03",
                              "Give your perspective",
                              "Explain why the experience matters.",
                            ],
                          ]
                        : [
                            [
                              "01",
                              "Plantez le décor",
                              "Qui, où, quand et pourquoi ?",
                            ],
                            [
                              "02",
                              "Racontez l’expérience",
                              "Reliez les événements dans un ordre clair.",
                            ],
                            [
                              "03",
                              "Donnez votre avis",
                              "Expliquez ce que cette expérience vous a apporté.",
                            ],
                          ]
                      : en
                        ? [
                            [
                              "01",
                              "Understand both views",
                              "One short note for each document.",
                            ],
                            [
                              "02",
                              "Compare in your own words",
                              "Show agreement, differences or nuance.",
                            ],
                            [
                              "03",
                              "Defend your position",
                              "Give a reason and a concrete example.",
                            ],
                          ]
                        : [
                            [
                              "01",
                              "Comprenez les deux avis",
                              "Une idée clé pour chaque document.",
                            ],
                            [
                              "02",
                              "Comparez avec vos mots",
                              "Rapprochez ou opposez les points de vue.",
                            ],
                            [
                              "03",
                              "Défendez votre position",
                              "Une raison et un exemple concret.",
                            ],
                          ]
                  ).map(([n, title, detail]) => (
                    <div key={n}>
                      <span>{n}</span>
                      <p>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="coach-checks">
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
              )}
              <button
                className="button secondary full-width"
                onClick={() => setTemplates(true)}
              >
                <BookOpen size={16} />
                {en ? "Open writing templates" : "Ouvrir les modèles"}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="coach-small">
              <span className="badge sand">Objectif NCLC 7</span>
              <p>
                {en
                  ? "Make your message clear before making it complex. Support your ideas, and leave a moment to reread."
                  : "Cherchez la clarté avant la complexité. Développez vos idées et gardez un moment pour vous relire."}
              </p>
            </div>
          </aside>
        )}
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
function FeatherIcon() {
  return (
    <span aria-hidden="true" className="pen-dot">
      ✎
    </span>
  );
}
