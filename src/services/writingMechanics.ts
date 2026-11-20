import type { TaskKey, TaskRequirement } from '../types/exam';
import { countFrenchWords } from '../utils/wordCount';

function tokens(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu), match => ({
    value: match[0].normalize('NFC').toLowerCase().replace(/’/g, "'"),
    start: match.index!,
    end: match.index! + match[0].length,
  }));
}

// Count each answer token once, even across overlapping windows or identical sources.
export function sourceOverlap(answer: string, documents: string[]) {
  const words = tokens(answer);
  const windows = new Set<string>();
  for (const document of documents) {
    const source = tokens(document).map(word => word.value);
    for (let i = 0; i + 4 <= source.length; i++) windows.add(source.slice(i, i + 4).join(' '));
  }
  const covered = new Uint8Array(words.length);
  for (let i = 0; i + 4 <= words.length; i++) {
    if (windows.has(words.slice(i, i + 4).map(word => word.value).join(' '))) covered.fill(1, i, i + 4);
  }
  const phrases: string[] = [];
  // Keep verbatim examples from actual matches; adjacent matches can come from different documents.
  for (let i = 0; i + 4 <= words.length && phrases.length < 6; i++) {
    if (!windows.has(words.slice(i, i + 4).map(word => word.value).join(' '))) continue;
    const phrase = answer.slice(words[i].start, words[i + 3].end);
    if (!phrases.includes(phrase)) phrases.push(phrase);
    i += 3;
  }
  const matched = covered.reduce((total, n) => total + n, 0);
  return { covered_tokens: matched, total_tokens: words.length,
    percent: words.length ? Math.round(100 * matched / words.length) : 0, matched_phrases: phrases };
}

export function writingFacts(key: TaskKey, req: TaskRequirement, answer: string) {
  const count = countFrenchWords(answer);
  const missing: string[] = [];
  if (!req.instruction?.trim()) missing.push('instruction');
  if (key === 'task3') {
    if (!req.document1?.trim()) missing.push('document1');
    if (!req.document2?.trim()) missing.push('document2');
  }
  return { word_count: count, required: [req.minWords, req.maxWords],
    status: count < req.minWords ? 'UNDER_MINIMUM' : count > req.maxWords ? 'OVER_MAXIMUM' : 'IN_RANGE',
    blank: count === 0, missing_fields: missing,
    source_overlap: key === 'task3' && !missing.includes('document1') && !missing.includes('document2')
      ? sourceOverlap(answer, [req.document1!, req.document2!]) : null };
}
