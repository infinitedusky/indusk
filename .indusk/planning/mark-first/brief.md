---
title: "Signal first"
date: 2026-10-14
status: accepted
workflow: feature
clauses: required
description: "Each clause of a promise is verified by its tests before release and upheld by its signal — telemetry from the running system — in use; a plan written as clauses closes when both say so; a break names its clause; an audit concern is answered with a fix or a signal."
---

# Signal first — Brief

A clause is proved twice: verified by its tests before release, upheld by its
signal in use. The last of three plans that split the first cut of the merged
`mark-first` (Sandy, 2026-10-15): `one-promise-language` (the words) and
`plans-are-promises` (a plan holds promises, each stated as clauses) have
landed, and this one builds on both: a clause now exists, with its test rows,
and what it lacks is a signal that proves it in use. The
background, the merge with `promise-first-build`, and the later cut are in
[research.md](research.md); the principles are `promise-core`'s ("Settled
2026-10-14/15").

## Expectations

1. **Clauses get signals that report.**
   - Measure: of clauses in force, the share whose signal has reported at least once (holding or broken) against those still reading no signal, from the registry and the local daemon.
   - Look: 30 and 90 days after release.

2. **Signals cost little.**
   - Measure: on Homework Gate's first plan, the time each split takes with its signals on and off, and the trace storage the daemon uses per day; expect a few percent at most.
   - Look: when that plan closes.

3. **A break is fixed faster.**
   - Measure: for incidents opened by a clause's signal, the time from broken to fixed, against incidents opened before this plan, from the incident records.
   - Look: 30 days after release.

## Promises

### This plan makes

1. **`a-clause-is-proved-twice`** (state). A clause is verified by its tests before release and upheld by its signal in use, and is upheld only when both say so.
   - **`verified-before-release`** (split). A clause's tests must pass before anything ships, and a change that makes one fail is stopped before release.
   - **`upheld-by-its-signal`** (split). A clause is upheld only when its signal has reported it upheld in a run of the real system, and a passing test never stands in for its signal.
   - **`no-signal-is-not-holding`** (limit). A clause whose signal has never reported, or whose watcher is blind, reads no signal and never reads as holding.
   - **`a-break-names-its-clause`** (split). When a clause's signal reports broken, the signal's event and the incident it opens name the promise and the clause, and point to the plan and phase that added the signal; its tests are reachable from the clause.

2. **`an-audit-concern-gets-a-solution`** (state). Each concern an audit raises is answered with a fix, a signal that would show it breaking, or the reason nothing is needed.
   - **`every-concern-is-answered`** (split). The audit asks, for each concern it raised, what signal would show it breaking, and the answer is a fix, a signal (the invariant checked, where it is emitted, how often it would fire and what happens if its first break reaches a user) or nothing with the reason.
   - **`a-signal-answer-names-its-clause`** (split). A signal an audit proposes names the clause it would uphold, and a concern no clause covers says so.

### Existing promises

**Must not break**

- **`a-production-break-is-recorded-unasked`**. A broken clause becomes an incident the same way a broken promise does today.
- **`an-audit-blocks-nothing`**. The new question changes no gate: the retrospective still reads that audit.md exists, never what it says.
- **`a-plan-is-audited-by-a-fresh-reader-before-it-closes`**. The audit is still read cold by a reader that has not seen the building session; it gains one question.
- **`a-plan-holds-the-promises-it-lands`**. A plan still holds one or more promises, each stated as clauses with a clause plan before the ADR, and still closes per clause: this plan adds the signal to what proves a clause and takes none of that away.
- **`a-break-reaches-the-working-agent`**. A broken clause reaches the agent the same way.
- **`everyday-suite-stays-fast`**. Signals add no waiting to the everyday suite.

**Changes**

- **`an-incident-names-its-tests`**. When a clause breaks, its incident names the promise and the clause that broke, and the tests tied to that clause are reachable from it; the plan it reopens can still be edited.
- **`a-closed-plan-kept-its-promises`**. A plan cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced.

**Replaces**

None.

### Not promised

- **The later cut**, after `run-the-master`: a break leading to its cause, a diagnosis with every break, every broken trace kept, signals from the browser, every break becoming a test, approvals giving way to questions, and the promise page's clause views (research.md, "First cut").
- **Removing tests.** Tests verify before release and guard against regression (Sandy: "the regression is fucked if you remove the tests").
- **Signals on every line**, and **gradual rollout** — later, if incidents ask for them.
- **Homework Gate's own promises.** It is its own project, with its own registry; proving this plan there is expectation 3, and the run Sandy makes there.

## Looks

None — the first cut changes what plans and promises say and how a plan closes, not how any screen is laid out; the clause views come with the later cut and `run-the-master`'s graph.

## Depends On

- `.indusk/planning/plans-are-promises/` — landed (`8235644ff`): a clause exists, with its rows, its clause plan and closing per clause.
- `.indusk/planning/one-promise-language/` — landed: the words this plan's pages and records use.

## Blocks

- `run-the-master` — it runs plans as a graph of promises and clauses, and reads their state.
