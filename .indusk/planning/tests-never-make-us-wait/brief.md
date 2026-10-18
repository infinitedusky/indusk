---
title: "Tests never make us wait"
date: 2026-10-17
status: draft
workflow: feature
clauses: required
description: "While a plan is built, it runs the tests it writes, the tests its changes reach and the tests of what its brief says must not break, and a visual test checks only the looks that changed; nothing else runs, and the docs' Testing and telemetry approach section gains its testing step."
---

# Tests never make us wait — Brief

The first step of [promise-core](../promise-core/master.md)'s next run, before
`mark-first` (Sandy, 2026-10-17). What runs today, where the time goes and what was
decided are in [research.md](research.md). The sampler, which runs everything else
behind the scenes, is the next plan; this one only narrows what runs.

## Expectations

1. **Work stops waiting on tests.**
   - Measure: how long each phase's checks take and how long `pnpm test` takes, in the
     plans built after this lands; expect seconds per phase and the suite under a minute
     (150 s on 2026-10-17).
   - Look: across the first three plans built after this lands.

## Promises

### This plan makes

1. **`a-plan-runs-its-tests-and-what-must-not-break`** (state). While a plan is built, it runs the tests it writes, the tests its changes reach and the tests of the promises its brief lists as Must not break, and no other test.
   - **`its-own-tests`** (split). Each phase runs the tests of the rows it writes or changes.
   - **`what-its-changes-reach`** (split). Each phase runs the tests whose imports reach the files it changed.
   - **`what-must-not-break`** (split). The tests of every promise the brief lists as Must not break run at landing.
   - **`nothing-else-runs`** (limit). No other test runs while a plan is built, landed or released.

2. **`a-look-check-runs-what-changed`** (state). A visual test checks only the looks a change touched.
   - **`the-changed-looks`** (split). A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for.
   - **`no-other-look`** (limit). A look the change did not touch is not checked while the plan is built.

3. **`testing-has-its-step-in-the-approach`** (structure). The docs' Testing and telemetry approach section is a list of steps that together form the approach, its testing step says what runs while a plan is built and how a failure reaches the person, and every other place that speaks of testing agrees with it and links it.
   - **`the-testing-step`** (split). The testing step says what a plan runs at each moment, what a visual test checks, and how a failure reaches the person, from what InDusk does today and where it is going.
   - **`the-rest-points-to-it`** (split). Every skill, context file, docs page, lesson and command's help that speaks of testing says only what it needs and links the step for the rest.
   - **`nothing-describes-what-is-gone`** (limit). Nothing outside the archive and the changelog describes a slow tier, a release test or a slow test's incident as something that runs.

### Existing promises

**Must not break**

- **`the-everyday-suite-passes-on-main`**. The suite still passes on a clean main once the slow files leave it.
- **`a-plan-is-approved-with-its-looks-approved`**. A person still approves each look a brief names; only the automated comparison changes.

**Changes**

- **`a-release-runs-as-its-project-declares`**. `indusk release` runs a project's declared release and reports it done when the config's completion condition holds, for any project that declares one; it runs no tests.
- **`dusk-installs-its-own-build`**. After a plan lands, this machine's `indusk` is the landed build, installed from the checkout without a publish; publishing is a deliberate act.
- **`everyday-tests-never-wait`**. The everyday suite never starts a server, a process, the command line, a git repository or a workbench, and never waits on the wall clock; such a test runs when a plan's rows name it or its changes reach it.

**Replaces**

- **`a-look-check-costs-what-changed`**, by **`a-look-check-runs-what-changed`**.
- **`everyday-suite-stays-fast`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.
- **`slow-checks-run-once-per-tree`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.
- **`a-failing-slow-test-breaks-its-promise`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.
- **`a-failure-is-read-from-the-report`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.

### Not promised

- **A time for the suite or a phase.** That is the first expectation, met by degree.
- **The sampler** — every run recorded with its commit, the rest of the tests and looks run behind the scenes, recently failed then oldest first, a flake re-run once, a failure reported as a break found by the sampler — the next plan, `the-sampler`. Until it lands, a test no plan names or reaches does not run.
- **The article on the philosophy that opens the Testing and telemetry approach section** — Sandy's, written alongside, not part of this plan.
- **The section's other steps** (telemetry, the sampler, a break running its tests) — added by `mark-first`, `the-sampler` and `a-break-runs-its-tests`, each to the same section.
- **A clause's break running that clause's tests, and finding the commit that broke a test** — `a-break-runs-its-tests`.
- **Landing through pull requests, a break pinned to one author** — later, once InDusk has users or a team.

## Looks

None — a failing test reaches the person in the phase or landing that runs it, as today; no screen is laid out differently.

## Depends On

- None.

## Blocks

- `the-sampler` — the next plan, not yet started: it runs the tests this plan stops running.
- `.indusk/planning/mark-first/` — after this, by Sandy's order (2026-10-17).
- `.indusk/planning/a-break-runs-its-tests/` — after `the-sampler` and `mark-first`.
