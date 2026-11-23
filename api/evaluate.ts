import { limitedBody } from "../server/requestBody.js";
import { reviewAccount } from "../server/reviewAuth.js";
import {
  UUID, MODELS, hash, json, database, getJob, getJobStatus, publicJob, queueConfig,
  publishJob, credentials, terminal,
  cacheFingerprint, cachedJob, cacheableResponse,
} from "../server/evaluationJobs.js";

export const config = { maxDuration: 300 };
export async function handler(request: Request): Promise<Response> {
  if (!["GET", "POST", "PATCH"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "forbidden" }, 403);
  try {
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("id") || "";
      const token = request.headers.get("X-TCF-Job-Token") || "";
      if (!UUID.test(id) || !UUID.test(token)) return json({ error: "not_found" }, 404);
      const job = await getJobStatus(id);
      if (!job || job.token_hash !== hash(token)) return json({ error: "not_found" }, 404);
      return json(publicJob(job));
    }
    if (request.method === "PATCH") {
      const text = await limitedBody(request, 1024);
      if (text === null) return json({ error: "invalid_request" }, 400);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
      if (!UUID.test(body?.id) || !UUID.test(body?.token)) return json({ error: "not_found" }, 404);
      const job = await getJob(body.id);
      if (!job || job.token_hash !== hash(body.token)) return json({ error: "not_found" }, 404);
      // Only the holder of this completed job's capability can acknowledge
      // browser validation. Reading a cache hit never extends its lifetime.
      if (job.status === "completed" && job.cache_key && !job.cache_expires_at && cacheableResponse(job.response))
        await database(`evaluation_jobs?id=eq.${job.id}&status=eq.completed&cache_expires_at=is.null`, {
          method: "PATCH", body: JSON.stringify({ cache_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() }),
        });
      return json({ ok: true });
    }
    if (process.env.EVALUATION_QUEUE_ENABLED !== "true")
      return json({ error: "queue_disabled" }, 409, { "X-TCF-Queue-Disabled": "1" });
    const userId = await reviewAccount(request);
    if (userId instanceof Response) return userId;
    queueConfig();
    if (!credentials().length) return json({ error: "missing_credentials" }, 503);
    const text = await limitedBody(request, 200_000);
    if (text === null) return json({ error: "request_too_large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
    if (!body || !UUID.test(body.id) || !UUID.test(body.token) || !MODELS.includes(body.model) ||
        !Array.isArray(body.request?.contents) || !body.submission?.answers)
      return json({ error: "invalid_request" }, 400);
    const input = { model: body.model, request: body.request, submission: body.submission };
    const inputHash = hash(JSON.stringify(input));
    let job = await getJob(body.id);
    if (job && ((job.user_id && job.user_id !== userId) || job.token_hash !== hash(body.token) || job.input_hash !== inputHash))
      return json({ error: "job_conflict" }, 409);
    if (!job) {
      const scope = `user:${userId}`;
      const rubricVersion = typeof body.rubricVersion === "string" && body.rubricVersion.length <= 100 ? body.rubricVersion : null;
      const cacheKey = rubricVersion ? cacheFingerprint(body.model, body.request, rubricVersion) : null;
      const cached = cacheKey && body.force !== true ? await cachedJob(scope, cacheKey) : undefined;
      // Ignore a concurrent insert of the same id, then verify its capability
      // and input below. Never overwrite another job or reset running work.
      await database("evaluation_jobs?on_conflict=id", {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          id: body.id, token_hash: hash(body.token), input_hash: inputHash, input, user_id: userId,
          ...(cacheKey ? { cache_key: cacheKey, cache_scope: scope } : {}),
          ...(cached ? { status: "completed", response: cached.response, model: cached.model,
            key_source: cached.key_source, cache_expires_at: cached.cache_expires_at } : {}),
        }),
      });
      job = await getJob(body.id);
      if (!job || (job.user_id && job.user_id !== userId) || job.token_hash !== hash(body.token) || job.input_hash !== inputHash)
        return json({ error: "job_conflict" }, 409);
    }
    if (!job.message_id && !terminal(job.status)) {
      const messageId = await publishJob(job.id);
      // Only metadata is patched: a fast worker may already have completed.
      await database(`evaluation_jobs?id=eq.${job.id}`, {
        method: "PATCH", body: JSON.stringify({ message_id: messageId }),
      });
    }
    return json(publicJob(job), terminal(job.status) ? 200 : 202);
  } catch {
    // Keep a saved-but-not-yet-published job resumable with the same id.
    return json({ error: "queue_unavailable", resumable: true }, 503);
  }
}
export default { fetch: handler };
