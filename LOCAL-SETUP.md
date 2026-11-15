# Run Écriture locally or on your Vercel project

## Local practice

1. Run `npm ci`, then `npm run dev -- --host 127.0.0.1`.
2. Open the printed URL. No account or database is required to practise.
3. For feedback, configure `GEMINI_API_KEY` in `.env.local` before starting Vite.
   The development server provides the same `/api/gemini` route as Vercel.
   Learners do not enter keys in Settings. The model chain is automatic:
   3.8 Flash → 3.6 Flash → 3.5 Flash-Lite.
4. Write a guided task or a full mock. Request feedback only when ready.
5. Export your writing from Settings regularly. Clearing browser data removes
   local submissions, correction review status, and drafts.

Copy `.env.example` to `.env.local` for local feedback credentials or optional
account storage. `GEMINI_MODEL` optionally overrides the chain starting point (default: gemini-3.8-flash).
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

Set `GEMINI_API_KEY` and optionally `GEMINI_BACKUP_KEY` in your
Vercel project’s environment for the relevant deployment, then redeploy. For example:

```env
GEMINI_API_KEY=your-primary-gemini-key
GEMINI_BACKUP_KEY=your-backup-gemini-key
# Optional: omit to use gemini-3.8-flash automatically
GEMINI_MODEL=gemini-3.8-flash
```

The current UI and practice flow are documented in [README.md](README.md).
The limits of AI grading and outstanding calibration work are documented in
[docs/GRADING-ACCURACY.md](docs/GRADING-ACCURACY.md).

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
