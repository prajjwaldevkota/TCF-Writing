/** Vercel-only backup transport. The unprefixed key never enters the Vite bundle. */
export const config = { runtime: "edge" };
const allowedModels = new Set([
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);
const jsonError = (message: string, status: number, noRetry = false) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(noRetry ? { "X-TCF-No-Retry": "1" } : {}),
    },
  });
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const key = process.env.GEMINI_BACKUP_KEY?.trim();
  if (!key)
    return jsonError("GEMINI_BACKUP_KEY is not configured on the server.", 401);
  try {
    const body = await request.json();
    if (
      !allowedModels.has(body.model) ||
      !Array.isArray(body.request?.contents)
    )
      return jsonError("Invalid Gemini request.", 400);
    // Avoid repeating a rejected request when both configured keys are identical.
    const primaryHash = request.headers.get("x-tcf-primary-key-hash");
    if (primaryHash) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${body.model}\n${key}`),
      );
      const hash = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash === primaryHash)
        return jsonError(
          "The backup key is identical to the primary key.",
          409,
        );
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(body.model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body.request),
        signal: AbortSignal.timeout(120000),
      },
    );
    const text = await response.text();
    // Do not relay provider diagnostics that could include credentials.
    if (!response.ok)
      return new Response(
        JSON.stringify({ error: `Gemini backup: HTTP ${response.status}` }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...(response.headers.get("Retry-After")
              ? { "Retry-After": response.headers.get("Retry-After")! }
              : {}),
          },
        },
      );
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError(
      "Gemini backup request could not finish. No automatic retry was made.",
      502,
      true,
    );
  }
}
