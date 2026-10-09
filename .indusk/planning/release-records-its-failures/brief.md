---
title: "release-records-its-failures"
date: 2026-10-09
status: accepted
workflow: feature
---

# release-records-its-failures — Brief

## Expectations

1. **A release publishes on its first run.**
   - Measure: releases whose first `indusk release` published, against all releases, read from the release record over the next five releases (today: 0 of the last 4).
   - Look: after the fifth release from now.

2. **What a release finds gets fixed rather than re-run.**
   - Measure: each incident and bugfix plan a release opened, and how long until it was fixed, read from `promise_health`'s incident ages and the plans' close dates.
   - Look: a week after each release.

## Promises

### This plan makes

1. **`a-release-runs-as-its-project-declares`** (state). `indusk release` runs a project's declared release with its slow tests before or after the publish as the config says, and reports the release done when the config's completion condition holds, for any project that declares one.

2. **`a-failure-is-read-from-the-report`** (state). Which tests failed is read from the test report the project declares, never from the runner's printed output, and a run with no readable report says the slow tests failed without naming a test.

3. **`a-flake-opens-nothing`** (state). A test that fails and then passes when its file is run once more is listed as a flake on the release's record and opens no incident and no plan.

4. **`a-failing-slow-test-breaks-its-promise`** (state). A test still failing after its rerun opens an incident on the promise its plan's row names, or adds to that promise's open incident, and the incident names the test, the release and the commits since the last green run.

5. **`an-unclaimed-failure-opens-a-bugfix-plan`** (state). A test still failing after its rerun that no row's promise claims opens one draft bugfix plan for its file, naming the commits since the last green run, and a later failure of the same file reuses that plan while it is open.

### Existing promises

**Must not break**

- **`slow-checks-run-once-per-tree`**. The release still skips a slow run a fully green run already covered.
- **`landing-and-release-name-the-projects-commands`**. The release runs the commands the project declares, never dusk's own paths.
- **`an-incident-names-its-tests`**. An incident a release opens names its tests like any other.
- **`an-open-incident-stays-loud`**. An incident a release opens shows in catchup, `promise_health`, `promises status` and the admin like any other.
- **`a-release-ships-only-its-own-source`**. The publish this plan reorders still ships only the repository's source.

**Changes**

- **`dusk-installs-its-own-build`**. After a plan lands, this machine's `indusk` is the landed build, installed from the checkout without a publish; publishing is a deliberate act whose slow tests run after it, and what they find is recorded.

**Replaces**

None.

### Not promised

- Slow tests after landing: the same declaration, in a follow-up plan (Sandy, 2026-10-09).
- A pipeline runner (stages, caching, parallel jobs, retries beyond the one rerun): `act`, Dagger and Earthly exist; this plan orders declared steps and routes their failures.
- Reports from an outside CI (GitHub Actions) feeding the same routing: the design does not block it; a later plan.
- Adding `For` and `Test` cells to archived plans' rows, so more failures reach a promise: a separate backfill plan.
- Fixing today's three regressions (`always-on-health-tool` A20, `http-promise-remote` A17, `http-promise-timeline-sources` A9): a bugfix before 1.69.0 publishes, outside this plan.

## Depends On

- `.indusk/planning/archive/release-checks-run-once/` — `workflow.steps`, `indusk checks slow`, the green-run record.
- `.indusk/planning/archive/incident-recording/` — incidents and the reopened plan's Maintenance phase.

## Blocks

- The landing follow-up (slow tests after the merge).
