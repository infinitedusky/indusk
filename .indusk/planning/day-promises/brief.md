---
title: "Day step 4a — Promise clauses: the contract's second kind of clause, as a primitive"
date: 2026-09-17
status: draft
workflow: feature
---

# Day step 4a — Promise clauses — Brief

## Where this sits

Day's core primitive is the **contract**: what a human approves before code
exists and what the artifacts then prove was met honestly. A contract is made
of two kinds of clause.

- **Change clauses** are true once the change lands and retire with the plan:
  "the migration preserves every row's key." They are the Test Trajectory's
  rows, and Day's steps 5 through 9 make them honest at review time.
- **Promise clauses** are commitments the system keeps for as long as it runs
  and any later change can break: "a seat is never double-booked." They
  outlive the plan that stated them.

This step builds promise clauses as a primitive: how one is written, stated,
linked to the code that enforces it and the test that checks it, promoted
from a plan's claims at close, changed only on purpose, and read at review.
The telemetry half of the promise system — detecting a violation in use,
recording its root cause, waking the owning plan — is the next step,
[`day-monitor`](../day-monitor/brief.md), which was called Midnight. That
step cannot exist without this one; this one is useful without it.

## Why a promise is not just another claim

A trajectory row that went green stays green until someone edits the code it
tests. A promise can be broken by code nobody tested against it, months after
it was proved, by a change that never mentioned it. That difference is why a
promise needs three things a row does not: an owner that outlives the plan, a
state rather than a verdict, and a link into the running system's telemetry
(the next step) rather than only into the test suite.

## The vocabulary, defined once

- **Promise.** A sentence about behaviour the system must always uphold,
  written the way the test plan already requires claims to be written —
  observable, never implementation. It has a readable name, an owning plan,
  a **domain** (a tag naming the part of the system it is about — seating,
  archive, auth, gates — so the registry can be read by area and not only by
  plan), one or more code sites, one or more tests.
- **Promise state.** `enforced`: the system upholds it and a violation is a
  bug. `known-violated`: declared, and the current implementation provably
  cannot uphold it yet; this state carries the incident that proves it, so it
  is evidence rather than an excuse. `retired`: no longer a promise, kept for
  history. The middle state is what makes declaring honest: without it a
  promise you cannot yet keep is either hidden or a permanently red build,
  and a permanently red check stops being read (this project has switched two
  off that way).
- **Incident.** What happened when a promise was broken: symptom, root cause,
  which promise, where the system was running when it broke (`local`,
  `smoke`, `deployed`, or `desk` for a finding by reading — the source is
  recorded because they are different evidence), status, fix. This step
  defines the record; `day-monitor` is what fills it from the running system.
- **Owner.** The plan that first stated the promise. Ownership moves only when
  another plan supersedes the promise.
- **The two links this step makes.** A comment at the enforcing code site
  naming the promise, and a test that asserts on the trace a call produced and
  names the promise it validates. The third link, the span attribute the
  running system emits, is `day-monitor`'s.

In looper, where the writing half of this exists, the words are *expectation*
(numbered E-1 to E-11) and *failure* (F-1 to F-9). Day's shape says
*promise*; this brief says promise and incident, with readable names rather
than sequential ids. The ADR settles the spelling and whether looper renames.

## What changes for a project

1. **A registry** of promises and incidents, one per project, with states,
   owners, code sites and tests.
2. **`indusk promises check`** — every name cited in code or tests exists in
   the registry, and every `enforced` promise has at least one code site and
   one test. A promise declared and not guarded fails the build. Extracted
   from looper's validator, which already enforces both directions in its lint
   step.
3. **A test helper** that asserts on the spans a call produced and requires
   the promise's name. Language-specific, so the testing extension owns it:
   looper's `assert_trace_shape` for pytest is the reference; the vitest one
   is written here.
4. **Promotion at plan close.** `/retrospective` asks which of the plan's
   claims are about the system rather than the change; those are written to
   the registry with the plan as owner. This is where a change clause becomes
   a promise clause, and it is cheap because the claim is already a
   behavioural sentence.
5. **A plan closes holding N promises.** Closed stays the resting state; the
   archived plan is the owner of record and can be woken. When every promise
   it held is superseded or retired it holds none and is truly finished. The
   admin shows the count on the archived segment; no new state.
6. **How a promise changes.** Revised (same commitment, sharper wording),
   superseded (owner moves to the superseding plan) or retired — only by a
   change that names it. A change that touches a promise's code site without
   naming it gets the review verdict "touched, unacknowledged". That verdict is
   Day artifact 9; this step defines the rule and the data, step 10 renders it.

## How promises appear in the admin

**A project-wide Promises page** (Sandy, 2026-09-17: "project wide and
sortable, by plan, by contract, by domain"), beside Scorecards in the
sidebar: the registry as a table, one row per promise — chip, name,
statement, domain, owner plan, code sites, tests, incidents — sortable and
groupable by owner plan, by domain, by state, and (once 4b lands) by health.
"By contract" and "by plan" are the same grouping today, because a contract
is a plan's clauses; whether a contract ever gets a name of its own is an ADR
question below.

**A chip carries two axes, never one colour.** The *declared state* is what
this step renders: `enforced` (filled), `known-violated` (amber, with its
incident), `retired` (grey). The *observed health* — whether the running
system upheld or broke the promise in the window — is 4b's axis, and until
4b lands every enforced chip is drawn **hollow**: declared, not yet observed.
Green must mean "seen upheld"; a chip that has seen nothing must not look
green, or the page lies the way a test suite does. This is the same rule as
Day's verdicts: unverified is a verdict, not a pass.

**Per plan, a Promises section** beside Falsification and Cleanup, closed by
default like every section: the promises this plan *holds* (as owner), and,
for a plan in flight, the promises its change *touches* with what it does to
each (keeps, revises, supersedes, retires) — Day artifact 9 as data; step 10
renders the verdict. **On the bars**, the archived segment carries
"holding N".

**The pin.** Declared state (and 4b's health) are unions beside
`PlanPosition` in the lifecycle module; the chip's label and colour maps are
`satisfies Record<…>` over them, and the render-parity test names any member
without a chip. Adding a state without drawing it fails the build, as adding
a lifecycle stage does today.

## What exists today, verified 2026-09-17

| Piece | looper | numero | dusk |
|---|---|---|---|
| Registry with states; incidents with sources | **built** (11 promises, 9 incidents, all recorded by hand) | none | none |
| Validator in the build, both directions | **built** | none | none |
| Trace-shape test helper naming the promise | **built** (pytest) | none | none |
| Typed telemetry contract (every span declared and emitted) | not possible in Python | **built**, 12 services, in CI | none |

Looper proved the primitive can be written and enforced. Numero's typed
contract is a different, optional thing: it says which spans exist, not what
the system promises. It becomes an optional check here for projects with a
typechecker.

## Proving ground

**looper** is the reference implementation and adopts the InDusk copy of its
own validator. **numero** proves adoption: it has real failures from deployed
environments and the archive sediment (four plans for one concern) and no promises. **dusk**
self-hosts a few promises so the convention is shown not to depend on a
service: the gates ran at every checkoff, the boundary record is never
corrupt, no test writes the real registry — each already has a recorded
incident.

## Steps

| # | Effort | What |
|---|---|---|
| 1 | ~1d | Registry format and `indusk promises check`, extracted from looper's validator; looper adopts it |
| 2 | ~½d | Promotion at plan close in `/retrospective`; the owner field |
| 3 | ~1d | The vitest trace-shape helper in the testing extension; looper's pytest one becomes its Python half |
| 4 | ~½d | "Holding N promises" derived and drawn on the archived segment |
| 5 | ~½d | The change rule: a plan that touches a promise's site names what it does to the promise; the "touched, unacknowledged" verdict defined for step 10 |
| 6 | ~1d, optional | The typed-contract check generalized from numero's, for projects with a typechecker |

About a week, distributed.

## Acceptance

Numero has a registry with at least three enforced promises, each with a
code site and a test, and `indusk promises check` is in its CI; dusk holds
three of its own; a plan closing in either project promotes at least one
claim; and a change touching a promise's code site without naming it produces
the "touched, unacknowledged" data the review step will render.

## Depends on

- admin-ui-phase-progress (closed 2026-09-17): the lifecycle module and the
  render convention (a plan that adds a stage renders it).
- Day's shape document, artifact 9.

## Open for the ADR

- Where the registry lives (`.indusk/promises/` vs the docs tree looper used).
- Whether a contract is only "a plan's clauses" or gets a name of its own
  (so the Promises page can group by contract independently of plan) — the
  answer decides whether the registry carries a `contract` field.
- Whether `domain` is a free tag or a declared list per project.
- Whether promotion at close is a question the retrospective asks or a
  property the test plan marks on the claim when it is written.
- Looper's rename from E-N/F-N to readable names: now, or when it next opens.

## Cross-references

- [`day-monitor`](../day-monitor/brief.md) — the telemetry half (was Midnight)
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md) — artifact 9, promise linkage
- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) —
  two authorities; why behavioural assertions are the shape of a promise
- looper: `apps/docs/src/telemetry/expectations.md`,
  `backend/scripts/validate_expectations.py`, `backend/looper/telemetry/shape.py`
- numero: `scripts/check-telemetry-contract.ts`
