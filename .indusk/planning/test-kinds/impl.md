---
title: "Test kinds"
date: 2026-10-05
status: in-progress
trajectory: required
test_kinds: required
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

| ID | Asserts | Writable at | Passes at | State | Kind |
|----|---------|-------------|-----------|-------|------|
| A1 | The root `pnpm test` finishes in about a minute with both packages running at once (live check, recorded) | Build Phase 3 | Build Phase 3 | passing | live check |
| A2 | The admin suite alone finishes in under 60 s (live check, recorded) | Build Phase 3 | Build Phase 3 | passing | live check |
| A3 | Each build phase of this plan verifies in seconds to tens of seconds (live check, recorded per phase) | Build Phase 1 | Build Phase 5 | passing | live check |
| A4 | A production break reads red while its incident is open and purple once fixed | Build Phase 1 | Build Phase 1 | passing | unit |
| A5 | Local's chip goes green once a newer local run holds, with no incident | Build Phase 1 | Build Phase 1 | passing | unit |
| A6 | A violation reaching Jaeger minutes late still turns its chip and cell red | Build Phase 1 | Build Phase 1 | passing | unit |
| A7 | After repointing the server, nothing from the old server is drawn | Build Phase 1 | Build Phase 1 | passing | unit |
| A8 | A window too slow for one refresh is drawn within a few, saying how far back it has read | Build Phase 1 | Build Phase 1 | passing | unit |
| A9 | A refresh with nothing new asks only for the recent past | Build Phase 1 | Build Phase 1 | passing | unit |
| A10 | An unreadable source's chips are hollow, say *health unknown since*, never green; the other source still drawn | Build Phase 1 | Build Phase 1 | passing | unit |
| A11 | A blind watcher's source says *watcher blind* | Build Phase 1 | Build Phase 1 | passing | unit |
| A12 | A violated promise names its newest violation's environment | Build Phase 1 | Build Phase 1 | passing | unit |
| A13 | The Promises page rendered against a real Jaeger shows a run's chips and strip (system tier) | Build Phase 2 | Build Phase 2 | passing | contract |
| A14 | An everyday-tier test in either package that starts a server or waits on the wall clock fails the guard, naming file, line and call | Test Phase 1 | Build Phase 2 | passing | unit |
| A15 | A short-lived process that runs and exits (`git`, the CLI) does not trip the guard | Test Phase 1 | Test Phase 1 | passing | unit |
| A16 | Every everyday run is marked held or broken with its duration; a slow run fails nothing; an overlapping run is not judged | Build Phase 5 | Build Phase 5 | passing | unit |
| A17 | A run at or over 120 s reads violated for `everyday-suite-stays-fast`, owned by test-kinds | Build Phase 5 | Build Phase 5 | passing | unit |
| A18 | An impl with `test_kinds: required` whose row has no kind, or one outside the five, is refused naming the five | Test Phase 1 | Build Phase 4 | passing | unit |
| A19 | The planner's Verification template no longer offers `pnpm test` as a phase's default | Test Phase 1 | Build Phase 4 | passing | unit |
| A20 | After a change that only adds an admin test which starts `next dev`, the root `pnpm test` fails: no package's test run is replayed from turbo's cache, so the guard in mcp sees the admin's files every time | Phase 0 | Build Phase 6 | written | unit |
| A21 | The guard catches a wait written with `node:timers/promises` — `await setTimeout(5_000)`, `scheduler.wait(5_000)` — as it catches `setTimeout(r, 5_000)` | Phase 0 | Build Phase 6 | written | unit |
| A22 | A file commented out of the admin's `SYSTEM` list, which vitest then runs as everyday, is scanned as everyday by the guard | Phase 0 | Build Phase 6 | written | unit |
| A23 | A run that fails within seconds is not marked `everyday-suite-stays-fast` upheld — a crash measures nothing; a slow failing run is still marked broken | Phase 0 | Build Phase 6 | written | unit |

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

- [x] A4–A12 pass (`cd apps/indusk-admin && pnpm exec vitest run src/lib/__tests__/promise-store src/lib/__tests__/promise-health`), in seconds — 9 tests, 0.4 s of test time
- [x] The admin type-check passes (`pnpm exec tsc --noEmit`), and the eight HTTP files still pass (nothing they assert changed) — tsc clean; the eight: 27 of 28 in one run (223 s), the one, `http-promise-health`'s chip-rules test, a 5 s test timeout under load, 8 of 8 alone — the flake these files are being retired for
- [x] A3 recorded: this phase's verification time — 3.5 s wall (both unit files and the type-check), against 223 s for the files they replace
- [x] Shape — `promise-timeline.ts` / `promise-health.ts` gained one optional argument each and the tail/older budget rule; `fake-source.ts` is one job (answer like Jaeger from lists); nothing to change. `readWindow` stays as recorded at promise-timeline's close

#### Build Phase 1 Context

- [x] guard: A4–A12 carry `lesson: code-that-decides-takes-its-clock-and-its-reads`; `apps/indusk-admin/CLAUDE.md`'s Promises-page rule gains "the store and the health read take `Deps` (clock, resolve, read, probe); tests feed them with `fakeSource`"

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: one sentence — the store's and health read's rules are tested with injected time and sources (where the store paragraph ends)

### Build Phase 2: Servers only in the system tier

- [x] `apps/indusk-admin/vitest.tiers.ts`: `SYSTEM` = every file that starts `next dev` after this phase — A13's contract and the seven page tests (`http-smoke`, `http-plan-worktrees`, `http-project-promises`, `http-project-research`, `http-project-scorecards`, `http-stale-project`, `live-refresh.e2e`); the everyday node project excludes them and drops `fileParallelism: false` — done; `SYSTEM` holds 13 files: the seven page tests and the six promise HTTP files kept whole (next item)
- [x] `apps/indusk-admin/vitest.system.config.ts` + `"test:system"` script: runs `SYSTEM`, one file at a time, through `with-daemon-guard.js` — done
- [x] A13: `apps/indusk-admin/src/__tests__/http-promises-page-contract.test.ts` — one real Jaeger, one held and one violated run, the page shows a red and a green chip and a strip; from `http-promise-timeline.test.ts`'s setup — changed in the doing: no new trimmed file. Checking each of the eight files' assertions against A4–A12 found page-level ones the unit tests do not reach — strip markup and bands, the source switch in the URL, sort order, the sidebar's red, the watcher-blind banner, live refresh, the monitor segment. The six files holding them are kept whole in `SYSTEM` as the page's contract; `http-promise-timeline.test.ts` is A13 (a real Jaeger, the page draws chips and strips)
- [x] Delete the eight HTTP promise files (`http-promise-timeline-sources`, `-falsify`, `http-promise-sources`, `http-promise-remote`, `http-promise-health`, `http-promise-timeline-transfer`, `http-watcher-blind`, `http-promise-timeline`) — each only after Build Phase 1 recorded all its assertions red-then-green — two deleted, `-falsify` and `-transfer`, every assertion of each now a unit test (A6–A9); the other six moved to `SYSTEM` by the rule in this item — deleted only when every assertion is covered. Rewriting their page assertions as component tests is a follow-up
- [x] `apps/indusk-admin/src/components/LiveRefresh.test.tsx`: fake timers in place of its four real waits (found by the A14 guard at Test Phase 1) — done: `setInterval` faked, `vi.advanceTimersByTimeAsync`; the fake clock exposed that the test's `useRouter` mock returned a new object per render, restarting the interval after a failure — one probe more than Next's stable router makes; the mock now returns one router
- [x] mcp's four clock-waiting files: `monitor-mark`, `telemetry-query-latency`, `admin/__tests__/daemon-identity`, `telemetry/orphans` — fake timers where the wait is incidental; into `SYSTEM` where the wait is the subject; the choice recorded per file — `monitor-mark`, `admin/__tests__/daemon-identity`, `telemetry/orphans` to `SYSTEM` — each waits on a real detached process, the wait is the subject; `telemetry-query-latency`'s `sleep(500)` is in a comment — the guard now blanks comment lines
- [x] Root `package.json`: `"test:system"` runs both packages' system tiers (`turbo test:system --concurrency=1`); `apps/indusk-mcp/package.json`'s `release` calls the root one (`pnpm -w test:system`) — done; `test-daemons-guard`'s A5 now also asserts the admin's `test:system` runs through the guard wrapper
- [x] The guard (A14) reads the admin's `vitest.tiers.ts` as it reads mcp's — done

#### Build Phase 2 Verification

- [x] A14 passes; A13 passes (`cd apps/indusk-admin && pnpm test:system`); A15 still passes — the admin system tier 13 files, 56 tests, 183 s
- [x] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear — `test:system` green over both packages (mcp 37 files 147 s, admin 13 files 183 s); `pnpm test` green but for A18 and A19, written red at Test Phase 1 and passing at Build Phase 4; the admin's everyday suite alone 49 files in 5 s (from 255 s). Two reds this phase's run surfaced and fixed: the root `CLAUDE.md`'s 20 % budget margin (this plan's Key Decisions line, also on trunk — trimmed on both), and this impl's own note naming an old file's row label the validator read as a missing row
- [x] A3 recorded — the phase's own tests (guard, LiveRefresh, the A5 wrapper check) ran in about 2 s; its full-suite runs were the landing-sized check this phase needed, since it moved files between tiers
- [x] Shape — `vitest.tiers.ts` and `vitest.system.config.ts` mirror mcp's; the guard's patterns are a data table; nothing to change

#### Build Phase 2 Context

- [x] guard: A14 carries `lesson: everyday-tests-never-wait`; `apps/indusk-admin/CLAUDE.md` gains "a test that starts `next dev` or a server belongs in `vitest.tiers.ts` `SYSTEM`"; mcp's `vitest.tiers.ts` header names the guard that now enforces its rule

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md` (testing note) and the root `CLAUDE.md` Conventions `pnpm test` line: `test:system` covers both packages and runs at landing and release — root, because it is the one command line every session reads before running tests

### Build Phase 3: The root suite in parallel

- [x] Root `package.json` `test`: drop `--concurrency=1`; the commit message names `6ffccf28`, whose reason is gone
- [x] A1, A2 measured: three runs each, idle machine (no other `vitest`), times recorded in this item; A1 ≤ ~75 s, A2 < 60 s — A1 54 s, 55 s, 53 s; A2 10 s, 5 s, 5 s (`TURBO_FORCE=true`, no other `vitest` running)

#### Build Phase 3 Verification

- [x] A1 and A2 recorded and within target; `pnpm test` green three times in a row in parallel (no starvation flake) — three runs, each with only A18 and A19 red (written at Test Phase 1, passing at Build Phase 4); the admin's 316 and mcp's other 1,696 tests green every time
- [x] A3 recorded — the phase changed one script line; its verification was the timing runs themselves
- [x] Shape — skipped: the phase changed no code file (a `package.json` script)

#### Build Phase 3 Context

- [x] root (Conventions): the `pnpm test` line says the packages run in parallel and nothing in it starts a server — always-on because every session runs it

#### Build Phase 3 Document

- [x] `apps/docs/src/changelog.md` Unreleased: `pnpm test` runs both packages in parallel, about a minute

### Build Phase 4: The five kinds

- [x] `apps/indusk-mcp/src/lib/test-kinds.ts`: `TEST_KINDS = ["unit", "contract", "live check", "smoke", "promise"] as const` with each kind's moment, and `isTestKind`; exported as subpath `./test-kinds`
- [x] `lib/trajectory/parser.ts` + `validator.ts`: with `test_kinds: required`, every row's `Kind` must be one of `TEST_KINDS` (A18); without it, unchanged; `validate-impl-structure.js` calls it
- [x] `apps/indusk-mcp/skills/planner.md`: the test-plan section and template — the mechanism column is **Kind**, one of the five, the smallest that proves the assertion, `contract` only for a question about something we do not own; the clock-and-reads rule with its lesson; the impl template sets `test_kinds: required`, has a `Kind` column, and its Verification example names the phase's rows and `vitest related`, not `pnpm test` (A19)
- [x] `apps/indusk-mcp/skills/work.md`: phase verification runs the phase's rows and `vitest related` over the files it changed; full `pnpm test` + `pnpm test:system` at landing; the real-red rule narrowed (a seam gives an honest red; the boundary only for a question about the boundary)
- [x] `apps/indusk-mcp/skills/verify.md`: the skip table's "Test (all)" row moves to landing
- [x] `apps/indusk-mcp/skills/retrospective.md` Step 10: landing runs `pnpm test:system` as well as `pnpm test`
- [x] This impl gains `test_kinds: required` and a `Kind` column, every row given its kind — the plan validated by its own rule — A1–A3 live check, A4–A12 unit, A13 contract, A14–A19 unit

#### Build Phase 4 Verification

- [x] A18 and A19 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/test-kinds-validation src/__tests__/planner-verification-template`); the trajectory validator's existing tests still pass, including the six legacy impls with style `Kind` values — 87 tests across trajectory, kinds, A18, A19 and the corpus check
- [x] Installed skills synced (`indusk update` in this repo) and `pnpm test` green — green in 53 s: 268 mcp files, the admin, `promises:check`, no leftover daemon
- [x] A3 recorded — this phase's own tests (kinds, parity, trajectory, skill sync) in about 2 s; the one full run was the green this phase's Verification names
- [x] Shape — `test-kinds.ts` is one definition with its copy pinned; the kind rule is one function in each of the hook and the library, mirrored as the parser already is; nothing to change

#### Build Phase 4 Context

- [x] planning (`apps/indusk-mcp/templates/planning/CLAUDE.md`): "a test plan's Kind is one of five — unit / contract / live check / smoke / promise — the smallest that proves it; `test_kinds: required` validates it" — see `/guide/test-kinds`

#### Build Phase 4 Document

- [x] New `apps/docs/src/guide/test-kinds.md` (kinds and their moments, a Mermaid kind → trigger diagram, the smallest-kind default, clock and reads, the two tiers); `guide/test-trajectory.md` (`Kind`, `test_kinds: required`); sidebar entry

### Build Phase 5: The suite's own promises

- [x] `.indusk/promises/everyday-tests-never-wait.md`: `kind: structure`, owner `test-kinds`, test `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts`, its statement in plain words
- [x] `apps/indusk-mcp/scripts/suite-speed.js`: `suiteSpeedMark({ durationMs, overlapped })` → `{ outcome: "upheld" | "violated", durationMs } | { skip: reason }` at `THRESHOLD_MS = 120_000`; `overlapped` from another `vitest` process alive at start or end
- [x] `with-daemon-guard.js`: time the run; when invoked as the everyday suite (`--mark everyday-suite-stays-fast`, set in the root `test` script only), send one mark to the local daemon through the watcher probe's span sender (`sendWatcherSpan` shape: `indusk.promise`, `indusk.promise.outcome`, `indusk.suite.duration_ms`, `indusk.project`); no daemon or overlap → mark nothing, say why on stderr; never change the exit code
- [x] `.indusk/promises/everyday-suite-stays-fast.md`: `kind: behaviour`, owner `test-kinds`, site `apps/indusk-mcp/scripts/with-daemon-guard.js`, test `apps/indusk-mcp/src/__tests__/suite-speed.test.ts`
- [x] A16, A17: `apps/indusk-mcp/src/__tests__/suite-speed.test.ts` — under, at and over the threshold; overlapped → skip; no daemon → skip with reason
- [x] Live check: one real `pnpm test` with the daemon running marks `everyday-suite-stays-fast` upheld; the Promises page shows it green; recorded here — marked upheld (52 s); `promises status` reads it last seen upheld; the running admin draws its chip green. The first attempt marked nothing: `pgrep -f vitest` matched the calling shell's own command line, so every run looked overlapped — the check now looks for a vitest binary or worker outside the run's own ancestry (`ac29a477`), with a test for that case

#### Build Phase 5 Verification

- [x] A16, A17 pass; `pnpm promises:check` passes with both promises; the live check recorded — 5 tests; 6 promises, structure 2, behaviour 3
- [x] A3 recorded across all five build phases; `pnpm test` and `pnpm test:system` green — per phase: Build 1 3.5 s, Build 2 about 2 s, Build 3 the timing runs, Build 4 about 2 s, Build 5 under 1 s for its own tests (`suite-speed`, the guard); `pnpm test` 53 s green, `test:system` both tiers green (mcp 37 files, admin 13), each ending with the leak guard's all-clear
- [x] Shape — `suite-speed.js` keeps the decision (`suiteSpeedMark`, `otherTestRuns`) pure and takes its daemon and sender as inputs; the wrapper only times and calls it; nothing to change

#### Build Phase 5 Context

- [x] current.md: the two promises named in the Project region's test line; guard: `suite-speed.test.ts` carries `lesson: a-suites-speed-is-a-promise-not-a-gate`

#### Build Phase 5 Document

- [x] `apps/docs/src/guide/test-kinds.md`: the two promises; `apps/docs/src/changelog.md` Unreleased: the kinds, the admin system tier, the two promises

### Build Phase 6: Falsification — a cached guard, waits it cannot read, a list it misreads, a crash marked fast

**Goal**: verify whether the attested state holds against four failures found by reading the built code and turbo's dry run. Each row is one hypothesis, red today; each item is the fix it needs.

- **A20**: `turbo.json`'s `test` task is cached, keyed on each package's own files (`turbo run test --dry=json`: `indusk-mcp#test` HIT). The guard lives in mcp and reads the admin's tests, so a change touching only an admin test leaves mcp's cache valid, turbo replays mcp's last green, and the guard never runs. The same replay makes a cached root run take seconds and mark `everyday-suite-stays-fast` upheld while the real suite may be slow.
- **A21**: the guard's timer pattern matches the callback idiom `setTimeout(r, N)` only. `import { setTimeout } from "node:timers/promises"; await setTimeout(5_000)` and `scheduler.wait(5_000)` wait just as long and pass.
- **A22**: the guard reads the admin's `SYSTEM` by regex over the file's text, so a line commented out of the array still counts as system; vitest imports the array, runs that file as everyday, and the guard never scans it.
- **A23**: the speed mark judges duration alone: a run that crashes at startup (a build error, a missing dependency) exits in seconds and is marked upheld — green evidence of a suite that never ran.

- [x] `turbo.json`: the `test` task is `"cache": false` — a test run is a question asked now, never a replayed answer (A20)
- [x] The guard's waits: a literal ≥ 100 ms as the *first* argument of `setTimeout` (the promise form) and `scheduler.wait(` join the pattern table (A21)
- [ ] The guard imports the admin's `vitest.tiers.ts` `SYSTEM` instead of reading its text (A22)
- [ ] `suiteSpeedMark` takes the run's exit code: a failed run under the threshold is skipped with its reason; a failed run over it is still violated (A23); `with-daemon-guard.js` passes it

#### Build Phase 6 Verification

- [ ] A20–A23 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/everyday-tests-never-wait src/__tests__/suite-speed src/__tests__/turbo-test-not-cached`); A1–A19 still pass
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear; A1 re-measured with the cache off

#### Build Phase 6 Context

- [ ] guard: the turbo test carries `lesson: a-test-run-is-never-replayed-from-a-cache`; the root `CLAUDE.md` `pnpm test` line says no test run is cached — only if it fits the root budget, otherwise the lesson alone

#### Build Phase 6 Document

- [ ] `apps/docs/src/guide/test-kinds.md`: no run is replayed from turbo's cache, and why; the speed mark skips a run that failed fast. `apps/docs/src/changelog.md` Unreleased: the same two lines

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
