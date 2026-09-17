---
title: "Day step 4b — Monitor: promise violation detection and root cause, from telemetry"
date: 2026-06-14
status: draft
amended: 2026-08-11
rewritten: 2026-09-17
codename: midnight
---

# Day step 4b — Monitor — Brief

**Was `midnight`.** The June brief carried both halves of the promise system.
On 2026-09-17 the primitive half — what a promise is, the registry, the
validator, promotion at close, the change rule — moved to
[`day-promises`](../day-promises/brief.md), where it belongs as part of Day's
contract. This brief is the half Midnight was always about: **the telemetry
that watches promises in the running system, detects a violation, records its
root cause, and wakes the plan that owns it.**

## What this is, in one paragraph

A promise (defined in `day-promises`) is a commitment the system keeps for as
long as it runs. The test suite can only say a promise held on the inputs
someone thought of. This step gives every promise a third link, a mark on the
telemetry span the running system emits, so that the system in use reports
which promises it upheld and which it broke. A violation names the promise;
an incident is opened or matched, with the symptom, the root cause and where
it was observed; the promise names its owning plan; that plan reopens with a
maintenance phase. The plan sits in `monitor` until its promises have been
quiet for a window, then closes again. This is the first InDusk loop fed from
outside the repository.

## Why

The three feedback loops InDusk has — the evaluator turning commits into
lessons, the falsification ritual attacking a plan's own claims, the Shape
check reviewing craft — are all closed inside the repository. They surface
only what someone thought to look at. The `versioned-workbench` retrospective
is the measurement: fourteen phases, thirty-two green rows, both rituals run,
and twelve defects within an hour of real use.

The highest-information object this loop produces is **a test that passed
while the system broke**. Every other signal says the code failed; this one
says the assertion was insufficient, and names it. Telemetry does not replace
the tests; it grades them.

| Production violates a promise, and… | What it means |
|---|---|
| a test claimed the promise and passed | the test was insufficient — widen it |
| no test claims the promise | the promise is unguarded — write one |
| there is no such promise | an invariant nobody named — state it, then guard it |

## What changes for a project

1. **The span link.** A span attribute carrying the promise's name
   (`indusk.promise`, the ADR confirms), emitted at the code site that
   enforces it. Most spans never carry one; a span opts in by naming a
   promise, so the coupling is on promises, not on telemetry.
2. **A number.** `indusk promises status`: for each promise, violations in
   the window, from local Jaeger and from Dash0. "Has this promise been
   violated this week?" answers with a count that means something.
3. **`monitor`, defined.** A plan whose work is done and whose promises have
   not yet been quiet for the window sits in `monitor`. The lifecycle module
   derives it; the admin draws it (the segment already exists, listed and
   pending, by the convention from admin-ui-phase-progress). A plan in
   `monitor` whose promises are not quiet does not close, which is the correct
   outcome and one nothing expresses today.
4. **The loop.** A violation names the promise → the incident corpus is
   checked → "known incident, here is the fix path" or a new incident is
   opened with symptom, root cause and source → the owning plan reopens with a
   maintenance phase → the fix lands as a code site, a widened test, or a
   revision of the promise. Repeated violations of related promises are the
   collapse signal that says refactor.
5. **Root cause is recorded, not inferred.** The incident record is the
   artifact; the alert only opens it. The record's `source` field
   distinguishes production from a smoke run or a desk probe, because they
   are different evidence and a reader six months on must not weight them
   equally.

## What exists today, verified 2026-09-17

None of it. Looper's incident file has nine entries, every one from a smoke
run or a desk probe, and says in its own words: "the first `source:
production` entry is the moment the loop actually closes." Numero has
production and real failures and no promises. Dusk lists `monitor` in the
lifecycle and draws it as pending; nothing derives it. Dash0, the production
telemetry, rejected its token on 2026-09-17 and must be working before step
2 above can be tested.

## Proving ground

**numero.** It is the only candidate with production. The acceptance below is
one real incident there. Looper cannot prove this half without production;
dusk's own promises (gates fired, record never corrupt, registry never leaked)
are observable in local telemetry and give the local-Jaeger path a subject.

## Steps

| # | Effort | What |
|---|---|---|
| 1 | ~½d | The span attribute convention; the code-site helper that sets it |
| 2 | ~2d | `indusk promises status` — violations per promise from local Jaeger and Dash0 |
| 3 | ~1d | `monitor` derived and drawn; the quiet window; reopen with a maintenance phase |
| 4 | ~2d | Alert → match or open an incident with root cause and source → reopen the owner |

About a week, distributed, after `day-promises` lands.

## Acceptance

Day row 9's test: **a production alert names the promise that broke; the
owning plan reopens.** Concretely, on numero: one promise with a real
incident whose `source` is production, the alert naming it, the plan
reopening, and the incident's root cause recorded. That entry is the moment
the loop closes.

## Depends on

- [`day-promises`](../day-promises/brief.md): the registry, the states, the
  owner, the first two links.
- admin-ui-phase-progress (closed 2026-09-17): `monitor` listed and drawn.
- Dash0 connected.

## Resolved since the June brief

- **Dawn.** Day's sequencing answered it: this step comes before "any
  executor" (step 8) because it is the only loop fed from outside the repo.
  Whether `indusk run` reads the violation signal is step 8's decision.
- **Subsystems.** Stay rejected; "holding N promises" (in `day-promises`)
  gives durable ownership without the primitive.
- **The bloat audit** (the June brief's step 8) is not this step's.

## Open for the ADR

- The span attribute name, and whether a span may carry several promises.
- Whether the quiet window is per plan or per promise, and its default.
- Whether an incident is opened automatically from an alert or proposed for a
  human to confirm — the root cause is a human's sentence either way.

## Cross-references

- [`day-promises`](../day-promises/brief.md) — the primitive
- [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md) —
  `monitor` is the load-bearing addition; what reopens a plan
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md) — artifact 9
- `.indusk/planning/indusk-v2-dawn/master.md` — Dawn 7, the executor question
- `.indusk/eval/` — the natural trigger surface for opening an incident automatically
