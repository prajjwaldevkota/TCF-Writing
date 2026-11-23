import { limitedBody } from "../server/requestBody.js";
import { prepareGeminiRequest } from "../server/geminiRequest.js";
import { reviewAccount } from "../server/reviewAuth.js";
import {
  persistErrorLog,
  requestId,
  contextFromRequest,
  errorType,
  providerCode,
  retrySeconds,
} from "../server/errorLogs.js";
import type { ErrorLogEntry } from "../src/types/errorLog.js";
/** All deployment credentials stay in this Vercel function. */
// Node.js permits waiting for the full provider response beyond Edge's 25s
// initial-response deadline. Keep room for two 120s attempts and diagnostics.
export const config = { maxDuration: 300 };
const allowedModels = new Set([
  "gemini-4-hydrogen",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
export async function handler(request: Request): Promise<Response> {
  const id = requestId(request.headers.get("X-TCF-Request-ID"));
  const responseHeaders = { ...headers, "X-TCF-Request-ID": id };
  const jsonError = (message: string, status: number, extra = {}) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...responseHeaders, ...extra },
    });
  const context = contextFromRequest(request);
  const log = (entry: Partial<ErrorLogEntry>) =>
    persistErrorLog({
      ...entry,
      request_id: id,
      source: "server",
      client_context: context,
    });
  if (request.method !== "POST") return jsonError("Method not allowed", 405);
  const account = await reviewAccount(request);
  if (account instanceof Response) return account;
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
  if (!keys.length) {
    await log({
      stage: "configuration",
      code: "missing_credentials",
      http_status: 503,
    });
    return jsonError(
      "The deployment's Gemini credentials are not configured.",
      503,
      {
        "X-TCF-Error": "server_not_configured",
        "X-TCF-No-Retry": "1",
      },
    );
  }
  let body: any;
  try {
    const text = await limitedBody(request, 200_000);
    if (text === null) return jsonError("Request too large.", 413);
    body = JSON.parse(text);
  } catch {
    await log({ stage: "request", code: "invalid_request", http_status: 400 });
    return jsonError("Invalid JSON request.", 400);
  }
  if (
    !body ||
    !allowedModels.has(body.model) ||
    !Array.isArray(body.request?.contents)
  ) {
    await log({ stage: "request", code: "invalid_request", http_status: 400 });
    return jsonError("Invalid Gemini request.", 400);
  }
  let modelUnavailable = false;
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const started = Date.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(body.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key.value,
          },
          body: JSON.stringify(prepareGeminiRequest(body.model, body.request)),
          signal: AbortSignal.timeout(120000),
        },
      );
      const text = await response.text();
      if (response.ok)
        return new Response(text, {
          status: 200,
          headers: { ...responseHeaders, "X-TCF-Key-Source": key.source },
        });
      await log({
        stage: "provider_http",
        code: "http_error",
        model: body.model,
        key_source: key.source as "primary" | "backup",
        attempt: index + 1,
        http_status: response.status,
        duration_ms: Date.now() - started,
        retry_after_seconds: retrySeconds(response.headers.get("Retry-After")),
        provider_code: providerCode(text),
      });
      if ([404, 429, 502, 503, 504].includes(response.status)) modelUnavailable = true;
      // Provider gateway, availability and deadline errors advance models.
      // A provider deadline is model-specific; another key does not make the
      // same request faster. Let the client advance to the next model instead.
      // Only a definitive HTTP rejection can trigger a backup attempt.
      if (
        [401, 403, 404, 429, 500].includes(response.status) &&
        index + 1 < keys.length
      )
        continue;
      // Provider diagnostics can contain credentials; relay only a status.
      return jsonError(`Gemini: HTTP ${response.status}`, response.status, {
        "X-TCF-Error-Source": "provider",
        ...(response.headers.get("Retry-After")
          ? { "Retry-After": response.headers.get("Retry-After")! }
          : {}),
        ...(modelUnavailable ? { "X-TCF-Model-Unavailable": "1" } : {}),
      });
    } catch (error) {
      const type = errorType(error);
      await log({
        stage: "provider_network",
        code:
          type === "TimeoutError" || type === "AbortError"
            ? "timeout"
            : "network_error",
        model: body.model,
        key_source: key.source as "primary" | "backup",
        attempt: index + 1,
        duration_ms: Date.now() - started,
        error_type: type,
      });
      // A server-observed provider deadline advances to a different model.
      // Never repeat that model with the backup key or replay ambiguous network failures.
      if (type === "TimeoutError" || type === "AbortError")
        return jsonError("Gemini provider deadline exceeded.", 504, {
          "X-TCF-Error-Source": "provider",
          "X-TCF-Model-Unavailable": "1",
        });
      return jsonError(
        "Gemini request could not finish. No automatic retry was made.",
        502,
        { "X-TCF-No-Retry": "1" },
      );
    }
  }
  return jsonError("Gemini request failed.", 502);
}

// Node's Web Standard entry point preserves the Request/Response contract.
export default { fetch: handler };
