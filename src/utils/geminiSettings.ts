import { GEMINI_MODELS, fallbackModels } from "../../server/geminiModels.js";
export { GEMINI_MODELS, MODEL_IDS as GEMINI_FALLBACK_MODELS } from "../../server/geminiModels.js";
export function getGeminiModelChain(initial = getGeminiModel()): string[] {
  return fallbackModels(initial);
}
export const GEMINI_MODEL_STORAGE = "tcf_gemini_model";
export function getGeminiModel(_tasks?: readonly string[]): string {
  const configured = import.meta.env.VITE_GEMINI_MODEL?.trim();
  if (configured === "gemini-3.1-flash-lite") return "gemini-3.6-flash";
  return configured || GEMINI_MODELS[0].id;
}
export function setGeminiModel(model: string): void {
  if (
    !GEMINI_MODELS.some((option) => option.id === model) &&
    model !== import.meta.env.VITE_GEMINI_MODEL?.trim()
  )
    throw new Error("Unknown Gemini model.");
  localStorage.setItem(GEMINI_MODEL_STORAGE, model);
}
