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
| A1 | `promises status` for a project naming a production server shows two sections, local and production, each with that source's own violations and upheld marks | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A2 | `promise_health` reports both sources, each with its own rows, and says which source each violation came from | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A3 | The admin's Promises page shows a chip per source for each behaviour promise, so one promise reads green in production and red locally on the same page | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A4 | When one source is unreachable or watcher blind, every reader says so for that source and still shows the other source's health | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts, apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A5 | `promises watch --source deployed` records incidents from the production server and `--source local` from the laptop: a violation only in production is recorded by the first and not the second | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A6 | A violation only in local is shown, but does not raise the alarm when a production source exists: no red sidebar mark in the admin, and `needsAttention` names only production's | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts, apps/indusk-admin/src/__tests__/http-promise-sources.test.ts |
| A7 | A project that names no production server behaves exactly as today: one source, local, with every reader's output unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A8 | A `promises.jaeger` that is not an object, or names no `url` or no `credential_env`, is production's own refusal naming the missing key: `status` still prints local's section and exits 2, `promise_health` reports local's rows with production `ok: false`, and the admin still draws local's chips | Phase 0 | Build Phase 5 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A9 | A production whose intake and query port accept connections and never answer does not hold the other source past the reader's budget: with a 2 s `timeoutMs`, `readSources` returns within 3 s, local `ok: true`, production `ok: false` | Phase 0 | Build Phase 5 | passing | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |
| A10 | Advice for a failed source comes from the failure, not from re-reading the config: with `"jaeger": "https://…"`, neither `promises status` nor `promises watch --source deployed` prints `undefined`, and both name `promises.jaeger` | Build Phase 6 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/promise-sources.test.ts |

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

- [x] `apps/docs/src/reference/cli/promises.md`, the library paragraph: `resolveMarkSources`, `readSources`, the alarm source

### Build Phase 2: status per source, and watch --source

- [x] `bin/commands/promises.ts` `status`: one section per source (header: name and URL), today's block layout inside each. Exit 0 when every source answered and heard, 2 when any did not (after printing the rest)
  - As built (refines ADR D3): exit 2 when the **alarm source** could not be read; a failed `local` beside an answering `production` is printed in its section and exits 0. Under "any source", `always-on-source.test.ts` A10 — status on a production-naming project with no local daemon, asserting exit 0 — goes red, and every laptop without a running daemon would fail every status run. A4 (production down → exit 2) holds either way
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] `watch --source`: `deployed` reads `production`, refused naming `promises.jaeger` when none is set; `local`, `smoke` and `desk` read `local` (`lib/promises/watch.ts` takes the source name)

#### Build Phase 2 Verification

- [x] A1 and A5 pass, A7 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status src/__tests__/monitor-watch src/__tests__/watch-reopen-collision`)
- [x] `tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/CLAUDE.md` is near its budget, so a context entry goes to the guard instead: `promise-sources.test.ts` A5 carries `lesson: a-flag-that-names-a-source-must-choose-it` — a `--source` that only labels its output reports production from a laptop

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/promises.md`: status per source and its exit codes; `watch --source` and what each value reads

### Build Phase 3: promise_health per source, and catchup

- [x] `lib/promises/health.ts` + `tools/plan-tools.ts`: `promise_health` adds `sources: [{ name, source, ok, promises, needsAttention } | { name, source, ok: false, kind, reason }]`. Top-level `source`, `promises` and `needsAttention` keep the alarm source's, so existing consumers are unchanged. The tool errors only when no source can be read
  - As built: when the alarm source fails beside one that answered, the top level carries its failure in the shape a session already reads as "nobody could look" — `promises: null`, `needsAttention: null`, `error`, and `blind: true` when blind — with the other source's rows under `sources`. When every source fails the tool errors with the alarm source's error, so a one-source project fails exactly as before
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] `apps/indusk-mcp/skills/catchup.md` (and the installed copy): name the source of each raised violation; a failed source is said on its own line

#### Build Phase 3 Verification

- [x] A2 passes, and the tool halves of A4 and A6 pass (`… src/__tests__/promise-sources -t "A2|A4|A6"`); `always-on-health-tool`, `watcher-probe` and `watcher-expect-every` unchanged; `skill-sync-parity` passes
- [x] `tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 3 Context

- [x] guard: `promise-sources.test.ts` A6 carries `lesson: the-alarm-comes-from-production-when-there-is-one` — a local break during development is work in progress, not an alarm

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/skills/catchup.md`: the source of a raised violation; `apps/docs/src/guide/promises.md`: a "Local and production" section

### Build Phase 4: the admin, per source

- [x] `apps/indusk-admin/src/lib/promise-health.ts`: `readHealth` returns one cached read per source (`readSources`); `healthRows` per source; `redPlans` from the alarm source
- [x] The Promises page: one chip per source per behaviour promise (`data-source`), labelled with the source name, through `HealthChip`. A failed source's banner (unknown health or *watcher blind*) sits in its own section. With one source the page renders as today
  - As built: the alarm source's chip leads the row. `http-promise-remote.test.ts` reads a row's *first* chip, and on a production-naming project with no local daemon that is the chip that raises; ordering local first turned it *unverified*. A promise red in any source sorts first; only the alarm source marks the sidebar
- [x] The project layout's sidebar: the red mark from the alarm source
- [x] Shape (`apps/indusk-admin/src/components/Promises.tsx`) — reviewed, left as-is: the new `SourceBanner` and the per-source `PromiseStateCell` are named units with one job each, and `chipsOf` is the one place a row's chips are decided; the file was already 440 lines before this phase, and splitting it is an inter-file question for /cleanup

#### Build Phase 4 Verification

- [x] A3, A4 and A6 pass, and the admin's existing promise tests are unchanged (`pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-promise-sources src/__tests__/http-promise-health src/__tests__/http-promise-remote src/__tests__/http-watcher-blind`); admin `tsc` clean
- [x] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear
  - `pnpm test`: mcp 1677 passed / 5 skipped, admin 350 passed; `test:system`: 116 passed. The first `pnpm test` run failed 25 admin HTTP tests on socket errors and left 10 daemons (killed): `next dev` servers died under turbo's parallel mcp + admin load. Alone, the admin's node project passed 204/204 with no leak, and the rerun of `pnpm test` was green. `http-promise-sources` adds two daemon + server + `next dev` setups to that run; if the flake recurs, it is the first candidate to move out of it

#### Build Phase 4 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a behaviour promise has one chip per source; the sidebar's red follows the alarm source

#### Build Phase 4 Document

- [x] Admin overview (`apps/docs/src/reference/admin-ui/overview.md`): chips per source; `apps/docs/src/changelog.md` Unreleased, Added: local and production side by side

### Build Phase 5: Falsification — a misconfigured or silent production must not take local down with it

**Goal**: verify whether "one dead source never hides another" (ADR D2) holds against two failures found by reading the built code. Each row is one hypothesis that is red today; each item below is the fix it needs.

- **A8**: `resolveProduction` calls `named.url.trim()`. A config of `"jaeger": "https://…"` (a string where an object belongs) or one with no `url` throws a `TypeError`. That is not `JaegerUnreachable`, so `resolveMarkSources` rethrows it and the whole read dies: `status` prints a stack trace and no local section, `promise_health` errors outright, and the admin's catch-all marks every source unknown, local included. A missing `credential_env` is not a crash but is refused as "names undefined", which names nothing to fix.
- **A9**: `probeWatcher` sends with `sendWatcherSpan`'s default 5 s timeout whatever `waitMs` the caller passed, then (since Build Phase 1) asks the query API with up to `waitMs` more. A production host that accepts connections and never answers holds a 2 s admin read for about 7 s, and `readSources` waits for every source, so local's chips and the sidebar wait with it on every refresh.

- [x] `lib/promises/telemetry.ts` `resolveProduction`: check the shape of `promises.jaeger` before using it. Not an object, a `url` that is not a non-empty string, or a `credential_env` that is not a non-empty string is a `JaegerUnreachable` naming the key (`promises.jaeger`, `promises.jaeger.url`, `promises.jaeger.credential_env`), so it is production's failure and local is still read
- [x] `lib/promises/probe.ts`: the probe's send is bounded by the caller's `waitMs` (the `timeoutMs` argument `sendWatcherSpan` already takes), so the whole probe of an unanswering source fits the reader's budget

#### Build Phase 5 Verification

- [x] A8 and A9 pass, and A1–A7 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/always-on-falsification src/__tests__/watcher-probe`); the leak guard is clear afterwards
- [x] `tsc --noEmit` clean in both packages; Biome clean on the changed files

#### Build Phase 5 Context

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] guard: A8 carries `lesson: one-dead-source-never-hides-another` — the lesson gains the case: a source's *configuration* failing is that source's failure too, not the read's

#### Build Phase 5 Document

- [x] `apps/docs/src/reference/cli/promises.md`: a malformed `promises.jaeger` is refused for production by key while local is still read; the probe's send is bounded by the reader's timeout

### Build Phase 6: Cleanup — sources get their own module; one piece of advice; the health axis in one file

**Goal**: decompose what this plan grew into the boundaries it settled. Source resolution and the per-source reads are a second job inside the Jaeger query module, and they form an import cycle with the probe. The "what to do about this failure" advice is written twice and is wrong twice. The admin's per-source banner is a health-axis component in the table's file. Each item is one extraction; the advice extraction also fixes a defect the duplication was hiding (A10).

- [ ] Extract source resolution and the per-source reads from `lib/promises/telemetry.ts` (640 lines) into `lib/promises/sources.ts`. The moved units: `SourceName`, `MarkSource`, `ResolvedSource`, `sourceNames`, `alarmSource`, `resolveMarkSources`, `resolveLocal`, `namedServer`, `resolveProduction`, `INTAKE_CONFIG_KEY`, `ReadMarksOptions`, `readPromiseMarks`, `SourceRead`, `readSources`, `failedRead`, `readSource`. `telemetry.ts` keeps the Jaeger query layer: endpoints, `jaegerGet`, span parsing, `markedSpans`, `newestMark`, `silencePastExpectation`. Basis: one reason to change per module. Which Jaeger to ask, and reading each, changes for different reasons than how to ask one. It also ends today's `telemetry.ts` ⇄ `probe.ts` circular import: `sources` imports both, and neither imports `sources`
- [ ] Add the `./promises/sources` subpath to `apps/indusk-mcp/package.json` `exports` beside `./promises/telemetry`, and move the importers to it: `bin/commands/promises.ts`, `lib/promises/{health,watch}.ts`, the admin's `lib/promise-health.ts`, and the tests (`promise-sources`, `always-on-cleanup`, `always-on-falsification`). Do not re-export from `telemetry` — that would rebuild the cycle the move removes
- [ ] Extract `sourceAdvice(read)` into `lib/promises/sources.ts`, built from the failure (its `name`, `kind` and `where`), never from re-reading the config. `status`'s `failureText` and `watch`'s hint in `bin/commands/promises.ts` each re-read `promises.jaeger` and print `named.url` and `named.credential_env`. Both print `undefined` for the config A8 now refuses. One definition, two callers; a refusal whose `where` names `promises.jaeger` gets no "check it is up" advice, because the fix is in the file
- [ ] Move `SourceBanner` and the `SourceObserved` / `SourceChip` types from `apps/indusk-admin/src/components/Promises.tsx` (505 lines) into `components/PromiseHealth.tsx`, the observed-health axis file earlier cleanup split out. Basis: react's one-component-per-file for non-trivial components. The banner is that axis's, not the table's
- [ ] Move the crossed marks — `seat-held` broken locally and upheld in production, `seat-released` the reverse — from `promise-sources.test.ts`'s `marks()` into `helpers/two-sources.ts` as an exported `crossedMarks()`. Use it in the admin's `http-promise-sources.test.ts`, whose A3/A4 setup restates the same eight lines. Basis: the fixture states the contrast both suites assert against; two copies drift
- [ ] Extract `withEnv(vars, fn)` into `apps/indusk-mcp/src/__tests__/helpers/` for the save/set/restore of `INDUSK_HOME` and the credential. It is written out three times in `promise-sources.test.ts` (`health()`, A8's third test, A9). Rule of three
- [ ] (reviewed `apps/indusk-mcp/src/tools/plan-tools.ts` — left as-is: over its cap before this plan, which changed one description string)
- [ ] (reviewed `apps/indusk-admin/src/lib/promise-health.ts` beside `lib/promises/health.ts` — left as-is: both turn marks into per-promise rows, but for different readers. The admin's `healthOf` judges a chip colour, including amber and grey from declared state; the tool's `healthRows` counts unrecorded traces against incidents. Merging them would couple a UI judgment to the tool's report shape)
- [ ] (reviewed `apps/docs/src/changelog.md` and `apps/docs/src/reference/cli/promises.md` — left as-is: docs, over the cap by accretion; the reference's sections are per command and each is cohesive)

#### Build Phase 6 Verification

- [ ] A10: with `"jaeger": "https://…"`, `promises status` and `promises watch --source deployed` print no `undefined` and name `promises.jaeger`
- [ ] Behaviour parity: A1–A9 and the existing promise suites still pass after the move (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status src/__tests__/monitor-watch src/__tests__/watcher-probe src/__tests__/always-on-source src/__tests__/always-on-health-tool src/__tests__/always-on-falsification src/__tests__/always-on-cleanup`; admin: `vitest run src/__tests__/http-promise-sources src/__tests__/http-promise-health src/__tests__/http-promise-remote src/__tests__/http-watcher-blind` and the component tests); `tsc` clean in both packages; the leak guard clear
- [ ] No import cycle between `telemetry.ts` and `probe.ts`: `grep` finds no `./telemetry` import of `probe` (`telemetry.ts` imports nothing from `probe.ts`)

#### Build Phase 6 Context

- [ ] The two lessons that point at `lib/promises/telemetry.ts` for `readSources` / `alarmSource` (`one-dead-source-never-hides-another`, `the-alarm-comes-from-production-when-there-is-one`) point at `lib/promises/sources.ts`; `apps/indusk-admin/CLAUDE.md`'s Promises entry names the `promises/sources` subpath; `indusk context check-pointers` passes

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/cli/promises.md`, the library paragraph: sources and reads come from `@infinitedusky/indusk-mcp/promises/sources`, the query layer from `promises/telemetry`

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/telemetry.ts` | `resolveMarkSources`, `readSources`, the alarm source |
| `apps/indusk-mcp/src/bin/commands/promises.ts`, `lib/promises/watch.ts` | status per source; `--source` reads it |
| `apps/indusk-mcp/src/lib/promises/health.ts`, `src/tools/plan-tools.ts` | `sources` |
| `apps/indusk-mcp/skills/catchup.md` | the source of a raised violation |
| `apps/indusk-admin/src/lib/promise-health.ts`, `components/Promises.tsx`, `components/PromiseHealth.tsx`, the promises page and the project layout | chips per source; the sidebar |
| tests | `promise-sources.test.ts`, `helpers/two-sources.ts`, admin `http-promise-sources.test.ts` |
