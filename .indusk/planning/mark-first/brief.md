---
title: "Tests and telemetry linked to clauses"
date: 2026-10-14
status: accepted
workflow: feature
clauses: required
description: "Each clause of a promise is linked to its tests and to its telemetry: its tests check it before release, its signal reports it from the running system, and a plan written as clauses finishes only when both say it holds; a break names its clause."
---

# Tests and telemetry linked to clauses — Brief

A clause is proved twice: verified by its tests before release, upheld by its
signal in use. The last of three plans that split the first cut of the merged
`mark-first` (Sandy, 2026-10-15): `one-promise-language` (the words) and
`plans-are-promises` (a plan holds promises, each stated as clauses) have
landed, and this one builds on both: a clause now exists, with its test rows,
and what it lacks is a signal that proves it in use. Since 2026-10-16 it is the
third child of [telemetry-from-day-one](../telemetry-from-day-one/master.md),
after [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/),
which defines what a signal carries and writes it from an application; this
plan reads it (Sandy: write before read). The
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

### Existing promises

**Must not break**

- **`a-production-break-is-recorded-unasked`**. A broken clause becomes an incident the same way a broken promise does today.
- **`a-plan-holds-the-promises-it-lands`**. A plan still holds one or more promises, each stated as clauses with a clause plan before the ADR, and still closes per clause: this plan adds the signal to what proves a clause and takes none of that away.
- **`a-break-reaches-the-working-agent`**. A broken clause reaches the agent the same way.

**Changes**

- **`an-incident-names-its-tests`**. When a clause breaks, its incident names the promise and the clause that broke, and the tests tied to that clause are reachable from it; the plan it reopens can still be edited.
- **`a-closed-plan-kept-its-promises`**. A plan cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced.

**Replaces**

None.

### Not promised

- **Tasks written as instructions** in an impl: its own small plan, `impl-tasks-are-instructions`, moved out on 2026-10-17 (Sandy) so it lands without waiting on this one.
- **The audit's answer to each concern** (a fix, a signal, or the reason nothing is needed): its own plan, split out on 2026-10-17 (Sandy). It shares little code with this one, and who answers a concern — the auditor or the plan's agent — is open there.
- **The later cut**, after `run-the-master`: a break leading to its cause, a diagnosis with every break, every broken trace kept, signals from the browser, every break becoming a test, approvals giving way to questions, and the promise page's clause views (research.md, "First cut").
- **Removing tests.** Tests verify before release and guard against regression (Sandy: "the regression is fucked if you remove the tests").
- **Signals on every line**, and **gradual rollout** — later, if incidents ask for them.
- **Task tags** (the files a task touches and what kind of change it is): with `run-the-master`, which needs them to schedule phases.
- **Homework Gate's own promises.** It is its own project, with its own registry; proving this plan there is expectation 3, and the run Sandy makes there.

## Looks

None — the first cut changes what plans and promises say and how a plan closes, not how any screen is laid out; the clause views come with the later cut and `run-the-master`'s graph.

## Carried

Work this plan takes on that is not a promise of its own. Each is built here and tested under "Not for a promise" in the clause plan; where it came from is in research.md.

- **One word, signal.** The telemetry a clause carries is called a signal everywhere: skills, docs, tool descriptions and code comments say signal where they said mark. Exempt: the Day 4b entry in the root `CLAUDE.md` and the archived plans and decisions (history), and this plan's own name until it closes. (`one-promise-language` settled the word; this plan does the cleanup.)
- **The writers switch from `violated` to `broken`.** InDusk's own writers — `markPromise` and `scripts/suite-speed.js` — write `broken` (the demo app's writer is the scaffold plan's, through its helper); every reader still reads both. The editor's health line (`indusk promises health --json`, `runs[].outcome`) keeps `violated` until the editor extension shipped with the language release has been out a release, and is switched then, not here.
- **The registry state `known-broken` and older InDusks.** A checkout on an InDusk older than the language release refuses it. Whether that matters is decided in the ADR.
- **InDusk's own commands get one tracer.** Closing and the incident writer emit the spans this plan's own clauses are read by, through one tracer provider for the package's commands that exports to the local daemon and is silent when none runs; `new_project.create` reaches the daemon through it too.

Waiting for a plan to take them, in `known-issues.md`: three promises `new-project-flow`'s audit found held only because the prompt says so, `change` and `replace` not carrying clauses (with the MCP `clauses` argument having no row), and `indusk plans start` failing under `indusk init --local`.

## Depends On

- `.indusk/planning/a-new-project-starts-instrumented/` — it defines the keys a signal carries, in the package's vocabulary, and writes them from an application; this plan's readers read those keys.
- `.indusk/planning/daemon-found-not-guessed/` — closing asks the daemon whether each clause's signal reported.

- `.indusk/planning/plans-are-promises/` — landed (`8235644ff`): a clause exists, with its rows, its clause plan and closing per clause.
- `.indusk/planning/one-promise-language/` — landed: the words this plan's pages and records use.

## Blocks

- `run-the-master` — it runs plans as a graph of promises and clauses, and reads their state.
