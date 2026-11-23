type Change = "same" | "added" | "removed";
export interface RevisionSpan {
  change: Change;
  text: string;
}

const tokenize = (text: string) =>
  text.match(/[\p{L}\p{M}\p{N}]+|\s+|[^\s\p{L}\p{M}\p{N}]/gu) ?? [];

// Align words and punctuation separately so a changed accent or comma is visible.
export function revisionDiff(before: string, after: string): RevisionSpan[] {
  const old = tokenize(before);
  const next = tokenize(after);
  const spans: RevisionSpan[] = [];
  function append(change: Change, text: string) {
    if (!text) return;
    const previous = spans[spans.length - 1];
    if (previous?.change === change) previous.text += text;
    else spans.push({ change, text });
  }

  let start = 0;
  let oldEnd = old.length;
  let nextEnd = next.length;
  while (start < oldEnd && start < nextEnd && old[start] === next[start]) start++;
  while (oldEnd > start && nextEnd > start && old[oldEnd - 1] === next[nextEnd - 1]) {
    oldEnd--;
    nextEnd--;
  }
  append("same", old.slice(0, start).join(""));

  const rows = oldEnd - start;
  const cols = nextEnd - start;
  // Pasted documents can be much longer than a TCF answer. Bound the alignment
  // work and preserve the entire changed passage verbatim in that case.
  if (!rows || !cols || rows * cols > 1_000_000) {
    append("removed", old.slice(start, oldEnd).join(""));
    append("added", next.slice(start, nextEnd).join(""));
  } else {
    const stride = cols + 1;
    const lengths = new Uint32Array((rows + 1) * stride);
    for (let i = rows - 1; i >= 0; i--) {
      for (let j = cols - 1; j >= 0; j--) {
        const cell = i * stride + j;
        lengths[cell] = old[start + i] === next[start + j]
          ? lengths[cell + stride + 1] + 1
          : Math.max(lengths[cell + stride], lengths[cell + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < rows && j < cols) {
      const cell = i * stride + j;
      if (old[start + i] === next[start + j]) {
        append("same", old[start + i]);
        i++;
        j++;
      } else if (lengths[cell + stride] >= lengths[cell + 1]) {
        append("removed", old[start + i++]);
      } else {
        append("added", next[start + j++]);
      }
    }
    append("removed", old.slice(start + i, oldEnd).join(""));
    append("added", next.slice(start + j, nextEnd).join(""));
  }
  append("same", old.slice(oldEnd).join(""));
  return spans;
}
