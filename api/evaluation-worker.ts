import { prepareGeminiRequest } from "../server/geminiRequest.js";
import { randomUUID } from "node:crypto";
import {
  UUID, json, database, getJob, terminal, workerAuthorized, attemptPlan,
  type EvaluationJob,
  cacheableResponse,
} from "../server/evaluationJobs.js";
import { persistErrorLog, errorType, providerCode, retrySeconds } from "../server/errorLogs.js";

export const config = { maxDuration: 300 };
export async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!workerAuthorized(request)) return json({ error: "unauthorized" }, 401);
  try {
    const failedId = new URL(request.url).searchParams.get("failed");
    if (failedId) {
      if (!UUID.test(failedId)) return json({ error: "invalid_request" }, 400);
      const text = await request.text();
      if (text.length > 16_384) return json({ error: "invalid_request" }, 400);
      let callback;
      try { callback = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(callback?.sourceMessageId || "")) return json({ error: "invalid_request" }, 400);
      // QStash invokes this after delivery exhaustion; preserve successful work.
      // A stale callback from an earlier publish must not cancel a new delivery.
      await database(`evaluation_jobs?id=eq.${failedId}&status=in.(queued,running,retrying)&or=(message_id.eq.${callback.sourceMessageId},message_id.is.null)`, {
        method: "PATCH", body: JSON.stringify({ status: "failed", error_code: "delivery_exhausted", lease_token: null, lease_until: null,
          dead_letter_id: typeof callback.dlqId === "string" ? callback.dlqId.slice(0, 200) : null }),
      });
      return json({ ok: true });
    }
    const text = await request.text();
    if (text.length > 1024) return json({ error: "invalid_request" }, 400);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
    if (!UUID.test(body?.id)) return json({ error: "invalid_request" }, 400);
    const id = body.id as string;
    const lease = randomUUID();
    const claimed = await database<EvaluationJob[]>("rpc/claim_evaluation_job", {
      method: "POST", body: JSON.stringify({ job_id: id, claim_token: lease }),
    });
    const job = claimed[0];
    if (!job) {
      const current = await getJob(id);
      if (!current || terminal(current.status)) return json({ ok: true });
      return json({ error: "job_busy" }, 503, { "Retry-After": "30" });
    }
    const update = async (changes: Record<string, unknown>) => {
      const rows = await database<EvaluationJob[]>(`evaluation_jobs?id=eq.${id}&lease_token=eq.${lease}`, {
        method: "PATCH", body: JSON.stringify({ ...changes, lease_token: null, lease_until: null }),
      });
      if (!rows.length) throw new Error("lease_lost");
    };
    const plan = attemptPlan(job.input.model);
    const attempt = plan[job.next_step];
    if (!attempt || job.attempts > 8) {
      await update({ status: "failed", error_code: attempt ? "attempts_exhausted" : "models_exhausted" });
      return json({ ok: true });
    }
    const started = Date.now();
    let payload: unknown;
    let status = 0;
    let code = "network_error";
    let type: ReturnType<typeof errorType> = null;
    let retryAfter: number | null = null;
    let provider: string | null = null;
    try {
      // Exactly one provider request per invocation; QStash owns retries/backoff.
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": attempt.value },
        body: JSON.stringify(prepareGeminiRequest(attempt.model, job.input.request)), signal: AbortSignal.timeout(120_000),
      });
      status = response.status;
      const text = await response.text();
      if (response.ok) {
        try { payload = JSON.parse(text); } catch { code = "invalid_json"; }
        if (!payload || typeof payload !== "object") code = "invalid_json";
      } else {
        code = "http_error";
        retryAfter = retrySeconds(response.headers.get("Retry-After"));
        provider = providerCode(text);
      }
    } catch (error) {
      type = errorType(error);
      code = type === "TimeoutError" || type === "AbortError" ? "timeout" : "network_error";
    }
    if (payload && typeof payload === "object") {
      await update({ status: "completed", response: payload, model: attempt.model, key_source: attempt.source, error_code: null,
        cache_key: cacheableResponse(payload) ? job.cache_key || null : null,
        // The browser must accept the evidence-validated assessment before
        // this completed provider response becomes a reusable cache entry.
        cache_expires_at: null,
      });
      return json({ ok: true });
    }
    await persistErrorLog({
      request_id: id, source: "server", stage: status ? "provider_http" : "provider_network",
      code: code as "http_error" | "timeout" | "network_error" | "invalid_json",
      model: attempt.model, key_source: attempt.source as "primary" | "backup",
      attempt: attempt.source === "backup" ? 2 : 1, http_status: status || null,
      duration_ms: Date.now() - started, error_type: type, provider_code: provider,
      retry_after_seconds: retryAfter,
    });
    // Receiving HTTP headers is not a completed response. A deadline/network
    // failure while reading a 200 response body still needs queue fallback.
    const retryable = code === "timeout" || code === "network_error" ||
      (code === "http_error" && [401, 403, 404, 429, 500, 502, 503, 504].includes(status));
    let next = job.next_step + 1;
    // Advance past both keys when the provider cannot serve this model.
    if (code === "timeout" || [502, 503, 504].includes(status))
      while (plan[next]?.model === attempt.model) next++;
    const exhausted = !retryable || next >= plan.length || job.attempts >= 8;
    await update({ status: exhausted ? "failed" : "retrying", next_step: next,
      error_code: code === "http_error" ? `provider_http_${status}` : code,
      model: attempt.model, key_source: attempt.source,
    });
    return exhausted ? json({ ok: true }) : json({ error: "retry_pending" }, 503,
      retryAfter ? { "Retry-After": String(Math.min(retryAfter, 3600)) } : {});
  } catch {
    // A storage failure must not acknowledge delivery or expose raw diagnostics.
    return json({ error: "worker_unavailable" }, 503);
  }
}
export default { fetch: handler };
