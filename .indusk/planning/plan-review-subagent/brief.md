---
title: "plan-review-subagent"
date: 2026-10-09
status: draft
workflow: feature
---

# plan-review-subagent — Brief

## Expectations

1. **The review finds things the builder missed, on some plans.**
   - Measure: findings in the review document that led to a fix, counted over the next five plans closed.
   - Look: after those five plans close.

2. **A review costs less than the rework it prevents.**
   - Measure: the usage page for a review against a typical plan's phases, over the same five plans.
   - Look: with expectation 1.

## Promises

### This plan makes

1. **`a-plan-is-read-by-a-fresh-reader-before-it-closes`** (state). Before a plan's retrospective, a reader that has not seen the building session reads the plan and writes what it finds to a document in the plan folder, and the retrospective refuses to start until that document exists or the impl says why the review was skipped.

2. **`the-reader-sees-the-plan-not-the-session`** (state). The reader is handed the plan's brief, test plan, ADR and impl, and the diff of the plan's branch against the trunk, and nothing from the session's conversation.

3. **`the-reader-runs-on-its-tier`** (state). The reader runs on the model `workflow.steps.<step>.tier` names in the config, with no one switching models by hand; a project that names no tiers runs it on the session's model.

4. **`a-review-blocks-nothing`** (state). A finding in the review document changes no gate: the retrospective reads that the document exists, never what it says.

### Existing promises

**Must not break**

- **`a-build-runs-to-review-unasked`**. The unattended build gains a step; it must still run to the person's review without being asked.
- **`a-review-shows-its-evidence`**. The admin's acceptance panel is unchanged by this plan.
- **`each-phase-runs-on-its-model`**. The tier config gains a step; the phases' answer must not change.

**Changes**

None.

**Replaces**

None.

### Not promised

- Findings blocking the retrospective or acceptance (Sandy, 2026-10-09: advisory).
- The admin's acceptance panel showing the review document: a follow-up.
- Which model the reader is: config, not a promise.

## Depends On

- `.indusk/planning/archive/model-per-phase/` — landed 2026-10-09; the tier config and the subagent-on-model hand-off.

## Blocks

- None.
