---
title: "A test run never leaves a telemetry daemon behind"
date: 2026-10-03
status: in-progress
trajectory: required
test_phases: required
gate_policy: ask
---

# A test run never leaves a telemetry daemon behind — Implementation

## Goal

The everyday test suite never starts a telemetry daemon it does not stop,
and if one is left running anyway the suite says so by name. `indusk
telemetry register` skips its opportunistic start when
`INDUSK_SKIP_TELEMETRY_AUTOSTART=1`, the everyday Vitest configs set it for
every test process, and the root `pnpm test` ends with a guard that fails on
any telemetry process running from a temporary home. See
[brief.md](brief.md) and [test-plan.md](test-plan.md).

## Scope

### In Scope
- The switch, honoured by `register`'s auto-start only
- The switch set in the everyday configs of both packages — never the system
  tier, whose `telemetry-init-fresh` asserts that `init` starts the daemon
- The guard script, wired after `turbo test` in the root `pnpm test`

### Out of Scope
- Removing the existing `stopTelemetryForHome` calls (they find nothing to
  stop now; harmless)
- The heartbeat — `watcher-heartbeat`, next

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1, A3 red; A2 a regression guard | today's `register`, the built CLI, a real daemon in a temp home |
| Build Phase 1 | `INDUSK_SKIP_TELEMETRY_AUTOSTART` in `register`; `test.env` in both everyday configs; `scripts/check-test-daemons.js` run by root `pnpm test` | Test Phase 1's rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | Running `indusk init` on a fixture from inside the everyday suite starts no Jaeger or otelcol process — through the CLI helper, and through a child started with its own environment built on the test process's | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/__tests__/test-daemons-never-leak.test.ts |
| A2 | Outside the tests, `indusk telemetry register` with the switch unset still starts the daemon for a home that has none | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |
| A3 | The guard exits non-zero naming the process and home of a daemon left running from a temporary home, and stops naming it once that daemon is stopped | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author all three now — every subject is reachable over a boundary
(the CLI, the process list, a script run by path), so nothing is deferred.

- [x] Create/confirm this plan's worktree (`indusk worktree create test-daemons-never-leak`, which records the assignment) — worktree-per-plan default
- [x] Author A1 in `src/__tests__/test-daemons-never-leak.test.ts` (everyday suite): a fixture project and a temp home; run `init` through `runCli`, then through `spawnSync` with `{ ...process.env, INDUSK_HOME }`; after each, list processes whose command line names that home (`ps -ax -o pid=,command=`) and expect none. `afterEach` stops any daemon found (`stopTelemetryForHome`), so the red run leaks nothing
- [x] Author A2 and A3 in `src/__tests__/test-daemons-guard.test.ts`, added to `SYSTEM` in `vitest.tiers.ts`: A2 runs `telemetry register` with `INDUSK_SKIP_TELEMETRY_AUTOSTART` deleted from the environment and expects a pair naming the home, then stops it; A3 starts a daemon in a temp home, runs `node scripts/check-test-daemons.js` by path and expects exit 1 with the home in its output, stops the daemon, and expects the output no longer to name it
- [x] Run each and read each failure: A1 finds a pair (init starts one today); A3 fails because the script does not exist yet (the exit is non-zero for the wrong reason, so the assertion on the named home is what goes red); A2 passes — read 2026-10-03: A1 two processes in both cases; A3 red on "the guard names its home" (module not found); A2 green. A3's first draft started its daemon with `telemetry start`, which refused the default ports the real daemon holds — a red before its assertion; it now starts the daemon through `register`, on free ports, as the leaked ones were. The shared process lookup moved into `helpers/telemetry-reap.ts` (`telemetryProcessesFor`)

#### Regression Guards

- **A2** — what a person using the CLI gets today, and must keep getting: `register` starts the daemon. It passes when written; it goes red only if the switch is honoured where it should not be.

#### Test Phase 1 Verification

- [x] A1 and A3 fail on their own assertions and A2 passes — and 0 temp-home daemons afterwards (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/test-daemons-never-leak`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/test-daemons-guard`), and no daemon is left from a temp home afterwards (`ps -ax -o command= | grep telemetry-binari | grep -v /.indusk`)

### Build Phase 1: the switch, the configs, the guard

- [ ] `bin/commands/telemetry.ts`, `register`: when `process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART === "1"`, register the project and skip the start, printing that the start was skipped and why — the opportunistic start is the only thing the switch changes
- [ ] `apps/indusk-mcp/vitest.config.ts` and `apps/indusk-admin/vitest.config.ts`: `test.env: { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" }`, with a comment naming why the system config does not carry it
- [ ] `apps/indusk-mcp/scripts/check-test-daemons.js`: list running telemetry binaries (`ps -ax -o pid=,command=`), keep those whose config path is under a temporary directory (`os.tmpdir()`, `/tmp`), print each with its PID and home, exit 1 if any; exit 0 with a one-line all-clear otherwise. Root `package.json` `test`: `turbo test --concurrency=1 && pnpm promises:check && node apps/indusk-mcp/scripts/check-test-daemons.js`

#### Build Phase 1 Verification

- [ ] A1 and A3 pass and A2 still passes (the two commands in Test Phase 1's Verification); `telemetry-init-fresh.test.ts` still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-init-fresh`)
- [ ] `pnpm test` is green and its last line is the guard's all-clear; the process count from temp homes is the same before and after the run

#### Build Phase 1 Context

- [ ] root (Conventions), the test-commands line: tests never auto-start a telemetry daemon (`INDUSK_SKIP_TELEMETRY_AUTOSTART`, set in the everyday configs) and `pnpm test` ends by failing on any daemon left from a temp home — always-on because any test in either package that runs `init` or `update` meets it, and the 2026-08 convention ("reap in every suite") failed by being remembered

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/telemetry/cli.md`, `register`: the switch and what it skips; `apps/docs/src/changelog.md` Unreleased, Fixed

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/bin/commands/telemetry.ts` | the switch in `register` |
| `apps/indusk-mcp/vitest.config.ts`, `apps/indusk-admin/vitest.config.ts` | `test.env` |
| `apps/indusk-mcp/scripts/check-test-daemons.js` | new — the guard |
| `package.json` | the guard after the suite |
| `apps/indusk-mcp/vitest.tiers.ts` | the guard test joins the system tier |
| `apps/indusk-mcp/src/__tests__/test-daemons-never-leak.test.ts` | A1 |
| `apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts` | A2, A3 |

## Notes

- **The guard can be tripped by another run.** Two test runs at once — two
  worktrees, or the system tier beside the everyday suite — can see each
  other's legitimate temp-home daemons. It names what it saw, so a false red
  is visible, and a run that only reads it as "some daemon somewhere" is
  still a run that found one. Narrowing it to this run's homes is a
  follow-up if it bites.
