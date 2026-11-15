export const GEMINI_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
] as const;
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
] as const;
export function getGeminiModelChain(initial = getGeminiModel()): string[] {
  const index = GEMINI_FALLBACK_MODELS.findIndex((model) => model === initial);
  return index >= 0 ? GEMINI_FALLBACK_MODELS.slice(index) : [initial];
}
export const GEMINI_MODEL_STORAGE = "tcf_gemini_model";
export const GEMINI_PRIMARY_STORAGE = "tcf_gemini_api_key";
export const GEMINI_BACKUP_STORAGE = "tcf_gemini_backup_api_key";
const read = (key: string) => {
  try {
    return localStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
};
export function getGeminiModel(): string {
  return import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}
export function setGeminiModel(model: string): void {
  if (
    !GEMINI_MODELS.some((option) => option.id === model) &&
    model !== import.meta.env.VITE_GEMINI_MODEL?.trim()
  )
    throw new Error("Unknown Gemini model.");
  localStorage.setItem(GEMINI_MODEL_STORAGE, model);
}
export function getGeminiApiKey(): string {
  return (
    read(GEMINI_PRIMARY_STORAGE) ||
    import.meta.env.VITE_GEMINI_API_KEY?.trim() ||
    ""
  );
}
export function getGeminiBackupApiKey(): string {
  return read(GEMINI_BACKUP_STORAGE);
}
export function hasServerGeminiBackup(): boolean {
  return import.meta.env.VITE_GEMINI_SERVER_BACKUP === true;
}
export function hasGeminiKey(): boolean {
  return Boolean(
    getGeminiApiKey() || getGeminiBackupApiKey() || hasServerGeminiBackup(),
  );
}
export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_PRIMARY_STORAGE, key.trim());
}
export function setGeminiBackupApiKey(key: string): void {
  localStorage.setItem(GEMINI_BACKUP_STORAGE, key.trim());
}
export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_PRIMARY_STORAGE);
}
