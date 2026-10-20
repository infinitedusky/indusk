---
title: "Run the graph — Implementation"
date: 2026-10-19
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
phase_summary: required
gate_policy: ask
---

# Run the graph — Implementation

## Goal

An approved plan's phases run as a graph. Each phase names what it depends on and the files it writes; a pure scheduler starts every phase that is ready, up to the session cap, earlier plans first; each running phase works in its own worktree and branch and merges into its plan's branch only by compare-and-swap after the merged result is green; the trunk cascades into open plans; a plan that pulled another plan's unlanded work lands after it; a hold frees a phase's files at once. Brief: [brief.md](brief.md). Assertions: [test-plan.md](test-plan.md) (rows A1 to A103). Decisions D1 to D14: [adr.md](adr.md).

## Scope

### In Scope
- The two label lines on a phase (`**Depends on**:`, `**Files**:`), their parsing, defaults and refusals.
- The runner record (`runner.jsonl`), the graph reader, the pure scheduler and the driver that launches sessions.
- Phase worktrees and `phase/<plan>/<n>` branches, start-time merges, the merge check and the compare-and-swap into the plan's branch.
- Conflict handling by an agent, holds and catch-up, the trunk cascade, and landing after pulled work.
- One signal per split and limit clause, written beside the code that decides it, in the phase that builds that code.
- Relaxing `a-session-belongs-to-its-plan`; teaching the falsify, cleanup and planner skills to write the dependency line.

### Out of Scope
- Effort in the tier (`research.md`'s proposed shape): no promise names it; recorded under Notes.
- What puts a phase on hold beyond an unresolved conflict and an amendment (`decisions-as-questions`), seeing the graph (`activity-and-graph`), running on the workbench server, re-cutting phases for speed.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `lib/run/graph/declarations.ts`: `readDeclarations`, `Declarations`, `fileSetsOverlap`; refusal at impl save | `lib/models/tiers.ts` label-line parsing, `fencedLineMask` |
| Build Phase 2 | `lib/run/graph/record.ts`: `appendRecord`, `readRecord`, record entry types | plan-timing writer as the model |
| Build Phase 3 | `lib/run/graph/read-graph.ts`: `readGraph`, `Graph`, `PhaseNode` (virtual fix edges, plan rank); `read-graph-signals.ts` | Phases 1, 2; `order_plans`; sessions registry; `lib/promises/clause-signal.ts` |
| Build Phase 4 | `lib/run/graph/schedule.ts`: `pickPhasesToStart`, waiting reasons; `schedule-signals.ts` (`reportScheduleSignals`) | Phase 3 types |
| Build Phase 5 | relaxed session identity (plan, kind, phase) in `lib/session/manager.ts` | existing manager |
| Build Phase 6 | `lib/run/graph/phase-branch.ts`: `startPhase`, `MergeResolver` type, `pulled` record entries; `phase-branch-signals.ts` | Phases 1, 2; `lib/worktree/layout.ts` |
| Build Phase 7 | `lib/run/graph/conflict.ts`: `mergeWithResolution` (agent, keep-rule, question); `conflict-signals.ts` | Phase 6 `MergeResolver` |
| Build Phase 8 | `lib/run/graph/merge-into-plan.ts`: `mergePhaseIntoPlan` (the only caller of the compare-and-swap); `merge-signals.ts` | Phases 6, 7; `lib/plans/test-set.ts` |
| Build Phase 9 | `lib/run/graph/hold.ts`: `holdPhase`, `releasePhase`, catch-up; `hold-signals.ts` | Phases 2, 4, 7 |
| Build Phase 10 | `lib/run/graph/cascade.ts`: `cascadeTrunk`; `plans land` calls it; `cascade-signals.ts` | Phase 7; `lib/plans/bring-trunk.ts` |
| Build Phase 11 | landing refusal and re-merge for pulled work; `lib/plans/land-pulled-signals.ts` | Phases 6, 7; `lib/plans/land.ts` |
| Build Phase 12 | `lib/build/graph-driver.ts`: event and tick driver launching sessions; `graph-driver-signals.ts`; `graph-print.ts` | Phases 4 to 11 |
| Build Phase 13 | the live checks in the system tier; ritual skills write the dependency line | Phases 1, 12 |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | Phases naming dependencies show exactly those; phases naming none depend on the one before; the first phase is ready at approval; a test phase reads like a build phase (A1, A2, A4, A5) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/lib/run/graph/declarations.test.ts |
| T2 | An impl naming a missing phase, itself, or a loop is refused at save, naming the phase and the problem (A3) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/__tests__/depends-on-refused.test.ts |
| T3 | The runner record appends and reads back every entry kind; a torn last line reads as absent; merges, conflicts and agent resolutions are countable (A73) | Build Phase 2 | Build Phase 2 | planned | unit | the record every clause signal and the second expectation are read from (ADR decision D12) | apps/indusk-mcp/src/lib/run/graph/record.test.ts |
| T4 | Review phases (falsification, cleanup, maintenance) are nodes with dependencies and files; the steps that write them are not nodes and take no slot; a maintenance phase is a fix-class node (A19, A20, A21, A22) | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/run/graph/read-graph.test.ts |
| T5 | A plan that is not approved has no phase in the graph (A98) | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/lib/run/graph/read-graph.test.ts |
| T6 | Independent phases start together, a dependent one only when its last dependency finishes, within a minute on the given clock while the cap has room, and after a session frees when it is full (A6, A7, A8) | Build Phase 4 | Build Phase 4 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/run/graph/schedule-ready.test.ts |
| T7 | A phase waits only for a dependency, a shared file, the cap or a hold, and its recorded reason names which; an undeclared phase is treated as touching its whole plan; a freed file starts the next phase on the next read (A10 to A14) | Build Phase 4 | Build Phase 4 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/lib/run/graph/schedule-files.test.ts |
| T8 | Two phases ending at the same moment cannot both claim one freed file (A18) | Build Phase 4 | Build Phase 4 | planned | unit | clause: the-work-runs-as-a-graph/graph-is-current | apps/indusk-mcp/src/lib/run/graph/schedule-files.test.ts |
| T9 | Of contested ready phases the earliest plan's runs next, unplaced plans go last by approval, a reorder takes effect at the next read, other phases keep running, and the record names the order used (A47 to A52) | Build Phase 4 | Build Phase 4 | planned | unit | clause: earlier-plans-go-first/earliest-next | apps/indusk-mcp/src/lib/run/graph/schedule-order.test.ts |
| T10 | A ready fix phase takes the next free session ahead of any non-fix phase; unstarted phases touching its files depend on it; a phase touching none is unaffected; two fixes go in plan order (A53, A54, A56, A57) | Build Phase 4 | Build Phase 4 | planned | unit | clause: earlier-plans-go-first/a-broken-promise-jumps-the-line | apps/indusk-mcp/src/lib/run/graph/schedule-fix.test.ts |
| T11 | The scheduler offers no way to stop a running phase: a full cap with a fix ready, a landing, an approval or an earlier plan wanting a file never ends a running phase (A82, A83) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-hold-is-cheap/running-phases-finish | apps/indusk-mcp/src/lib/run/graph/schedule-never-stops.test.ts |
| T12 | With the cap at one and phases naming nothing, the order and result equal today's one-phase-at-a-time run (A101) | Build Phase 4 | Build Phase 4 | planned | unit | a regression guard: the zero-migration claim of the dependency clause | apps/indusk-mcp/src/lib/run/graph/chain-parity.test.ts |
| T13 | A plan's session starts whatever other plans' sessions run; only a second session of the same kind on the same phase is refused, naming the one running (A96, A97) | Test Phase 1 | Build Phase 5 | planned | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager-parallel.test.ts |
| T14 | Two running phases of a plan sit in different worktrees on differently named branches cut from the plan's branch; one's work is invisible to the other; a merged phase's worktree is removed, its branch kept until the plan lands, and a failed one is kept and listed (A23 to A26) | Build Phase 6 | Build Phase 6 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/run/graph/phase-worktree.test.ts |
| T15 | A phase starts with every finished dependency's files present and none from a phase it does not depend on (A27, A28) | Build Phase 6 | Build Phase 6 | planned | unit | clause: a-phase-builds-on-its-own-branch/starts-from-its-dependencies | apps/indusk-mcp/src/lib/run/graph/phase-start-merge.test.ts |
| T16 | A phase that waited on another plan's phase for a file starts with that phase's work, landed or not, and its plan records having pulled it (A31, A32, A33) | Build Phase 6 | Build Phase 6 | planned | unit | clause: a-phase-builds-on-its-own-branch/starts-from-the-work-it-waited-for | apps/indusk-mcp/src/lib/run/graph/phase-start-waited.test.ts |
| T17 | Phases branch from the plan's branch, not the trunk (A99) | Build Phase 6 | Build Phase 6 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/run/graph/phase-worktree.test.ts |
| T18 | A conflicting merge an agent resolves with the plan's tests passing is kept; one after which tests fail is thrown away; one it cannot resolve becomes a question naming the files and holds only the affected phases; the same at all four merge points, including a dependency merge at phase start; the record counts them (A29, A68 to A72) | Build Phase 7 | Build Phase 7 | planned | unit | clause: trunk-cascades/agent-resolves-first | apps/indusk-mcp/src/lib/run/graph/conflict.test.ts |
| T19 | A phase that passes alone but fails merged with another finished phase is not merged and the record names both; the first of two phases that break only together stays merged; a green phase merges; the check includes clauses touched through other phases (A34, A35, A36, A38) | Build Phase 8 | Build Phase 8 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/run/graph/merge-into-plan.test.ts |
| T20 | A phase failing its merge check is kept and listed as stopped with the failing tests while unrelated phases keep running; the third failure becomes a hold (A37) | Build Phase 8 | Build Phase 8 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/run/graph/merge-failed.test.ts |
| T21 | A phase whose check ran no test, whose rows are all deferred, or that touches a clause without its signal is not merged and the record says why; one with the signal and a passing test merges (A40 to A43) | Build Phase 8 | Build Phase 8 | planned | unit | clause: a-phase-builds-on-its-own-branch/every-phase-is-checked | apps/indusk-mcp/src/lib/run/graph/merge-checked.test.ts |
| T22 | Finished work is on the plan's branch and not the trunk until the plan lands; landing a phase branch is refused naming its plan; an unverified plan is refused landing (A44 to A46) | Build Phase 8 | Build Phase 8 | planned | unit | clause: a-phase-builds-on-its-own-branch/only-the-plan-lands | apps/indusk-mcp/src/lib/run/graph/only-the-plan-lands.test.ts |
| T23 | Exactly one function moves a plan's branch from a phase (compare-and-swap), pinned by a single-definition scan | Build Phase 8 | Build Phase 8 | planned | unit | the ADR's named risk: a later caller skipping the swap | apps/indusk-mcp/src/lib/run/graph/single-swap.test.ts |
| T24 | A phase running at a landing is not interrupted and merges the trunk before it merges into its plan; one started after it does not merge it again; a conflicting trunk merge waits for the resolver (A65, A66, A67) | Build Phase 8 | Build Phase 8 | planned | unit | clause: trunk-cascades/phase-merges-at-its-end | apps/indusk-mcp/src/lib/run/graph/phase-end-trunk.test.ts |
| T25 | A running phase that touches a fix's files merges the fix before it merges into its plan and is not stopped (A55) | Build Phase 8 | Build Phase 8 | planned | unit | clause: earlier-plans-go-first/a-broken-promise-jumps-the-line | apps/indusk-mcp/src/lib/run/graph/merge-fix.test.ts |
| T26 | A held phase stops being the reason any phase waits for a file, its slot is released, its dependents still wait naming it, and a conflict hold or an amendment hold behave the same (A85 to A89) | Build Phase 9 | Build Phase 9 | planned | unit | clause: a-hold-is-cheap/a-hold-frees-its-files | apps/indusk-mcp/src/lib/run/graph/hold.test.ts |
| T27 | A released phase waits for active phases it now depends on, merges finished work touching its files and the trunk, resumes where it stopped without redoing work, and with nothing to merge resumes at once (A90 to A94) | Build Phase 9 | Build Phase 9 | planned | unit | clause: a-hold-is-cheap/the-held-phase-catches-up | apps/indusk-mcp/src/lib/run/graph/catch-up.test.ts |
| T28 | A landing brings every idle open plan's branch up to date within five minutes, skips a plan with a running phase, catches up a landing missed while the runner was off, skips unapproved and landed plans, and keeps each workbench repo's trunk its own (A59 to A63) | Build Phase 10 | Build Phase 10 | planned | unit | clause: trunk-cascades/branches-follow-the-trunk | apps/indusk-mcp/src/lib/run/graph/cascade.test.ts |
| T29 | A plan that pulled another plan's unlanded work is refused landing naming that plan, lands once it has, is not refused for work since landed, and a plan that pulled nothing lands as today (A75 to A78) | Build Phase 11 | Build Phase 11 | planned | unit | clause: landing-follows-what-it-pulled/lands-after | apps/indusk-mcp/src/lib/plans/land-pulled.test.ts |
| T30 | Before landing, such a plan merges the trunk holding the other plan's landed work, a conflict waits for the resolver, and the plan's tests run on the merged result (A79, A80, A81) | Build Phase 11 | Build Phase 11 | planned | unit | clause: landing-follows-what-it-pulled/merges-again-before-landing | apps/indusk-mcp/src/lib/plans/land-pulled.test.ts |
| T31 | A graph read follows every phase end, approval and landing before any launch, and a stranded ready phase is launched by the 60-second tick (A15, A16, A17) | Build Phase 12 | Build Phase 12 | planned | unit | clause: the-work-runs-as-a-graph/graph-is-current | apps/indusk-mcp/src/lib/build/graph-driver.test.ts |
| T32 | A phase boundary still names the command for what runs next, and the driver runs it (A100) | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/build/next-step-boundary.test.ts |
| T33 | The manual one-phase `/work` path works unchanged when no driver is active (A102) | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: the driver is added beside the manual path, not instead of it | apps/indusk-mcp/src/lib/build/manual-path.test.ts |
| T34 | A real approved plan with two independent phases starts two sessions in two worktrees without a second command (A9) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the ready-phases clause is proved by T6 and T31 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T35 | A real dependent pair: the later phase's session reads a file only the earlier phase wrote (A30) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the starts-from-its-dependencies clause is proved by T15 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T36 | A real plan where two phases collide only in combination is stopped at the join (A39) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the green-before-merging clause is proved by T19 and T20 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T37 | A real maintenance phase starts at the first free session and its dependents start with the fix present (A58) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the broken-promise-jumps-the-line clause is proved by T10 and T25 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T38 | A real landing brings two idle open plans' branches up to date within five minutes (A64) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the branches-follow-the-trunk clause is proved by T28 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T39 | A real conflict between two phases' edits to one file is resolved and the plan's tests still pass (A74) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the agent-resolves-first clause is proved by T18 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T40 | A real running phase continues to its end while the trunk changes and a fix is queued (A84) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the running-phases-finish clause is proved by T11 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T41 | A real phase held on an unresolved conflict and released by its answer resumes and finishes (A95) | Build Phase 13 | Build Phase 13 | planned | live check | a live check after landing, recorded in the retrospective; the held-phase-catches-up clause is proved by T27 | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T42 | The graph printout and the admin's why-it-waits line show each phase's state, the reason it waits and its ready-to-launched gap exactly as the runner record holds them (A103) | Build Phase 12 | Build Phase 12 | planned | unit | a display guard: the one place the clauses are shown, read through one function over the record | apps/indusk-mcp/src/lib/build/graph-print.test.ts |

### Deferred Verification

- **Whether an agent's conflict resolution is right beyond the plan's tests passing**
  - reason: correctness of a resolution is a judgement tests cannot fully give; the live conflict row uses a scripted resolver so the build spends no model calls and runs unattended.
  - would require: a run of real model-resolved conflicts across the first twenty parallel phases.
  - mitigation: the runner record counts every conflict and agent resolution with the plan's tests (second brief expectation); the retrospective reads it.
- **A master finishing in about the time of its longest chain** (first brief expectation)
  - reason: durations over days cannot be compressed into a test.
  - would require: Homework Gate's first milestone run to its last landing.
  - mitigation: figure read from phase start and end times in the record when that milestone lands.

## Checklist

### Test Phase 1: Author what can be authored, record what cannot

**Tier**: med — the step's default tier for work

This phase writes the three tests whose subjects already exist (the session rule that must change, the phase-boundary command that must not, and the manual one-phase path that must not) and records, with a reason and a body, every test that waits for a module a later phase creates. It hands the build phases a red session-rule test to turn green and a register they can check each later test against.

- [ ] Confirm this plan's worktree exists and is the one in use.
  <details><summary>Technical</summary>

  `indusk worktree create run-the-graph` (records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign run-the-graph <path>`). Worktree-per-plan default; no `worktree: none` in frontmatter.

  </details>
- [ ] Write the session-rule test so it fails on its own assertion today.
  <details><summary>Technical</summary>

  T13 in `apps/indusk-mcp/src/lib/session/manager-parallel.test.ts` against the existing manager: a build session on plan A phase 1 then a second build session on plan A phase 2 must start (RED today: refused as "same kind on the same plan"); a second build session on plan A phase 1 must be refused naming the first (green today).

  </details>
- [ ] Write the two guard tests for what must not change.
  <details><summary>Technical</summary>

  T32 `lib/build/next-step-boundary.test.ts`: the boundary of a finished phase names the command `indusk plans next-session <plan>` gives. T33 `lib/build/manual-path.test.ts`: a plan with no runner record yields the same next step the manual path gives today.

  </details>
- [ ] Record each later test in the register below and confirm none fails only on a missing file.
  <details><summary>Technical</summary>

  Every other row imports a module under `lib/run/graph/` or a function a later phase adds, so it is deferred with a body; none uses `.skip()`.

  </details>

#### Deferred to Build Phase 1

- **T1** — imports `readDeclarations`, introduced in Build Phase 1; the file would fail to load today. Body reviewed:

  ```typescript
  const d = readDeclarations(sixPhaseImpl); // P1,P3 none; P2 "Build Phase 1"; P5 "Build Phase 2, Build Phase 3"
  expect(d.dependsOn("Build Phase 5")).toEqual(["Build Phase 2", "Build Phase 3"]);
  expect(readDeclarations(unlabelledImpl).dependsOn("Build Phase 2")).toEqual(["Build Phase 1"]);
  ```
- **T2** — the refusal lives in the impl save check Build Phase 1 extends; today an unknown dependency line is plain text and nothing refuses it. Body reviewed:

  ```typescript
  const r = runValidator(implWith("**Depends on**: Build Phase 9")); // no such phase
  expect(r.refused).toBe(true);
  expect(r.message).toContain("Build Phase 9");
  ```

#### Deferred to Build Phase 2

- **T3** — imports the record module Build Phase 2 creates. Body reviewed:

  ```typescript
  appendRecord(home, { kind: "merge", plan: "p", conflicted: true, resolved: true });
  writeFileSync(file, `${readFileSync(file)}{"kind":"mer`); // torn last line
  expect(readRecord(home)).toHaveLength(1);
  ```

#### Deferred to Build Phase 3

- **T4**, **T5** — import `readGraph`, introduced in Build Phase 3. Body reviewed:

  ```typescript
  const g = readGraph(fixtureRoot); // plan with "Falsification" and "Cleanup" phases, one unapproved plan
  expect(g.node("p", "Phase 7: Falsification").dependsOn).toEqual(["Build Phase 6"]);
  expect(g.nodes.some((n) => n.plan === "unapproved")).toBe(false);
  ```

#### Deferred to Build Phase 4

- **T6** to **T12** — import `pickPhasesToStart`, introduced in Build Phase 4. Body reviewed (T6; the others differ in the graph they feed it):

  ```typescript
  const start = pickPhasesToStart({ graph, running: [], held: [], cap: 4, now });
  expect(start.map((p) => p.phase)).toEqual(["Build Phase 1", "Build Phase 3"]);
  ```

#### Deferred to Build Phase 6

- **T14** to **T17** — import `startPhase`, introduced in Build Phase 6; they run real throwaway git repositories. Body reviewed:

  ```typescript
  const a = await startPhase(repo, "p", "Build Phase 1");
  const b = await startPhase(repo, "p", "Build Phase 3");
  expect(a.worktree).not.toBe(b.worktree);
  expect(await mergeBase(a.branch, "plan/p")).toBe(await tip("plan/p"));
  ```

#### Deferred to Build Phase 7

- **T18** — imports `mergeWithResolution` from Build Phase 7. Body reviewed:

  ```typescript
  const out = await mergeWithResolution(wt, "main", { resolver: scripted("take-both"), tests: () => red });
  expect(out.kept).toBe(false);
  expect(await head(wt)).toBe(before); // thrown away
  ```

#### Deferred to Build Phase 8

- **T19** to **T25** — import `mergePhaseIntoPlan`, introduced in Build Phase 8. Body reviewed:

  ```typescript
  const r = await mergePhaseIntoPlan({ repo, plan: "p", phase: "Build Phase 2", check: () => ({ ran: 0 }) });
  expect(r.merged).toBe(false);
  expect(r.reason).toBe("unchecked");
  ```

#### Deferred to Build Phase 9

- **T26**, **T27** — import `holdPhase` and `releasePhase` from Build Phase 9. Body reviewed:

  ```typescript
  appendRecord(home, held("p", "Build Phase 1", "conflict"));
  expect(pickPhasesToStart({ graph, running, held: ["Build Phase 1"], cap, now })).toContain(waitingOnlyForItsFiles);
  ```

#### Deferred to Build Phase 10

- **T28** — imports `cascadeTrunk`, introduced in Build Phase 10. Body reviewed:

  ```typescript
  await cascadeTrunk(workbench, { openPlans: ["a", "b", "c"], runningPhases: [] });
  for (const p of ["a", "b", "c"]) expect(await contains(`plan/${p}`, landedSha)).toBe(true);
  ```

#### Deferred to Build Phase 11

- **T29**, **T30** — need the `pulled` entries Build Phase 6 records and the landing change this phase makes. Body reviewed:

  ```typescript
  appendRecord(home, pulled("reports", { plan: "login", branch: "plan/login", sha }));
  await expect(land("reports")).rejects.toThrow(/wait for login/);
  ```

#### Deferred to Build Phase 12

- **T31** — imports the driver Build Phase 12 creates. Body reviewed:

  ```typescript
  driver.onPhaseEnded("p", "Build Phase 1"); // reads the graph again before any launch
  expect(reads.at(-1)).toBeGreaterThan(endedAt);
  clock.advance(60_000); // missed event
  expect(launched).toContain("Build Phase 2");
  ```
- **T42** — imports the printout function Build Phase 12 adds beside the driver. Body reviewed:

  ```typescript
  appendRecord(home, waiting("p", "Build Phase 4", { file: "a.ts", phase: "Build Phase 2" }));
  expect(printGraph(readRecord(home), "p")).toContain("Build Phase 4 waits for Build Phase 2 on a.ts");
  ```

#### Deferred to Build Phase 13

- **T34** to **T41** — the live checks drive the finished driver against real git and real sessions, so they cannot load before Build Phase 12. They are system-tier tests (`vitest.tiers.ts`), never in a phase's loop, and prove no clause: each clause they touch is proved by its unit rows.

#### Regression Guards

- **T32** — the boundary command is printed correctly today; the row exists so the driver cannot change what a boundary names.
- **T33** — the manual path works today; the row exists so the driver is added beside it, not instead of it.

#### Test Phase 1 Verification

- [ ] The session-rule test exists and fails because the second phase's session is refused, not because of a missing file.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager-parallel.test.ts` — T13 fails on its own `expect` (the plan-A-phase-2 start is refused); the same-phase refusal case is green.

  </details>
- [ ] The two guard tests pass today.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/build/next-step-boundary.test.ts src/lib/build/manual-path.test.ts` — T32 and T33 green.

  </details>
- [ ] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body above reviewed against both questions: will it compile at the phase it names, and does it assert what its row claims?

  </details>

#### Test Phase 1 Context

- [ ] Record, in the package's rules file, that the graph's tests use real throwaway git repositories and an injected clock.
  <details><summary>Technical</summary>

  guard: the graph tests carry `lesson: code-that-decides-takes-its-clock-and-its-reads` and `lesson: everyday-tests-never-wait`; no new text needed in a CLAUDE.md for this phase (the rule is delivered by the enforcer).

  </details>

#### Test Phase 1 Document

- [ ] Add an Unreleased changelog line saying the session rule's tests were written first.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, Unreleased: "Tests: the parallel-session rule and the phase-boundary guards are written before the runner."

  </details>

### Build Phase 1: Phases say what they need and what they touch

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/run/graph/declarations.ts, apps/indusk-mcp/src/lib/models/tiers.ts, apps/indusk-mcp/hooks/validate-impl-structure.js, apps/indusk-mcp/src/__tests__/depends-on-refused.test.ts, apps/indusk-mcp/src/__tests__/declarations.test.ts, apps/indusk-mcp/CLAUDE.md, apps/docs/src/reference/cli/run-the-graph.md, CLAUDE.md

This phase gives every phase of an impl two optional lines, one naming the phases it needs and one naming the files it writes, and makes the impl save check refuse a line that points nowhere or loops. A phase with no dependency line keeps depending on the one before it, so every existing plan still runs as a chain. Everything after this reads phases through what this phase builds.

- [ ] Read the dependency line and the files line under a phase heading.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/run/graph/declarations.ts`: `readDeclarations(implText): Declarations` parsed exactly as `**Tier**:` is (outside fenced blocks, one line per phase, a second line is an error). `**Depends on**: Build Phase 1, Build Phase 3` or `none`; `**Files**: a/b/**, c.md` with `repo:` prefix in a workbench. Exports `dependsOn(phase)`, `files(phase)`, `fileSetsOverlap(a, b)` (globs). No line means depends on the phase before; no files line means `undeclared`.

  </details>
- [ ] Make a phase with no dependency line depend on the phase before it, and let test phases and build phases both be named.
  <details><summary>Technical</summary>

  The first phase of the document with no line has no dependency. Names are the headings as written (`Test Phase 1`, `Build Phase 2`, `Phase 7: Falsification`).

  </details>
- [ ] Make saving an impl refuse an unknown phase, a self-dependency and a loop, naming the phases.
  <details><summary>Technical</summary>

  Extend `hooks/validate-impl-structure.js` through the shared parser the hooks already use (read `apps/indusk-mcp/hooks/CLAUDE.md` first); refusal text names the phase and the problem; scope the re-validation to the edit as the other rules do.

  </details>
- [ ] Add the root Key Decisions line for this plan.
  <details><summary>Technical</summary>

  `CLAUDE.md` Key Decisions: "Run the graph: phases declare `**Depends on**:` and `**Files**:`, a pure scheduler starts ready phases on `phase/<plan>/<n>` branches, merged into the plan by compare-and-swap after a green check; earlier plans first — see `/decisions/run-the-graph`". Written here, not at planning, because the plan's branch may not change anything outside `.indusk/` before its build.

  </details>

- [ ] Make the hook's own reader and the scheduler's reader agree, and make the incident writers declare files.
  <details><summary>Technical</summary>

  `hooks/validate-impl-structure.js` mirrors `declarations.ts` inline (a hook cannot import `.ts`); add `declarations-parity.test.ts` feeding both the same forms (`none`, a `repo:` prefix, a fenced block, a missing line) and asserting equal results. `indusk update` syncs the installed hook copy. The Maintenance-phase writers (`src/bin/cli.ts` around the monitor's append, `src/tools/promise-tools.ts` `record_breaks`) write `**Files**:` from the paths the broken promise's links declare, so a fix phase has a file set to overlap. (plan review)

  </details>
- [ ] Say, in the plan's own rules, that the plan's documents are not declared files.
  <details><summary>Technical</summary>

  ADR D2 addendum: paths under `.indusk/planning/<plan>/`, the changelog and `CLAUDE.md` rules files a phase edits for its Context gate are excluded from overlap; `impl.md` ticks and State cells are merged by the scripted tick-union in Build Phase 8, not by an agent and not by serialising phases. (plan review: parallel phases all edit `impl.md`)

  </details>

#### Build Phase 1 Verification

- [ ] The declaration tests pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run/graph/declarations.test.ts src/__tests__/depends-on-refused.test.ts && pnpm exec vitest related src/lib/run/graph/declarations.ts hooks/validate-impl-structure.js` — T1 and T2 pass; the whole suite runs at landing, not here.

  </details>
- [ ] This plan's own impl still passes the save check.
  <details><summary>Technical</summary>

  `node hooks/validate-impl-structure.js` against this file (or re-save it) — no refusal.

  </details>

#### Build Phase 1 Context

- [ ] Record, in the package's rules file, that dependency and file lines are read by one parser.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` new section "Run the graph": "Phase dependencies and files are read only by `lib/run/graph/declarations.ts`; no second reader" — guarded by a single-definition scan in `declarations.test.ts` (carries `clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs`).

  </details>

#### Build Phase 1 Document

- [ ] Write the reference page for the two lines.
  <details><summary>Technical</summary>

  New `apps/docs/src/reference/cli/run-the-graph.md` (what the lines mean, the default chain, the refusals); changelog Unreleased entry from the ADR's Documentation Plan.

  </details>

### Build Phase 2: The runner keeps one record

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/run/graph/record.ts, apps/indusk-mcp/src/lib/run/graph/record.test.ts

This phase adds the single place the runner writes down what happened: which phases are done, held, merged, conflicted, pulled from another plan, and when each became ready and was launched. Nothing else stores scheduler state; the scheduler, landing and the later graph view all read this file. It does not depend on the phase lines, so it is built beside them.

- [ ] Add an append-only record file in machine state with one writer that never raises.
  <details><summary>Technical</summary>

  `lib/run/graph/record.ts`: `appendRecord(home, entry)` modelled on the plan-timing writer, file `runner.jsonl` under the `indusk eval home` directory. Entry kinds: `ready`, `launched`, `done`, `held`, `released`, `merge` (conflicted, resolved, tests), `pulled {plan, branch, sha}`, `waiting {phase, reason}`, `graph-read`.

  </details>
- [ ] Make reading treat a missing or half-written last line as absent.
  <details><summary>Technical</summary>

  `readRecord(home)` returns entries in order; a torn trailing line is dropped, never thrown. Add `countMerges(entries)` returning merges, conflicts and agent-resolved-with-tests-passing (the second expectation).

  </details>

#### Build Phase 2 Verification

- [ ] The record tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/record.test.ts && pnpm exec vitest related src/lib/run/graph/record.ts` — T3 passes.

  </details>

#### Build Phase 2 Context

- [ ] Record, in the package's rules file, that the runner record is the only scheduler state.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "Scheduler state is `runner.jsonl` plus the impl files; nothing is kept in memory or a database" — guard: `record.test.ts` scans the graph directory for any other store.

  </details>

#### Build Phase 2 Document

- [ ] Describe the record in the reference page.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "The runner record": entry kinds, where the file lives, that a torn last line reads as absent.

  </details>

### Build Phase 3: Reading the graph

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 1, Build Phase 2
**Files**: apps/indusk-mcp/src/lib/run/graph/read-graph.ts, apps/indusk-mcp/src/lib/run/graph/read-graph.test.ts, apps/indusk-mcp/src/lib/run/graph/read-graph-signals.ts

This phase turns the approved plans on disk into one graph the scheduler can be handed: every phase of every approved plan with what it needs, what it touches, which plan it belongs to and where that plan comes in the order. It adds the extra edges a fix phase puts on the phases it could disturb. It starts nothing; the scheduler is the next phase.

- [ ] Build the graph from the approved plans' impls, the plan order and the record.
  <details><summary>Technical</summary>

  `readGraph(root, { record, sessions })` returns `Graph` with `PhaseNode { plan, phase, dependsOn, files, rank, isFix, done, running, held }`. Plan rank is whatever `order_plans` returns, called once per read; only plans whose impl is `approved` appear (`a-plan-builds-only-after-approval`).

  </details>
- [ ] Count the review phases as ordinary phases and the steps that write them as nothing.
  <details><summary>Technical</summary>

  Falsification, Cleanup and Audit phases are nodes with the dependencies they declare; the planning, audit and falsify steps are not nodes and take no session slot (`reviews-are-phases`). A Maintenance phase for an open incident is a fix node.

  </details>
- [ ] Add the extra edge a fix puts on every unstarted phase whose files overlap its own.
  <details><summary>Technical</summary>

  Virtual edges are computed on every read and never written to an impl; a running phase is not delayed (it merges the fix at its end, Build Phase 8).

  </details>

- [ ] Turn the plan-order rule into one callable function and have the graph reader call it.
  <details><summary>Technical</summary>

  `order_plans` (`src/tools/plan-tools.ts`) is a dependency sort only. Add `lib/plan-order.ts` implementing the brief's rule: root master through each parent's ordered `subplans:`, unplaced plans after, earlier approval first; `order_plans` and `readGraph` both call it. T9's schedule test gets one case fed through the real function, not hand-made ranks. (plan review: ADR D7 assumed the function existed)

  </details>
- [ ] Report the signal for the clause that each phase names what it needs, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/a-phase-names-what-it-needs` — reported from `apps/indusk-mcp/src/lib/run/graph/read-graph-signals.ts`, called by `readGraph` after it builds the nodes. Judged against the impl text, not `readDeclarations`: a plain scan of each approved impl's phase headings and `**Depends on**:` lines (outside fences, by `fencedLineMask`) gives the expected list — the named phases, `none`, or the phase before for a phase with no line and nothing for the first; each node's `dependsOn` is compared with it. `writeClauseSignals(root, "run-graph.read", plan, { plan: "run-the-graph", phase: "Build Phase 3" }, verdicts)` from `lib/promises/clause-signal.ts`, one verdict per plan per read; `broken` names the plan, the phase and both lists. Best-effort: a signal never fails the read.

  </details>
- [ ] Report the signal for the clause that review phases are phases of the graph, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/reviews-are-phases` — reported from `apps/indusk-mcp/src/lib/run/graph/read-graph-signals.ts`, same call. A plain heading scan finds each phase heading starting Falsification, Cleanup, Audit or Maintenance; each must have a node with its declared dependencies and files, a Maintenance phase must be a fix node, and no node may be a step (planning, the audit step, falsify or cleanup authoring, the retrospective). `broken` names the plan and the heading missing, the step shown as a node, or the Maintenance phase not marked a fix. That review phases are launched by the same rule is read by the driver's graph-is-current signal (every launch comes from a graph read), Build Phase 12. Best-effort.

  </details>

#### Build Phase 3 Verification

- [ ] The graph tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/read-graph.test.ts && pnpm exec vitest related src/lib/run/graph/read-graph.ts src/lib/run/graph/read-graph-signals.ts` — T4 and T5 pass.

  </details>

#### Build Phase 3 Context

- [ ] Record, in the package's rules file, that plan order is the existing order tool's and nothing new.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "Plan rank comes only from `order_plans`; the graph reader holds no ordering rule" — guard: `read-graph.test.ts` asserts the reader calls it once per read.

  </details>

#### Build Phase 3 Document

- [ ] Add the graph-reading section and the six-phase example diagram.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md`: Mermaid dependency graph of the brief's six-phase plan with ready, running and waiting phases.

  </details>

### Build Phase 4: The scheduler

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 3
**Files**: apps/indusk-mcp/src/lib/run/graph/schedule.ts, apps/indusk-mcp/src/lib/run/graph/schedule-ready.test.ts, apps/indusk-mcp/src/lib/run/graph/chain-parity.test.ts, apps/indusk-mcp/src/lib/run/graph/schedule-signals.ts

This phase adds the one function that decides which phases to start. It is handed the graph, what is running, what is held, the session cap and the clock, and it returns the phases to launch in order, each waiting phase carrying the reason it waits. It has no way to stop anything, so a running phase always finishes. Every later phase calls it and none re-implements a rule.

- [ ] Write the function that picks the phases to start.
  <details><summary>Technical</summary>

  `lib/run/graph/schedule.ts`: `pickPhasesToStart({ graph, running, held, cap, now }): { start: PhaseNode[]; waiting: {phase, reason}[] }`. Ready = every dependency done, plan approved, not held, not running. Starts if files do not overlap a running phase's, the cap has room, and no earlier-ranked ready phase wants an overlapping file. Rank: fix phases, then plan order, then position in the impl. A held phase is dropped from `running` when file holds are computed. An undeclared-files phase counts as touching every file its own plan declares. Reasons are one of: dependency, file (naming the phase and file), cap, hold.

  </details>
- [ ] Make two phases freed at the same moment unable to take the same file.
  <details><summary>Technical</summary>

  Starts are chosen sequentially within one call, each added start joining the running set for the next.

  </details>
- [ ] Make sure the function has no way to ask for a running phase to stop.
  <details><summary>Technical</summary>

  Return type has no stop field; T11 asserts the result shape for the full-cap-with-fix, landing, approval and earlier-plan cases.

  </details>
- [ ] Report the signal for the clause that no phase waits needlessly, after each scheduling decision.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/no-needless-wait` — reported from `apps/indusk-mcp/src/lib/run/graph/schedule-signals.ts`. `judgeNoNeedlessWait({ graph, running, held, cap, result })` re-derives each waiting phase's reason from the call's inputs without calling `pickPhasesToStart`: a dependency not done, a running phase whose files overlap (by `fileSetsOverlap`), the cap full, or a hold. `broken` names a waiting phase with no reason, one whose named phase it neither depends on nor overlaps, a ready phase not started while none of the four applies, or two running phases holding one file. The scheduler stays pure and does not import this file; `reportScheduleSignals(root, input, result, tracer?)` is called by the driver (Build Phase 12) after each call, writing through `writeClauseSignals(root, "run-graph.schedule", plan, { plan: "run-the-graph", phase: "Build Phase 4" }, verdicts)`. Best-effort.

  </details>
- [ ] Report the signal for the clause that the earliest plan's phase goes next on a contested file.
  <details><summary>Technical</summary>

  signal: `earlier-plans-go-first/earliest-next` — reported from `apps/indusk-mcp/src/lib/run/graph/schedule-signals.ts`, same call. For each start whose files overlap another ready phase's, the started phase's plan place, from `lib/plan-order.ts` called afresh (not the node's cached `rank`), is no later than any other non-fix contender's; `broken` names the phase started and the earlier plan's phase passed over. Best-effort.

  </details>
- [ ] Report the signal for the clause that a fix phase jumps the line, for the start of a phase.
  <details><summary>Technical</summary>

  signal: `earlier-plans-go-first/a-broken-promise-jumps-the-line` — start half, reported from `apps/indusk-mcp/src/lib/run/graph/schedule-signals.ts`, same call. When a fix node is ready and the result starts any non-fix phase while the fix is not started, `broken` names the fix passed over; every unstarted phase whose files overlap a fix's lists it as a dependency in the graph, or `broken` names that phase; a fix node with no declared files is `broken` too (nothing could depend on it). The merge half is reported in Build Phase 8. Best-effort.

  </details>

#### Build Phase 4 Verification

- [ ] The scheduler tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/schedule-ready.test.ts src/lib/run/graph/schedule-files.test.ts src/lib/run/graph/schedule-order.test.ts src/lib/run/graph/schedule-fix.test.ts src/lib/run/graph/schedule-never-stops.test.ts src/lib/run/graph/chain-parity.test.ts && pnpm exec vitest related src/lib/run/graph/schedule.ts src/lib/run/graph/schedule-signals.ts` — T6 to T12 pass.

  </details>

#### Build Phase 4 Context

- [ ] Record, as a guard, that the scheduler takes its clock and reads as inputs.
  <details><summary>Technical</summary>

  guard: `schedule-ready.test.ts` carries `lesson: code-that-decides-takes-its-clock-and-its-reads`; the scheduler imports no `fs`, `child_process` or `Date.now` (scan in the same test).

  </details>

#### Build Phase 4 Document

- [ ] Document the ranking and the waiting reasons.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "Order and waiting": rank order, the four reasons a phase waits; `guide/parallel-plans.md` short page for a person: what runs together and why a phase waits.

  </details>

### Build Phase 5: Several sessions of one plan at once

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/session/manager.ts, apps/indusk-admin/src/lib/build-host.ts, apps/indusk-admin/src/app/api/plans/build/route.ts, apps/indusk-admin/src/app/api/sessions/route.ts, apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts, .indusk/promises/a-session-belongs-to-its-plan.md

This phase lets a plan have a planning session and several phases building at the same time, by identifying a session by its plan, its kind and its phase instead of plan and kind alone. The cap does not change. Without it the scheduler could choose two phases of one plan and the session manager would refuse the second.

- [ ] Identify a session by plan, kind and phase.
  <details><summary>Technical</summary>

  `lib/session/manager.ts`: only a second session of the same kind on the same plan and phase is refused, naming the session already running; the cap check (`limits.ts`, `sessions.max`) is unchanged. Update `apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts` for the new identity.

  </details>
- [ ] Rewrite the changed promise's sentence now that the code makes it true.
  <details><summary>Technical</summary>

  `indusk promises change a-session-belongs-to-its-plan --plan run-the-graph --statement "A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the session already running, so a plan can have a planning session and several phases building at the same time." --reason "phases of one plan run in parallel"`.

  </details>

- [ ] Count every phase session against the cap, and make the admin understand several build sessions of one plan.
  <details><summary>Technical</summary>

  `lib/session/manager.ts` `refusalFor` (~line 230) and `capRefusal` (~line 255) exempt a build session whose plan has an admitted build; count each phase session instead, one place each. `apps/indusk-admin/src/lib/build-host.ts` `assertNoBuildSession` and `app/api/plans/build/route.ts`, `app/api/sessions/route.ts` read by plan and kind: read by plan, kind and phase, Stop stops all of a plan's phase sessions, Build is refused only when the plan's driver is already running. Add a case to `manager-parallel.test.ts`: cap 4, one admitted plan, three phases, a fourth session is refused. (plan review)

  </details>

#### Build Phase 5 Verification

- [ ] A plan's second phase session starts and the same-phase duplicate is refused.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/session/manager-parallel.test.ts src/lib/session/manager.test.ts && pnpm exec vitest related src/lib/session/manager.ts` — T13 passes, existing manager tests still pass.

  </details>

#### Build Phase 5 Context

- [ ] Update, in the package's rules file, the rule that states how a session is identified.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`: replace "one session per plan and kind" wording with "per plan, kind and phase; `sessions.max` still caps the machine" — guard: `manager-parallel.test.ts` carries `promise: a-session-belongs-to-its-plan`.

  </details>

#### Build Phase 5 Document

- [ ] Update the sessions decision page for the new identity.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/sessions-per-plan.md`: add a dated note that identity is plan, kind and phase (run-the-graph).

  </details>

### Build Phase 6: A phase gets its own worktree and branch

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 1, Build Phase 2
**Files**: apps/indusk-mcp/src/lib/run/graph/phase-branch.ts, apps/indusk-mcp/src/lib/worktree/layout.ts, apps/indusk-mcp/src/lib/run/graph/phase-branch-signals.ts

This phase makes a phase's start real: a worktree of its own on its own branch, cut from its plan's branch, with every finished dependency merged in and, when it waited on another plan's phase for a file, that phase's finished work merged in too. It records when a plan pulled another plan's unlanded work. Merging back is later phases' work; a conflict at start goes through a resolver this phase only names.

- [ ] Create the worktree and the branch for a phase, cut from the plan's branch.
  <details><summary>Technical</summary>

  `startPhase(repo, plan, phase, { resolver })` in `lib/run/graph/phase-branch.ts`; branch `phase/<plan>/<n>` (not `plan/<plan>/phase-<n>`: git cannot hold `plan/<plan>` and refs below it), worktree in the plan's layout (`lib/worktree/layout.ts`); `MergeResolver` is a type here, implemented in Build Phase 7, and tests use a stub.

  </details>
- [ ] Merge each finished dependency into the new worktree and nothing else.
  <details><summary>Technical</summary>

  Fast-forward when the plan's branch already holds it. A dependency not named is not merged even if it finished first.

  </details>
- [ ] Merge the finished work of a phase this one waited on in another plan, landed or not, and record the pull.
  <details><summary>Technical</summary>

  Append `pulled {plan, branch, sha}` for the pulling plan to the record.

  </details>
- [ ] Remove the worktree of a phase that merged and keep its branch until its plan lands (another plan may pull that finished branch); keep and list a phase that did not merge.
  <details><summary>Technical</summary>

  Removal happens after the Build Phase 8 merge; this phase provides `removePhase` and `listKept`.

  </details>
- [ ] Report the signal for the clause that every running phase has its own worktree, when a phase starts.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/own-worktree` — reported from `apps/indusk-mcp/src/lib/run/graph/phase-branch-signals.ts`, called by `startPhase` before it returns. Judged with plain git, not `lib/worktree/layout.ts`: `git worktree list --porcelain` shows the new path and branch once and held by no other running phase, and `git merge-base --is-ancestor plan/<plan> <branch>` holds while the branch's base is not the trunk alone. `writeClauseSignals(root, "run-graph.phase-start", plan, { plan: "run-the-graph", phase: "Build Phase 6" }, verdicts)`; `broken` names the phase and the shared worktree, shared branch or wrong base. Best-effort: a signal never fails the start.

  </details>
- [ ] Report the signal for the clause that a phase starts with its dependencies' work, when a phase starts.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/starts-from-its-dependencies` — reported from `apps/indusk-mcp/src/lib/run/graph/phase-branch-signals.ts`, same point. For each finished dependency, its branch tip is an ancestor of the new worktree's `HEAD` (`git merge-base --is-ancestor`); no finished phase branch it does not depend on is an ancestor unless that work is already on the plan's branch; the worktree has no unmerged paths (`git ls-files -u` empty). `broken` names the phase and the missing or extra phase. Best-effort.

  </details>
- [ ] Report the signal for the clause that a phase starts with the other plan's work it waited for, when a phase starts.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/starts-from-the-work-it-waited-for` — reported from `apps/indusk-mcp/src/lib/run/graph/phase-branch-signals.ts`, same point. For each `waiting` record entry of this phase naming another plan's phase, that phase's branch tip is an ancestor of `HEAD`, and when that plan has not landed (its landing subject absent from a plain `git log <trunk> --merges`) a `pulled` entry for it exists in the record read back from disk. `broken` names the phase and the missing work or missing entry. Best-effort.

  </details>

#### Build Phase 6 Verification

- [ ] The worktree and start-merge tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/phase-worktree.test.ts src/lib/run/graph/phase-start-merge.test.ts src/lib/run/graph/phase-start-waited.test.ts && pnpm exec vitest related src/lib/run/graph/phase-branch.ts src/lib/run/graph/phase-branch-signals.ts` — T14 to T17 pass, on real throwaway git repositories.

  </details>

#### Build Phase 6 Context

- [ ] Record, in the package's rules file, why phase branches are named the way they are.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "Phase branches are `phase/<plan>/<n>`: a ref `plan/<plan>` cannot have refs below it" — guard: `phase-worktree.test.ts` asserts the name shape.

  </details>

#### Build Phase 6 Document

- [ ] Document the phase worktree and what a phase starts with.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "A phase's branch"; `reference/skills/work.md` the phase's worktree and merge-at-end.

  </details>

### Build Phase 7: Conflicts go to an agent first

**Tier**: strong — decides whether a merge result is kept, the rule every merge point shares
**Depends on**: Build Phase 6
**Files**: apps/indusk-mcp/src/lib/run/graph/conflict.ts, apps/indusk-mcp/src/lib/run/graph/conflict.test.ts, apps/indusk-mcp/src/lib/run/graph/conflict-signals.ts

This phase adds the one way a conflicting merge is handled at all four merge points. An agent resolves it in the merging worktree and the result is kept only if the plan's tests pass; otherwise the merge is undone and a question naming the files is raised, with only that plan's affected phases going on hold. It also makes every merge write down whether it conflicted and how it ended, which is how the second expectation is read.

- [ ] Hand a conflicting merge to an agent and keep the result only with the plan's tests passing.
  <details><summary>Technical</summary>

  `mergeWithResolution(worktree, ref, { resolver, tests })` in `lib/run/graph/conflict.ts`; a failing result resets to the pre-merge head. The same function is used at phase start, phase end, trunk cascade and before landing.

  </details>
- [ ] Turn an unresolved conflict into a question naming the files and hold only the affected phases.
  <details><summary>Technical</summary>

  Affected = phases of the plan whose declared files overlap the conflicting files, and the phases that depend on them. Other plans and unaffected phases keep running.

  </details>
- [ ] Record every merge, whether it conflicted and whether it was resolved with tests passing.
  <details><summary>Technical</summary>

  Appends `merge` entries (Build Phase 2) so `countMerges` yields the brief's second expectation.

  </details>

- [ ] Prove every merge point calls the resolver, and give an agent resolution a plan-tests scope that works mid-build.
  <details><summary>Technical</summary>

  `merge-call-sites.test.ts`: `startPhase`, `mergePhaseIntoPlan`, `cascadeTrunk` and the pre-landing merge each go through `mergeWithResolution` (spy on it; a plain `git merge` fails the test). `planTestSet` gets a built-so-far scope: only rows whose State is written, so unbuilt rows never reject a correct resolution. Add a cap-and-permission case: the resolver session request is admitted by the real `session/manager.ts` limits with a stub process, spending no model call. (plan review)

  </details>
- [ ] Report the signal for the clause that a conflict goes to an agent first, after every conflicting merge.
  <details><summary>Technical</summary>

  signal: `trunk-cascades/agent-resolves-first` — reported from `apps/indusk-mcp/src/lib/run/graph/conflict-signals.ts`, called by `mergeWithResolution` after a merge that conflicted, at each of the four merge points (the point is a span attribute). Judged from the worktree with git, not the function's own result: kept means `git rev-parse HEAD` equals the commit the recorded test run passed on, with at least one test run; thrown away means `HEAD` equals the pre-merge head and no unmerged paths remain; a question means the record read back holds a `held` entry for each affected phase and none for a phase of another plan or one with no overlapping file and no dependency on one. `writeClauseSignals(root, "run-graph.conflict", plan, { plan: "run-the-graph", phase: "Build Phase 7" }, verdicts)`; `broken` names the plan, the merge point and which of these failed. Best-effort: a signal never fails the merge.

  </details>

#### Build Phase 7 Verification

- [ ] The conflict tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/conflict.test.ts && pnpm exec vitest related src/lib/run/graph/conflict.ts src/lib/run/graph/conflict-signals.ts` — T18 passes at every merge point, including a dependency conflict at phase start.

  </details>

#### Build Phase 7 Context

- [ ] Record, in the package's rules file, that a resolution is kept only with the plan's tests passing.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "A conflict resolution is kept only if the plan's tests pass; otherwise it becomes a question" — guard: `conflict.test.ts` carries `clause: trunk-cascades/agent-resolves-first`.

  </details>

#### Build Phase 7 Document

- [ ] Document conflicts and what the record counts.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "Conflicts"; note which counts answer the second expectation.

  </details>

### Build Phase 8: Merging a phase into its plan

**Tier**: strong — the compare-and-swap and merge check are the safety core of the whole graph
**Depends on**: Build Phase 6, Build Phase 7
**Files**: apps/indusk-mcp/src/lib/run/graph/merge-into-plan.ts, apps/indusk-mcp/src/lib/plans/test-set.ts, apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/run/graph/merge-signals.ts

This phase adds the end of a phase: it merges the trunk and any open fix branch that overlaps its files, merges the plan's tip, runs the check on that result, and moves the plan's branch with a compare-and-swap that fails if the branch moved meanwhile. A red check keeps the phase, lists it as stopped and never stops anyone else. Only a plan's branch can ever reach the trunk.

- [ ] Merge the trunk, any overlapping fix and the plan's tip into the phase before checking.
  <details><summary>Technical</summary>

  `mergePhaseIntoPlan` in `lib/run/graph/merge-into-plan.ts`, steps in the ADR D6 order: trunk (D9 conflicts via `mergeWithResolution`), plan tip plus open fix branches overlapping the phase's files, check, swap.

  </details>
- [ ] Run the phase's tests and the tests of every clause the plan's branch has touched, and refuse a run with no test.
  <details><summary>Technical</summary>

  Touched clauses = the union of clauses named in the `For` cell of any row of a phase already merged or this one, and clauses whose `promise:` token appears in a file changed on the plan branch since it left the trunk; uses `lib/plans/test-set.ts`. An empty test set, all-deferred rows, or a touched clause without its signal row means no merge and a recorded reason.

  </details>
- [ ] Move the plan's branch with a compare-and-swap, repeating from the merge when it moved.
  <details><summary>Technical</summary>

  One function, `swapPlanBranch`, runs `git update-ref <ref> <new> <old>`; T23 scans that nothing else moves a plan branch from a phase.

  </details>
- [ ] Keep a phase whose check is red, list it with the failing tests, and make its third failure a hold.
  <details><summary>Technical</summary>

  Uses the existing three-attempt rule (`a-struggling-phase-asks-for-a-stronger-model`); a red check starts no repair.

  </details>
- [ ] Refuse landing a phase branch, and refuse an unverified plan.
  <details><summary>Technical</summary>

  `lib/plans/land.ts` refuses a ref under `phase/`, naming its plan.

  </details>

- [ ] Move the plan's branch by compare-and-swap and bring its worktree with it.
  <details><summary>Technical</summary>

  After `git update-ref <ref> <new> <old>` succeeds, run `git -C <plan worktree> reset --keep <new>` so index and files follow; a worktree with local edits is refused, never overwritten, and the merge is retried. `plan-worktree-sync.test.ts`: after a swap, `git status` in the plan worktree is clean and `landPlan`'s dirty check passes. (plan review: `update-ref` leaves a checked-out branch's files behind)

  </details>
- [ ] Resolve conflicts confined to the impl's checkboxes mechanically, without the agent.
  <details><summary>Technical</summary>

  In `mergePhaseIntoPlan`, a conflict confined to checklist boxes and State cells of `impl.md` is resolved by taking each side's ticked boxes (union of `[x]`); anything else in `impl.md`, or any other file, goes to the resolver. Test: two parallel phases tick different boxes of adjacent rows and merge with no conflict question. (plan review)

  </details>
- [ ] Report the signal for the clause that a phase merges only when green, after each move of a plan's branch.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/green-before-merging` — reported from `apps/indusk-mcp/src/lib/run/graph/merge-signals.ts`, called by `swapPlanBranch` after the swap succeeds. The new plan tip (`git rev-parse plan/<plan>`) must equal the commit the recorded check ran on, the run must have exit zero, and the touched-clause set recomputed by `planTestSet` on that commit must be contained in what ran. `writeClauseSignals(root, "run-graph.merge", plan, { plan: "run-the-graph", phase: "Build Phase 8" }, verdicts)`; `broken` names the phase, the commit and the red, missing or left-out tests. Best-effort: a signal never fails the merge.

  </details>
- [ ] Report the signal for the clause that every merged phase was checked, after each move of a plan's branch.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/every-phase-is-checked` — reported from `apps/indusk-mcp/src/lib/run/graph/merge-signals.ts`, same point. The recorded run ran at least one test that is not deferred, and for every clause the phase touches its section of the impl has a task naming that clause's signal, read with the rule the contract check uses (`lib/promises/clause-signal-rules.ts`). `broken` names the phase and "no test ran" or the clause without its signal. Best-effort.

  </details>
- [ ] Report the signal for the clause that a phase merges the trunk at its end, after each move of a plan's branch.
  <details><summary>Technical</summary>

  signal: `trunk-cascades/phase-merges-at-its-end` — reported from `apps/indusk-mcp/src/lib/run/graph/merge-signals.ts`, same point. The trunk's tip read when the phase ended (`git rev-parse <trunk>`, per repo in a workbench) is an ancestor of the commit swapped in; `broken` names the phase and the trunk commit it went without. Best-effort.

  </details>
- [ ] Report the signal for the clause that a fix phase jumps the line, for a running phase's merge.
  <details><summary>Technical</summary>

  signal: `earlier-plans-go-first/a-broken-promise-jumps-the-line` — merge half, reported from `apps/indusk-mcp/src/lib/run/graph/merge-signals.ts`, same point. Every open fix branch whose declared files overlap the phase's is an ancestor of the commit swapped in; `broken` names the phase and the fix it merged without. Best-effort.

  </details>
- [ ] Report the signal for the clause that only a plan's branch reaches the trunk, after each landing.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/only-the-plan-lands` — reported from `apps/indusk-mcp/src/lib/run/graph/merge-signals.ts`, called by `lib/plans/land.ts` after a landing. Read from the trunk's own history with plain git, not the landing's result: the merges since the previous landing (`git log <trunk> --merges --first-parent --format=%H %P %s`) each name a `plan/` branch in their subject and none a `phase/` branch, and the landed plan's promises read verified from its promise files. `broken` names the commit and its source branch, or the unverified plan. Best-effort: a signal never fails the landing.

  </details>

#### Build Phase 8 Verification

- [ ] The merge tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/merge-into-plan.test.ts src/lib/run/graph/merge-failed.test.ts src/lib/run/graph/merge-checked.test.ts src/lib/run/graph/only-the-plan-lands.test.ts src/lib/run/graph/single-swap.test.ts src/lib/run/graph/phase-end-trunk.test.ts src/lib/run/graph/merge-fix.test.ts && pnpm exec vitest related src/lib/run/graph/merge-into-plan.ts src/lib/run/graph/merge-signals.ts src/lib/plans/land.ts` — T19 to T25 pass.

  </details>

#### Build Phase 8 Context

- [ ] Record, in the package's rules file, that only one function moves a plan branch from a phase.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "`swapPlanBranch` is the only code that moves a plan's branch from a phase" — guard: `single-swap.test.ts` scans for other `update-ref` callers.

  </details>

#### Build Phase 8 Document

- [ ] Add the end-of-phase sequence diagram.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md`: Mermaid sequence: merge trunk, merge plan tip, check, compare-and-swap, retry.

  </details>

### Build Phase 9: Holds are cheap

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 2, Build Phase 4, Build Phase 7
**Files**: apps/indusk-mcp/src/lib/run/graph/hold.ts, apps/indusk-mcp/src/lib/run/graph/hold-signals.ts

This phase adds the hold: a phase set aside gives up its session and its files at once so phases waiting only for those files go ahead, while phases that need its output still wait. When it is released it does its own catching up. The two triggers that exist today, a conflict that cannot be resolved and an amendment, prove it; the question triggers are another plan's.

- [ ] Add holding and releasing a phase, written to the record.
  <details><summary>Technical</summary>

  `holdPhase(home, {plan, phase, reason})` appends `held`; `releasePhase` appends `released`. The scheduler already drops held phases from running (Build Phase 4); the worktree and branch are kept. Wire the unresolved-conflict hold (Build Phase 7) and the amendment stop (`lib/build/amendment-signal.ts`) to it.

  </details>
- [ ] Make a released phase catch up before it carries on.
  <details><summary>Technical</summary>

  Waits for any active phase it now depends on, merges finished work touching its files and the trunk, then resumes from its stopping point without redoing earlier work.

  </details>

- [ ] Make a hold leave a clean, resumable worktree and say what releases it.
  <details><summary>Technical</summary>

  `holdPhase` commits the worktree as a wip commit on the phase branch, ends the phase's session, then frees its files; `releasePhase` is called by the amendment re-approval and by the resolver answering an unresolved-conflict hold, the only two triggers this plan owns (the decisions-as-questions plan is not built; T41 is reworded to the conflict hold). A release starts a fresh `/work` session in the same worktree, which resumes from the first unchecked item. Test: hold with uncommitted edits to a file another phase then changes; release merges cleanly. (plan review)

  </details>
- [ ] Report the signal for the clause that a hold frees its files, at the first scheduling decision after a hold.
  <details><summary>Technical</summary>

  signal: `a-hold-is-cheap/a-hold-frees-its-files` — reported from `apps/indusk-mcp/src/lib/run/graph/hold-signals.ts`; `holdPhase` marks the hold pending and the driver (Build Phase 12) passes the next scheduler result to `reportHoldFreed`. No waiting reason names the held phase as the holder of a file, the session manager's own sessions hold no session for it, and every phase depending on it still names it. `writeClauseSignals(root, "run-graph.hold", plan, { plan: "run-the-graph", phase: "Build Phase 9" }, verdicts)`; `broken` names the held phase and the phase still waiting on its file, the slot not freed, or the dependent that started. Best-effort.

  </details>
- [ ] Report the signal for the clause that a held phase catches up, when it resumes.
  <details><summary>Technical</summary>

  signal: `a-hold-is-cheap/the-held-phase-catches-up` — reported from `apps/indusk-mcp/src/lib/run/graph/hold-signals.ts`, called by `releasePhase` before the resumed session starts. Judged with git and the record read back: every phase it now depends on has a `done` entry; each finished phase branch whose files overlap its own, and the trunk's tip, are ancestors of its `HEAD`; the wip commit `holdPhase` made is an ancestor too (work kept, not redone). `broken` names the phase and the missing dependency, missing work or lost commit. Best-effort.

  </details>

#### Build Phase 9 Verification

- [ ] The hold tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/hold.test.ts src/lib/run/graph/catch-up.test.ts && pnpm exec vitest related src/lib/run/graph/hold.ts src/lib/run/graph/hold-signals.ts` — T26 and T27 pass.

  </details>

#### Build Phase 9 Context

- [ ] Record, in the package's rules file, that this plan builds the hold state and not its triggers.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "A hold is a `held` entry in the record; what raises one beyond conflicts and amendments belongs to `decisions-as-questions`".

  </details>

#### Build Phase 9 Document

- [ ] Document holds and catching up.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "Holds"; `guide/parallel-plans.md` one paragraph on why a held phase stops blocking files.

  </details>

### Build Phase 10: The trunk follows into every open plan

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 7
**Files**: apps/indusk-mcp/src/lib/run/graph/cascade.ts, apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/run/graph/cascade-signals.ts

This phase makes a landing reach every other open plan: the landing command brings the trunk into each open plan's branch that has no running phase, a five-minute pass catches any landing the event missed, and a plan with a running phase is left alone because that phase merges the trunk itself when it ends. In a workbench the trunk is each repo's own.

- [ ] Call the cascade at the end of a landing.
  <details><summary>Technical</summary>

  `cascadeTrunk` in `lib/run/graph/cascade.ts` using `lib/plans/bring-trunk.ts` and `mergeWithResolution`; skips unapproved and landed plans and plans with a running phase; per-repo trunk in a workbench.

  </details>
- [ ] Add a five-minute pass that catches any branch behind the trunk.
  <details><summary>Technical</summary>

  The interval is a constant (ADR open decision), driven by Build Phase 12; `cascadeTrunk` itself takes its inputs so the pass is testable with an injected clock.

  </details>

- [ ] Cascade plain trunk commits as well as landings.
  <details><summary>Technical</summary>

  T29 gains a case: a commit made directly on the trunk (not a landing) reaches an idle open plan's branch on the five-minute tick. A plan with a running phase is cascaded when its last running phase ends, not only on the next tick. (plan review)

  </details>
- [ ] Report the signal for the clause that open plans follow the trunk, after each cascade and on each five-minute pass.
  <details><summary>Technical</summary>

  signal: `trunk-cascades/branches-follow-the-trunk` — reported from `apps/indusk-mcp/src/lib/run/graph/cascade-signals.ts`, called at the end of `cascadeTrunk`. Read with plain git per repo, not the cascade's own result: for each approved, unlanded plan with no running phase, `git merge-base --is-ancestor <trunk tip> plan/<plan>`; a branch behind for more than five minutes since that trunk commit's time is `broken`, naming the plan and the minutes behind; a cascade that merged into an unapproved, landed or running plan is `broken` too. `writeClauseSignals(root, "run-graph.cascade", plan, { plan: "run-the-graph", phase: "Build Phase 10" }, verdicts)`, one verdict per plan per pass. Best-effort: a signal never fails a landing.

  </details>

#### Build Phase 10 Verification

- [ ] The cascade tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run/graph/cascade.test.ts src/lib/plans/land-own-worktree.test.ts && pnpm exec vitest related src/lib/run/graph/cascade.ts src/lib/run/graph/cascade-signals.ts src/lib/plans/land.ts` — T28 passes; existing landing tests still pass.

  </details>

#### Build Phase 10 Context

- [ ] Record, in the package's rules file, that the trunk is the checkout's branch, per repo.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "The trunk is the branch the project's main checkout is on, per repo in a workbench" — guard: `cascade.test.ts` workbench case.

  </details>

#### Build Phase 10 Document

- [ ] Document the trunk cascade.
  <details><summary>Technical</summary>

  `reference/cli/run-the-graph.md` section "The trunk"; changelog Unreleased entry.

  </details>

### Build Phase 11: A plan lands after the work it pulled

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 6, Build Phase 7
**Files**: apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/plans/land-pulled.test.ts, apps/indusk-mcp/src/lib/plans/land-pulled-signals.ts

This phase makes landing honour what a phase pulled from another plan: the landing command refuses a plan holding another plan's unlanded work, naming that plan, and once that plan has landed the waiting plan merges the trunk again, with that work in it, and runs its tests before it lands.

- [ ] Refuse landing a plan whose record shows pulled work from an unlanded plan.
  <details><summary>Technical</summary>

  `lib/plans/land.ts` reads `pulled` entries (Build Phase 6); the refusal names the source plan; a pulled plan that has since landed does not refuse; a plan with no entry lands as today.

  </details>
- [ ] Merge the trunk again before landing and run the plan's tests on the result.
  <details><summary>Technical</summary>

  Via `mergeWithResolution` (a conflict waits for the resolver); the `pulled` entry is cleared when the plan lands.

  </details>

- [ ] Give workbench plans the same landing rules.
  <details><summary>Technical</summary>

  `landWorkbenchPlan` in `lib/plans/land.ts` reads `pulled` entries, holds `lands-after`, re-merges after a pulled plan lands, and runs the cascade's conflict path. T28 and T30 each gain a workbench case. (plan review)

  </details>
- [ ] Report the signal for the clause that a plan lands after the plans it pulled from, after each landing.
  <details><summary>Technical</summary>

  signal: `landing-follows-what-it-pulled/lands-after` — reported from `apps/indusk-mcp/src/lib/plans/land-pulled-signals.ts`, called by both `landPlan` and `landWorkbenchPlan` after a landing succeeds, before the `pulled` entries are cleared. For each `pulled` entry of the landed plan, the source plan's landing must already be on the trunk, read with a plain `git log <trunk> --merges --format=%s` for its landing subject (not the record). `writeClauseSignals(root, "run-graph.land", plan, { plan: "run-the-graph", phase: "Build Phase 11" }, verdicts)`; `broken` names both plans. Best-effort: a signal never fails the landing.

  </details>
- [ ] Report the signal for the clause that such a plan merges the trunk again before it lands, after each landing.
  <details><summary>Technical</summary>

  signal: `landing-follows-what-it-pulled/merges-again-before-landing` — reported from `apps/indusk-mcp/src/lib/plans/land-pulled-signals.ts`, same point. Each pulled plan's landing commit on the trunk is an ancestor of the landed plan branch's tip (`git merge-base --is-ancestor`); `broken` names the plan and the landing it went without. Best-effort.

  </details>

#### Build Phase 11 Verification

- [ ] The pulled-work tests pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/plans/land-pulled.test.ts && pnpm exec vitest related src/lib/plans/land.ts src/lib/plans/land-pulled-signals.ts` — T29 and T30 pass.

  </details>

#### Build Phase 11 Context

- [ ] Record, in the package's rules file, that landing reads the pulled record.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "Landing reads `pulled` entries from the runner record; a plan lands after the plans it pulled from".

  </details>

#### Build Phase 11 Document

- [ ] Document the landing order rule.
  <details><summary>Technical</summary>

  `reference/cli/plans.md` landing section and `guide/parallel-plans.md`.

  </details>

### Build Phase 12: The driver starts the sessions

**Tier**: strong — joins the scheduler, session manager, merges and record, and decides when each read happens
**Depends on**: Build Phase 4, Build Phase 5, Build Phase 6, Build Phase 8, Build Phase 9, Build Phase 10, Build Phase 11
**Files**: apps/indusk-mcp/src/lib/build/graph-driver.ts, apps/indusk-mcp/src/lib/build/index.ts, apps/indusk-mcp/src/lib/build/build-session.ts, apps/indusk-mcp/src/lib/build/graph-driver-signals.ts, apps/indusk-mcp/src/lib/build/graph-print.ts, apps/indusk-mcp/src/lib/build/graph-print.test.ts

This phase connects the pieces. The driver reads the graph again when a phase ends, a plan is approved or a plan lands, and on a 60-second tick, asks the scheduler what to start, sets up each phase's worktree and launches its session through the session manager; at a phase boundary it still names and runs the next command. It sits beside the manual one-phase path, which keeps working with no driver.

- [ ] Add the driver that reads the graph and launches what the scheduler returns.
  <details><summary>Technical</summary>

  `lib/build/graph-driver.ts` next to `build-session.ts`: `onPhaseEnded`, `onPlanApproved`, `onPlanLanded`, `tick(now)`; each reads the graph afresh, records `graph-read`, calls `pickPhasesToStart`, then `startPhase` and the session manager; setting up the worktree is the phase's own time. After each scheduler call it passes the inputs and result to `reportScheduleSignals` (Build Phase 4) and, after a hold, to `reportHoldFreed` (Build Phase 9).

  </details>
- [ ] Add the 60-second readiness tick and the five-minute trunk pass.
  <details><summary>Technical</summary>

  Constants in the driver (ADR open decision); both injectable clocks.

  </details>
- [ ] Keep the manual path and the phase-boundary command working.
  <details><summary>Technical</summary>

  `next-step.ts` unchanged for a plan with no record; the boundary still prints the command `indusk plans next-session <plan>` gives and the driver runs it.

  </details>
- [ ] Publish the decision record to the docs site.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/run-the-graph.md` from `adr.md`.

  </details>

- [ ] Make the old one-phase-at-a-time build loop stand down for a plan the driver runs.
  <details><summary>Technical</summary>

  `lib/build/next-step.ts` `nextBuildStep`, `build-session.ts` `stepPrompt("work")` and `apps/indusk-admin/src/lib/build-host.ts` `startBuild`: a plan approved with the graph reads one phase per session (prompt names its phase) and the driver starts the ritual steps (audit, falsify, cleanup, retrospective) once the build phases are done. Test: an approved plan is started once, never twice. (plan review)

  </details>
- [ ] Hook the driver to approval and landing, host its ticks, and write the whole record.
  <details><summary>Technical</summary>

  `approve.ts` calls `onPlanApproved`, `land.ts` calls `onPlanLanded`. The ticks (60 seconds for ready phases, five minutes for the trunk cascade, as ADR D3 states) run in the admin's build host, the one long-lived process that exists, not a new scheduler (ADR D3). The driver appends `ready`, `launched`, `done`, `waiting`, `held` and `released` as well as `graph-read`; the scheduler reads `done` from the record. (plan review)

  </details>
- [ ] Print the graph for a plan from the record, through one function the admin also reads.
  <details><summary>Technical</summary>

  `indusk plans graph <plan>` prints each phase's state, why it waits and the ready-to-launched gap, from the record, through `printGraph` in `lib/build/graph-print.ts`; the admin's why-it-waits line reads the same function. T42 holds it. The clauses' signals are the per-clause spans written in the phases that decide them, not a span per record entry. (plan review)

  </details>
- [ ] Report the signal for the clause that ready phases start within a minute, at each launch and on each tick.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/ready-phases-start` — reported from `apps/indusk-mcp/src/lib/build/graph-driver-signals.ts`, called by the driver after each launch and on each 60-second tick. Read from the record read back from disk and the session manager's own session count at the `ready` time: at a launch, `launched` minus `ready`, less the recorded worktree setup time, is under sixty seconds whenever the cap had room; on a tick, a phase `ready` for over a minute with cap room and no `launched` entry (a missed event or a failed launch) is `broken`. `writeClauseSignals(root, "run-graph.driver", plan, { plan: "run-the-graph", phase: "Build Phase 12" }, verdicts)`; `broken` names the phase, its ready time and its launch time or none. Best-effort: a signal never fails the driver.

  </details>
- [ ] Report the signal for the clause that the graph is read again before each launch.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/graph-is-current` — reported from `apps/indusk-mcp/src/lib/build/graph-driver-signals.ts`, at each launch. The latest `graph-read` entry before the `launched` entry must be later than the latest `done` entry, the latest approval (the impl's approval time) and the latest landing (from a plain `git log <trunk> --merges`); a launch with no `graph-read` before it is `broken` too. `broken` names the launch and the event it did not account for. Best-effort.

  </details>
- [ ] Report the signal for the clause that a running phase is never stopped, whenever a phase session ends and on each tick.
  <details><summary>Technical</summary>

  signal: `a-hold-is-cheap/running-phases-finish` — reported from `apps/indusk-mcp/src/lib/build/graph-driver-signals.ts`, called when the session manager reports a phase session ended and on each tick. Read from the session manager's own sessions file, not the driver's state: every phase session that ended has a `done`, a failed-check or a `held` entry for its phase at or after its end; one with none (stopped for a fix, a landing, an approval or an earlier plan, or vanished) is `broken`, naming the phase and what the record shows at its end. Best-effort.

  </details>

#### Build Phase 12 Verification

- [ ] The driver tests, the printout test and the guards pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/build/graph-driver.test.ts src/lib/build/graph-print.test.ts src/lib/build/next-step-boundary.test.ts src/lib/build/manual-path.test.ts && pnpm exec vitest related src/lib/build/graph-driver.ts src/lib/build/graph-driver-signals.ts src/lib/build/graph-print.ts` — T31 and T42 pass; T32 and T33 stay green.

  </details>

#### Build Phase 12 Context

- [ ] Record, in the package's rules file, the two intervals and that the driver holds no state.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` "Run the graph": "60 s readiness tick, 5 min trunk pass, constants; the driver reads files and the record each time" — guard: `graph-driver.test.ts` carries `clause: the-work-runs-as-a-graph/graph-is-current`.

  </details>

#### Build Phase 12 Document

- [ ] Finish the reference page and the person's guide page.
  <details><summary>Technical</summary>

  Complete `reference/cli/run-the-graph.md`; `guide/parallel-plans.md`; update `reference/skills/planner.md` (the two lines, cutting phases small around shared types and schemas) and changelog.

  </details>

### Build Phase 13: Live checks and the review phases

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 1, Build Phase 12
**Files**: apps/indusk-mcp/src/__tests__/run-graph.live.test.ts, apps/indusk-mcp/vitest.tiers.ts, apps/indusk-mcp/skills/falsify.md, apps/indusk-mcp/skills/cleanup.md, apps/indusk-mcp/skills/planner.md

This phase writes the eight whole-story checks that run against real git and real sessions, in the system tier and never in a phase's loop, and teaches the falsify, cleanup and planner skills to write the dependency line on the phases they author. It closes the build.

- [ ] Write the eight live checks against real git and real session processes, with the agent replaced by a scripted process.
  <details><summary>Technical</summary>

  `src/__tests__/run-graph.live.test.ts` (T34 to T41), added to `SYSTEM` in `vitest.tiers.ts`; the scripted agent keeps the build free of model calls and unattended (Notes). They prove no clause; their results are recorded in the retrospective.

  </details>
- [ ] Teach the ritual skills to write the dependency and files lines.
  <details><summary>Technical</summary>

  Edit `apps/indusk-mcp/skills/{falsify,cleanup,planner}.md` (never `.claude/skills/`); falsify and cleanup phases carry `**Depends on**:` naming the build phases they review.

  </details>
- [ ] Run the live checks once and record the result in the plan.
  <details><summary>Technical</summary>

  `pnpm test:system -- run-graph.live` — result written under Notes with the date.

  </details>

- [ ] Make the three skills and the planner write both lines on every phase.
  <details><summary>Technical</summary>

  The `/work` skill's phase check refuses a changed file outside the phase's declared set (ADR D2). Falsify, cleanup and planner templates write `**Depends on**:` and `**Files**:` on every phase they author; the audit step is not a phase and keeps writing `audit.md`. A template that omits `**Files**:` is caught by the save check. (plan review)

  </details>

#### Build Phase 13 Verification

- [ ] The live checks pass in the system tier.
  <details><summary>Technical</summary>

  `pnpm test:system -- run-graph.live` from the repo root — T34 to T41 pass; the everyday suite does not include the file (`everyday-tests-never-wait.test.ts` passes).

  </details>
- [ ] The installed skills match the package's.
  <details><summary>Technical</summary>

  `indusk sync` shows no diff for the three skills.

  </details>

#### Build Phase 13 Context

- [ ] Record, as a guard, where the live checks run.
  <details><summary>Technical</summary>

  guard: `run-graph.live.test.ts` listed in `vitest.tiers.ts` SYSTEM and carries `lesson: feedback-slow-at-release-fast-per-phase`.

  </details>

#### Build Phase 13 Document

- [ ] Note in the falsify and cleanup reference pages that the phases they write name their dependencies.
  <details><summary>Technical</summary>

  `reference/skills/falsify.md` and `reference/skills/cleanup.md`.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/run/graph/{declarations,record,read-graph,schedule,phase-branch,conflict,merge-into-plan,hold,cascade}.ts` | new: the graph, record, scheduler, branches, merges, holds, trunk cascade |
| `apps/indusk-mcp/src/lib/run/graph/{read-graph,schedule,phase-branch,conflict,merge,hold,cascade}-signals.ts`, `src/lib/plans/land-pulled-signals.ts`, `src/lib/build/graph-driver-signals.ts` | new: one clause signal per decision, beside the code that decides it |
| `apps/indusk-mcp/src/lib/build/graph-driver.ts`, `graph-print.ts` | new: event and tick driver; the graph printout |
| `apps/indusk-mcp/src/lib/session/manager.ts` | session identity is plan, kind and phase |
| `apps/indusk-mcp/src/lib/plans/land.ts`, `test-set.ts` | refuse phase refs and unlanded pulled work; touched-clause test set |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | refuse bad dependency lines |
| `apps/indusk-mcp/skills/{falsify,cleanup,planner}.md` | write the dependency line |
| `apps/indusk-mcp/vitest.tiers.ts`, `src/__tests__/run-graph.live.test.ts` | live checks in the system tier |
| `apps/indusk-mcp/CLAUDE.md`, `CLAUDE.md` | "Run the graph" rules; Key Decisions line |
| `apps/docs/src/{reference/cli/run-the-graph.md,guide/parallel-plans.md,decisions/run-the-graph.md,changelog.md}` | documentation |
| `.indusk/promises/a-session-belongs-to-its-plan.md` | sentence changed by `promises change` |

## Dependencies
- `plans-are-promises` (clauses) and `mark-first` (signals) built; the brief's Depends On.
- Node 22; real git; no daemon or server for the everyday suite.

## Notes

Decisions made unattended (gate policy auto), each with its reason:

- **gate_policy is `ask`**, so every gate above has a real item. `otel.role` is `library`, so no OTel gate is written; each split and limit clause instead gets a signal task in the phase that builds the code deciding it, one `writeClauseSignals` span per decision through the commands' tracer, best-effort, judged from a source the deciding code does not read (plain git, a plain scan of the impl, the session manager's own sessions). The two resting clauses (`within-the-cap`, `never-interrupted`) need none: each is read through the promise it rests on.
- **Live checks prove no clause.** They run only after landing, while a clause must be proved by tests that pass at close; each live row names the unit rows that prove its clause, and its result is recorded in the retrospective.
- **Effort in the tier stays out.** `research.md`'s proposed shape has no promise and no test-plan row; building it would add behaviour no promise names (ADR open decision). Its three open questions wait with it.
- **The live checks use a scripted agent process, not a model.** Reason: a build that runs unattended and cheaply cannot spend model calls; real model-resolved conflicts are the Deferred Verification above, read from the record.
- **This impl's own `**Depends on**:` and `**Files**:` lines are dogfood.** They are ordinary text to today's checks and take effect once Build Phase 1 lands; the intended graph is: Phases 1, 2 and 5 start at once; 3 after 1 and 2; 4 after 3; 6 after 1 and 2; 7 after 6; 8 after 6 and 7; 9, 10 and 11 follow; 12 joins; 13 closes. Each phase's signal file is its own, so no two phases share one. Reason: show the shape the plan defines.
- **A conflict at phase start (A29) is tested in Build Phase 7**, because Build Phase 6 only names the resolver type and tests with a stub.
- **"Touched" for the merge check is rows' `For` clauses plus `promise:` tokens in changed files** (ADR D6); no further choice made here.
- **Falsification, cleanup and audit phases** are authored later by their rituals, with `**Depends on**:` lines; none is written now.
- Live check result: (recorded by Build Phase 13).
