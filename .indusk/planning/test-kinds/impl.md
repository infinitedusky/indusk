---
title: "Test kinds"
date: 2026-10-05
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Test kinds

## Goal

A phase is verified in seconds, the everyday suite runs in about a minute with
both packages in parallel, every rule the admin's eight server-booting files
checked is still checked, and InDusk holds two promises about its own suite
([ADR](adr.md)).

## Scope

### In Scope
- Clock and read inputs for the store and the health read; a fake source; the
  eight files converted rule for rule (D2, D3)
- The admin system tier; the root suite parallel; mcp's four clock-waiting
  files (D4, D6)
- The five kinds, validated; the planner, work and verify skills (D1, D5)
- `everyday-tests-never-wait` and `everyday-suite-stays-fast` (D6, D7)

### Out of Scope
- `release-ci`; the watcher package split; the watcher's latency promise;
  mcp files slow without waiting (brief, Out of Scope)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the guard (red), the kind validator test (red), the template test (red) | today's tree |
| Build Phase 1 | `Deps` on `readWindow` / `readHealth`; `fake-source.ts`; A4–A12 unit tests | the store, the health read |
| Build Phase 2 | admin `vitest.tiers.ts` + `test:system`; A13; the eight files deleted; mcp's four fixed; root `test:system` over both | Build Phase 1's tests |
| Build Phase 3 | the root suite parallel; A1, A2 measured | Build Phase 2's tiers |
| Build Phase 4 | `lib/test-kinds.ts`; `test_kinds: required` validated; planner, work, verify skills | — |
| Build Phase 5 | the two promise files; the speed mark in `with-daemon-guard.js` | the local daemon, the promise loop |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | The root `pnpm test` finishes in about a minute with both packages running at once (live check, recorded) | Build Phase 3 | Build Phase 3 | planned |
| A2 | The admin suite alone finishes in under 60 s (live check, recorded) | Build Phase 3 | Build Phase 3 | planned |
| A3 | Each build phase of this plan verifies in seconds to tens of seconds (live check, recorded per phase) | Build Phase 1 | Build Phase 5 | planned |
| A4 | A production break reads red while its incident is open and purple once fixed | Build Phase 1 | Build Phase 1 | planned |
| A5 | Local's chip goes green once a newer local run holds, with no incident | Build Phase 1 | Build Phase 1 | planned |
| A6 | A violation reaching Jaeger minutes late still turns its chip and cell red | Build Phase 1 | Build Phase 1 | planned |
| A7 | After repointing the server, nothing from the old server is drawn | Build Phase 1 | Build Phase 1 | planned |
| A8 | A window too slow for one refresh is drawn within a few, saying how far back it has read | Build Phase 1 | Build Phase 1 | planned |
| A9 | A refresh with nothing new asks only for the recent past | Build Phase 1 | Build Phase 1 | planned |
| A10 | An unreadable source's chips are hollow, say *health unknown since*, never green; the other source still drawn | Build Phase 1 | Build Phase 1 | planned |
| A11 | A blind watcher's source says *watcher blind* | Build Phase 1 | Build Phase 1 | planned |
| A12 | A violated promise names its newest violation's environment | Build Phase 1 | Build Phase 1 | planned |
| A13 | The Promises page rendered against a real Jaeger shows a run's chips and strip (system tier) | Build Phase 2 | Build Phase 2 | planned |
| A14 | An everyday-tier test in either package that starts a server or waits on the wall clock fails the guard, naming file, line and call | Test Phase 1 | Build Phase 2 | written |
| A15 | A short-lived process that runs and exits (`git`, the CLI) does not trip the guard | Test Phase 1 | Test Phase 1 | passing |
| A16 | Every everyday run is marked held or broken with its duration; a slow run fails nothing; an overlapping run is not judged | Build Phase 5 | Build Phase 5 | planned |
| A17 | A run at or over 120 s reads violated for `everyday-suite-stays-fast`, owned by test-kinds | Build Phase 5 | Build Phase 5 | planned |
| A18 | An impl with `test_kinds: required` whose row has no kind, or one outside the five, is refused naming the five | Test Phase 1 | Build Phase 4 | written |
| A19 | The planner's Verification template no longer offers `pnpm test` as a phase's default | Test Phase 1 | Build Phase 4 | written |

### Deferred Verification

- **The threshold is right (U2)**
  - reason: whether 120 s is loose enough not to cry wolf and tight enough to see drift shows only over weeks of real runs
  - would require: a few weeks of marks from real `pnpm test` runs
  - mitigation: this plan's retrospective reads the first runs' durations from the local Jaeger and records any false mark; the threshold is one constant in `with-daemon-guard.js`
- **Later plans follow the clock-and-reads rule (U1)**
  - reason: it is about code not yet written, by agents reading prose
  - would require: the next plan that adds a store or a reader
  - mitigation: the planner rule and the lesson `code-that-decides-takes-its-clock-and-its-reads`; Shape reviews each phase; the A14 guard refuses the symptom the day a server-booting test is added

## Checklist

### Test Phase 1: The guard, the kind check and the template check, red

**Goal**: author every test that can be authored against today's tree, and record why the rest cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree create test-kinds`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [x] A14: `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts`. Lists each package's everyday files (its test files minus its tier list; the admin has none yet, so all), scans them against a data table of patterns (server starters `startNextDev`, `startAlwaysOnServer`, the daemon/Jaeger starters, `spawn(` with `detached: true`; waits `sleep(`, `setTimeout`/`setInterval` with a literal ≥ 100 ms in a file without `vi.useFakeTimers`), and fails naming file, line and call. Message carries `lesson: everyday-tests-never-wait`. RED: the admin's 15 `next dev` files and `LiveRefresh.test.tsx` (real timers, found by the guard), and mcp's four clock-waiting files — 20 files. The timer pattern was narrowed on first run to the wait idiom (a promise resolved after N ms): a deadline timer that fires only when a test fails (`query-door`), or a hanging child's body (`run/falsification`), waits for nothing on a passing run
- [x] A15: in the same file, a case scanning a fixture string that calls `spawnSync("git", …)` and `execFile` of the CLI finds nothing
- [x] A18: `apps/indusk-mcp/src/__tests__/test-kinds-validation.test.ts`. Runs `hooks/validate-impl-structure.js` (over its stdin, as the hook is run) on an impl with `test_kinds: required` and a row whose `Kind` is `example`, and on one with no `Kind`; expects refusal naming `unit, contract, live check, smoke, promise`. RED: accepted today
- [x] A19: `apps/indusk-mcp/src/__tests__/planner-verification-template.test.ts`. Reads `skills/planner.md`'s impl template; fails while a Verification line offers `pnpm test` as the example command. RED today (line 519)

#### Deferred to Build Phase 1

- **A3** — a live check, measured as each build phase verifies; there is nothing to author before a build phase runs.
- **A4–A12** — each calls `readWindow` / `readHealth` with a `Deps` argument and the `fakeSource` helper, both introduced in Build Phase 1; the admin's type-check test (`typecheck.test.ts`) refuses a call with an argument the signature does not have, so the files cannot be authored today without breaking that test. The shape, for A6:

  ```typescript
  it("a violation reaching Jaeger late still turns its chip red", async () => {
    vi.useFakeTimers({ now: T0 });
    const src = fakeSource({ production: [held(T0 - HOUR)] });
    await readWindow(root, registry, "production", T0 - DAY, 2_000, src.deps);
    src.add("production", violated(T0 - 5 * MIN));        // arrives now, dated 5 min ago
    vi.advanceTimersByTime(6_000);
    const w = await readWindow(root, registry, "production", T0 - DAY, 2_000, src.deps);
    expect(stateOf(w), "lesson: code-that-decides-takes-its-clock-and-its-reads").toBe("red");
  });
  ```

#### Deferred to Build Phase 2

- **A13** — the contract is the existing `http-promise-timeline.test.ts` trimmed to one page render and moved into the admin system tier that Build Phase 2 creates; until the tier exists there is nowhere to put it but the everyday suite, which A14 forbids.

#### Deferred to Build Phase 3

- **A1, A2** — live checks of wall time, meaningful only once Build Phase 2 has emptied the everyday tiers of servers and Build Phase 3 has made the root run parallel.

#### Deferred to Build Phase 5

- **A16, A17** — their subject, the speed mark, is a function `suiteSpeedMark({ durationMs, overlapped })` in a module `scripts/suite-speed.js` that Build Phase 5 introduces; importing it today fails to load.

#### Regression Guards

- **A15** — the guard must not refuse short-lived processes; it passes when written and must stay so, since mcp's 28 everyday files that spawn `git` or the CLI are contracts with those tools, not waits.

#### Test Phase 1 Verification

- [x] A14, A18, A19 authored and red, each on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/everyday-tests-never-wait src/__tests__/test-kinds-validation src/__tests__/planner-verification-template`): A14 names the 20 files, A18 reports acceptance, A19 names line 519; A15 passes — confirmed: 4 red on their assertions (A18's "style word" and "no column" cases exit 0; its control passes), 4 green
- [x] The deferred bodies above reviewed: A4–A12 compile once `Deps` and `fakeSource` exist, and each asserts a rule its HTTP file asserts today

### Build Phase 1: The store and the health read take their clock and their reads

- [x] `apps/indusk-admin/src/lib/promise-timeline.ts`: `readWindow(projectRoot, registry, source, fromMs, timeoutMs, deps: Deps = {})`, `Deps = { now?, resolve?, read? }`; every `Date.now()` in it reads `now()`; `readTimelineView` passes `deps` through
- [x] `apps/indusk-admin/src/lib/promise-health.ts`: `readHealth(projectRoot, registry, deps: Deps & { probe? } = {})`; the cache's expiry and `unknownSince` read `now()`; the store is called with the same `deps`
- [x] `apps/indusk-admin/src/__tests__/helpers/fake-source.ts`: `fakeSource(runsBySource)` returning `{ deps, add(source, run), ranges, slow(ms), fail(source), blind(source) }` — answers `resolve`/`read`/`probe` from the lists, records each range asked for
- [x] `apps/indusk-admin/src/lib/__tests__/promise-store.test.ts`: A6, A7, A8, A9 against `readWindow`
- [x] `apps/indusk-admin/src/lib/__tests__/promise-health.test.ts`: A4, A5, A10, A11, A12 against `readHealth`
- [x] Each of A4–A12 shown red on its broken rule: break the rule once in the source (e.g. `LATE_MS = 0` for A6, key without the URL for A7, `violationState` returning `open` for fixed for A4), run, see the named test red, revert; record the break and the red line per row in this item's note
  - Recorded (each break applied alone, the named test run, then reverted; all nine green again after): A4 `!== "fixed"` → `!== "never"` (fixed reads live) RED · A5 `ruleFor` never `newest` RED · A6 `LATE_MS = 0` RED · A7 store key without the server URL RED (a first break, dropping a separator, left the URL in the key and stayed green — the break, not the test, was wrong) · A8 budget counts the tail RED · A9 `LATE_MS` = 30 days RED · A10 an unreadable read drawn green RED · A11 `blind` dropped RED · A12 the oldest violation's environment RED
- [x] `.claude/lessons/code-that-decides-takes-its-clock-and-its-reads.md`
- [x] (discovered) The store read the late tail and then stopped when the tail alone spent the refresh's budget, so a slow window was never read further — found by A8 in under a second; the old HTTP test's slow proxy never slowed the tail. Every refresh now reads the tail and at least one older slice (`82a0055c`)
- [x] (discovered) `apps/indusk-admin/src/__tests__/helpers/promise-registry.ts`: one behaviour promise and its incidents, read back as the admin reads them, for the unit tests

#### Build Phase 1 Verification

- [ ] A4–A12 pass (`cd apps/indusk-admin && pnpm exec vitest run src/lib/__tests__/promise-store src/lib/__tests__/promise-health`), in seconds
- [ ] The admin type-check passes (`pnpm exec tsc --noEmit`), and the eight HTTP files still pass (nothing they assert changed)
- [ ] A3 recorded: this phase's verification time

#### Build Phase 1 Context

- [ ] guard: A4–A12 carry `lesson: code-that-decides-takes-its-clock-and-its-reads`; `apps/indusk-admin/CLAUDE.md`'s Promises-page rule gains "the store and the health read take `Deps` (clock, resolve, read, probe); tests feed them with `fakeSource`"

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: one sentence — the store's and health read's rules are tested with injected time and sources (where the store paragraph ends)

### Build Phase 2: Servers only in the system tier

- [ ] `apps/indusk-admin/vitest.tiers.ts`: `SYSTEM` = every file that starts `next dev` after this phase — A13's contract and the seven page tests (`http-smoke`, `http-plan-worktrees`, `http-project-promises`, `http-project-research`, `http-project-scorecards`, `http-stale-project`, `live-refresh.e2e`); the everyday node project excludes them and drops `fileParallelism: false`
- [ ] `apps/indusk-admin/vitest.system.config.ts` + `"test:system"` script: runs `SYSTEM`, one file at a time, through `with-daemon-guard.js`
- [ ] A13: `apps/indusk-admin/src/__tests__/http-promises-page-contract.test.ts` — one real Jaeger, one held and one violated run, the page shows a red and a green chip and a strip; from `http-promise-timeline.test.ts`'s setup
- [ ] Delete the eight HTTP promise files (`http-promise-timeline-sources`, `-falsify`, `http-promise-sources`, `http-promise-remote`, `http-promise-health`, `http-promise-timeline-transfer`, `http-watcher-blind`, `http-promise-timeline`) — each only after Build Phase 1 recorded all its assertions red-then-green
- [ ] `apps/indusk-admin/src/components/LiveRefresh.test.tsx`: fake timers in place of its four real waits (found by the A14 guard at Test Phase 1)
- [ ] mcp's four clock-waiting files: `monitor-mark`, `telemetry-query-latency`, `admin/__tests__/daemon-identity`, `telemetry/orphans` — fake timers where the wait is incidental; into `SYSTEM` where the wait is the subject; the choice recorded per file
- [ ] Root `package.json`: `"test:system"` runs both packages' system tiers (`turbo test:system --concurrency=1`); `apps/indusk-mcp/package.json`'s `release` calls the root one (`pnpm -w test:system`)
- [ ] The guard (A14) reads the admin's `vitest.tiers.ts` as it reads mcp's

#### Build Phase 2 Verification

- [ ] A14 passes; A13 passes (`cd apps/indusk-admin && pnpm test:system`); A15 still passes
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear
- [ ] A3 recorded

#### Build Phase 2 Context

- [ ] guard: A14 carries `lesson: everyday-tests-never-wait`; `apps/indusk-admin/CLAUDE.md` gains "a test that starts `next dev` or a server belongs in `vitest.tiers.ts` `SYSTEM`"; mcp's `vitest.tiers.ts` header names the guard that now enforces its rule

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (testing note) and the root `CLAUDE.md` Conventions `pnpm test` line: `test:system` covers both packages and runs at landing and release — root, because it is the one command line every session reads before running tests

### Build Phase 3: The root suite in parallel

- [ ] Root `package.json` `test`: drop `--concurrency=1`; the commit message names `6ffccf28`, whose reason is gone
- [ ] A1, A2 measured: three runs each, idle machine (no other `vitest`), times recorded in this item; A1 ≤ ~75 s, A2 < 60 s

#### Build Phase 3 Verification

- [ ] A1 and A2 recorded and within target; `pnpm test` green three times in a row in parallel (no starvation flake)
- [ ] A3 recorded

#### Build Phase 3 Context

- [ ] root (Conventions): the `pnpm test` line says the packages run in parallel and nothing in it starts a server — always-on because every session runs it

#### Build Phase 3 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: `pnpm test` runs both packages in parallel, about a minute

### Build Phase 4: The five kinds

- [ ] `apps/indusk-mcp/src/lib/test-kinds.ts`: `TEST_KINDS = ["unit", "contract", "live check", "smoke", "promise"] as const` with each kind's moment, and `isTestKind`; exported as subpath `./test-kinds`
- [ ] `lib/trajectory/parser.ts` + `validator.ts`: with `test_kinds: required`, every row's `Kind` must be one of `TEST_KINDS` (A18); without it, unchanged; `validate-impl-structure.js` calls it
- [ ] `apps/indusk-mcp/skills/planner.md`: the test-plan section and template — the mechanism column is **Kind**, one of the five, the smallest that proves the assertion, `contract` only for a question about something we do not own; the clock-and-reads rule with its lesson; the impl template sets `test_kinds: required`, has a `Kind` column, and its Verification example names the phase's rows and `vitest related`, not `pnpm test` (A19)
- [ ] `apps/indusk-mcp/skills/work.md`: phase verification runs the phase's rows and `vitest related` over the files it changed; full `pnpm test` + `pnpm test:system` at landing; the real-red rule narrowed (a seam gives an honest red; the boundary only for a question about the boundary)
- [ ] `apps/indusk-mcp/skills/verify.md`: the skip table's "Test (all)" row moves to landing
- [ ] `apps/indusk-mcp/skills/retrospective.md` Step 10: landing runs `pnpm test:system` as well as `pnpm test`
- [ ] This impl gains `test_kinds: required` and a `Kind` column, every row given its kind — the plan validated by its own rule

#### Build Phase 4 Verification

- [ ] A18 and A19 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/test-kinds-validation src/__tests__/planner-verification-template`); the trajectory validator's existing tests still pass, including the six legacy impls with style `Kind` values
- [ ] Installed skills synced (`indusk update` in this repo) and `pnpm test` green
- [ ] A3 recorded

#### Build Phase 4 Context

- [ ] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): "a test plan's Kind is one of five — unit / contract / live check / smoke / promise — the smallest that proves it; `test_kinds: required` validates it" — see `/guide/test-kinds`

#### Build Phase 4 Document

- [ ] New `apps/docs/src/guide/test-kinds.md` (kinds and their moments, a Mermaid kind → trigger diagram, the smallest-kind default, clock and reads, the two tiers); `guide/test-trajectory.md` (`Kind`, `test_kinds: required`); sidebar entry

### Build Phase 5: The suite's own promises

- [ ] `.indusk/promises/everyday-tests-never-wait.md`: `kind: structure`, owner `test-kinds`, test `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts`, its statement in plain words
- [ ] `apps/indusk-mcp/scripts/suite-speed.js`: `suiteSpeedMark({ durationMs, overlapped })` → `{ outcome: "upheld" | "violated", durationMs } | { skip: reason }` at `THRESHOLD_MS = 120_000`; `overlapped` from another `vitest` process alive at start or end
- [ ] `with-daemon-guard.js`: time the run; when invoked as the everyday suite (`--mark everyday-suite-stays-fast`, set in the root `test` script only), send one mark to the local daemon through the watcher probe's span sender (`sendWatcherSpan` shape: `indusk.promise`, `indusk.promise.outcome`, `indusk.suite.duration_ms`, `indusk.project`); no daemon or overlap → mark nothing, say why on stderr; never change the exit code
- [ ] `.indusk/promises/everyday-suite-stays-fast.md`: `kind: behaviour`, owner `test-kinds`, site `apps/indusk-mcp/scripts/with-daemon-guard.js`, test `apps/indusk-mcp/src/__tests__/suite-speed.test.ts`
- [ ] A16, A17: `apps/indusk-mcp/src/__tests__/suite-speed.test.ts` — under, at and over the threshold; overlapped → skip; no daemon → skip with reason
- [ ] Live check: one real `pnpm test` with the daemon running marks `everyday-suite-stays-fast` upheld; the Promises page shows it green; recorded here

#### Build Phase 5 Verification

- [ ] A16, A17 pass; `pnpm promises:check` passes with both promises; the live check recorded
- [ ] A3 recorded across all five build phases; `pnpm test` and `pnpm test:system` green

#### Build Phase 5 Context

- [ ] current.md: the two promises named in the Project region's test line; guard: `suite-speed.test.ts` carries `lesson: a-suites-speed-is-a-promise-not-a-gate`

#### Build Phase 5 Document

- [ ] `apps/docs/src/guide/test-kinds.md`: the two promises; `apps/docs/src/changelog.md` Unreleased: the kinds, the admin system tier, the two promises

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-admin/src/lib/promise-timeline.ts`, `promise-health.ts` | `Deps` inputs |
| `apps/indusk-admin/src/__tests__/helpers/fake-source.ts` | new |
| `apps/indusk-admin/src/lib/__tests__/promise-store.test.ts`, `promise-health.test.ts` | new (A4–A12) |
| `apps/indusk-admin/src/__tests__/http-promise-*.test.ts`, `http-watcher-blind.test.ts` | deleted (8) |
| `apps/indusk-admin/src/__tests__/http-promises-page-contract.test.ts` | new (A13) |
| `apps/indusk-admin/vitest.tiers.ts`, `vitest.system.config.ts`, `vitest.config.ts`, `package.json` | system tier |
| `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts` | new guard (A14, A15) |
| four mcp clock-waiting tests, `vitest.tiers.ts` | fake clocks or SYSTEM |
| `package.json` (root), `apps/indusk-mcp/package.json` | parallel `test`; `test:system` over both; release |
| `apps/indusk-mcp/src/lib/test-kinds.ts`, `lib/trajectory/{parser,validator}.ts` | the kinds, validated |
| `apps/indusk-mcp/skills/{planner,work,verify,retrospective}.md` | kinds, phase verification, landing |
| `apps/indusk-mcp/scripts/{suite-speed,with-daemon-guard}.js` | the speed mark |
| `.indusk/promises/everyday-{tests-never-wait,suite-stays-fast}.md` | new |

## Dependencies
- promise-timeline landed (1.60.0) — the store and health read in their current shape.

## Notes
- Skill text here will be rewritten again by promise-core's `house-rules-out`; whichever lands second carries the other's edits.
