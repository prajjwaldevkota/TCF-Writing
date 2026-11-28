import React, { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { ExamResult } from "../types/exam";
import { useLanguage } from "../context/LanguageContext";
import { submissionExport } from "../utils/submissionExport";

export function SubmissionExport({ result }: { result: ExamResult }) {
  const { language } = useLanguage();
  const en = language === "en";
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const text = submissionExport(result);
  return (
    <section
      className="submission-export"
      aria-label={
        en
          ? "Export your writing"
          : "Exporter votre rédaction"
      }
    >
      <div>
        <strong>
          {en
            ? "Copy your submission"
            : "Copier votre rédaction"}
        </strong>
        <p>
          {en
            ? "Copy the prompts, source documents and your answers together."
            : "Copiez les consignes, les documents et vos réponses en un seul clic."}
        </p>
      </div>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setManual(false);
          } catch {
            setCopied(false);
            setManual(true);
          }
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? (en ? "Copied" : "Copié") : en ? "Copy all" : "Copier tout"}
      </button>
      <span className="sr-only" role="status">
        {copied
          ? en
            ? "Prompts, documents and answers copied."
            : "Consignes, documents et réponses copiés."
          : ""}
      </span>
      {manual && (
        <div className="manual-export">
          <div className="row between">
            <label htmlFor="manual-export">
              {en
                ? "Clipboard unavailable. Select and copy this text."
                : "Presse-papiers indisponible. Sélectionnez et copiez ce texte."}
            </label>
            <button
              className="icon-button"
              onClick={() => setManual(false)}
              aria-label={en ? "Close manual copy" : "Fermer la copie manuelle"}
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            id="manual-export"
            readOnly
            value={text}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </section>
  );
}
