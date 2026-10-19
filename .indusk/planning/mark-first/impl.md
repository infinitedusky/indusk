---
title: "Tests and telemetry linked to clauses"
date: 2026-10-18
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: auto
approved_brief: "2cef362ed74711e41413405858e878f313adcd9144ab093bd377fcb9ffc0cb8c"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T03:13:49.883Z"
---

# Tests and telemetry linked to clauses

## Goal

A clause is proved twice: its tests run and pass before a plan closes or lands,
and its signal has reported it upheld in a run of the real system. A clause with
no report reads "no signal", never holding, and a break names the promise and the
clause it broke.

## Scope

### In Scope

- InDusk's signal writer carries the clause and, on a break, the plan and phase
  that added the signal; the writers (`markPromise`, `scripts/suite-speed.js`, the
  demo app's helper) write `broken`; readers ignore a span a test run produced.
- One tracer for InDusk's own commands, exporting to the local daemon and silent
  when none runs.
- A clause's standing, and a promise's standing as the worst of its clauses.
- Closing and landing run the tests a clause's rows name and ask the daemon
  whether the clause's signal reported upheld.
- Incidents opened by a clause's signal name `promise/clause`.
- The word "signal" for what was called a mark, in skills, tool descriptions, docs
  and code comments.

### Out of Scope

- The audit's answer to each concern, tasks written as instructions, the later cut
  (a break leading to its cause, browser signals, clause views): the brief's "Not
  promised".
- Switching the editor's health line from `violated` to `broken`: it waits a
  release.
- Any change to how a screen looks (the brief's Looks is "None").
- Approving, building or landing: this document is a draft for a person.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | The tests whose subjects exist, red; the guards, green; the deferred bodies reviewed | the brief, test plan, ADR |
| Build Phase 1 | `markPromise` writing `broken`, the clause and the plan/phase pointer, and `indusk.run=test`; readers that skip test-run spans; the other writers on `broken` | Test Phase 1's red tests |
| Build Phase 2 | `lib/telemetry/command-tracer.ts`: one tracer provider for InDusk's commands | Build Phase 1's writer |
| Build Phase 3 | `clauseStanding` and the promise standing derived from it, in `lib/promises/standing.ts` | Build Phase 1's reader that skips test runs |
| Build Phase 4 | Closing and landing that take a test runner and a signal reader as inputs and refuse by clause | Build Phase 3's standing, Build Phase 2's tracer |
| Build Phase 5 | Incidents and events that name `promise/clause`, the pointer and the reachable tests | Build Phase 3 and 4 |
| Build Phase 6 | The word cleanup, the live check, the docs and rules | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Closing a plan is refused when a test that proves one of its clauses fails at close, though its row says passing; the refusal names the clause and the file | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/promises/clause-tests-run.test.ts |
| A2 | Landing a plan is refused when a test that proves one of its clauses fails, naming the clause | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/plans/land-clause-tests.test.ts |
| A3 | A failing test is reported against the clause its file names | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/promises/clause-tests-run.test.ts |
| A4 | A clause whose signal reported upheld in a real run reads upheld on the promise page and in `promises status` | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A5 | A clause with passing tests and no report from its signal does not read upheld | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A6 | A signal whose only source is a test run is not the clause's signal: the clause reads no signal however often the test passes | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/signal-test-run.test.ts |
| A7 | A clause whose signal reports broken reads broken, its promise reads broken, and an incident opens naming the clause and its symptom | Build Phase 3 | Build Phase 5 | written | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-break.test.ts |
| A8 | A split is broken by missing its budget at its point; a limit by one report over its bound, however many were inside | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A9 | A plan written as clauses cannot close while a clause has a failing test or no signal that reported upheld; the refusal says which is missing | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A10 | When such a plan closes, its promise is enforced | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A11 | A clause's signal run against the real system through the local daemon reports upheld and the clause then reads upheld end to end | Build Phase 6 | Build Phase 6 | planned | live check | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/__tests__/clause-signal.live.test.ts |
| A12 | A clause whose signal never reported reads no signal on the promise page, in `promises status` and in the admin, never drawn as holding | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A13 | A clause that last reported upheld, whose watcher has gone silent past its heartbeat, reads no signal | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A14 | A promise with one clause upheld and another reading no signal is not holding: the worst clause decides | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A15 | A promise made only of resting clauses has the standing of those promises and closes when they are in force, with no row of its own | Build Phase 3 | Build Phase 4 | passing | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts, apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A16 | When a clause's signal reports broken, the event it emits carries the promise and the clause | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/clause-break-event.test.ts |
| A17 | The incident a broken clause opens names the promise and the clause and, when recorded, the plan and phase that added the signal, as a pointer | Build Phase 5 | Build Phase 5 | written | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/incident-names-clause.test.ts |
| A18 | From an incident a person reaches the clause's tests and the place that emits its signal, with no search by file name | Build Phase 5 | Build Phase 5 | written | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/incident-names-clause.test.ts |
| A25 | A plan written before clause plans still closes on passing tests that name its promises, with no signal asked of it | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over a-closed-plan-kept-its-promises for every plan closed before clauses | apps/indusk-mcp/src/lib/promises/confirm-legacy-plan.test.ts |
| A26 | `markPromise` writes `broken` where it wrote `violated`, and every reader still reads both | Test Phase 1 | Build Phase 1 | passing | unit | the switch carried from one-promise-language; a rename no promise of this plan states | apps/indusk-mcp/src/lib/promises/signal-writers.test.ts |
| A27 | A promise with no clauses still opens an incident that names the tests that proved it | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over an-incident-names-its-tests for every promise written before clauses | apps/indusk-mcp/src/lib/promises/incident-no-clause.test.ts |
| A29 | A test file carrying a clause token is refused at close when it asserts nothing about the clause | Build Phase 4 | Build Phase 4 | passing | unit | tightens verified-before-release; droppable if it makes false refusals (decision D-3 below) | apps/indusk-mcp/src/lib/promises/clause-test-asserts.test.ts |
| A30 | No skill, tool description or doc page calls a promise's telemetry a mark; each says signal (exempt: the Day 4b entry in the root `CLAUDE.md`, archived plans and decisions, this plan's name) | Test Phase 1 | Build Phase 6 | written | unit | the word cleanup carried from one-promise-language; no promise of this plan states it | apps/indusk-mcp/src/__tests__/signal-word.test.ts |
| A31 | The suite-speed script and the demo app write `broken` where they wrote `violated`, and every reader still reads both | Test Phase 1 | Build Phase 1 | passing | unit | the writers outside `markPromise`, carried from one-promise-language's falsification | apps/indusk-mcp/src/__tests__/suite-speed.test.ts, examples/seat-holds/src/telemetry.test.ts |

### Deferred Verification

- **Signals cost a few percent at most in time and storage (test plan U1)**
  - reason: needs a project with real traffic; dusk's own load says nothing.
  - would require: Homework Gate's first plan, run with signals on and off.
  - mitigation: brief expectation 2, read when that plan closes.
- **The share of clauses in force whose signal has reported (U2)**
  - reason: needs time in production.
  - would require: 30 and 90 days after release.
  - mitigation: brief expectation 1, read from the registry and the daemon at those dates.
- **A break is fixed faster once its incident names its clause (U3)**
  - reason: needs real breaks over weeks.
  - would require: incidents opened by clause signals.
  - mitigation: brief expectation 3, read from the incident records 30 days after release.
- **InDusk's own commands share one tracer (carried)**
  - reason: the test plan has no row for it; its observable effect is the close span reaching the daemon, which A11 shows once, and a unit test of "exports when a daemon runs, silent when none" would restate the library's behaviour.
  - would require: a test-plan row, added if an amendment is approved.
  - mitigation: A11 fails if the close's span never reaches the daemon; Build Phase 2's verification runs the command once against a daemon.

## Checklist

### Test Phase 1: Write the tests first

**Tier**: med — the work step's default

This phase writes every test whose subject already exists, so each fails on its own
assertion: the signal writer, the span parser, the suite-speed script and the
word check. It also writes the guards for behaviour that must not change, and
records, with a reason, the tests that wait for a module a later phase adds. It
hands those red tests to Build Phase 1.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start feature mark-first`; `indusk worktree list`. This plan sets no `worktree: none`.

  </details>
  Confirmed: `/Users/the_dusky/code/sandbox/dusk-worktrees/mark-first` on `plan/mark-first`. Dependencies were not installed there; ran `pnpm install --frozen-lockfile`.
- [x] Write the tests for the signal writer and the span parser and see them fail.
  <details><summary>Technical</summary>

  A16 in `src/lib/promises/clause-break-event.test.ts`: `markPromise` with `clause` and a plan/phase pointer, on a broken outcome, adds an event carrying the promise and the clause. A6 in `signal-test-run.test.ts`: a span carrying `indusk.run=test`, parsed by `parseMarkedSpan`, is ignored. A26: change `signal-writers.test.ts` to assert the wire word is `broken` for `markPromise` and keep the readback assertion. All under `apps/indusk-mcp/`; each file carries `clause: a-clause-is-proved-twice/<clause>` for its clause row.

  </details>
  A16, A6 and A26 written and red on their assertions. `signal-writers.test.ts` is in the system tier (it uses the git helper), so it runs with `vitest.system.config.ts`.
- [x] Write the tests for the other writers and the word check and see them fail.
  <details><summary>Technical</summary>

  A31: `src/__tests__/suite-speed.test.ts` asserts the script's written outcome is `broken`; `examples/seat-holds/src/telemetry.test.ts` asserts the demo helper writes `broken`. A30: `src/__tests__/signal-word.test.ts` scans `skills/`, the MCP tool descriptions, `apps/docs/src/{guide,reference}` and `src/` comments for a promise's telemetry called a "mark", with the exemptions in the row; it fails on today's wording.

  </details>
  **Decision D-11:** A31 is already true. `scripts/suite-speed.js` marks no promise, and the demo's `signal.ts` already writes `broken` (a-new-project-starts-instrumented moved it). Per D-7 the demo half stands as a guard that passes today, and the script half asserts the script writes no outcome word. A30 written and red (24 offenders).
- [x] Write the guards for behaviour that must not change and see them pass.
  <details><summary>Technical</summary>

  A25 `confirm-legacy-plan.test.ts`: a plan with no clauses closes on passing rows that name its promises, asking no signal. A27 `incident-no-clause.test.ts`: a promise with no clauses opens an incident whose "Proven by" section names its tests, through `recordViolations`/`provenBy`.

  </details>
  A25 and A27 green.

#### Deferred to Build Phase 3

- **A4, A5, A8, A12, A13, A14** — their subject is `clauseStanding`, which Build Phase 3 adds to `lib/promises/standing.ts`; the file would fail to load rather than to assert. A7 is authored here too (its promise-reads-broken half), then passes at Build Phase 5 when the incident half exists. Body reviewed:

  ```typescript
  // promise/clause token: clause: a-clause-is-proved-twice/upheld-by-its-signal
  import { describe, expect, it } from "vitest";
  import { clauseStanding } from "./standing.js";

  const split = { name: "reaches-seat", kind: "split" as const };
  const none = { reports: [], heartbeatOk: true };

  describe("clauseStanding", () => {
    it("A5 — passing tests and no report is no signal, not upheld", () => {
      expect(clauseStanding(split, { ...none }, { testsPassing: true })).toBe("no-signal");
    });
    it("A13 — a silent watcher is no signal even after an upheld report", () => {
      const reports = [{ outcome: "upheld" as const, at: "2026-10-01T00:00:00Z" }];
      expect(clauseStanding(split, { reports, heartbeatOk: false }, { testsPassing: true })).toBe("no-signal");
    });
    it("A8 — one report over a limit's bound breaks it", () => {
      const limit = { name: "never-twice", kind: "limit" as const };
      const reports = [{ outcome: "upheld" as const, at: "a" }, { outcome: "broken" as const, at: "b" }];
      expect(clauseStanding(limit, { reports, heartbeatOk: true }, { testsPassing: true })).toBe("broken");
    });
  });
  ```

#### Deferred to Build Phase 4

- **A1, A2, A3, A9, A10, A29** — their subject is the closing and landing rule taking a test runner and a signal reader as inputs, fields `ConfirmInput` and the landing check do not have today; a test passing them would fail to compile and load. A15's closing half waits with them. Body reviewed:

  ```typescript
  // clause: a-clause-is-proved-twice/verified-before-release
  import { describe, expect, it } from "vitest";
  import { confirmPlan } from "./confirm.js";

  describe("closing runs the clause's tests", () => {
    it("A1 — a row that says passing is refused when its test fails now", async () => {
      const r = await confirmPlan({
        planRoot, codeRoot, plan: "p",
        runTests: async () => [{ file: "src/a.test.ts", passed: false }],
        readSignals: async () => [],
      });
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).toMatch(/a-promise\/a-clause/);
      expect(JSON.stringify(r)).toMatch(/src\/a\.test\.ts/);
    });
  });
  ```

#### Deferred to Build Phase 5

- **A17, A18** — their subject is the incident text that names the clause and the reach to its tests, which Build Phase 5 adds to `incidents.ts`; today `incidentText` takes no clause, so the call would not compile. Body reviewed:

  ```typescript
  // clause: a-clause-is-proved-twice/a-break-names-its-clause
  import { expect, it } from "vitest";
  import { incidentText } from "./incidents.js";

  it("A17 — the incident names promise/clause first, the pointer second", () => {
    const text = incidentText({ ...base, clause: "reaches-seat", pointer: { plan: "p", phase: "Build Phase 2" } });
    expect(text).toMatch(/clause: reaches-seat/);
    expect(text.indexOf("a-promise")).toBeLessThan(text.indexOf("Build Phase 2"));
  });
  ```

#### Deferred to Build Phase 6

- **A11** — the live check drives the closing reader, `clauseStanding` and the command tracer, all added by Build Phases 2 to 4; it also needs a daemon, so it lives in the package's system tier and runs once, with its result recorded in the plan. It cannot be authored earlier because its imports do not exist.

#### Regression Guards

- **A25** — the legacy-plan close; it passes today and must keep passing, so a plan closed before clauses never has a signal asked of it.
- **A27** — the clause-less incident; passes today and must keep passing, so an old promise's incident still names its tests.

#### Test Phase 1 Verification

- [x] The tests whose subjects exist fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-break-event.test.ts src/lib/promises/signal-test-run.test.ts src/lib/promises/signal-writers.test.ts src/__tests__/suite-speed.test.ts src/__tests__/signal-word.test.ts src/lib/promises/confirm-legacy-plan.test.ts src/lib/promises/incident-no-clause.test.ts` — A6, A16, A26, A30, A31 red on assertions; A25, A27 green. The demo's test runs in its own project: `pnpm --filter seat-holds exec vitest run src/telemetry.test.ts`.

  </details>
  A6, A16, A26, A30 red on assertions; A25, A27 green; A31 green already (D-11). Run A26 as `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/lib/promises/signal-writers.test.ts`.
- [x] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body reviewed against two questions: will it compile at the phase it names, and does it assert what its row claims? A4 to A14 and A29 not shown here are written from the same shape in their phase.

  </details>
  Read: each compiles once its phase adds the named input (`clauseStanding`, `runTests`/`readSignals` on `confirmPlan`, `clause`/`pointer` on `incidentText`) and asserts its row. One fix carried to Build Phase 3: the A5/A13 bodies pass a clause with no budget field; Build Phase 3 gives `clauseStanding` the clause as the registry holds it.

#### Test Phase 1 Context

- [x] (none needed — Test Phase 1 only writes tests; it changes no rule about how the project works)

#### Test Phase 1 Document

- [x] (none needed — tests that do not yet pass document nothing; each build phase documents what it makes true)

### Build Phase 1: The writers and the readers of a signal

**Tier**: med — the work step's default

This phase makes a signal say which clause it concerns, say that it broke in the
word the project now uses, and be told apart from a test run. It is the base the
rest stands on: standing (Build Phase 3) trusts only signals this phase lets
through, and incidents (Build Phase 5) read the clause and pointer this phase
writes.

- [x] Make the signal writer carry the clause on a break, and the plan and phase that added the signal, and write the new word for a break.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/mark.ts`: `WRITTEN_BROKEN = "broken"`; the break event also carries `indusk.promise` and `indusk.clause`; optional `signal: { plan, phase }` sets `indusk.signal.plan`/`indusk.signal.phase` on the broken event only. Add the keys to `PROMISE_MARK` in `vocabulary.ts` (the one definition; `promises-single-definition.test.ts` pins that). Update the doc comment that says the wire word is still `violated`.

  </details>
  **Decision D-12:** the plan/phase and run-marker keys already live in `vocabulary.ts` (`APP_SIGNAL_KEYS.plan`/`.phase`, `APP_RESOURCE_KEYS.run`, `TEST_RUN_VALUE`, added by a-new-project-starts-instrumented), so `markPromise` reuses them instead of adding a second spelling to `PROMISE_MARK`; `promises-single-definition.test.ts` still passes.
- [x] Make the writer mark a span made under a test runner so the readers can skip it.
  <details><summary>Technical</summary>

  When `process.env.VITEST` is set, `markPromise` sets `indusk.run=test` (ADR D3). Decision D-1 below: the marker is set by the writer, because a reader cannot tell a test's span from a real one otherwise.

  </details>
- [x] Make the readers of signals skip a span marked as a test run.
  <details><summary>Technical</summary>

  `parseMarkedSpan` in `lib/promises/telemetry.ts` returns null for a span with `indusk.run=test`; keep reading both `violated` and `broken` (`readOutcome`).

  </details>
  Found by running the related tests: round-trip tests (`signal-writers`, `signal-helper`, `look-standing`, `record`, `trunk-plan-commit-mark`, `looks/report`) now clear `VITEST` or strip `indusk.run` before reading, or assert the marker; each says why in a comment.
- [x] Switch the other InDusk writers to the new word for a break.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/scripts/suite-speed.js`, any caller of `markPromise` that spells the old word itself (`lib/looks/report.ts`, `lib/eval/otel.ts`, `lib/telemetry/daemon-reports.ts`, `lib/promises/record.ts`, `lib/promises/trunk-commit.ts` — check each; most go through `markPromise`, so only a hand-written word changes), and the demo's helper `examples/seat-holds/src/signal.ts` and `telemetry.ts`. The editor's health line (`health-line.ts`, `runs[].outcome`) keeps `violated`: do not change it (decision D-2).

  </details>
  (none needed beyond `markPromise` — checked each: `looks/report.ts`, `eval/otel.ts`, `daemon-reports.ts`, `record.ts`, `trunk-commit.ts` all go through `markPromise`; `suite-speed.js` marks no promise; the demo's `signal.ts` and the templates already write `broken`. `health-line.ts` untouched, D-2.)
- [x] Review the writer and reader changes against the TypeScript and OTel extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>
  Shape: reviewed `mark.ts` and `telemetry.ts`; nothing found. `markPromise` still has one reason to change (the wire shape of a signal); the test-run check is one line at the writer and one at the reader.

#### Build Phase 1 Verification

- [x] The writer, reader and other-writer tests now pass.
  <details><summary>Technical</summary>

  A6, A16, A26, A31 pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/signal-test-run.test.ts src/lib/promises/clause-break-event.test.ts src/lib/promises/signal-writers.test.ts src/__tests__/suite-speed.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/mark.ts src/lib/promises/telemetry.ts src/lib/promises/vocabulary.ts` — the whole suite runs at landing, not here. The demo's test: `pnpm --filter seat-holds exec vitest run`.

  </details>
  Green: A6, A16, A26 (system tier), A31; `vitest related` on the three files green apart from `src/lib/run/*` tests that fail identically without this change (checked by reverting the source: `commit-cadence.test.ts` red on `stopped-red`; unrelated, environment).

#### Build Phase 1 Context

- [x] Add the one-sentence decision to the root file's Key Decisions.
  <details><summary>Technical</summary>

  Root `CLAUDE.md`, Key Decisions: `- Signals prove a clause beside its tests: a clause is upheld only when its tests pass and its signal has reported in a real run; a break names its clause; no signal reads "no signal" — see /decisions/mark-first`. Always-on because the decision constrains every later plan's close; the rule itself lives in the package's promises area file (next item).

  </details>
- [x] Record the writer and reader rules in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: a signal names its promise and clause, writes `broken`, a test run's span carries `indusk.run=test` and no reader counts it; guard: `signal-test-run.test.ts`.

  </details>

#### Build Phase 1 Document

- [x] (none needed — the page that explains signals is written in Build Phase 6, when the whole path exists to describe)

### Build Phase 2: One tracer for InDusk's own commands

**Tier**: med — the work step's default

This phase gives the package's commands a single place to get a tracer that sends
to the local daemon and stays silent when none runs, so closing and the incident
writer in later phases can emit the spans their own clauses are read by. It adds
no behaviour a person sees yet.

- [x] Add the tracer provider for InDusk's commands and use it for the spans commands already emit.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/telemetry/command-tracer.ts`: `commandTracer(): Tracer`, reading the daemon's stored address through the existing finder (`daemon-address.ts`/`daemon-find.ts`; never a second daemon or a guessed port — `/decisions/daemon-found-not-guessed`); no-op tracer when no daemon is running, never an error. Per CLAUDE.md "Do Not Reinvent": use the official `@opentelemetry/sdk-trace-node` and the OTLP HTTP exporter already in the package's dependencies (verify with Context7 and `package.json` before adding any); no custom exporter. Route `new_project.create`'s span (`lib/new-project/create.ts`, `TRACER_NAME`) through it; its `options.tracer` override stays for tests.

  </details>
  **Decision D-13:** `commandTracer()` is lifted from `lib/eval/otel.ts` using the SDK packages already in `package.json` (`sdk-trace-node`, `exporter-trace-otlp-http`; no new dependency, no custom exporter). It finds the daemon with `liveOtlpEndpointSync` (the stored address), is lazy, is not registered globally so it never competes with the evaluator's `initEvalOtel`, and `createProject` flushes it when it made the tracer itself.
- [x] Review the provider against the OTel extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here. Confirm it adds no start-up cost to a command that emits nothing (lazy provider).

  </details>
  Shape: nothing found. No provider is built and no `ps`/`lsof` runs until a command asks for a tracer.

#### Build Phase 2 Verification

- [x] The package's commands still run with no daemon, and with one the span arrives.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/telemetry/command-tracer.ts src/lib/new-project/create.ts`; then run a command that emits a span once against the running daemon and confirm the span with the jaeger MCP.

  </details>
  `tsc --noEmit` clean; `vitest related` on both files green (7 tests). A probe span through `commandTracer()` reached the running daemon: Jaeger returned trace `28ddf59f…` for service `indusk`, operation `mark_first.phase2.probe`. (The jaeger MCP did not connect in this session, so Jaeger's HTTP query API was read directly.)
- [x] (no tests flip at this phase — reason: infra)

#### Build Phase 2 Context

- [x] Record that a command's spans go through the one tracer.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Promises and telemetry): commands get a tracer from `commandTracer()`; silent with no daemon; the address is the stored one.

  </details>

#### Build Phase 2 Document

- [x] (none needed — an internal tracer; the signals guide in Build Phase 6 mentions that a command's spans reach the daemon)

### Build Phase 3: What a clause and a promise read as

**Tier**: med — the work step's default

This phase teaches the standing reader to read each clause from its own signal: upheld
only on a real report, no signal when nothing reported or the watcher went blind,
broken on a break. A promise then reads as the worst of its clauses. Build Phase 4's
closing rule asks this reader, and the promise page, the status command and the admin all read
through it.

- [x] Add the reader that gives one clause its standing from its reports.
  <details><summary>Technical</summary>

  `clauseStanding(clause, { reports, heartbeatOk }, { testsPassing })` in `lib/promises/standing.ts`, returning `"broken" | "no-signal" | "holding"`; the reports are the clause's spans after the Build Phase 1 filter, `heartbeatOk` from the watcher's heartbeat (`watch.ts`, `watcher-heartbeat`). A split is broken by a report that misses its budget at its point; a limit by any one report over its bound. Passing tests alone never yield `holding` (A5). The clock and the reads are inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`).

  </details>
  **Decision D-14:** `clauseStanding(clause, { reports, heartbeatOk })` takes two arguments, not the three in the Test Phase 1 sketch: tests are deliberately not an input (A5), so a `testsPassing` parameter would be dead. It lives in `lib/promises/clause-standing.ts` (like `look-standing.ts`) and `standing.ts` re-exports it, so `import … from "./standing.js"` still works. A split is judged by its newest report, a limit by any one over its bound; a report also breaks when its measured `value` exceeds its `bound`.
- [x] Make a promise's standing the worst of its clauses, and a resting clause the standing of the promise it rests on.
  <details><summary>Technical</summary>

  In `standingOf`/`readStanding`: order broken, then no signal, then holding (A14); a `rests-on` clause takes the named promise's standing (A15, standing half); a promise with no clauses keeps today's rule untouched.

  </details>
  `readStanding` now also returns `clauses` and `signal` per promise (optional fields, so admin fixtures built before them still type-check); a broken signal makes the promise `broken`. The heartbeat is the project's sources: any source read blind makes `heartbeatOk` false. **Decision D-15:** to read a `state` promise's clause at all, one rule `readsSignal` (behaviour, or any promise with split/limit clauses) replaces three copies of "behaviour and not retired" in the timeline, the store and `sources.ts`. `health.ts`, `watch.ts` and `after-close.ts` keep behaviour-only; Build Phase 5 widens the recorder.
- [x] Make every place a clause is shown use that reader.
  <details><summary>Technical</summary>

  `promises status` (`status.ts`), the promise page, and the admin's DTO read `readStanding`; no second computation. The admin app gets only the new field through the package's reader (its CLAUDE.md: read-only).

  </details>
  `promises status` prints one line per clause from `clauseStanding`; the promise page's proof (`proof.ts`) and so the admin's DTO carry `clauses` and `signal` from `readStanding`. **Decision D-16:** the admin draws nothing new — the brief's Looks is "None" — it receives the fields; the clause views are the later cut. `no signal` is therefore visible in `promises status` and in the proof data, not yet as a new admin element.
- [x] Review the new reader against the TypeScript extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>
  Shape: `clauseStanding` is pure and takes its reads as inputs; `standingRows` grew a nested resolver (`signalOf`/`clausesOf`) to resolve resting clauses with a cycle guard — left in place because it needs the first pass's rows; nothing else found.

#### Build Phase 3 Verification

- [x] A clause reads upheld, no signal or broken exactly as the tests say, and a promise reads as its worst clause.
  <details><summary>Technical</summary>

  A4, A5, A8, A12, A13, A14 pass (A15 stays planned until Build Phase 4; A7 until Build Phase 5): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-standing.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/standing.ts src/lib/promises/status.ts`.

  </details>
  `clause-standing.test.ts` 15 passed (A4, A5, A8, A12, A13, A14, the standing half of A15, A7's reading half, and `promises status` words); `tsc --noEmit` clean; `vitest related` green except the `src/lib/run/*` tests that fail without this change too and A7's incident half (red by design). The four system-tier readers (`promise-sources`, `promise-timeline-reader`, `monitor-status`, `monitor-watch`) skip without a built `dist/`, so they run at landing.
- [x] (write red) The incident half of the break test is written and fails on its assertion.
  <details><summary>Technical</summary>

  A7 in `clause-break.test.ts`: the clause reads broken and the promise reads broken (passes), and an incident opens naming the clause (fails until Build Phase 5).

  </details>
  `clause-break.test.ts`: the reading half passes, the incident half fails on `expected … to match /^clause: never-twice$/m`.

#### Build Phase 3 Context

- [x] Record the standing rule in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: a clause with no report reads no signal; a promise is its worst clause; one reader, `clauseStanding`; guard: `clause-standing.test.ts`.

  </details>

#### Build Phase 3 Document

- [x] (none needed — the guide page in Build Phase 6 documents how a clause reads, once the closing rule that depends on it exists)

### Build Phase 4: Closing and landing read the system

**Tier**: strong — edits the close and landing gates every plan goes through

This phase makes closing and landing run the tests a clause's rows name and ask
the daemon whether each clause's signal reported upheld, refusing by clause. It
is the promise's core, and it is the phase where a mistake would block every
plan, so it reads the system through inputs a test can replace and leaves a plan
written before clauses on the old rule.

- [x] Make closing run the tests a clause's rows name and refuse a clause whose test fails now.
  <details><summary>Technical</summary>

  `confirmPlan` in `lib/promises/confirm.ts` gains inputs `runTests(files): Promise<{file, passed}[]>` and `readSignals(promise): Promise<ClauseReports>` (injected at the CLI edge with a vitest runner over `rowsProvingClause` files and the daemon reader `promises status` already uses). The refusal names `promise/clause` and the test file, and says which half is missing: tests or signal (A1, A3, A9). Only when the brief has `clauses: required`; a plan without clauses keeps the old rule (A25).

  </details>
**Decision D-17:** the two halves live in a new `lib/promises/clause-proof.ts` (`clauseTestsHalf`, `clauseSignalHalf`, the input types), so closing and landing call one function each and `confirm.ts` only wires them; the real runner is `clauseTestRunner` in `closing-inputs.ts`, over `runFiles` with the project's test command (pinned as a third consumer in `run-files-single-definition.test.ts`), passed by `indusk promises confirm` and the `confirm_promises` tool. The inputs are optional on `ConfirmInput`, so A25's legacy call is unchanged, and a plan written as clauses given none is refused, never closed on its State cells. A file the runner does not report counts as failing. `promise-clauses-close.test.ts` (the `a-plan-holds-the-promises-it-lands` story) now hands in a passing runner and upheld signals, because its fixture brief has `clauses: required`; what it asserts is unchanged.
- [x] Make closing refuse a clause whose signal has not reported upheld, and enforce the promise when all clauses pass.
  <details><summary>Technical</summary>

  Uses `clauseStanding` from Build Phase 3; a stopped daemon refuses with "the daemon is not running, start it with the telemetry start command" and never counts as a pass (ADR risk); `state: enforced` is written only after every clause passes (A9, A10); a promise made only of resting clauses closes when those promises are in force (A15, closing half).

  </details>
`clauseSignalHalf` reads each split and limit clause through `clauseStanding`; the real reader is `localSignalReader` (`closing-inputs.ts`): `readPromiseMarks` on the `local` source over the health window, read once per close; a stopped daemon or a blind watcher is a failed read whose refusal says the daemon is not running and gives `indusk telemetry start`. Both halves are decided before anything is written. **Decision D-18:** a promise made only of resting clauses (`restsOnly`, beside `hasSignalClauses`) is proved by what it rests on with no row, test or code site of its own — `rowProofs`, `judge` and the registry check (`check.ts`) each waive their "names no test / no site" refusal for it, since the check would otherwise refuse the very promise A15 lets close; its history line names the promises it rests on. **Decision D-19:** a real close writes its own signal — `markClosing` (`closing-signal.ts`) through `commandTracer()`, one span per half for `a-clause-is-proved-twice`'s `verified-before-release` and `upheld-by-its-signal`, broken only if the close accepted a clause a half refused, with the plan/phase pointer — called by `indusk promises confirm` and the confirm tool. This is the Boundary Map's "consumes Build Phase 2's tracer" and the brief's carried "closing emits the spans its clauses are read by"; `closing-signal.test.ts` pins it, with no trajectory row (D-6).
- [x] Make landing run the same tests and refuse by clause.
  <details><summary>Technical</summary>

  `lib/plans/land.ts` calls the same function with the same injected runner; refusal names the clause (A2). It does not ask the signal; landing is "before release" (the test half only; decision D-8).

  </details>
`refuseFailingClauseTests` (exported from `land.ts`, the seam A2 tests) finds the plan's promises with split or limit clauses through `clauseTestPlan` and runs `clauseTestsHalf`, the function closing uses; `landPlan` calls it after the trunk is merged into the branch and before the configured land checks, in both the normal and the workbench path, with `LandOptions.runTests` or the project's own runner (`clauseTestRunner`). `writtenAsClauses` moved beside it into `clause-proof.ts` so closing and landing read the opt-in one way.
- [x] Refuse a clause test file that carries the token and asserts nothing, if it makes no false refusals.
  <details><summary>Technical</summary>

  A29 in `lib/promises/confirm.ts` beside `clauseTokenRefusals`: a file carrying `clause: <promise>/<clause>` must contain at least one `expect(` or `assert` call. Decision D-3: run the check over every existing plan's rows in dusk first (a script in the scratchpad, not committed); if it refuses any plan that closed legitimately, drop the check and its row (`State: skipped`, reason recorded in Notes).

  </details>
**Decision D-20:** the check ships. The D-3 scan (a scratchpad script over every impl, active and archived) read 159 rows naming a clause and 71 distinct test files: none that exists lacks an `expect(` or `assert` (the files that do not exist are later phases' and other plans' unwritten rows). `assertsSomething` runs in `clauseTokenRefusals` only on a file that already carries the clause's token. Two test fixtures whose clause test was a bare token with an empty `it` (`promises-confirm.test.ts`'s `provingClauses`, `promise-clauses-close.test.ts`) now assert one line: fixtures, not plans, so D-3's rule does not apply to them.
- [x] Make the new sentence of the closed-plan promise true.
  <details><summary>Technical</summary>

  `indusk promises change a-closed-plan-kept-its-promises --plan mark-first --statement "A plan cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced." --reason "closing now runs the tests and reads the signal"`.

  </details>
Ran verbatim: the registry entry now reads the new sentence, owned by mark-first, with the old one kept in its History. `promises check` then refused a Build Phase 3 comment in `clause-standing.ts` ("…read for a promise: a behaviour promise…" parsed as a token for a promise named `a`); reworded with a dash, and the check passes (165 promises).
- [x] Review the closing and landing changes against the TypeScript extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>
Shape (after Verification was green; `prepareShapeReview` gave 19 changed files, no unreadable extension): one finding, fixed in this item's commit — `clauseTestPlan` refused landing for a plan with no plan folder before asking whether it was written as clauses, so a plan written before clause plans could have been stopped by a clause rule; it now returns null there (lands as before). Left as is: `clauseTestsHalf` collects files, runs them once and blames each failure in one function (about 60 lines) — one reason to change, the tests half's verdict, and splitting the blame step would only move its two maps apart; `confirm.ts` is 472 lines, with the clause halves in their own function (`clauseHalves`) and module — whether the closing rule should be decomposed further across files is `/cleanup`'s.

#### Build Phase 4 Verification

- [x] Closing and landing refuse and accept as the tests say.
  <details><summary>Technical</summary>

  A1, A2, A3, A9, A10, A15, A29 pass; A25 still passes: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-tests-run.test.ts src/lib/plans/land-clause-tests.test.ts src/lib/promises/confirm-signal.test.ts src/lib/promises/clause-test-asserts.test.ts src/lib/promises/confirm-legacy-plan.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/confirm.ts src/lib/plans/land.ts`.

  </details>
The five files: 19 passed (A1, A2, A3, A9, A10, A15's closing half, A29, and A25 still green); `vitest related` on `confirm.ts` and `land.ts`: 39 passed; on the other files this phase changed, 303 of 304, the one red being A7's incident half (Build Phase 5, by design); `tsc --noEmit` clean. With `dist/` built, the system tier over the same files: 261 of 264, the three red being environmental — `land-own-worktree.test.ts` and `detail-is-only-read.test.ts` run `plans accept`/`land` and an `ask` gate, which this unattended build step's environment (`INDUSK_GATE_POLICY=auto`, a build step) refuses by design. `indusk plans tests mark-first --phase "Build Phase 4"`: 13 of 14 files, the red being `admin-recorder.test.ts`, which needs the admin bundle this worktree has not built.
- [x] This plan's brief and registry still agree.
  <details><summary>Technical</summary>

  `indusk promises contract mark-first` and `indusk promises check`.

  </details>
Run with this worktree's build: the contract agrees (1 made, 3 kept, 2 changed, 0 replaced; 3 expectations); the check passes (165 promises).

#### Build Phase 4 Context

- [x] Record what closing and landing read in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: closing runs the clause's tests and asks the daemon; both are inputs; a stopped daemon refuses, never passes; guard: `clause-tests-run.test.ts`, `confirm-signal.test.ts`. Also `templates/planning/CLAUDE.md` (package-owned, shipped): a plan with clauses closes only when its tests pass and its signals reported.

  </details>
Area: one entry in `src/lib/promises/CLAUDE.md` (the two inputs, the stopped daemon, landing's tests half, the old rule kept, the empty-test and resting-only rules; guards named). Planning: the close-out entry of `templates/planning/CLAUDE.md` gains the sentence, copied to `.indusk/planning/CLAUDE.md` byte for byte (`skill-sync-parity.test.ts`, `promise-words.test.ts`, `context-tiers-ship.test.ts` green).

#### Build Phase 4 Document

- [x] Describe what closing reads in the promises command reference.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/promises.md`: `confirm` runs the clause's tests, asks the daemon, and refuses by clause; the refusal texts.

  </details>
A new "A plan written as clauses" subsection under `promises confirm`: the two halves, a table of the refusal texts (tests, signal, stopped daemon, a clause test that asserts nothing), the resting-only close, the close's own signal, and that `plans land` runs the same tests half.

### Build Phase 5: A break names its clause

**Tier**: med — the work step's default

This phase makes the event a broken clause emits and the incident it opens name the
promise and the clause first, with the plan and phase that added the signal as a
pointer, and lets a person go from the incident to the clause's tests and its
signal's emit place. It finishes the break path that Build Phase 1 started.

- [x] Make the incident name the promise and the clause, and the plan and phase as a pointer.
  <details><summary>Technical</summary>

  `incidentText`/`recordViolations` in `lib/promises/incidents.ts` take `clause` and `pointer` (from the break event's `indusk.clause` and `indusk.signal.plan`/`phase`); frontmatter `clause:`, a "Signal" line naming `promise/clause`, the pointer second; a promise with no clause writes what it writes today (A27).

  </details>
Done: `MarkedSpan` gains `signal` (`parseMarkedSpan` reads `indusk.signal.plan`/`phase` off the violated event); `incidentText` takes `clause` and `pointer`, writes frontmatter `clause:` and a `Signal: promise/clause — added by plan …` line ahead of the symptom. **Decision D-21:** the clause and pointer come from the newest violation of the pass; a clause arrived on a span, so it is written plain only when it is a registry-style name, else quoted on one line (it can never add a frontmatter key). An open incident that is extended keeps the clause it was opened with.
- [x] Make the incident reach the clause's tests and the place that emits its signal.
  <details><summary>Technical</summary>

  `provenBy` lists the rows and files that carry `clause: <promise>/<clause>` (through `rowsProvingClause`) and the files that emit the signal (the token scan `citations.ts` already runs), under "Proven by"; no search by file name (A18).

  </details>
Done in the same commit (one function, `provenBy`): with a clause it lists only the rows that prove that clause (`rowsProvingClause`, made generic so the plan stays on the row), then "The signal is emitted at: …". **Decision D-22:** the emit place is the promise's registry `sites` that carry the clause's token, or all its readable sites when none does; no repository scan, because `provenBy` is synchronous and the registry already declares sites (a signal emitted from a file no `sites` names is not reachable from the incident). Paths are read under the plan root and pass `isUsableRelPath`.
- [x] Make the recorder open an incident from a clause's break.
  <details><summary>Technical</summary>

  `record.ts`/`recordBreaks` reads the clause from the marked span (`parseMarkedSpan`), passes it through; `a-production-break-is-recorded-unasked` and `a-break-reaches-the-working-agent` unchanged (their tests stay green).

  </details>
Done at `watch.ts`, which `recordBreaks` runs: it read only `kind: behaviour` promises, so a clause on a `state` or `structure` promise was never recorded; it now reads `readsSignal` (the rule D-15 introduced for exactly this). The clause and pointer already travel on the `MarkedSpan` (`parseMarkedSpan`), so `record.ts` itself is unchanged. New guard `record-clause-break.test.ts` drives `recordBreaks` over a state promise with a limit clause (not a trajectory row). **Decision D-23 (supersedes my first reading):** the signal for `a-break-names-its-clause` is emitted by the recorder, after it commits a pass: the test plan defines it as "read from the incident the break opens... upheld when every incident opened by a clause's signal names `promise/clause`; broken reports an incident naming only a promise". `incident-signal.ts` reads each incident the pass *opened* from a break that named a clause (an extended incident was named when it opened; a break naming no clause writes nothing) and writes one span per verdict through `commandTracer()` + `markPromise`, with the Build Phase 5 pointer, no project (like the recorder's own mark: the promise lives in dusk's registry, whichever project the pass was for). The write is a dependency of `recordBreaks` (`markIncident`), best-effort, never failing the pass; `record-clause-break.test.ts` pins it. Build Phase 6 / the close: `mark-first`'s own close needs this span reported in a real run of the recorder, as D-19's spans were.
- [ ] Make the new sentence of the incident promise true.
  <details><summary>Technical</summary>

  `indusk promises change an-incident-names-its-tests --plan mark-first --statement "When a clause breaks, its incident names the promise and the clause that broke, and the tests tied to that clause are reachable from it; the plan it reopens can still be edited." --reason "the incident names its clause first"`.

  </details>
- [ ] Review the incident changes against the TypeScript extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 5 Verification

- [ ] The incident names its clause and pointer, reaches the tests, and the earlier incidents are unchanged.
  <details><summary>Technical</summary>

  A7, A17, A18 pass; A27 and the existing `record.test.ts`, `record-broken.test.ts`, `test-born-incident.test.ts` still pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-break.test.ts src/lib/promises/incident-names-clause.test.ts src/lib/promises/incident-no-clause.test.ts src/lib/promises/record.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/incidents.ts src/lib/promises/record.ts`.

  </details>

#### Build Phase 5 Context

- [ ] Record that the clause is the incident's key in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: an incident is keyed by `promise/clause`, the plan and phase are a pointer; guard: `incident-names-clause.test.ts`.

  </details>

#### Build Phase 5 Document

- [ ] Describe how a break names its clause in the signals guide.
  <details><summary>Technical</summary>

  Folded into `apps/docs/src/guide/signals.md` (written in Build Phase 6); this item is checked there.

  </details>

### Build Phase 6: One word, the live check and the docs

**Tier**: med — the work step's default

This phase says "signal" everywhere the telemetry was called a mark, runs the one
end-to-end check of the whole path against the real daemon, and writes the pages that explain
signals. It closes the plan: nothing after it changes behaviour.

- [ ] Replace the old word for a promise's telemetry with "signal" in skills, tool descriptions, docs and code comments.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/*.md` (never `.claude/skills/` directly; sync after so `skill-sync-parity.test.ts` holds), MCP tool descriptions, `apps/docs/src/{guide,reference}`, comments in `src/`. Exempt: the Day 4b entry in the root `CLAUDE.md`, `.indusk/planning/archive/`, `apps/docs/src/decisions/`, this plan's name. Identifiers such as `PROMISE_MARK`, `markPromise` and `parseMarkedSpan` keep their names this release (a rename of exported symbols is not promised; decision D-4). A30 passes.

  </details>
- [ ] Write the end-to-end check and run it once against the real daemon.
  <details><summary>Technical</summary>

  `src/__tests__/clause-signal.live.test.ts` in the package's system tier (`vitest.tiers.ts`; not in `pnpm test`): a clause with a signal written by `markPromise` through `commandTracer()` reaches the local daemon, `clauseStanding` reads it upheld, and `confirmPlan` accepts it. Run it once with `pnpm test:system` (daemon up) and record the result and date under Notes (A11). `INDUSK_SKIP_TELEMETRY_AUTOSTART` stays set for `pnpm test`.

  </details>
- [ ] Write the signals guide, update the briefs and test-trajectory guides, and publish the decision.
  <details><summary>Technical</summary>

  New `apps/docs/src/guide/signals.md` (what a signal is, derived from the clause and not from a test, the kinds, fire rate, how a break names its clause; a Mermaid flow from the ADR's Documentation Plan: a clause joining its tests and its signal at the clause key, a break arriving at the incident); update `guide/briefs.md` ("Promises as clauses": the two proofs) and `guide/test-trajectory.md` (closing runs the clause's tests); `decisions/mark-first.md` from `adr.md` with its docs frontmatter; sidebar entries; changelog entry "Added: a clause is proved by its tests and its signal; a break names its clause; one word, signal."

  </details>
- [ ] Review the cleanup against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 6 Verification

- [ ] The word check passes and the live check ran once and passed.
  <details><summary>Technical</summary>

  A30 passes: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/signal-word.test.ts src/__tests__/skill-sync-parity.test.ts`. A11 recorded under Notes with its result.

  </details>
- [ ] The docs build and the plan's promise checks pass.
  <details><summary>Technical</summary>

  `pnpm --filter docs build` and `indusk promises contract mark-first` and `indusk promises check`. The retrospective then runs `indusk promises confirm mark-first`.

  </details>

#### Build Phase 6 Context

- [ ] Record the word rule where plan documents are written.
  <details><summary>Technical</summary>

  `templates/planning/CLAUDE.md` (the planning rules; extend the existing promise-words entry): the telemetry of a clause is its signal, never a mark; guard: `signal-word.test.ts`.

  </details>

#### Build Phase 6 Document

- [ ] Check the signals guide covers how a break names its clause (carried from Build Phase 5).
  <details><summary>Technical</summary>

  `guide/signals.md` has the section; the Mermaid flow renders in `pnpm --filter docs build`.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/mark.ts`, `vocabulary.ts`, `telemetry.ts` | writer carries clause and pointer, writes `broken`, marks test runs; reader skips them |
| `apps/indusk-mcp/scripts/suite-speed.js`, `examples/seat-holds/src/signal.ts`, `telemetry.ts` | write `broken` |
| `apps/indusk-mcp/src/lib/telemetry/command-tracer.ts` | new: one tracer for InDusk's commands |
| `apps/indusk-mcp/src/lib/promises/standing.ts`, `status.ts` | clause standing; promise as its worst clause |
| `apps/indusk-mcp/src/lib/promises/confirm.ts`, `apps/indusk-mcp/src/lib/plans/land.ts` | closing and landing run the tests and read the signal |
| `apps/indusk-mcp/src/lib/promises/incidents.ts`, `record.ts` | incidents name the clause and pointer |
| `apps/indusk-mcp/skills/*.md`, tool descriptions, comments | the word signal |
| `apps/indusk-mcp/src/lib/promises/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `templates/planning/CLAUDE.md`, root `CLAUDE.md` | the rules above |
| `apps/docs/src/guide/signals.md`, `briefs.md`, `test-trajectory.md`, `reference/cli/promises.md`, `decisions/mark-first.md` | docs |
| the test files named in the trajectory | new and changed tests |

## Dependencies

- `a-new-project-starts-instrumented` (the keys a signal carries) and `daemon-found-not-guessed` (closing asks the daemon): both named in the brief's Depends On. This build uses the keys already in `vocabulary.ts` and the stored daemon address; if the first plan's vocabulary has not landed on `main` when the build starts, Build Phase 1 stops with a blocker.
- `plans-are-promises` and `one-promise-language`: landed.

## Notes

**Decisions made while writing this plan (unattended; each with its reason).**

- **D-1. The writer sets the test-run marker, from `VITEST`.** A reader cannot tell a test's span from a real one after the fact; the ADR's D3 says writers set it. Alternative (a reader-side filter by service name) rejected: a test can name its service anything.
- **D-2. The editor's health line keeps `violated`.** The brief says so; this plan does not touch `health-line.ts`.
- **D-3. A29 ships only if it makes no false refusal over dusk's own closed plans.** The test plan marks it the weakest row and the ADR says droppable; a false refusal blocks a close, which costs more than the check earns. Rule: "contains an `expect(` or `assert` call" only; if any closed plan is refused, drop it and mark the row `skipped` with that reason.
- **D-4. Exported symbols keep their names** (`PROMISE_MARK`, `markPromise`, `parseMarkedSpan`). The brief's word cleanup lists skills, tool descriptions, docs and code comments, not identifiers; renaming them is a wider change no promise asks for.
- **D-5. No OTel gate sections.** `.indusk/config.json` has `otel.role: "library"`, so the planner's rule says none are written, though this plan teaches the package to emit spans: the gate is about the package's own instrumentation, which Build Phase 2 handles as a task.
- **D-6. The carried tracer has no test row.** The test plan has none and the impl derives its rows from the test plan; recorded under Deferred Verification rather than adding a row the person has not seen.
- **D-7. The demo app's writer is switched here.** The brief says it is the scaffold plan's through its helper, while the test plan's A31 names the demo app. This plan switches `examples/seat-holds` where that helper lives today and leaves it alone if `a-new-project-starts-instrumented` has already moved it, in which case A31's demo half is dropped from the row's Test cell.
- **D-8. Landing runs the tests but not the signal.** "Before release" is the test half (`verified-before-release`); the signal is read at close.
- **D-9. The ADR's D8 stands:** `known-broken` is accepted as a skew with older InDusks; nothing in this plan writes `known-violated`.
- **D-10. Gates are filled with real items except where a phase changes no rule or no doc,** and those say `(none needed — <why>)`, which the reviewer reads (gate policy `auto`).

**Live check (A11) result:** not yet run.
