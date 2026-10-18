---
title: "A plan runs what must not break"
date: 2026-10-18
status: accepted
workflow: bugfix
clauses: required
description: "Each phase runs its own rows and the tests of the promises its brief says must not break, and a landing runs every row and those same tests; the tests a change merely imports are no longer run, and a promise's clauses can be changed with it."
---

# A plan runs what must not break — Brief

Found 2026-10-18 building `archived-plans-are-found`. Under
`a-plan-runs-its-tests-and-what-must-not-break` (landed with `tests-never-make-us-wait`),
each phase ran every test whose imports reach a file it changed. A phase that touched
a widely imported file ran about 100 such tests, most of which import it for
something unrelated, and the process-starting ones in one parallel batch overloaded
the machine and timed out: the phase's set went red twice on files that pass alone.
Meanwhile the few tests known to matter, those of the promises the brief lists as
Must not break, waited until landing. Sandy (2026-10-18): run the certain, cheap set
every phase; choosing tests by what each test actually executes belongs to the
sampler, which can record it as it runs.

`indusk promises change` rewrites a promise's sentence but not its clauses, so the
change needs that too.

## Expectations

1. **A phase's test set is small and passes or fails on the change, not on load.**
   - Measure: from the recorded test-set runs, files per phase and runs that fail on a file passing alone; expect tens of files at most and no load failures.
   - Look: the next three plans built.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. Landing still refuses an unaccepted plan whatever its test set.

**Changes**

- **`a-plan-runs-its-tests-and-what-must-not-break`**. While a plan is built, each phase runs the tests of the rows it writes or makes pass and the tests of the promises its brief lists as Must not break, a landing runs every row's tests and those same tests, and no other test runs. Its clauses become `its-own-tests` (each phase runs its rows' tests), `what-must-not-break` (each phase and the landing run the Must-not-break promises' tests) and `nothing-else-runs` (no other test runs while a plan is built or landed); `what-its-changes-reach` goes.

**Replaces**

None.

### Not promised

- **Choosing tests by what each test executes** — `the-sampler` records per-test coverage as it runs and hands it to the test set later.
- **A clause plan for promises that only change** — the change carries its clauses; it adds no new promise.

## Looks

None — command behaviour only.

## Depends On

- None.

## Blocks

- `the-sampler` — it takes over choosing tests by what they execute.
