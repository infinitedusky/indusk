---
title: "Plans are promises"
date: 2026-10-15
status: accepted
workflow: feature
description: "A plan makes one promise, stated as clauses — splits on the way to its goal and limits that always hold — and its clause plan, in place of a test plan, names each clause's signal and the tests tied to it."
---

# Plans are promises — Brief

What a plan is, settled with Sandy on 2026-10-14/15 (`promise-core`'s master,
"Settled 2026-10-14/15" — merged from `mark-first` and `promise-first-build`).
Second of the three plans that split the merged `mark-first`'s first cut; it
gives the brief, the registry and the planner a way to hold clauses, which
`mark-first` and `run-the-master` both build on.

## Expectations

1. **Plans are written as one promise of clauses.**
   - Measure: of plans whose brief is accepted after this lands, the share stating one promise as clauses, each clause with a signal, read from their briefs.
   - Look: after the first five such plans.

## Promises

### This plan makes

1. **`a-plan-is-one-promise`** (state). A plan makes one promise, stated as clauses, and is done when every clause is proved.

Its clauses — written here as prose until this plan teaches the brief to hold
clauses: **a promise is made of clauses** — splits, each a point reached within
its budget on the way to the promise's goal, and limits, each a bound that
always holds, each clause named and with its own signal and the tests tied to
it; **a plan plans its clauses** — in place of a test plan, a plan's clause
plan names each clause's signal (where it is read, what counts as upheld, what
it reports when broken) and the tests tied to that clause, which the agents
choose and keep; **a promise can rest on another** — a clause can be another
promise, of the part beneath it, and its health is that promise's health;
**not forced into one** — a plan whose work makes more than one honest promise
is split into plans, never squeezed under one (Sandy, 2026-10-15); **older
plans stand** — a plan written before clauses keeps its promises and closes as
it did.

### Existing promises

**Must not break**

- **`every-test-says-what-it-is-for`**. A test row still says what it is for — a clause of the plan's promise, a lesson, or why it needs neither.
- **`a-closed-plan-kept-its-promises`**. A plan written before clauses still closes on passing tests that name its promises.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Proving a clause** — verified before release and upheld by its signal — is `mark-first`'s.
- **Splitting a plan automatically**; the planner suggests a split, the person decides.

## Looks

None — the first cut changes the plan documents and the registry, not a screen; the plan page shows the clause plan where it showed the test plan, in the same layout.

## Depends On

- `.indusk/planning/one-promise-language/` — the words.

## Blocks

- `.indusk/planning/mark-first/` — a clause must exist before it can be proved.
- `run-the-master` — it reads plans as promises of clauses.
