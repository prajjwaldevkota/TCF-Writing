export const ERROR_STAGES = [
  "configuration",
  "request",
  "provider_http",
  "provider_network",
  "client_network",
  "assessment",
] as const;
export const ERROR_CODES = [
  "missing_credentials",
  "invalid_request",
  "http_error",
  "timeout",
  "network_error",
  "invalid_json",
  "invalid_assessment",
  "truncated_response",
  "blocked_response",
] as const;
export interface ClientDiagnostics {
  browser: "chrome" | "edge" | "firefox" | "safari" | "other";
  platform: "windows" | "mac" | "linux" | "android" | "ios" | "other";
  viewport_width: number;
  viewport_height: number;
  online: boolean;
}
export interface ErrorLogEntry {
  request_id: string;
  source: "server" | "client";
  stage: (typeof ERROR_STAGES)[number];
  code: (typeof ERROR_CODES)[number];
  model: string | null;
  key_source: "primary" | "backup" | null;
  attempt: number;
  http_status: number | null;
  duration_ms: number;
  retry_after_seconds: number | null;
  error_type:
    | "Error"
    | "TimeoutError"
    | "AbortError"
    | "TypeError"
    | "SyntaxError"
    | null;
  provider_code: string | null;
  client_context: ClientDiagnostics | null;
}
export interface StoredErrorLog extends ErrorLogEntry {
  id: string;
  created_at: string;
  deployment: string | null;
  region: string | null;
}
