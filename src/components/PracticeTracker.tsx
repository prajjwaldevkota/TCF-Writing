import React from "react";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import type { ExamResult } from "../types/exam";
import { practiceSummary } from "../utils/practice";
import { useLanguage } from "../context/LanguageContext";

export function PracticeTracker({
  submissions,
  onProgress,
}: {
  submissions: ExamResult[];
  onProgress?: () => void;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const { days, weekCount } = practiceSummary(submissions);
  const activeDays = days.filter((day) => day.count > 0).length;
  const format = new Intl.DateTimeFormat(en ? "en-CA" : "fr-CA", {
    weekday: "short",
  });
  return (
    <section
      className="practice-tracker"
      aria-labelledby="practice-tracker-title"
    >
      <div className="tracker-intro">
        <h2 id="practice-tracker-title">
          <CalendarDays size={18} />
          {en ? "Your last 7 days" : "Vos 7 derniers jours"}
        </h2>
        <p>
          {en
            ? `${weekCount} finished sessions · ${activeDays} active days`
            : `${weekCount} séances terminées · ${activeDays} jours de pratique`}
        </p>
        <span>
          {en
            ? "Every saved session counts, with or without AI feedback."
            : "Chaque séance terminée compte, avec ou sans bilan IA."}
        </span>
      </div>
      <ol
        className="tracker-days"
        aria-label={en ? "Daily practice activity" : "Activité quotidienne"}
      >
        {days.map(({ date, count }, index) => (
          <li
            key={date.toDateString()}
            className={`${count ? "has-activity" : ""} ${index === 6 ? "is-today" : ""}`}
          >
            <span>
              {index === 6 ? (en ? "Today" : "Auj.") : format.format(date)}
            </span>
            <strong
              aria-label={`${date.toLocaleDateString(language)}: ${count} ${en ? "finished sessions" : "séances terminées"}`}
            >
              {count || "–"}
            </strong>
          </li>
        ))}
      </ol>
      {onProgress && (
        <button className="text-button tracker-link" onClick={onProgress}>
          {en ? "View progress" : "Voir mes progrès"}
          <ArrowUpRight size={16} />
        </button>
      )}
    </section>
  );
}
