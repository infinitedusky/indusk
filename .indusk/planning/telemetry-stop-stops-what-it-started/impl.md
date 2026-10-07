---
title: "telemetry stop stops what it started"
date: 2026-10-07
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# telemetry stop stops what it started

## Goal

`indusk telemetry stop` judges a recorded process its own by its command line (this daemon's binary, with this daemon's own config file under its home), not by whether its port answers; it signals only its own; it reports stopped only when none of its own still runs, and keeps the record otherwise.

## Scope

### In Scope
- `lib/telemetry/stop.ts`: the stop decision, its observations (alive, command line), signals and clock as inputs
- `daemonStop` through it; `indusk telemetry stop` saying when a process would not stop
- A4 in the system tier

### Out of Scope
- The admin daemon's own copy of the port-based check (`known-issues.md`)
- Running the system tier once per release (release-checks-run-once)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `stopDaemon(meta, home, deps)`; `daemonStop` and the CLI through it | `DaemonMeta`, `induskHome()` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A recorded process alive and running this daemon's binary with this daemon's config is stopped, whether or not its port answers | Build Phase 1 | Build Phase 1 | planned | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A2 | A recorded process ID now held by another program is left alone, and the record is still cleared | Build Phase 1 | Build Phase 1 | planned | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A3 | When a process of its own still runs after the stop, stop says so and keeps the record | Build Phase 1 | Build Phase 1 | planned | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A4 | A real daemon started and then stopped leaves no Jaeger or otelcol running from its home | Test Phase 1 | Build Phase 1 | planned | contract | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts |

## Checklist

### Test Phase 1: The real daemon, over the CLI

**Goal**: A4 over the CLI against a real daemon; it holds today when ports answer, so it is the regression guard for the whole stop.

- [ ] Confirm this plan's worktree (`indusk plans start bugfix telemetry-stop-stops-what-it-started` made it and recorded the assignment) — worktree-per-plan default
- [ ] A4: in `telemetry-cli-lifecycle.test.ts`, after `telemetry stop`, no process's command line names the test's home (the same scan `check-test-daemons` runs); and `telemetry start`'s exit code is asserted with its output, so a failed start names its reason (the 1.64.0 failure hid it)

#### Deferred to Build Phase 1

- **A1, A2, A3** — their subject is `stopDaemon` in `lib/telemetry/stop.ts`, which Build Phase 1 creates; a test importing it today fails to load.

#### Regression Guards

- **A4** — the stop works today whenever the ports answer, so A4 passes when written; it guards the real daemon through the change. The slow-port case it cannot reproduce on demand is A1's, as a unit with the port left out of the decision.

#### Test Phase 1 Verification

- [ ] A4 is authored and passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-cli-lifecycle.test.ts`)

### Build Phase 1: Stop judges by the command line

- [ ] A1, A2, A3 written red in `lib/telemetry/stop.test.ts` against a `stopDaemon` that keeps today's port-based decision
- [ ] `lib/telemetry/stop.ts`: `stopDaemon(meta, home, deps)` with `deps = { alive(pid), command(pid), kill(pid, signal), sleep(ms) }`; a process is its own when it is alive and its command line contains its recorded binary and its config under `home` (`telemetry-jaeger.yaml`, `telemetry-collector.yaml`); SIGTERM its own, wait up to 3 s, SIGKILL any left; returns `{ stopped, stillRunning, strangers }`, `stopped` only when none of its own is left
- [ ] `daemonStop` calls it with the real observations (`ps -o command= -p <pid>`); clears the record unless a process of its own still runs; `indusk telemetry stop` prints the still-running PIDs and exits non-zero when there are any

#### Build Phase 1 Verification

- [ ] A1, A2, A3 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/telemetry/stop.test.ts && pnpm exec vitest related src/lib/telemetry/daemon.ts src/lib/telemetry/stop.ts --run`), and A4 still passes

#### Build Phase 1 Context

- [ ] guard: `stop.test.ts` carries `lesson: a-safety-argument-in-a-comment-is-not-enforced` if that lesson exists, else the root's Known Gotchas line already names this class; record which

#### Build Phase 1 Document

- [ ] `apps/docs/src/changelog.md` Unreleased, Fixed: `indusk telemetry stop` stops its own daemon under load, and says when it cannot

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/telemetry/stop.ts` (+ test) | new: the stop decision |
| `apps/indusk-mcp/src/lib/telemetry/daemon.ts` | `daemonStop` through it |
| `apps/indusk-mcp/src/bin/commands/telemetry.ts` | report a process that would not stop |
| `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` | A4; start's exit asserted |
| `apps/docs/src/changelog.md` | the fix |

## Dependencies

- None.
