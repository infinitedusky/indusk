---
title: "Day step 4b — Monitor"
date: 2026-09-18
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Day step 4b — Monitor

## Goal

A behaviour promise broken in a local run is found by telemetry, recorded as
an incident, and sends the plan that owns it back to work — with no hosted
backend and no InDusk code inside the application (ADR D1–D10).

## Scope

### In Scope

- The mark convention (ADR D1) and its test side: the
  `@infinitedusky/indusk-mcp/testing/trace-shape` subpath (D3).
- The acceptance promise `every-commit-evaluated`, marked by the evaluator run
  (D10).
- `lib/promises/telemetry.ts` and `indusk promises status` (D4, D5).
- `indusk promises watch`: incidents (D6) and reopening by an appended
  Maintenance phase (D7); `promises check` refuses a fixed incident whose root
  cause is unwritten.
- `monitor` derived from files, with the quiet window (D8).
- Observed health, the `monitor` segment and reopened plans in the admin (D9).
- The end-to-end test (A24) in its own `e2e` project, and the docs.

### Out of Scope

- The always-on tier — `day-always-on`.
- The "test passed, system broke" badge — `day-contract`.
- Absence-type promises (`gates-ran-at-every-checkoff`) — Day step 5's ledger.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every row authored at a boundary; the Jaeger and OTLP-capture test helpers; this plan's worktree | — |
| Build Phase 1 | `testing/trace-shape` subpath; the evaluator's mark; `every-commit-evaluated` registered | `lib/eval/otel.ts` |
| Build Phase 2 | `lib/promises/telemetry.ts`; `indusk promises status` | `lib/telemetry/daemon.ts`, the registry |
| Build Phase 3 | `indusk promises watch`; incident writing; the unwritten-root-cause refusal; the Maintenance phase; reopened archived plans in `list_plans` | Build Phase 2 |
| Build Phase 4 | `monitor` in `lib/lifecycle.ts`; `getQuietWindowDays` | incidents from Build Phase 3 |
| Build Phase 5 | Health chips, sort, sidebar roll-up, `monitor` segment, reopened rendering in the admin | Build Phases 2–4 through subpaths |
| Build Phase 6 | The `e2e` vitest project and `day-monitor.e2e.test.ts`; the docs | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | A span marked with a promise and exported to a real local Jaeger is found by `indusk promises status` under that promise's name | Test Phase 1 | Build Phase 2 | planned |
| A2 | A failing evaluator run exports a span whose raw attributes and event say `every-commit-evaluated` was violated and why, readable with no InDusk code | Test Phase 1 | Build Phase 1 | planned |
| A3 | An evaluator run exports only its one marked span; nothing is added to spans that do not name a promise | Test Phase 1 | Build Phase 1 | planned |
| A4 | The trace-shape helper passes a test asserting a call upheld a promise under its expected parent | Build Phase 1 | Build Phase 1 | planned |
| A5 | The helper still passes after an added attribute or extra child span, and fails when the marked span is gone | Build Phase 1 | Build Phase 1 | planned |
| A6 | A test that asserts a promise through the helper, with the promise as its `"promise: <name>"` argument, satisfies `indusk promises check`'s test link with no other citation | Test Phase 1 | Test Phase 1 | planned |
| A7 | `indusk promises status` lists each behaviour promise with violations in the window, their trace ids, and last seen upheld | Test Phase 1 | Build Phase 2 | planned |
| A8 | A behaviour promise with no marked span in the window reads "not seen" — never "upheld", never zero violations | Test Phase 1 | Build Phase 2 | planned |
| A9 | State and structure promises are listed as watched by the suite, with no violation count | Test Phase 1 | Build Phase 2 | planned |
| A10 | With Jaeger unreachable, `status` names where it looked and exits 2; it never prints zero violations | Test Phase 1 | Build Phase 2 | planned |
| A11 | After a violation with no open incident, `watch` leaves one incident naming the promise, its traces, source `local` and the symptom, with the root cause unwritten, and `promises check` passes | Test Phase 1 | Build Phase 3 | planned |
| A12 | A later violation of a promise with an open incident adds its traces to that incident and opens no other | Test Phase 1 | Build Phase 3 | planned |
| A13 | A second `watch` over the same violations changes no file | Test Phase 1 | Build Phase 3 | planned |
| A14 | The owning plan reopens: `list_plans` lists it active with a Maintenance phase naming the incident, the appended phase passes the impl validator, and the admin shows it executing that phase | Test Phase 1 | Build Phase 5 | planned |
| A15 | `promises check` refuses an incident marked fixed whose root cause is still unwritten, naming the file | Test Phase 1 | Build Phase 3 | planned |
| A16 | A plan closed fewer than the window's days ago that holds a behaviour promise reads `monitor` in `list_plans` and on its admin plan bar, with the window's elapsed share | Test Phase 1 | Build Phase 5 | planned |
| A17 | The same plan closed more than the window ago, with no violation since, reads archived | Test Phase 1 | Build Phase 4 | planned |
| A18 | A violation recorded during the window keeps the plan in `monitor` from the violation's time, and the page says the window restarted | Test Phase 1 | Build Phase 5 | planned |
| A19 | A plan holding no behaviour promise never reads `monitor` | Test Phase 1 | Test Phase 1 | planned |
| A20 | The Promises page shows each behaviour promise's observed health: red when violated in the window, green when seen upheld, hollow "unverified" when not seen, amber when known-violated, grey when retired | Test Phase 1 | Build Phase 5 | planned |
| A21 | The page sorts red first and shows violations in the window and last seen for each behaviour promise | Test Phase 1 | Build Phase 5 | planned |
| A22 | With Jaeger unreachable every behaviour chip is hollow with "health unknown since …" and none is green | Test Phase 1 | Build Phase 5 | planned |
| A23 | A plan holding a red promise shows red in the sidebar | Test Phase 1 | Build Phase 5 | planned |
| A24 | End to end, on a scratch project with a green suite: a commit evaluated with a model that does not exist marks `every-commit-evaluated` violated in local Jaeger, `indusk promises watch` opens an incident with source `local`, and the owning plan reopens with a Maintenance phase | Build Phase 6 | Build Phase 6 | planned |

## Checklist

### Test Phase 1: Author every assertion at a boundary, RED

**Goal**: author every row that can be written against today's code through
the CLI, a tool call, HTTP, or a spawned evaluator, and register the rest.

- [x] Create this plan's worktree with the published command: `indusk worktree create day-monitor` (records the assignment; the admin and plan tools follow the plan into it)
- [ ] Helper `apps/indusk-mcp/src/__tests__/helpers/local-jaeger.ts`: starts the extension's Jaeger binary (`resolveBinary("jaeger")`) with in-memory storage on free ports, loads spans over OTLP/HTTP, stops it; throws when it cannot start. Used by the admin tests through a copy only if the admin cannot import it — decide in this item and record which
- [ ] Helper `apps/indusk-mcp/src/__tests__/helpers/otlp-capture.ts`: a local HTTP server accepting `POST /v1/traces` (OTLP/JSON and protobuf decoded by the collector-free path the evaluator's exporter uses) and exposing what it received, and a fake `claude` on `PATH` that exits 1 with the bad-model message or writes a scorecard
- [ ] Fixture extension of `helpers/promises-fixture.ts`: a behaviour promise owned by an archived plan with a retrospective carrying a "Landed on main at <sha>, <date>" line at a chosen date
- [ ] Author A2, A3 in `apps/indusk-mcp/src/__tests__/monitor-mark.test.ts` (spawn the evaluator through the hook's CLI mode with the fake `claude` and `OTEL_EXPORTER_OTLP_ENDPOINT` at the capture server)
- [ ] Author A6 in `apps/indusk-mcp/src/__tests__/monitor-check.test.ts` (a fixture test file whose text calls the helper with `"promise: <name>"`; the check reads text, so the helper need not exist)
- [ ] Author A1, A7–A10 in `apps/indusk-mcp/src/__tests__/monitor-status.test.ts` via `runCli` against the local Jaeger helper
- [ ] Author A11–A13, A15 in `apps/indusk-mcp/src/__tests__/monitor-watch.test.ts` via `runCli`
- [ ] Author A14 (tools half), A16–A19 (tools half) in `apps/indusk-mcp/src/__tests__/monitor-plans.test.ts` through `helpers/tool-call.ts`
- [ ] Author A14, A16, A18 (admin halves) and A20–A23 in `apps/indusk-admin/src/__tests__/http-promise-health.test.ts` over `next dev`, with a local Jaeger
- [ ] Run each file and read each failure: every red row fails on its own assertion, not on a missing import

#### Deferred to Build Phase 1

- **A4, A5** — the subject is the `testing/trace-shape` subpath, which Build Phase 1 creates; a file importing it cannot load before then. Body reviewed:

  ```typescript
  import { captureSpans, expectPromiseUpheld } from "@infinitedusky/indusk-mcp/testing/trace-shape";
  it("A4 — upheld under its parent", async () => {
    const spans = await captureSpans(() => fixtureCallThatUpholds());
    expectPromiseUpheld(spans, "promise: fixture-promise", { parent: "handle-request" });
  });
  it("A5 — tolerant of harmless change, strict on the mark", async () => {
    const spans = await captureSpans(() => fixtureCallWithExtraChild());
    expectPromiseUpheld(spans, "promise: fixture-promise");
    const unmarked = await captureSpans(() => fixtureCallWithoutMark());
    expect(() => expectPromiseUpheld(unmarked, "promise: fixture-promise")).toThrow(/fixture-promise/);
  });
  ```

#### Deferred to Build Phase 6

- **A24** — an end-to-end run that needs the real `claude` CLI, the telemetry daemon and the `e2e` vitest project Build Phase 6 creates; it runs on a developer machine, outside `pnpm test`, and is recorded in the retrospective. Procedure: scratch project with a green suite and `every-commit-evaluated` registered; `eval.model` set to a model that does not exist; commit; run the evaluator for it; `indusk promises watch`; assert the incident (source `local`) and the Maintenance phase on the owner.

#### Regression Guards

- **A6** — the check already counts a token directly inside a quote; the row pins that the helper's calling convention stays inside that rule, so it passes when written.
- **A19** — plans without behaviour promises must keep closing exactly as they do today; it passes when written and guards every later phase.

#### Test Phase 1 Verification

- [ ] A1–A3, A6–A23 authored; A6 and A19 pass; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-*.test.ts` and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-health.test.ts`)
- [ ] The two deferral bodies reviewed: each compiles at the phase it names and asserts what the row claims

#### Test Phase 1 Context

- [ ] Known Gotchas (tests): tests that read Jaeger start the real binary through `helpers/local-jaeger.ts`, never a stub; the evaluator is exercised through a fake `claude` and `helpers/otlp-capture.ts`

#### Test Phase 1 Document

- [ ] Changelog Unreleased entry opened in `apps/docs/src/changelog.md` for the monitor, filled in as phases land

### Build Phase 1: The mark

- [ ] `apps/indusk-mcp/src/lib/testing/trace-shape.ts`, exported as `./testing/trace-shape`: `captureSpans(fn)` with an in-memory exporter, `expectPromiseUpheld(spans, token, { parent? })`, `expectPromiseViolated(spans, token)`; containment matching; the token parsed from `"promise: <name>"`, refusing any other shape by name
- [ ] Mark the evaluator run: `runPersistentEval` and `runEvaluatorSync` (the modules the hook spawns, which resolve the package's own dependencies) wrap each evaluation in a span through `lib/eval/otel.ts` carrying `indusk.promise=every-commit-evaluated` and `indusk.promise.outcome`; on failure the `indusk.promise.violated` event with the failure line as `indusk.promise.symptom`. *Refines ADR D10: the spawned evaluator runs inside the package, so it uses the existing OpenTelemetry setup instead of a direct OTLP post from the hook.*
- [ ] Register `.indusk/promises/every-commit-evaluated.md` (behaviour, domain `gates`, state `enforced`, sites: the evaluator module, tests: `monitor-mark.test.ts`); confirm the owner by reading the archived plan that made commits evaluated (`agent-roles` is the candidate) and record why
- [ ] The testing extension's skill (`apps/indusk-mcp/extensions/testing/skill.md`): a section on asserting a promise through the trace-shape helper

#### Build Phase 1 Verification

- [ ] A2, A3, A4, A5 pass; A6 still passes (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-mark.test.ts src/__tests__/monitor-trace-shape.test.ts src/__tests__/monitor-check.test.ts`)
- [ ] `pnpm promises:check` passes with the new promise

#### Build Phase 1 Context

- [ ] Conventions: the promise mark (`indusk.promise`, `indusk.promise.outcome`, the `indusk.promise.violated` event) is plain OpenTelemetry set by the application; InDusk ships no runtime helper; tests assert it through `testing/trace-shape` with the promise token as the argument

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/promises.md`: marking a behaviour promise — the attributes, the event, the two-line snippet, and the test helper

### Build Phase 2: Reading Jaeger

- [ ] `apps/indusk-mcp/src/lib/promises/telemetry.ts`: `markedSpans(projectRoot, since)` — the query port from `daemonStatus()`, `GET /api/services`, then `GET /api/traces?service=…&tags={"indusk.promise":…}` per service; per-promise upheld and violated spans with trace ids and times; `JaegerUnreachable` naming the URL when it cannot connect. Exported through the `promises/registry` neighbour subpath the admin already reads, or its own, decided here
- [ ] `indusk promises status [--since <duration>]` in `src/bin/commands/promises.ts` and `cli.ts`: behaviour promises with violations, traces, last seen upheld or "not seen"; state and structure listed as watched by the suite; exit 0 / 2

#### Build Phase 2 Verification

- [ ] A1, A7, A8, A9, A10 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-status.test.ts`)

#### Build Phase 2 Context

- [ ] Architecture (indusk-mcp bullet): `indusk promises status` reads marked spans from the local Jaeger through `lib/promises/telemetry.ts`, the one query; unreachable is exit 2, never zero

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: `status`

### Build Phase 3: The loop

- [ ] `indusk promises watch [--source local|smoke|deployed]`: status, then open or extend incidents (ADR D6 fields, `## Root cause` written as `_Unwritten — a person writes this._`), traces deduplicated, `last_seen` only forward; writes plan documents, commits nothing
- [ ] Reopen (ADR D7): append `### Build Phase N: Maintenance — <incident>` with its four gates to the owner's impl, in place, archived or active; numbering from the owner's own phases; a plan with no impl gets one containing only that phase
- [ ] `list_plans` lists an archived plan with an unchecked Maintenance phase as active, reading it from the archive
- [ ] `promises check`: refuse an incident with `status: fixed` whose root cause is the unwritten line, naming the file
- [ ] A test runs `validate-impl-structure.js` over an owner's impl after `watch` appended to it, for a legacy impl (no test phases) and a test-phase impl

#### Build Phase 3 Verification

- [ ] A11, A12, A13, A15 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-watch.test.ts`)
- [ ] The tools half of A14 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-plans.test.ts -t A14`)

#### Build Phase 3 Context

- [ ] Conventions: `watch` opens or extends incidents and reopens the owner by an appended Maintenance phase in place; an incident cannot be fixed with its root cause unwritten

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: `watch`, the incident fields, reopening

### Build Phase 4: `monitor`

- [ ] `getQuietWindowDays(projectRoot)` in `lib/config.ts` — `promises.quiet_window_days`, default 7 in the reader. *Refines ADR D8's "ensured on update": the `promises` block already exists in every project, and `ensureConfigBlock` is keyed on the block's presence, so the default lives in the reader, as `getSweepTtlMinutes` does.*
- [ ] `lib/lifecycle.ts` derives `monitor` for an archived plan holding a behaviour promise while `now − max(closed, lastViolation) < window` (closed from the retrospective's landing line, else its `date`; lastViolation from its promises' incidents' `last_seen`), with the elapsed share; files only, no network
- [ ] `lifecycle-single-definition.test.ts` and `lifecycle-render-parity.test.ts` updated for the derived position

#### Build Phase 4 Verification

- [ ] A17 passes; the tools halves of A16 and A18 pass; A19 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-plans.test.ts`)

#### Build Phase 4 Context

- [ ] Conventions (the lifecycle entry): `monitor` is derived from the landing date and incidents, never from telemetry; `promises.quiet_window_days` defaults to 7 in the reader

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/plan-lifecycle.md`: `monitor` defined

### Build Phase 5: The admin

- [ ] Health on the Promises page (ADR D9): `markedSpans` read server-side with a two-second timeout, cached for the refresh interval; red, green, hollow "unverified", amber, grey chips under the render-parity pin; red sorts first; violations and last seen per behaviour row; "health unknown since <last successful read>" when unreachable
- [ ] Sidebar roll-up: a plan holding a red promise shows red
- [ ] The plan bar's `monitor` segment fills with the elapsed share and says it is time, not steps; "window restarted" after a violation; a reopened plan shows its Maintenance phase as active

#### Build Phase 5 Verification

- [ ] A14, A16, A18, A20, A21, A22, A23 pass (`pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-health.test.ts`)
- [ ] Admin node project green (`pnpm --filter indusk-admin exec vitest run --project node`)

#### Build Phase 5 Context

- [ ] Known Gotchas (admin entry): observed health reads Jaeger server-side with a timeout and never shows green it did not see; the `monitor` segment is the one time-filled segment

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: health chips, the sidebar roll-up, the `monitor` segment, reopened plans

### Build Phase 6: End to end, and what runs where

- [ ] An `e2e` vitest project for `apps/indusk-mcp` (`vitest.e2e.config.ts`, `include: ["e2e/**/*.e2e.test.ts"]`), and the default config excludes `e2e/`; root script `pnpm e2e`
- [ ] Author and run `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts` per the A24 procedure, against the running telemetry daemon and the real `claude` CLI
- [ ] `apps/docs/src/guide/index.md`: "What runs where" — in the repo, on the machine, always-on (planned in `day-always-on`); the application depends on none of it

#### Build Phase 6 Verification

- [ ] A24 passes: `pnpm e2e` on this machine, output recorded; `pnpm test` does not run it (checked by its test count)
- [ ] Root suite and the promises check (`pnpm test`)

#### Build Phase 6 Context

- [ ] Conventions: end-to-end tests live in `apps/indusk-mcp/e2e/`, run with `pnpm e2e`, need the `claude` CLI and the telemetry daemon, and are outside `pnpm test`

#### Build Phase 6 Document

- [ ] Changelog entry completed; `apps/docs/src/guide/promises.md` gains the loop diagram (run → span → Jaeger → `watch` → incident → Maintenance phase → quiet window → closed)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/testing/trace-shape.ts` | New subpath |
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts`, `evaluator-runner.ts` | The evaluator's mark |
| `apps/indusk-mcp/src/lib/promises/telemetry.ts` | New: the one Jaeger query |
| `apps/indusk-mcp/src/bin/commands/promises.ts`, `cli.ts` | `status`, `watch` |
| `apps/indusk-mcp/src/lib/promises/` | Incident writing, reopen, the unwritten-root-cause refusal |
| `apps/indusk-mcp/src/lib/lifecycle.ts`, `lib/config.ts` | `monitor`, the quiet window |
| `apps/indusk-mcp/src/tools/plan-tools.ts` | Reopened archived plans listed |
| `apps/indusk-admin/src/…` | Health, roll-up, `monitor` segment, reopened plans |
| `.indusk/promises/every-commit-evaluated.md` | New promise |
| `apps/indusk-mcp/e2e/`, `vitest.e2e.config.ts`, root `package.json` | The end-to-end project |
| Tests, helpers and docs named above | New and updated |

## Dependencies

- `day-promises` (closed), `admin-plan-worktrees` (closed; this plan's worktree is created with its command).
- The telemetry daemon and the `claude` CLI on the machine that runs A24.

## Notes

- Two refinements of the accepted ADR are recorded where they apply: the
  evaluator marks through `lib/eval/otel.ts` (Build Phase 1), and the quiet
  window's default lives in the reader (Build Phase 4).
