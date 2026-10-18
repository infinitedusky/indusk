---
title: "Tests never make us wait"
date: 2026-10-17
status: accepted
workflow: feature
clauses: required
description: "While a plan is built, it runs the tests it writes, the tests its changes reach and the tests of what its brief says must not break, and a visual test checks only the looks that changed; nothing else runs."
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
   - **`nothing-else-runs`** (limit). No other test runs while a plan is built or landed.

2. **`a-look-check-runs-what-changed`** (state). A visual test checks only the looks a change touched.
   - **`the-changed-looks`** (split). A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for.
   - **`no-other-look`** (limit). A look the change did not touch is not checked while the plan is built.

### Existing promises

**Must not break**

- **`the-everyday-suite-passes-on-main`**. The suite still passes on a clean main once the slow files leave it.
- **`a-plan-is-approved-with-its-looks-approved`**. A person still approves each look a brief names; only the automated comparison changes.

**Changes**

- **`everyday-tests-never-wait`**. The everyday suite never starts a server, a process, the command line, a git repository or a workbench, and never waits on the wall clock; such a test runs when a plan's rows name it or its changes reach it, and in the release's tests.

**Replaces**

- **`a-look-check-costs-what-changed`**, by **`a-look-check-runs-what-changed`**.
- **`everyday-suite-stays-fast`**, by **`a-plan-runs-its-tests-and-what-must-not-break`**.

### Not promised

- **A time for the suite or a phase.** That is the first expectation, met by degree.
- **The sampler** — every run recorded with its commit, the rest of the tests and looks run behind the scenes, recently failed then oldest first, a flake re-run once, a failure reported as a break found by the sampler — the next plan, `the-sampler`. Until it lands, a test no plan names or reaches does not run.
- **The release's tests.** They still run after a publish, blocking nothing, until `the-sampler` replaces them.
- **The Testing and telemetry approach section.** This plan documents what it builds the usual way; a documentation plan at the end of this run builds the section, a content page that explains the whole approach.
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
