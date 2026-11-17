import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, ShieldCheck } from "lucide-react";

interface EvaluationStepperProps {
  en: boolean;
  isBackground?: boolean;
}

export const EvaluationStepper: React.FC<EvaluationStepperProps> = ({ en, isBackground }) => {
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
      titleFr: "Rédaction sécurisée & mise en file",
      descEn: "Saved safely in local storage and queued for AI assessment.",
      descFr: "Sauvegardée dans ce navigateur et transmise au moteur d'évaluation.",
      minSec: 0,
    },
    {
      titleEn: "Linguistic & syntax analysis",
      titleFr: "Analyse morphosyntaxique & lexicale",
      descEn: "Examining verbal tenses, sentence structures, and lexical diversity.",
      descFr: "Examen des accords, structures de phrases et variété du vocabulaire.",
      minSec: 4,
    },
    {
      titleEn: "Evidence cross-check",
      titleFr: "Vérification des citations & grille CEFR",
      descEn: "Checking verbatim student quotes against official CEFR level descriptors.",
      descFr: "Validation des citations exactes selon les descripteurs du CECRL.",
      minSec: 13,
    },
    {
      titleEn: "Finalizing pedagogical report",
      titleFr: "Synthèse du bilan & projection NCLC",
      descEn: "Synthesizing actionable feedback, strengths, and NCLC estimation.",
      descFr: "Génération des priorités de progrès et de la projection NCLC.",
      minSec: 24,
    },
  ];

  const currentStepIndex = seconds < 4 ? 0 : seconds < 13 ? 1 : seconds < 24 ? 2 : 3;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-slate-200 bg-white rounded-xl p-5 shadow-xs space-y-4 my-3 text-slate-800"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles size={17} className="animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 leading-snug">
              {en ? "AI Evaluation in Progress" : "Bilan pédagogique en cours"}
            </h4>
            <p className="text-xs text-slate-500">
              {isBackground
                ? en
                  ? "Background evaluation active · safe to close or navigate"
                  : "Traitement en arrière-plan · vous pouvez fermer ou naviguer"
                : en
                  ? `Analyzing your text (${seconds}s elapsed)…`
                  : `Analyse de votre texte (${seconds}s écoulées)…`}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          {seconds}s
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <div key={idx} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 size={18} className="text-blue-600 animate-spin" />
                ) : (
                  <div className="w-4.5 h-4.5 rounded-full border border-slate-300 bg-slate-50 mt-0.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold leading-tight ${
                    isDone
                      ? "text-slate-800"
                      : isCurrent
                      ? "text-blue-800"
                      : "text-slate-400"
                  }`}
                >
                  {en ? step.titleEn : step.titleFr}
                </p>
                {(isCurrent || isDone) && (
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                    {en ? step.descEn : step.descFr}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck size={14} className="text-slate-400 shrink-0" />
        <span>
          {en
            ? "Your writing is permanently saved in this browser. You can safely reopen this page at any time."
            : "Votre texte est sauvegardé de manière permanente dans ce navigateur. Vous pouvez rouvrir cette page à tout moment."}
        </span>
      </div>
    </div>
  );
};
