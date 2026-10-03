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
| A1 | Running `indusk init` on a fixture from inside the everyday suite starts no Jaeger or otelcol process — through the CLI helper, and through a child started with its own environment built on the test process's | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/test-daemons-never-leak.test.ts |
| A2 | Outside the tests, `indusk telemetry register` with the switch unset still starts the daemon for a home that has none | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |
| A3 | The guard exits non-zero naming the process and home of a daemon left running from a temporary home, and stops naming it once that daemon is stopped | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |
| A4 | A test run that fails still runs the leaked-daemon guard and reports what it finds: with a daemon left in a temp home and the tests failing, the run exits non-zero and names that home | Build Phase 2 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |
| A5 | Every test entry point ends with the guard — the root `pnpm test` and `pnpm test:system`, the tier whose tests start real daemons on purpose | Build Phase 2 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/test-daemons-guard.test.ts |

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

- [x] `bin/commands/telemetry.ts`, `register`: when `process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART === "1"`, register the project and skip the start, printing that the start was skipped and why — the opportunistic start is the only thing the switch changes
- [x] `apps/indusk-mcp/vitest.config.ts` and `apps/indusk-admin/vitest.config.ts`: `test.env: { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" }`, with a comment naming why the system config does not carry it — set on `process.env` as each config loads rather than as `test.env`: the admin's inline projects do not inherit top-level test options, and a process variable reaches every worker and child either way
- [x] Discovered: the switch alone left A1 red. `init`'s extension hook runs `indusk telemetry register`, and bare `indusk` is the globally installed CLI (1.57.2 here), not the code under test — so the everyday suite's hooks have always run whatever version the developer has installed. Both configs now set `INDUSK_BIN` (the hook runner's existing override) to the package's built CLI, unless a test sets its own
- [x] `apps/indusk-mcp/scripts/check-test-daemons.js`: list running telemetry binaries (`ps -ax -o pid=,command=`), keep those whose config path is under a temporary directory (`os.tmpdir()`, `/tmp`), print each with its PID and home, exit 1 if any; exit 0 with a one-line all-clear otherwise. Root `package.json` `test`: `turbo test --concurrency=1 && pnpm promises:check && node apps/indusk-mcp/scripts/check-test-daemons.js`

- [x] Shape (Build Phase 1): reviewed `bin/commands/telemetry.ts`, both Vitest configs, `scripts/check-test-daemons.js` and `helpers/telemetry-reap.ts`. Nothing found: the switch is one early return with its reason beside it, before the start it skips; each config carries the two variables with the why; the guard is one read and one report. Two readers of the process list (the guard, a shipped script; `telemetryProcessesFor`, a test helper) is a cross-file question — `/cleanup`'s

#### Build Phase 1 Verification

- [x] A1 and A3 pass and A2 still passes (the two commands in Test Phase 1's Verification); `telemetry-init-fresh.test.ts` still passes — 2/2 everyday, 3/3 system (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-init-fresh`)
- [x] `pnpm test` is green and its last line is the guard's all-clear; the process count from temp homes is the same before and after the run — mcp 1,671 / 5 skipped, admin 343, `promises check` clean, guard all-clear; 0 temp-home daemons before and after. Two earlier full runs showed 38–39 admin HTTP failures: the evaluator, grading this branch's commits, was running the admin's HTTP tests in this same worktree at the same time (its `next dev` held the app's `.next/` lock); alone, the admin suite was 343/343

#### Build Phase 1 Context

- [x] root (Conventions), the test-commands line: tests never auto-start a telemetry daemon (`INDUSK_SKIP_TELEMETRY_AUTOSTART`, set in the everyday configs) and `pnpm test` ends by failing on any daemon left from a temp home — always-on because any test in either package that runs `init` or `update` meets it, and the 2026-08 convention ("reap in every suite") failed by being remembered

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/telemetry/cli.md`, `register`: the switch and what it skips; `apps/docs/src/changelog.md` Unreleased, Fixed — the page has no `register` section (it is internal), so the switch is under its Environment variables, with a warning not to set it in a working shell

### Build Phase 2: Falsification — the guard is skipped on exactly the runs that leak

**Goal**: verify whether the attested state — *if a daemon is left running anyway, the suite says so by name* — holds on every run. Two paths say nothing:

- **A4** — the root `test` script chains the guard with `&&`: `turbo test … && pnpm promises:check && node …/check-test-daemons.js`. When any test fails, the guard never runs. A failing run — a crash, a timeout, a test that died before its `afterEach` — is exactly the run most likely to leave a daemon behind, and it is the one run that reports nothing.
- **A5** — `pnpm test:system` has no guard at all. It is the tier whose tests start real daemons on purpose, the only tier still able to leak one after this plan, and `pnpm release` runs it before every publish.

- [x] Author A4 and A5 red in `src/__tests__/test-daemons-guard.test.ts` (system tier): A4 starts a daemon in a temp home and runs the guarded test entry with a command that fails, expecting a non-zero exit whose output names the home; A5 reads the root and package `package.json` scripts and expects both `test` and `test:system` to end in the guard. Run each and read each failure
- [ ] `apps/indusk-mcp/scripts/with-daemon-guard.js`: runs the command it is given, then **always** runs the guard, prints both, and exits non-zero if either failed — the test command's own exit code first, so a failing suite still reads as a failing suite
- [ ] Root `package.json` `test` and `test:system`, and the package's `test:system`: wrapped in `with-daemon-guard.js` — the root `test` no longer chains the guard with `&&`

#### Build Phase 2 Verification

- [ ] A4 and A5 pass and A1–A3 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/test-daemons-never-leak`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/test-daemons-guard`)
- [ ] `pnpm test` and `pnpm test:system` are green and each ends with the guard's all-clear; 0 temp-home daemons after both

#### Build Phase 2 Context

- [ ] root (Conventions), the test-commands line: every test entry point ends with the guard, failing runs included — in the same bytes

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/telemetry/cli.md`, the `INDUSK_SKIP_TELEMETRY_AUTOSTART` entry: the guard runs after `pnpm test` and `pnpm test:system`, pass or fail; the changelog's Fixed entry says the same

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
