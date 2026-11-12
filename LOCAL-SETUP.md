# Private TCF writing lab

This is a local fork of the original simulator. It is not deployed.

## Start

1. Create your own Supabase project. Run `supabase/schema.sql`, then
   `supabase/repair-ai-feedback.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local`. Set your project URL and publishable/anon
   key. The original database defaults have been removed.
3. Add `VITE_GEMINI_MODEL=gemini-3.1-flash-lite` (the model observed serving the
   upstream tests). This pins the engine; it is not an accuracy recommendation.
4. Run `npm ci`, then `npm run dev -- --host 127.0.0.1`.
5. Configure your own Gemini API key in the app's AI configuration screen.
   Do not copy the upstream site's embedded key.

For two people, invite both accounts through your own Supabase dashboard and
disable public signups. Row-level policies restrict submissions to their owner.
Your friend can run their own copy using the same Supabase configuration.
Localhost is only accessible on the computer running it; no shared hosting has
been configured. Each browser's unsynced feedback stays on that browser.

This retains the upstream browser-to-Gemini API architecture. API keys configured
in the browser are accessible to that browser; VITE variables are public build
configuration, never server secrets. Use a backend proxy before wider hosting.
Automatic upstream administrator submission notifications and the hardcoded
administrator login bypass have been disabled/removed.

## Confirmed upstream defects

Both examined submissions returned 11/20, B2, CLB 7. The second was January 2026,
Combination 33; the first was February 2026, Combination 4.

The server returned HTTP 400 / PGRST204:
`Could not find the 'ai_feedback' column of 'submissions' in the schema cache`.
The supplied schema also lacks an owner UPDATE policy. The repair adds both.
The UI previously ignored returned save errors, and server-first merging dropped
local feedback on reload. Both paths are corrected here. Missing evaluations now
display “Not evaluated”; a genuine zero remains zero.

The grader previously substituted 14/20 when a task score was missing. Invalid
or missing scores now fail explicitly. Word counts are recalculated from the text,
and evaluations record model and rubric version. Model failures no longer silently
switch to another grading engine. No one else's cloud database was changed.

## Pedagogical assessment (v3)

The evaluator now follows `docs/tcf-writing-evaluation-guide.md`. It uses task-level
ranges and evidence instead of numeric task scores or equal-task averages. At the learner’s request,
complete eligible mocks also receive a separate uncalibrated NCLC range. Old numerical estimates remain labelled as legacy and are excluded
from the new task-level progress view. Open an old result and click AI evaluation
to replace it with the new review. This makes one API request.

Feedback follows the selected app language. Task 3 needs the prompt and both
source documents; otherwise its range is withheld. Blank responses are unassessed,
not automatically assigned an official zero. Word count uses whitespace-delimited
sign groups without splitting punctuation, apostrophes or hyphens.

The two reading passes are in one model request. They are not independent official
examiner judgments. Accuracy remains unverified: see `docs/GRADING-ACCURACY.md` for
the benchmark protocol. FEI pages blocked the automated source recheck; the source
statements are supplied by the learner and must be rechecked before exam reliance.

See `docs/LOCAL-REFERENCE-AUDIT.md` for the supplied TCFFormation materials.
