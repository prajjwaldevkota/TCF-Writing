# Run Écriture locally or on your Vercel project

## Local practice

1. Run `npm ci`, then `npm run dev -- --host 127.0.0.1`.
2. Open the printed URL. No account or database is required to practise.
3. Open **Settings & AI / Réglages et IA** and save your own Gemini API key.
   Groq is optional. Never reuse someone else's embedded API key.
4. Write a guided task or a full mock. Request feedback only when ready.
5. Export your writing from Settings regularly. Clearing browser data removes
   local submissions, correction review status, and drafts.

Copy `.env.example` to `.env.local` only if you need build defaults or optional
account storage. `VITE_GEMINI_MODEL` and `VITE_GROQ_MODEL` pin the chosen model;
model accessibility must match your own provider account. These identifiers are
public configuration and do not establish grading accuracy.

Browser-entered API keys are stored in localStorage and override build defaults.
Build variables prefixed with VITE are embedded in browser code. Keep actual
server secrets unprefixed and behind a server endpoint if you later extend the
architecture. The app retains the browser-to-Gemini evaluation path; the Groq
endpoint proxies requests and forwards rate-limit cooldown headers.

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

The current UI and practice flow are documented in [README.md](README.md).
The limits of AI grading and outstanding calibration work are documented in
[docs/GRADING-ACCURACY.md](docs/GRADING-ACCURACY.md).
