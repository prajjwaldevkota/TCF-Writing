# Écriture: practice first

Local interactive mockup: `/redesign.html`. The production app and its saved data are unchanged.

## Revised plan

One 64px desktop header (58px mobile), with the wordmark and three labeled destinations: Pratiquer, Sujets, Bilan. Remove the duplicate preview toolbar, breadcrumbs, profile row, large slogan, weekly calendar and encouragement widgets. Put the random exam action above the task list. Navigation supports browser Back and Forward.

Proposed palette: white #ffffff, background #f8f9fb, ink #24334a, blue #315bc1, muted #667286, borders #e1e5eb. These are implementation choices, not extracted reference values. DM Sans for controls and instructions; Georgia for writing. Quiet dividers separate tasks; blue indicates the primary action and active navigation.

```text
wordmark        Pratiquer / Sujets / Bilan
page title + one explanatory sentence
random complete exam                       [Draw]
optional selected set preview              [Start]
task 1 / task 2 / task 3
resume draft
```

## References inspected

Inspected desktop screenshots, page text and branding output via Firecrawl on 2026-11-14.

- [Monkeytype](https://monkeytype.com/): compact branding/navigation, grouped test settings, practice surface taking priority over dashboard widgets. Branding extraction reports #323437 background, #E2B714 accent, Roboto Mono body and Lexend Deca headings. Its scrape text included a stylesheet warning, although the inspected screenshot showed the dark interface. The implementation borrows the task-first hierarchy, not its colors, icon-only navigation or typing typography.
- [Keybr](https://www.keybr.com/): a centered practice area, small metrics, neutral surface, and compact navigation. Branding output reports #F4F0F0 background, #3D475C primary and Open Sans. The screenshot included an onboarding dialog, so the unobstructed practice state was not verified. The implementation borrows restrained density, not its side navigation or onboarding.

Header dimensions, responsive behavior and all TCF layout choices are proposed rather than claims about reference CSS. No reference images or logos are used in the mockup.

## Working prototype behavior

- Examen aléatoire draws a complete set from the existing question bank using the existing random-combination utility. Repeat draws avoid the previous set when alternatives exist.
- Drawing selects a set without starting the clock. The selection shows three matching task previews; Commencer l’examen opens the same set with 60 minutes.
- Sujets searches the existing question bank by text, month or year; selecting a result opens that set for review. More results can be loaded.
- Guided task choices use the selected set, or an illustrative prompt before a set is selected.
- Writing includes independent per-task draft text, word targets, accent insertion at the caret, focus view, and a pausable demo timer. Task 3 preserves both documents from the selected source set.
- Bilan is clearly labeled illustrative. No AI evaluation or cloud write is performed. Drafts stay in component memory for this preview only.
