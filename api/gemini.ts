/** All deployment credentials stay in this Vercel function. */
export const config = { runtime: "edge" };
const allowedModels = new Set([
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const jsonError = (message: string, status: number, extra = {}) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, ...extra },
  });
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  // Support the previous deployment variable while moving to an unprefixed secret.
  const primary =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.VITE_GEMINI_API_KEY?.trim();
  const backup =
    process.env.GEMINI_BACKUP_KEY?.trim() ||
    process.env.GEMINI_BACKUP_API_KEY?.trim();
  const keys = [
    ...(primary ? [{ value: primary, source: "primary" }] : []),
    ...(backup && backup !== primary
      ? [{ value: backup, source: "backup" }]
      : []),
  ];
  if (!keys.length)
    return jsonError(
      "The deployment's Gemini credentials are not configured.",
      503,
      {
        "X-TCF-Error": "server_not_configured",
        "X-TCF-No-Retry": "1",
      },
    );
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON request.", 400);
  }
  if (
    !body ||
    !allowedModels.has(body.model) ||
    !Array.isArray(body.request?.contents)
  )
    return jsonError("Invalid Gemini request.", 400);
  let modelUnavailable = false;
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(body.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key.value,
          },
          body: JSON.stringify(body.request),
          signal: AbortSignal.timeout(120000),
        },
      );
      const text = await response.text();
      if (response.ok)
        return new Response(text, {
          status: 200,
          headers: { ...headers, "X-TCF-Key-Source": key.source },
        });
      if ([404, 429, 503].includes(response.status)) modelUnavailable = true;
      // Only a definitive HTTP rejection can trigger a backup attempt.
      if (
        [401, 403, 404, 429, 500, 502, 503, 504].includes(response.status) &&
        index + 1 < keys.length
      )
        continue;
      // Provider diagnostics can contain credentials; relay only a status.
      return jsonError(`Gemini: HTTP ${response.status}`, response.status, {
        ...(response.headers.get("Retry-After")
          ? { "Retry-After": response.headers.get("Retry-After")! }
          : {}),
        ...(modelUnavailable ? { "X-TCF-Model-Unavailable": "1" } : {}),
      });
    } catch {
      // Accepted work may still be running: never replay a network failure.
      return jsonError(
        "Gemini request could not finish. No automatic retry was made.",
        502,
        { "X-TCF-No-Retry": "1" },
      );
    }
  }
  return jsonError("Gemini request failed.", 502);
}
