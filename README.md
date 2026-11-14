# Écriture — TCF Canada writing practice

A personal writing workspace focused on regular practice toward NCLC 7. The goal
shapes the study experience; it is deliberately **not** passed to the AI as a grade
target.

## Use the app

- **Today:** resume an unfinished draft, start the least-practised task, or take a
  full mock. Weekly counts come from saved sessions.
- **Practice library:** search the existing question collection, filter by year,
  bookmark topics, and choose a guided task or a 60-minute mock.
- **Writing workspace:** automatic local draft saving, French accents, live word
  counts, planning prompts, a self-checklist, and TCFFormation templates. Guided
  practice has an optional timer; full mocks hide the writing aids and finish at
  60 minutes. The timer survives reloads.
- **Review:** request Gemini feedback explicitly. Read evidence, corrections and
  revision priorities alongside the original text, then rewrite the same task.
  Both versions remain in your journal. Groq is an optional second opinion.
- **My corrections:** practise correcting your own sentences before revealing
  saved corrections. The reviewed status is self-reported, not a mastery score.
- **My progress:** session counts, revisions, task balance, and supported full-mock
  NCLC ranges. Missing estimates are not displayed as zero.
- **Settings:** configure your own keys, choose English or French feedback,
  export/import a practice backup, or use the optional existing Supabase account.

## Run locally

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. An account and Supabase are optional. Add your own
Gemini key under **Settings & AI** to request feedback. Your writing and saved
corrections remain usable without AI. Drafts and local-mode work belong to this
browser profile; use a backup to move them to another device.

The supported model IDs are pinned through `VITE_GEMINI_MODEL` and
`VITE_GROQ_MODEL` (see `.env.example`). They are model configuration, not private
values or claims of grading accuracy. Browser-entered keys take precedence over
build defaults. They are stored in that browser; backups exclude keys and auth
state. VITE-prefixed keys are exposed in the browser build and must not be treated
as server secrets.

See [LOCAL-SETUP.md](LOCAL-SETUP.md) for optional account storage and Vercel setup.

## Grading and reliability

Both providers use `src/services/evaluationInstructions.ts`, the supplied
[assessment guide](docs/tcf-writing-evaluation-guide.md), and the same evidence
validator. A task receives a pedagogical CEFR range only when supporting excerpts
can be verified against the learner's original text. Full-mock NCLC projections
remain broad, optional, uncalibrated AI estimates, with reasons when withheld.
An isolated task does not determine final /20 or NCLC. Agreement between two
models does not establish accuracy; human-labelled calibration is still missing.

There are no automatic evaluation requests, provider switches or Groq generation
retries. Matching saved reviews are reused; concurrent identical review requests
share one in-flight call. Groq 429 responses establish a cooldown using Retry-After.
A failed optional second opinion preserves the successful primary review.

## Validate

```sh
npm test
npm run build
```

The regression files cover evidence validation, JSON parsing, quota handling,
request deduplication, review caching, NCLC comparisons, draft recovery, revision
lineage, backup safety, persistence and cloud/local metadata merging.

The rebuilt flow was also exercised in isolated Brave browser sessions at desktop
and mobile sizes: draft reload, template reference, finishing a task, mocked
feedback, revision, full-mock NCLC display, and preserving a Gemini review after a
mocked Groq 429. Browser tests used synthetic AI fixtures, not live grading.
Account sync and deployed API configuration require verification in your own
Supabase/Vercel environment.
