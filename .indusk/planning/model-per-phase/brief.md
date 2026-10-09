---
title: "model-per-phase"
date: 2026-10-09
status: draft
workflow: bugfix
---

# model-per-phase — Brief

## Expectations

1. **Building a plan costs noticeably less, with no plan built worse for it.**
   - Measure: Claude usage over the weekend's plans against this week's similar-sized plans (the account's usage page), and any phase sent back to the stronger model.
   - Look: Monday 2026-10-12, after the weekend's building.

2. **Sessions end at plan boundaries instead of compacting.**
   - Measure: compactions per plan in the weekend's sessions; today one session compacted several times across four plans.
   - Look: Monday 2026-10-12.

## Promises

### This plan makes

1. **`each-phase-runs-on-its-model`** (state). Every phase `/work` builds runs on the model the project's config gives its tier — `strong`, `med`, `weak` or `baby` — where the tier is the one its plan names, or its step's default tier when the plan names none, without anyone switching models by hand.

2. **`a-model-override-says-why`** (state). An impl that gives a phase a different tier from its step's default says why, or the impl is refused.

3. **`a-struggling-phase-asks-for-a-stronger-model`** (state). A phase whose tests still fail after three attempts on a tier below `strong` stops and names the next tier up to run it on.

4. **`a-plan-boundary-names-the-next-session`** (state). Approving a plan, and closing each of its phases, ends by naming the command to run in a new session.

### Existing promises

**Must not break**

- **`phase-boundary-record-never-malformed`**. A phase run on its own model still records where it began, which Shape and verify read.

**Changes**

None.

**Replaces**

None.

### Not promised

- The admin's Build button passing each phase's model: deferred to a follow-up (Sandy, 2026-10-09: the weekend's building is in the terminal).
- Which model each tier is, and each step's default tier: config, not a promise; the project changes them without a plan.
