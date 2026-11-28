# Measuring grading accuracy

Gemini returns a pedagogical CEFR estimate for each assessed task. A supported estimate requires two distinct quotations from the learner’s response. The validator withholds the level for missing instructions, a blank answer, or a Tâche 3 response without both documents. Eligible full mocks can also receive a separate NCLC writing projection. The [evaluation guide](tcf-writing-evaluation-guide.md) describes the rubric.

A second Gemini request checks proposed edits in context, the revised text for remaining errors, and the illustrative answer. If verification is unavailable, the review omits unchecked edits. The app records the grading model, rubric version and request fingerprint with the review.

## Measuring agreement with a human rater

Store cases in a private JSON array outside the repository. Each record contains a unique `id`, `task`, `answer`, `gold` (one CEFR label), `source` (document/page or assessor reference), `examiner_rationale`, and `requirement` with `instruction`, `minWords`, `maxWords` and both source documents for Task 3. Verify provenance and permission to send the scripts to Google before running.

```sh
node scripts/calibrate-writing.mjs /path/to/cases.json --check
node --env-file=.env.local scripts/calibrate-writing.mjs /path/to/cases.json --run
```

Collect 20–30 responses spanning all tasks and both sides of B1/B2. Preserve both documents for Tâche 3 and keep rewrites and responses to the same assignment in one split. Assign each case a `split` of `development` or `held-out` before tuning prompts. Obtain independent CEFR decisions and rationales from a qualified FLE/TCF rater, preferably two raters with disagreements recorded before adjudication. A later official writing result can be paired with a full mock for a separate ability-level study. Keep per-task and ability-level outcome measures separate.

Run `node scripts/calibrate-writing.mjs cases.json --run --repeat 3` with a provider key in the environment. This makes three grading requests per held-out case. The tool compares level decisions only. It reports exact and within-one-level agreement among rated attempts, directional errors at B1/B2, range coverage, withheld and failed attempts, and how often pairs of rated runs disagree on the best estimate or range. Report coverage alongside agreement so withholding cannot inflate apparent accuracy.

### Public examples for development

| Source | What to compare |
|---|---|
| [CIEP examiner-commented DELF script, pp. 94–95](https://rm.coe.int/168045a0cf#page=94) | A candidate requests remote work. The examiner identifies B2 despite local grammatical slips and describes omissions and tone separately. The different exam format limits its use to a qualitative reference. |
| [TCF Canada Coach, nine annotated responses](https://www.tcfcanadacoach.com/tcf-canada/expression-ecrite/exemples/) | Compare the publisher’s B1, B2 and C1 versions of a cooking-course invitation, a train-trip review and a synthesis about remote work. Six responses illustrate the publisher’s NCLC 7–8 or 9–10 targets. |
| [Formation TCF Canada, annotated copies](https://formationtcfcanada.com/exemples-copies-corrigees-expression-ecrite-tcf) | Compare the two versions of the late book return, neighbourhood cleanup and city traffic tasks. Check whether an edit fixes a genuine error or makes an already adequate response more effective. |
| [Centre for Canadian Language Benchmarks, writing](https://www.language.ca/ressourcesexpertise/langue-pour-reussir/cadre/redaction/) | Compare the communicative demands of benchmark 7 and 8 workplace assignments. The page provides task descriptions. |

The publishers describe their NCLC targets as illustrative. Keep these examples in development and exclude them from held-out agreement statistics. No independently rated TCF scripts were available for this revision.
