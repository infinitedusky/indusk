---
title: "Release checks run once"
date: 2026-10-08
status: accepted
workflow: feature
---

# Release checks run once — Brief

## Expectations

1. **Landing a plan and releasing it costs one run of the slow tests, not two.**
   - Measure: for the next three plans released, the system tier's runs between the landing step starting and the publish, read from the project home's record of runs: one each, against two for 1.66.0.
   - Look: when the third is published.
2. **A project that does not publish a package gets landing and release steps that apply to it.**
   - Measure: the next non-dusk project that closes a plan follows the landing and release steps without editing or skipping an instruction.
   - Look: at that project's first close.

## Promises

### This plan makes

1. **`slow-checks-run-once-per-tree`** (state). The slow test tier runs at most once for the same code: release skips it when a fully green run already covered the code it would publish, and runs it when anything that ships or tests it has changed since; a version bump and a changelog entry are not a change.
2. **`landing-and-release-name-the-projects-commands`** (structure). The landing and release steps name the commands a project declares in its config, never dusk's own paths.

### Existing promises

**Must not break**

- **`everyday-suite-stays-fast`**. Landing keeps running the everyday suite; nothing slow is added to it.
- **`everyday-tests-never-wait`**. Nothing slow moves into the everyday suite.
- **`nothing-ships-until-accepted`**. Landing still refuses a plan that has not been accepted.

**Changes**

None.

**Replaces**

None.

### Not promised

- Removing the release-time run. Plans pile into one version, so release is the only point that tests what ships; it skips only a run that would repeat a green one on the same code.
- Trusting a run from another machine. The record lives in this machine's project home.
- CI. Running the tiers on a server is a different plan.

## Depends On

- bookkeeping-lives-where-it-is-read (closed 2026-10-08, 1.66.0): the project home, where the record of a green run is kept.

## Blocks

- None.
