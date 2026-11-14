import React from "react";
import {
  ArrowUpRight,
  CheckCheck,
  FilePenLine,
  MessageSquareText,
} from "lucide-react";
import type { ExamResult } from "../types/exam";
import { formatSessionDate, practicedKeys, TASK_INFO } from "../utils/practice";
import { useLanguage } from "../context/LanguageContext";
export function SessionList({
  sessions,
  onOpen,
}: {
  sessions: ExamResult[];
  onOpen: (result: ExamResult) => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <div className="session-list">
      {sessions.map((s, i) => {
        const keys = practicedKeys(s);
        const range = s.aiEvaluation?.pedagogical?.mock_projection;
        return (
          <button
            className="session-row"
            key={s.id || i}
            onClick={() => onOpen(s)}
          >
            <span
              className={`session-icon ${s.revisionOf ? "lavender" : s.isPracticeMode ? "sage" : "sand"}`}
            >
              {s.revisionOf ? (
                <CheckCheck size={20} />
              ) : s.isPracticeMode ? (
                <FilePenLine size={20} />
              ) : (
                <MessageSquareText size={20} />
              )}
            </span>
            <div className="session-row-main">
              <strong>
                {s.revisionOf
                  ? en
                    ? "Revision"
                    : "Réécriture"
                  : s.isPracticeMode
                    ? keys
                        .map((k) => `Tâche ${TASK_INFO[k].number}`)
                        .join(" + ")
                    : en
                      ? "Full mock exam"
                      : "Examen blanc complet"}
              </strong>
              <small>
                {s.month} {s.year} · {en ? "Set" : "Série"}{" "}
                {s.combination.combinationNumber} ·{" "}
                {formatSessionDate(s, language)}
              </small>
            </div>
            <span className={`badge ${s.aiEvaluation ? "sage" : "sand"}`}>
              {range
                ? `NCLC ${range.lower === 3 ? "<4" : range.lower}–${range.upper === 10 ? "10+" : range.upper}`
                : s.aiEvaluation
                  ? en
                    ? "Reviewed"
                    : "Corrigé"
                  : en
                    ? "Ready for feedback"
                    : "À corriger"}
            </span>
            <ArrowUpRight size={17} />
          </button>
        );
      })}
    </div>
  );
}
