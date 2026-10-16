---
title: "Signal first — Test Plan"
date: 2026-10-16
status: draft
---

# Signal first — Test Plan

## Purpose

This is the clause plan: one section for the promise this plan makes, one for each of its clauses, each with its signal (where it is read, what counts as upheld, what it reports when broken) and the assertions that prove it before release. Each assertion names its level, the smallest that can prove it. Rows in the impl derive from these; the signal is what proves the clause in use, and is read by the mark this plan teaches clauses to carry.

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
| A6 | A clause whose signal reports broken reads broken, its promise reads broken, and an incident opens that names the clause and its symptom. | unit |
| A7 | A split is broken by missing its budget at its point; a limit is broken by a single report over its bound, however many reports were inside it. | unit |
| A8 | A plan written as clauses cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; the refusal names the clause and says which of the two is missing. | unit |
| A9 | When such a plan closes, its promise is enforced. | unit |
| A10 | A clause's signal, run against the real system through the local daemon, reports upheld and the clause then reads upheld end to end. | live check |

### `no-signal-is-not-holding` — a clause whose signal has never reported, or whose watcher is blind, reads no signal and never reads as holding

- Signal: read from the same traces and the watcher's own heartbeat. Upheld while a clause with no report reads no signal everywhere it is shown and a blind watcher is never shown as holding; broken reports a clause shown as holding without a report.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A clause whose signal has never reported reads no signal on the promise page, in `promises status` and in the admin, and is never drawn as holding. | unit |
| A12 | A clause that last reported upheld, whose watcher has since gone silent past its heartbeat, reads no signal, not holding. | unit |
| A13 | A promise with one clause upheld and another reading no signal is not holding: its standing is the worst of its clauses (broken, then no signal, then holding). | unit |
| A14 | A promise made only of clauses that rest on other promises has the standing of those promises and closes when they are in force, with no test row of its own. | unit |

## Not for a promise

Assertions that prove none of this plan's clauses, each worth a test for the reason given.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A15 | A plan written before clause plans still closes on passing tests that name its promises, with no signal asked of it. | unit | a regression guard over `a-closed-plan-kept-its-promises` for every plan closed before clauses |
| A16 | InDusk's own signal writers write `broken` where they wrote `violated`, and every reader still reads both. | unit | the switch carried from `one-promise-language`; a rename that no promise of this plan states |
| A17 | A test file carrying a clause token is refused at close when it asserts nothing about the clause. | unit | carried from `plans-are-promises`' audit: the proof by file named the clause but not its content; this tightens `verified-before-release` and may be dropped if the check cannot be made without false refusals |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Signals cost a few percent at most in time and in trace storage per day. | needs a project with real traffic; dusk's own load says nothing | expectation 2 in the brief, read on Homework Gate's first plan when it closes |
| U2 | Clauses get signals that report: the share of clauses in force whose signal has reported at least once rises. | needs time in production | expectation 1 in the brief, looked at 30 and 90 days after release |

## Notes

- Levels: nothing here is a `contract` yet. If the signal reads Jaeger through a query we do not own beyond what `promises status` already does, one `contract` row is added at the ADR.
- A17 is the weakest row and is marked so; the plan reviewer decides whether it ships in this cut.
- Out of scope, per the brief's "Not promised": the later cut (a break leading to its cause, diagnoses, browser signals, every break becoming a test, approvals as questions, clause views).
