import { errorLogStorageStatus, persistErrorLog } from "../server/errorLogs";
import type { ErrorLogEntry } from "../src/types/errorLog";
export const config = { runtime: "edge" };
export default async function handler(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (request.method === "GET") {
    const storage = await errorLogStorageStatus();
    return new Response(JSON.stringify({ storage }), {
      status: storage === "ready" ? 200 : 503,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    return new Response(null, { status: 403, headers });
  try {
    if (Number(request.headers.get("Content-Length")) > 4096)
      return new Response(null, { status: 413, headers });
    const text = await request.text();
    if (text.length > 4096) return new Response(null, { status: 413, headers });
    const body = JSON.parse(text);
    if (
      !body ||
      !["client_network", "assessment"].includes(body.stage) ||
      ![
        "timeout",
        "network_error",
        "invalid_json",
        "invalid_assessment",
        "truncated_response",
        "blocked_response",
      ].includes(body.code)
    )
      return new Response(null, { status: 400, headers });
    const stored = await persistErrorLog({
      ...body,
      source: "client",
      key_source: null,
      attempt: 0,
      provider_code: null,
      http_status: null,
    } as Partial<ErrorLogEntry>);
    return new Response(JSON.stringify({ stored }), {
      status: stored ? 201 : 503,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(null, { status: 400, headers });
  }
}
