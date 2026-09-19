---
title: "Day step 4b — Monitor — Retrospective"
date: 2026-09-19
status: accepted
---

# Day step 4b — Monitor — Retrospective

## What We Set Out to Do

Close the promise loop on a laptop: a behaviour promise broken in a run is
found by telemetry, recorded as an incident, and sends the plan that owns it
back to work — with no hosted backend and no InDusk code inside the
application (brief; ADR D1–D10). The always-on tier was split out to
`day-always-on` at the brief.

## What Actually Happened

The loop works end to end. `pnpm e2e` runs it on a scratch project with the
real `claude` CLI and a model that does not exist: the evaluator fails, marks
`every-commit-evaluated` violated, the mark reaches the local-telemetry
daemon's Jaeger with no exporter configured, `indusk promises watch` opens an
incident with source `local`, and the owning plan gains a Maintenance phase.
Run on this repository, `promises status` already showed the evaluator
scoring this plan's own commits.

Shipped: the mark convention and `testing/trace-shape`; `promises status` and
`watch` over one query (`readPromiseMarks`); incidents written by text edit;
reopening by an appended Maintenance phase (with a trajectory row when the
owner has a trajectory); `monitor` derived from files; observed health, the
sidebar roll-up and the time-filled `monitor` segment in the admin; the `e2e`
vitest project. 61 files under `apps/`, +5,292 / −220, across eight build
phases after one test phase; 30 trajectory rows, all passing.

## Getting to Done

Most of the unplanned work was the loop's own blind spots, found by running
things rather than reading them:

- **The mark went nowhere by default.** The evaluator exported only when
  someone had set an endpoint by hand. It now exports to the local daemon
  whenever it runs (`eval.otel.enabled: false` is the off switch).
- **`claude` prints its errors on stdout.** The evaluator's error line took
  stderr alone and carried no reason. Checked by running the CLI.
- **Turbopack parsed the Jaeger binary.** The admin followed
  `promises/telemetry` → `telemetry/daemon.ts` → `createRequire().resolve(…/bin/jaeger)`
  and every project page 500'd. The daemon's read side became
  `telemetry/status.ts`.
- **The validator refused the appended phase** in an impl with a Test
  Trajectory: every phase must name a test. Asked, and chose to append a test
  row rather than add a "maintenance" no-tests reason — a new way to close a
  phase without a test.
- **Marks had no project.** Every project's evaluator marks the same promise
  under one service, so another project's failure would have read as ours;
  marks now carry `indusk.project`.
- **Falsification found six more** (A25–A30): a missing `claude` killed the
  evaluator before it marked anything (Node raises `ENOENT` as an uncaught
  `error` and never fires `close`); a non-JSON answer from the query port
  crashed `status` and 500'd the admin; aliases were never queried; the
  project id was the worktree folder's, so the trunk dropped every evaluation
  of plan work; `watch` reopened the trunk's copy of an owner being worked in
  a worktree; a full query was reported as an exact count.
- **A fresh worktree could not pass `pnpm test`**: the bundled admin
  (`apps/indusk-mcp/admin/`) is an ignored build artifact the worktree lacks.
  Nine package failures were that; the two left fail identically on trunk (the
  queued daemon-identity bug).

## What We Learned

- **A stub server in the test process cannot answer a `spawnSync`'d CLI.**
  `spawnSync` blocks the event loop the stub would answer from; the test times
  out rather than failing on its assertion. Spawn asynchronously when the
  child talks to the parent.
- **A bundler follows `require.resolve` of a binary.** Keep any module that
  resolves or spawns binaries out of an import graph a web app reads; split
  the read side into its own module.
- **Every `spawn` needs an `error` listener.** A missing binary emits `error`,
  never `close`; unheard, it is an uncaught exception, and the code after it —
  here, the promise mark — never runs.
- **Identity derived from a folder name breaks in worktrees.** Anything that
  must agree between the trunk and its worktrees (a project id) comes from the
  shared git directory, not `basename(cwd)`.
- **The loop proved itself before it was finished.** The evaluator's upheld
  mark for this plan's own commit was in Jaeger by Build Phase 2 — the first
  promise whose health the running system reports.

## What We'd Do Differently

- **Scope the formatter to the files you changed.** Two formatter runs over
  whole directories swept unrelated files — a 1,456-line fixture reflow and an
  admin file reformatted with the root config — both undone later.
- **Make a fresh worktree test-ready.** The bundle step belongs in worktree
  setup (or `pnpm test` should say why the admin tests cannot run), not in
  someone's memory after nine failures.
- **Read the test plan's words against the tools' output shapes.** "`list_plans`
  shows it" assumed active plans listed their phases; they did not, and
  falsification is where that surfaced.

## Insights Worth Carrying Forward

- A promise loop's own failure modes are promises too: the evaluator failing
  silently is exactly the case `every-commit-evaluated` exists to catch, and
  falsification found three ways it could fail without a mark.
- Running the real thing early (`claude` with a bad model, the admin under
  Turbopack, `status` on this repository) found more than reading did.

## Quality and Shape

- No recurring lint or type errors; no Biome rule proposed. The formatter
  sweeps were a process slip, not a rule gap.
- **Shape**: 4 findings across 10 phases (Test Phase 1: incident fields into
  the shared fixture; Build Phase 1: the claude exit reason out of `otel.ts`;
  Build Phase 3: `justifyLateRow` extracted; Build Phase 7: an unbraced nested
  loop), 0 judged wrong by a person. Six phases raised nothing.
