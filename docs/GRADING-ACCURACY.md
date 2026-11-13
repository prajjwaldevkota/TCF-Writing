# Measuring grading accuracy

The guide is an assessment method, not evidence that the current model is calibrated.

1. Build a held-out set of approximately 30–50 anonymized responses across all three
   tasks and A2–C1, including borderline B1/B2, strong, weak, missing, off-topic,
   too-short and copied-source cases. Task 3 examples need the actual documents.
2. Ask a qualified TCF/FLE assessor to independently label task-level ranges and
   explain their evidence without seeing the AI judgments. A second assessor helps
   distinguish model error from legitimate human disagreement.
3. Pin the model and version the guide. Repeat a representative subset three times.
   Measure exact/adjacent-band agreement, overgrading and undergrading, range width,
   missing-source withholding, unsupported correction claims, missed task requirements,
   and variation across runs. Report these separately for each task. Do not judge
   success merely by whether a broad AI range includes the human label.
4. Compare candidate models on the same examples before choosing one. Two passes
   by the same model are not two independent examiners. Model-to-model agreement
   measures agreement, not truth.
5. Keep prompt-development examples separate from the final test set. After changing
   the prompt/model, rerun the held-out suite and compare against the prior version.

Do not derive a final /20 or NCLC from task ranges. At the learner’s request, complete eligible mocks can now receive a separate
uncalibrated holistic NCLC range with a rationale. This does not reproduce the
unpublished official aggregation formula.
No official-result entry or official-score storage has been added. Such results need
an explicit learner-supplied source and must remain separate from AI judgments.

Implemented checks cover response shape, maximum five priorities, ordered CEFR ranges,
quoted corrections present in the original text, exact requested task scope, no numeric
scores/NCLC, missing-source withholding, blank responses, and mechanical word limits.
These checks cannot establish whether an AI correction or CEFR judgment is linguistically
correct; human evaluation is still needed.

Live integration check: one synthetic Task 1 invitation returned B2–C1, one priority,
all three evidence domains, and null numeric/NCLC values with the configured model.
This verifies integration, not accuracy. No real exam or benchmark score was inferred.

## Two-model NCLC cross-check

Both independent reviews are retained. The combined headline no longer automatically
prefers Gemini. Matching intervals are labelled matching; overlapping intervals keep
the full combined coverage (the union), so an overlap cannot create false precision.
Disjoint intervals produce a visible disagreement and no combined NCLC estimate.
A one-model success is explicitly labelled a single-model estimate. Agreement is
not a calibrated confidence score and does not establish accuracy.

The numerical dimension scores are pedagogical indicators only; agreement in those
scores is not evidence that an NCLC judgment is correct. Validate against independent
human-labelled work before treating projections as reliable readiness measurements.

Connection/assessment checks on 2026-11-12 found the previously configured
`gemini-2.5-flash` and `llama-3.3-70b-versatile` unavailable to these keys (HTTP 404).
Model-list endpoints accepted both keys. Gemini 3.8 Flash timed out in a minimal
connection test; it was not selected. The local configuration now pins
`gemini-3.1-flash-lite` and Groq `openai/gpt-oss-120b`, both verified with minimal
connection tests AND independent assessments of a synthetic Task 1 invitation.
The latter correctly produced no full-exam NCLC range. This is an integration
check, not a validated accuracy benchmark; no learner submissions were used.

## Evidence contract v5

Gemini and Groq now receive the same instruction builder in
`src/services/evaluationInstructions.ts`, including the same guide and task payload.
No new dimension points, invented weights or /20 averages are requested or computed.
Historical reviews remain readable, with an earlier-instructions notice and a way
to reassess. Strengths, illustrative answers and correction explanations remain.

A level range requires two supporting quotations from the learner's answer, with
explanations. Harmless apostrophe, hyphen and whitespace differences are resolved
back to exact original excerpts; invented wording is rejected. Missing prompts,
missing Task 3 sources and blanks cause withholding. Optional illustrative answers
that miss the requested word limits are omitted with an explanation.

Each new review stores the rubric version and a SHA-256 fingerprint of its system
instructions and input payload. Two-model NCLC comparisons refuse to combine
mismatched request fingerprints. This supports reproducibility; it is not an accuracy
or confidence metric. Both providers passed a live synthetic Task 1 integration
check under v5, with two verified quotations each, identical request fingerprints,
and no numeric score. Human calibration remains outstanding.

## Partial-review recovery

An unmatched or malformed correction is now omitted with a visible warning instead
of discarding the entire provider review. Only quotations resolved to the learner's
original text enter the saved correction list/Mistakes Bank. Unicode composition,
apostrophe, hyphen and spacing variations are matched back to exact original text;
missing or genuinely different words are not accepted by fuzzy matching.

If fewer than two supporting level quotations survive validation, the task range is
withheld. A complete-mock NCLC projection is also withheld whenever any task range
is unsupported. A missing correction section is reported as incomplete, not as an
error-free answer. Structural errors, invalid score fields and invalid ranges still
fail validation. Previously saved reviews are not silently rewritten.
