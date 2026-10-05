---
title: "The planner asks for promises — Test Plan"
date: 2026-10-05
status: accepted
---

# Planner promises — Test Plan

## Purpose

How each promise in the [brief](brief.md) is proven. Every assertion sits
under what it is for: a promise this plan makes, a promise already in force,
or neither, with the reason. That is the rule this plan builds, applied to
itself.

Each assertion names its level, the smallest kind of test that can prove it:
`unit` runs in the phase that writes it; `live check` runs once, against the
real system, and is recorded in the plan.

## Proves `a-briefs-promises-are-in-the-registry`

| ID | Assertion | Level |
|----|-----------|-------|
| A1 | A promise written from a planning conversation is in the registry as `declared`, owned by its plan, with the sentence the person approved, and the registry check passes. | unit |
| A2 | In a project that has declared no domains, writing its first promise declares that promise's domain with it, and the check passes. | unit |
| A3 | A plan cannot start building while its brief names, among the promises it makes, one that the registry does not hold or that another plan owns. The refusal names the promise. | unit |
| A4 | A plan cannot start building while its brief lists, among the promises it must not break, changes or replaces, one that does not exist or is already retired. The refusal names it. | unit |

## Proves `every-test-says-what-it-is-for`

| ID | Assertion | Level |
|----|-----------|-------|
| A5 | An impl whose every test row names a promise, names a lesson, or gives a reason is accepted. One with a row that does none of these is refused, naming the row. | unit |
| A6 | A row that names a promise the registry does not hold, a retired promise, or a lesson that does not exist is refused, naming it. | unit |
| A7 | A plan's page in the admin shows, for each test row, what it is for. | unit |

## Proves `a-closed-plan-kept-its-promises`

| ID | Assertion | Level |
|----|-----------|-------|
| A8 | A plan holding a declared promise that no passing row names cannot close. The refusal names the promise. | unit |
| A9 | Closing a plan whose promises are each named by a passing row moves them to `enforced`, and the registry check then passes. | unit |
| A10 | A plan that made no promise closes as it did before. | unit |
| A11 | In a workbench, where a plan's tests exist only in a repository's worktree until it lands, the plan still closes with its promises confirmed. | unit |

## Proves `an-incident-names-its-tests`

| ID | Assertion | Level |
|----|-----------|-------|
| A12 | When a promise breaks, its incident names every test row that proves it: the plan, the row, and whether the row is passing. | unit |
| A13 | The row added to a plan that an incident reopens names the promise that broke and has a level, and the plan's impl still validates. Red today for an impl that requires levels ([research](research.md), finding 4). | unit |

## Proves `an-expectation-says-how-it-is-measured`

| ID | Assertion | Level |
|----|-----------|-------|
| A14 | A plan cannot start building while an expectation in its brief has no measure or no time to look. The refusal names the expectation. | unit |
| A15 | A brief that says it has no expectations, with the reason, is accepted. | unit |

## Proves `a-changed-promise-keeps-its-history`

| ID | Assertion | Level |
|----|-----------|-------|
| A24 | A test row that names a promise another plan owns is refused unless the brief lists that promise under must not break, changes or replaces. | unit |
| A25 | When a plan that changes a promise closes, the promise has its new sentence and is owned by that plan, and its History shows the old sentence, the reason and the plan that owned it before. Its incidents and the marks in code that name it still resolve. | unit |
| A26 | When a plan that replaces a promise closes, the old one is retired, the new one records which it replaced, and the registry check passes. A replacement that names a promise which does not exist is refused. | unit |
| A27 | A changed promise that breaks later reopens the plan that changed it, and its incident lists the rows that name it in both plans. | unit |

## Guards promises already in force

| ID | Assertion | For | Level |
|----|-----------|-----|-------|
| A16 | The hooks' copy of the test levels equals the package's list, and the hooks' row parser reads the new column exactly as the package's does. | `one-definition-per-shared-rule` | unit |
| A17 | With this plan's tests added, no everyday test starts a server or waits, and a full `pnpm test` is still marked held. | `everyday-tests-never-wait`, `everyday-suite-stays-fast` | unit for the guard; live check at close for the run |

`gates-ran-at-every-checkoff` gets no new assertion: its existing tests must
still pass with the changed hook, and each phase's verification runs them.

## For no promise

| ID | Assertion | Why it needs none | Level |
|----|-----------|-------------------|-------|
| A18 | Every impl and every brief written before this plan is accepted exactly as it was. | A regression guard over the documents already in this repository and in other projects. | unit |
| A19 | A new impl names each test's level under `Level`. The archived test-kinds impl, which says `Kind`, still validates. | A rename decided 2026-10-05; the assertion keeps the old spelling working. | unit |
| A20 | The planner's brief template has Expectations and Promises, and no Problem, Proposed Direction or Success Criteria. | Pins the template every new plan is handed. | unit |
| A21 | A bugfix or refactor plan may carry a research document, and is not marked incomplete without one. | The why left the brief, so a plan with no research document needs somewhere to put it. | unit |

## Live checks

| ID | Assertion | Level |
|----|-----------|-------|
| A22 | This plan's own six promises go the whole way: written as `declared` before its first test, named by this plan's rows, and `enforced` when it closes. | live check, recorded at close |
| A23 | In a new scratch project, a planning conversation ends with declared promises in the registry and a brief that names them, and nobody typed a registry file. | live check, once, recorded |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The planner holds the conversation well: it draws out what the person wants, reads the promises back, and takes corrections. | It is an agent following prose. | A23 checks the outcome once; the brief's first expectation measures it over five plans; the demo rehearsal runs it on camera. |
| U2 | The agent notices every existing promise a new plan affects. | No code exists at planning time to check against; it is a reading of sentences. | The affected promise's own tests fail if it is broken, so the plan cannot close green; a row that names it forces the brief to address it (A24); `day-contract` later flags code that touches its site unnamed. |

## Notes

- This plan's six promises are written to the registry in its first phase,
  not at brief acceptance. This repository has a test
  (`promises-cli.test.ts`, "every promise enforced or known-violated") that a
  `declared` promise turns red, and a test cannot change on the trunk. The
  promises and that test's correction land in one commit.
- The expectations in the brief are not tested here. They are measured later,
  and a miss is not a failure.
