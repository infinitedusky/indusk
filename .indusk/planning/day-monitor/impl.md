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
| A1 | A span marked with a promise and exported to a real local Jaeger is found by `indusk promises status` under that promise's name | Test Phase 1 | Build Phase 2 | passing |
| A2 | A failing evaluator run exports a span whose raw attributes and event say `every-commit-evaluated` was violated and why, readable with no InDusk code | Test Phase 1 | Build Phase 1 | passing |
| A3 | An evaluator run exports only its one marked span; nothing is added to spans that do not name a promise | Test Phase 1 | Build Phase 1 | passing |
| A4 | The trace-shape helper passes a test asserting a call upheld a promise under its expected parent | Build Phase 1 | Build Phase 1 | passing |
| A5 | The helper still passes after an added attribute or extra child span, and fails when the marked span is gone | Build Phase 1 | Build Phase 1 | passing |
| A6 | A test that asserts a promise through the helper, with the promise as its `"promise: <name>"` argument, satisfies `indusk promises check`'s test link with no other citation | Test Phase 1 | Test Phase 1 | passing |
| A7 | `indusk promises status` lists each behaviour promise with violations in the window, their trace ids, and last seen upheld | Test Phase 1 | Build Phase 2 | passing |
| A8 | A behaviour promise with no marked span in the window reads "not seen" — never "upheld", never zero violations | Test Phase 1 | Build Phase 2 | passing |
| A9 | State and structure promises are listed as watched by the suite, with no violation count | Test Phase 1 | Build Phase 2 | passing |
| A10 | With Jaeger unreachable, `status` names where it looked and exits 2; it never prints zero violations | Test Phase 1 | Build Phase 2 | passing |
| A11 | After a violation with no open incident, `watch` leaves one incident naming the promise, its traces, source `local` and the symptom, with the root cause unwritten, and `promises check` passes | Test Phase 1 | Build Phase 3 | passing |
| A12 | A later violation of a promise with an open incident adds its traces to that incident and opens no other | Test Phase 1 | Build Phase 3 | passing |
| A13 | A second `watch` over the same violations changes no file | Test Phase 1 | Build Phase 3 | passing |
| A14 | The owning plan reopens: `list_plans` lists it active with a Maintenance phase naming the incident, the appended phase passes the impl validator, and the admin shows it executing that phase | Test Phase 1 | Build Phase 5 | passing |
| A15 | `promises check` refuses an incident marked fixed whose root cause is still unwritten, naming the file | Test Phase 1 | Build Phase 3 | passing |
| A16 | A plan closed fewer than the window's days ago that holds a behaviour promise reads `monitor` in `list_plans` and on its admin plan bar, with the window's elapsed share | Test Phase 1 | Build Phase 5 | passing |
| A17 | The same plan closed more than the window ago, with no violation since, reads archived | Test Phase 1 | Build Phase 4 | passing |
| A18 | A violation recorded during the window keeps the plan in `monitor` from the violation's time, and the page says the window restarted | Test Phase 1 | Build Phase 5 | passing |
| A19 | A plan holding no behaviour promise never reads `monitor` | Test Phase 1 | Test Phase 1 | passing |
| A20 | The Promises page shows each behaviour promise's observed health: red when violated in the window, green when seen upheld, hollow "unverified" when not seen, amber when known-violated, grey when retired | Test Phase 1 | Build Phase 5 | passing |
| A21 | The page sorts red first and shows violations in the window and last seen for each behaviour promise | Test Phase 1 | Build Phase 5 | passing |
| A22 | With Jaeger unreachable every behaviour chip is hollow with "health unknown since …" and none is green | Test Phase 1 | Build Phase 5 | passing |
| A23 | A plan holding a red promise shows red in the sidebar | Test Phase 1 | Build Phase 5 | passing |
| A24 | End to end, on a scratch project with a green suite: a commit evaluated with a model that does not exist marks `every-commit-evaluated` violated in local Jaeger, `indusk promises watch` opens an incident with source `local`, and the owning plan reopens with a Maintenance phase | Build Phase 6 | Build Phase 6 | passing |
| A25 | With `claude` missing from `PATH`, an evaluator run exports `every-commit-evaluated` violated with a symptom naming the missing CLI, and writes an error result — it does not die on an uncaught spawn error with nothing marked | Build Phase 7 | Build Phase 7 | planned |
| A26 | When the daemon's recorded query port answers with a body that is not JSON, `promises status` exits 2 naming the URL (no stack trace) and every admin project page still renders 200, with behaviour chips hollow and "health unknown" | Build Phase 7 | Build Phase 7 | planned |
| A27 | A span marked with one of a promise's `aliases` is counted under the promise by `status` and `watch` | Build Phase 7 | Build Phase 7 | planned |
| A28 | In a project with no configured group id, an evaluation of a commit made in a plan worktree is marked with the same project id `promises status` uses at the trunk, so the trunk counts it | Build Phase 7 | Build Phase 7 | planned |
| A29 | When a violated promise's owner is assigned to a worktree, `watch` appends the Maintenance phase to the worktree's copy of the impl, and `list_plans` shows it | Build Phase 7 | Build Phase 7 | planned |
| A30 | When a Jaeger query returns as many traces as the query limit, `status` reports the count as a lower bound ("at least N violations"), never as exact | Build Phase 7 | Build Phase 7 | planned |

## Checklist

### Test Phase 1: Author every assertion at a boundary, RED

**Goal**: author every row that can be written against today's code through
the CLI, a tool call, HTTP, or a spawned evaluator, and register the rest.

- [x] Create this plan's worktree with the published command: `indusk worktree create day-monitor` (records the assignment; the admin and plan tools follow the plan into it)
- [x] Helper `apps/indusk-mcp/src/__tests__/helpers/local-jaeger.ts`: starts the extension's Jaeger binary (`resolveBinary("jaeger")`) with in-memory storage on free ports, loads spans over OTLP/HTTP, stops it; throws when it cannot start. Used by the admin tests through a copy only if the admin cannot import it — decide in this item and record which. **Decided:** it starts the extension's daemon through the built CLI (`telemetry start --otlp-port 0 --ui-port 0`) in a caller-owned `INDUSK_HOME`, so `status` finds it through `telemetry.json` exactly as on a developer's machine; node built-ins only, and the admin imports it by path — no copy
- [x] Helper `apps/indusk-mcp/src/__tests__/helpers/otlp-capture.ts`: a local HTTP server accepting `POST /v1/traces` (OTLP/JSON and protobuf decoded by the collector-free path the evaluator's exporter uses) and exposing what it received, and a fake `claude` on `PATH` that exits 1 with the bad-model message or writes a scorecard. **Found while writing it:** the real CLI prints the bad-model message on **stdout** with stderr empty (checked 2026-09-18), so today's evaluator error (`claude exited with code 1: ` + stderr) carries no reason; Build Phase 1's symptom must fall back to stdout
- [x] Fixture extension of `helpers/promises-fixture.ts`: a behaviour promise owned by an archived plan with a retrospective carrying a "Landed on main at <sha>, <date>" line at a chosen date
- [x] Author A2, A3 in `apps/indusk-mcp/src/__tests__/monitor-mark.test.ts` (spawn the evaluator through the hook's CLI mode with the fake `claude` and `OTEL_EXPORTER_OTLP_ENDPOINT` at the capture server)
- [x] Author A6 in `apps/indusk-mcp/src/__tests__/monitor-check.test.ts` (a fixture test file whose text calls the helper with `"promise: <name>"`; the check reads text, so the helper need not exist)
- [x] Author A1, A7–A10 in `apps/indusk-mcp/src/__tests__/monitor-status.test.ts` via `runCli` against the local Jaeger helper
- [x] Author A11–A13, A15 in `apps/indusk-mcp/src/__tests__/monitor-watch.test.ts` via `runCli`
- [x] Author A14 (tools half), A16–A19 (tools half) in `apps/indusk-mcp/src/__tests__/monitor-plans.test.ts` through `helpers/tool-call.ts`
- [x] Author A14, A16, A18 (admin halves) and A20–A23 in `apps/indusk-admin/src/__tests__/http-promise-health.test.ts` over `next dev`, with a local Jaeger. The retired-is-grey half of A20 is in `components/Promises.test.tsx` (retired rows sit behind a client toggle, absent from server HTML). The Jaeger helper is imported by path
- [x] Shape (Test Phase 1): `monitor-plans.test.ts` patched `last_seen` into incident files by regex and `monitor-watch.test.ts` hand-built one with gray-matter, because the fixture's incident writer could not carry ADR D6's fields — `IncidentSpec` gains `opened`, `lastSeen`, `traces` and both tests use it (rule: one builder for a promise-bearing project). Writing it surfaced that the registry refuses an empty `## Fix`, recorded on Build Phase 3's `watch` item. Considered and left: `monitor-mark`'s `evaluate()` sets up, spawns and waits in one function — it is the one harness for one boundary, and splitting it would scatter a sequence that only reads in order
- [x] Run each file and read each failure: every red row fails on its own assertion, not on a missing import. Read: every authored row fails on its own assertion (`unknown command 'status'/'watch'`, no marked span, no archived plan in `list_plans`, no health chip, no active `monitor` segment); A6 and A19 pass. A17's positive half asks `get_plan_status` for the archived plan and expects `archived` (today the tool throws on a plan outside `planning/`, caught and asserted on), so `list_plans` need not list every archived plan

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

#### Deferred to Build Phase 7

- **A25–A30** — falsification hypotheses (`/falsify`, 2026-09-19), formed by reading the code Build Phases 1–6 shipped; each names a line that did not exist when Test Phase 1 was authored. Each reaches its subject over a boundary (the eval hook's CLI mode, the built CLI, a tool call, HTTP), so each can go red at Build Phase 7's start against today's code.
  - **A25** — `spawnClaude` (persistent evaluator) and the `spawn("claude")` in `runEvaluatorSync` register `close` but no `error` listener. A missing binary raises `ENOENT` as an uncaught `error` event (probed 2026-09-19: `close` never fires first), so the eval hook's inline handler exits and `markEvaluation` never runs. The promise's own statement names "a CLI that is not installed" as a failure it makes visible.
  - **A26** — `getJson` wraps only `fetch` in its try; `res.json()` sits outside it, so a 200 with a non-JSON body (or a body that stalls past the timeout, which aborts the read) throws a `SyntaxError` / `AbortError`, not `JaegerUnreachable`. The CLI then dies with a stack trace instead of exit 2, and the admin's `readHealth` rethrows anything that is not `JaegerUnreachable` — from the project layout, so every page of the project 500s. Test: a stub HTTP server on the port a hand-written `telemetry.json` records (this process's PID for both daemon PIDs, so the identity check passes).
  - **A27** — `markedSpans` queries by `p.name` only; `aliases` ("earlier names that still resolve", day-promises) are never asked for, so an application still marking a renamed promise's old name reads "not seen" while it violates it.
  - **A28** — marks carry `indusk.project = getProjectGroupId(root)`, which without `graphiti.groupId` is the folder name. Plans run in `<project>-worktrees/<plan>`, so the evaluator in a worktree marks `<plan>` and trunk's `status` (project `<project>`) drops every such mark. dusk sets `graphiti.groupId: dusk` and so hid it; a consumer project does not.
  - **A29** — `reopenOwner` resolves the owner with `ownerDir(planRoot, …)`, the trunk's `planning/`, never the plan-worktree record admin-plan-worktrees made authoritative. An active owner assigned to a worktree gets its Maintenance phase in the trunk's stale copy: `list_plans` reads the worktree and never shows it, and the landing merge conflicts with it.
  - **A30** — each Jaeger query sends `limit=1500`; a result of exactly the limit is silently truncated, and `status` prints its count as exact.

#### Regression Guards

- **A6** — the check already counts a token directly inside a quote; the row pins that the helper's calling convention stays inside that rule, so it passes when written.
- **A19** — plans without behaviour promises must keep closing exactly as they do today; it passes when written and guards every later phase.

#### Test Phase 1 Verification

- [x] A1–A3, A6–A23 authored; A6 and A19 pass; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-` — a path filter, not a glob: zsh expands an unquoted `monitor-*.test.ts` from the repo root and refuses it — and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-health.test.ts`). Ran 2026-09-18: mcp 17 failed / 3 passed (A6, A19, the evaluator-mark preconditions); admin 7 failed; the A20 grey half fails in the browser project
- [x] The two deferral bodies reviewed: each compiles at the phase it names and asserts what the row claims. A4/A5: the package self-reference resolves inside its own tests (probed with the existing `promises/registry` subpath), so the import compiles once Build Phase 1 exports `./testing/trace-shape`; the body names three fixture calls (`fixtureCallThatUpholds`, `fixtureCallWithExtraChild`, `fixtureCallWithoutMark`) that Build Phase 1 writes with `@opentelemetry/api` in the same file; A4 asserts upheld-under-parent and A5 both tolerance and the named failure, as the rows claim. A24: its procedure matches ADR D10 and needs Build Phase 6's `e2e` project, so it cannot compile earlier

#### Test Phase 1 Context

- [x] Known Gotchas (tests): tests that read Jaeger start the real binary through `helpers/local-jaeger.ts`, never a stub; the evaluator is exercised through a fake `claude` and `helpers/otlp-capture.ts`

#### Test Phase 1 Document

- [x] Changelog Unreleased entry opened in `apps/docs/src/changelog.md` for the monitor, filled in as phases land

### Build Phase 1: The mark

- [x] `apps/indusk-mcp/src/lib/testing/trace-shape.ts`, exported as `./testing/trace-shape`: `captureSpans(fn)` with an in-memory exporter, `expectPromiseUpheld(spans, token, { parent? })`, `expectPromiseViolated(spans, token)`; containment matching; the token parsed from `"promise: <name>"`, refusing any other shape by name. The mark's four names live once, as `PROMISE_MARK` in `lib/promises/vocabulary.ts` (with `parsePromiseToken`); `captureSpans` refuses when a tracer provider or context manager is already global
- [x] Mark the evaluator run: `runPersistentEval` and `runEvaluatorSync` (the modules the hook spawns, which resolve the package's own dependencies) wrap each evaluation in a span through `lib/eval/otel.ts` carrying `indusk.promise=every-commit-evaluated` and `indusk.promise.outcome`; on failure the `indusk.promise.violated` event with the failure line as `indusk.promise.symptom`. *Refines ADR D10: the spawned evaluator runs inside the package, so it uses the existing OpenTelemetry setup instead of a direct OTLP post from the hook.* Two facts from Test Phase 1: the evaluator already exports `eval.*` spans when `INDUSK_EVAL_OTEL=1` and an endpoint are set (A2/A3's preconditions pass today), so the mark goes on the `eval.run` root span; and the real `claude` prints the bad-model message on **stdout** with stderr empty, so the symptom takes stdout's first line when stderr is empty. Decide here whether the mark needs `eval.otel` enabled or turns on when the local daemon is running, and record why. **Decided:** the evaluator exports to the local daemon by default whenever it runs (`liveOtlpEndpointSync` in `lib/telemetry/daemon.ts`: meta file + Jaeger PID, no socket), `OTEL_EXPORTER_OTLP_ENDPOINT` still wins, and `eval.otel.enabled: false` is the off switch — because a mark that needs a hand-set exporter is never seen by the monitor, which is D10's point. `markEvaluation` marks the root span once, at the point the evaluation ends, so a stale-session retry marks only the retry; `claudeExitReason` puts stdout in the error when stderr is empty, which also fixes results.log's reasonless line. `otel.test.ts` now pins `INDUSK_HOME` so a developer's running daemon cannot flip its default-off tests
- [x] Register `.indusk/promises/every-commit-evaluated.md` (behaviour, domain `gates`, state `enforced`, sites: the evaluator module, tests: `monitor-mark.test.ts`); confirm the owner by reading the archived plan that made commits evaluated (`agent-roles` is the candidate) and record why. **Owner: `semantic-graph-eval`**, not the `agent-roles` candidate — its ADR (2026-04-09) added the commit-triggered evaluator that "scores every commit"; `agent-roles` later described the role
- [x] The testing extension's skill (`apps/indusk-mcp/extensions/testing/skill.md`): a section on asserting a promise through the trace-shape helper
- [x] Shape (Build Phase 1): `claudeExitReason` formatted the claude CLI's failure text inside `lib/eval/otel.ts`, giving that module a second reason to change — moved beside `formatParseError` in `scorecard-extractor.ts`, the home of claude-output error text (rule: one reason to change). Considered and left: `markEvaluation` in `otel.ts` (it sets span attributes, which is the module's job); `liveOtlpEndpointSync` in `telemetry/daemon.ts` (a daemon fact, beside `daemonStatus`). A day-promises test pinned "3 promises, one per kind"; rewritten to what it protects — every kind held, every promise enforced — and CLAUDE.md's "three promises" likewise

#### Build Phase 1 Verification

- [x] A2, A3, A4, A5 pass; A6 still passes (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-mark.test.ts src/__tests__/monitor-trace-shape.test.ts src/__tests__/monitor-check.test.ts`) — ran 2026-09-18: 8 passed; check: 4 promises, all enforced
- [x] `pnpm promises:check` passes with the new promise

#### Build Phase 1 Context

- [x] Conventions: the promise mark (`indusk.promise`, `indusk.promise.outcome`, the `indusk.promise.violated` event) is plain OpenTelemetry set by the application; InDusk ships no runtime helper; tests assert it through `testing/trace-shape` with the promise token as the argument

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/promises.md`: marking a behaviour promise — the attributes, the event, the two-line snippet, and the test helper

### Build Phase 2: Reading Jaeger

- [x] `apps/indusk-mcp/src/lib/promises/telemetry.ts`: `markedSpans(projectRoot, since)` — the query port from `daemonStatus()`, `GET /api/services`, then `GET /api/traces?service=…&tags={"indusk.promise":…}` per service; per-promise upheld and violated spans with trace ids and times; `JaegerUnreachable` naming the URL when it cannot connect. Exported through the `promises/registry` neighbour subpath the admin already reads, or its own, decided here. **Decided:** its own subpath, `./promises/telemetry` — the registry subpath is filesystem-only and the admin imports it into pages that must not pull a network client by accident; the documented import was run (`node -e 'import("@infinitedusky/indusk-mcp/promises/telemetry")'` → `JaegerUnreachable`, `markedSpans`). The signature takes the promise names and `since` rather than `projectRoot` — the daemon is machine-global and the caller already holds the registry. `getQuietWindowDays` moved here from Build Phase 4, because `status` defaults to the quiet window
- [x] `indusk promises status [--since <duration>]` in `src/bin/commands/promises.ts` and `cli.ts`: behaviour promises with violations, traces, last seen upheld or "not seen"; state and structure listed as watched by the suite; exit 0 / 2. Run against this repository: `every-commit-evaluated` already reads upheld, from the evaluator scoring this plan's own Build Phase 1 commit
- [x] Shape (Build Phase 2): nothing found. `telemetry.ts` has one job, the query; `status.ts` pairs `formatStatus` with `parseDuration`, both serving only `status`, and splitting a 10-line parser out would add a file with one caller; the command is a thin read → query → print

#### Build Phase 2 Verification

- [x] A1, A7, A8, A9, A10 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-status.test.ts`) — ran 2026-09-18: 6 passed

#### Build Phase 2 Context

- [x] Architecture (indusk-mcp bullet): `indusk promises status` reads marked spans from the local Jaeger through `lib/promises/telemetry.ts`, the one query; unreachable is exit 2, never zero

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `status`

### Build Phase 3: The loop

- [x] `indusk promises watch [--source local|smoke|deployed]`: status, then open or extend incidents (ADR D6 fields, `## Root cause` written as `_Unwritten — a person writes this._`), traces deduplicated, `last_seen` only forward; writes plan documents, commits nothing. Found in Test Phase 1 by reading `check.ts`/`registry.ts`: the incident must also carry `date` (the registry refuses one without it), and opening one must move an `enforced` promise to `known-violated` and add the id to its `incidents:` — `check` refuses an enforced promise with an open incident, and A11 asserts `check` still passes; and `## Fix` cannot be empty (the registry refuses an empty section), so it is written as `_Not yet fixed._` — ADR D6 showed it empty. Frontmatter is edited as text (`lib/promises/frontmatter-edit.ts`), never a gray-matter round trip, so a second pass can prove it changed nothing; a trace recorded in any incident of the promise, open or fixed, is never counted again, so a fixed incident is not reopened by the violations that caused it
- [x] Reopen (ADR D7): append `### Build Phase N: Maintenance — <incident>` with its four gates to the owner's impl, in place, archived or active; numbering from the owner's own phases; a plan with no impl gets one containing only that phase. Two additions the validator forced, found by running it on real archived impls: the phase carries an **OTel gate** when the project's `otel.role` asks for one; and in an impl with a Test Trajectory the Maintenance phase **appends a row** (the test that reproduces the incident, writable and passing in that phase, continuing the table's `A`/`T` prefix) with its justification — a Test Phase 1 register entry, or a `### Trajectory Rationale` entry for an impl written before test phases. Asked 2026-09-19 — "Append a test row" over a new `maintenance` no-tests reason, which would have been a new way to close a phase without a test
- [x] `list_plans` lists an archived plan with an unchecked Maintenance phase as active, reading it from the archive; `get_plan_status` resolves an archived plan by name (A17's positive half asks it). `lib/promises/after-close.ts` is the one reader of what a closed plan is doing (`archived` / reopened; `monitor` joins in Build Phase 4); `archived` and `monitor` join `PlanStage` as after-close stages only it sets. The `archive` folder itself no longer appears in `list_plans` as a plan
- [x] `promises check`: refuse an incident with `status: fixed` whose root cause is the unwritten line, naming the file
- [x] A test runs `validate-impl-structure.js` over an owner's impl after `watch` appended to it, for a legacy impl (no test phases) and a test-phase impl: `monitor-reopen-validator.test.ts` — four shapes, three of them real archived impls from this repository (no trajectory; a trajectory before test phases; test phases) and a `service`-role project; 4 passed
- [x] Shape (Build Phase 3): `addTrajectoryRow` both added the row and wrote its justification in two shapes — the justification extracted as `justifyLateRow` (rule: one reason to change). Considered and left: `incidents.ts` (open vs extend share the dedupe and the promise update, and read as one sequence); `after-close.ts` (one question, what a closed plan is doing)

#### Build Phase 3 Verification

- [x] A11, A12, A13, A15 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-watch.test.ts`) — ran 2026-09-19: all pass; the full monitor + promises + plan-tool run is 144 passed, the 2 red being A16/A18 (Build Phases 4–5)
- [x] The tools half of A14 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-plans.test.ts -t A14`)

#### Build Phase 3 Context

- [x] Conventions: `watch` opens or extends incidents and reopens the owner by an appended Maintenance phase in place; an incident cannot be fixed with its root cause unwritten

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `watch`, the incident fields, reopening

### Build Phase 4: `monitor`

- [x] `getQuietWindowDays(projectRoot)` in `lib/config.ts` — `promises.quiet_window_days`, default 7 in the reader. *Refines ADR D8's "ensured on update": the `promises` block already exists in every project, and `ensureConfigBlock` is keyed on the block's presence, so the default lives in the reader, as `getSweepTtlMinutes` does.* **Done in Build Phase 2**, in `lib/promises/config.ts` beside the other promises config, because `status` defaults to the window
- [x] `lib/lifecycle.ts` derives `monitor` for an archived plan holding a behaviour promise while `now − max(closed, lastViolation) < window` (closed from the retrospective's landing line, else its `date`; lastViolation from its promises' incidents' `last_seen`), with the elapsed share; files only, no network. Split by what each knows: `lib/promises/after-close.ts` computes the window from files (`closedAt`, `monitorWindow`; the registry read once per listing) and `lib/lifecycle.ts` takes it as an optional `afterClose` input — `monitor` active with `archived` done behind it, or a reopened plan `executing` its Maintenance phase — so the admin derives the same bar from the same facts. `list_plans` lists `monitor` plans active. Run on this repository it put `enforce-plan-gates` in monitor: its incident `i-2026-09-15-gates-silently-off` restarted the window 4.2 of 7 days ago
- [x] `lifecycle-single-definition.test.ts` and `lifecycle-render-parity.test.ts` updated for the derived position: no change needed — `monitor` was already one of `PLAN_POSITIONS` with an admin label, and the render-parity pin is the `satisfies Record` in `labels.ts` (there is no file by that name); derivation tests added to `lib/lifecycle-derive.test.ts` instead (4)
- [x] Shape (Build Phase 4): nothing found. `after-close.ts` answers one question (what a closed plan is doing) with small named parts; `monitorAwaiting` names the bar's sentence in `lifecycle.ts`

#### Build Phase 4 Verification

- [x] A17 passes; the tools halves of A16 and A18 pass; A19 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-plans.test.ts`) — ran 2026-09-19: 5 passed

#### Build Phase 4 Context

- [x] Conventions (the lifecycle entry): `monitor` is derived from the landing date and incidents, never from telemetry; `promises.quiet_window_days` defaults to 7 in the reader

#### Build Phase 4 Document

- [x] `apps/docs/src/guide/plan-lifecycle.md`: `monitor` defined

### Build Phase 5: The admin

- [x] Health on the Promises page (ADR D9): `markedSpans` read server-side with a two-second timeout, cached for the refresh interval; red, green, hollow "unverified", amber, grey chips under the render-parity pin; red sorts first; violations and last seen per behaviour row; "health unknown since <last successful read>" when unreachable. `components/Promises.test.tsx` carries day-promises' "no health is rendered" test, which D9 supersedes: revise it in this item to say what is now true, never delete it silently. The day-promises test is retitled, not deleted: its claim still holds without an observed read. **Found by running it:** the admin's Turbopack followed `promises/telemetry` → `telemetry/daemon.ts` → `createRequire(...).resolve('…/bin/jaeger')` and tried to parse the Jaeger binary as source (every project page 500'd); the daemon's read side moved to `lib/telemetry/status.ts`, which resolves no binary, and `daemon.ts` re-exports it so its importers are unchanged
- [x] Sidebar roll-up: a plan holding a red promise shows red
- [x] The plan bar's `monitor` segment fills with the elapsed share and says it is time, not steps; "window restarted" after a violation; a reopened plan shows its Maintenance phase as active. `afterClose` reaches the admin through a new `promises/after-close` subpath, the same function `list_plans` reads; `PlanPositionState` carries the window when the position is `monitor`
- [x] Shape (Build Phase 5): nothing found. `promise-health.ts` is one topic (read, cache, derive); the table's new pieces are small named components (`HealthChip`, `HealthDetail`, `PromiseStateCell`); the sidebar's red dot is a single element beside `HoldingBadge`. Considered and left: the health cache is keyed by project only, so a promise added mid-interval shows unverified for up to `refresh_ms` — a second or five, and never green

#### Build Phase 5 Verification

- [x] A14, A16, A18, A20, A21, A22, A23 pass (`pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-health.test.ts`) — ran 2026-09-19: 7 passed
- [x] Admin node project green (`pnpm --filter indusk-admin exec vitest run --project node`); A20's grey half and the revised Promises tests pass (`pnpm --filter indusk-admin exec vitest run --project browser src/components/Promises.test.tsx`) — ran 2026-09-19: node 180 passed; browser components 128 passed

#### Build Phase 5 Context

- [x] Known Gotchas (admin entry): observed health reads Jaeger server-side with a timeout and never shows green it did not see; the `monitor` segment is the one time-filled segment

#### Build Phase 5 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: health chips, the sidebar roll-up, the `monitor` segment, reopened plans

### Build Phase 6: End to end, and what runs where

- [x] An `e2e` vitest project for `apps/indusk-mcp` (`vitest.e2e.config.ts`, `include: ["e2e/**/*.e2e.test.ts"]`), and the default config excludes `e2e/`; root script `pnpm e2e`. The root `pnpm e2e` builds the package first, since the test runs the built CLI and hook
- [x] Author and run `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts` per the A24 procedure, against the running telemetry daemon and the real `claude` CLI. The daemon is the extension's own, started by `helpers/local-jaeger.ts` in a home the test owns — not the developer's — so a deliberate violation never lands in a Jaeger someone reads; the evaluator reaches it with no exporter configured, which is the default path Build Phase 1 made. The first run broke on something else: the evaluator passes `--mcp-config .mcp.json` and the scratch project had none — the loop would have caught that too, but the scratch now carries an empty one so the test breaks where it means to
- [x] Marks are scoped to their project (found writing A24): the Jaeger query matched a promise by name only, and every project's evaluator marks `every-commit-evaluated` under one service, so on one machine another project's failed evaluation — or this test's — would have read as this repository's violation. `PROMISE_MARK.project` (`indusk.project`) is set by `markEvaluation` from `getProjectGroupId`, and `markedSpans({ project })` drops a mark naming another project; an application's own spans carry none and are unaffected. Pinned in `monitor-status.test.ts`. Caveat recorded: the id is the config group id or the folder name, so a plan worktree's folder reads as a different project from its trunk
- [x] Shape (Build Phase 6): nothing found. The end-to-end test is one `it` on purpose — it is one story, and splitting it would hide which step broke behind a skipped remainder; the configs and the scoping filter are single-purpose
- [x] `apps/docs/src/guide/index.md`: "What runs where" — in the repo, on the machine, always-on (planned in `day-always-on`); the application depends on none of it

#### Build Phase 6 Verification

- [x] A24 passes: `pnpm e2e` on this machine, output recorded; `pnpm test` does not run it (checked by its test count) — ran 2026-09-19: `pnpm e2e` → 1 file, 1 test passed in 6.9s (real `claude` 2.1.197, test-owned daemon); `vitest list` under the default config lists nothing from `e2e/` (its two `e2e` matches are the existing `multi-agent-e2e.test.ts`)
- [x] Root suite and the promises check (`pnpm test`) — ran 2026-09-19. Admin 310 passed. Package 1546 passed, 11 failed: 9 because a fresh worktree has no bundled admin (`apps/indusk-mcp/admin/`, an ignored artifact of `scripts/bundle-admin.js`, present on trunk) — after bundling, those files pass; the remaining 2 are `daemon-identity.test.ts`'s two PID-reuse cases, which fail identically on trunk at `918db13d` (the queued daemon-identity port bug), not this plan's. `pnpm promises:check`: 4 promises, all enforced. The first full run also caught a real miss, fixed: the layout's browser test did not mock the new `@/lib/promise-health`

#### Build Phase 6 Context

- [x] Conventions: end-to-end tests live in `apps/indusk-mcp/e2e/`, run with `pnpm e2e`, need the `claude` CLI and the telemetry daemon, and are outside `pnpm test`

#### Build Phase 6 Document

- [x] Changelog entry completed; `apps/docs/src/guide/promises.md` gains the loop diagram (run → span → Jaeger → `watch` → incident → Maintenance phase → quiet window → closed)

### Build Phase 7: Falsification — the failures the loop cannot see

**Goal**: verify whether the attested state — "a behaviour promise broken in a run is found by telemetry and sends its owner back to work" — holds against the failures that break the loop itself: an evaluator that dies before marking, a Jaeger that answers badly, a mark under a promise's old name, a worktree's project id, an owner in a worktree, and a truncated count. Each row is one hypothesis; each item the fix if it confirms.

- [ ] Author A25–A30 red at phase start: A25 in `monitor-mark.test.ts` (PATH without `claude`), A26 in `monitor-status.test.ts` and `apps/indusk-admin/src/__tests__/http-promise-health.test.ts` (stub query server), A27 and A30 in `monitor-status.test.ts`, A28 in `monitor-mark.test.ts` (a config without a group id, the hook run from a `git worktree add` checkout), A29 in `monitor-plans.test.ts` through `helpers/plan-worktree-fixture.ts`
- [ ] A25: both evaluator spawns listen for `error`, and a spawn failure resolves as a failed run (`claude could not be started: <message>`) that is logged and marked violated like any other
- [ ] A26: `getJson` reads and parses the body inside its try, turning a parse failure, an aborted read or an unexpected shape (`data` not an array) into `JaegerUnreachable` naming the URL; the admin's health read treats any failure as unreachable, so a health read can never take down a page
- [ ] A27: `markedSpans` asks for a promise's aliases too and counts their marks under the promise's name
- [ ] A28: the mark's project id comes from the main checkout — `graphiti.groupId` when set, else the folder of the repository's shared git directory — through one function the evaluator, `status`, `watch` and the admin all call
- [ ] A29: `reopenOwner` resolves an active owner's live copy through `lib/worktree/plan-worktrees.ts` (the assigned worktree when there is one), an archived owner as today
- [ ] A30: a query that returns the limit marks the promise's result truncated, and `status` and the admin say "at least N"

#### Build Phase 7 Verification

- [ ] A25, A27, A28, A30 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-mark.test.ts src/__tests__/monitor-status.test.ts`)
- [ ] A26 passes in both halves (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-status.test.ts -t A26` and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-health.test.ts`)
- [ ] A29 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/monitor-plans.test.ts -t A29`)
- [ ] Every earlier monitor row still passes, and `pnpm e2e` still passes

#### Build Phase 7 Context

- [ ] Known Gotchas (the promises entry): a mark's project id is the main checkout's, never a worktree folder's; every failure of a health read is "unreachable", never an exception

#### Build Phase 7 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: aliases counted, "at least N", and the project id the evaluator's mark carries

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
