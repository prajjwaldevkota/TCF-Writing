import { supabase } from "../lib/supabase";
import { createLogRequestId } from "./errorLogging";
import { instructionFingerprint } from "./evaluationInstructions";
import type { ExamResult } from "../types/exam";

interface JobReference {
  id: string;
  token: string;
  fingerprint: string;
  submissionId?: string;
  pending: boolean;
  rubricVersion?: string;
  requestSignature?: string;
  failed?: boolean;
}
interface JobStatus {
  id: string;
  status: "queued" | "running" | "retrying" | "completed" | "failed";
  response: unknown;
  model: string;
  key_source: "primary" | "backup";
  error_code: string | null;
  cache_expires_at?: string | null;
}
const prefix = "tcf_evaluation_job:";
const referenceKey = (id: string | undefined, model: string, fingerprint: string) =>
  prefix + encodeURIComponent(id || "anonymous") + ":" + model + ":" + fingerprint;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(key: string): JobReference | null {
  try {
    const ref = JSON.parse(localStorage.getItem(key) || "null");
    return ref && uuid.test(ref.id) && uuid.test(ref.token) ? ref : null;
  } catch { return null; }
}
export function hasPendingEvaluationJob(submissionId?: string): boolean {
  if (!submissionId) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const ref = read(key);
        if (ref?.submissionId === submissionId && ref.pending) return true;
      }
    }
  } catch { /* Storage may be unavailable; reviews still work for this tab. */ }
  return false;
}

export function pendingEvaluationJobMatches(submissionId: string | undefined, model: string, fingerprint: string): boolean {
  const ref = read(referenceKey(submissionId, model, fingerprint));
  return !!ref?.pending && ref.submissionId === submissionId;
}
export async function queueEvaluation(input: {
  // Only requested jobs are created; page-open recovery checks the fingerprint first.
  result: ExamResult;
  model: string;
  request: Record<string, unknown>;
  fingerprint: string;
  language: "en" | "fr";
  rubricVersion?: string;
  force?: boolean;
}): Promise<{ payload: any; model: string; keySource: "primary" | "backup"; acceptCache: () => Promise<void>; rejectCache: () => void } | null> {
  const key = referenceKey(input.result.id, input.model, input.fingerprint);
  const previous = read(key);
  const requestSignature = await instructionFingerprint(JSON.stringify(input.request));
  const reusable = previous?.pending || (!input.force && !previous?.failed && previous?.rubricVersion === input.rubricVersion && previous?.requestSignature === requestSignature);
  const ref: JobReference = previous && reusable ? previous : {
    id: createLogRequestId(), token: createLogRequestId(), fingerprint: input.fingerprint,
    submissionId: input.result.id, pending: true,
    rubricVersion: input.rubricVersion, requestSignature,
  };
  ref.pending = true;
  const save = () => { try { localStorage.setItem(key, JSON.stringify(ref)); } catch { /* Keep the in-memory capability. */ } };
  // Save the id before POST: a lost acknowledgement must never start another job.
  save();
  const en = input.language === "en";
  const interrupted = () => new Error(en
    ? "Your review request is saved in this browser. Reopen this submission to check its progress. Your writing is saved."
    : "Votre demande de correction est enregistrée dans ce navigateur. Rouvrez cette rédaction pour suivre son avancement. Votre texte est sauvegardé.");
  const readStatus = async (response: Response): Promise<JobStatus> => {
    if (!response.ok) throw interrupted();
    const value = await response.json();
    if (value?.id !== ref.id || !["queued", "running", "retrying", "completed", "failed"].includes(value.status)) throw interrupted();
    return value;
  };
  let auth: Record<string, string> = {};
  if (supabase) {
    // Session lookup must not hold the submit request open indefinitely.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const session = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 3000); }),
      ]);
      const token = session?.data.session?.access_token;
      if (token) auth = { Authorization: `Bearer ${token}` };
    } finally { clearTimeout(timer); }
  }
  let response: Response;
  // A browser capability scopes guest cache entries without exposing writing
  // to other guests. It is separate from each job's read capability.
  let cacheToken: string | null = null;
  try {
    cacheToken = localStorage.getItem("tcf_review_cache_token_v1");
    if (!cacheToken || !uuid.test(cacheToken)) {
      cacheToken = createLogRequestId();
      localStorage.setItem("tcf_review_cache_token_v1", cacheToken);
    }
  } catch { cacheToken = null; }
  try {
    const r = input.result;
    response = await fetch("/api/evaluate", {
      method: "POST", headers: { "Content-Type": "application/json", ...auth,
        ...(cacheToken ? { "X-TCF-Cache-Token": cacheToken } : {}),
      },
      body: JSON.stringify({
        id: ref.id, token: ref.token, model: input.model, request: input.request,
        rubricVersion: input.rubricVersion, force: input.force === true || previous?.failed === true,
        submission: {
          id: r.id, answers: r.answers, combination: r.combination,
          isPracticeMode: r.isPracticeMode, practiceTask: r.practiceTask, practiceTasks: r.practiceTasks,
        },
      }), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw interrupted(); }
  if (response.status === 409 && response.headers.get("X-TCF-Queue-Disabled") === "1") {
    if (previous?.pending) {
      // Disabling new jobs must not prevent collecting previously queued work.
      try {
        response = await fetch(`/api/evaluate?id=${ref.id}`, {
          headers: { "X-TCF-Job-Token": ref.token }, signal: AbortSignal.timeout(10_000), cache: "no-store",
        });
      } catch { throw interrupted(); }
    } else {
      try { localStorage.removeItem(key); } catch { /* Ignore blocked storage. */ }
      return null;
    }
  }
  if (!response.ok) throw new Error(en
    ? "The background review service is unavailable. Your writing is saved; reopen this submission to try resuming the same job."
    : "Le service de correction en arrière-plan est indisponible. Votre texte est sauvegardé ; rouvrez cette rédaction pour reprendre la même demande.");
  let current = await readStatus(response);
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("tcf-review-queued", { detail: { submissionId: input.result.id } }));

  let wake: (() => void) | undefined;
  let completionNotified = false;
  // Authenticated owners receive Realtime notifications under RLS. Guests and
  // disconnected sockets use capability-protected short polling requests.
  const channel = auth.Authorization && supabase
    ? supabase.channel(`evaluation:${ref.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "evaluation_jobs", filter: `id=eq.${ref.id}` }, event => {
        // Intermediate worker updates do not need another status request.
        if (["completed", "failed"].includes(event.new.status)) {
          completionNotified = true;
          wake?.();
        }
      })
      .subscribe()
    : null;
  try {
    // Stop actively watching after 30 minutes. The durable job keeps running;
    // the saved capability resumes it later without another provider request.
    const until = Date.now() + 30 * 60_000;
    while (current.status !== "completed" && current.status !== "failed") {
      if (!completionNotified) {
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); wake = undefined; resolve(); };
          // Status reads consume hosting/database requests, not Gemini calls.
          // Keep a slower watchdog even when Realtime is connected, in case
          // its completion notification is missed or the socket disconnects.
          const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
          const timer = setTimeout(done, hidden ? 120_000 : 30_000);
          wake = done;
        });
      }
      completionNotified = false;
      if (Date.now() > until) throw interrupted();
      try {
        const status = await fetch(`/api/evaluate?id=${ref.id}`, {
          headers: { "X-TCF-Job-Token": ref.token }, signal: AbortSignal.timeout(10_000), cache: "no-store",
        });
        current = await readStatus(status);
      } catch { throw interrupted(); }
    }
    ref.pending = false;
    ref.failed = current.status === "failed";
    save();
    if (current.status === "failed") throw new Error(en
      ? `The review could not finish (${current.error_code || "job_failed"}). Your writing is saved; you can request a new review.`
      : `La correction n’a pas abouti (${current.error_code || "job_failed"}). Votre texte est sauvegardé ; vous pouvez demander un nouveau bilan.`);
    return {
      payload: current.response, model: current.model, keySource: current.key_source,
      acceptCache: async () => {
        if (current.cache_expires_at) return;
        try {
          await fetch("/api/evaluate", { method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: ref.id, token: ref.token }), signal: AbortSignal.timeout(5000),
          });
        } catch { /* Cache acknowledgement must not fail a valid review. */ }
      },
      rejectCache: () => { ref.failed = true; save(); },
    };
  } finally {
    if (channel) void supabase?.removeChannel(channel);
  }
}
