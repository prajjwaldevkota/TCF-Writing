export const GEMINI_MODELS = [
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
] as const;
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;
export function getGeminiModelChain(initial = getGeminiModel()): string[] {
  const index = GEMINI_FALLBACK_MODELS.findIndex((model) => model === initial);
  return index >= 0 ? GEMINI_FALLBACK_MODELS.slice(index) : [initial];
}
export const GEMINI_MODEL_STORAGE = "tcf_gemini_model";
export function getGeminiModel(): string {
  return import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}
export function setGeminiModel(model: string): void {
  if (
    !GEMINI_MODELS.some((option) => option.id === model) &&
    model !== import.meta.env.VITE_GEMINI_MODEL?.trim()
  )
    throw new Error("Unknown Gemini model.");
  localStorage.setItem(GEMINI_MODEL_STORAGE, model);
}
