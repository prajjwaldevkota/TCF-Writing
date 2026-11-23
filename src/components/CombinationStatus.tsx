import { CheckCircle2, ListChecks } from "lucide-react";
import type { CombinationProgress } from "../utils/practice";

export function CombinationStatus({ progress, en }: { progress?: CombinationProgress; en: boolean }) {
  if (!progress) return null;
  const count = progress.tasks.size;
  const Icon = count === 3 ? CheckCircle2 : ListChecks;
  let label = en ? `${count}/3 tasks practised` : `${count}/3 tâches travaillées`;
  if (progress.mockCompleted) label = en ? "Mock completed" : "Examen blanc terminé";
  else if (count === 3) label = en ? "Set completed" : "Série terminée";
  return <span className={`badge ${count === 3 ? "sage" : "sand"}`}><Icon size={14} aria-hidden="true" /> {label}</span>;
}
