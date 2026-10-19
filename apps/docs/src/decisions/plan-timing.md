# A plan says how long it took

**Decided 2026-10-19.** Full ADR: `.indusk/planning/a-plan-says-how-long-it-took/adr.md`.

## Goal

**Every phase, unattended step and test run of a plan leaves a timed record, and one command prints them with a total from acceptance to landing.**

A phase's start was recorded but not its end, an unattended step's session record was deleted when it ended, and `indusk plans tests` recorded nothing. So "where did the time go" was answered by reading commit times by hand, and the decision about which tests run per phase had no data.

## What was decided

| Decision | What it is |
| --- | --- |
| One log per plan, on this machine | `timing/<plan>.jsonl` in the project's machine-state home, the same place `indusk eval home` prints. Not committed, so it adds no commits to a plan's branch and cannot conflict between worktrees. |
| Every line is a version-1 record | `{ v, kind, plan, at, … }` with `kind` one of `phase-close`, `step-start`, `step-end`, `test-run`. `at` is UTC ISO-8601 from an injected clock. Durations are computed from timestamps, never stored; a test run's is the one stored duration, measured on a monotonic clock. |
| A record never blocks | Every write goes through `recordSafely`, which warns once and resolves. The reader skips a line it cannot parse, a half-written last line and a record of another version. |
| Steps are timed by wrapping `run` | `timedStep` wraps the function each runner uses to run a step, at the admin's two call sites; `runBuild` and `runPlanning` are unchanged. The end is written in a `finally`. |
| Test runs are recorded beside the run | `plansTestsOutcome` times the run and appends one record after it; the files, the command and the exit code are the tests' own, pinned by a test over the selection. |
| One view | `indusk plans time <name>` prints phases, steps and test runs in order, a total from `accepted_at` to the landing commit's time, and `between`. A plan with no records prints what exists and names what has none. |

## Decided while building

- **No phase-close call site.** Nothing in production writes phase starts: the executing agent writes them by following the work skill, and the Dawn loop writes none. The one deterministic close point is the `check-gates` hook, a gate, which this plan does not change. `recordPhaseClose` ships tested and callable; the view ends a phase at the next phase's opening and calls the last one open.
- **A step stopped by a signal is `stopped`; a blocked step is read from the plan afterwards.** The admin's classifier reads the plan's blocker the way the build and planning readers do; nothing it cannot tell changes the default.
- **The landing time is the trunk's landing merge commit.** The archive records none.
