/** Honor Retry-After without immediately spending more of the provider quota. */
export function retryDeadline(value: string | null, now = Date.now()): number {
  if (value !== null && value.trim() !== '') {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return now + Math.max(1000, seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date) && date > now) return date;
  }
  return now + 60_000;
}

const deadlines = new Map<string, number>();
const storageKey = (identity: string) => `tcf_groq_retry_${identity}`;
export function getRateLimitDeadline(identity: string): number {
  let stored = 0;
  try { stored = Number(localStorage.getItem(storageKey(identity))) || 0; } catch { /* Storage can be unavailable. */ }
  return Math.max(deadlines.get(identity) || 0, stored);
}
export function recordRateLimit(identity: string, retryAfter: string | null): number {
  const deadline = Math.max(getRateLimitDeadline(identity), retryDeadline(retryAfter));
  deadlines.set(identity, deadline);
  try { localStorage.setItem(storageKey(identity), String(deadline)); } catch { /* Keep the in-memory deadline. */ }
  return deadline;
}
export function rateLimitMessage(deadline: number, language: 'en' | 'fr'): string {
  const minutes = Math.max(1, Math.ceil((deadline - Date.now()) / 60_000));
  return language === 'en'
    ? `Groq quota reached. Try again in about ${minutes} min. Gemini can still grade your writing and estimate NCLC when supported.`
    : `Quota Groq atteint. Réessayez dans environ ${minutes} min. Gemini peut toujours évaluer votre texte et estimer le NCLC si les éléments le permettent.`;
}
