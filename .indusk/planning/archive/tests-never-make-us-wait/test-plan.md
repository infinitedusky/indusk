---
title: "Tests never make us wait — Test Plan"
date: 2026-10-17
status: accepted
---

# Tests never make us wait — Test Plan

## Purpose

The behavioural assertions that, together, mean a plan runs only its own tests, the
tests its changes reach and the tests of what it must not break, and that a visual test
checks only the looks a change touched. Grouped by promise and clause; each names the
smallest level that proves it.

## `a-plan-runs-its-tests-and-what-must-not-break`

While a plan is built, it runs the tests it writes, the tests its changes reach and the
tests of the promises its brief lists as Must not break, and no other test.

### `its-own-tests` — Each phase runs the tests of the rows it writes or changes.

- Signal: the test set `indusk plans tests` prints for a phase; upheld when it names
  every test file of the rows written or passing at that phase; broken reports the row
  whose file is missing.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | The tests a plan runs at a phase include the test file of every row that phase writes or makes pass, and no row's file from a phase not yet reached. | unit |

### `what-its-changes-reach` — Each phase runs the tests whose imports reach the files it changed.

- Signal: the same set; upheld when a changed source file's importing tests are in it;
  broken names the changed file whose tests are missing.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | A phase that changed a source file runs the tests whose imports reach that file, in each package the phase changed. | unit |
| A3 | Vitest still names the test files whose imports reach a given source file the way the plan's test set reads it. | contract |

### `what-must-not-break` — The tests of every promise the brief lists as Must not break run at landing.

- Signal: the landing set; upheld when it holds every Must-not-break promise's registry
  tests; broken names the promise.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | At landing, the tests a plan runs include the tests of every promise its brief lists as Must not break, with the plan's own rows' tests and the tests its changes reach. | unit |
| A5 | A Must-not-break promise whose registry entry names no test is named as having none, not left out silently. | unit |

### `nothing-else-runs` — No other test runs while a plan is built or landed.

- Signal: the skills and the landing command; upheld when nothing a plan runs asks for
  the whole suite or the slow tier; broken names the file and line that does.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | The tests a plan runs at landing hold nothing outside its rows, what its changes reach and its Must-not-break promises. | unit |
| A7 | The work, verify and retrospective skills tell a plan to run its test set, and never the whole suite or the slow tier, at a phase or at landing. | unit |

## `a-look-check-runs-what-changed`

A visual test checks only the looks a change touched.

### `the-changed-looks` — A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for.

- Signal: what `indusk looks check --changed <ref>` opens; upheld when every touched
  look is opened; broken names the touched look it reused.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A change to a page's file touches the screens drawn from that page, and no other screen. | unit |
| A9 | A change to a component touches its stories and the screens whose pages import it. | unit |
| A10 | A change to the app's design foundation touches every look of the app. | unit |
| A11 | A look check of what changed opens each touched look on every device that look is drawn for. | unit |

### `no-other-look` — A look the change did not touch is not checked while the plan is built.

- Signal: the same check; upheld when an untouched look is reused from its last held
  result; broken names the untouched look it opened.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | A look check of what changed reuses every look the change did not touch, whatever else about the app changed. | unit |

## `everyday-tests-never-wait` (changes)

The everyday suite never starts a server, a process, the command line, a git
repository or a workbench, and never waits on the wall clock; such a test runs when a
plan's rows name it or its changes reach it, and in the release's tests.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | An everyday test file that starts InDusk's command line, git or another Node process is refused by the guard, naming the file, line and call; the same file in the system tier is not. | unit |

## Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A14 | Every test file this repository holds that starts the command line, git or another Node process is in its package's system tier. | unit | the move itself; the guard of A13 run over the repository |

## Notes

- The suite's time is the brief's expectation, read from the existing suite-speed
  record, not a row.
- The everyday suite still runs when a person runs `pnpm test`; nothing in a plan does.
