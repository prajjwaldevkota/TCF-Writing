/**
 * Robustly sanitizes and parses JSON returned by AI models.
 * Fixes common LLM JSON formatting issues:
 * 1. Markdown code block wrappers (```json ... ```)
 * 2. Bad escape characters like \' (single quotes must NEVER be escaped in JSON RFC 8259)
 * 3. Stray backslashes followed by spaces, accents, or non-escape characters (e.g. \ , \(, \+, etc.)
 * 4. Trailing commas before closing braces/brackets
 * 5. Unescaped raw newlines or control characters inside string literals
 * 6. Extraneous text/preamble before or after the JSON payload
 */
export function safeParseGeminiJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error("Réponse vide reçue de l’IA.");
  }

  // 1. Strip markdown fences and whitespace
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the end of the first complete object, respecting strings and escapes.
  // lastIndexOf('}') incorrectly includes trailing braces or a second JSON value.
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        // Never silently choose between multiple competing assessments.
        if (/[{\[]/.test(cleaned.slice(i + 1))) {
          throw new Error('Plusieurs objets JSON dans la réponse IA. Veuillez relancer l’évaluation.');
        }
        cleaned = cleaned.slice(firstBrace, i + 1);
        break;
      }
    }
  }

  // Strategy 1: Standard JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (err1: any) {
    // Strategy 2: Fix invalid JSON escape sequences
    // In JSON (RFC 8259), valid escapes are ONLY: \\, \", \/, \b, \f, \n, \r, \t, and \uXXXX
    // Models very frequently output \' (e.g. in French text like l\'orthographe, d\'accord, qu\'il)
    // or stray backslashes before spaces or symbols.
    try {
      const fixedEscapes = cleaned.replace(/\\(.)/gs, (match, char) => {
        if (/["\\\/bfnrt]/.test(char)) return match;
        if (char === 'u') return match; // Keep unicode escape \uXXXX
        if (char === "'") return "'"; // Change \' to '
        return char; // Drop invalid backslash and keep character
      });
      return JSON.parse(fixedEscapes);
    } catch (err2: any) {
      // Strategy 3: Fix invalid escapes AND remove trailing commas
      try {
        const sanitized = cleaned
          .replace(/\\(.)/gs, (match, char) => {
            if (/["\\\/bfnrt]/.test(char)) return match;
            if (char === 'u') return match;
            if (char === "'") return "'";
            return char;
          })
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(sanitized);
      } catch (err3: any) {
        // Strategy 4: Handle unescaped raw newlines or control characters inside string literals
        try {
          let inString = false;
          let isEscaped = false;
          let rebuilt = '';

          for (let i = 0; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (ch === '"' && !isEscaped) {
              inString = !inString;
              rebuilt += ch;
            } else if (inString) {
              if (ch === '\\' && !isEscaped) {
                isEscaped = true;
                rebuilt += ch;
              } else {
                if (isEscaped) {
                  // If preceded by backslash, check if it's a valid JSON escape char
                  if (!/["\\\/bfnrtu]/.test(ch)) {
                    // Remove the previous invalid backslash from rebuilt
                    rebuilt = rebuilt.slice(0, -1);
                  }
                  isEscaped = false;
                }
                if (ch === '\n') rebuilt += '\\n';
                else if (ch === '\r') rebuilt += '\\r';
                else if (ch === '\t') rebuilt += '\\t';
                else rebuilt += ch;
              }
            } else {
              isEscaped = false;
              rebuilt += ch;
            }
          }

          rebuilt = rebuilt.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(rebuilt);
        } catch (finalErr: any) {
          console.error('safeParseGeminiJson failed. Raw text length:', rawText.length, 'Error:', finalErr);
          throw new Error(
            `Erreur de format JSON dans la réponse IA (${finalErr?.message || err1?.message}). Veuillez relancer l'évaluation.`
          );
        }
      }
    }
  }
}

