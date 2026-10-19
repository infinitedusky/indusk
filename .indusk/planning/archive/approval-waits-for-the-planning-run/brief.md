---
title: "Approval waits for the planning run"
date: 2026-10-19
status: accepted
workflow: bugfix
description: "A plan is not offered for approval until its cold read is written with every finding answered, so Needs you and every Approve button stay away while a planning run is still writing or reviewing, after an admin restart, and for a plan written by hand. A plan whose run stopped without its cold read is shown as needing it."
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

**Amended 2026-10-19 (Sandy), from the plan's own cold read:** waiting for the
run to stop is not enough. A run that stops on a failure, or an admin restart
mid-run (the run's state is held only in memory), would still offer the plan
without its cold read, and the plan page's and brief page's Approve buttons do
not ask the same rule. Approval is now read from a file: the plan's
`plan-review.md`, written with every finding answered.

## Expectations

None — a bugfix; Approve appearing only once the plan has been read cold and answered is the outcome.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`decisions-wait-in-one-place`**. A plan that is ready still appears under Needs you with its decision; a plan needing its cold read appears there too.
- **`an-accepted-brief-is-planned-unasked`**. The run still stops for approval; only the offer waits for its cold read.

**Changes**

- **`approval-waits-for-a-finished-plan`**. A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written with every finding answered; a plan whose impl is written without an answered plan review, and that no run is still writing, is listed as needing its plan review.

**Replaces**

None.

### Not promised

- Showing which planning step is running on the plan page: a later plan with the activity work.
- Restarting a planning run that stopped: the person reruns it, or the planning agent writes the plan review by hand.

## Looks

The Approve buttons on the plan page and the brief page ask the same rule as Needs you, so they appear later; the decision card shows "needs its plan review" in its existing ask state. No component or state is added.

### This plan makes

None.

### Existing looks

**Must not break**

- **`plan.working`**. The plan page while it is being planned or built, which no longer offers Approve before the plan review is answered.
- **`plan.needs-you`**. The decision card, which also shows a plan needing its plan review.

**Changes**

None.

**Replaces**

None.

## Depends On

- None.

## Blocks

- None.
