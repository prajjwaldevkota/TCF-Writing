# Run Écriture locally or on your Vercel project

## Local practice

1. Run `npm ci`, then `npm run dev -- --host 127.0.0.1`.
2. Open the printed URL. No account or database is required to practise.
3. For feedback, configure `GEMINI_API_KEY` in `.env.local` before starting Vite.
   The development server provides the same `/api/gemini` route as Vercel.
   Learners do not enter keys in Settings. The model chain is automatic:
   3.6 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite.
4. Write a guided task or a full mock. Request feedback only when ready.
5. Export your writing from Settings regularly. Clearing browser data removes
   local submissions, correction review status, and drafts.

Copy `.env.example` to `.env.local` for local feedback credentials or optional
account storage. `GEMINI_MODEL` optionally overrides the chain starting point (default: gemini-3.6-flash).
Model accessibility must match your own provider account. These identifiers are
public configuration and do not establish grading accuracy.

All feedback requests use `/api/gemini`. The server reads `GEMINI_API_KEY` and
optionally `GEMINI_BACKUP_KEY` at request time. The legacy `VITE_GEMINI_API_KEY`
and alternate `GEMINI_BACKUP_API_KEY` names are also supported server-side.
Gemini credentials are excluded from the browser build; old browser-entered keys
are ignored. Keys in the same Google project share quota.

## Optional Supabase accounts

Use your own project. Run `supabase/schema.sql`, followed by
`supabase/repair-ai-feedback.sql`, in that project's SQL editor. Configure
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. For two learners, create/invite
both accounts and disable public sign-ups if you want invitation-only access.
Keep the supplied row-level ownership policies enabled.

Sign in from Settings. New submissions are written locally before the cloud
request starts. A failed cloud write does not remove local work. Feedback saves
through the existing `ai_feedback` column; it also carries the practice context
and original question snapshot for later retrieval. This needs no new database
column. Unfinished drafts and correction-review status remain browser-local.
Use **Sync my account** to retrieve cloud submissions. The merge preserves local
practice/revision metadata and the latest saved review for identical answers.

Existing records without feedback may lack practice metadata. Local metadata is
preserved when available; the new app does not manufacture missing original
instructions. Legacy numeric reviews remain readable as historical feedback.

## Vercel

The repository already contains `vercel.json`, builds with `npm run build`, and
serves `dist`. Keep the existing GitHub/Vercel project. Configure model IDs and any
optional build defaults in that project's environment, then redeploy after
changing them. A successful Git push alone is not verification of a completed
Vercel deployment or its provider credentials.

`/api/gemini` uses the Node.js runtime with a 300-second maximum duration
configured in `vercel.json`. Enable **Fluid compute** in Vercel's project
settings to support this duration on Hobby. Each Gemini attempt has a 120-second
deadline; the browser allows 270 seconds for the primary and optional backup
attempt plus error logging. Do not switch this route to Edge: its 25-second
initial-response deadline can terminate an evaluation before Gemini finishes.
The Node entry point uses the Web Standard `fetch` export. Shared server files
stay outside `api/`, are included in the function, and use explicit `.js` ESM
imports so the compiled function can resolve them.

After redeploying, verify `/api/gemini` runs as Node.js with a 300-second timeout
in the deployment's function details (or `vercel inspect <deployment-url> --json`).
Then run an evaluation that takes longer than 25 seconds to confirm the deployed
route completes. See [Vercel's duration documentation](https://vercel.com/docs/functions/configuring-functions/duration).

Set `GEMINI_API_KEY` and optionally `GEMINI_BACKUP_KEY` in your
Vercel project’s environment for the relevant deployment, then redeploy. For example:

```env
GEMINI_API_KEY=your-primary-gemini-key
GEMINI_BACKUP_KEY=your-backup-gemini-key
# Optional: omit to use gemini-3.6-flash automatically
GEMINI_MODEL=gemini-3.6-flash
```

The current UI and practice flow are documented in [README.md](README.md).
The limits of AI grading and outstanding calibration work are documented in
[docs/GRADING-ACCURACY.md](docs/GRADING-ACCURACY.md).

## Background reviews

This optional flow implements GitHub issue #5. The default remains the Node.js
review route until the queue is explicitly enabled. To enable it:

1. Run [supabase/evaluation-jobs.sql](supabase/evaluation-jobs.sql) in your own
   Supabase SQL editor. It creates durable jobs, service-only writes and leases,
   owner/admin read policies, and the Realtime publication entry.
2. Create a QStash token. Use a QStash plan with a maximum HTTP response duration
   of at least **150 seconds** and support for **8 retries**. Each worker call
   gives Gemini 120 seconds; QStash waits up to 150 seconds, and the database
   lease lasts 180 seconds. Verify your plan's current limits before enabling.
3. Configure these server environment variables in Vercel:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=your-server-service-role-key
   QSTASH_TOKEN=your-qstash-token
   EVALUATION_WORKER_SECRET=a-random-secret-of-at-least-32-characters
   EVALUATION_PUBLIC_URL=https://your-canonical-production-domain
   EVALUATION_QUEUE_ENABLED=true
   ```

   Use `SUPABASE_URL` or the existing `VITE_SUPABASE_URL`. Generate the worker
   secret with `openssl rand -hex 32`. Keep all credentials above server-only.
   The public URL must be the exact HTTPS origin hosting this deployment, not a
   preview URL that may disappear. QStash must be able to reach the worker and
   failure callback; Vercel deployment protection must allow those requests.
4. Redeploy. Request a review, close the tab, and reopen the saved submission.
   Confirm a single job completes and the feedback appears. For a signed-in
   user, verify Realtime access is limited to the job owner (or an admin).

The queue receives only an opaque job ID. The worker authenticates the forwarded
bearer secret; the browser never receives it. Guest status reads require a
separate random capability whose hash is stored in the database. Signed-in jobs
also have a verified Supabase owner for Realtime. Browser references are saved
before submission so a lost acknowledgement reuses the same job ID. An explicit
new review after a terminal failure starts a new job. If you change the answer,
language or model, opening the page does not start a new review automatically.

Each delivery makes one provider attempt. Supported provider rejections advance
through the available keys and models; a deadline skips the remaining key for
that model. QStash applies exponential backoff (30 seconds, capped at 5 minutes)
or the provider's Retry-After, capped at one hour. Duplicate deliveries share an
atomic lease. Worker crashes leave a lease that expires for a later delivery;
terminal jobs are never regenerated. Permanent request errors and malformed
provider JSON fail without another generation attempt. Feedback still passes
the existing evidence validator when retrieved by the browser.

Failed jobs are the durable failure record. Admins can inspect `evaluation_jobs`
where `status = 'failed'` for the job ID, error code, model, attempt count and
timestamps. The QStash failure callback records `delivery_exhausted` when all
deliveries fail, while preserving completed jobs. QStash also exposes delivery
logs and its dead-letter queue. Retention is explicit: delete old terminal job
rows using your project's data-retention policy; deleting a job removes its
stored essay snapshot and raw response.

The browser watches for up to 30 minutes, then keeps its reference for a later
visit; closing the page does not cancel the worker. Guests should return in the
same browser. Queue setup or delivery failures preserve the saved writing and
job reference. The browser uses the synchronous route only when the queue is
explicitly disabled and there is no pending job to duplicate.

Status polling runs every **30 seconds** while the tab is visible and every
**2 minutes** while it is hidden. Realtime completion/failure notifications
trigger an immediate status check. Intermediate job updates do not trigger
extra requests. Polling only reads the existing database job; it never creates
another Gemini request or QStash delivery. The visible-tab interval uses 90%
fewer periodic status requests than the previous 3-second interval. Guest
results may take up to one polling interval to appear after completion.

The default model is `gemini-3.6-flash`, followed by `gemini-3.5-flash-lite` and
`gemini-3.1-flash-lite`. If the Vercel project explicitly sets `GEMINI_MODEL`,
change that override to `gemini-3.6-flash` (or remove it), then redeploy so the
browser build picks up the new starting model.

References: [QStash publishing](https://upstash.com/docs/qstash/api-reference/messages/publish-a-message),
[QStash retries](https://upstash.com/docs/qstash/features/retry), and
[Supabase Realtime with RLS](https://supabase.com/docs/guides/realtime/postgres-changes).

### Verify a deployed background review

For an existing installation, first run
[supabase/evaluation-cache.sql](supabase/evaluation-cache.sql) in the Supabase SQL
editor, then deploy the cache-enabled code. New installations can run the updated
`evaluation-jobs.sql`, which includes those additive columns and index.

1. Open the deployed site, write a practice response, and open your browser's
   Network panel before choosing **Get my feedback**.
2. `POST /api/evaluate` should quickly return **202** with a job ID. Subsequent
   `GET /api/evaluate?id=…` requests should show `queued`, `running` or `retrying`,
   followed by `completed`. A newly requested job should not use `/api/gemini`
   when the queue is enabled.
3. In Supabase, inspect the matching row without exposing the essay or token:

   ```sql
   select id, status, attempts, model, error_code, created_at, updated_at
   from public.evaluation_jobs
   order by created_at desc
   limit 10;
   ```

4. In QStash delivery logs, verify delivery to your canonical domain's
   `/api/evaluation-worker`. A successful final delivery returns **200**;
   a transient failure can return **503** and retry after a delay.
5. After the initial **202**, close the tab. Wait, reopen the same site in the
   same browser, and open that saved submission. The feedback should appear
   using the **same job ID**, with no second job row. A reused POST can return
   **200** when the job already completed.

An empty JSON POST to `/api/evaluate` safely checks configuration without
creating a job: **400** means validation was reached; **409 queue_disabled**
means background reviews are off; **503** means configuration or a required
service is unavailable. This probe does not verify the database migration or
worker delivery. Use the real review above for that end-to-end check.

### Verify completed-review caching

The cache reuses responses from the existing jobs table; it needs no Redis or
additional service. It is private to a verified account, or to a guest browser's
random cache capability. Its seven-day lifetime starts only after the browser's
evidence validator accepts a completed response. `PATCH /api/evaluate` records
that acknowledgement using the job's existing read capability. Failed, blocked,
truncated and unaccepted output cannot produce a server cache hit.

The key includes the starting model, full request payload and rubric version.
The payload includes the exact questions/documents, answers, task scope, feedback
language and generation settings. Submission IDs/dates do not change the key.
Object-key ordering does not change it; array/text ordering does. A cache hit
keeps the original expiry, actual fallback model and key-source metadata. Cached
payloads still pass through the normal evidence validator before display.

1. Complete a review and keep the tab open until feedback appears. Its job should
   have a non-null `cache_key` and a future `cache_expires_at` after the validation
   acknowledgement succeeds.
2. Request the exact same review normally. In the same browser, its completed
   job ID is reused. For another copy of the identical writing, or another browser
   signed into the same account, `POST /api/evaluate` can return a completed cache
   hit with **200** and zero provider attempts, without a new QStash message.
3. Choose **Request a new review**. The POST should include `force: true`, return
   a new queued job, and generate a fresh assessment. Resuming an already pending
   job always keeps that job ID, even when the resume call uses the fresh flag.
4. Change an answer, question, language, rubric or model. The server cache should
   miss. A different account or guest capability also cannot read the old cache.

Cache expiry affects reuse, not deletion: expired jobs remain retrievable by
their owner/capability and are retained until explicitly removed. Existing saved
feedback continues to be reused when its model, prompt hash and rubric match.
Concurrent requests with different new job IDs can both miss the server cache;
the existing browser in-flight deduplication still combines identical concurrent
requests within that tab. Cache acknowledgement failures leave valid feedback
visible but may prevent reuse from another browser.

## Notebook cleanup

The correction notebook supports **Delete correction**, **Delete reviewed**,
and **I've learned this · Remove**. Deleting a notebook correction preserves
the source writing and its feedback. Removed corrections stay removed when
old feedback is loaded again; repeating the mistake in a new submission still
creates a new practice item.

The cleanup reminder defaults to **30 days after review**, with **90 days** and
**Off** options. It checks when the notebook opens, regains focus, or remains
open for an hour. It asks before removing anything. **Keep them** postpones the
reminder for seven days. Unreviewed mistakes never become cleanup candidates.
Older reviewed records without a review date start their reminder clock when
the updated notebook is first opened. Preferences, review dates and deletion
records are browser-local and included in practice backups (version 3).

To test cleanup, delete one correction, reload, and check that it stays removed.
Reveal another correction and choose **I've learned this · Remove**. Mark a
third reviewed, then use **Delete reviewed**; cancel once and accept once.
The original saved submission and its feedback should remain available.

## Error logs

1. Run `supabase/error-logs.sql` in your own Supabase project's SQL editor.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel's server environment. The logger uses
   `SUPABASE_URL`, or the existing `VITE_SUPABASE_URL`. Never put the service-role
   key in a `VITE_` variable. Redeploy after changing deployment variables.
3. Sign in with an administrator account (`app_metadata.role = "admin"`) and open
   **Settings → Error logs**. Set this role through trusted Supabase admin tools,
   not user-editable metadata. Sign in again after a role change to refresh the JWT.
   You can also inspect `public.error_logs` in the Supabase dashboard.

The migration enables RLS, grants admins read-only access, and allows writes only
through the server's service role. No browser users can insert, update or delete
rows directly. Unauthenticated learners can report narrowly validated technical
failures through `/api/error-logs`; those rows are explicitly marked `client`.
See [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
for the distinction between trusted app metadata and editable user metadata.

Logs include a shared request reference, timestamp, failure stage, model,
primary/backup attempt, HTTP status, provider status code, elapsed time, retry
interval, deployment/region, and coarse browser/platform/viewport information.
The reference is shown with failed reviews, and the viewer can filter by it or
by server/browser source, with 50 rows per page. A failed attempt can be logged
although a later fallback succeeds; match the reference to follow the chain.

Loading the Error logs panel also checks `/api/error-logs` for server storage
readiness. Missing server keys, a missing table, denied database access, and
connection failures appear as warnings instead of looking like an empty journal.
The check reads no log rows and does not generate a Gemini request. A browser
error report returns HTTP 201 only after a successful database insert; failed
inserts return HTTP 503. The Vercel console fallback includes a fixed storage
failure code and database HTTP status, without raw database error messages.

API keys, tokens, student writing, prompts, raw provider messages, exception
messages and stack traces are never persisted. Logging uses a separate bounded
request and does not retry generation. If database logging is unconfigured or
fails, the server emits the sanitized entry to Vercel logs instead. A completely
offline browser cannot deliver its report. Log entries remain until removed by
the database owner; there is no automatic deletion or retention job.
