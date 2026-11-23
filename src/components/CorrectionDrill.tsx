import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";
import type { MistakeItem, SavedMistake } from "../types/aiEvaluation";
import { dueCorrections, matchesCorrection, scheduleCorrection } from "../utils/correctionDrill";

export function CorrectionDrill({ en, focus }: { en: boolean; focus?: { cards: MistakeItem[]; description: string } }) {
  const { store, getStoredMistakes } = useWorkspace();
  const [dueCards, setCards] = useState<SavedMistake[]>([]);
  const [stage, setStage] = useState<"ready" | "active" | "done">("ready");
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [matched, setMatched] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const cards = focus?.cards ?? dueCards;
  const current = cards[index];
  const refresh = useCallback(() => {
    try { setCards(dueCorrections(getStoredMistakes(), store)); }
    catch { setCards([]); }
  }, [getStoredMistakes, store]);

  useEffect(() => {
    if (focus || stage !== "ready") return;
    refresh();
    const unsubscribe = store.subscribe(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [stage, refresh, store, focus]);

  useEffect(() => {
    if (stage === "active") field.current?.focus();
  }, [stage, index]);

  function check(reveal: boolean) {
    if (matched !== null || !current) return;
    const correct = !reveal && matchesCorrection(attempt, current.corrected_text);
    setMatched(correct);
    if (correct) setScore(total => total + 1);
    if (focus) return;
    try { scheduleCorrection(store, dueCards[index], correct); }
    catch { setSaveError(true); }
  }
  function next() {
    if (index + 1 === cards.length) setStage("done");
    else setIndex(index + 1);
    setAttempt("");
    setMatched(null);
  }
  if (!cards.length) return null;
  return <section className="correction-drill panel" aria-labelledby="drill-heading">
    <div className="drill-heading">
      <RotateCcw size={20} aria-hidden="true" />
      <h2 id="drill-heading">{focus ? (en ? "Practise this next" : "À travailler en priorité") : en ? "Five-minute correction drill" : "Cinq minutes de révision"}</h2>
    </div>
    {stage === "ready" && <>
      <p>{focus ? focus.description : en ? "Rewrite up to three passages from your notebook from memory." : "Corrigez de mémoire jusqu’à trois passages de votre carnet."}</p>
      {focus && <blockquote lang="fr">{cards[0].original_text}</blockquote>}
      <button className="button secondary" onClick={() => {
        setStage("active"); setIndex(0); setScore(0); setSaveError(false);
      }}>{en ? "Start drill" : "Commencer la révision"} <ArrowRight size={15} /></button>
    </>}
    {stage === "active" && current && <>
      <p className="muted" role="status">{index + 1} / {cards.length} · {current.category}</p>
      <blockquote lang="fr">{current.original_text}</blockquote>
      <form onSubmit={event => { event.preventDefault(); if (attempt.trim()) check(false); }}>
        <label htmlFor="drill-answer">{en ? "Your correction" : "Votre correction"}</label>
        <textarea id="drill-answer" ref={field} lang="fr" spellCheck={false} value={attempt}
          readOnly={matched !== null} onChange={event => setAttempt(event.target.value)} />
        {matched === null && <div className="row wrap">
          <button className="button primary" disabled={!attempt.trim()}>{en ? "Check answer" : "Vérifier"}</button>
          <button className="text-button" type="button" onClick={() => check(true)}>{en ? "Show answer" : "Voir la réponse"}</button>
        </div>}
      </form>
      {matched !== null && <>
        <div className="drill-feedback" role="status">
          <strong>{matched ? (en ? "Matches the correction" : "Conforme à la correction") : (en ? "Suggested correction" : "Correction proposée")}</strong>
          <p lang="fr">{current.corrected_text}</p>
          <p>{current.explanation}</p>
        </div>
        <button className="button primary" onClick={next}>{index + 1 < cards.length ? (en ? "Next correction" : "Correction suivante") : (en ? "Finish drill" : "Terminer la révision")}</button>
      </>}
    </>}
    {stage === "done" && <>
      <p role="status">{en ? `Drill complete · ${score}/${cards.length} matched from memory.` : `Révision terminée · ${score}/${cards.length} réponses retrouvées de mémoire.`}</p>
      {!focus && !saveError && <p>{en ? "Missed corrections return in one day. Matches return in three days." : "Les corrections à revoir reviennent dans un jour, les réponses retrouvées dans trois jours."}</p>}
      <button className="text-button" onClick={() => { if (!focus) refresh(); setStage("ready"); }}>{en ? "Done" : "Fermer"}</button>
    </>}
    {saveError && <p role="alert">{en ? "The browser could not save the next review date." : "La prochaine date de révision n’a pas pu être enregistrée."}</p>}
  </section>;
}
