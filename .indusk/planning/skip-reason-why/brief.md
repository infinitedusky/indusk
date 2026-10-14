---
title: "skip-reason-why"
date: 2026-10-14
status: accepted
workflow: bugfix
description: "A plan's page shows a skipped close-out step as \"Skipped\" with a small \"why?\" that opens the reason, instead of printing the whole reason across the row. And a skip's reason must be one short sentence, so what opens is a summary a person can read."
---

# skip-reason-why — Brief

## Expectations

1. **Skip reasons written after this read as summaries, and no plan's release rail is overrun by one again.**
   - Measure: the length of every `falsification_reason`, `cleanup_reason` and `audit_reason` in plans archived after this lands (today's longest run 830–960 characters); and the release rail of component-content's page, which today shows a paragraph across the Cleanup row.
   - Look: at the next three plan closes, and on component-content's page once this lands.

## Promises

### This plan makes

1. **`a-skipped-step-shows-why-on-request`** (state). A step skipped with a reason reads "Skipped" on the plan's page, and its reason appears only when a person opens the "why?" beside it, whatever the reason's length.
2. **`a-skip-reason-is-one-sentence`** (state). A skipped falsification, cleanup or audit is refused at the retrospective unless its reason is one short sentence, and the skills that write a skip show one.

### Existing promises

**Must not break**

- **`a-plan-is-audited-by-a-fresh-reader-before-it-closes`**. The retrospective still accepts an audit skip with a reason; this plan only adds that the reason is short.

**Changes**

None.

**Replaces**

None.

### Not promised

- Rewriting the long reasons in already-archived plans. They stay as written and read "Skipped" like any other; their text is behind "why?".
- Judging whether a reason is a *good* reason. A length limit makes it short, not true; the audit and the person reading it judge the rest.

## Looks

### This plan makes

1. **`step.skipped`**. A rail step skipped with a reason: its name, "Skipped" as its status, and a small "why?" after it.
2. **`step.skipped-open`**. The same step with "why?" opened: the reason shown beneath the row, inside the rail, until it is closed.

### Existing looks

**Must not break**

- **`step.done`**, **`step.working`**, **`step.needs`**, **`step.waiting`**. The same component; a step with no reason draws exactly as it does today.

**Changes**

None.

**Replaces**

None.

## Depends On
- None.

## Blocks
- None.
