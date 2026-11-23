import { Fragment, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { MistakeItem } from "../types/aiEvaluation";

export function AnnotatedAnswer({ answer, mistakes = [], en }: {
  answer: string;
  mistakes?: MistakeItem[];
  en: boolean;
}) {
  const [selected, setSelected] = useState<MistakeItem | null>(null);
  const matches = mistakes.flatMap(mistake => {
    const quote = mistake.original_text;
    if (!quote) return [];
    const start = answer.indexOf(quote);
    if (start < 0 || answer.indexOf(quote, start + 1) >= 0) return [];
    return [{ start, end: start + quote.length, mistake }];
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  let cursor = 0;
  const passages = matches.flatMap(({ start, end, mistake }) => {
    if (start < cursor) return [];
    const before = answer.slice(cursor, start);
    cursor = end;
    return [<Fragment key={start}>{before}<button
      className="annotated-phrase"
      aria-pressed={selected === mistake}
      onClick={() => setSelected(selected === mistake ? null : mistake)}
    >{answer.slice(start, end)}</button></Fragment>];
  });
  return <>
    {passages.length > 0 && <p className="annotation-hint">{en ? "Select an underlined phrase to see its correction." : "Sélectionnez un passage souligné pour voir sa correction."}</p>}
    <div className="original-writing">{passages}{answer.slice(cursor) || (!answer && (en ? "No response was written for this task." : "Aucune réponse rédigée pour cette tâche."))}</div>
    {selected && mistakes.includes(selected) && <div className="passage-note" role="status">
      <small>{selected.category}</small>
      <p><del>{selected.original_text}</del> <ArrowRight size={14} aria-hidden="true" /> <strong>{selected.corrected_text}</strong></p>
      <p>{selected.explanation}</p>
    </div>}
  </>;
}
