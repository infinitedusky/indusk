---
title: "Approval waits for the planning run — Test Plan"
date: 2026-10-19
status: draft
---

# Approval waits for the planning run — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the fix works: a plan is offered for approval only once its impl is written, no session is still writing it, and its `plan-review.md` is written with every finding answered; a plan written without an answered plan review, that no planning run is still writing, is listed under Needs you as needing its plan review; and every Approve button the admin draws asks that same answer. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove.

The assertions here become the rows of the impl's `## Test Trajectory` table, with the same IDs.

The brief makes no new promise. It changes one existing promise, `approval-waits-for-a-finished-plan`, and must not break two others, `decisions-wait-in-one-place` and `an-accepted-brief-is-planned-unasked`. The brief is not `clauses: required`, so rows name the promise, not clauses.

## What changed since the first draft

The first draft of this plan withheld approval only while the admin's planning run was going, and offered it after any end of the run. Its cold read (`plan-review.md`) showed three ways that still offered an unread plan: a run that stopped on a failure, an admin restart mid-run (the run's state is held only in memory), and the plan page's and brief page's own Approve buttons, which never asked the rule. The brief was amended: approval is read from a file, the plan's `plan-review.md` with every finding answered; the run's state decides only whether anything is listed while the run is still going, and what a stopped run's card says. Every assertion below is written for the amended brief.

## Behavioral Assertions

### Changes: `approval-waits-for-a-finished-plan`

A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written with every finding answered; a plan whose impl is written without an answered plan review, and that no run is still writing, is listed as needing its plan review.

- Signal: Needs you and the Approve buttons in the admin; upheld when no plan without an answered `plan-review.md` shows Approve anywhere, broken naming the plan and the page that offered it. No telemetry mark exists for this promise (`otel.role` is `library`); the approve route's refusal while a run is going stands behind every button.

**The rule, from its inputs** (the package's `planWaiting`, fed facts):

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan whose impl is a draft and whose other documents are accepted, with no session writing it and no planning run going, but with no `plan-review.md`, is not offered for approval; it is listed once as needing its plan review, at its Impl step, with a decision that says so. | unit |
| A2 | The same plan with a `plan-review.md` that leaves a finding unanswered, a finding without its "breaks when" line, or a question without its section is listed as needing its plan review, never for approval. | unit |
| A3 | While a planning run for the plan is still going, with no session turn open (between steps, or a step's session over), nothing is listed for the plan — neither approval nor its plan review — whether or not its review is answered. | unit |
| A4 | When the admin's planning run for the plan stopped without reaching approval, with a reason, and the plan review is not answered, the plan is listed as needing its plan review and the decision says why the run stopped. | unit |
| A5 | After the admin restarts mid-run (no planning state passed in at all), a plan with a draft impl and no answered plan review is listed as needing its plan review with the plain decision, never for approval. | unit |
| A6 | A plan written by hand, that no planning run ever touched, needs its plan review the same way, and is offered for approval once the review is answered. | unit |
| A7 | A session whose turn is open on the plan withholds both approval and the plan-review listing, whatever the review says; once the turn ends, the plan is listed by its review's state. | unit |
| A8 | A planning run going for another plan does not affect this plan's listing. | unit |

**The reading of the file** (where the rule's input comes from):

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | The package reads a plan folder's `plan-review.md` the one way the planning run reads it: absent reads missing, a file with an open finding reads unanswered, a file with every question's section and every finding answered reads answered. | unit |
| A10 | The admin's plan reader, on a real plan folder on disk, hands the rule the plan review's state as the package read it, for each of the three states. | unit |
| A11 | The plan review is read by the package alone: the package exports its reader, and neither the admin nor the editor defines one of its own. | unit |

**The admin's planning state, and the reader that passes it on:**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | The admin's planning state for a run stays "going" through the gap after one step ends and before the next begins, and once the run ends on a failure it reads stopped, keeping the reason. | unit |
| A13 | Through the admin's reader, with the real planning state of a run the admin started: while the run is between steps, a plan with a draft impl is not listed at all; once the run stops on a failure, the plan is listed as needing its plan review, with the run's reason. | unit |

**Every Approve button asks the same answer:**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A14 | What a plan's page offers says Approve only when the package lists the plan as waiting on approval; a draft impl waiting on its plan review, on a question, or on nothing offers no Approve. | unit |
| A15 | The plan page and the brief page both pass the package's waiting answer for the plan into what the page offers, so neither page draws Approve on a rule of its own. | unit |

**The live story:**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | On the installed admin, after a brief is accepted: through the whole planning run, Needs you and the plan page show no Approve until `plan-review.md` is written with every finding answered; then Approve appears once, on the decision card. | live check |

### Must not break: `decisions-wait-in-one-place`

A plan that is ready still appears under Needs you with its decision; a plan needing its cold read appears there too.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | A plan whose impl is a draft, with no session writing it, no run going and its plan review answered, is listed under Needs you exactly once, as approval, with Approve and "Not yet — keep planning". | unit |
| A18 | A question the plan's agent asked still outranks everything; an amendment and a stopped review are listed as before; a plan needing its plan review is outranked by each of them. | unit |
| A19 | Answering a plan-review decision never approves the plan and never starts a release: accepting it, or the alternative, goes to the plan's agent as words. | unit |
| A20 | The decision card draws a plan waiting on its plan review in its existing ask state, headed as needing its plan review at the step, with the decision's words. | unit |

### Must not break: `an-accepted-brief-is-planned-unasked`

The run still stops for approval; only the offer waits for its cold read.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | The planning run still reads the plan review — absent, open, then answered with its dismissals — and still stops for approval only once it is answered; it reads the file through the same reader the offer uses. | unit |

## Untestable Assertions

None. A16 is a live check: it needs the installed admin and a real planning run, so it is a manual procedure run after landing and recorded in the impl.

## Notes

- Restarting a planning run that stopped is out of scope (the brief's "Not promised"): the person reruns it, or the planning agent writes the plan review by hand. A19 only makes sure that answering the card can neither approve nor release.
- `indusk plans approve` on the command line gets no new gate; only the admin's offer changes. No row asserts a refusal there.
