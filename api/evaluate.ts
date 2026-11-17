import {
  UUID, MODELS, hash, json, database, getJob, getJobStatus, publicJob, queueConfig,
  publishJob, credentials, terminal, databaseConfig,
} from "../server/evaluationJobs.js";

export const config = { maxDuration: 300 };
export async function handler(request: Request): Promise<Response> {
  if (!["GET", "POST"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
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
    if (process.env.EVALUATION_QUEUE_ENABLED !== "true")
      return json({ error: "queue_disabled" }, 409, { "X-TCF-Queue-Disabled": "1" });
    queueConfig();
    if (!credentials().length) return json({ error: "missing_credentials" }, 503);
    if (Number(request.headers.get("Content-Length")) > 200_000) return json({ error: "request_too_large" }, 413);
    const text = await request.text();
    if (text.length > 200_000) return json({ error: "request_too_large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "invalid_request" }, 400); }
    if (!body || !UUID.test(body.id) || !UUID.test(body.token) || !MODELS.includes(body.model) ||
        !Array.isArray(body.request?.contents) || !body.submission?.answers)
      return json({ error: "invalid_request" }, 400);
    const input = { model: body.model, request: body.request, submission: body.submission };
    const inputHash = hash(JSON.stringify(input));
    let job = await getJob(body.id);
    if (job && (job.token_hash !== hash(body.token) || job.input_hash !== inputHash))
      return json({ error: "job_conflict" }, 409);
    if (!job) {
      let userId: string | null = null;
      const auth = request.headers.get("Authorization");
      if (auth) {
        const { url, key } = databaseConfig();
        const verified = await fetch(`${url}/auth/v1/user`, {
          headers: { apikey: key, Authorization: auth }, signal: AbortSignal.timeout(4000),
        });
        if (!verified.ok) return json({ error: "unauthorized" }, 401);
        userId = (await verified.json()).id;
      }
      // Ignore a concurrent insert of the same id, then verify its capability
      // and input below. Never overwrite another job or reset running work.
      await database("evaluation_jobs?on_conflict=id", {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ id: body.id, token_hash: hash(body.token), input_hash: inputHash, input, user_id: userId }),
      });
      job = await getJob(body.id);
      if (!job || job.token_hash !== hash(body.token) || job.input_hash !== inputHash)
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
