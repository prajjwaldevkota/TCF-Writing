/**
 * Counts words in French text sensibly according to TCF writing exam standards.
 * Ignores multiple spaces, leading/trailing whitespace, and standalone punctuation.
 */
export function countFrenchWords(text: string): number {
  // Space-delimited signs; whitespace from editor line breaks is a separator too.
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

/**
 * Formats seconds into MM:SS format
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
