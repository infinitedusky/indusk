---
title: "Test kinds"
date: 2026-10-05
status: proposed
---

# Test kinds

## Goal

**A phase is verified in seconds, the whole everyday suite runs in about a
minute, and InDusk sees and says when that stops being true.**

Today every phase waits about five minutes on `pnpm test`. 216 s of it is eight
admin files that boot `next dev` and real Jaeger servers to check rules about
what a chip or a cell shows ([research](research.md)), and those same files
force the root suite to run its two packages one after the other. Nothing
stops the next plan adding a ninth.

## Y-Statement

**In the context of:**
InDusk's own two packages, mcp and admin, one project under one set of rules,
built phase by phase by agents that verify each phase before moving on, and
shipping the planner and work skills that tell every other project's agents
how to test.

**Facing:**
a suite that grew to five minutes because two of our own rules
("assertions are behavioural", "prefer the boundary for a real red")
combined into "test every rule through the outermost door", with the store
and the health read giving tests no way to feed runs or move time except a
real server and a real wait.

**We decided for:**
five kinds of test, each with its moment, named on every assertion, defaulting
to the smallest; clock and reader inputs for the code that decides; the eight
files converted rule for rule to unit tests; every test that starts a server
moved to a system tier that runs at landing and release; phase verification
scoped to the phase; and two promises InDusk holds about its own suite — a
guard that the everyday tier never waits, and a watched mark of how long each
run took.

**And against:**
a suite time budget that fails the run (it treats the number, not the kind of
test, and it was rejected by Sandy); faking Jaeger at HTTP level, which keeps
every page boot and wall-clock wait; moving the watcher into its own package
first, which moves the slow tests without speeding them up; and a new trajectory
column beside the existing optional `Kind`, which would leave two vocabularies
for one question.

**To achieve:**
seconds per phase, about a minute per everyday run with both packages in
parallel, every rule the slow files checked still checked and shown to fail
when broken, and drift seen on the Promises page instead of felt.

**Accepting:**
that pages and real Jaeger are checked at landing and release, not at every
phase; that the store and health read gain parameters only tests use; that a
duration promise is noisy, so its threshold is loose and a run overlapping
another run is not judged; and that the skill text this plan rewrites will be
rewritten again by promise-core's `house-rules-out`.

**Because:**
a test answers one question and its kind says when that question is worth
asking; telemetry projects (the OpenTelemetry SDKs and Collector, Jaeger)
solve the same problem the same way, with in-memory exporters, fake clocks and
separate jobs for the real backends; and a rule that reaches the next plan
through a guard and a promise holds where a rule in memory did not.

## Context

The research measures the suite and traces the cause; the brief
([brief](brief.md)) sets the direction and the two promises, over both
packages. The mcp package already keeps every test that starts a real system
in `test:system` (`apps/indusk-mcp/vitest.tiers.ts`); the admin has no such
tier, and its `vitest.config.ts` serialises the node project because its
`next dev` boots starve each other.

## Decision

**D1 — Five kinds, one definition.** A new module
`apps/indusk-mcp/src/lib/test-kinds.ts` holds the kinds and their moments,
the single definition every reader uses (the pattern `workflow-types.ts` set):

| Kind | Runs |
|---|---|
| `unit` | in the phase; part of `pnpm test` |
| `contract` | `pnpm test:system`: at landing and on release |
| `live check` | once, by hand or script, recorded in the plan with its result |
| `smoke` | at deploy |
| `promise` | continuously, by the watcher |

The test plan's mechanism column becomes **Kind**, and the trajectory's
optional `Kind` column takes these values. An impl that declares
`test_kinds: required` (every new impl; the planner template sets it) has every
row's `Kind` validated at write time by `validate-impl-structure.js`: missing
or outside the five is refused, naming the five (A18). Impls without the key,
including the six that use the old style vocabulary (`example`, `property`,
…), parse and validate as before; `Scope` stays parsed and is no longer
offered. The planner skill's test-plan section states the default: **the
smallest kind that can prove the assertion**, and a `contract` only when the
question is about the thing we do not own.

**D2 — Code that decides takes its clock and its reads.**
`apps/indusk-admin/src/lib/promise-timeline.ts` `readWindow` and
`lib/promise-health.ts` `readHealth` take an optional last argument:

```ts
interface Deps {
  now?: () => number;                 // default Date.now
  resolve?: typeof resolveMarkSources; // default the package's
  read?: typeof readTimeline;          // default the package's
  probe?: typeof probeSources;         // readHealth only
}
```

Defaults are the real ones; only tests pass them. The health cache's expiry
reads `now()` too. A test helper `src/__tests__/helpers/fake-source.ts`
answers `resolve` / `read` / `probe` from a list of runs, counts the ranges it
was asked for (A9), and can be made slow, failing or blind. The rule is
carried by a lesson, `code-that-decides-takes-its-clock-and-its-reads`, named
in the converted tests' messages, and by the planner's test-plan section (U1).

**D3 — The eight files, converted rule for rule.** Each of A4–A12 becomes a
unit test under `apps/indusk-admin/src/lib/__tests__/` against the store, the
health read or the pure strip, with Vitest's fake timers for time. Each is
**shown to fail on its broken rule**: the rule is broken once in the source,
the test is run and seen red, and the break is reverted — recorded in the
phase. A file is deleted only when every assertion it made has passed that.
One test stays on a real system: the Promises page rendered against a real
Jaeger, chips and strip present (A13).

**D4 — An admin system tier; the root suite parallel.** The admin gains
`vitest.tiers.ts` naming every file that starts `next dev` — the A13 contract
and the seven page tests (`http-smoke`, `http-plan-worktrees`,
`http-project-*`, `http-stale-project`, `live-refresh.e2e`) — and a
`test:system` script running them, still one file at a time. Its everyday
project excludes them. The root `test:system` runs both packages' system tiers;
mcp's `release` script calls the root one, so a release still runs every
contract. With nothing in either everyday tier starting a server, the root
`test` drops `--concurrency=1`.

**D5 — When each tier runs.** Phase verification runs the phase's own
trajectory rows' tests plus `vitest related` over the files the phase changed.
The full `pnpm test` and `pnpm test:system` run at **landing** (the
retrospective's merge step) and on release. The work skill's Verification
section, the verify skill's skip table and the planner's Verification template
say so, and the template's default is no longer `pnpm test` (A19). The work
skill's real-red rule narrows: a seam gives an honest red without a boundary;
prefer the boundary only when the question is about the boundary.

**D6 — `everyday-tests-never-wait`, a structure promise and its guard.**
`.indusk/promises/everyday-tests-never-wait.md`, owner `test-kinds`, its test
`apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts`. The guard
reads every test file in both packages' everyday tiers (each package's files
minus its `vitest.tiers.ts` list) and fails, naming file, line and call, on:

- **a server start**: the helpers that start one (`startNextDev`,
  `startAlwaysOnServer`, the daemon and Jaeger starters), `indusk ui` /
  `telemetry start`, or a `spawn` with `detached: true`;
- **a wall-clock wait**: a `sleep(` helper, or `setTimeout` / `setInterval`
  with a literal delay of 100 ms or more, in a file that does not use fake
  timers.

The patterns are a data table in the test. A short-lived process that runs and
exits (`spawnSync`, `execFile` of `git` or the CLI) is not matched (A15). There
is no exemption list: the eight admin files go, the seven page tests move
(D4), and mcp's four clock-waiting files (`monitor-mark`,
`telemetry-query-latency`, `admin/daemon-identity`, `telemetry/orphans`) each
take a fake clock, or move to `SYSTEM` when the wait is the subject.

**D7 — `everyday-suite-stays-fast`, a behaviour promise, watched.**
`.indusk/promises/everyday-suite-stays-fast.md`, owner `test-kinds`,
`kind: behaviour`, its site `apps/indusk-mcp/scripts/with-daemon-guard.js`.
The wrapper that `pnpm test` already runs through times the run and sends one
promise mark to the local daemon, through the same span sender the watcher
probe uses: `upheld` under **120 s**, `violated` at or over, with the duration
as an attribute. The rules:

- It never changes the exit code; with no daemon running, it marks nothing
  and says so on stderr.
- **A run that overlapped another test run is not judged.** That is another
  `vitest` process alive at the start or the end, which is an evaluator's run,
  the noise U2 names. It marks nothing and says why.
- One violated run is one violation, through the existing loop: the Promises
  page shows it red, `promises record` opens an incident, and the incident
  reopens this plan (A17).
- The threshold is twice the about-60 s target. The retrospective records the
  first real runs' durations and whether any mark fired falsely (U2).

## Alternatives Considered

### A time budget that fails the suite
Rejected by Sandy: it treats the number, not the kind of test. The 120 s
threshold in D7 never fails a run; it is watched.

### Fake Jaeger at the HTTP level, keep `next dev`
It removes the real servers but keeps every page boot and every wall-clock
wait, which is most of each file's time, and still tests a rule through a
page.

### A new trajectory column (`Tier`, `Runs`) beside `Kind`
Two optional vocabularies for one question, one of them read by nothing.
Taking over `Kind` behind an opt-in key keeps old impls valid and leaves one
answer.

### Split the watcher into its own package first
It would scope test runs by package, but the slow tests would be just as slow
in it. A later plan.

### An exemption list for today's offenders
Twelve files is small enough to fix in the plan; an exemption list is a second
rule to maintain and the first thing a guard grows.

## Consequences

### Positive
- The phase loop is seconds; the everyday suite about a minute, both packages
  in parallel.
- The store and health rules are tested directly, with time as an input; a
  late run, a slow window and a repointed server each take milliseconds to
  check.
- A server-booting test is refused the day it is written, in either package.
- The suite's speed is a promise like any other, visible and owned.

### Negative
- Page rendering and real Jaeger are checked at landing and release, not per
  phase. A phase that breaks a page finds out at landing.
- Two library functions gain test-only parameters.
- `test:system` grows by the admin's eight page files, about 60–90 s.

### Risks
- **A converted test passes without testing its rule.** Mitigation: each is
  shown red against its broken rule before its HTTP file is deleted (D3).
- **The guard's patterns miss a new way to wait** (a new helper name).
  Mitigation: the speed promise sees the symptom; the patterns are data, one
  row to add.
- **The speed mark cries wolf.** Mitigation: overlapping runs are not judged,
  the threshold is twice the target, and the retrospective checks.
- **promise-core's `house-rules-out` rewrites the same skill text.**
  Mitigation: cross-referenced in both; whichever lands second carries the
  other's edits.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/test-kinds.md`. The five kinds and their moments,
  the smallest-kind default, the clock-and-reads rule, the two tiers, and the
  two promises.
- Update: `apps/docs/src/guide/test-trajectory.md` (`Kind` column,
  `test_kinds: required`); `reference/skills/work` (phase verification);
  `reference/admin-ui/overview.md` (admin system tier).

### Diagrams
- One Mermaid table-diagram in the guide: kind → trigger (phase / landing /
  release / deploy / continuous).

### Changelog
- Added: test kinds in test plans and trajectories; the admin system tier;
  `everyday-tests-never-wait`, `everyday-suite-stays-fast`. Changed: phase
  verification runs the phase's tests; `pnpm test` runs packages in parallel.

### ADR in Docs
- `apps/docs/src/decisions/test-kinds.md` at close.

## References
- [research](research.md), [brief](brief.md), [test plan](test-plan.md)
- `.indusk/planning/archive/promise-timeline/retrospective.md`
- `.indusk/research/test-strategy/induskbrief.md`
- [promise-core](../promise-core/master.md) (`house-rules-out`)
- `apps/indusk-mcp/vitest.tiers.ts`, commit `6ffccf28`
