import { createHash, timingSafeEqual } from "node:crypto";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const terminal = (status: string) => status === "completed" || status === "failed";
export const json = (value: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store", ...extra,
  } });

export interface EvaluationJob {
  id: string;
  user_id: string | null;
  token_hash: string;
  input_hash: string;
  input: { model: string; request: Record<string, unknown>; submission: unknown };
  status: "queued" | "running" | "retrying" | "completed" | "failed";
  attempts: number;
  next_step: number;
  lease_token: string | null;
  lease_until: string | null;
  message_id: string | null;
  response: unknown;
  model: string | null;
  key_source: string | null;
  error_code: string | null;
  cache_key?: string | null;
  cache_scope?: string | null;
  cache_expires_at?: string | null;
}

// Sort object keys while retaining array order. Presentation metadata such as
// submission IDs/dates is intentionally excluded by the caller.
export function cacheFingerprint(model: string, request: unknown, rubricVersion: string): string {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return hash(JSON.stringify(canonical({ model, request, rubricVersion })));
}
export function cacheableResponse(value: any): boolean {
  const candidate = value?.candidates?.[0];
  if (value?.promptFeedback?.blockReason || candidate?.finishReason !== "STOP") return false;
  const text = candidate.content?.parts?.filter((part: any) => typeof part.text === "string" && !part.thought).map((part: any) => part.text).join("");
  try {
    const assessment = JSON.parse(text);
    return ["en", "fr"].includes(assessment?.feedback_language) &&
      !!assessment.tasks && typeof assessment.tasks === "object" && !Array.isArray(assessment.tasks);
  } catch { return false; }
}
export async function cachedJob(scope: string, key: string): Promise<EvaluationJob | undefined> {
  const fields = "id,response,model,key_source,cache_expires_at";
  const jobs = await database<EvaluationJob[]>(`evaluation_jobs?cache_scope=eq.${encodeURIComponent(scope)}&cache_key=eq.${key}&status=eq.completed&cache_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=${fields}&order=created_at.desc&limit=1`);
  return cacheableResponse(jobs[0]?.response) ? jobs[0] : undefined;
}

export function databaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("database_not_configured");
  return { url, key };
}

// Never include database response bodies in errors: they can contain essays.
export async function database<T>(resource: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      Prefer: "return=representation", ...init.headers,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`database_http_${response.status}`);
  return response.status === 204 ? null as T : response.json();
}

export async function getJob(id: string): Promise<EvaluationJob | undefined> {
  return (await database<EvaluationJob[]>(`evaluation_jobs?id=eq.${id}&limit=1`))[0];
}

type JobStatus = Pick<EvaluationJob, "id" | "token_hash" | "status" | "attempts" | "response" | "model" | "key_source" | "error_code" | "cache_expires_at">;
export async function getJobStatus(id: string): Promise<JobStatus | undefined> {
  // Polls need neither the essay/prompt nor lease and ownership metadata.
  const fields = "id,token_hash,status,attempts,response,model,key_source,error_code,cache_expires_at";
  return (await database<JobStatus[]>(`evaluation_jobs?id=eq.${id}&select=${fields}&limit=1`))[0];
}

export function publicJob(job: Omit<JobStatus, "token_hash">) {
  return {
    id: job.id, status: job.status, attempts: job.attempts,
    response: job.status === "completed" ? job.response : null,
    model: job.model, key_source: job.key_source, error_code: job.error_code,
    cache_expires_at: job.cache_expires_at || null,
  };
}

export function queueConfig() {
  databaseConfig();
  const token = process.env.QSTASH_TOKEN?.trim();
  const secret = process.env.EVALUATION_WORKER_SECRET?.trim();
  const origin = new URL(process.env.EVALUATION_PUBLIC_URL || "invalid");
  if (!token || !secret || secret.length < 32 || origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("queue_not_configured");
  return { token, secret, origin: origin.origin };
}

export function workerAuthorized(request: Request): boolean {
  const secret = process.env.EVALUATION_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const received = Buffer.from(request.headers.get("Authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function publishJob(id: string): Promise<string> {
  const { token, secret, origin } = queueConfig();
  const qstashBase = (process.env.QSTASH_URL || "https://qstash.upstash.io").trim().replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
    "Upstash-Forward-Authorization": `Bearer ${secret}`,
    "Upstash-Deduplication-Id": id,
    "Upstash-Retries": "8",
    "Upstash-Retry-Delay": "min(300000, 30000 * pow(2, retried))",
    "Upstash-Timeout": "150s",
    "Upstash-Failure-Callback": `${origin}/api/evaluation-worker?failed=${id}`,
    "Upstash-Failure-Callback-Forward-Authorization": `Bearer ${secret}`,
  };
  // The queue receives only a random job ID; essays and Gemini keys stay in Supabase/Vercel.
  let response = await fetch(`${qstashBase}/v2/publish/${origin}/api/evaluation-worker`, {
    method: "POST", headers, body: JSON.stringify({ id }), signal: AbortSignal.timeout(5000),
  });
  // If the account belongs to US-East-1 (North America accounts), auto-fallback on region mismatch
  if (response.status === 404 && qstashBase === "https://qstash.upstash.io") {
    const text = await response.text().catch(() => "");
    if (text.includes("not found in this region")) {
      response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${origin}/api/evaluation-worker`, {
        method: "POST", headers, body: JSON.stringify({ id }), signal: AbortSignal.timeout(5000),
      });
    }
  }
  if (!response.ok) throw new Error("queue_publish_failed");
  const body = await response.json();
  if (typeof body.messageId !== "string") throw new Error("queue_publish_failed");
  return body.messageId;
}

export function credentials() {
  const primary = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim();
  const backup = process.env.GEMINI_BACKUP_KEY?.trim() || process.env.GEMINI_BACKUP_API_KEY?.trim();
  return [
    ...(primary ? [{ value: primary, source: "primary" }] : []),
    ...(backup && backup !== primary ? [{ value: backup, source: "backup" }] : []),
  ];
}

export function attemptPlan(initial: string) {
  const chain = MODELS.slice(0, 3);
  const start = chain.indexOf(initial);
  const models = start < 0 ? [initial] : chain.slice(start);
  return models.flatMap(model => credentials().map(key => ({ model, ...key })));
}
