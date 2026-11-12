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
