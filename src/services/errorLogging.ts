import type { ClientDiagnostics, ErrorLogEntry } from "../types/errorLog";
export function createLogRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function getClientDiagnostics(): ClientDiagnostics {
  const ua = navigator.userAgent;
  return {
    browser: /Edg\//.test(ua)
      ? "edge"
      : /Firefox\//.test(ua)
        ? "firefox"
        : /Chrome\//.test(ua)
          ? "chrome"
          : /Safari\//.test(ua)
            ? "safari"
            : "other",
    platform: /Android/.test(ua)
      ? "android"
      : /iPhone|iPad/.test(ua)
        ? "ios"
        : /Windows/.test(ua)
          ? "windows"
          : /Mac/.test(ua)
            ? "mac"
            : /Linux/.test(ua)
              ? "linux"
              : "other",
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    online: navigator.onLine,
  };
}
// Never send exception messages, stack traces, prompts, responses, keys or tokens.
export function reportReviewError(
  entry: Pick<
    ErrorLogEntry,
    "request_id" | "stage" | "code" | "model" | "duration_ms"
  >,
): void {
  try {
    void fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...entry,
        client_context: getClientDiagnostics(),
      }),
      keepalive: true,
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  } catch {
    /* Offline or older browsers must still display the original error. */
  }
}
