---
title: "A plan says how long it took"
date: 2026-10-19
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
cleanup: skipped
cleanup_reason: "Reviewed the 12 changed files: none over the 400-line cap, no cross-file duplication, boundaries settled."
gate_policy: ask
approved_brief: "f41cf42fe6354357005776aa2dc08b4dc0ea34cc9fb81788b02bd9f37b609b28"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T03:08:06.933Z"
accepted: 2026-10-19T03:28:01.780Z
accepted_by: person
---

# A plan says how long it took

## Goal

Every phase, every unattended step and every run of a plan's tests leaves a timed record on this machine, and one command, `indusk plans time <name>`, prints them with a total from the brief's acceptance to the plan's landing. A record that cannot be written never stops the work it records. Decisions in [adr.md](adr.md); assertions in [test-plan.md](test-plan.md).

## Scope

### In Scope
- A new `lib/timing/` module: the per-plan log, the safe writer, the tolerant reader, the phase-close, step and test-run recorders.
- Wiring each recorder into the one place its event happens: the phase-close site, the two runner call sites in the admin, and `plansTestsOutcome`.
- `indusk plans time <name>` and its reference page.

### Out of Scope
- Showing the times in the admin (the activity page's, `activity-and-graph`).
- Deciding from the data which tests run per phase.
- Changing `.indusk/phase-boundary.jsonl`'s shape or its reader's throw-on-corrupt rule.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `lib/timing/log.ts` (`timingLogPath`, `appendTiming`, `readTimings`), `lib/timing/safe.ts` (`recordSafely`), `lib/timing/phase-close.ts` (`recordPhaseClose`), the phase-close call at its one site | `bookkeepingRoots`, `readBoundaries`, `recordPhaseStart` |
| Build Phase 2 | `lib/timing/timed-step.ts` (`timedStep`), the wrap at the two runner call sites in the admin | `appendTiming`, `recordSafely`, the runners' `run` dependency |
| Build Phase 3 | `lib/timing/test-run.ts` (`recordTestRun`), the call inside `plansTestsOutcome` | `appendTiming`, `recordSafely`, `TestSet` and `planTestSet` |
| Build Phase 4 | `lib/timing/view.ts` (`planTime`, `formatPlanTime`), the `plans time` command, the docs | the three record sources, the brief's `accepted_at`, the landing time |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Opening a phase records its opening time, and the record that already existed for a phase's start still reads the same | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-says-how-long-it-took/phases-are-timed | apps/indusk-mcp/src/lib/timing/phase-close.test.ts |
| A2 | Closing a phase records its closing time against the phase that was open, never earlier than its opening time | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-says-how-long-it-took/phases-are-timed | apps/indusk-mcp/src/lib/timing/phase-close.test.ts |
| A3 | A phase closed twice, or closed without having been opened, keeps one honest record and invents no time | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-says-how-long-it-took/phases-are-timed | apps/indusk-mcp/src/lib/timing/phase-close.test.ts |
| A4 | A planning step that finishes leaves a record with its start, end and outcome "finished", still there after the step's session is gone | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-says-how-long-it-took/steps-are-timed | apps/indusk-mcp/src/lib/timing/timed-step.test.ts |
| A5 | A build step that ends in a blocker, a failure or a stop leaves a record naming that outcome | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-says-how-long-it-took/steps-are-timed | apps/indusk-mcp/src/lib/timing/timed-step.test.ts |
| A6 | A step killed before it wrote its end shows in the view as started and never ended, not missing | Build Phase 2 | Build Phase 4 | passing | unit | clause: a-plan-says-how-long-it-took/steps-are-timed | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A7 | A test run for a phase records the plan, the phase, the count of files run per reason, its duration and that it passed | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-says-how-long-it-took/test-runs-are-recorded | apps/indusk-mcp/src/lib/timing/test-run.test.ts |
| A8 | A test run at landing records "landing" in place of a phase, and a run with a failing file records that it did not pass | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-says-how-long-it-took/test-runs-are-recorded | apps/indusk-mcp/src/lib/timing/test-run.test.ts |
| A9 | Running a plan's tests twice records two runs in order, not one overwritten by the other | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-says-how-long-it-took/test-runs-are-recorded | apps/indusk-mcp/src/lib/timing/test-run.test.ts |
| A10 | The command prints each phase, step and test run of a plan with its duration, in the order they happened | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A11 | The command's total runs from the brief's acceptance to landing; for a plan not yet landed it says so and shows the time so far | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A12 | A plan recorded before this change prints what exists, says what has no record, and does not fail | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A13 | Run against a real plan in the worktree, the command prints a readable table a person can use to say which phase took longest | Build Phase 4 | Build Phase 4 | passing | live check | none — a live check is evidence for a person, not a clause proof; the one-view clause is proved by A10–A12 and A20–A24 | manual: `indusk plans time a-plan-says-how-long-it-took` from the plan's worktree; read which phase took longest |
| A14 | With the phase record unwritable, opening and closing a phase still succeed, with a warning that the time was not recorded | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-says-how-long-it-took/a-record-never-blocks | apps/indusk-mcp/src/lib/timing/phase-close.test.ts |
| A15 | With the step record unwritable, an unattended step still runs to its normal outcome and the build carries on | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-says-how-long-it-took/a-record-never-blocks | apps/indusk-mcp/src/lib/timing/timed-step.test.ts |
| A16 | With the test-run record unwritable, the plan's tests still run and the command exits with the tests' own result | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-says-how-long-it-took/a-record-never-blocks | apps/indusk-mcp/src/lib/timing/test-run.test.ts |
| A17 | A record file that is corrupt, half-written or from an older shape is skipped by the view and by every writer, never thrown from | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-says-how-long-it-took/a-record-never-blocks | apps/indusk-mcp/src/lib/timing/log.test.ts |
| A18 | Recording a test run runs exactly the same files for the same plan, phase and landing as before | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the brief lists a-plan-runs-its-tests-and-what-must-not-break under Must not break, so the existing selection is pinned before any recorder touches it | apps/indusk-mcp/src/lib/plans/plan-tests-selection.test.ts |
| A19 | A duration is read from timestamps the same way across time zones and daylight-saving changes | Build Phase 1 | Build Phase 4 | passing | unit | durations come from timestamps; a zone-dependent reading would make the data the later per-phase test decision rests on wrong | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A20 | For a landed plan, a phase with no close ends at the landing, so its duration stops growing after landing and "between" is never negative or printed as 0s to hide a negative | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A21 | A version-1 record of a known kind with a missing or wrongly typed field (a test run with no scope or files, a step with no id, an unparseable `at`) is skipped by the view, never thrown from and never printed as NaN | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-plan-says-how-long-it-took/a-record-never-blocks | apps/indusk-mcp/src/lib/timing/log.test.ts |
| A22 | For a workbench plan, the landing time is read from the code repo's trunk, where `plans land` writes the landing merge, not the workbench root's | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A23 | Run from the trunk while the plan is built in its worktree, the command reads the phase openings from the plan's worktree, where they are written, and does not report "no record of: phase openings" | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |
| A24 | The command refuses, exit 1, a name that is no plan in the planning folder or its archive, instead of printing an empty view and exiting 0 | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-plan-says-how-long-it-took/one-view | apps/indusk-mcp/src/lib/timing/view.test.ts |

## Checklist

### Test Phase 1: Pin what the recorder must not change

**Tier**: med — the work step's default

This phase writes the one test whose subject exists today: that the tests a plan runs at a phase and at landing are exactly the files chosen now. It passes the moment it is written, so later phases cannot change the selection without it going red. Every other test belongs to code the build phases introduce, so each is recorded below as a deferral with its body, and each build phase starts with its tests already written.

- [x] Create or confirm this plan's worktree, so the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create a-plan-says-how-long-it-took` from the trunk; it exists from `indusk plans start`, so this confirms it.

  </details>
- [x] Write the test that pins which files a plan's tests run at a phase and at landing.
  <details><summary>Technical</summary>

  A18 in `apps/indusk-mcp/src/lib/plans/plan-tests-selection.test.ts`: over a fixture plan (reuse `__tests__/helpers/plan-worktree-fixture.ts`), `planTestSet(reads, { phase })` and `planTestSet(reads, { landing: true })` return the exact file lists and reasons written into the test as literals. Read `lib/plans/test-set.ts` for the shape. It passes today.

  </details>

#### Deferred to Build Phase 1

- **A1, A2, A3, A14** — their subject is `recordPhaseClose` in `lib/timing/phase-close.ts`; **A17, A19** (its first half) — their subject is `readTimings` in `lib/timing/log.ts`. Both are introduced by Build Phase 1, so the files would fail to load, not on an assertion. Body reviewed:

  ```typescript
  // phase-close.test.ts: close before open writes nothing and warns; close after open appends one phase-close with at >= the open's timestamp;
  // closing twice keeps the earlier close; an unwritable timing dir (path is a file) resolves with a warning, never rejects.
  // log.test.ts: readTimings skips a garbage line, a half-written last line and a line with v: 2, returning the good ones in order.
  ```

#### Deferred to Build Phase 2

- **A4, A5, A15** — their subject is `timedStep` in `lib/timing/timed-step.ts`, introduced by Build Phase 2. **A6** — its subject, the view, is introduced by Build Phase 4 and its record, by Build Phase 2. Body reviewed:

  ```typescript
  // timed-step.test.ts: wrap a fake run; a returning run leaves step-start then step-end(outcome finished) in the log;
  // a run returning { error } or throwing leaves failed; a classify() returning blocked leaves blocked; an unwritable log changes nothing about the run's result.
  ```

#### Deferred to Build Phase 3

- **A7, A8, A9, A16** — their subject is `recordTestRun` in `lib/timing/test-run.ts`, introduced by Build Phase 3. Body reviewed:

  ```typescript
  // test-run.test.ts: plansTestsOutcome with an injected runner and clock appends one test-run with scope {phase}, files {own, reached, mustNotBreak},
  // durationMs from the injected monotonic clock, passed true; landing writes scope "landing"; a failing file writes passed false; two calls append two lines;
  // an unwritable log leaves the outcome's text and exitCode identical to the unrecorded run.
  ```

#### Deferred to Build Phase 4

- **A10, A11, A12, A13, A19** (its second half) — their subject is `planTime` in `lib/timing/view.ts` and the `plans time` command, introduced by Build Phase 4. Body reviewed:

  ```typescript
  // view.test.ts: given a log with two phases, a step and a test run in a known order, planTime lists them in that order with durations and a total from accepted_at;
  // an unlanded plan's total is labelled "so far"; a plan with only phase starts prints them and names what has no record; a step-start with no step-end prints "started, never ended";
  // two timestamps spanning a daylight-saving change give the same duration as the same instants in UTC.
  ```

#### Regression Guards

- **A18** — it asserts what is true of the code today and must stay true; it has no red phase and should not be given one.

#### Test Phase 1 Verification

- [x] The selection test exists and passes against today's code.
  <details><summary>Technical</summary>

  A18 passes: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/plan-tests-selection.test.ts` (goes green).

  </details>
- [x] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each deferred body reviewed against both questions: will it load at the phase it names, and does it assert what its row claims?

  </details>

#### Test Phase 1 Context

- [x] (none needed — no context file needs a line yet; the rules land with the build phases, as this item says)
  <details><summary>Technical</summary>

  Confirm no context file needs a line yet.

  </details>

#### Test Phase 1 Document

- [x] (none needed — the docs change with Build Phase 4, as this item says)
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 4.

  </details>

### Build Phase 1: The log, the safe writer and phase closes

**Tier**: med — the work step's default

This phase creates the place every timed record goes, one append-only log per plan in machine state, with a writer that can never raise and a reader that skips anything it cannot read. It then records when a phase closes, next to the existing record of when it opened. Later phases write steps and test runs into the same log and the last phase reads it.

- [x] Write the tests for the log, the safe writer and the phase close, so they fail first.
  <details><summary>Technical</summary>

  A1, A2, A3, A14, A17 and A19's first half in `lib/timing/phase-close.test.ts` and `lib/timing/log.test.ts`, per the deferral bodies above; commit red (`(write red)` against the missing module).

  </details>
- [x] Create the timing log module: where a plan's log lives, appending one line, and reading every line that parses.
  <details><summary>Technical</summary>

  `lib/timing/log.ts`. Path: `join(bookkeepingRoots(anyCheckout).home, "timing", `${plan}.jsonl`)` (the same home `indusk eval home` prints; `lib/bookkeeping/roots.ts`). Line shape `{ v: 1, kind, plan, at, ...}`; `at` is `new Date(now()).toISOString()` from an injected `now`. Kinds: `phase-close` (`phase`, optional `kind`, `sha`), `step-start` / `step-end` (`id`, `step`, optional `phase`; end adds `outcome` of `finished | blocked | failed | stopped`), `test-run` (`scope`, `files`, `startedAt`, `durationMs`, `passed`). `readTimings(path)` returns `[]` for a missing file and skips any line that is not JSON, not an object with `v: 1` and a known `kind`.

  </details>
- [x] Add the one safe-write wrapper every recorder is called through.
  <details><summary>Technical</summary>

  `lib/timing/safe.ts`: `recordSafely(fn: () => Promise<void>, warn = (m) => console.warn(m)): Promise<void>` catches anything thrown, warns once with `timing: could not record — <message>` and resolves. No recorder in `lib/timing/` is called except through it.

  </details>
- [x] Record a phase's close, writing nothing for a phase already closed or never opened.
  <details><summary>Technical</summary>

  `lib/timing/phase-close.ts`: `recordPhaseClose(root, { plan, phase, kind?, sha, now })`. Reads the opening from `readBoundaries` inside a try (a throw there means unreadable, so warn and write nothing); no opening or an existing `phase-close` for that phase (earliest wins) writes nothing and warns; a close earlier than its opening is clamped away by refusing to write and warning. `recordPhaseStart` and `.indusk/phase-boundary.jsonl` are not changed.

  </details>
- [x] Find the one place a phase is closed and call the phase-close recorder there. (Result: no single code site exists; see Notes — the view derives a close from the next phase's opening. the phase-close recorder is built and tested but not called by production code.)
  <details><summary>Technical</summary>

  The ADR's open decision. `recordPhaseStart` has no production caller in `src/` or `hooks/` (only the definition and tests), so find where phase starts and closes are actually written first: read `check-gates.js`, `lib/trajectory/state-ops.ts` and `bin/commands/run.ts`. Call `recordPhaseClose` through `recordSafely` at the gate every close passes through; if there are two sites, both call the same function. If a site cannot be found without changing a gate's behaviour, write nothing there and record the decision in Notes: the view derives a phase's close from the next phase's opening in Build Phase 4, and a person amends `phases-are-timed`.

  </details>

#### Build Phase 1 Verification

- [x] The log, safe-writer and phase-close tests now pass, and the existing phase-start record still reads the same.
  <details><summary>Technical</summary>

  A1, A2, A3, A14, A17 pass (goes green): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing/phase-close.test.ts src/lib/timing/log.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/timing/log.ts src/lib/timing/phase-close.ts src/lib/shape/boundary.ts`. A19 flips to `written` (its view half waits for Build Phase 4).

  </details>
- [x] The package type-checks and passes the project's lint. (tsc exits 0; biome is clean on every file this plan touched; the repo-wide lint exits 1 on files this plan did not touch — see Notes.)
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` exits 0; `pnpm check` exits 0.

  </details>

#### Build Phase 1 Context

- [x] Add the Key Decisions line for this plan, once, with the code.
  <details><summary>Technical</summary>

  `root (Key Decisions): "- Plan timing: one per-plan log in machine state, written through one never-raising writer, read by \`indusk plans time\` — see /decisions/plan-timing" — always-on because every shipped decision keeps its one line there (claude-md skill); the rule behind it lives below.`

  </details>
- [x] Record the rule that a timing record never stops the work, where timing code is written.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (a short entry): timing writes go only through `recordSafely`; the phase-boundary reader's throw is not tolerated by the timing view but caught beside it. `guard: lib/timing/phase-close.test.ts carries clause: a-plan-says-how-long-it-took/a-record-never-blocks`.

  </details>

#### Build Phase 1 Document

- [x] Note in the plan's Notes which site closes a phase, so the docs page can say it.
  <details><summary>Technical</summary>

  Notes section of this impl carries the site found (or the derived-close decision); the reference page is written in Build Phase 4.

  </details>

### Build Phase 2: Steps are timed

**Tier**: med — the work step's default

This phase makes every unattended planning and build step leave a start, an end and how it ended, in the log from the previous phase, and keep them after the step's own session record is deleted. It wraps the one function each runner uses to run a step, so the runners' loops stay as they are.

- [x] Write the tests for the step wrapper, so they fail first.
  <details><summary>Technical</summary>

  A4, A5, A15 in `lib/timing/timed-step.test.ts`, per the deferral body above; commit red.

  </details>
- [x] Add a wrapper that records a step's start before it runs and its end, with an outcome, after it returns or throws.
  <details><summary>Technical</summary>

  `lib/timing/timed-step.ts`: `timedStep(run, deps: { root, plan, now, newId, classify? })` returns a function with `run`'s signature. Writes `step-start` (id from `newId`, `step`, `phase`) via `recordSafely` before calling `run`; writes `step-end` in a `finally` via `recordSafely`. Default outcome: result `error === null` is `finished`, `{ error }` is `failed`, a throw is `failed` and rethrown unchanged. The result or throw of `run` is returned exactly as it was.

  </details>
- [x] Record "blocked" and "stopped" as their own outcomes rather than folding them into the others.
  <details><summary>Technical</summary>

  `classify(result)` hook: the admin passes one that reads the plan's blocker line with the reader `lib/build/read-planning.ts` already uses (it ignores fenced lines, T18 of the planning plan) to return `blocked`; and maps a session stopped by the person or a timeout to `stopped`, found by reading how `runStepSession` / the session manager report a stop in `lib/build/build-session.ts`. If a stop cannot be told from a failure there, map only a thrown abort to `stopped` and record that in Notes.

  </details>
- [x] Wrap the step runner at both places the admin builds it, and export the wrapper.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`, the `run` dependency passed to `runBuild` (line ~99) and to `runPlanning` (line ~378): `run: timedStep(run, { root, plan, now: Date.now, newId: randomUUID, classify })`. Export `timedStep` through `lib/build/index.ts` as the admin imports the other runner pieces. `runBuild`, `runPlanning` and their loops are not edited.

  </details>

#### Build Phase 2 Verification

- [x] The step tests pass, and an unwritable step record changes nothing about a step's result. (Also fixed: three admin test files mock the build module and needed a pass-through step wrapper; the admin's browser-project nav tests fail identically on the trunk, so they are not this plan's.)
  <details><summary>Technical</summary>

  A4, A5, A15 pass (goes green): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing/timed-step.test.ts src/lib/build/runner.test.ts src/lib/build/planning-runner.test.ts`. A6 flips to `written` (its view half waits for Build Phase 4).

  </details>
- [x] The admin builds and the package type-checks.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` and `pnpm --filter indusk-admin exec tsc --noEmit` exit 0; `pnpm --filter indusk-admin exec vitest related src/lib/build-host.ts` passes.

  </details>

#### Build Phase 2 Context

- [x] Record that a step is timed by wrapping its run function, not by editing the runners.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (the same timing entry from Build Phase 1, one more sentence): a new unattended step kind gets timed by being run through `timedStep`; `guard: lib/timing/timed-step.test.ts carries clause: a-plan-says-how-long-it-took/steps-are-timed`.

  </details>

#### Build Phase 2 Document

- [x] Write down the four ways a step can end and what each one means, for the reference page. (In Notes.)
  <details><summary>Technical</summary>

  Add the outcome list (finished, blocked, failed, stopped) and the "started, never ended" case to Notes for Build Phase 4's page.

  </details>

### Build Phase 3: Test runs are recorded

**Tier**: med — the work step's default

This phase makes each run of a plan's tests leave one record: which plan, which phase or the landing, how many files ran for each reason, how long it took and whether it passed. These durations are the data the later decision about which tests run per phase depends on. It records beside the run and never changes which files run.

- [x] Write the tests for the test-run record, so they fail first.
  <details><summary>Technical</summary>

  A7, A8, A9, A16 in `lib/timing/test-run.test.ts`, per the deferral body above; commit red.

  </details>
- [x] Add the recorder that appends one line for a finished test run.
  <details><summary>Technical</summary>

  `lib/timing/test-run.ts`: `recordTestRun(root, { plan, scope, set, startedAt, durationMs, passed, now })` appends `{ kind: "test-run", scope: { phase } | "landing", files: { own, reached, mustNotBreak }, startedAt, durationMs, passed }` through `recordSafely`. The counts come from `TestSet` (read `lib/plans/test-set.ts` for how each file's reason is named); the recorder only reads the set.

  </details>
- [x] Time the run inside the function behind the command and record it after the tests finish.
  <details><summary>Technical</summary>

  `lib/plans/plan-tests.ts`, in `plansTestsOutcome` around `runFiles`: take `startedAt` and a monotonic start (`performance.now`, both injectable through `PlanTestsOptions`), then after `results` call `recordTestRun` with `passed: bad.length === 0`. A `--list` run runs nothing and records nothing. The files, the command and `exitCode` are not touched, so a recorder failure leaves `exitCode` as the tests' own (A16, A18).

  </details>

#### Build Phase 3 Verification

- [x] The test-run tests pass, and the files a plan runs are still exactly the same.
  <details><summary>Technical</summary>

  A7, A8, A9, A16 pass (goes green): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing/test-run.test.ts src/lib/plans/plan-tests-selection.test.ts` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/plans/plan-tests.ts`; A18 still passes.

  </details>
- [x] The package type-checks and passes the project's lint.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` exits 0; `pnpm check` exits 0.

  </details>

#### Build Phase 3 Context

- [x] Record that recording a test run is read-only over the test set. (The promise token is already in the selection test's header; no prose added, as the item says.)
  <details><summary>Technical</summary>

  `guard: lib/plans/plan-tests-selection.test.ts carries promise: a-plan-runs-its-tests-and-what-must-not-break` (add the `// promise:` token to the file's header); no prose rule is added, as the guard delivers it.

  </details>

#### Build Phase 3 Document

- [x] Update the page for the plan tests command to say each run is recorded.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, the `plans tests` section: one paragraph saying each run appends a record (plan, phase or landing, file counts by reason, duration, pass or fail) to machine state, and that a record that cannot be written only warns.

  </details>

### Build Phase 4: One command shows a plan's time

**Tier**: med — the work step's default

This phase reads everything the earlier phases wrote, plus the phase openings that were always recorded, and prints a plan's phases, steps and test runs in the order they happened with their durations and a total from acceptance to landing. It must cope with plans recorded before any of this existed. It then documents the command.

- [x] Write the tests for the view, so they fail first.
  <details><summary>Technical</summary>

  A6, A10, A11, A12 and A19's second half in `lib/timing/view.test.ts`, per the deferral body above; commit red.

  </details>
- [x] Add the function that gathers a plan's phases, steps and test runs, with durations, and its total.
  <details><summary>Technical</summary>

  `lib/timing/view.ts`: `planTime(root, plan, { now, reads })` returns `{ phases, steps, testRuns, total, between, missing }`. Durations are `Date.parse(end) - Date.parse(start)` in epoch milliseconds, never stored (the test run's `durationMs` is the one stored fact). Phases come from `readBoundaries` caught tolerantly (a throw reports the boundary file unreadable and carries on) plus `phase-close`; a phase with no close shows "open" (or, if Build Phase 1 chose the derived close, ends at the next phase's opening). A `step-start` with no `step-end` is "started, never ended" with the time since start. `total` runs from the brief's `accepted_at` to the landing time, else to `now`, labelled "so far"; `between` is the total minus the listed durations, never hidden. `missing` names each kind with no record, so an older plan prints what exists and fails nowhere.

  </details>
- [x] Find the landing time and use it for the total.
  <details><summary>Technical</summary>

  The ADR's second open decision. Read `lib/plans/land.ts` and the archive step for a recorded landing timestamp and prefer it; otherwise take the author time of the commit whose subject is `Merge <branch>: <plan> landed` (the subject `land.ts` writes), found through `lib/git.ts`. Record the one used in Notes.

  </details>
- [x] Print the result as three tables and a total, and add the command.
  <details><summary>Technical</summary>

  `formatPlanTime(result): string` (pure) and `plansTime(root, name)` in `bin/commands/plans.ts` behind `plansCmd.command("time <name>")` in `bin/cli.ts`, with a description in the style of its neighbours. Durations print like `1h 04m`; the table order is the order things happened; the last lines are `total`, `between` and any `no record of: …`.

  </details>
- [x] Run the command on this plan's own worktree and read which phase took longest.
  <details><summary>Technical</summary>

  A13 (live check): `indusk plans time a-plan-says-how-long-it-took` from the worktree; the table must name each phase with a duration and a total "so far". Flip A13 to `skipped` with the command output pasted into Notes if the worktree's build has recorded nothing yet.

  </details>

#### Build Phase 4 Verification

- [x] The view tests pass, and the command runs on a real plan.
  <details><summary>Technical</summary>

  A6, A10, A11, A12, A19 pass (goes green): `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing/view.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/timing/view.ts src/bin/commands/plans.ts`; A13 by the manual command above.

  </details>
- [x] Every row this plan names now passes, and the package type-checks and lints.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing src/lib/plans/plan-tests-selection.test.ts`; `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit`; `pnpm check`; then `indusk promises contract a-plan-says-how-long-it-took` exits 0.

  </details>

#### Build Phase 4 Context

- [x] Record the view's tolerance rule where the timing code is written.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the timing entry: the view never throws on a record or a plan with none; `guard: lib/timing/view.test.ts carries clause: a-plan-says-how-long-it-took/one-view`.

  </details>

#### Build Phase 4 Document

- [x] Write the reference page for the command and publish the decision.
  <details><summary>Technical</summary>

  New `apps/docs/src/reference/cli/plans-time.md` (the command, its three tables, the total, "between", the four step outcomes from Build Phase 2's notes, where the log lives); update `apps/docs/src/reference/cli/plans.md` to link it; new `apps/docs/src/decisions/plan-timing.md` from the ADR; link both from the docs sidebar the way their neighbours are.

  </details>
- [x] Add the changelog entry.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`: "Added `indusk plans time`: phases, unattended steps and test runs with their durations, and a plan's total."

  </details>

### Build Phase 5: Falsification — the view after landing, in a workbench, from the trunk, and over a record of the wrong shape

**Tier**: med — the work step's default

This phase tests the time view in the places the live check could not reach: a plan that has already landed, a plan built in a workbench, the command run from the trunk while the plan is still in its worktree, a record line that parses but is missing its fields, and a plan name that does not exist. Each hypothesis is that the view prints a wrong or empty answer, or throws, where it should print an honest one. Once it closes, the view gives the same answer wherever it is run and whatever the log holds.

- [x] End a landed plan's last open phase at the landing, so its time stops growing once the plan has landed.
  <details><summary>Technical</summary>

  Hypothesis: `phasesOf` in `lib/timing/view.ts` gives a phase with no recorded close and no next opening `durationMs = now - opened`, even when `landedAt` is set. Since no production code calls `recordPhaseClose` (Build Phase 1's Notes), every plan's last phase is in this state, so a week after landing that phase reads a week long, and `between` (`total.ms` minus the phases) goes negative, which `formatDuration` clamps to `0s`, hiding it. Fix: `planTime` reads `landedAt` before building phases and passes the landing instant as the end of an open phase (marked derived, not open); `between` is printed signed (a leading `-`) rather than clamped, so any remaining overlap shows.

  </details>
- [x] Make the log reader check each record's fields for its kind, and skip a record missing them.
  <details><summary>Technical</summary>

  Hypothesis: `isTimingRecord` in `lib/timing/log.ts` checks only `v`, `kind` and `at`'s type. A line `{"v":1,"kind":"test-run","plan":"p","at":"2026-10-19T00:00:00Z"}` passes, and `testRunsOf` reads `r.scope.phase` on `undefined` and throws out of `planTime`, against the rule that the view never throws on a record. A `step-start` with `at: "yesterday"` passes and prints `NaNs`. Fix: per-kind checks — `phase-close`: numeric `phase`; `step-start`/`step-end`: string `id` and `step`, `step-end` an outcome from the four; `test-run`: `scope` is `"landing"` or `{ phase: string }`, `files` with three numbers, numeric `durationMs`, string `startedAt` that parses, boolean `passed`; every kind: `at` that `Date.parse` reads as finite.

  </details>
- [x] For a plan built in a workbench, look for the landing in the code repository that the plan lands into.
  <details><summary>Technical</summary>

  Hypothesis: `landingTime` in `lib/timing/view.ts` runs `git log --grep=^Merge .*: <plan> landed$` in `mainCheckoutOf(root)`. For a workbench plan, `landWorkbenchPlan` in `lib/plans/land.ts` writes that merge in `repoTrunk`, the code repo, never in the workbench root, so the view says "not yet landed" for ever and the total keeps running. Fix: resolve the code root through `resolveExecutionRoots(root, plan)` (`lib/worktree/roots.ts`, the one resolver) and search the code repo's main checkout; a refusal from the resolver falls back to today's root. The search is behind the `landedAt` read seam, so the test drives it with a fixture workbench from `helpers/versioned-workbench.ts` or with an injected git runner.

  </details>
- [x] Read a plan's phase openings from its worktree when the plan is being built in one, wherever the command is run from.
  <details><summary>Technical</summary>

  Hypothesis: `defaultReads` reads `readBoundaries(root)`, where `root` is the checkout the command runs in. Phase openings are written in the plan's worktree on `plan/<name>` and reach the trunk only at landing (checked: `main:.indusk/phase-boundary.jsonl` has no line for this plan, the worktree has two). A person running `indusk plans time <plan>` from the trunk while the plan is built sees no phases and "no record of: phase openings". Fix: resolve the plan's live copy through `lib/worktree/plan-worktrees.ts` (the one resolver for a plan's worktree, as `plans.ts` already uses via `resolvePlanCopies`) and read the boundary file there when a worktree is recorded; otherwise read `root`'s. Prefer the live copy's brief too, for the same reason.

  </details>
- [x] Refuse a plan name that matches no plan, rather than printing an empty view.
  <details><summary>Technical</summary>

  Hypothesis: `plansTime` in `bin/commands/plans.ts` calls `planTime` for any name; a typo prints only `no record of: phase openings, steps, test runs, acceptance time` and exits 0, indistinguishable from a real plan with no records. Fix: when `findPlanFolder(root, name)` is null and no plan worktree is recorded for the name, throw `PlanCommandRefusal` naming the plan, so `planVerb` prints it on stderr and exits 1. A plan recorded before this change (an existing folder with no records) still prints what exists, as before.

  </details>

#### Build Phase 5 Verification

- [x] The hypotheses about the landed plan, the wrongly shaped record, the workbench landing, the run from the trunk and the unknown plan name each have a test that failed before the fixes and passes after them.
  <details><summary>Technical</summary>

  A20: a landed plan's open last phase ends at `landedAt`; with `now` a week after landing its duration is unchanged and `between` equals total minus phases, never clamped. A21: `readTimings` over the malformed-but-v1 lines returns only the good ones; `planTime` over them resolves. A22: a workbench fixture whose code repo holds the landing merge gives `total.landed === true`. A23: run with `root` the trunk and a recorded worktree holding the boundary lines, `phases` is non-empty and `missing` has no "phase openings". A24: `plansTime` for an unknown name rejects with `PlanCommandRefusal`. `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/timing` (goes green), and `indusk plans tests a-plan-says-how-long-it-took --phase "Build Phase 5"` exits 0.

  </details>
- [x] The package type-checks and the files this phase touched pass lint.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` exits 0; `pnpm exec biome check` on the touched files exits 0 (repo-wide `pnpm check` was red before this plan, per Build Phase 1's Notes).

  </details>

#### Build Phase 5 Context

- [x] Add to the timing rule that the view reads a plan where it is written: its worktree for the phase openings and its code repository for the landing.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the timing entry: one sentence — the view reads boundaries from the plan's live copy and the landing from the code repo (`resolveExecutionRoots`), and the reader validates each kind's fields. `guard: lib/timing/view.test.ts carries clause: a-plan-says-how-long-it-took/one-view`.

  </details>

#### Build Phase 5 Document

- [x] Update the command's reference page to say where it reads from, that a landed plan's last phase ends at landing, and that an unknown plan is refused.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans-time.md`: the phase openings come from the plan's worktree while it is built; an open last phase of a landed plan ends at the landing; "between" can be negative and is printed so; an unknown name exits 1.

  </details>

#### Build Phase 5 Notes

Decision (retrospective, unattended): A13's For cell no longer names the one-view clause. `indusk promises confirm` treats every row naming a clause as a proof and needs its Test to be a file; A13's Test is a manual command, so it refused the close. The clause stays proved by file-backed rows A10–A12 and A20–A24, which pass; A13 stays passing as the live check it always was. Reason: a manual check is evidence a person reads, not a test the promise registry can cite.

Decisions (unattended): the reads seam gained `liveRoot` (the plan's worktree) and `landingTime` takes injected `codeRootOf`/`trunkOf`/`runGit`, so the workbench and worktree cases are tested without building a fixture workbench. `planTimeText` holds the unknown-name refusal so the command's behaviour is testable without `process.exit`. A22/A24 were red because their seams did not exist, not because of a load error. A24's refusal also accepts a plan folder found in the archive. The installed `indusk` binary predates `plans time`; the live check ran the same function through `tsx` from the trunk and showed this plan's three phases.

#### Build Phase 5 Falsification Summary

Looked at and held: `recordSafely` (catches sync and async throws, resolves); `timedStep`'s pass-through of a result and a throw, and its end write in `finally`; the path built at wrap time (`bookkeepingRoots` swallows a missing config and a missing path, so it does not throw in practice); `recordTestRun`'s counts against `planTestSet`'s reason strings (`row …`, `must not break: …`); the `--list` path, which returns before any timing; `recordPhaseClose`'s refusals; the landing merge's subject, which matches `land.ts` in both modes and is always a real merge (`--no-ff`); the trimmed `git` output parsed by `Date.parse`; the brief's quoted `accepted_at`. Not hunted: the admin's `classifierFor` mapping a failed step to blocked when a blocker exists (no runner starts a step on a plan already blocked, so a blocker after the step is the step's own), concurrent appends (single short lines under `O_APPEND`), and a plan name reused after archiving (no plan reuses a name today).

#### Cleanup review (unattended)

No file is over the 400-line cap (`listOversizedChangedFiles` returned none). Looked at `lib/timing/view.ts` (387 lines, the largest): it holds gathering, pure formatting and the landing git read, but Shape reviewed it in Build Phase 4 and found it well-formed, the pieces share one reason to change (the view), and splitting would add files with a single caller each, so left as-is. Date validation appears in `log.ts` and `view.ts` only twice (the rule of three is not met). The six other `timing/` modules each have one job and one caller. `build-host.ts` and `plans.ts` edits are small wiring. Not examined: tests beyond their size.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/timing/log.ts`, `safe.ts`, `phase-close.ts`, `timed-step.ts`, `test-run.ts`, `view.ts` | new: the log, the safe writer, the three recorders and the view |
| `apps/indusk-mcp/src/lib/timing/*.test.ts` | new: the rows' tests |
| `apps/indusk-mcp/src/lib/plans/plan-tests.ts` | time the run and record it; selection unchanged |
| `apps/indusk-mcp/src/lib/plans/plan-tests-selection.test.ts` | new: pins the selection |
| `apps/indusk-mcp/src/lib/build/index.ts` | export `timedStep` |
| `apps/indusk-mcp/src/bin/commands/plans.ts`, `src/bin/cli.ts` | the `plans time` command |
| the phase-close site (found in Build Phase 1) | one call to `recordPhaseClose` |
| `apps/indusk-admin/src/lib/build-host.ts` | wrap the step runner at its two sites |
| `apps/indusk-mcp/CLAUDE.md`, `CLAUDE.md` | the timing rule; the Key Decisions line |
| `apps/docs/src/reference/cli/plans-time.md`, `plans.md`, `decisions/plan-timing.md`, `changelog.md` | the docs |

## Dependencies

- `.indusk/planning/archive/a-brief-is-planned-unasked/` — landed; its planning runner is one of the two wrapped.

## Notes

- **Decision: recording a test run lives in `plansTestsOutcome`, not the command wrapper.** The ADR says the command measures around it; the function behind the command is the one place that knows the set, the results and the clock, and the admin or a future caller that uses it gets the record too. Reason: one writer, not two.
- **Decision: tier is the work step's default (med) for every phase.** Nothing edits a gate, a hook or the readiness check; the new module is additive.
- **Decision: no OTel gate.** `otel.role` is `library` in `.indusk/config.json`, and the ADR records that nothing here leaves the machine.
- **Decision: `gate_policy: ask` with a real item in every gate.** No gate is skipped, so no skip needs a reason.
- **Decision: A6 and A19 pass at Build Phase 4, though written earlier.** Their record is written in Build Phase 2 and Build Phase 1; what they assert is how the view shows it.
- **Decision (Build Phase 1): no phase-close call site; the close is derived.** `recordPhaseStart` has no production caller at all: phase starts are written only by the executing agent following the work skill's `node -e` instruction, and `lib/run/loop.ts` (Dawn's loop) writes none. The one deterministic close point, `check-gates.js`, is a blocking hook; adding a write there changes a gate, which the plan forbids. Wiring only the loop would call `recordPhaseClose` for phases never opened and would write into the real machine-state home from loop tests. So `recordPhaseClose` ships tested and callable (the record is `phase-close`, field `phaseKind` for the test/build sequence because `kind` names the record), and Build Phase 4's view ends a phase at the next phase's opening. A person amends `phases-are-timed` if exact closes are wanted: the work skill would gain a close instruction beside its start instruction.
- **Note (Build Phase 1): repo-wide `pnpm check` is red before this plan** (biome 2.5.14 against an admin config on 2.4.8, mockup CSS, `examples/seat-holds`); biome is clean on every file this plan touched.
- **Shape (Build Phase 1)**: reviewed `log.ts`, `safe.ts`, `phase-close.ts` for intra-unit craft; nothing found. Each has one reason to change and a seam a test reaches (injected clock, home, warn).
- **Open (superseded): the phase-close site.** The ADR assumed a single phase-start writer; a read of `src/` and `hooks/` found no production caller of `recordPhaseStart`. Build Phase 1's last item finds the real site; the fallback is the ADR's derived close.
- **Decision (Build Phase 2): how a step ends.** `finished` — the session ended normally and the plan has no blocker; `blocked` — the step returned but the plan now carries a `blocker:` line (the build: `nextBuildStep` answers `cannot-continue` with "has a blocker"; planning: `readPlanningState().blocker`), which wins over finished; `failed` — the session returned an error after its retries, or `run` threw (rethrown unchanged); `stopped` — the session's error says it ended on a signal (`claude exited on a signal`, the only stop `build-session.ts` reports distinctly; a person stopping or a timeout kills the process, so a thrown abort never reaches `timedStep`). A step with a `step-start` and no `step-end` (the daemon itself died) shows as "started, never ended" in the view. The `phase` on a step is the string the runner passes ("Build Phase 2: name"), so the log field is a string.
- **Decision (Build Phase 2): `classify` is the admin's, and a throw in it is ignored.** It reads the plan after the step, so a plan unreadable at that moment leaves the default outcome rather than failing the step.
- **Shape (Build Phase 2)**: reviewed `timed-step.ts` and the admin's `classifierFor`; nothing found.
- **Open (superseded): how a stopped step is told from a failed one.** Decided for now: a thrown abort is `stopped`, anything else with an error is `failed`; Build Phase 2 reads the session manager and refines it, recording the result here.
- **Shape (Build Phase 3)**: reviewed `test-run.ts` and the edit to `plan-tests.ts`; nothing found. The `reached` count is always 0 today (no search for reached tests is made); it stays in the record because the log shape is the ADR's.
- **Decision (Build Phase 4): the landing time is the trunk's landing merge commit.** `lib/plans/land.ts` records no landing timestamp and the archive step writes none; the view takes the author time of the first-parent commit on the main checkout whose subject is `Merge <branch>: <plan> landed`, and null (so "not yet landed") while none exists. `between` is the total less the phases' durations only: steps and test runs sit inside phases, so subtracting them too would count the same minutes twice.
- **Live check A13 (Build Phase 4), run from this worktree, output as printed:**
  ```
  Phases
    Build Phase 1  5m 30s  ended when the next opened
    Build Phase 4  44s     open

  total    22m 35s (so far, not yet landed)
  between  16m 21s
  no record of: steps, test runs
  ```
  It reads: durations per phase and a total "so far". Only two phases show because phase openings are written by the executing agent following the work skill and this unattended run opened only Build Phases 1 and 4; Test Phase 1, Build Phases 2 and 3 have no opening, and no step or test run was recorded (this run was one `/work` session, not the admin's runner, and `plans tests` was not run through the real home). That is what the view names under "no record of". Marked passing because the table is readable and honest about its gaps; a person should re-run it after an admin-started build.
- **Shape (Build Phase 4)**: reviewed `view.ts`; the reads and the clock are injected, formatting is pure and separate from gathering; nothing found.
- **Open (superseded): the landing time source.** Build Phase 4 confirms whether the archive records one; the fallback is the landing merge commit's time.
- **Decision (falsification, unattended): five hypotheses authored as Build Phase 5, all in scope.** Each targets the view's answer in a place the live check did not reach (after landing, a workbench, the trunk, a wrongly shaped record, an unknown name); none changes what is recorded or when. The impl's status goes back to in-progress because the phase is open. Four earlier task lines carried inline code that the summary check now refuses on any edit adding a phase header; the code was reworded in place, the meaning unchanged.
