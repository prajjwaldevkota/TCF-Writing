import {
  ERROR_CODES,
  ERROR_STAGES,
  type ClientDiagnostics,
  type ErrorLogEntry,
} from "../src/types/errorLog";

const models = new Set([
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requestId(value?: string | null): string {
  return value && uuid.test(value) ? value : crypto.randomUUID();
}
const integer = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.round(value)))
    : 0;
export function clientDiagnostics(value: unknown): ClientDiagnostics | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  return {
    browser: ["chrome", "edge", "firefox", "safari"].includes(
      input.browser as string,
    )
      ? (input.browser as ClientDiagnostics["browser"])
      : "other",
    platform: ["windows", "mac", "linux", "android", "ios"].includes(
      input.platform as string,
    )
      ? (input.platform as ClientDiagnostics["platform"])
      : "other",
    viewport_width: integer(input.viewport_width, 16000),
    viewport_height: integer(input.viewport_height, 16000),
    online: input.online === true,
  };
}
export function contextFromRequest(request: Request): ClientDiagnostics | null {
  try {
    return clientDiagnostics(
      JSON.parse(request.headers.get("X-TCF-Client-Context") || "null"),
    );
  } catch {
    return null;
  }
}
// Copy an allowlist, never spread errors, provider bodies, requests or browser input.
export function sanitizeErrorLog(input: Partial<ErrorLogEntry>): ErrorLogEntry {
  return {
    request_id: requestId(input.request_id),
    source: input.source === "client" ? "client" : "server",
    stage: ERROR_STAGES.includes(input.stage!) ? input.stage! : "request",
    code: ERROR_CODES.includes(input.code!) ? input.code! : "invalid_request",
    model: models.has(input.model!) ? input.model! : null,
    key_source:
      input.key_source === "primary" || input.key_source === "backup"
        ? input.key_source
        : null,
    attempt: integer(input.attempt, 2),
    http_status:
      typeof input.http_status === "number" &&
      input.http_status >= 100 &&
      input.http_status <= 599
        ? Math.round(input.http_status)
        : null,
    duration_ms: integer(input.duration_ms, 600000),
    retry_after_seconds:
      typeof input.retry_after_seconds === "number" &&
      Number.isFinite(input.retry_after_seconds)
        ? integer(input.retry_after_seconds, 86400)
        : null,
    error_type: [
      "Error",
      "TimeoutError",
      "AbortError",
      "TypeError",
      "SyntaxError",
    ].includes(input.error_type!)
      ? input.error_type!
      : null,
    provider_code: [
      "INVALID_ARGUMENT",
      "UNAUTHENTICATED",
      "PERMISSION_DENIED",
      "NOT_FOUND",
      "RESOURCE_EXHAUSTED",
      "INTERNAL",
      "UNAVAILABLE",
      "DEADLINE_EXCEEDED",
    ].includes(input.provider_code!)
      ? input.provider_code!
      : null,
    client_context: clientDiagnostics(input.client_context),
  };
}
export function errorType(error: unknown): ErrorLogEntry["error_type"] {
  const name = error instanceof Error ? error.name : "Error";
  return ["TimeoutError", "AbortError", "TypeError", "SyntaxError"].includes(
    name,
  )
    ? (name as ErrorLogEntry["error_type"])
    : "Error";
}
export function providerCode(text: string): string | null {
  try {
    return JSON.parse(text)?.error?.status || null;
  } catch {
    return null;
  }
}
export function retrySeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value))
    return Math.min(86400, Math.ceil(Number(value)));
  const until = Date.parse(value);
  return Number.isFinite(until)
    ? Math.min(86400, Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    : null;
}
function storageConfig() {
  return {
    url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim(),
    key: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}
// Expose only fixed diagnostic codes, never database bodies or credentials.
export async function errorLogStorageStatus(): Promise<string> {
  const { url, key } = storageConfig();
  if (!url) return "missing_database_url";
  if (!key) return "missing_server_key";
  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/error_logs?select=id&limit=0`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (response.ok) return "ready";
    if (response.status === 401 || response.status === 403)
      return "database_access_denied";
    if (response.status === 404) return "missing_table";
    return "database_rejected";
  } catch {
    return "database_unreachable";
  }
}
export async function persistErrorLog(
  input: Partial<ErrorLogEntry>,
): Promise<boolean> {
  const safe = sanitizeErrorLog(input);
  const row = {
    ...safe,
    deployment: /^[a-f0-9]{7,64}$/i.test(
      process.env.VERCEL_GIT_COMMIT_SHA || "",
    )
      ? process.env.VERCEL_GIT_COMMIT_SHA
      : null,
    region: /^[a-z0-9-]{1,32}$/i.test(process.env.VERCEL_REGION || "")
      ? process.env.VERCEL_REGION
      : null,
  };
  const { url, key } = storageConfig();
  let storageStatus = !url ? "missing_database_url" : "missing_server_key";
  let storageHttpStatus: number | null = null;
  if (url && key) {
    try {
      const response = await fetch(
        `${url.replace(/\/$/, "")}/rest/v1/error_logs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (response.ok) return true;
      storageStatus = "database_rejected";
      storageHttpStatus = response.status;
    } catch {
      storageStatus = "database_unreachable";
      /* Logging must never fail the original review or retry generation. */
    }
  }
  // Keep a safe diagnostic in Vercel logs if the database is not ready or unreachable.
  console.warn("tcf_error_log", JSON.stringify({
    ...row,
    storage_status: storageStatus,
    storage_http_status: storageHttpStatus,
  }));
  return false;
}
