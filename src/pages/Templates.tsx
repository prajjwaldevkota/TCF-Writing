import React, { useMemo, useState } from "react";
import { BookOpen, Search, ArrowUpRight } from "lucide-react";
import source from "../data/writingTemplates.md?raw";
import {
  parseWritingTemplates,
  filterWritingTemplates,
} from "../utils/writingTemplates";
import { TemplateMarkdown } from "../components/WritingTemplatePanel";
import { useLanguage } from "../context/LanguageContext";
const entries = parseWritingTemplates(source);
export function Templates({ onPractice }: { onPractice: () => void }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [task, setTask] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const matches = useMemo(
    () => filterWritingTemplates(entries, task, query),
    [task, query],
  );
  const active = matches.find((t) => t.id === selected) || matches[0];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en
              ? "A STRUCTURE, THEN YOUR OWN WORDS"
              : "UNE STRUCTURE, PUIS VOS PROPRES MOTS"}
          </p>
          <h1>
            {en
              ? "A little help getting started."
              : "Pour trouver vos premiers mots."}
          </h1>
          <p>
            {en
              ? "Your TCFFormation collection, organised by task and purpose."
              : "Votre collection TCFFormation, organisée par tâche et par objectif."}
          </p>
        </div>
        <button className="button secondary" onClick={onPractice}>
          {en ? "Put it into practice" : "Passer à la pratique"}
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="template-library panel">
        <aside>
          <div className="segmented">
            {[1, 2, 3, 0].map((n) => (
              <button
                key={n}
                aria-pressed={task === n}
                onClick={() => {
                  setTask(n);
                  setSelected("");
                }}
              >
                {n === 0 ? (en ? "All" : "Tous") : `T${n}`}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={en ? "Search templates" : "Rechercher un modèle"}
              placeholder={en ? "Invitation, opinion…" : "Invitation, opinion…"}
            />
          </label>
          <p className="eyebrow template-count">
            {matches.length} {en ? "REFERENCES" : "RÉFÉRENCES"}
          </p>
          <nav aria-label={en ? "Template list" : "Liste des modèles"}>
            {matches.map((entry) => (
              <button
                key={entry.id}
                className={active?.id === entry.id ? "active" : ""}
                onClick={() => setSelected(entry.id)}
              >
                <BookOpen size={15} />
                <span>{entry.title}</span>
              </button>
            ))}
          </nav>
        </aside>
        <article>
          {active ? (
            <>
              <span className="badge sage">
                TCFFormation · {en ? "Study reference" : "Support de pratique"}
              </span>
              <h2>{active.title}</h2>
              <div className="template-reading">
                <TemplateMarkdown
                  key={active.id}
                  body={active.body}
                  canCopy
                  en={en}
                />
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>
                {en ? "No matching template" : "Aucun modèle correspondant"}
              </h2>
              <p>
                {en
                  ? "Try a different search."
                  : "Essayez une autre recherche."}
              </p>
            </div>
          )}
        </article>
      </div>
      <p className="footnote">
        {en
          ? "Adapt the structure to the actual prompt. Replace every [bracket] and use your own ideas. These references are not an official marking grid."
          : "Adaptez la structure à la consigne. Remplacez chaque [crochet] et développez vos propres idées. Ces références ne sont pas une grille de correction officielle."}
      </p>
    </div>
  );
}
