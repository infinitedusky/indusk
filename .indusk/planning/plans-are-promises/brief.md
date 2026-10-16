---
title: "Plans are promises"
date: 2026-10-16
status: accepted
workflow: feature
description: "A plan makes one or more promises, each stated as clauses — splits on the way to its goal and limits that always hold — and each promise's clause plan, written before the ADR in place of a test plan, names every clause's signal and the tests tied to it."
---

# Plans are promises — Brief

What a plan is, settled with Sandy on 2026-10-14/15 and revised on 2026-10-16
(`promise-core`'s master, "Settled 2026-10-14/15": *A plan holds the promises
it lands*). The 2026-10-15 version of this brief made a plan one promise; on
2026-10-16 Sandy found that a promise and a plan are different things — a
promise is permanent, a plan is a unit of work that ends — so a plan now holds
the promises that land together. Second of the three plans that split
`mark-first`'s first cut; it gives the brief, the registry and the planner a
way to hold clauses, which `mark-first` and `run-the-master` both build on.

## Expectations

1. **Plans are written as promises of clauses.**
   - Measure: of plans whose brief is accepted after this lands, the share whose every promise is stated as clauses, each clause with a signal, read from their briefs.
   - Look: after the first five such plans.

## Promises

### This plan makes

1. **`a-plan-holds-the-promises-it-lands`** (state). A plan makes one or more promises, each stated as clauses, and is done when every clause of every promise it holds is proved.

Its clauses — written here as prose until this plan teaches the brief to hold
clauses: **a promise is made of clauses** — splits, each a point reached within
its budget on the way to the promise's goal, and limits, each a bound that
always holds, each clause named and with its own signal and the tests tied to
it; **each promise has its clause plan** — in place of a test plan, written
before the ADR so done is fixed before how to build is decided, naming each
clause's signal (where it is read, what counts as upheld, what it reports when
broken) and the tests tied to that clause, which the agents choose and keep;
**a promise can rest on another** — a clause can be another promise, of the
part beneath it, and its health is that promise's health; **promises that land
together share a plan** — promises whose work shares code are one plan, and
promises that share none are separate plans under a master; the planner
suggests the split and the person decides (Sandy, 2026-10-16); **older plans
stand** — a plan written before clauses keeps its promises and closes as it
did.

### Existing promises

**Must not break**

- **`every-test-says-what-it-is-for`**. A test row still says what it is for — a clause of one of the plan's promises, a lesson, or why it needs neither; a row naming a clause names the promise it belongs to.
- **`a-closed-plan-kept-its-promises`**. A plan written before clauses still closes on passing tests that name its promises.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Proving a clause** — verified before release and upheld by its signal — is `mark-first`'s.
- **Splitting a plan automatically**; the planner suggests a split, the person decides.
- **Running phases as a graph** — a branch per phase, earlier plans first, merges at phase start — is `run-the-master`'s. This plan only lets a test row name the clause it proves, which that graph reads.
- **One promise per plan** — the 2026-10-15 rule, withdrawn 2026-10-16 with its promise `a-plan-is-one-promise`, never in force.

## Looks

None — the first cut changes the plan documents and the registry, not a screen; the plan page shows each promise's clause plan where it showed the test plan, in the same layout.

## Depends On

- `.indusk/planning/archive/one-promise-language/` — the words.

## Blocks

- `.indusk/planning/mark-first/` — a clause must exist before it can be proved.
- `run-the-master` — it reads plans as promises of clauses.
