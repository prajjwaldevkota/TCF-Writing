export const GEMINI_MODELS = [
  { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
] as const;

export const MODEL_IDS: string[] = GEMINI_MODELS.map(model => model.id);

export function fallbackModels(initial: string): string[] {
  // Old queued jobs can still name 3.1. Its position now leads to a current model.
  if (initial === "gemini-3.1-flash-lite") return ["gemini-3.6-flash", "gemini-3.8-flash"];
  if (initial === "gemini-3.5-flash-lite") return [initial, "gemini-3.6-flash", "gemini-3.8-flash"];
  if (initial === "gemini-3.8-flash") return [initial, "gemini-3.6-flash"];
  return MODEL_IDS.includes(initial) ? MODEL_IDS.slice(MODEL_IDS.indexOf(initial)) : [initial];
}
