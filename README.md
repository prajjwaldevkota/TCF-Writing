# Écriture — TCF Canada writing practice

A personal writing workspace focused on regular practice toward NCLC 7. The goal
shapes the study experience; it is deliberately **not** passed to the AI as a grade
target.

## Use the app

- **Today:** choose a task, resume an unfinished draft, or take a full mock.
  **Combinaison au hasard** selects one complete combination with all three tasks;
  drawing a combination does not start the session or timer.
- **Practice library:** search the existing question collection, filter by year,
  bookmark topics, and choose a guided task or a 60-minute mock. The random picker
  shows exactly one matching combination and keeps that set when switching tasks.
- **Writing workspace:** a large editor beside the prompt and source documents, automatic
  local draft saving, French accents, live word counts, and optional help. The
  Expand control hides the references for more writing space. A self-checklist
  and TCFFormation templates remain available on demand. Guided
  practice has an optional timer; full mocks hide the writing aids and finish at
  60 minutes. The timer survives reloads.
- **Review:** request Gemini feedback explicitly. **Copier tout**
  exports the prompts, source documents and original answers for another AI or tutor,
  with a manual copy fallback when clipboard access is blocked. Read evidence, corrections and
  revision priorities alongside the original text, then rewrite the same task.
  Both versions remain in your journal. Gemini 3.8 Flash is selected automatically; an optional backup key is read on the Vercel server.
- **My corrections:** practise correcting your own sentences before revealing
  saved corrections. The reviewed status is self-reported, not a mastery score.
- **My progress:** session counts, revisions, task balance, and supported full-mock
  NCLC ranges, plus a seven-day activity tracker shared with the home page. Missing estimates are not displayed as zero.
- **Settings:** configure your own keys, choose English or French feedback,
  export/import a practice backup, or use the optional existing Supabase account.

The moon/sun control in the top bar switches between light and dark mode. The
choice is saved in this browser and applied before the app paints on a later
visit; the system preference supplies the initial default. Both themes use larger
reading text, neutral foreground colours and shared contrast-tested surface tokens.

## Run locally

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. An account and Supabase are optional. Feedback
uses `/api/gemini`, which reads the deployment's server credentials. Learners do
not need personal API keys. Your writing and saved corrections remain usable
without AI. Drafts and local-mode work belong to this browser profile; use a
backup to move them to another device.

Configure `GEMINI_API_KEY` and optionally `GEMINI_BACKUP_KEY` in Vercel (or
`.env.local` for local development). The function also accepts the existing
`VITE_GEMINI_API_KEY` and `GEMINI_BACKUP_API_KEY` names for compatibility; their
values are excluded from browser builds. Existing browser-entered keys are ignored.
`GEMINI_MODEL` selects the starting model, defaulting to `gemini-3.8-flash`.

See [LOCAL-SETUP.md](LOCAL-SETUP.md) for optional account storage and Vercel setup.

## Error diagnostics

`supabase/error-logs.sql` adds the admin-only `error_logs` table. Configure
`SUPABASE_SERVICE_ROLE_KEY` on Vercel and use **Settings → Error logs** while
signed in with `app_metadata.role = "admin"`. Logs record server failures,
primary/backup attempts, browser connection failures and invalid assessments,
linked by the reference displayed with an error. Writing, prompts and credentials
are excluded. See [setup details](LOCAL-SETUP.md#error-logs).

## Grading and reliability

Gemini uses `src/services/evaluationInstructions.ts`, the supplied
[assessment guide](docs/tcf-writing-evaluation-guide.md), and the evidence validator.
A task receives a pedagogical CEFR range only when supporting excerpts can be
verified against the learner's original text. Full-mock NCLC projections remain
broad, optional and non-official. An isolated task does not determine final /20
or NCLC. Historical reviews remain readable; new reviews do not combine models.

There are no automatic evaluation requests. Matching saved reviews are reused
only when the requested starting model, answer fingerprint and rubric match.
A successful fallback review is reused rather than restarting the chain. The actual
model and original requested model are saved separately and shown with the review. Concurrent identical
requests share one in-flight call. For each model, the optional backup key is tried at most once after a supported
HTTP error. The model chain runs automatically: **3.8 Flash → 3.6 Flash →
3.5 Flash-Lite**. HTTP 404 (model unavailable), 429 (quota), and 503 (temporary
unavailability) move to the next model after available keys are exhausted. A confirmed
provider HTTP 504 (deadline exceeded) moves directly to the next model without
repeating the slow request with a backup key. Hosting gateway 504 responses are
logged as timeouts and stop with a saved-writing message. There
are at most three models and two keys per model. It stops on the first successful
response. A server-observed 120-second provider deadline also advances directly
to the next model; invalid assessments and ambiguous connection failures do not
trigger more calls.
The Vercel function reads both keys at request time and tries the backup on the
same model after a supported HTTP rejection. No browser key or build-time
credential flag is required. Missing server credentials produce a deployment
configuration error rather than asking the learner to enter a key.
Browser/gateway timeouts, network interruptions and invalid output do not trigger
another synchronous request. Failed reviews preserve existing saved feedback.
Rate-limit cooldowns use hashed transport/model identifiers, never stored raw keys.

Optional background reviews address [issue #5](https://github.com/prajjwaldevkota/TCF-Writing/issues/5).
When enabled, `POST /api/evaluate` stores the submission and returns a job ID;
QStash delivers `/api/evaluation-worker`, with one Gemini request per invocation
and bounded retries/backoff across keys and models. Supabase stores the result
even when the browser is closed. Reopening the same submission resumes its job
without starting another review. Signed-in owners receive Supabase Realtime
updates; short polling also supports guests and disconnected sockets. Failed
jobs remain available for diagnosis. See [background review setup](LOCAL-SETUP.md#background-reviews).

The automatic default chain is Gemini 3.8 Flash, 3.6 Flash, then 3.5 Flash-Lite.
`GEMINI_MODEL` may override its starting point; no browser selection is needed. These have published [free API tiers](https://ai.google.dev/gemini-api/docs/pricing),
checked November 14, 2026. Project access and limits vary; a model selection does
not change billing settings. [Google quotas](https://ai.google.dev/gemini-api/docs/rate-limits)
are per project, not per API key: another key in the same project adds no quota.

Assessors receive short verbatim excerpts to reduce quotation mismatches. A level
still requires two distinct verified quotations; a withheld level can be reassessed
explicitly. Existing saved reviews are not silently regenerated. **Copier tout**
includes source documents and original answers, with a manual copy fallback.

## Validate

```sh
npm test
npm run build
```

The regression files cover evidence validation, JSON parsing, quota handling,
request deduplication, review caching, NCLC comparisons, draft recovery, revision
lineage, backup safety, persistence and cloud/local metadata merging.

The practice flow is checked in isolated Brave browser sessions, using synthetic
AI fixtures for retry and failure paths. Live grading is not a calibration study.
Account sync and deployed configuration require verification in your own
Supabase/Vercel environment.
