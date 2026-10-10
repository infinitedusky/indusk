---
title: "release-records-its-failures — Test Plan"
date: 2026-10-09
status: accepted
---

# release-records-its-failures — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean a release runs as its project declares and what its slow tests find is recorded instead of stopping it. Each assertion names its level — the smallest that can prove it — and they are grouped by the promise in the brief they prove. They become the impl's Test Trajectory rows.

Most assertions are `unit`: the release's order, its completion, and the routing of a failure are rules, and a rule is tested by feeding it inputs — fake commands that exit as told, a JUnit report written by the test, a fixture repository with trajectory rows. Nothing in the everyday suite publishes, waits on a real slow run, or talks to npm.

## Behavioral Assertions

### `a-release-runs-as-its-project-declares` — `indusk release` runs a project's declared release with its slow tests before or after the publish as the config says, and reports the release done when the config's completion condition holds, for any project that declares one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | With slow tests declared `after`, the release command runs first and the slow tests second; when the slow tests go red, the release still reports itself done under `done_when: published` and lists what it recorded | unit |
| A2 | With slow tests declared `before`, a red slow run stops the release before its command runs, the release reports not published, and the failures are still recorded | unit |
| A3 | With `done_when: green` and slow tests `after`, a red slow run reports the release published but not done, naming the open failures | unit |
| A4 | A release command that fails reports the release not published and runs no slow tests after it | unit |
| A5 | A project that declares no release says so and runs nothing | unit |

### `a-failure-is-read-from-the-report` — which tests failed is read from the test report the project declares, never from the runner's printed output, and a run with no readable report says the slow tests failed without naming a test.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | The tests recorded as failing are exactly the ones the declared JUnit report marks failed, whatever the command printed, and a report spread over several files (one per package) is read as one | unit |
| A7 | A red run whose report is missing or unreadable reports "the slow tests failed" with no test named, and opens no incident and no plan | unit |
| A8 | dusk's slow tests, run with its declared reporter, write a JUnit report whose failed cases name the test files that failed | contract |

### `a-flake-opens-nothing` — a test that fails and then passes when its file is run once more is listed as a flake on the release's record and opens no incident and no plan.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | A file that fails and then passes on its rerun appears on the release's record as a flake and opens nothing | unit |
| A10 | Only the failing files are run again, and only once; a file still failing after its rerun is recorded as failing | unit |

### `a-failing-slow-test-breaks-its-promise` — a test still failing after its rerun opens an incident on the promise its plan's row names, or adds to that promise's open incident, and the incident names the test, the release and the commits since the last green run.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A failing file named by a row whose `For` names a promise opens an incident on that promise, naming the test, the release version and the commits since the last green slow run | unit |
| A12 | The same file failing in a later release adds to the open incident rather than opening a second | unit |
| A13 | The incident reopens the promise's owning plan with its Maintenance phase and names the rows that were proving it, as an incident from a watcher does | unit |
| A14 | The incident shows in `promises status` and `promise_health` with its age, ahead of the roadmap, as any open incident does | unit |

### `an-unclaimed-failure-opens-a-bugfix-plan` — a test still failing after its rerun that no row's promise claims opens one draft bugfix plan for its file, naming the commits since the last green run, and a later failure of the same file reuses that plan while it is open.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | A failing file no row names opens one draft bugfix plan whose brief names the file, the failing tests, the release and the commits since the last green slow run | unit |
| A16 | A failing file named by a row with no promise opens a draft bugfix plan that also names the plan and row that were testing it | unit |
| A17 | The same file failing in a later release while its bugfix plan is open adds to that plan rather than opening another | unit |
| A22 | A run where more than half the slow test files failed opens no incident and no plan, and the release says the environment failed, naming how many files failed | unit |

### `dusk-installs-its-own-build` (changes) — publishing is a deliberate act whose slow tests run after it, and what they find is recorded.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | dusk's release command no longer runs the slow tests before publishing, and dusk's config declares them `after` with a JUnit report | unit |
| A19 | A real dusk release through `indusk release` publishes, then runs the slow tests and prints what it recorded | live check |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A20 | A release whose slow run a green run already covered skips it, as before | unit | a regression guard over `slow-checks-run-once-per-tree` |
| A21 | A non-npm release command declared by a fixture project (a shell command writing a file) is the command that runs | unit | a regression guard over `landing-and-release-name-the-projects-commands`, and the "generic, not npm-only" decision |

## Notes

- A19 is the only assertion that publishes. It is recorded once, against a real release, with its output.
- A8 is `contract` because the question is about vitest, which dusk does not own: does its JUnit reporter still name failing files the way the reader expects. It runs in the system tier.
- A22 was added with the ADR's environment rule (2026-10-10); promises 4 and 5 were re-declared to say it.
- Rerun (A10) is per file, not per test: a test name is not a portable rerun target across runners, a file is.
