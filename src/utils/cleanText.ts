/**
 * Fixes double-encoded UTF-8 strings (mojibake) such as 'Ã©' -> 'é', 'â€™' -> '’', etc.
 */
export function fixMojibake(text?: string | null): string {
  if (!text) return '';
  // Quick return if string has no mojibake indicators
  if (!/[ÃÂ]|â\x80|â€/.test(text)) {
    return text;
  }

  try {
    const fixed = decodeURIComponent(escape(text));
    if (fixed && !/[ÃÂ]|â\x80|â€/.test(fixed)) {
      return fixed;
    }
  } catch {
    // ignore
  }

  // Fallback explicit replacements for French mojibake characters
  return text
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã«/g, 'ë')
    .replace(/Ã\xa0/g, 'à')
    .replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã®/g, 'î')
    .replace(/Ã¯/g, 'ï')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã¹/g, 'ù')
    .replace(/Ã»/g, 'û')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã\x80/g, 'À')
    .replace(/Ã€/g, 'À')
    .replace(/Ã\x89/g, 'É')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã\x88/g, 'È')
    .replace(/Ãˆ/g, 'È')
    .replace(/Ã\x8a/g, 'Ê')
    .replace(/ÃŠ/g, 'Ê')
    .replace(/Ã‡/g, 'Ç')
    .replace(/â\x80\x99/g, '’')
    .replace(/â\x80\x9c/g, '“')
    .replace(/â\x80\x9d/g, '”')
    .replace(/â\x80\x93/g, '–')
    .replace(/â\x80\x94/g, '—')
    .replace(/â\x80\xa6/g, '…')
    .replace(/â€™/g, '’')
    .replace(/â€˜/g, '‘')
    .replace(/â€œ/g, '“')
    .replace(/â€\x9d/g, '”')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
    .replace(/Â«/g, '«')
    .replace(/Â»/g, '»')
    .replace(/Â\s/g, ' ')
    .replace(/Â/g, '');
}

/**
 * Normalizes paragraph text:
 * - Strips literal tabs (\t), carriage returns (\r), or accidental /t, /r
 * - Joins artificial line-breaks within sentences so paragraphs flow naturally across the full width of the container
 * - Preserves intentional paragraph breaks (\n\n)
 */
export function normalizeParagraphText(text?: string | null, isDocument = false): string {
  if (!text) return '';

  // 1. Repair mojibake
  let s = fixMojibake(text);

  // 2. Remove literal and escaped tabs and carriage returns
  s = s.replace(/\\t/g, ' ').replace(/\t/g, ' ');
  s = s.replace(/\\r/g, '').replace(/\r/g, '');
  s = s.replace(/\\n/g, '\n');
  s = s.replace(/(?<=\s)\/[tr](?=\s)/g, ' ');

  // 3. For documents (Task 3 Document 1 & 2):
  if (isDocument) {
    // Preserve attribution on separate line if marked by D’après or Source
    s = s.replace(/\n(?=(?:D’après|D\'après|Source\s*:))/g, '\n\n');
    const paragraphs = s.split(/\n\s*\n/);
    const cleanedParas = paragraphs.map((p) => {
      const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.join(' ').replace(/\s{2,}/g, ' ').trim();
    }).filter(Boolean);
    return cleanedParas.join('\n\n');
  }

  // 4. For Instructions (Task 1 & Task 2):
  // Preserve multi-line letter formatting and dialogue, but join lines split midway inside a sentence
  const paragraphs = s.split(/\n\s*\n/);
  const cleanedParas: string[] = [];

  for (const p of paragraphs) {
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const cur: string[] = [];
    for (const l of lines) {
      if (
        (l.startsWith('Vous ') || l.startsWith('Rédigez ') || l.startsWith('Écrivez ')) &&
        cur.length &&
        cur.some((c) => /[»"\.!]$/.test(c))
      ) {
        cleanedParas.push(cur.join(' '));
        cur.length = 0;
        cur.push(l);
      } else if (
        cur.length &&
        !/[:»"]$/.test(cur[cur.length - 1]) &&
        !(cur[cur.length - 1].length < 25 && /[,!]$/.test(cur[cur.length - 1]))
      ) {
        // Line continuation
        cur.push(l);
      } else if (
        cur.length &&
        /[.?!]$/.test(cur[cur.length - 1]) &&
        !/(?:etc\.|ex\.)$/.test(cur[cur.length - 1]) &&
        /^[A-ZÀ-ÖØ-ß]/.test(l) &&
        cur[cur.length - 1].length > 50
      ) {
        // Continuous sentence in the same paragraph
        cur.push(l);
      } else {
        if (cur.length) {
          cleanedParas.push(cur.join(' '));
          cur.length = 0;
        }
        cur.push(l);
      }
    }
    if (cur.length) {
      cleanedParas.push(cur.join(' '));
    }
  }

  return cleanedParas
    .join('\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();
}

/**
 * Cleans document text, extracting the pure textual content from any dictionary
 * strings (e.g. {'contenu': '...', 'opinion': 'pour'}), unescaping quotes and newlines,
 * repairing mojibake characters, and unwrapping hard-wrapped lines so they use the full box width.
 */
export function cleanDocumentText(doc?: string | null): string {
  if (!doc) return '';
  let trimmed = doc.trim();

  if (trimmed.includes('contenu')) {
    // Match 'contenu': '...' or "contenu": "..."
    const match = trimmed.match(/['"]contenu['"]\s*:\s*(['"])([\s\S]*?)\1\s*(?:,\s*['"]opinion['"]|})/);
    if (match && match[2]) {
      trimmed = match[2]
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .trim();
    } else {
      const simpleMatch = trimmed.match(/['"]contenu['"]\s*:\s*['"]([\s\S]*?)['"](?:\s*,|\s*})/);
      if (simpleMatch && simpleMatch[1]) {
        trimmed = simpleMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .trim();
      }
    }
  }

  return normalizeParagraphText(trimmed, true);
}
