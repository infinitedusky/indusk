---
title: "Signal first"
date: 2026-10-14
status: accepted
workflow: feature
description: "A plan makes one promise, stated as clauses. Each clause is verified by its tests before release and upheld by its signal — telemetry from the running system — in use. The first cut: only what run-the-master needs."
---

# Signal first — Brief

A plan is one promise, made of clauses; each clause is verified by its tests
before release and upheld by its signal in use. This is the first cut — only
what `run-the-master` needs (Sandy, 2026-10-15: in order of importance). The
background, the merge with `promise-first-build`, and the later cut are in
[research.md](research.md); the principles are `promise-core`'s ("Settled
2026-10-14/15").

## Expectations

1. **Plans are written as one promise of clauses.**
   - Measure: of plans whose brief is accepted after this lands, the share stating one promise as clauses, each clause with a signal, read from their briefs.
   - Look: after the first five such plans.

2. **Clauses get signals that report.**
   - Measure: of clauses in force, the share whose signal has reported at least once (holding or broken) against those still reading no signal, from the registry and the local daemon.
   - Look: 30 and 90 days after release.

3. **Signals cost little.**
   - Measure: on Homework Gate's first plan, the time each split takes with its signals on and off, and the trace storage the daemon uses per day; expect a few percent at most.
   - Look: when that plan closes.

## Promises

### This plan makes

1. **`a-plan-is-one-promise`** (state). A plan makes one promise, and it is done when every clause of that promise is verified by its tests and its signal has reported it upheld.

2. **`a-promise-is-made-of-clauses`** (state). A promise is stated as named clauses — splits, each a point reached within its budget on the way to the promise's goal, and limits, each a bound that always holds — and each clause has its own signal and the tests tied to it.

3. **`a-clause-is-upheld-by-its-signal`** (state). A clause is upheld only when its signal has reported it upheld in a run of the real system; a passing test never stands in for its signal, and a clause whose signal has never reported reads no signal, never holding.

4. **`a-clause-is-verified-before-release`** (state). A clause's tests must pass before anything ships; a change that makes one fail is stopped before release.

5. **`a-promise-can-rest-on-another`** (state). A clause can be another promise, of the part beneath it, and its health is that promise's health.

6. **`a-plan-plans-its-clauses`** (state). In place of a test plan, a plan's clause plan names each clause's signal — where it is read, what counts as upheld and what it reports when broken — and the tests tied to that clause, which the agents choose and keep.

7. **`a-promise-is-upheld-or-broken`** (state). Every signal, record and page says a promise or a clause is upheld or broken — holding or broken when live, no signal when unknown — and never failed, passed or violated; a signal written with the old word is still read.

### Existing promises

**Must not break**

- **`a-production-break-is-recorded-unasked`**. A broken clause becomes an incident the same way a broken promise does today.
- **`a-break-reaches-the-working-agent`**. A broken clause reaches the agent the same way.
- **`an-incident-names-its-tests`**. An incident still names the tests tied to what broke.
- **`everyday-suite-stays-fast`**. Signals add no waiting to the everyday suite.

**Changes**

- **`a-closed-plan-kept-its-promises`**. A plan cannot close while a clause of its promise has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced.

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

None.

## Blocks

- `run-the-master` — it runs plans as a graph of promises and clauses, and reads their state.
