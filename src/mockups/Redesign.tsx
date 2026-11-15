import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Feather,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Search,
} from "lucide-react";
import { countFrenchWords, formatTime } from "../utils/wordCount";
import questions from "../data/questions.json";
import type { QuestionsDB } from "../types/exam";
import {
  questionEntries,
  TASK_KEYS,
  type QuestionEntry,
} from "../utils/practice";
import { selectRandomCombination } from "../utils/randomCombination";
import "./redesign.css";

type View = "home" | "library" | "writing" | "feedback";
const entries = questionEntries(questions as QuestionsDB);
const taskMetadata = [
  {
    title: "Écrire un message",
    short: "Le message",
    type: "Informer, décrire, inviter.",
    min: 60,
    max: 120,
    time: 15,
    prompt:
      "Vous venez de vous installer dans une nouvelle ville. Vous écrivez à un ami pour lui présenter votre quartier, lui expliquer ce qui vous plaît et l’inviter à vous rendre visite.",
    recipient: "Un message à un ami",
    help: "Présentez votre quartier, partagez vos impressions et proposez une visite.",
  },
  {
    title: "Raconter une expérience",
    short: "Le récit",
    type: "Raconter et partager un point de vue.",
    min: 120,
    max: 150,
    time: 20,
    prompt:
      "Vous avez participé à un atelier de cuisine dans votre ville. Sur votre blog, racontez cette expérience et expliquez pourquoi vous recommandez cette activité.",
    recipient: "Un article de blog",
    help: "Situez l’expérience, racontez un moment précis et donnez votre avis.",
  },
  {
    title: "Défendre un point de vue",
    short: "L’argumentation",
    type: "Comparer deux idées et prendre position.",
    min: 120,
    max: 180,
    time: 25,
    prompt:
      "Le télétravail est-il une bonne solution pour tous ? Comparez les points de vue des deux documents, puis présentez votre opinion.",
    recipient: "Un texte argumentatif",
    help: "Comparez les deux avis avant de développer votre propre position.",
  },
];
const sample =
  "Salut Camille,\n\nJ’espère que tu vas bien ! Je me suis enfin installé à Montréal et je voulais te parler de mon nouveau quartier. Les rues sont calmes et il y a un petit marché tout près de chez moi.\n\nCe que je préfère, c’est le parc au bout de ma rue. J’y vais souvent pour lire et profiter du soleil.";

const currentView = (): View => {
  const page = location.hash.replace(/^#\/?/, "");
  return ["home", "library", "writing", "feedback"].includes(page)
    ? (page as View)
    : "home";
};

function Redesign() {
  const [view, setView] = useState<View>(currentView);
  const [selected, setSelected] = useState<QuestionEntry | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [task, setTask] = useState(0);
  const [answers, setAnswers] = useState([sample, "", ""]);
  const [accents, setAccents] = useState(false);
  const [focused, setFocused] = useState(false);
  const [exam, setExam] = useState(false);
  const [seconds, setSeconds] = useState(900);
  const [running, setRunning] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const tasks = taskMetadata.map((metadata, index) => {
    const source = selected?.combination.tasks[TASK_KEYS[index]];
    return {
      ...metadata,
      prompt: source?.instruction || metadata.prompt,
      min: source?.minWords || metadata.min,
      max: source?.maxWords || metadata.max,
    };
  });
  const info = tasks[task];
  const results = entries.filter((entry) =>
    `${entry.month} ${entry.year} ${Object.values(entry.combination.tasks)
      .map((t) => t.instruction)
      .join(" ")}`
      .toLocaleLowerCase("fr")
      .includes(query.toLocaleLowerCase("fr")),
  );
  const choose = (entry: QuestionEntry) => {
    if (entry.id !== selected?.id) setAnswers(["", "", ""]);
    setSelected(entry);
    setRunning(false);
    go("home");
  };
  const draw = () => {
    const entry = selectRandomCombination(entries, selected?.id);
    if (entry) choose(entry);
  };
  const words = countFrenchWords(answers[task]);
  const valid = words >= info.min && words <= info.max;
  useEffect(() => {
    if (!running || view !== "writing") return;
    const interval = window.setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [running, view]);
  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);
  useEffect(() => {
    const navigate = () => {
      setView(currentView());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const go = (next: View) => {
    setView(next);
    location.hash = `/${next}`;
    window.scrollTo(0, 0);
  };
  const start = (index = 0, timed = false) => {
    setTask(index);
    setExam(timed);
    setSeconds(timed ? 3600 : tasks[index].time * 60);
    setRunning(timed);
    go("writing");
  };
  const write = (text: string) =>
    setAnswers((old) => old.map((answer, i) => (i === task ? text : answer)));
  const insert = (character: string) => {
    const el = editor.current;
    if (!el) return;
    const a = el.selectionStart,
      b = el.selectionEnd;
    write(answers[task].slice(0, a) + character + answers[task].slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + character.length, a + character.length);
    });
  };
  return (
    <>
      <div className="concept-shell">
        <header className="app-header">
          <button
            className="brand"
            onClick={() => go("home")}
            aria-label="Écriture, accueil"
          >
            <Feather size={23} />
            <strong>écriture</strong>
            <span>TCF Canada</span>
          </button>
          <nav aria-label="Navigation principale">
            {(
              [
                ["home", "Pratiquer"],
                ["library", "Sujets"],
                ["feedback", "Bilan"],
              ] as const
            ).map(([page, label]) => (
              <button
                key={page}
                aria-current={
                  view === page || (page === "home" && view === "writing")
                    ? "page"
                    : undefined
                }
                onClick={() => go(page)}
              >
                {label}
              </button>
            ))}
          </nav>
          <span className="mockup-label">Aperçu</span>
        </header>
        <main id="concept-main">
          {view === "home" && (
            <div className="practice-page">
              <div className="page-title">
                <h1>Pratiquer l’écrit.</h1>
                <p>Une tâche pour progresser, un examen pour vous préparer.</p>
              </div>
              <section className="exam-picker" aria-label="Examen aléatoire">
                <div className="picker-title">
                  <span className="picker-icon">
                    <Shuffle size={23} />
                  </span>
                  <div>
                    <h2>Un examen au hasard</h2>
                    <p>
                      Une série complète de 3 tâches, tirée de la banque de
                      sujets.
                    </p>
                  </div>
                </div>
                <button className="action blue" onClick={draw}>
                  <Shuffle size={17} />{" "}
                  {selected ? "Tirer un autre examen" : "Examen aléatoire"}
                </button>
              </section>
              {selected && (
                <section
                  className="selected-exam"
                  aria-label="Examen sélectionné"
                  data-combination-id={selected.id}
                >
                  <div className="selection-heading">
                    <div>
                      <span className="selection-tag">Série sélectionnée</span>
                      <h2>
                        {selected.month} {selected.year}{" "}
                        <span>
                          — combinaison {selected.combination.combinationNumber}
                        </span>
                      </h2>
                    </div>
                    <span className="exam-duration">
                      <Clock3 size={15} /> 60 min
                    </span>
                  </div>
                  <ol>
                    {tasks.map((t, i) => (
                      <li key={i}>
                        <span>{i + 1}</span>
                        <p>{t.prompt}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="selection-bottom">
                    <span>Le chrono démarre quand vous commencez.</span>
                    <button
                      className="action blue"
                      onClick={() => start(0, true)}
                    >
                      Commencer l’examen <ArrowRight size={17} />
                    </button>
                  </div>
                </section>
              )}
              <div className="section-title">
                <h2>Ou pratiquer une tâche</h2>
                <button className="text-link" onClick={() => go("library")}>
                  Parcourir les sujets <ArrowRight size={15} />
                </button>
              </div>
              <div className="task-list">
                {tasks.map((t, i) => (
                  <button className="task-row" key={i} onClick={() => start(i)}>
                    <span className="task-number">{i + 1}</span>
                    <div>
                      <strong>{t.title}</strong>
                      <small>{t.type}</small>
                    </div>
                    <span className="task-range">
                      {t.min}–{t.max} mots
                    </span>
                    <span className="task-minutes">{t.time} min</span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
              {answers.some(Boolean) && (
                <button className="resume-row" onClick={() => go("writing")}>
                  <RotateCcw size={17} />
                  <span>
                    Reprendre mon brouillon
                    <small>
                      Tâche {task + 1} · {countFrenchWords(answers[task])} mots
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              )}
              <footer className="preview-footer">
                Maquette interactive · textes conservés pendant cet aperçu
                uniquement.
              </footer>
            </div>
          )}
          {view === "library" && (
            <div className="practice-page">
              <div className="page-title">
                <h1>Les sujets.</h1>
                <p>Choisissez une série ou laissez le hasard décider.</p>
              </div>
              <div className="library-toolbar">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    aria-label="Rechercher un sujet"
                    value={query}
                    placeholder="Rechercher un thème, un mois, une année…"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisibleCount(12);
                    }}
                  />
                </label>
                <button className="action blue" onClick={draw}>
                  <Shuffle size={17} /> Examen aléatoire
                </button>
              </div>
              <p className="result-count" role="status">
                {results.length} séries disponibles
              </p>
              <div className="subject-list">
                {results.slice(0, visibleCount).map((entry) => (
                  <button
                    key={entry.id}
                    className="subject-row"
                    onClick={() => choose(entry)}
                  >
                    <div>
                      <strong>
                        {entry.month} {entry.year}{" "}
                        <span>
                          · Combinaison {entry.combination.combinationNumber}
                        </span>
                      </strong>
                      <p>{entry.combination.tasks.task1.instruction}</p>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              {!results.length && (
                <p className="empty-results">
                  Aucun sujet trouvé. Essayez un autre thème ou une autre année.
                </p>
              )}
              {results.length > visibleCount && (
                <button
                  className="action load-more"
                  onClick={() => setVisibleCount((n) => n + 12)}
                >
                  Afficher plus de sujets
                </button>
              )}
            </div>
          )}
          {view === "writing" && (
            <div className="writing-content">
              <div className="session-heading">
                <div>
                  <button className="back-link" onClick={() => go("home")}>
                    <ChevronLeft size={15} /> Pratiquer
                  </button>
                  <h1>{exam ? "Votre examen blanc" : "Pratique guidée"}</h1>
                </div>
                <div
                  className={`demo-clock ${seconds < 300 ? "low-time" : ""}`}
                >
                  <Clock3 size={22} />
                  <div>
                    <small>
                      {exam ? "Temps restant" : "Votre temps de pratique"}
                    </small>
                    <strong>{formatTime(seconds)}</strong>
                  </div>
                  <button
                    aria-label={
                      running ? "Mettre en pause" : "Démarrer le chrono"
                    }
                    onClick={() => setRunning(!running)}
                  >
                    {running ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                </div>
              </div>
              <nav className="task-tabs" aria-label="Choisir la tâche">
                {tasks.map((t, i) => (
                  <button
                    key={t.short}
                    aria-pressed={task === i}
                    onClick={() => {
                      setTask(i);
                      setAccents(false);
                    }}
                  >
                    <span>{i + 1}</span>
                    {t.short}
                    <small>{countFrenchWords(answers[i])} mots</small>
                  </button>
                ))}
              </nav>
              <div className={`writing-sheets ${focused ? "focus-mode" : ""}`}>
                {!focused && (
                  <aside className="prompt-sheet">
                    <div className="sheet-caption">
                      <span>La consigne</span>
                      <span>Tâche {task + 1}</span>
                    </div>
                    <div className="prompt-body">
                      <span className="prompt-type">
                        {selected
                          ? `${selected.month} ${selected.year} · Combinaison ${selected.combination.combinationNumber}`
                          : info.recipient}
                      </span>
                      <h2>{info.title}</h2>
                      <p>{info.prompt}</p>
                      {task === 2 && (
                        <div className="source-docs">
                          <section>
                            <h3>Document 1</h3>
                            <p>
                              {selected?.combination.tasks.task3.document1 ||
                                "Le télétravail permet d’éviter les déplacements et d’organiser plus librement sa journée."}
                            </p>
                          </section>
                          <section>
                            <h3>Document 2</h3>
                            <p>
                              {selected?.combination.tasks.task3.document2 ||
                                "Travailler ensemble au bureau facilite les échanges et évite l’isolement."}
                            </p>
                          </section>
                        </div>
                      )}
                      <div className="word-requirement">
                        <Feather size={19} />
                        <span>
                          <strong>
                            {info.min} à {info.max} mots
                          </strong>
                          <small>Rédigez votre réponse en français.</small>
                        </span>
                      </div>
                      {!exam && (
                        <div className="prompt-tip">
                          <BookOpen size={18} />
                          <div>
                            <h3>Pour vous lancer</h3>
                            <p>{info.help}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
                <section className="response-sheet">
                  <div className="response-heading">
                    <label htmlFor="concept-response">Votre réponse</label>
                    <div>
                      <button
                        className="accent-button"
                        aria-expanded={accents}
                        aria-controls="concept-accents"
                        onClick={() => setAccents(!accents)}
                      >
                        <b>é</b> Accents <ChevronDown size={14} />
                      </button>
                      <button
                        className="expand-button"
                        aria-label={
                          focused
                            ? "Afficher la consigne"
                            : "Agrandir la rédaction"
                        }
                        onClick={() => setFocused(!focused)}
                      >
                        {focused ? (
                          <Minimize2 size={18} />
                        ) : (
                          <Maximize2 size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  {accents && (
                    <div className="accent-keys" id="concept-accents">
                      {"éèêëàâçîïôùûœ".split("").map((c) => (
                        <button
                          key={c}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insert(c)}
                          aria-label={`Insérer ${c}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    id="concept-response"
                    ref={editor}
                    value={answers[task]}
                    onChange={(e) => write(e.target.value)}
                    placeholder="Votre première phrase commence ici…"
                    lang="fr"
                    spellCheck={!exam}
                    aria-describedby="concept-word-count"
                  />
                  <div className="response-status">
                    <span>
                      <Check size={14} /> Brouillon de démonstration
                    </span>
                    <span>À vous de trouver les mots.</span>
                  </div>
                  <footer className="response-footer">
                    <div
                      className={`count-panel ${words > info.max ? "over-limit" : ""}`}
                      id="concept-word-count"
                    >
                      <div>
                        <strong>{words}</strong> mots{" "}
                        <span>
                          / {info.min}–{info.max}
                        </span>
                      </div>
                      <progress
                        max={info.max}
                        value={Math.min(words, info.max)}
                        aria-label="Nombre de mots"
                      />
                      <small>
                        {words > info.max
                          ? `${words - info.max} mots au-dessus de la limite`
                          : valid
                            ? "✓ Longueur respectée"
                            : `Encore ${info.min - words} mots pour atteindre le minimum`}
                      </small>
                    </div>
                    <button
                      className="action blue"
                      onClick={() => {
                        setRunning(false);
                        go("feedback");
                      }}
                    >
                      Voir le bilan d’exemple <ArrowRight size={17} />
                    </button>
                  </footer>
                </section>
              </div>
              <p className="prototype-footnote">
                Maquette interactive : vos textes restent uniquement dans cet
                aperçu et le bilan présente un exemple de retour pédagogique.
              </p>
            </div>
          )}
          {view === "feedback" && (
            <div className="feedback-content">
              <button className="back-link" onClick={() => go("writing")}>
                <ChevronLeft size={15} /> Revenir à mon texte
              </button>
              <div className="feedback-title">
                <span className="feedback-icon">
                  <Check size={29} />
                </span>
                <p>Bilan illustratif · Tâche 1</p>
                <h1>Votre message prend forme.</h1>
                <p>
                  Un retour précis pour savoir quoi garder et quoi retravailler.
                </p>
              </div>
              <div className="feedback-grid">
                <section className="feedback-main">
                  <h2>Ce qui fonctionne déjà</h2>
                  <p>
                    Le destinataire et la situation sont clairs. Votre
                    description donne des détails concrets et le ton reste
                    naturel entre amis.
                  </p>
                  <blockquote>
                    « Les rues sont calmes et il y a un petit marché tout près
                    de chez moi. »
                  </blockquote>
                  <p className="evidence-note">
                    Un détail précis qui aide votre ami à imaginer votre
                    quartier.
                  </p>
                  <div className="feedback-divider" />
                  <h2>Donner une vraie fin au message</h2>
                  <p>
                    La consigne demande aussi d’inviter votre ami. Ajoutez une
                    proposition concrète, puis une formule de fin.
                  </p>
                  <div className="suggestion">
                    <span>Une piste de réécriture</span>
                    <p>
                      Tu pourrais venir le week-end prochain ? Nous pourrions
                      découvrir le marché ensemble. J’ai hâte de te voir !
                    </p>
                  </div>
                </section>
                <aside className="next-step">
                  <Feather size={27} />
                  <h2>
                    Votre prochain
                    <br />
                    petit pas.
                  </h2>
                  <p>
                    Reprenez les dernières lignes de votre message. Votre ami
                    doit comprendre quand venir et ce que vous ferez ensemble.
                  </p>
                  <button
                    className="action blue"
                    onClick={() => {
                      setTask(0);
                      go("writing");
                      requestAnimationFrame(() => editor.current?.focus());
                    }}
                  >
                    Retravailler mon texte <ArrowRight size={17} />
                  </button>
                  <small>
                    Le bilan présenté est un exemple de mise en page. Aucune
                    correction IA n’est lancée dans cette maquette.
                  </small>
                </aside>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Redesign />);
