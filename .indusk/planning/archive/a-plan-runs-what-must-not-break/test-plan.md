---
title: "A plan runs what must not break — Test Plan"
date: 2026-10-18
status: accepted
---

# A plan runs what must not break — Test Plan

## `a-plan-runs-its-tests-and-what-must-not-break` (changes)

While a plan is built, each phase runs the tests of the rows it writes or makes pass and the tests of the promises its brief lists as Must not break, a landing runs every row's tests and those same tests, and no other test runs.

### `its-own-tests` — Each phase runs the tests of the rows it writes or makes pass.

- Signal: the set `indusk plans tests` prints for a phase; upheld when it names each of the phase's rows' files.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A phase's tests are the files of the rows it writes or makes pass and the tests of the brief's Must-not-break promises, and nothing a change merely imports. | unit |

### `what-must-not-break` — Each phase and the landing run the tests of the promises the brief lists as Must not break.

- Signal: the same set, at a phase and at landing; upheld when every Must-not-break promise's tests are in it.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | A landing's tests are every row's files and the Must-not-break promises' tests, and nothing a change merely imports. | unit |

### `nothing-else-runs` — No other test runs while a plan is built or landed.

- Signal: the plan tests command and the skills; upheld when no search for tests a change imports is run and no skill asks for one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | Running a plan's tests starts no search for the tests its changed files reach. | unit |
| A4 | The work, verify and retrospective skills say a phase runs its rows and its Must-not-break tests, and never mention tests a change reaches. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A5 | Changing a promise can replace its clauses, and the registry then holds the new clauses and not the old. | unit | the means of this change: `promises change` could rewrite only a sentence |
