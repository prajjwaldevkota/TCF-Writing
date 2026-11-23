import { Fragment, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { revisionDiff } from "../utils/revisionDiff";
import { countFrenchWords } from "../utils/wordCount";

export function RevisionComparison({ before, after, priorities, en }: {
  before: string;
  after: string;
  priorities?: string[];
  en: boolean;
}) {
  const [open, setOpen] = useState(false);
  const spans = useMemo(() => open && before !== after ? revisionDiff(before, after) : [], [before, after, open]);
  return (
    <details className="draft-comparison" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{en ? "Compare the two drafts" : "Comparer les deux versions"} <ChevronDown size={16} /></summary>
      {open && <>
        {!!priorities?.length && <div className="comparison-priorities">
          <h4>{en ? "Priorities from your previous review" : "Priorités du bilan précédent"}</h4>
          <ul>{priorities.map((priority, i) => <li key={i}>{priority}</li>)}</ul>
        </div>}
        {before === after ? (
          <p>{en ? "The two versions are identical." : "Les deux versions sont identiques."}</p>
        ) : <div className="comparison-versions">
          {(["removed", "added"] as const).map(change => {
            const previous = change === "removed";
            const answer = previous ? before : after;
            const words = countFrenchWords(answer);
            return <section key={change}>
              <h4>{previous ? (en ? "Previous version" : "Version précédente") : (en ? "Rewrite" : "Réécriture")}</h4>
              <small>{words} {en ? (words === 1 ? "word" : "words") : (words === 1 ? "mot" : "mots")}</small>
              <p>{!answer ? (en ? "Empty response" : "Réponse vide") : spans.map((span, i) => {
                if (span.change === "same") return <Fragment key={i}>{span.text}</Fragment>;
                if (span.change !== change) return null;
                return previous ? <del key={i}>{span.text}</del> : <ins key={i}>{span.text}</ins>;
              })}</p>
            </section>;
          })}
        </div>}
      </>}
    </details>
  );
}
