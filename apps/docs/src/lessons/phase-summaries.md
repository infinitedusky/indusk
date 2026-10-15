# Phase Summaries — Lessons

From the plan that made each impl phase open with a plain summary and fold each task's technical detail beneath it (2026-10-15). Retrospective: `.indusk/planning/archive/story-first-phases/retrospective.md`.

## A rule enforced at save time is tested on every path that saves

The save check's new rule held on a whole-file write and on no other edit: its early exit for an edit with no phase heading, no unticked box and no Tier line let most real edits through untouched. Every test behind the promise wrote the whole file, so three phases closed green over the gap. Test an enforcer through each way the thing it guards can change: a write, an edit, and any loop that writes on an agent's behalf.

## Changing how a syntax is read means finding every reader

Folded detail was meant never to tick a box. That held only once five readers of checkbox lines agreed, and two more, the gated loop's commit naming and the repair phase a broken promise writes, were found only by a reader who had not built the plan. Before deciding how a syntax is read, grep for every place it is read and list them in the ADR.

## A fold fails open, like a fence

Checks that skip folded text turn one missing `</details>` into a phase that reads finished with work still open. An unterminated block must hide nothing, and the save check must refuse it where it is written.

## A story that copies a component approves a drawing

The phase-row stories drew the task list by hand, with classes that had already drifted from the real component, so the approval was of a picture. A story renders the real child component, or its snapshot is no evidence about that component.
