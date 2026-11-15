/** Short, verbatim spans make it easier for assessors to quote spelling as written. */
export function evidenceExcerpts(answer: string): string[] {
  const words = [...answer.matchAll(/\S+/gu)];
  const excerpts: string[] = [];
  for (let index = 0; index < words.length; index += 12) {
    const last = words[Math.min(index + 11, words.length - 1)];
    const excerpt = answer.slice(
      words[index].index!,
      last.index! + last[0].length,
    );
    if (!excerpts.includes(excerpt)) excerpts.push(excerpt);
  }
  return excerpts;
}
