---
title: "Day step 4 — Promises: violation detection and root cause for the contract clauses that outlive the change"
date: 2026-06-14
status: draft
amended: 2026-08-11
rewritten: 2026-09-17
codename: midnight
---

# Day step 4 — Promises — Brief

**Was `midnight`.** Renamed and moved under Day on 2026-09-17 because the
conversation that positioned it happened in Day's shape document, not here.
The earlier brief (2026-08-28) had the mechanism right and the framing
missing; this one starts from the framing.

## What this is, in one paragraph

InDusk is contract-driven development: a human approves what a change must
make true before any code exists, an agent does the work, and the artifacts
prove the claims were met honestly. A **contract has two kinds of clause**.
*Change clauses* are true once the change lands and retire with the plan —
"the migration preserves every row's key." *Promise clauses* are commitments
the system keeps for as long as it runs and every later change can break —
"a seat is never double-booked." Day's other steps make change clauses honest
at review time. **This step keeps promise clauses honest for the life of the
system, and it is as much Day as any other step.** Its two jobs are
*violation detection* and *root cause*: one name threads the code that
enforces a promise, the test that checks it, and the telemetry span that
reports it, so a violation in use says which promise broke; the incident
record then carries the symptom, the root cause and where it was observed,
the promise says which plan owns it, and that plan reopens to fix it. Day's
review step reads the result as one more line with a verdict.

## Why

The three feedback loops InDusk has — the evaluator turning commits into
lessons, the falsification ritual attacking a plan's own claims, the Shape
check reviewing craft — are all closed inside the repository. They surface
only what someone thought to look at. The `versioned-workbench` retrospective
is the measurement: fourteen phases, thirty-two green rows, both rituals run,
and twelve defects within an hour of real use. This step adds the first loop
fed from outside the repository.

The highest-information object the loop can produce is **a test that passed
while the system broke**. Every other signal says the code failed; this one
says the assertion was insufficient, and names it. Nothing inside the repo
can produce that object.

## The vocabulary, defined once

- **Promise.** A sentence about behaviour the system must always uphold,
  written the way the test plan already requires claims to be written —
  observable, never implementation. "An archive is never modified after it is
  written." It has a name, an owning plan, one or more code sites, one or more
  tests, and a trace pattern.
- **Incident.** What happened when a promise was broken: symptom, root cause,
  which promise, where it was observed (production, a smoke run, a desk
  probe — the source is recorded because they are different evidence), status,
  fix.
- **Promise state.** `enforced`: the system upholds it, and a violation is a
  bug. `known-violated`: declared, and the current implementation provably
  cannot uphold it yet — this state carries the incident that proves it, so
  it is evidence rather than an excuse. `retired`: no longer a promise, kept
  for history. The middle state is what makes declaring honest: without it a
  promise you cannot yet keep is either hidden or a permanently red build,
  and a permanently red check stops being read (this project has switched
  two off that way).
- **The three links.** A comment at the enforcing code site naming the
  promise; a test that asserts on the trace a call produced and names the
  promise it validates; a span attribute carrying the promise's name so
  telemetry can be queried by promise.
- **Owner.** The plan that first stated the promise. A promise's owner changes
  only when another plan supersedes it.

In looper, where the writing half of this exists, the words are *expectation*
(numbered E-1 to E-11) and *failure* (F-1 to F-9). Day's shape says *promise*;
this brief says promise and incident. The ADR settles the spelling and whether
looper is renamed; the mechanism is identical.

## What changes for a project

1. **A registry** of promises and incidents, one per project, in the plan
   folder tree, with states and owners.
2. **A build check** — `indusk promises check` — that every name cited in
   code or tests exists in the registry, and every `enforced` promise has at
   least one code site and one test. A promise declared and not guarded fails
   the build. (Extracted from looper's validator, which already enforces both
   directions in its lint step.)
3. **A test helper** that asserts on the spans a call produced and requires
   the promise's name. Language-specific, so the testing extension owns it:
   looper's `assert_trace_shape` for pytest becomes the reference; the vitest
   one is written here.
4. **Promotion at plan close.** `/retrospective` asks which of the plan's
   claims are about the system rather than the change; those are written to
   the registry with the plan as owner. This is where change clauses become
   promise clauses, and it is cheap because the claim is already a behavioural
   sentence.
5. **The `monitor` state, defined.** A plan whose work is done and whose
   promises have not yet been quiet for a window sits in `monitor`; the
   lifecycle module derives it, the admin draws it (the convention from
   admin-ui-phase-progress: the plan that defines a stage renders it). Closed
   stays the resting state: a plan closes holding N promises and can be woken.
6. **A number.** `indusk promises status`: for each promise, violations in the
   window, from local Jaeger and from Dash0. "Has this promise been violated
   this week?" answers with a count.
7. **The loop closes.** A violation names the promise; the incident is opened
   or matched to an existing one; the owning plan reopens with a maintenance
   phase. The fix lands as a code site, a widened test, or a revision of the
   promise.

## How a promise changes

A promise can be **revised** (same commitment, sharper wording), **superseded**
(replaced by a different promise, owner moves to the superseding plan), or
**retired** — only by a change that names it. That is Day's artifact 9 at
review time: a change touching a promise's code site must say what it does to
the promise, and a change that touches one without naming it gets the verdict
"touched, unacknowledged". The registry keeps every promise it ever held. If a
retirement is forgotten in code, the old span mark keeps reporting and the
alert names a promise the registry says is retired: a linkage bug, caught from
the other side.

## Plans never truly finish while they hold a promise

Closed is a resting state; finished is a fact about promises. A plan closes
*holding N promises* and rests in the archive as their owner of record,
reopenable. When every promise it held has been superseded or retired it holds
none, and nothing can ever wake it. The admin shows the count on the archived
segment rather than adding a state. Over time old plans drain to "holding
none" as newer work restates the system's promises — the decay this needs,
without a ritual. The separate `subsystem` primitive proposed in June stays
rejected for the same reason the guide gives: closed must remain the resting
state or the active surface grows without bound.

## What exists today, verified 2026-09-17

| Piece | looper | numero | dusk |
|---|---|---|---|
| Registry with states, incidents with sources | **built** (11 promises, 9 incidents; none from production) | none | none |
| Validator in the build, both directions | **built** | none | none |
| Trace-shape test helper naming the promise | **built** (pytest) | none | none |
| Typed telemetry contract (every span declared, every declared span emitted) | not possible (no typechecker) | **built**, 12 services, in CI | none |
| `monitor`, reopen, violation count, production loop | none | none | `monitor` listed and drawn as pending; nothing derives it |

So looper proved the writing half, numero proved the optional typed contract,
and **nobody has proved the feedback half** — looper's own incident file says
"the first `source: production` entry is the moment the loop actually closes."
The step is done when that entry exists.

## Proving ground

**numero.** It has production, real incidents, the archive sediment (four
plans for one concern) the June brief named, and the typed contract — and no
promises. It proves adoption and the feedback half. **looper** is the
reference implementation for the writing half. **dusk** self-hosts a few
promises so the convention is shown not to depend on a service: the gates ran
at every checkoff, the boundary record is never corrupt, no test writes the
real registry — each already has a recorded incident.

## Steps

Each is independently useful; stopping after any leaves something working.

| # | Effort | What |
|---|---|---|
| 1 | ~1d | Registry format and `indusk promises check`, extracted from looper's validator; looper adopts the InDusk copy |
| 2 | ~½d | Promotion at plan close in `/retrospective`; the owner field |
| 3 | ~1d | The vitest trace-shape helper in the testing extension; looper's pytest one becomes that extension's Python half |
| 4 | ~1d | `monitor` derived and drawn; "holding N promises" on the archived segment; reopen with a maintenance phase |
| 5 | ~2d | `indusk promises status` — violations per promise from local Jaeger and Dash0 |
| 6 | ~2d | The production-to-incident loop: alert → match or open an incident → reopen the owner |
| 7 | ~1d, optional | Typed contract check generalized from numero's, for projects with a typechecker |

About 1½ weeks, distributed. The June brief's step 8 (a bloat audit of the
installed surface) is not this step's; what indusk-makeover left of it is a
"Small, not a step" candidate.

## Acceptance

Day row 9's test: **a production alert names the promise that broke; the
owning plan reopens.** Concretely, on numero: one promise with a real
incident, the alert naming it, the plan reopening — and on the change that
fixes it, the reviewer sees the promise's health as a line with a verdict.

Also: no orphan assertions (every test traces to a claim or an incident); a
fresh session can answer "what does this project promise?" from the registry;
a test that passed while production broke is detectable and treated as a
finding about the test.

## Depends on

- admin-ui-phase-progress (closed 2026-09-17): the lifecycle module with
  `monitor` reserved, and the render convention.
- The Dash0 connection working (it rejected its token on 2026-09-17).
- Day's shape document, artifact 9, for the review-time verdict.

## Resolved since the earlier brief

- **Dawn.** Day's sequencing answered it: this step comes before "any
  executor" (step 8) because it is the only loop fed from outside the repo.
  Whether `indusk run` reads the violation signal is step 8's decision, not
  this plan's.
- **Subsystems.** Stay rejected; "holding N promises" gives the durable
  ownership without the primitive.
- **Vocabulary numbering.** Readable names, not sequential ids, recommended;
  the ADR confirms and decides looper's rename.

## Open for the ADR

- Where the registry lives (`.indusk/promises/` vs the docs tree looper used).
- The span attribute name (`indusk.promise`) and whether a span may carry
  several.
- Whether the `monitor` quiet window is per plan or per promise, and its
  default length.
- Whether promotion at close is a question the retrospective asks or a
  property the test plan marks on the claim when it is written.

## Cross-references

- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) —
  `monitor`, two authorities, telemetry grades the specification
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md) — artifact 9, promise linkage
- `.indusk/planning/indusk-v2-dawn/master.md` — Dawn 7, the executor question
- looper: `apps/docs/src/telemetry/expectations.md`,
  `backend/scripts/validate_expectations.py`, `backend/looper/telemetry/shape.py`
- numero: `scripts/check-telemetry-contract.ts`
