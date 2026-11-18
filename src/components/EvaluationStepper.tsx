import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, ShieldCheck } from "lucide-react";

interface EvaluationStepperProps {
  en: boolean;
  isBackground?: boolean;
}

export const EvaluationStepper: React.FC<EvaluationStepperProps> = ({
  en,
  isBackground,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    {
      titleEn: "Draft secured & queued",
      titleFr: "Rédaction enregistrée et mise en file",
      descEn: "Saved safely in this browser and queued for AI assessment.",
      descFr: "Sauvegardée dans ce navigateur et transmise au moteur d’évaluation.",
    },
    {
      titleEn: "Linguistic & syntax pass",
      titleFr: "Analyse morphosyntaxique et lexicale",
      descEn: "Examining verb tenses, sentence structures, and lexical variety.",
      descFr: "Examen des accords, structures de phrases et variété du vocabulaire.",
    },
    {
      titleEn: "Verbatim evidence verification",
      titleFr: "Vérification des citations et grille CECRL",
      descEn: "Checking exact student quotes against official CEFR descriptors.",
      descFr: "Validation des citations exactes selon les descripteurs du CECRL.",
    },
    {
      titleEn: "Synthesizing pedagogical review",
      titleFr: "Synthèse du bilan et projection NCLC",
      descEn: "Preparing actionable priorities, strengths, and NCLC range.",
      descFr: "Préparation des priorités de progrès et de l’estimation NCLC.",
    },
  ];

  const currentStepIndex =
    seconds < 4 ? 0 : seconds < 13 ? 1 : seconds < 24 ? 2 : 3;

  return (
    <section
      role="status"
      aria-live="polite"
      className="panel eval-stepper"
    >
      <div className="eval-stepper-head">
        <div className="row">
          <span className="eval-stepper-icon" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <div>
            <strong>
              {en ? "Pedagogical review in progress" : "Bilan pédagogique en cours"}
            </strong>
            <p className="muted">
              {isBackground
                ? en
                  ? "Running in background · safe to navigate or close"
                  : "Traitement en arrière-plan · vous pouvez naviguer librement"
                : en
                  ? "Reading your writing in two passes…"
                  : "Lecture de votre rédaction en deux passes…"}
            </p>
          </div>
        </div>
        <span className="badge neutral">{seconds}s</span>
      </div>

      <ol className="eval-stepper-list">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <li
              key={idx}
              className={`eval-step-row ${isDone ? "is-done" : isCurrent ? "is-current" : "is-pending"}`}
            >
              <span className="eval-step-marker" aria-hidden="true">
                {isDone ? (
                  <CheckCircle2 size={17} />
                ) : isCurrent ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <span className="eval-step-dot" />
                )}
              </span>
              <div>
                <strong>{en ? step.titleEn : step.titleFr}</strong>
                {(isCurrent || isDone) && (
                  <p>{en ? step.descEn : step.descFr}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="eval-stepper-foot">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          {en
            ? "Your writing stays saved in this browser. Reopening this page resumes the same review."
            : "Votre texte reste enregistré dans ce navigateur. Rouvrir cette page reprend le même bilan."}
        </span>
      </div>
    </section>
  );
};
