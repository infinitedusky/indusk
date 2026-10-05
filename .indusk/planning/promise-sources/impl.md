---
title: "Promise sources — local and production, side by side"
date: 2026-10-04
status: in-progress
trajectory: required
test_phases: required
gate_policy: ask
---

# Promise sources — Implementation

## Goal

Every promise reader shows a project's local and production health side by
side, each source's failure its own, with the alarm raised from production when
there is one. See [brief.md](brief.md), [test-plan.md](test-plan.md) and
[adr.md](adr.md).

## Scope

### In Scope
- `resolveMarkSources` + `readSources` (ADR D1, D2), with the alarm source
  (D5) as the default for the one-source read
- `promises status` per source and its exit code (D3); `watch --source` (D6)
- `promise_health`'s `sources` and the catchup line (D4)
- The admin: a chip per source, a banner per failed source, the sidebar from
  the alarm source (D7)

### Out of Scope
- A configurable source list; more than two sources
- The timeline ([promise-timeline](../promise-timeline/brief.md), next)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A6 red over boundaries; A7 a regression guard; a two-source fixture | `startLocalJaeger`, `startAlwaysOnServer`, `promiseProject`, `toolCaller`, the admin's `next dev` helper |
| Build Phase 1 | `resolveMarkSources`, `readSources`, `SourceRead`, the alarm source | `resolveMarkSource` (removed), `readPromiseMarks`, `probeWatcher` |
| Build Phase 2 | `status` per source; `watch --source` | `readSources`, `readPromiseMarks({ source })` |
| Build Phase 3 | `promise_health.sources`; the catchup line | `readSources`, `health.ts` |
| Build Phase 4 | the admin's chips per source, banners, the sidebar | `readSources` through the `promises/telemetry` subpath |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | `promises status` for a project naming a production server shows two sections, local and production, each with that source's own violations and upheld marks | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A2 | `promise_health` reports both sources, each with its own rows, and says which source each violation came from | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A3 | The admin's Promises page shows a chip per source for each behaviour promise, so one promise reads green in production and red locally on the same page | Test Phase 1 | Build Phase 4 | written | apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A4 | When one source is unreachable or watcher blind, every reader says so for that source and still shows the other source's health | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts, apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A5 | `promises watch --source deployed` records incidents from the production server and `--source local` from the laptop: a violation only in production is recorded by the first and not the second | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A6 | A violation only in local is shown, but does not raise the alarm when a production source exists: no red sidebar mark in the admin, and `needsAttention` names only production's | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts, apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A7 | A project that names no production server behaves exactly as today: one source, local, with every reader's output unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author all seven over boundaries (the CLI, the MCP tool, the admin
over HTTP), against a real local daemon as `local` and a real always-on server
as `production`, holding different marks. Nothing is deferred: every subject
exists today and answers wrongly.

- [x] Create/confirm this plan's worktree (`indusk worktree create promise-sources`, which records the assignment) — worktree-per-plan default
- [x] `apps/indusk-mcp/src/__tests__/helpers/two-sources.ts`: start a local daemon (`startLocalJaeger`) and an always-on server (`startAlwaysOnServer`), load marks into each, and build a promise project naming the server in `promises.jaeger` (`url`, `otlp_url`, `credential_env`). It returns both, the project, and a `stop` that stops both; it throws when either cannot start
- [x] Author A1, A2, A4 (CLI and tool halves), A5, A6 (tool half) and A7 in `apps/indusk-mcp/src/__tests__/promise-sources.test.ts`, added to `SYSTEM`. Marks:
  - `seat-held` is violated locally and upheld in production;
  - `seat-released` is upheld locally and violated in production.
  
  The assertions:
  - A1: status prints a `local` and a `production` section, each naming its URL, with its own counts.
  - A2: the tool's `sources` has both, with per-source rows.
  - A4: with the server stopped, status names production as unreachable, still prints local, and exits 2; the tool reports production failed and local's rows.
  - A5: `watch --source deployed` opens an incident for `seat-released` only; `--source local` opens one for `seat-held` only.
  - A6: the tool's top-level `needsAttention` holds `seat-released` and not `seat-held`.
  - A7: a project with no `promises.jaeger` reads as today: one block per promise and the same tool shape.
- [x] Author A3, A4 (admin half) and A6 (admin half) in `apps/indusk-admin/src/__tests__/http-promise-sources.test.ts`, on the `http-promise-remote` pattern. The marks are the same, read from the Promises page and the project page:
  - A3: each behaviour promise row carries a `data-source="local"` and a `data-source="production"` chip with different `data-health`.
  - A4: with the server stopped, production's section says unknown and local's chips still show.
  - A6: the sidebar's red mark follows production, not local.
- [x] Run each and read each failure. A1–A6 should fail on their own assertions (one source read today); A7 should pass. A red that is a load or setup failure is not authored
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Regression Guards

- **A7** — what every project without a production server sees today, and must keep seeing. It passes when written; it goes red if the two-source change alters a one-source project's output.

#### Test Phase 1 Verification

- [x] A1–A6 fail on their own assertions and A7 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources`; `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-promise-sources`); the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js`)

### Build Phase 1: sources, read per source

- [x] `lib/promises/telemetry.ts`: `resolveMarkSources(root)` → `MarkSource[]` with `name` (`local` from the daemon record, `production` from `promises.jaeger` with today's refusals per source). Remove `resolveMarkSource` (one definition). `alarmSource(sources)` = production if present, else local
  - As built: `resolveMarkSources` returns `ResolvedSource[]` — each `{ name, ok: true, source }` or `{ name, ok: false, error }` — because a source can fail before it is read (no daemon running, a missing credential), and throwing there would let a laptop with no daemon blank production. `sourceNames(root)` is the I/O-free list; `alarmSource(names)` takes names
- [x] `readSources(root, registry, opts)` → `SourceRead[]`: each source probed and read, with `JaegerUnreachable` and `WatcherBlind` caught into that source's `{ ok: false, kind, where, reason }`. `readPromiseMarks(root, registry, { source? })` reads one named source (the alarm source by default) and throws as today
- [x] Export the new names through `promises/telemetry` (the admin's subpath)
- [x] (discovered) `lib/promises/probe.ts`: when the probe's send fails, ask the query API before calling the watcher blind — a server that is down entirely is unreachable, not blind (A4 needs production *unreachable*; today a stopped server reads *watcher blind* because the send fails first). Bounded by the caller's `waitMs`
- [x] Shape (`apps/indusk-mcp/src/lib/promises/telemetry.ts`) — reviewed, left as-is: each new unit (sourceNames, alarmSource, resolveMarkSources, readSources, readSource) does one job with a seam the tests reach; whether source resolution leaves this file is a module boundary, which /cleanup owns

#### Build Phase 1 Verification

- [x] A7 still passes, and the existing promise suites are unchanged (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status src/__tests__/monitor-watch src/__tests__/watcher-probe src/__tests__/always-on-source src/__tests__/always-on-health-tool src/__tests__/watcher-expect-every`)
- [x] `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 1 Context

- [x] guard: `promise-sources.test.ts` A4 carries `lesson: one-dead-source-never-hides-another` — a read over several backends returns each one's failure as that backend's result, never as the whole read's

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/promises.md`, the library paragraph: `resolveMarkSources`, `readSources`, the alarm source

### Build Phase 2: status per source, and watch --source

- [ ] `bin/commands/promises.ts` `status`: one section per source (header: name and URL), today's block layout inside each. Exit 0 when every source answered and heard, 2 when any did not (after printing the rest)
- [ ] `watch --source`: `deployed` reads `production`, refused naming `promises.jaeger` when none is set; `local`, `smoke` and `desk` read `local` (`lib/promises/watch.ts` takes the source name)

#### Build Phase 2 Verification

- [ ] A1 and A5 pass, A7 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status src/__tests__/monitor-watch src/__tests__/watch-reopen-collision`)
- [ ] `tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 2 Context

- [ ] `apps/indusk-mcp/CLAUDE.md` is near its budget, so a context entry goes to the guard instead: `promise-sources.test.ts` A5 carries `lesson: a-flag-that-names-a-source-must-choose-it` — a `--source` that only labels its output reports production from a laptop

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: status per source and its exit codes; `watch --source` and what each value reads

### Build Phase 3: promise_health per source, and catchup

- [ ] `lib/promises/health.ts` + `tools/plan-tools.ts`: `promise_health` adds `sources: [{ name, source, ok, promises, needsAttention } | { name, source, ok: false, kind, reason }]`. Top-level `source`, `promises` and `needsAttention` keep the alarm source's, so existing consumers are unchanged. The tool errors only when no source can be read
- [ ] `apps/indusk-mcp/skills/catchup.md` (and the installed copy): name the source of each raised violation; a failed source is said on its own line

#### Build Phase 3 Verification

- [ ] A2 passes, and the tool halves of A4 and A6 pass (`… src/__tests__/promise-sources -t "A2|A4|A6"`); `always-on-health-tool`, `watcher-probe` and `watcher-expect-every` unchanged; `skill-sync-parity` passes
- [ ] `tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 3 Context

- [ ] guard: `promise-sources.test.ts` A6 carries `lesson: the-alarm-comes-from-production-when-there-is-one` — a local break during development is work in progress, not an alarm

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/skills/catchup.md`: the source of a raised violation; `apps/docs/src/guide/promises.md`: a "Local and production" section

### Build Phase 4: the admin, per source

- [ ] `apps/indusk-admin/src/lib/promise-health.ts`: `readHealth` returns one cached read per source (`readSources`); `healthRows` per source; `redPlans` from the alarm source
- [ ] The Promises page: one chip per source per behaviour promise (`data-source`), labelled with the source name, through `HealthChip`. A failed source's banner (unknown health or *watcher blind*) sits in its own section. With one source the page renders as today
- [ ] The project layout's sidebar: the red mark from the alarm source

#### Build Phase 4 Verification

- [ ] A3, A4 and A6 pass, and the admin's existing promise tests are unchanged (`pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-promise-sources src/__tests__/http-promise-health src/__tests__/http-promise-remote src/__tests__/http-watcher-blind`); admin `tsc` clean
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a behaviour promise has one chip per source; the sidebar's red follows the alarm source

#### Build Phase 4 Document

- [ ] Admin overview (`apps/docs/src/reference/admin-ui/overview.md`): chips per source; `apps/docs/src/changelog.md` Unreleased, Added: local and production side by side

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/telemetry.ts` | `resolveMarkSources`, `readSources`, the alarm source |
| `apps/indusk-mcp/src/bin/commands/promises.ts`, `lib/promises/watch.ts` | status per source; `--source` reads it |
| `apps/indusk-mcp/src/lib/promises/health.ts`, `src/tools/plan-tools.ts` | `sources` |
| `apps/indusk-mcp/skills/catchup.md` | the source of a raised violation |
| `apps/indusk-admin/src/lib/promise-health.ts`, `components/Promises.tsx`, `components/PromiseHealth.tsx`, the promises page and the project layout | chips per source; the sidebar |
| tests | `promise-sources.test.ts`, `helpers/two-sources.ts`, admin `http-promise-sources.test.ts` |
