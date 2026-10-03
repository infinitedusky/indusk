---
title: "A test run never leaves a telemetry daemon behind"
date: 2026-10-03
status: draft
workflow: bugfix
---

# A test run never leaves a telemetry daemon behind — Brief

## The problem

On 2026-10-03, while grounding `watcher-heartbeat`, this machine was running
**862 telemetry processes** — 431 Jaeger and 431 otelcol pairs — every one but
the real daemon started by a test from a temporary `INDUSK_HOME`
(`indusk-test-home-*`, `indusk-home-*`, `runner-detect-home-*`, and two from
`context-tiers-ship-home-*`), under both `/tmp` and the macOS temp directory.
They were stopped by hand; the real daemon (config under `~/.indusk`) was
left running.

### How it happens

1. A test runs the CLI's `init` or `update` against a fixture, through
   `runCli` (`src/__tests__/helpers/cli.ts`), which pins `INDUSK_HOME` to a
   temporary directory so nothing touches the real one.
2. `init` enables the `local-telemetry` extension, which is required; its
   `on_enable` hook runs `indusk telemetry register`.
3. `register` (`bin/commands/telemetry.ts`) finds no daemon for that home and
   **starts one** — `daemonStart({ allowPortBump: true })`, so it takes free
   ports rather than failing. The pair is spawned detached and survives the
   test.
4. Nothing stops it. Three test files reap the daemon they cause
   (`helpers/telemetry-reap.ts`); every other test that runs `init` or
   `update` leaves a pair behind, on every run. Running the package's test
   files in parallel (2026-10-02) multiplies the homes.

### Why it matters beyond the resources

A leaked test Jaeger answering on the default ports is how
`watcher-heartbeat`'s founding incident happened (2026-10-01): queries reached
a Jaeger that was not this project's, and `promise_health` read seven silent
days as "0 violations". The suite keeps manufacturing that hazard, a pair per
test per run.

## Proposed direction

- **Tests do not auto-start a daemon.** `register` skips its opportunistic
  start when told to by an environment switch, and `runCli` sets that switch
  for every test. Registration itself still happens — only the start is
  skipped — so the tests about registration keep testing it. Tests that need
  a real daemon are the system tier, which already start and reap their own.
- **A guard that a run leaves nothing behind.** The everyday suite ends by
  checking that no telemetry process is running from a temporary test home,
  and fails naming the ones it finds — so the next leak is a red test, not
  860 processes found by accident.

## Test cases (for the test plan)

- Running `init` on a fixture through the test helper starts no Jaeger or
  otelcol process.
- A real `indusk telemetry register` outside the tests still starts the
  daemon when none is running.
- After the everyday suite, no telemetry process runs from a temporary home;
  one left on purpose makes the guard fail, naming it.

## Depends on

- Nothing.

## Blocks

- [watcher-heartbeat](../watcher-heartbeat/brief.md): its proofs start and
  stop daemons on purpose, and need a machine where the only daemons are the
  ones they started.
