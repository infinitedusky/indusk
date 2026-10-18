---
title: "Tests never make us wait"
date: 2026-10-17
status: draft
workflow: feature
clauses: required
description: "While a plan is built, it runs the tests it writes and the tests of what its brief says must not break, and a visual test checks only the looks that changed; every other test runs behind the scenes, oldest first, and what it finds is reported as found by the sampler."
---

# Tests never make us wait — Brief

The first step of [promise-core](../promise-core/master.md)'s next run, before
`mark-first` (Sandy, 2026-10-17). What runs today, where the time goes and what was
decided are in [research.md](research.md).

## Expectations

1. **Work stops waiting on tests.**
   - Measure: how long each phase's checks take and how long `pnpm test` takes, in the
     plans built after this lands; expect seconds per phase and the suite under a minute
     (150 s on 2026-10-17).
   - Look: across the first three plans built after this lands.

2. **The sampler finds a break before anyone else does.**
   - Measure: of the breaks found on merged code, the share the sampler found before a
     person or production telemetry did.
   - Look: 30 days after this lands.

## Promises

### This plan makes

1. **`a-plan-runs-its-tests-and-what-must-not-break`** (state). While a plan is built, it runs the tests it writes and the tests of the promises its brief lists as Must not break, and no other test.
   - **`its-own-tests`** (split). Each phase runs the tests of the rows it writes or changes.
   - **`what-must-not-break`** (split). The tests of every promise the brief lists as Must not break run at landing, and at each phase whose changes reach them.
   - **`nothing-else-runs`** (limit). No test outside those two runs while a plan is built or landed.

2. **`a-look-check-runs-what-changed`** (state). A visual test checks only the looks a change touched.
   - **`the-changed-looks`** (split). A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for.
   - **`no-other-look`** (limit). A look the change did not touch is not checked while the plan is built.

3. **`the-sampler-runs-the-oldest-tests-first`** (state). Every test and every look check records when it last ran and what it returned, and behind the scenes the sampler periodically runs those that failed most recently, then those that ran longest ago.
   - **`each-run-is-recorded`** (split). Every run of a test or a look check, by a plan, a person or the sampler, records when it ran, at which commit, and whether it passed.
   - **`failed-then-oldest`** (split). Each sampler run takes the tests and look checks that failed most recently first, then those that ran longest ago.
   - **`a-flake-breaks-nothing`** (limit). A test that fails for the sampler and passes when run once more is noted as a flake and breaks nothing.
   - **`found-by-the-sampler`** (split). A failure the sampler finds breaks the promise its test names, and says it was found by the sampler.
   - **`never-waited-on`** (limit). Nothing waits on the sampler: no phase, landing, acceptance or release.

### Existing promises

**Must not break**

- **`the-everyday-suite-passes-on-main`**. The suite still passes on a clean main once the slow files leave it.
- **`a-plan-is-approved-with-its-looks-approved`**. A person still approves each look a brief names; only the automated comparison changes.

**Changes**

- **`everyday-tests-never-wait`**. The everyday suite never starts a server, a process, the command line, a git repository or a workbench, and never waits on the wall clock; such a test runs when a plan's rows name it or when the sampler reaches it.

**Replaces**

- **`a-look-check-costs-what-changed`**, by **`a-look-check-runs-what-changed`**.
- **`everyday-suite-stays-fast`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.
- **`slow-checks-run-once-per-tree`**, by **`the-sampler-runs-the-oldest-tests-first`**.
- **`a-failing-slow-test-breaks-its-promise`**, by **`the-sampler-runs-the-oldest-tests-first`**.

### Not promised

- **A time for the suite or a phase.** That is the first expectation, met by degree.
- **A clause's break running that clause's tests** — `a-break-runs-its-tests`, after `mark-first`.
- **Finding the commit that broke a test** — `a-break-runs-its-tests`; this plan records the commit on every run so that search can be made.
- **A page listing each test with its last run** — later, if wanted; the runs it would show are recorded from now on.
- **Landing through pull requests, a break pinned to one author** — later, once InDusk has users or a team.
- **Agents that use the app to make telemetry on paths nobody has walked** — future, not planned.

## Looks

None — a sampler failure reaches the person as a break of its promise, through the activity and the promise's page as any break does today, with the sampler as its source; no screen is laid out differently.

## Depends On

- None.

## Blocks

- `.indusk/planning/mark-first/` — after this, by Sandy's order (2026-10-17).
- `.indusk/planning/a-break-runs-its-tests/` — the second half of this.
