---
title: "Approval waits for the planning run"
date: 2026-10-19
status: accepted
workflow: bugfix
description: "A plan written by the unattended planning run is not offered for approval until the run has stopped at ready for approval, so Needs you and Approve never appear while the plan review is still reading or answering."
accepted_at: "2026-10-19T15:42:34.359Z"
---

# Approval waits for the planning run — Brief

Found 2026-10-19 (Sandy): `decisions-as-questions` showed under Needs you with
Approve while its planning run's plan-review step was still running and had
not written `plan-review.md`. Approval is withheld only while a session's turn
is open (`approval-waits-for-a-finished-plan`, read through
`SessionManager.isWriting`); a planning run has moments with no open turn — a
step's session after its turn ends, the gap before the next step's session
starts — and the draft impl alone then reads as ready.

## Expectations

None — a bugfix; the Approve button appearing only after the run stops is the outcome.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`decisions-wait-in-one-place`**. A plan that is ready still appears under Needs you with its decision.
- **`an-accepted-brief-is-planned-unasked`**. The run still stops for approval; only the offer waits for that stop.

**Changes**

- **`approval-waits-for-a-finished-plan`**. A plan is listed as waiting for approval only when its impl is written, no session is still writing it, and any planning run for it has stopped ready for approval.

**Replaces**

None.

### Not promised

- Showing which planning step is running on the plan page: a later plan with the activity work.

## Looks

None — the rule lives in the package's `plans/waiting`, outside the admin's interface files; Needs you and Approve look as they do, only later.

## Depends On

- None.

## Blocks

- None.
