---
title: "telemetry stop stops what it started"
date: 2026-10-07
status: completed
falsification: skipped
falsification_reason: "A small bugfix whose own rows are its falsification: A1 reproduced the release's failure exactly (slow ports, nothing signalled) before the fix; A2 covers a recycled PID and the same binary from another home; A3 a process that will not die; A4 the real daemon. Hunted the remaining path, a command line that cannot be read (ps fails): the process is then not its own and is not signalled, the safe side, and stop reports it still running only if alive and its own. No further case formed."
cleanup: skipped
cleanup_reason: "One new module of about 80 lines with one job, and daemonStop shortened by calling it. Nothing to decompose."
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
accepted: 2026-10-07T21:16:28.675Z
accepted_by: person
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
| A1 | A recorded process alive and running this daemon's binary with this daemon's config is stopped, whether or not its port answers | Build Phase 1 | Build Phase 1 | passing | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A2 | A recorded process ID now held by another program is left alone, and the record is still cleared | Build Phase 1 | Build Phase 1 | passing | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A3 | When a process of its own still runs after the stop, stop says so and keeps the record | Build Phase 1 | Build Phase 1 | passing | unit | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/lib/telemetry/stop.test.ts |
| A4 | A real daemon started and then stopped leaves no Jaeger or otelcol running from its home | Test Phase 1 | Build Phase 1 | passing | contract | promise: telemetry-stop-stops-what-it-started | apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts |

## Checklist

### Test Phase 1: The real daemon, over the CLI

**Goal**: A4 over the CLI against a real daemon; it holds today when ports answer, so it is the regression guard for the whole stop.

- [x] Confirm this plan's worktree (`indusk plans start bugfix telemetry-stop-stops-what-it-started` made it and recorded the assignment) — worktree-per-plan default
- [x] (the restart test, T5, asserts start's result too: it was the 1.64.0 failure) A4: in `telemetry-cli-lifecycle.test.ts`, after `telemetry stop`, no process's command line names the test's home (the same scan `check-test-daemons` runs); and `telemetry start`'s exit code is asserted with its output, so a failed start names its reason (the 1.64.0 failure hid it)

#### Deferred to Build Phase 1

- **A1, A2, A3** — their subject is `stopDaemon` in `lib/telemetry/stop.ts`, which Build Phase 1 creates; a test importing it today fails to load.

#### Regression Guards

- **A4** — the stop works today whenever the ports answer, so A4 passes when written; it guards the real daemon through the change. The slow-port case it cannot reproduce on demand is A1's, as a unit with the port left out of the decision.

#### Test Phase 1 Verification

- [x] (5 of 5 in the file) A4 is authored and passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-cli-lifecycle.test.ts`)

### Build Phase 1: Stop judges by the command line

- [x] (A1 red with "expected [] to deeply equal [ 101, 102 ]": with the ports slow, nothing is signalled, the release's failure exactly; A2 and A3 red on their own assertions) A1, A2, A3 written red in `lib/telemetry/stop.test.ts` against a `stopDaemon` that keeps today's port-based decision
- [x] `lib/telemetry/stop.ts`: `stopDaemon(meta, home, deps)` with `deps = { alive(pid), command(pid), kill(pid, signal), sleep(ms) }`; a process is its own when it is alive and its command line contains its recorded binary and its config under `home` (`telemetry-jaeger.yaml`, `telemetry-collector.yaml`); SIGTERM its own, wait up to 3 s, SIGKILL any left; returns `{ stopped, stillRunning, strangers }`, `stopped` only when none of its own is left
- [x] (`verifyIdentity` stays for `status`, where a recycled PID must not read as running; the module comment says which check each uses) `daemonStop` calls it with the real observations (`ps -o command= -p <pid>`); clears the record unless a process of its own still runs; `indusk telemetry stop` prints the still-running PIDs and exits non-zero when there are any

#### Build Phase 1 Verification

- [x] (A1–A3 4 of 4; the related tests 5 files, 33; the telemetry system files, A4's among them, 5 files, 14; `tsc` and biome clean) A1, A2, A3 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/telemetry/stop.test.ts && pnpm exec vitest related src/lib/telemetry/daemon.ts src/lib/telemetry/stop.ts --run`), and A4 still passes

- [x] Both full suites from a clean environment, for landing: `pnpm test` 2,010, 394 and 3 passed; `pnpm test:system` 41 of 41 files, 164 tests. Both runs' daemon check failed on the same eight processes, all started at 16:48, twenty minutes before these runs, from homes whose records were intact (so no `stop` ever ran on them; a test run cut off before its cleanup), one of them started by the published 1.64.0 through the demo test's `indusk init`. They were stopped by hand; neither run left a daemon of its own
- [x] Shape — `stop.ts` is one decision with its observations as inputs; `daemonStop` reads the record and hands the real observations to it; the command reports. Nothing to change

#### Build Phase 1 Context

- [x] (no such lesson exists; the root's Known Gotchas line already names this class, "a safety argument written in a comment is not enforced by the code around it", and `stop.ts`'s header says why the port is not asked) guard: `stop.test.ts` carries `lesson: a-safety-argument-in-a-comment-is-not-enforced` if that lesson exists, else the root's Known Gotchas line already names this class; record which

#### Build Phase 1 Document

- [x] `apps/docs/src/changelog.md` Unreleased, Fixed: `indusk telemetry stop` stops its own daemon under load, and says when it cannot

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
