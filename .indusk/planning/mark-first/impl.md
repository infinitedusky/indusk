---
title: "Tests and telemetry linked to clauses"
date: 2026-10-18
status: approved
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
| A1 | Closing a plan is refused when a test that proves one of its clauses fails at close, though its row says passing; the refusal names the clause and the file | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/promises/clause-tests-run.test.ts |
| A2 | Landing a plan is refused when a test that proves one of its clauses fails, naming the clause | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/plans/land-clause-tests.test.ts |
| A3 | A failing test is reported against the clause its file names | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/verified-before-release | apps/indusk-mcp/src/lib/promises/clause-tests-run.test.ts |
| A4 | A clause whose signal reported upheld in a real run reads upheld on the promise page and in `promises status` | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A5 | A clause with passing tests and no report from its signal does not read upheld | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A6 | A signal whose only source is a test run is not the clause's signal: the clause reads no signal however often the test passes | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/signal-test-run.test.ts |
| A7 | A clause whose signal reports broken reads broken, its promise reads broken, and an incident opens naming the clause and its symptom | Build Phase 3 | Build Phase 5 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-break.test.ts |
| A8 | A split is broken by missing its budget at its point; a limit by one report over its bound, however many were inside | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A9 | A plan written as clauses cannot close while a clause has a failing test or no signal that reported upheld; the refusal says which is missing | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A10 | When such a plan closes, its promise is enforced | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A11 | A clause's signal run against the real system through the local daemon reports upheld and the clause then reads upheld end to end | Build Phase 6 | Build Phase 6 | planned | live check | clause: a-clause-is-proved-twice/upheld-by-its-signal | apps/indusk-mcp/src/__tests__/clause-signal.live.test.ts |
| A12 | A clause whose signal never reported reads no signal on the promise page, in `promises status` and in the admin, never drawn as holding | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A13 | A clause that last reported upheld, whose watcher has gone silent past its heartbeat, reads no signal | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A14 | A promise with one clause upheld and another reading no signal is not holding: the worst clause decides | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts |
| A15 | A promise made only of resting clauses has the standing of those promises and closes when they are in force, with no row of its own | Build Phase 3 | Build Phase 4 | planned | unit | clause: a-clause-is-proved-twice/no-signal-is-not-holding | apps/indusk-mcp/src/lib/promises/clause-standing.test.ts, apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts |
| A16 | When a clause's signal reports broken, the event it emits carries the promise and the clause | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/clause-break-event.test.ts |
| A17 | The incident a broken clause opens names the promise and the clause and, when recorded, the plan and phase that added the signal, as a pointer | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/incident-names-clause.test.ts |
| A18 | From an incident a person reaches the clause's tests and the place that emits its signal, with no search by file name | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-clause-is-proved-twice/a-break-names-its-clause | apps/indusk-mcp/src/lib/promises/incident-names-clause.test.ts |
| A25 | A plan written before clause plans still closes on passing tests that name its promises, with no signal asked of it | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard over a-closed-plan-kept-its-promises for every plan closed before clauses | apps/indusk-mcp/src/lib/promises/confirm-legacy-plan.test.ts |
| A26 | `markPromise` writes `broken` where it wrote `violated`, and every reader still reads both | Test Phase 1 | Build Phase 1 | planned | unit | the switch carried from one-promise-language; a rename no promise of this plan states | apps/indusk-mcp/src/lib/promises/signal-writers.test.ts |
| A27 | A promise with no clauses still opens an incident that names the tests that proved it | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard over an-incident-names-its-tests for every promise written before clauses | apps/indusk-mcp/src/lib/promises/incident-no-clause.test.ts |
| A29 | A test file carrying a clause token is refused at close when it asserts nothing about the clause | Build Phase 4 | Build Phase 4 | planned | unit | tightens verified-before-release; droppable if it makes false refusals (decision D-3 below) | apps/indusk-mcp/src/lib/promises/clause-test-asserts.test.ts |
| A30 | No skill, tool description or doc page calls a promise's telemetry a mark; each says signal (exempt: the Day 4b entry in the root `CLAUDE.md`, archived plans and decisions, this plan's name) | Test Phase 1 | Build Phase 6 | planned | unit | the word cleanup carried from one-promise-language; no promise of this plan states it | apps/indusk-mcp/src/__tests__/signal-word.test.ts |
| A31 | The suite-speed script and the demo app write `broken` where they wrote `violated`, and every reader still reads both | Test Phase 1 | Build Phase 1 | planned | unit | the writers outside `markPromise`, carried from one-promise-language's falsification | apps/indusk-mcp/src/__tests__/suite-speed.test.ts, examples/seat-holds/src/telemetry.test.ts |

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

- [ ] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start feature mark-first`; `indusk worktree list`. This plan sets no `worktree: none`.

  </details>
- [ ] Write the tests for the signal writer and the span parser and see them fail.
  <details><summary>Technical</summary>

  A16 in `src/lib/promises/clause-break-event.test.ts`: `markPromise` with `clause` and a plan/phase pointer, on a broken outcome, adds an event carrying the promise and the clause. A6 in `signal-test-run.test.ts`: a span carrying `indusk.run=test`, parsed by `parseMarkedSpan`, is ignored. A26: change `signal-writers.test.ts` to assert the wire word is `broken` for `markPromise` and keep the readback assertion. All under `apps/indusk-mcp/`; each file carries `clause: a-clause-is-proved-twice/<clause>` for its clause row.

  </details>
- [ ] Write the tests for the other writers and the word check and see them fail.
  <details><summary>Technical</summary>

  A31: `src/__tests__/suite-speed.test.ts` asserts the script's written outcome is `broken`; `examples/seat-holds/src/telemetry.test.ts` asserts the demo helper writes `broken`. A30: `src/__tests__/signal-word.test.ts` scans `skills/`, the MCP tool descriptions, `apps/docs/src/{guide,reference}` and `src/` comments for a promise's telemetry called a "mark", with the exemptions in the row; it fails on today's wording.

  </details>
- [ ] Write the guards for behaviour that must not change and see them pass.
  <details><summary>Technical</summary>

  A25 `confirm-legacy-plan.test.ts`: a plan with no clauses closes on passing rows that name its promises, asking no signal. A27 `incident-no-clause.test.ts`: a promise with no clauses opens an incident whose "Proven by" section names its tests, through `recordViolations`/`provenBy`.

  </details>

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

- [ ] The tests whose subjects exist fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-break-event.test.ts src/lib/promises/signal-test-run.test.ts src/lib/promises/signal-writers.test.ts src/__tests__/suite-speed.test.ts src/__tests__/signal-word.test.ts src/lib/promises/confirm-legacy-plan.test.ts src/lib/promises/incident-no-clause.test.ts` — A6, A16, A26, A30, A31 red on assertions; A25, A27 green. The demo's test runs in its own project: `pnpm --filter seat-holds exec vitest run src/telemetry.test.ts`.

  </details>
- [ ] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body reviewed against two questions: will it compile at the phase it names, and does it assert what its row claims? A4 to A14 and A29 not shown here are written from the same shape in their phase.

  </details>

#### Test Phase 1 Context

- [ ] (none needed — Test Phase 1 only writes tests; it changes no rule about how the project works)

#### Test Phase 1 Document

- [ ] (none needed — tests that do not yet pass document nothing; each build phase documents what it makes true)

### Build Phase 1: The writers and the readers of a signal

**Tier**: med — the work step's default

This phase makes a signal say which clause it concerns, say that it broke in the
word the project now uses, and be told apart from a test run. It is the base the
rest stands on: standing (Build Phase 3) trusts only signals this phase lets
through, and incidents (Build Phase 5) read the clause and pointer this phase
writes.

- [ ] Make the signal writer carry the clause on a break, and the plan and phase that added the signal, and write the new word for a break.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/mark.ts`: `WRITTEN_BROKEN = "broken"`; the break event also carries `indusk.promise` and `indusk.clause`; optional `signal: { plan, phase }` sets `indusk.signal.plan`/`indusk.signal.phase` on the broken event only. Add the keys to `PROMISE_MARK` in `vocabulary.ts` (the one definition; `promises-single-definition.test.ts` pins that). Update the doc comment that says the wire word is still `violated`.

  </details>
- [ ] Make the writer mark a span made under a test runner so the readers can skip it.
  <details><summary>Technical</summary>

  When `process.env.VITEST` is set, `markPromise` sets `indusk.run=test` (ADR D3). Decision D-1 below: the marker is set by the writer, because a reader cannot tell a test's span from a real one otherwise.

  </details>
- [ ] Make the readers of signals skip a span marked as a test run.
  <details><summary>Technical</summary>

  `parseMarkedSpan` in `lib/promises/telemetry.ts` returns null for a span with `indusk.run=test`; keep reading both `violated` and `broken` (`readOutcome`).

  </details>
- [ ] Switch the other InDusk writers to the new word for a break.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/scripts/suite-speed.js`, any caller of `markPromise` that spells the old word itself (`lib/looks/report.ts`, `lib/eval/otel.ts`, `lib/telemetry/daemon-reports.ts`, `lib/promises/record.ts`, `lib/promises/trunk-commit.ts` — check each; most go through `markPromise`, so only a hand-written word changes), and the demo's helper `examples/seat-holds/src/signal.ts` and `telemetry.ts`. The editor's health line (`health-line.ts`, `runs[].outcome`) keeps `violated`: do not change it (decision D-2).

  </details>
- [ ] Review the writer and reader changes against the TypeScript and OTel extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 1 Verification

- [ ] The writer, reader and other-writer tests now pass.
  <details><summary>Technical</summary>

  A6, A16, A26, A31 pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/signal-test-run.test.ts src/lib/promises/clause-break-event.test.ts src/lib/promises/signal-writers.test.ts src/__tests__/suite-speed.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/mark.ts src/lib/promises/telemetry.ts src/lib/promises/vocabulary.ts` — the whole suite runs at landing, not here. The demo's test: `pnpm --filter seat-holds exec vitest run`.

  </details>

#### Build Phase 1 Context

- [ ] Add the one-sentence decision to the root file's Key Decisions.
  <details><summary>Technical</summary>

  Root `CLAUDE.md`, Key Decisions: `- Signals prove a clause beside its tests: a clause is upheld only when its tests pass and its signal has reported in a real run; a break names its clause; no signal reads "no signal" — see /decisions/mark-first`. Always-on because the decision constrains every later plan's close; the rule itself lives in the package's promises area file (next item).

  </details>
- [ ] Record the writer and reader rules in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: a signal names its promise and clause, writes `broken`, a test run's span carries `indusk.run=test` and no reader counts it; guard: `signal-test-run.test.ts`.

  </details>

#### Build Phase 1 Document

- [ ] (none needed — the page that explains signals is written in Build Phase 6, when the whole path exists to describe)

### Build Phase 2: One tracer for InDusk's own commands

**Tier**: med — the work step's default

This phase gives the package's commands a single place to get a tracer that sends
to the local daemon and stays silent when none runs, so closing and the incident
writer in later phases can emit the spans their own clauses are read by. It adds
no behaviour a person sees yet.

- [ ] Add the tracer provider for InDusk's commands and use it for the spans commands already emit.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/telemetry/command-tracer.ts`: `commandTracer(): Tracer`, reading the daemon's stored address through the existing finder (`daemon-address.ts`/`daemon-find.ts`; never a second daemon or a guessed port — `/decisions/daemon-found-not-guessed`); no-op tracer when no daemon is running, never an error. Per CLAUDE.md "Do Not Reinvent": use the official `@opentelemetry/sdk-trace-node` and the OTLP HTTP exporter already in the package's dependencies (verify with Context7 and `package.json` before adding any); no custom exporter. Route `new_project.create`'s span (`lib/new-project/create.ts`, `TRACER_NAME`) through it; its `options.tracer` override stays for tests.

  </details>
- [ ] Review the provider against the OTel extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here. Confirm it adds no start-up cost to a command that emits nothing (lazy provider).

  </details>

#### Build Phase 2 Verification

- [ ] The package's commands still run with no daemon, and with one the span arrives.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/telemetry/command-tracer.ts src/lib/new-project/create.ts`; then run a command that emits a span once against the running daemon and confirm the span with the jaeger MCP.

  </details>
- [ ] (no tests flip at this phase — reason: infra)

#### Build Phase 2 Context

- [ ] Record that a command's spans go through the one tracer.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Promises and telemetry): commands get a tracer from `commandTracer()`; silent with no daemon; the address is the stored one.

  </details>

#### Build Phase 2 Document

- [ ] (none needed — an internal tracer; the signals guide in Build Phase 6 mentions that a command's spans reach the daemon)

### Build Phase 3: What a clause and a promise read as

**Tier**: med — the work step's default

This phase teaches the standing reader to read each clause from its own signal: upheld
only on a real report, no signal when nothing reported or the watcher went blind,
broken on a break. A promise then reads as the worst of its clauses. Build Phase 4's
closing rule asks this reader, and the promise page, the status command and the admin all read
through it.

- [ ] Add the reader that gives one clause its standing from its reports.
  <details><summary>Technical</summary>

  `clauseStanding(clause, { reports, heartbeatOk }, { testsPassing })` in `lib/promises/standing.ts`, returning `"broken" | "no-signal" | "holding"`; the reports are the clause's spans after the Build Phase 1 filter, `heartbeatOk` from the watcher's heartbeat (`watch.ts`, `watcher-heartbeat`). A split is broken by a report that misses its budget at its point; a limit by any one report over its bound. Passing tests alone never yield `holding` (A5). The clock and the reads are inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`).

  </details>
- [ ] Make a promise's standing the worst of its clauses, and a resting clause the standing of the promise it rests on.
  <details><summary>Technical</summary>

  In `standingOf`/`readStanding`: order broken, then no signal, then holding (A14); a `rests-on` clause takes the named promise's standing (A15, standing half); a promise with no clauses keeps today's rule untouched.

  </details>
- [ ] Make every place a clause is shown use that reader.
  <details><summary>Technical</summary>

  `promises status` (`status.ts`), the promise page, and the admin's DTO read `readStanding`; no second computation. The admin app gets only the new field through the package's reader (its CLAUDE.md: read-only).

  </details>
- [ ] Review the new reader against the TypeScript extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 3 Verification

- [ ] A clause reads upheld, no signal or broken exactly as the tests say, and a promise reads as its worst clause.
  <details><summary>Technical</summary>

  A4, A5, A8, A12, A13, A14 pass (A15 stays planned until Build Phase 4; A7 until Build Phase 5): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-standing.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/standing.ts src/lib/promises/status.ts`.

  </details>
- [ ] (write red) The incident half of the break test is written and fails on its assertion.
  <details><summary>Technical</summary>

  A7 in `clause-break.test.ts`: the clause reads broken and the promise reads broken (passes), and an incident opens naming the clause (fails until Build Phase 5).

  </details>

#### Build Phase 3 Context

- [ ] Record the standing rule in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: a clause with no report reads no signal; a promise is its worst clause; one reader, `clauseStanding`; guard: `clause-standing.test.ts`.

  </details>

#### Build Phase 3 Document

- [ ] (none needed — the guide page in Build Phase 6 documents how a clause reads, once the closing rule that depends on it exists)

### Build Phase 4: Closing and landing read the system

**Tier**: strong — edits the close and landing gates every plan goes through

This phase makes closing and landing run the tests a clause's rows name and ask
the daemon whether each clause's signal reported upheld, refusing by clause. It
is the promise's core, and it is the phase where a mistake would block every
plan, so it reads the system through inputs a test can replace and leaves a plan
written before clauses on the old rule.

- [ ] Make closing run the tests a clause's rows name and refuse a clause whose test fails now.
  <details><summary>Technical</summary>

  `confirmPlan` in `lib/promises/confirm.ts` gains inputs `runTests(files): Promise<{file, passed}[]>` and `readSignals(promise): Promise<ClauseReports>` (injected at the CLI edge with a vitest runner over `rowsProvingClause` files and the daemon reader `promises status` already uses). The refusal names `promise/clause` and the test file, and says which half is missing: tests or signal (A1, A3, A9). Only when the brief has `clauses: required`; a plan without clauses keeps the old rule (A25).

  </details>
- [ ] Make closing refuse a clause whose signal has not reported upheld, and enforce the promise when all clauses pass.
  <details><summary>Technical</summary>

  Uses `clauseStanding` from Build Phase 3; a stopped daemon refuses with "the daemon is not running, start it with the telemetry start command" and never counts as a pass (ADR risk); `state: enforced` is written only after every clause passes (A9, A10); a promise made only of resting clauses closes when those promises are in force (A15, closing half).

  </details>
- [ ] Make landing run the same tests and refuse by clause.
  <details><summary>Technical</summary>

  `lib/plans/land.ts` calls the same function with the same injected runner; refusal names the clause (A2). It does not ask the signal; landing is "before release" (the test half only; decision D-8).

  </details>
- [ ] Refuse a clause test file that carries the token and asserts nothing, if it makes no false refusals.
  <details><summary>Technical</summary>

  A29 in `lib/promises/confirm.ts` beside `clauseTokenRefusals`: a file carrying `clause: <promise>/<clause>` must contain at least one `expect(` or `assert` call. Decision D-3: run the check over every existing plan's rows in dusk first (a script in the scratchpad, not committed); if it refuses any plan that closed legitimately, drop the check and its row (`State: skipped`, reason recorded in Notes).

  </details>
- [ ] Make the new sentence of the closed-plan promise true.
  <details><summary>Technical</summary>

  `indusk promises change a-closed-plan-kept-its-promises --plan mark-first --statement "A plan cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced." --reason "closing now runs the tests and reads the signal"`.

  </details>
- [ ] Review the closing and landing changes against the TypeScript extension's rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 4 Verification

- [ ] Closing and landing refuse and accept as the tests say.
  <details><summary>Technical</summary>

  A1, A2, A3, A9, A10, A15, A29 pass; A25 still passes: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-tests-run.test.ts src/lib/plans/land-clause-tests.test.ts src/lib/promises/confirm-signal.test.ts src/lib/promises/clause-test-asserts.test.ts src/lib/promises/confirm-legacy-plan.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/confirm.ts src/lib/plans/land.ts`.

  </details>
- [ ] This plan's brief and registry still agree.
  <details><summary>Technical</summary>

  `indusk promises contract mark-first` and `indusk promises check`.

  </details>

#### Build Phase 4 Context

- [ ] Record what closing and landing read in the promises area's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: closing runs the clause's tests and asks the daemon; both are inputs; a stopped daemon refuses, never passes; guard: `clause-tests-run.test.ts`, `confirm-signal.test.ts`. Also `templates/planning/CLAUDE.md` (package-owned, shipped): a plan with clauses closes only when its tests pass and its signals reported.

  </details>

#### Build Phase 4 Document

- [ ] Describe what closing reads in the promises command reference.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/promises.md`: `confirm` runs the clause's tests, asks the daemon, and refuses by clause; the refusal texts.

  </details>

### Build Phase 5: A break names its clause

**Tier**: med — the work step's default

This phase makes the event a broken clause emits and the incident it opens name the
promise and the clause first, with the plan and phase that added the signal as a
pointer, and lets a person go from the incident to the clause's tests and its
signal's emit place. It finishes the break path that Build Phase 1 started.

- [ ] Make the incident name the promise and the clause, and the plan and phase as a pointer.
  <details><summary>Technical</summary>

  `incidentText`/`recordViolations` in `lib/promises/incidents.ts` take `clause` and `pointer` (from the break event's `indusk.clause` and `indusk.signal.plan`/`phase`); frontmatter `clause:`, a "Signal" line naming `promise/clause`, the pointer second; a promise with no clause writes what it writes today (A27).

  </details>
- [ ] Make the incident reach the clause's tests and the place that emits its signal.
  <details><summary>Technical</summary>

  `provenBy` lists the rows and files that carry `clause: <promise>/<clause>` (through `rowsProvingClause`) and the files that emit the signal (the token scan `citations.ts` already runs), under "Proven by"; no search by file name (A18).

  </details>
- [ ] Make the recorder open an incident from a clause's break.
  <details><summary>Technical</summary>

  `record.ts`/`recordBreaks` reads the clause from the marked span (`parseMarkedSpan`), passes it through; `a-production-break-is-recorded-unasked` and `a-break-reaches-the-working-agent` unchanged (their tests stay green).

  </details>
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
