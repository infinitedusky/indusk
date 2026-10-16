---
title: "Signal first — Test Plan"
date: 2026-10-16
status: draft
---

# Signal first — Test Plan

## Purpose

This is the clause plan: one section for each promise this plan makes, one for each of its clauses, each with its signal (where it is read, what counts as upheld, what it reports when broken) and the assertions that prove it before release. Each assertion names its level, the smallest that can prove it. Rows in the impl derive from these; the signal is what proves the clause in use, and is read by the mark this plan teaches clauses to carry.

Written after `plans-are-promises` landed, so the clause plan itself is in the shape that plan made: a promise, its clauses, each clause's signal and tests.

## `a-clause-is-proved-twice`

A clause is verified by its tests before release and upheld by its signal in use, and is upheld only when both say so.

### `verified-before-release` — a clause's tests must pass before anything ships, and a change that makes one fail is stopped before release

- Signal: read from the suite run at landing and at release, which names each failing test by the clause its file carries. Upheld when every row naming the clause passes in that run; broken reports the clause and the failing test file, and the landing or the close is refused.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Closing a plan is refused when a test that proves one of its clauses fails when the plan closes, even though its row says it passed earlier; the refusal names the clause and the test file. | unit |
| A2 | Landing a plan is refused when a test that proves one of its clauses fails, naming the clause. | unit |
| A3 | A failing test is reported against the clause its file names, so a person reading a red suite sees which clause of which promise broke. | unit |

### `upheld-by-its-signal` — a clause is upheld only when its signal has reported it upheld in a run of the real system, and a passing test never stands in for its signal

- Signal: read from the local daemon's traces (and, for a deployed project, the production source). Upheld when the clause's signal has reported upheld and none since reports broken; a split is upheld by reaching its budget at its point, a limit by every report staying inside its bound. Broken reports the clause, its symptom and its trace.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A clause whose signal has reported upheld in a run of the real system reads upheld on the promise page and in `promises status`. | unit |
| A5 | A clause with passing tests and no report from its signal does not read upheld. | unit |
| A6 | A signal whose only source is a test run is not the clause's signal: the clause reads no signal, however often the test passes. | unit |
| A7 | A clause whose signal reports broken reads broken, its promise reads broken, and an incident opens that names the clause and its symptom. | unit |
| A8 | A split is broken by missing its budget at its point; a limit is broken by a single report over its bound, however many reports were inside it. | unit |
| A9 | A plan written as clauses cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; the refusal names the clause and says which of the two is missing. | unit |
| A10 | When such a plan closes, its promise is enforced. | unit |
| A11 | A clause's signal, run against the real system through the local daemon, reports upheld and the clause then reads upheld end to end. | live check |

### `no-signal-is-not-holding` — a clause whose signal has never reported, or whose watcher is blind, reads no signal and never reads as holding

- Signal: read from the same traces and the watcher's own heartbeat. Upheld while a clause with no report reads no signal everywhere it is shown and a blind watcher is never shown as holding; broken reports a clause shown as holding without a report.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | A clause whose signal has never reported reads no signal on the promise page, in `promises status` and in the admin, and is never drawn as holding. | unit |
| A13 | A clause that last reported upheld, whose watcher has since gone silent past its heartbeat, reads no signal, not holding. | unit |
| A14 | A promise with one clause upheld and another reading no signal is not holding: its standing is the worst of its clauses (broken, then no signal, then holding). | unit |
| A15 | A promise made only of clauses that rest on other promises has the standing of those promises and closes when they are in force, with no test row of its own. | unit |

### `a-break-names-its-clause` — a break's event and incident name the promise and the clause, and point to the plan and phase that added the signal; its tests are reachable from the clause

- Signal: read from the incident the break opens and the event it was opened from. Upheld when every incident opened by a clause's signal names `promise/clause`; broken reports an incident naming only a promise or only a file.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | When a clause's signal reports broken, the event it emits carries the promise and the clause. | unit |
| A17 | The incident a broken clause opens names the promise and the clause, and, when the signal records it, the plan and phase that added it, as a pointer rather than as the key. | unit |
| A18 | From an incident a person reaches the clause's tests (the rows and files that carry its token) and the place that emits its signal, with no search by file name. | unit |

## `an-audit-concern-gets-a-solution`

Each concern an audit raises is answered with a fix, a signal that would show it breaking, or the reason nothing is needed.

### `every-concern-is-answered` — the audit asks, for each concern it raised, what signal would show it breaking, and the answer is a fix, a signal or nothing with the reason

- Signal: read from the audit skill's instructions and from each `audit.md` written after this plan. Upheld when the instructions carry the question and each concern in a new `audit.md` has one of the three answers; broken reports a concern with none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | The audit's instructions put a seventh question to the reader: for each concern above, what signal would show us if it breaks, and if telemetry is not the answer, say so; the six earlier questions and the audit.md shape are unchanged. | unit |
| A20 | The instructions name the three answers: a signal (the invariant checked and where it is emitted), a fix (a wrong sentence or a missing guard), or nothing (too unlikely or too cheap, with the reason). | unit |
| A21 | A signal answer also says how often the signal would fire and what happens if its first break reaches a user, and the instructions say a path that rarely runs leaves its promise unknown for a long time. | unit |
| A22 | The instructions offer the kinds of signal as a menu: an outcome where it is felt, an invariant checked on each read, a postcondition after an operation, an expected event that did not happen, and a policy that must never be crossed. | unit |

### `a-signal-answer-names-its-clause` — a signal an audit proposes names the clause it would uphold, and a concern no clause covers says so

- Signal: read from the same instructions and audits. Upheld when the instructions require the clause and each signal answer carries one or says no clause covers the concern; broken reports a signal answer that names none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A23 | The instructions require a signal answer to name the clause it would uphold, and a concern no clause covers to say so. | unit |
| A24 | The audit skill's copy under the project's skills folder is the same text as its source in the package, so the question reaches every project that updates. | unit |

## Not for a promise

Assertions that prove none of this plan's clauses, each worth a test for the reason given.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A25 | A plan written before clause plans still closes on passing tests that name its promises, with no signal asked of it. | unit | a regression guard over `a-closed-plan-kept-its-promises` for every plan closed before clauses |
| A26 | InDusk's own signal writers write `broken` where they wrote `violated`, and every reader still reads both. | unit | the switch carried from `one-promise-language`; a rename that no promise of this plan states |
| A27 | A promise with no clauses still opens an incident that names the tests that proved it, as before. | unit | a regression guard over `an-incident-names-its-tests` for every promise written before clauses |
| A28 | An `audit.md` written before this plan, with six answers and no seventh, still lets the retrospective start. | unit | a regression guard over `an-audit-blocks-nothing` |
| A29 | A test file carrying a clause token is refused at close when it asserts nothing about the clause. | unit | carried from `plans-are-promises`' audit: the proof by file named the clause but not its content; this tightens `verified-before-release` and may be dropped if the check cannot be made without false refusals |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Signals cost a few percent at most in time and in trace storage per day. | needs a project with real traffic; dusk's own load says nothing | expectation 2 in the brief, read on Homework Gate's first plan when it closes |
| U2 | Clauses get signals that report: the share of clauses in force whose signal has reported at least once rises. | needs time in production | expectation 1 in the brief, looked at 30 and 90 days after release |
| U3 | A break is fixed faster once its incident names its clause and where its signal came from. | needs real breaks over weeks | expectation 3 in the brief, looked at 30 days after release |

## Notes

- Levels: nothing here is a `contract` yet. If the signal reads Jaeger through a query we do not own beyond what `promises status` already does, one `contract` row is added at the ADR.
- A29 is the weakest row and is marked so; the plan reviewer decides whether it ships in this cut.
- Rows A19–A24 are tests of the audit skill's instructions, in the style of `planner-brief-template.test.ts`: the instructions are the product, so the test reads what they say.
- Out of scope, per the brief's "Not promised": the later cut (a break leading to its cause beyond the plan and phase pointer, diagnoses, browser signals, every break becoming a test, approvals as questions, clause views).
