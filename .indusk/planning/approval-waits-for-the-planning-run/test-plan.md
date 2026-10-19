---
title: "Approval waits for the planning run — Test Plan"
date: 2026-10-19
status: draft
---

# Approval waits for the planning run — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the fix is working: a plan written by the unattended planning run is not offered for approval (under Needs you, with Approve) until the run has stopped at ready for approval. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove.

The assertions here become the source rows for the impl's `## Test Trajectory` table.

The brief makes no new promise. It changes one existing promise, `approval-waits-for-a-finished-plan`, and must not break two others, `decisions-wait-in-one-place` and `an-accepted-brief-is-planned-unasked`. The changed promise is stated here as three clauses, because its new sentence has three conditions that each can be broken on its own: the impl is written, no session is still writing it, and any planning run for it has stopped ready for approval. The first two are held today (rows A8 and A12 of `cockpit-audit-fixes`, in `waiting.test.ts`); the third is the fix.

## Decisions made while writing this plan

Unattended run (`INDUSK_GATE_POLICY=auto`); nobody could be asked. Each decision and why:

1. **The clause split is mine.** The brief is not `clauses: required`, so no registry holds the clause names; I wrote three clauses from the promise's three conditions so each has its own measure. Reason: the bug is the third condition missing, and a single undivided assertion would not show which condition broke.
2. **Levels are unit and contract, with one live check.** The rule is a pure function (`planWaiting` in `plans/waiting`) fed by the admin's reader; the gap is in what the reader hands it. A unit row proves the rule from inputs; a contract row proves the reader (`readWaiting`) hands it the planning run's state. The real gap (a step's session over, the next not yet started) only happens in a running planning run, so one live check covers it. Reason: smallest level that proves each fact, and the user's rule that a slow tier never blocks landing.
3. **"The run has stopped" is observed, not defined here.** Whether the run's stop is read from its recorded stop step or from the run being no longer active is the ADR's choice; every assertion below is phrased on what Needs you shows, so either works. Reason: the test plan constrains the ADR, not the reverse.
4. **A planning run that crashed or was abandoned is an open decision, not asserted.** A run that ended without stopping at ready for approval (error, killed admin) would, under the new rule, hide approval forever unless "stopped" includes any end. I assert only that an ended run, whatever the end, stops hiding approval (A6); whether a crashed run should instead show something else is recorded under Notes for the ADR. Reason: hiding a finished plan indefinitely is a worse failure than offering it, and the brief does not say.
5. **No Untestable Assertions.** Everything here is observable; the live check needs a running daemon, which the slow tier has (`pnpm e2e`).

## Behavioral Assertions

### `approval-waits-for-a-finished-plan`

A plan is listed as waiting for approval only when its impl is written, no session is still writing it, and any planning run for it has stopped ready for approval.

### `impl-is-written` — the plan's impl exists and its other documents are accepted

- Signal: Needs you in the cockpit (`readWaiting`); upheld when no plan without a written impl (or with an unaccepted earlier document) shows Approve; broken reports the plan name and what it was missing.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan whose impl is still absent, or whose brief, test plan or ADR is not yet accepted, is not under Needs you for approval, whatever else is true of it. | unit |

### `no-session-writing` — no session's turn is open on the plan

- Signal: Needs you in the cockpit; upheld when a plan with a session mid-turn on it shows no Approve; broken reports the plan and the session.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | A finished plan with a session whose turn is open on it shows no Approve; once that turn ends and nothing else is running, it shows Approve. | unit |

### `run-stopped-ready` — any planning run for the plan has stopped ready for approval

- Signal: Needs you in the cockpit; upheld when a plan with a planning run that has not stopped shows no Approve and one whose run stopped ready for approval shows it; broken reports the plan and the run's last step.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | A plan whose impl reads as written, with a planning run still going and no session turn open (between steps, or a step's session over), shows no Approve and is not under Needs you. | unit |
| A4 | The same plan, once its planning run has stopped ready for approval, shows Approve under Needs you with the approval decision. | unit |
| A5 | A plan whose planning run is on its plan-review step, with `plan-review.md` not yet written, shows no Approve; after the run stops, it does. | contract |
| A6 | A planning run that has ended any other way (an error, a killed admin) does not hide approval of a finished plan indefinitely. | unit |
| A7 | In a live planning run of a bugfix plan, Needs you shows no Approve at any moment until the run stops, including the gap between one step's session ending and the next starting; at the stop it shows Approve. | live check |

### Must not break: `decisions-wait-in-one-place`

A plan that is ready still appears under Needs you with its decision.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A planning run stopped ready for approval, with the draft impl complete, lists the plan under Needs you exactly once, as approval, with Approve and "Not yet — keep planning". | unit |
| A9 | A question asked by the planning run's session still shows as the plan's one decision, and outranks approval, whether or not the run has stopped. | unit |
| A10 | A plan at review or with an amendment waiting is listed as before; a planning run does not hide either. | unit |

### Must not break: `an-accepted-brief-is-planned-unasked`

An accepted brief is planned without asking; the run still stops for approval.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | An accepted brief's planning run still writes the remaining documents without asking and still ends stopped at ready for approval; waiting does not stop or restart it. | contract |
| A12 | After that stop the person's Approve is offered once (A8), so the run's stop is the only change in when the offer appears. | live check |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A13 | A plan that no planning run has ever touched (written by hand, or a run from an earlier admin) with a finished draft impl and no open session still shows Approve. | unit | A regression guard: the new condition must be absent-safe, not "no run found means wait". |
| A14 | A plan with a planning run for a different plan going does not have its approval hidden. | unit | A regression guard against matching a run by anything but the plan name. |

## Untestable Assertions

None. See decision 5.

## Notes

- **Open, for the ADR:** where "the run has stopped" is read from (the run's recorded stop step versus no active run), and what a crashed run should show (A6 only requires approval not be hidden forever).
- **Open, for the impl:** A7 and A12 need a daemon and a `claude` binary; they belong in the slow tier (`pnpm e2e`) and never block landing.
- A5 may be merged into A3 if the reader's contract test and the unit row turn out to prove the same fact; keep both until the ADR chooses the shape.
