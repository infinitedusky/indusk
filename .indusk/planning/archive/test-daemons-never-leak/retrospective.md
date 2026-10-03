---
title: "A test run never leaves a telemetry daemon behind — Retrospective"
date: 2026-10-03
status: completed
---

# A test run never leaves a telemetry daemon behind — Retrospective

## What We Set Out to Do

Grounding `watcher-heartbeat` found this machine running **862 telemetry
processes** — 431 Jaeger and 431 otelcol pairs — all but the real daemon
started by tests from temporary homes and never stopped. It had happened
before: 2,058 processes holding 17.1 GB on 2026-08-13, after which the fix was
a convention ("call `stopTelemetryForHome` in every suite"). The brief asked
for a default and a guard instead: tests never auto-start a daemon, and a run
that leaves one behind says so by name. It also blocked `watcher-heartbeat`,
whose proofs need a machine where the only daemons are the ones they started.

## What Actually Happened

20 commits on `plan/test-daemons-never-leak`, 16 files, +415 / −21; the package
code, scripts and tests are 7 files, +329 / −3.

- **`register` honours `INDUSK_SKIP_TELEMETRY_AUTOSTART=1`**: it registers the
  project and skips the automatic start, saying so. Both packages' everyday
  Vitest configs set it on `process.env` as they load, so every worker and
  child inherits it; the system tier does not, because `telemetry-init-fresh`
  asserts that `init` does start a daemon.
- **`check-test-daemons.js`** names every telemetry process still running from
  a temporary home and fails. **`with-daemon-guard.js`** runs a test command and
  then always runs the guard; both `pnpm test` and `pnpm test:system` go
  through it.
- **Falsification** found the guard skipped on exactly the runs most likely to
  leak — chained with `&&`, it never ran after a failure — and `test:system`,
  the tier that starts daemons on purpose, had no guard at all.
- **Cleanup** was skipped with its reason: nothing across the 13 changed files
  warranted extraction.

## Getting to Done

- **The switch alone changed nothing.** A1 stayed red after `register` honoured
  it: `init`'s extension hook runs `indusk telemetry register`, and bare
  `indusk` was the globally installed CLI (1.57.2), not the code under test.
  The everyday suite's hooks had always run whatever version the developer had
  installed. Both configs now set `INDUSK_BIN` to the package's built CLI.
- **A3's first draft went red before its assertion.** It started its daemon
  with `telemetry start`, which refuses the default ports the real daemon
  holds; it now starts one through `register`, on free ports, as the leaked ones
  were started.
- **The guard's first system-tier run named a daemon that was gone a second
  later** — one a test had just stopped, still exiting. The guard now re-checks
  for five seconds and names only what is still running.
- **Two full runs showed 38–39 admin HTTP failures that were not this plan's.**
  The evaluator, grading this branch's commits, was running the admin's HTTP
  tests in the same worktree at the same time; its `next dev` held the app's
  `.next/` lock. Alone, the admin suite was 343/343. Diagnosed by finding the
  other process, not by re-running until green.

## What We Learned

- **A cleanup convention that every suite must remember fails, and fails
  silently, twice.** 2,058 orphans in August, 860 in October, both found by
  accident. A safe default plus a guard that names the leak is the fix; the
  convention's calls still exist and now find nothing to stop.
- **Tests that shell out to a bare command name run whatever is installed, not
  the code under test.** The extension hooks resolved `indusk` from `PATH`;
  every everyday test that ran `init` exercised the developer's global install.
  Pin the binary in the test environment.
- **A guard chained with `&&` is skipped on the runs it exists for.** A failing
  or crashed run is the likeliest to leak and was the one run that reported
  nothing. A check whose job is to catch leftovers must run after failure too.
- **An alarm must not fire on something already on its way out.** A single
  instant of the process list read a stopping daemon as a leak; a guard that
  cries wolf is the one people switch off.
- **The evaluator and a person's test run collide in one worktree.** Any
  commit can start a background evaluation that runs the same tests, against
  the same `.next/` lock and the same ports — false failures that look like
  real ones.

## What We'd Do Differently

- **Run the guard on a failing run in the test plan, not in falsification.**
  "Report the leak" should have carried "even when the tests fail" from the
  start — the case was the obvious one, and the `&&` was written in Build
  Phase 1.
- **Check what binary a test actually runs before trusting that a switch
  reached it.** A1 sat red for a reason that had nothing to do with the switch.

## Insights Worth Carrying Forward

- The evaluator running tests in the worktree it is grading is a hazard of its
  own, now observed: it should run against a snapshot, or a person's run
  should know it is there. Not this plan's to fix; recorded for a plan of its
  own.

## Quality Ratchet

- No recurring lint or type errors; Biome reformatted on write as usual.
- **Shape**: 0 findings across both build phases, 0 judged wrong. No streak
  (the previous plans had none judged wrong).

## Metrics

| | |
|---|---|
| Leaked processes found / after | 860 stopped by hand; 0 after `pnpm test` and `pnpm test:system` |
| Trajectory rows | 5, all passing (A1–A5) |
| Commits | 20 on the plan branch |
| `pnpm test` | mcp 1,671 / 5 skipped, admin 343, `promises check` clean, guard all-clear |
| `pnpm test:system` | 88 passed, guard all-clear |

## Landing
