/** The simulator excludes standalone signs by default. */
export function countFrenchWords(text: string, includeStandaloneSigns = false): number {
  const tokens = text.match(/\S+/gu) ?? [];
  return includeStandaloneSigns ? tokens.length : tokens.filter(token => /[\p{L}\p{N}]/u.test(token)).length;
}

export function taskWordCount(text: string, minimum: number, maximum: number) {
  const word_count = countFrenchWords(text);
  const whitespace_count = countFrenchWords(text, true);
  const borderline = [word_count, whitespace_count].some(count =>
    Math.abs(count - minimum) <= 3 || Math.abs(count - maximum) <= 3);
  return { word_count, whitespace_count, borderline };
}

/**
 * Formats seconds into MM:SS format
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
