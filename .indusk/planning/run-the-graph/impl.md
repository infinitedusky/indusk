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

Slice 1: within one approved plan, every phase whose dependencies are done runs at once, each in its own worktree on its own branch, and joins the plan's branch only when its tests and the plan's touched clauses' tests pass. Brief: [brief.md](brief.md). Assertions: [test-plan.md](test-plan.md) (A1 to A44). Decisions D1 to D10: [adr.md](adr.md). Rewritten for the slice on 2026-10-19; the thirteen-phase version is in this file's history at commit `0842d3fdf`.

## Scope

### In Scope
- The two label lines on a phase, their defaults and their refusal at save; the incident writer and the falsify, cleanup and planner skills writing them.
- The graph read from the plan's branch, and the pure scheduler.
- Sessions identified by plan, kind and phase; every phase session counted against the cap; a run record that keeps each phase's process; Dawn's `indusk run` refusing a plan the graph is building.
- Phase branches and worktrees, cut once and resumed after, set up as `indusk worktree create` sets one up.
- The checked fast-forward of a finished phase into its plan, its retries and stops; landing refusing phase branches and plans with unmerged phases.
- The graph as the build's work step inside the admin, its tick, a question holding the whole plan, resume after an admin restart, and a terminal approval asking the admin to build.
- One signal per split and limit clause, beside the code that decides it.

### Out of Scope
- Everything the brief lists as Not promised: two plans sharing a file, plan order, fix-first, the trunk cascade, per-phase holds, seeing the graph, re-cutting phases, the workbench server.
- Workbench plans: they build one phase at a time as today — the brief's promise sentence excludes them and its Not promised list names them (Sandy, 2026-10-19); ADR decision D4.
- Effort in the tier (`research.md`'s proposed shape): no promise names it.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `lib/graph/declarations.ts` (`readDeclarations`, `phaseKey`, `fileSetsOverlap`); `hooks/_phase-depends.js`; `lib/graph/read-graph.ts` (`readGraph`, `Graph`, `PhaseNode`); `read-graph-signals.ts`; save-check refusal; `check-gates.js` judging by dependencies and holding a session to its phase; incident writer and skills write the lines | `lib/models/tiers.ts` label parsing, `fencedLineMask`, `next-step.ts` `isOpen`, `hooks/_impl-headings.js` |
| Build Phase 2 | `lib/graph/schedule.ts` (`pickPhasesToStart`, waiting reasons); `schedule-signals.ts` | Build Phase 1 types |
| Build Phase 3 | session identity and cap per phase in `lib/session/manager.ts`; `phases` in the run record and liveness; `indusk run` refusal | existing manager, `lib/run-record/` |
| Build Phase 4 | `lib/graph/phase-branch.ts` (`startPhase`: cut or resume); `lib/worktree/provision.ts` (`provisionWorktree`); `phase-branch-signals.ts` | `lib/worktree/layout.ts`, `bin/commands/worktree.ts` |
| Build Phase 5 | `lib/graph/merge.ts` (`mergePhase`); `lib/graph/record.ts`; the `merge` scope of `planTestSet`; landing refusals; `merge-signals.ts` | Build Phases 1 and 4; `lib/plans/test-set.ts`, `lib/plans/land.ts` |
| Build Phase 6 | `lib/build/graph-run.ts` (the work step, one launcher, the merge queue); the one-phase work prompt; admin host wiring, resume on start, answers kept; `askAdminToBuild`; phase lines; `graph-run-signals.ts`; the live check | Build Phases 2, 3, 5; `runBuild`, `build-session.ts`, `build-host.ts`, `judgement.ts` |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | Phases naming dependencies show exactly those; phases naming none depend on the one before; the first depends on nothing; every build phase depends on Test Phase 1 when there is one (A1, A2) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/lib/graph/declarations.test.ts |
| T2 | An impl naming a missing phase, itself, or a loop is refused at save naming the phase; `Phase 6` and `Build Phase 6` name one phase under either heading form; the hook's reader and the package's agree (A3) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/__tests__/depends-on-refused.test.ts |
| T3 | Falsification, Cleanup, Audit and Maintenance phases are nodes with their declared dependencies and files; the steps that write them are not (A19) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/graph/read-graph.test.ts |
| T4 | A draft plan has no node; an approved, in-progress, or completed-with-an-open-phase plan has its open phases; a phase closed on the plan's branch is done (A38) | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/lib/graph/read-graph-status.test.ts |
| T5 | The incident writer gives a Maintenance phase a dependency line naming no phase and a files line from the promise's declared paths (A21) | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/promises/reopen-declarations.test.ts |
| T6 | Independent phases are picked together; a dependent one only once its last dependency is done; a ready phase is not picked while the cap is full (A4, A5) | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/graph/schedule-ready.test.ts |
| T7 | A phase waits only for a dependency, a running phase of its plan sharing a file, the cap, a question, or its own judgement or blocker, and its reason says which; an undeclared phase shares with every phase of its plan, so two undeclared phases never run together; only the impl is exempt, the changelog and a docs page count; two phases freed together never take one file (A11 to A14) | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/lib/graph/schedule-wait.test.ts |
| T8 | With the cap at one and phases naming nothing, the order equals today's one-phase-at-a-time build (A15) | Build Phase 2 | Build Phase 2 | planned | unit | a regression guard: the zero-migration claim of the dependency clause | apps/indusk-mcp/src/lib/graph/chain-parity.test.ts |
| T9 | A plan's second phase session starts while its first runs; a second session on the same phase is refused naming the first (A36) | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager-parallel.test.ts |
| T10 | An admitted build's place covers one of its sessions; each further phase session takes its own place; a session beyond the cap is refused (A18) | Test Phase 1 | Build Phase 3 | planned | unit | promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/cap-per-phase.test.ts |
| T11 | A build run record keeps each running phase's process and reads running while any is alive; a record without phases still reads (A37) | Test Phase 1 | Build Phase 3 | planned | unit | a regression guard: a-run-is-read-from-its-record, which one process per run breaks once phases run together | apps/indusk-mcp/src/lib/run-record/record-phases.test.ts |
| T12 | `indusk run` refuses a plan the admin is building with the graph, naming the build (A20) | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/run/refuse-graph-run.test.ts |
| T13 | Two running phases sit in two worktrees on two `phase/<plan>/<kind>-<n>` branches cut from the plan's branch, and one's work is not in the other's worktree; Test Phase 2 and Build Phase 2 get different branches, and Build Phase 1 after a merged Test Phase 1 is cut fresh (A22) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/graph/phase-worktree.test.ts |
| T14 | A phase started again reuses its worktree and branch with its commits; a branch whose worktree is gone gets it back from the branch, never a fresh cut (A23) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/graph/phase-resume.test.ts |
| T15 | A phase worktree and `indusk worktree create` run the same setup through one function; with no setup steps the lockfile's install runs; a failed step stops the phase naming it (A24) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/worktree/provision.test.ts |
| T16 | A phase depending on two merged phases starts with both phases' files (A25) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/starts-from-its-dependencies | apps/indusk-mcp/src/lib/graph/phase-start.test.ts |
| T17 | Phases branch from the plan's branch, never the trunk (A39) | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/graph/phase-worktree.test.ts |
| T18 | A green phase is fast-forwarded into the plan and the plan's worktree shows its files; a phase green alone but red once the plan is merged in is not merged and is sent back naming the tests; of two that break only together the first stays merged (A27, A28) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/merge.test.ts |
| T19 | The merge scope's real selection on a fixture plan picks the phase's tests that pass at it, every clause named by a done phase's row or by a token in a changed file, and the Must-not-break tests; it leaves out rows not yet written and a row written at a done phase that passes only at a later one (A29) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/plans/test-set-merge.test.ts |
| T20 | A red check, a conflict outside the impl or a dirty worktree sends the phase back told why; the third failure stops it with its reason, its dependents wait, other phases go on (A30) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/merge-failed.test.ts |
| T21 | Two phases ticking boxes and filling result cells on neighbouring impl lines merge with no session involved (A31) | Build Phase 5 | Build Phase 5 | planned | unit | parallel phases' impl ticks must never become a session's conflict (ADR decision D6) | apps/indusk-mcp/src/lib/graph/merge-impl-lines.test.ts |
| T22 | A phase that ran no test, or only deferred rows, is not merged; one touching a clause with no signal task in it or a done phase is not merged, naming the clause; one with both merges (A32, A33) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/every-phase-is-checked | apps/indusk-mcp/src/lib/graph/merge-checked.test.ts |
| T23 | Merged work is on the plan's branch, not the trunk, until landing; landing a phase branch is refused naming its plan; a plan with a phase running or stopped unmerged is refused naming them (A34, A35) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/only-the-plan-lands | apps/indusk-mcp/src/lib/graph/only-the-plan-lands.test.ts |
| T24 | The work step, with stand-in sessions, starts Phases 1 and 3 of the six-phase plan at once; a phase's end merges it and launches what waited only for it; Phase 5 starts once 2 and 3 have joined; the step returns when no phase is open (A4, A7) | Build Phase 6 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/graph-run.test.ts |
| T25 | With the real session manager and a stand-in process, a plan's second phase gets its own session, and one beyond the cap is refused and launched when a session ends (A6) | Build Phase 6 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/graph-run-launch.test.ts |
| T26 | Each phase end is followed by a fresh read before a launch; the tick launches a phase whose end event was missed; a merge whose check never returns holds up no launch the cap has room for; two phases ending together merge one after the other and their dependent starts once; a tick during a phase end starts each ready phase once (A16, A17) | Build Phase 6 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/graph-is-current | apps/indusk-mcp/src/lib/build/graph-run-current.test.ts |
| T27 | A terminal approval launches nothing, asks the running admin to build, and says plainly when the admin is not running (A8) | Build Phase 6 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/plans/ask-admin-build.test.ts |
| T28 | After an admin restart the admin resumes the build the restart ended with nobody pressing Build: a phase whose session was ended is launched again in its own worktree; one whose worktree shows it finished goes straight to its merge; a build stopped on a recorded stop is not resumed (A9) | Build Phase 6 | Build Phase 6 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/build/graph-run-restart.test.ts |
| T29 | Ritual steps start only once every phase is done; a phase a step writes is run by the graph before the next step (A44) | Build Phase 6 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/build/graph-run-rituals.test.ts |
| T30 | A phase session stopping on a question that holds holds the plan: nothing new launches, running phases finish and merge, the step ends on the question, and the answer resumes the asking phase in its worktree; an answer given while other phases are finishing is not refused as already building, resumes the asking phase in the same run, and leaves no answered question held (A41) | Build Phase 6 | Build Phase 6 | planned | unit | promise: the-cost-sets-the-wait | apps/indusk-mcp/src/lib/build/graph-run-question.test.ts |
| T31 | The build shows each phase as running, waiting on what, or stopped and why, through one function over the run record; the shown-phase check compares each running phase (A26) | Build Phase 6 | Build Phase 6 | planned | unit | a display guard: the one place a person sees the phases (brief story 6) | apps/indusk-mcp/src/lib/run-record/phase-lines.test.ts |
| T32 | A phase boundary still names the command for what runs next (A40) | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/build/next-step-boundary.test.ts |
| T33 | The manual one-phase `/work` path gives the same next step as today when no graph run is active (A43) | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: the graph is added beside the manual path | apps/indusk-mcp/src/lib/build/manual-path.test.ts |
| T34 | A held question still frees its plan's place and resumes on the answer (A42) | Test Phase 1 | Test Phase 1 | planned | unit | promise: the-cost-sets-the-wait | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T35 | A real plan with two independent phases and a dependent third, built from the admin's host with a scripted agent, runs the two at once and ends with all three on the plan's branch (A10) | Build Phase 6 | Build Phase 6 | planned | live check | a live check run at landing and release, recorded in the retrospective; the clauses it touches are proved by the unit rows | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |
| T36 | In a phase's own worktree the gate hook lets its items be ticked while an earlier phase it does not depend on is open, refuses while a phase it depends on is open, and with no dependency lines refuses as today (A46) | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/__tests__/check-gates-depends.test.ts |
| T37 | With a session's phase set, the gate hook refuses ticking an item of any other phase, naming the session's phase (A47) | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/__tests__/check-gates-session-phase.test.ts |
| T38 | A phase session's work prompt names its one phase and says to work only it, its environment names the phase, and a session sent back after a failed merge is told why (A47) | Test Phase 1 | Build Phase 6 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/work-prompt-phase.test.ts |
| T39 | A ready phase carrying a blocker or an item a person must judge is not launched, other phases go on, and the step then stops on that judgement or blocker (A48) | Build Phase 6 | Build Phase 6 | planned | unit | a regression guard: a-build-runs-to-review-unasked stops for a judgement the plan declared, which the graph must keep for every phase | apps/indusk-mcp/src/lib/build/graph-run-judgement.test.ts |
| T40 | A test phase merges when its own rows pass and each row it writes for a later phase fails on its own assertion; a row whose file does not load refuses the merge, naming it (A49) | Build Phase 5 | Build Phase 5 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/merge-test-phase.test.ts |

### Deferred Verification

- **A plan finishing in about the time of its longest chain** (the brief's expectation)
  - reason: real phases' durations over hours or days cannot be compressed into a test.
  - would require: the next plan with independent phases run to review.
  - mitigation: read from the launch and merge times in the graph record when that plan reaches review.

## Checklist

### Test Phase 1: Author what can be authored, record what cannot

**Tier**: med — the step's default tier for work

This phase writes the tests whose subjects already exist — the session rule, the cap, the run record, the incident writer, the gate hook and the work prompt that must change, and the phase-boundary command, the manual path and the question slot rule that must not — and records, with a body, every test that waits for a module a later phase creates. It hands the build phases red tests to turn green and a register to check each later test against.

- [ ] Confirm this plan's worktree exists and is the one in use.
  <details><summary>Technical</summary>

  `indusk worktree create run-the-graph` (or `indusk worktree assign run-the-graph <path>` for one made another way). No `worktree: none` in frontmatter.

  </details>
- [ ] Write the session-rule and cap tests so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T9 `apps/indusk-mcp/src/lib/session/manager-parallel.test.ts`: build session on plan `p` phase `Build Phase 1`, then one on `Build Phase 2` must start (RED: refused as the same kind on the same plan); a second on `Build Phase 1` refused naming the first (green). T10 `cap-per-phase.test.ts`: cap 4, `admitBuild("x", "p")`, three phase sessions of `p` and one session of plan `q` — the fourth start is refused at the cap (RED: today the second `p` session is refused as a duplicate, and admitted builds' sessions are all exempt). Pass `phase` in the start options with a cast until Build Phase 3 types it.

  </details>
- [ ] Write the run-record test and the incident-writer test so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T11 `lib/run-record/record-phases.test.ts`: a build record with `process: null` and `phases: [{ phase: "Build Phase 2", process: <this test's own pid> }]` reads `running` from `runStatus` (RED: liveness reads only `process`); a record with no `phases` reads as today. T5 `lib/promises/reopen-declarations.test.ts`: `reopenOwner` for a promise declaring `sites: [src/a.ts]` writes `**Depends on**: none` and `**Files**: src/a.ts` under the new Maintenance heading (RED: neither is written).

  </details>
- [ ] Write the gate-hook and work-prompt tests so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T36 `src/__tests__/check-gates-depends.test.ts`, through `gateTransition` from `__tests__/helpers/hook-runner.ts`: an impl where Build Phase 3 says `**Depends on**: none` and Build Phase 1 is open — ticking a Build Phase 3 implementation item exits 0 (RED: refused today, "complete Build Phase 1 gates first"); with Build Phase 3 depending on Build Phase 1 it is refused; an impl with no dependency lines is refused as today. T37 `src/__tests__/check-gates-session-phase.test.ts`: with `INDUSK_BUILD_PHASE=Build Phase 3`, ticking a Build Phase 1 item exits 2 naming Build Phase 3 (RED: allowed today). T38 `src/lib/build/work-prompt-phase.test.ts`: `stepPrompt("work", "p", …)` given phase `Build Phase 3` names it and says to work only that phase; `stepEnv` for it carries `INDUSK_BUILD_PHASE`; a retry note appears in the prompt (RED: the prompt says to work the open phases in order). Pass the phase with a cast until Build Phase 6 types it.

  </details>
- [ ] Write the two guard tests for what must not change, and confirm the question slot test passes.
  <details><summary>Technical</summary>

  T32 `lib/build/next-step-boundary.test.ts`: a finished phase's boundary names the command `indusk plans next-session <plan>` gives. T33 `lib/build/manual-path.test.ts`: a plan with no graph record yields the same `nextBuildStep` answer as today. T34 is the existing `lib/session/question-wait.test.ts`, green; it must stay green.

  </details>
- [ ] Record each later test in the register below and confirm none fails only on a missing file.
  <details><summary>Technical</summary>

  Every other row imports a module a later phase creates, so it is deferred with a body; none uses `.skip()`.

  </details>

#### Deferred to Build Phase 1

- **T1**, **T2**, **T3**, **T4** — import `readDeclarations` and `readGraph`, and the refusal the save check gains, all introduced in Build Phase 1. Body reviewed:

  ```typescript
  const d = readDeclarations(sixPhaseImpl); // P1, P3 none; P2 "Build Phase 1"; P5 "Build Phase 2, Build Phase 3"
  expect(d.dependsOn("Build Phase 5")).toEqual(["Test Phase 1", "Build Phase 2", "Build Phase 3"]);
  expect(readDeclarations(unlabelledImpl).dependsOn("Build Phase 2")).toEqual(["Test Phase 1", "Build Phase 1"]);
  expect(runValidator(implWith("**Depends on**: Build Phase 9")).message).toContain("Build Phase 9");
  const g = readGraph(planWorktree); // impl in-progress, Build Phase 1 ticked, a Falsification phase open
  expect(g.node("Build Phase 1")).toBeUndefined(); // done
  expect(g.node("Build Phase 7")?.dependsOn).toEqual(["Build Phase 6"]); // heading `### Phase 7: Falsification — …`
  expect(phaseKey("Phase 6")).toBe("Build Phase 6");
  ```

#### Deferred to Build Phase 2

- **T6**, **T7**, **T8** — import `pickPhasesToStart`, introduced in Build Phase 2. Body reviewed:

  ```typescript
  const r = pickPhasesToStart({ graph, running: [], waitingOnQuestion: false, room: 4 });
  expect(r.start.map((p) => p.phase)).toEqual(["Build Phase 1", "Build Phase 3"]);
  expect(r.waiting.find((w) => w.phase === "Build Phase 2")?.reason).toEqual({ kind: "dependency", on: "Build Phase 1" });
  ```

#### Deferred to Build Phase 3

- **T12** — imports the refusal Build Phase 3 adds to `indusk run`. Body reviewed:

  ```typescript
  writeRunRecord(home, { ...startRunRecord("p", "build", now), phases: [{ phase: "Build Phase 1", process: alive }] });
  await expect(runPlan(root, "p")).rejects.toThrow(/being built by the admin/);
  ```

#### Deferred to Build Phase 4

- **T13** to **T17** — import `startPhase` and `provisionWorktree`, introduced in Build Phase 4; they use real throwaway git repositories. Body reviewed:

  ```typescript
  const a = await startPhase(repo, "p", "Build Phase 1", { provision: noop });
  const b = await startPhase(repo, "p", "Build Phase 3", { provision: noop });
  expect(a.worktree).not.toBe(b.worktree);
  expect(await tip(a.branch)).toBe(await tip("plan/p"));
  expect(a.branch).toBe("phase/p/build-1");
  expect((await startPhase(repo, "p", "Test Phase 1", { provision: noop })).branch).toBe("phase/p/test-1");
  await commitIn(a.worktree, "wip.ts");
  const again = await startPhase(repo, "p", "Build Phase 1", { provision: noop });
  expect(await tip(again.branch)).toBe(await tip(a.branch)); // resumed, not re-cut
  ```

#### Deferred to Build Phase 5

- **T18** to **T23**, **T40** — import `mergePhase` and the `merge` test-set scope, introduced in Build Phase 5. Body reviewed:

  ```typescript
  const r = await mergePhase({ repo, plan: "p", phase: "Build Phase 3", run: fixtureRunner });
  expect(r.outcome).toBe("merged");
  expect(existsSync(join(planWorktree, "src/three.ts"))).toBe(true);
  const set = planTestSet(readsOf(fixturePlan), { merge: { phase: build(3), done: [build(1)], changed } });
  expect(set.files.map((f) => f.path)).toContain("src/clause-a.test.ts"); // For: clause on a Build Phase 1 row
  expect(set.files.map((f) => f.path)).not.toContain("src/later.test.ts"); // written at Test Phase 1, passes at Build Phase 4
  const t = await mergePhase({ repo, plan: "p", phase: "Test Phase 1", run: realRunner });
  expect(t.outcome).toBe("merged"); // its later rows fail on their assertions
  ```

#### Deferred to Build Phase 6

- **T24** to **T31**, **T35**, **T39** — import the graph work step, `askAdminToBuild` and the phase lines, introduced in Build Phase 6; T35 is a system-tier test. Body reviewed:

  ```typescript
  const manager = new SessionManager({ start: standIn, max: 4 });
  const step = runGraphStep(depsWith(manager, sixPhasePlan));
  await until(() => running(manager, "p").length === 2);
  expect(running(manager, "p").map((s) => s.phase)).toEqual(["Build Phase 1", "Build Phase 3"]);
  finish(manager, "Build Phase 1"); // stand-in ticks its boxes and commits
  await until(() => running(manager, "p").some((s) => s.phase === "Build Phase 2"));
  expect(await askAdminToBuild(cwd, "p", downDeps)).toMatch(/admin is not running/);
  ```

#### Regression Guards

- **T32** — the boundary command is right today; the row keeps the graph from changing what a boundary names.
- **T33** — the manual path works today; the row keeps the graph beside it, not instead of it.
- **T34** — the held-question slot rule holds today; the row keeps it holding once sessions carry a phase.

#### Test Phase 1 Verification

- [ ] The session-rule and cap tests exist and fail on their own assertions, not on a missing file.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager-parallel.test.ts src/lib/session/cap-per-phase.test.ts` — T9 fails because the second phase's start is refused; its same-phase case is green; T10 fails on its refusal assertion.

  </details>
- [ ] The run-record and incident-writer tests exist and fail on their own assertions.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run-record/record-phases.test.ts src/lib/promises/reopen-declarations.test.ts` — T11 reads `stopped` where it expects `running`; T5 finds no dependency line.

  </details>
- [ ] The gate-hook and work-prompt tests exist and fail on their own assertions.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/__tests__/check-gates-depends.test.ts src/__tests__/check-gates-session-phase.test.ts src/lib/build/work-prompt-phase.test.ts` — T36 fails because the independent phase's tick is refused (its dependent-phase and no-lines cases are green); T37 fails because the other phase's tick is allowed; T38 fails because the prompt names no phase.

  </details>
- [ ] The guard tests pass today.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/build/next-step-boundary.test.ts src/lib/build/manual-path.test.ts src/lib/session/question-wait.test.ts` — T32, T33, T34 green.

  </details>
- [ ] Every deferred body above has been read and judged.
  <details><summary>Technical</summary>

  Each body checked against two questions: will it load at the phase it names, and does it assert what its row claims?

  </details>

#### Test Phase 1 Context

- [ ] Record that the graph's tests use real throwaway git repositories and stand-in sessions, delivered by the tests themselves.
  <details><summary>Technical</summary>

  guard: the graph tests carry `lesson: code-that-decides-takes-its-clock-and-its-reads` and `lesson: everyday-tests-never-wait`; no CLAUDE.md text is needed for this phase.

  </details>

#### Test Phase 1 Document

- [ ] Add an Unreleased changelog line saying the session and record tests were written first.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, Unreleased: "Tests: the per-phase session, cap and run-record rules are written before the graph."

  </details>

### Build Phase 1: Phases say what they need, and the plan reads as a graph

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/graph/declarations.ts, apps/indusk-mcp/src/lib/graph/declarations.test.ts, apps/indusk-mcp/src/lib/graph/read-graph.ts, apps/indusk-mcp/src/lib/graph/read-graph.test.ts, apps/indusk-mcp/src/lib/graph/read-graph-status.test.ts, apps/indusk-mcp/src/lib/graph/read-graph-signals.ts, apps/indusk-mcp/src/__tests__/depends-on-refused.test.ts, apps/indusk-mcp/src/__tests__/declarations-parity.test.ts, apps/indusk-mcp/hooks/_phase-depends.js, apps/indusk-mcp/hooks/validate-impl-structure.js, apps/indusk-mcp/hooks/check-gates.js, apps/indusk-mcp/src/__tests__/check-gates-depends.test.ts, apps/indusk-mcp/src/__tests__/check-gates-session-phase.test.ts, apps/indusk-mcp/src/lib/promises/reopen.ts, apps/indusk-mcp/src/lib/promises/reopen-declarations.test.ts, apps/indusk-mcp/skills/falsify.md, apps/indusk-mcp/skills/cleanup.md, apps/indusk-mcp/skills/planner.md, CLAUDE.md, apps/docs/src/guide/phases-in-parallel.md, apps/docs/src/reference/skills/planner.md, apps/docs/src/reference/skills/falsify.md, apps/docs/src/reference/skills/cleanup.md

This phase gives every phase of an impl two optional lines — the phases it needs and the files it writes — and reads a plan's open phases from its branch as a graph. A phase with no dependency line still depends on the one before it, so every existing plan runs as a chain. A bad line is refused when the impl is saved, and the phases the incident writer and the review rituals author carry both lines. The gate hook learns the same lines, so a phase working in its own worktree is judged only against the phases it needs, and a phase session cannot tick another phase's boxes. Everything after this reads phases through what this phase builds.

- [ ] Read the dependency line and the files line under each phase heading, with the default chain.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/graph/declarations.ts`: `readDeclarations(implText)` parsed as `**Tier**:` is (`lib/models/tiers.ts`, outside fences by `fencedLineMask`, a second line is an error). `phaseKey(name)`: `Test Phase N` or `Build Phase N` from a heading or a line, `Phase N` → `Build Phase N`, the words after the colon dropped (ADR D1). `dependsOn(phase)`: the named phases, `none` → nothing, no line → the phase before (the first: nothing); every build phase gains `Test Phase 1` when the impl has one. `files(phase)`: declared paths and globs, or `undeclared`. `fileSetsOverlap(a, b)` ignores only `.indusk/planning/<plan>/impl.md`; the changelog, `CLAUDE.md` files and docs pages count; an undeclared set overlaps every other set, declared or undeclared.

  </details>
- [ ] Refuse, when an impl is saved, a dependency on a phase that does not exist, on itself, or in a loop, naming the phase.
  <details><summary>Technical</summary>

  Read `apps/indusk-mcp/hooks/CLAUDE.md` first. New shared hook module `hooks/_phase-depends.js` (beside `_impl-headings.js`) mirrors `declarations.ts` (a hook cannot import `.ts`); `validate-impl-structure.js` uses it, and `src/__tests__/declarations-parity.test.ts` feeds both the same forms (`none`, a fenced block, a missing line, a list, `Phase 6` against `### Build Phase 6:`) and asserts equal results. T2.

  </details>
- [ ] Make the gate hook judge a phase against the phases it depends on, and refuse a phase session's tick of another phase.
  <details><summary>Technical</summary>

  `hooks/check-gates.js`: the implementation-item loop (today "every phase earlier in the document", line 535) and Gates A and B (lines 441–515) take the advancing phase's dependencies, direct and through them, from `_phase-depends.js`, in place of every earlier ordinal; with no dependency lines that set is every earlier phase, so behaviour is unchanged. When `INDUSK_BUILD_PHASE` is set, a newly checked item of any other phase exits 2 naming the session's phase. T36, T37.

  </details>
- [ ] Read a plan's open phases from its branch as a graph, admitting approved, in-progress and completed plans with open phases.
  <details><summary>Technical</summary>

  `lib/graph/read-graph.ts`: `readGraph(planWorktree, plan)` reads `impl.md` in the plan's worktree (on `plan/<plan>`); a phase closed there (`isOpen` from `lib/build/next-step.ts`) is done; nodes are open phases `{ phase, dependsOn, files, position, isReview, judgement, blocker }`, `phase` being its `phaseKey`, `judgement` the items `detectHumanGate` (`lib/build/judgement.ts`) finds and `blocker` the phase's blocker line. Status `approved`, `in-progress`, or `completed` with an open phase is read; a draft gives an empty graph (ADR D2). Falsification, Cleanup, Audit and Maintenance phases are ordinary nodes; no step is a node. T1, T3, T4.

  </details>
- [ ] Make the incident writer and the falsify, cleanup and planner skills write both lines on the phases they author.
  <details><summary>Technical</summary>

  `lib/promises/reopen.ts` (`reopenOwner`, both `maintenancePhase` shapes): `**Depends on**: none` and `**Files**:` from the promise's `sites:`. Edit `apps/indusk-mcp/skills/{falsify,cleanup,planner}.md` (never `.claude/skills/`): falsify and cleanup phases name the build phases they review; the planner writes both lines when it cuts phases, cutting small around shared types and schemas. T5 turns green.

  </details>
- [ ] Add the root Key Decisions line for this plan.
  <details><summary>Technical</summary>

  `CLAUDE.md` Key Decisions: "Run the graph (slice 1): a phase declares `**Depends on**:` and `**Files**:`; the admin's build runs a plan's ready phases at once on `phase/<plan>/<n>` branches and fast-forwards each into the plan after a green check — see `/decisions/run-the-graph`". Written here because the plan's branch may change nothing outside `.indusk/` before its build.

  </details>
- [ ] Report the signal for the clause that each phase names what it needs, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/a-phase-names-what-it-needs` — reported from `apps/indusk-mcp/src/lib/graph/read-graph-signals.ts`, called by `readGraph` after it builds the nodes. Judged against the impl text, not `readDeclarations`: a plain scan of headings and `**Depends on**:` lines outside fences gives the expected list (the named phases, nothing for `none`, the phase before when absent, nothing for the first, plus `Test Phase 1` when present); each node's `dependsOn` must equal it, and a name the scan does not find among the headings, or a loop, is `broken`. `writeClauseSignals(root, "run-graph.read", plan, { plan: "run-the-graph", phase: "Build Phase 1" }, verdicts)` from `lib/promises/clause-signal.ts`; `broken` names the plan, the phase and both lists. Best-effort.

  </details>
- [ ] Report the signal for the clause that review phases are phases of the graph, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/reviews-are-phases` — read half, reported from `apps/indusk-mcp/src/lib/graph/read-graph-signals.ts`, same call. A plain heading scan finds each open phase whose heading starts Falsification, Cleanup, Audit or Maintenance; each must have a node with its declared dependencies and files, and no node may be a step (planning, the audit step, falsify or cleanup authoring, the retrospective). A review phase with no files line is named as undeclared (it runs serialised). `broken` names the plan and the heading. The step half is reported in Build Phase 6. Best-effort.

  </details>

#### Build Phase 1 Verification

- [ ] The declaration, refusal, graph and incident-writer tests pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/declarations.test.ts src/__tests__/depends-on-refused.test.ts src/__tests__/declarations-parity.test.ts src/lib/graph/read-graph.test.ts src/lib/graph/read-graph-status.test.ts src/lib/promises/reopen-declarations.test.ts src/__tests__/check-gates-depends.test.ts src/__tests__/check-gates-session-phase.test.ts && pnpm exec vitest related src/lib/graph/declarations.ts src/lib/graph/read-graph.ts hooks/validate-impl-structure.js hooks/check-gates.js hooks/_phase-depends.js src/lib/promises/reopen.ts` — T1 to T5, T36 and T37 pass; the existing gate-hook tests stay green.

  </details>
- [ ] This plan's own impl still passes the save check.
  <details><summary>Technical</summary>

  Re-save this file through the Edit tool (or run the hook on it) — no refusal; its own dependency lines name real phases with no loop.

  </details>

#### Build Phase 1 Context

- [ ] Hold, as a guard, that phase dependencies and files are read by one parser.
  <details><summary>Technical</summary>

  guard: a single-definition scan in `declarations.test.ts`, which carries `clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs`, and `declarations-parity.test.ts` holding the hook module equal. The package's `CLAUDE.md` "Run the graph" section is written once, by Build Phase 6, so parallel phases never edit it.

  </details>

#### Build Phase 1 Document

- [ ] Start the guide page with the two lines and the default chain.
  <details><summary>Technical</summary>

  New `apps/docs/src/guide/phases-in-parallel.md`: the two lines, how a phase is named, the default chain, that only the impl is exempt from overlap and a shared page must be declared, the refusals; `reference/skills/planner.md`, `falsify.md`, `cleanup.md` note the lines. The changelog entry is Build Phase 6's.

  </details>

### Build Phase 2: The scheduler

**Tier**: med — the step's default tier for work
**Depends on**: Build Phase 1
**Files**: apps/indusk-mcp/src/lib/graph/schedule.ts, apps/indusk-mcp/src/lib/graph/schedule-signals.ts, apps/indusk-mcp/src/lib/graph/schedule-ready.test.ts, apps/indusk-mcp/src/lib/graph/schedule-wait.test.ts, apps/indusk-mcp/src/lib/graph/chain-parity.test.ts, apps/docs/src/guide/phases-in-parallel.md

This phase adds the one function that decides which of a plan's phases to start. It is handed the graph, the phases running, whether the plan waits on a question, and how many places the cap has free, and returns the phases to launch with, for every other ready phase, the reason it waits. It reads nothing and has no way to stop a running phase.

- [ ] Write the function that picks the phases to start, with a named reason for each phase that waits.
  <details><summary>Technical</summary>

  `lib/graph/schedule.ts`: `pickPhasesToStart({ graph, running, stopped, waitingOnQuestion, room })` → `{ start: PhaseNode[]; waiting: { phase, reason }[] }`. Ready: every dependency done, not running, not stopped, no `judgement` items and no `blocker`. A phase whose dependencies are done but which carries a judgement or blocker waits with reason `person` (naming the item), and is never started. A ready phase starts unless a running phase shares a file (`fileSetsOverlap`; an undeclared phase shares with every phase), `room` is used up, or the plan waits on a question. Reasons: `dependency` (naming it), `file` (naming the phase and the path, or `undeclared`), `cap`, `question`, `person`. Starts are chosen in impl order one at a time, each joining `running` for the next, so two freed phases never take one file. No `fs`, `child_process` or clock. T6, T7, T8.

  </details>
- [ ] Report the signal for the clause that no phase waits needlessly, after each scheduling decision.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/no-needless-wait` — reported from `apps/indusk-mcp/src/lib/graph/schedule-signals.ts`. `reportScheduleSignals(root, plan, result)` re-derives each waiting phase's reason from its own reads, never the call's inputs or `fileSetsOverlap`: dependencies by a plain scan of `git show plan/<plan>:<impl>`, running phases from the session manager's sessions file (`admin-sessions.json`), overlap three ways — the declared strings against each other (equal, or one a glob matching the other's literal path, by `picomatch` or the matcher the repo already uses), both sets expanded against `git ls-files` on the plan's branch, and each running phase branch's `git diff --name-only plan/<plan>...phase/<plan>/<kind>-<n>` — so a new file two phases write is seen, an undeclared phase overlapping every phase, the cap from the sessions file against `readSessionsMax()`. `broken` names a waiting phase with no valid reason, a ready phase not started while none applies, or two running phases on one path. The scheduler does not import this file; the driver calls it after each call (Build Phase 6). `writeClauseSignals(root, "run-graph.schedule", plan, { plan: "run-the-graph", phase: "Build Phase 2" }, verdicts)`. Best-effort.

  </details>

#### Build Phase 2 Verification

- [ ] The scheduler tests pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/schedule-ready.test.ts src/lib/graph/schedule-wait.test.ts src/lib/graph/chain-parity.test.ts && pnpm exec vitest related src/lib/graph/schedule.ts src/lib/graph/schedule-signals.ts` — T6, T7, T8 pass.

  </details>

#### Build Phase 2 Context

- [ ] Record, as a guard, that the scheduler takes its reads as inputs.
  <details><summary>Technical</summary>

  guard: `schedule-ready.test.ts` carries `lesson: code-that-decides-takes-its-clock-and-its-reads` and scans `schedule.ts` for `fs`, `child_process` and `Date.now` imports.

  </details>

#### Build Phase 2 Document

- [ ] Add the reasons a phase waits to the guide page, with the six-phase example.
  <details><summary>Technical</summary>

  `guide/phases-in-parallel.md` section "Why a phase waits": the five reasons; a Mermaid graph of the brief's six-phase plan. Build Phase 2 is the only phase that can run beside Build Phases 3, 4 and 5 and edits this page; none of them declares it.

  </details>

### Build Phase 3: Several phase sessions of one plan, each counted

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/session/manager.ts, apps/indusk-mcp/src/lib/session/manager-parallel.test.ts, apps/indusk-mcp/src/lib/session/cap-per-phase.test.ts, apps/indusk-mcp/src/lib/run-record/record.ts, apps/indusk-mcp/src/lib/run-record/liveness.ts, apps/indusk-mcp/src/lib/run-record/record-phases.test.ts, apps/indusk-mcp/src/bin/commands/run.ts, apps/indusk-mcp/src/lib/run/refuse-graph-run.test.ts, apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts, .indusk/promises/a-session-belongs-to-its-plan.md, apps/docs/src/decisions/sessions-per-plan.md

This phase lets one plan have several building sessions at once, one per phase, each taking its own place under the machine's cap, and makes a build's record keep every running phase's process so the admin can tell a live build from a dead one. It also stops Dawn's runner from building a plan the admin is already building. The scheduler can then pick two phases of one plan without the session manager refusing the second.

- [ ] Identify a session by plan, kind and phase, refusing only a second session on the same phase.
  <details><summary>Technical</summary>

  `lib/session/manager.ts`: `ManagedStart` and `SessionRecord` gain `phase?: string`; `refusalFor` refuses a same-kind session only when the phase matches (no phase on either side matches as today, so planning and release are unchanged), naming the running one. Update `apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts`. T9 turns green.

  </details>
- [ ] Count every phase session against the cap, the build's admission covering only one of them.
  <details><summary>Technical</summary>

  `refusalFor` skips the cap check for an admitted build's session only while no other build session of that plan runs; `capRefusal` treats an admitted build as covering one of its running build sessions and counts the rest. `holdQuestion`/`releaseQuestion` keep their plan keys (a question holds the whole plan in this slice). T10 turns green; T34 stays green.

  </details>
- [ ] Rewrite the changed promise's sentence now that the code makes it true.
  <details><summary>Technical</summary>

  `indusk promises change a-session-belongs-to-its-plan --plan run-the-graph --statement "A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the session already running, so a plan can have a planning session and several phases building at the same time." --reason "phases of one plan run in parallel"`.

  </details>
- [ ] Keep every running phase's process in the build's record, and read the build as running while any of them is alive.
  <details><summary>Technical</summary>

  `lib/run-record/record.ts`: `RunRecord` gains optional `phases: { phase, process: RunProcess | null, state: "running" | "waiting" | "stopped", why: string | null }[]`; `isRecord` accepts it absent. `lib/run-record/liveness.ts` `runStatus`: running when `process` or any listed phase process is the own process. T11 turns green.

  </details>
- [ ] Make Dawn's runner refuse a plan the admin is building.
  <details><summary>Technical</summary>

  `src/bin/commands/run.ts` (before `runDriver`): read the plan's build run record; refuse when `runStatus` reads running, or when the admin answers that it holds a build of the plan (`daemonStatus` + the admin's build state route), naming the build. With the admin down the record alone decides. T12.

  </details>

#### Build Phase 3 Verification

- [ ] A plan's second phase session starts, the same-phase duplicate is refused, and the cap counts each phase session.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager-parallel.test.ts src/lib/session/cap-per-phase.test.ts src/lib/session/manager.test.ts src/lib/session/question-wait.test.ts src/lib/run-record/record-phases.test.ts src/lib/run/refuse-graph-run.test.ts && pnpm exec vitest related src/lib/session/manager.ts src/lib/run-record/record.ts src/lib/run-record/liveness.ts` — T9 to T12 pass; T34 and the existing manager tests stay green. `cd ../indusk-admin && pnpm exec vitest run src/__tests__/sessions-per-plan.test.ts` passes.

  </details>

#### Build Phase 3 Context

- [ ] Hold, as a guard, how a session is identified and counted.
  <details><summary>Technical</summary>

  guard: `manager-parallel.test.ts` carries `promise: a-session-belongs-to-its-plan`, `cap-per-phase.test.ts` carries `promise: sessions-are-capped`. The rule's text ("one session per plan, kind and phase; a build's admission covers one session and each further phase session takes its own place under `sessions.max`") goes into the package's `CLAUDE.md` with Build Phase 6, the one phase that edits that file.

  </details>

#### Build Phase 3 Document

- [ ] Note the new session identity on the sessions decision page.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/sessions-per-plan.md`: a dated note that identity is plan, kind and phase, and each phase session is counted (run-the-graph).

  </details>

### Build Phase 4: A phase gets its own worktree and branch, and keeps them

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/graph/phase-branch.ts, apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts, apps/indusk-mcp/src/lib/graph/phase-worktree.test.ts, apps/indusk-mcp/src/lib/graph/phase-resume.test.ts, apps/indusk-mcp/src/lib/graph/phase-start.test.ts, apps/indusk-mcp/src/lib/worktree/provision.ts, apps/indusk-mcp/src/lib/worktree/provision.test.ts, apps/indusk-mcp/src/lib/worktree/layout.ts, apps/indusk-mcp/src/bin/commands/worktree.ts, apps/docs/src/reference/skills/work.md

This phase makes a phase's start real: a worktree of its own on its own branch, cut from the plan's branch — which already holds every finished dependency — and set up the way `indusk worktree create` sets one up, so its tests can run. A phase started again after a red check, a question or a restart carries on in the same worktree and branch with its earlier commits; it is never cut fresh.

- [ ] Cut a new phase's branch and worktree from the plan's branch.
  <details><summary>Technical</summary>

  `lib/graph/phase-branch.ts`: `startPhase(repo, plan, phase, { provision })` → `{ branch, worktree, resumed }`. Branch `phase/<plan>/test-<n>` or `phase/<plan>/build-<n>` from the phase's `phaseKey` (Test Phase N and Build Phase N share a number, ADR D5; never `plan/<plan>/…`, which git cannot hold beside `plan/<plan>`), worktree path from `lib/worktree/layout.ts` beside the plan's, carrying the same `<kind>-<n>`. Cut with `git worktree add -b <branch> <path> plan/<plan>`. T13, T16, T17.

  </details>
- [ ] Resume a phase that has a branch already, in its own worktree, never cutting it again.
  <details><summary>Technical</summary>

  Branch and worktree both present (`git worktree list --porcelain`): reuse as is. Branch present, worktree gone: `git worktree add <path> <branch>` (no `-b`). Only a phase with no branch is cut. `resumed: true` in both resume cases. T14.

  </details>
- [ ] Set up a phase worktree exactly as a created worktree is set up, through one shared function.
  <details><summary>Technical</summary>

  Extract `provisionWorktree(root, repo, dir)` from `worktreeCreateResolved` in `src/bin/commands/worktree.ts` into `lib/worktree/provision.ts` (doppler env, then the repo's `post_create` steps); with no `post_create`, run the install the lockfile names (`pnpm install --frozen-lockfile` for `pnpm-lock.yaml`, `npm ci` for `package-lock.json`). `worktree create` and `startPhase` both call it; a failed step throws naming the command, and `startPhase` returns it as the phase's stop reason. A resumed phase is not set up again. T15.

  </details>
- [ ] Report the signal for the clause that every running phase has its own worktree, when a phase starts or resumes.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/own-worktree` — reported from `apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts`, called by `startPhase` before it returns. Plain git, not `layout.ts`: the branch is the name the signal's own rule gives the phase's kind and number (`test-<n>` / `build-<n>`); in `git worktree list --porcelain` the path and the branch appear once; for a cut, `git rev-parse <branch>` equals `plan/<plan>`'s tip; for a resume, the branch tip equals the tip read before the start and the branch's reflog shows no new creation entry. `writeClauseSignals(root, "run-graph.phase-start", plan, { plan: "run-the-graph", phase: "Build Phase 4" }, verdicts)`; `broken` names the phase and the shared worktree, wrong base or lost commits. Best-effort.

  </details>
- [ ] Report the signal for the clause that a phase starts with its dependencies' work, when a phase starts.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/starts-from-its-dependencies` — reported from `apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts`, same point; `startPhase` takes the phase's dependency names for it. For each dependency with a `phase/<plan>/<kind>-<n>` branch, its tip is an ancestor of the new worktree's `HEAD` (`git merge-base --is-ancestor`); `git ls-files -u` in the worktree is empty. `broken` names the phase and the missing dependency or the unmerged paths. Best-effort.

  </details>

#### Build Phase 4 Verification

- [ ] The worktree, resume, setup and start tests pass on real throwaway repositories.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/phase-worktree.test.ts src/lib/graph/phase-resume.test.ts src/lib/graph/phase-start.test.ts src/lib/worktree/provision.test.ts && pnpm exec vitest related src/lib/graph/phase-branch.ts src/lib/graph/phase-branch-signals.ts src/lib/worktree/provision.ts src/bin/commands/worktree.ts` — T13 to T17 pass; the existing worktree tests stay green.

  </details>

#### Build Phase 4 Context

- [ ] Hold, as a guard, how phase branches are named and that a phase is never cut twice.
  <details><summary>Technical</summary>

  guard: `phase-resume.test.ts` and `phase-worktree.test.ts` carry `clause: a-phase-builds-on-its-own-branch/own-worktree`. The rule's text ("phase branches are `phase/<plan>/<kind>-<n>`; a ref `plan/<plan>` cannot have refs below it; a phase with a branch resumes on it, never re-cut") goes into the package's `CLAUDE.md` with Build Phase 6.

  </details>

#### Build Phase 4 Document

- [ ] Describe a phase's branch and worktree on the work skill's page.
  <details><summary>Technical</summary>

  `reference/skills/work.md`: a graph-run phase works in its own worktree on `phase/<plan>/<kind>-<n>` and only its own phase. The guide page's "A phase's branch" section is Build Phase 6's, since this phase can run beside Build Phase 2, which edits the guide.

  </details>

### Build Phase 5: A finished phase joins its plan only when green

**Tier**: strong — the merge check and the fast-forward are what keep a plan's branch green while phases run side by side
**Depends on**: Build Phase 1, Build Phase 4
**Files**: apps/indusk-mcp/src/lib/graph/merge.ts, apps/indusk-mcp/src/lib/graph/impl-lines.ts, apps/indusk-mcp/src/lib/graph/record.ts, apps/indusk-mcp/src/lib/graph/merge-signals.ts, apps/indusk-mcp/src/lib/graph/merge.test.ts, apps/indusk-mcp/src/lib/graph/merge-failed.test.ts, apps/indusk-mcp/src/lib/graph/merge-impl-lines.test.ts, apps/indusk-mcp/src/lib/graph/merge-checked.test.ts, apps/indusk-mcp/src/lib/graph/only-the-plan-lands.test.ts, apps/indusk-mcp/src/lib/graph/merge-test-phase.test.ts, apps/indusk-mcp/src/lib/plans/test-set.ts, apps/indusk-mcp/src/lib/plans/test-set-merge.test.ts, apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/plans/approve.ts, apps/docs/src/reference/cli/plans.md

This phase adds a phase's end: the plan's branch is merged into the phase, the phase's tests and the tests of every clause the plan has touched run on that result, and only a green result moves the plan's branch forward, in the plan's own worktree so its files follow. A red check or a conflict sends the phase back to its own session; the third failure stops it without stopping anything that does not need it. Only a plan's branch ever reaches the trunk.

- [ ] Add the record a plan's graph run keeps in machine state.
  <details><summary>Technical</summary>

  `lib/graph/record.ts`: `appendGraphRecord(home, plan, entry)`, one never-raising writer modelled on the plan-timing writer, file `graph/<plan>.jsonl` under the `indusk eval home` directory; entries `run-started`, `launched`, `ended`, `merge { phase, outcome: merged | red | conflict | dirty | unchecked, commit, report, outside }`, `stopped { phase, why }`. `readGraphRecord` drops a torn last line; `attemptsSince(entries, phase)` counts failed merges since the last `run-started` (ADR D8).

  </details>
- [ ] Choose the merge check's tests: the phase's own, those of every clause the plan has touched, and what must not break.
  <details><summary>Technical</summary>

  `lib/plans/test-set.ts`: `TestSetRow` gains `for`; new scope `{ merge: { phase, done: PhaseRef[], changed: string[], tokens: (path) => string[] } }` returning two sets. Must pass: rows of this phase or a done phase whose Passes-at phase is this one or a done one, every row whose `For` names a clause that such a row names or whose `clause:`/`promise:` token appears in a changed file, and the Must-not-break promises' tests. Must fail on assertion (a test phase only): the rows this test phase writes whose Passes-at phase is later. A row whose Passes-at phase is not yet merged is in neither: it is red by design. T19 runs it on a fixture plan with nothing injected, including a row written at a done Test Phase 1 that passes at a later build phase.

  </details>
- [ ] Merge the plan's branch into a finished phase, resolving neighbouring impl ticks line by line and sending any other conflict back.
  <details><summary>Technical</summary>

  `lib/graph/merge.ts` `mergePhase({ repo, plan, phase, run, home })`, steps in ADR D6 order. Dirty phase worktree → outcome `dirty`. `git merge plan/<plan>` in the phase worktree; on conflict, `lib/graph/impl-lines.ts` resolves `impl.md` when every conflicting line was changed by one side only (ticks, State cells); any other conflict → `git merge --abort`, outcome `conflict` naming the files. T21.

  </details>
- [ ] Run the check on the merged result and refuse a merge that ran no test or carries a touched clause with no signal.
  <details><summary>Technical</summary>

  `run(files, reportPath)` runs the project's test command on the set in the phase worktree with the JSON reporter (`--reporter=json --outputFile=<home>/graph/reports/<sha>.json`). Empty set or zero non-skipped tests → `unchecked`. For each clause the phase touches (its rows' `For`, tokens in `git diff --name-only plan/<plan>...HEAD`), a signal task for it must be in this phase's section or a done phase's, read with `lib/promises/clause-signal-rules.ts`; otherwise `unchecked` naming the clause. Red → `red` naming the failing tests. T18, T22.

  </details>
- [ ] Judge a test phase's merge by the test-phase rule: its own rows pass, and each row it writes for a later phase fails on its own assertion.
  <details><summary>Technical</summary>

  For a test phase, the must-fail set is run in the same report: each file must have run tests with at least one failing on an assertion (`assertionResults` with `status: "failed"`); a file with no assertion results (it did not load, a missing module) or one already all green → `red` naming it. So Test Phase 1 joins the plan and the build phases that depend on it can start. T40.

  </details>
- [ ] Move the plan's branch forward in the plan's worktree only on a green result, repeating if it moved meanwhile.
  <details><summary>Technical</summary>

  In the plan's worktree, `git merge --ff-only phase/<plan>/<kind>-<n>`; if refused because `plan/<plan>` moved, repeat from the merge (not an attempt); if refused for local changes in the plan's worktree, outcome `stopped` naming them. On success append `merge … merged`, remove the phase worktree (`git worktree remove`), keep the branch. The driver calls `mergePhase` for one phase of a plan at a time (Build Phase 6). T18.

  </details>
- [ ] Send a failed phase back to its session up to three attempts, then stop it with its reason.
  <details><summary>Technical</summary>

  `mergePhase` returns the outcome; `nextForPhase(entries, phase, outcome)` in `merge.ts` answers `retry` (with the reason to tell the session) while `attemptsSince` is under three, else appends `stopped` and answers `stop`. Same tier on retry (ADR open decision). T20.

  </details>
- [ ] Refuse landing a phase's branch, and a plan with a phase running or stopped unmerged; delete the plan's phase branches after it lands.
  <details><summary>Technical</summary>

  `lib/plans/land.ts` (`landPlan`): a ref under `phase/` is refused naming its plan; a plan whose graph record shows a `launched` phase with no `merge … merged` after it, or a `stopped` one, is refused naming them; after the landing merge and the signal below, `git branch -D` each `phase/<plan>/*`. Workbench landing is unchanged (workbench plans do not run as a graph in this slice). T23.

  </details>
- [ ] Report the signal for the clause that a phase merges only when green, after each merge and on each tick.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/green-before-merging` — reported from `apps/indusk-mcp/src/lib/graph/merge-signals.ts`, `reportMergeSignals(root, plan)`, called by `mergePhase` after a fast-forward and by the driver's tick (Build Phase 6). It walks `git reflog show --date=iso plan/<plan>` past the last entry it judged (kept in its own file beside the reports). A move whose new tip brings a `phase/<plan>/*` tip not in the old one must have `<home>/graph/reports/<new tip>.json` in which every expected test passed, the expected list recomputed by a plain scan of the impl's trajectory read as text at the new tip: the `Test` file of every row of a phase closed there whose Passes-at phase is closed there, the test files of every clause those rows' `For` cells name or a `clause:`/`promise:` token in `git diff --name-only <trunk>...<new tip>` names, and the `tests:` each Must-not-break promise's file lists (the brief's Must-not-break names, read as text). For a test phase's merge, each row it wrote that passes later must be in the report with an assertion failure. A move bringing no phase tip while the sessions file shows a phase session of the plan running is `broken` as an outside move. `writeClauseSignals(root, "run-graph.merge", plan, { plan: "run-the-graph", phase: "Build Phase 5" }, verdicts)`; `broken` names the commit and what was red, missing or left out. Best-effort.

  </details>
- [ ] Report the signal for the clause that every merged phase was checked, after each merge.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/every-phase-is-checked` — reported from `apps/indusk-mcp/src/lib/graph/merge-signals.ts`, same call. The report for the new tip (not the record) shows at least one test that ran and was not skipped; for each clause the merged phase touches (its rows' `For` cells read as text, tokens in its changed files), a task naming that clause's signal exists in its section or a closed phase's section, read with the rule in `lib/promises/clause-signal-rules.ts`. `broken` names the phase and "no test ran" or the clause. Best-effort.

  </details>
- [ ] Report the signal for the clause that only a plan's branch reaches the trunk, after each landing and each approval.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/only-the-plan-lands` — reported from `apps/indusk-mcp/src/lib/graph/merge-signals.ts`, `reportLandsSignal(root, trunk, landedPlan?)`, called by `land.ts` after the landing merge and before it deletes phase branches, by `lib/plans/approve.ts` after its approval merge, and by the driver's tick (Build Phase 6). Plain git, never commit subjects: the phase tips are each `git for-each-ref refs/heads/phase/` tip and each tip `git reflog show plan/<plan>` records being merged in (git's own entry naming the `phase/` ref, which outlives the deleted branch); each one that `git merge-base --is-ancestor`s the trunk must belong to a landed plan and be an ancestor of that landing merge's second parent. At a landing, each promise the brief's "This plan makes" names must read `state: enforced` in `git show <second parent>:.indusk/promises/<name>.md`. An approval merge brings only documents and reads upheld. `broken` names the phase tip and the trunk commit, or the unconfirmed promise. Best-effort.

  </details>

#### Build Phase 5 Verification

- [ ] The merge, retry, impl-line, check and landing tests pass on real throwaway repositories.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/merge.test.ts src/lib/graph/merge-failed.test.ts src/lib/graph/merge-impl-lines.test.ts src/lib/graph/merge-checked.test.ts src/lib/graph/merge-test-phase.test.ts src/lib/graph/only-the-plan-lands.test.ts src/lib/plans/test-set-merge.test.ts && pnpm exec vitest related src/lib/graph/merge.ts src/lib/graph/record.ts src/lib/graph/merge-signals.ts src/lib/plans/test-set.ts src/lib/plans/land.ts src/lib/plans/approve.ts` — T18 to T23 and T40 pass; the existing landing and test-set tests stay green.

  </details>

#### Build Phase 5 Context

- [ ] Hold, as a guard, that a plan's branch moves from a phase only by the checked fast-forward.
  <details><summary>Technical</summary>

  guard: `merge.test.ts` carries `clause: a-phase-builds-on-its-own-branch/green-before-merging` and scans `src/` for another `merge --ff-only phase/` caller. The rule's text goes into the package's `CLAUDE.md` with Build Phase 6.

  </details>

#### Build Phase 5 Document

- [ ] Describe on the plans command's reference page that landing refuses a phase branch and a plan with unmerged phases.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, `plans land`: the two refusals and that the plan's phase branches are deleted after it lands. The guide page's "When a phase finishes" sequence diagram is Build Phase 6's, since this phase can run beside Build Phase 2, which edits the guide.

  </details>

### Build Phase 6: The admin's build runs the phases as a graph

**Tier**: strong — joins the scheduler, the sessions, the branches and the merge, and decides when each read and launch happens
**Depends on**: Build Phase 2, Build Phase 3, Build Phase 5
**Files**: apps/indusk-mcp/src/lib/build/graph-run.ts, apps/indusk-mcp/src/lib/build/graph-run-signals.ts, apps/indusk-mcp/src/lib/build/runner.ts, apps/indusk-mcp/src/lib/build/index.ts, apps/indusk-mcp/src/lib/build/graph-run.test.ts, apps/indusk-mcp/src/lib/build/graph-run-launch.test.ts, apps/indusk-mcp/src/lib/build/graph-run-current.test.ts, apps/indusk-mcp/src/lib/build/graph-run-restart.test.ts, apps/indusk-mcp/src/lib/build/graph-run-rituals.test.ts, apps/indusk-mcp/src/lib/build/graph-run-question.test.ts, apps/indusk-mcp/src/lib/run-record/phase-lines.ts, apps/indusk-mcp/src/lib/run-record/phase-lines.test.ts, apps/indusk-mcp/src/lib/plans/ask-admin.ts, apps/indusk-mcp/src/lib/plans/ask-admin-build.test.ts, apps/indusk-mcp/src/bin/commands/plans.ts, apps/indusk-admin/src/lib/build-host.ts, apps/indusk-mcp/src/__tests__/run-graph.live.test.ts, apps/indusk-mcp/vitest.tiers.ts, apps/indusk-mcp/src/lib/build/build-session.ts, apps/indusk-mcp/src/lib/build/work-prompt-phase.test.ts, apps/indusk-mcp/src/lib/build/graph-run-judgement.test.ts, apps/indusk-admin/src/instrumentation.ts, apps/indusk-mcp/CLAUDE.md, apps/docs/src/guide/phases-in-parallel.md, apps/docs/src/decisions/run-the-graph.md, apps/docs/src/changelog.md

This phase connects the pieces inside the admin's existing build. When the build reaches its work step, it runs the plan's phases as a graph: every ready phase gets its own branch and a session told to work that one phase, each finished phase is merged into the plan, the plan is read again, and what is now ready starts — until no phase is open, when the build goes on to its review steps as today. One launcher does every launch, and merges never hold one up. A phase a person must judge is not started and still stops the build once nothing else can run; a question holds the whole plan and an answer given early is kept; after an admin restart the admin resumes the build itself; approving from a terminal asks the admin to build. The person sees each phase's state where the build shows its phase today. As the last phase, it also writes the plan's shared rules section, guide sections and changelog entry.

- [ ] Run the work step as a graph: launch every ready phase, merge each as it ends, read the plan again, and launch what is now ready.
  <details><summary>Technical</summary>

  `lib/build/graph-run.ts`: `runGraphStep(deps)` with `deps` = `{ readGraph, schedule, startPhase, startSession, mergePhase, record, room, now, tick }`. Append `run-started`. One launcher: `pass()` is single-flight — a call while a pass runs sets a `again` flag and the running pass loops once more; session ends, merge results and the tick only call `pass()`, never `startPhase` (ADR D4). A pass reads the graph from the plan's worktree, calls `pickPhasesToStart` with `room` from the session manager's cap, and for each start runs `startPhase` then `runStepSession` (`step: "work"`, `worktree` = the phase's, `phase` passed to the manager and the prompt, the phase's tier model), appending `launched`. On a session's end: `ended`; when its phase is closed in its worktree, push it on the plan's merge queue, which runs `mergePhase` one at a time and is never awaited by `pass()`, so a long check delays no launch; `retry` relaunches the session with the reason in its prompt, `stop` marks it stopped; every merge result and end calls `pass()`, which reads the graph again before any launch. Returns when nothing is open, running, merging or ready: `done`, a judgement stop (below), or `cannot-continue` naming stopped phases. After each scheduler call it calls `reportScheduleSignals`. T24, T26.

  </details>
- [ ] Tell each phase session the one phase it works and to work only that phase, and tell a session sent back why.
  <details><summary>Technical</summary>

  `lib/build/build-session.ts`: `stepPrompt` and `runStepSession` take `phase` and an optional `retry` note; the `work` text for a graph phase reads "Work only <phase> of the plan; leave every other phase as it is; end when <phase> is closed" with the retry note after it, and `stepEnv` adds `INDUSK_BUILD_PHASE=<phase>`, which the gate hook enforces (Build Phase 1). The manual path and a workbench plan's work step keep today's text. T38.

  </details>
- [ ] Keep a declared judgement stopping the build: never start a phase a person must judge, and stop on it once nothing else can run.
  <details><summary>Technical</summary>

  The scheduler already leaves a node with `judgement` items or a `blocker` waiting with reason `person` (Build Phase 2). When nothing is running, merging or ready and such a phase is waiting, `runGraphStep` returns `{ step: "judgement", phase, item, items }` (or `cannot-continue` naming the blocker), which `runBuild` turns into the same stop `nextBuildStep` gives today. T39.

  </details>
- [ ] Make the build's step loop hand its work step to the graph and start ritual steps only when every phase is done.
  <details><summary>Technical</summary>

  `lib/build/runner.ts` `runBuild`: when `nextBuildStep` answers `work`, call `deps.runGraph()` (new `RunnerDeps` member) instead of `deps.run("work", phase)`; its `cannot-continue`, `judgement` and `question` stops end the run as a failed step, a judgement and a question do today. Audit, falsify, cleanup and retrospective steps run as today; `nextBuildStep` already answers `work` while a phase is open, so a phase a ritual wrote runs as a graph before the next step. Workbench plans keep `deps.run("work", phase)` (ADR decision D4: the brief excludes them). T29.

  </details>
- [ ] Host the graph in the admin's build, launching phase sessions through its one session manager and keeping each phase's state in the run record.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `depsFor`: supply `runGraph`, wiring `startSession` to `runStepSession` with `manager: sessionManager()` and `room` from `capRefusal`; each phase's `onSession` writes its process into the record's `phases`, and each launch, wait and stop updates its `state` and `why`. A 30-second tick (`setInterval`, cleared when the step returns) calls the step's `pass()` — it never launches on its own — and calls `reportMergeSignals` and `reportLandsSignal`. T25.

  </details>
- [ ] Hold the whole plan when a phase session stops on a question, and resume the asking phase in its worktree on the answer.
  <details><summary>Technical</summary>

  A phase session returning `waiting` (a question that holds): launch nothing more, let running phases end and merge, then — unless the question's record now reads answered — return `{ step: "question", id }`, which `startBuild` already turns into `holdQuestion(project, plan)`. An answer given meanwhile: `resumeAfterQuestion` in `build-host.ts`, finding the plan's build running, releases the question and returns the running state instead of calling `startBuild`; the step, seeing the record answered, resumes the asking phase with `startPhase` and a session told the answer (`runStepSession` already tells untold answers) and carries on. The host's stop handler calls `holdQuestion` only for a question still unanswered. A later answer restarts the build as today and the graph resumes the asking phase. T30.

  </details>
- [ ] Resume after an admin restart without anyone pressing Build: relaunch each phase whose session was ended in its own worktree, and merge one that had finished.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/instrumentation.ts` `register()`, beside the recorder loops: for each registered project, each plan whose newest build record is a dead run with no recorded stop (`deadRun` and the record's `stop` absent — the restart ended it, nobody stopped it), call `startBuild(project, plan)`; a run that stopped on a question, a judgement, `cannot-continue` or a person is left alone. `reapRecorded` ends the old sessions first, as today. The work step's first read finds `launched` phases open with branches: a phase closed in its own worktree goes straight to `mergePhase`; any other is relaunched through `startPhase` (resume). T28.

  </details>
- [ ] Make a terminal approval ask the running admin to build the plan, launching nothing itself.
  <details><summary>Technical</summary>

  `lib/plans/ask-admin.ts`: `askAdminToBuild(cwd, plan, deps)` posting `{ project, plan }` to the admin's `/api/plans/build`, built like `askAdminToPlan`, with the same plain answers for an admin not running, a project not registered, or a refusal. `src/bin/commands/plans.ts` `approve` prints its answer after the approval; the approval stands either way. Approving in the admin already calls `startBuild`. T27.

  </details>
- [ ] Show each phase as running, waiting on what, or stopped and why, where the build shows its phase today.
  <details><summary>Technical</summary>

  `lib/run-record/phase-lines.ts`: `phaseLines(record)` → one line per phase from the record's `phases` (`Build Phase 2 — running`, `Build Phase 5 — waits for Build Phase 3`, `Build Phase 4 — stopped: 2 tests red`). `buildView` in `build-host.ts` shows them in the `phase` place for a graph run; its `shows-where-it-is` check compares each running phase with the session working it. T31.

  </details>
- [ ] Write the live check that builds a real three-phase plan from the admin's host with a scripted agent.
  <details><summary>Technical</summary>

  `src/__tests__/run-graph.live.test.ts`, added to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`: a fixture plan with Phases 1 and 2 independent and 3 depending on both, built through `startBuild` with a scripted agent process that ticks its phase's boxes, commits and exits; asserts two phase sessions overlapped and all three phases are on `plan/<plan>`. It proves no clause; its result is recorded in the retrospective. T35.

  </details>
- [ ] Report the signal for the clause that ready phases start within a minute, at each launch and on each tick.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/ready-phases-start` — reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, called after each launch and on each tick (including the first after the admin starts). Not from the graph record: a phase's ready time is the first `git reflog show --date=iso plan/<plan>` entry whose commit has its last dependency's `phase/` tip as an ancestor (a fast-forward and a merge read alike), or, with no dependency, the later of the plan's approval merge reaching the trunk and the run record's `startedAt`; its launch time is the creation entry in its own branch's reflog. Cap room is read at each tick from `admin-sessions.json` against `readSessionsMax()` and kept in the signal's own log. `broken`: a launch over sixty seconds after ready while the log showed room; a phase ready over a minute with room now and no branch; a phase branch over fifteen minutes old with no session and no stop in the run record; at each phase end, a box ticked outside the launched phase's section in `git diff plan/<plan>...phase/<plan>/<kind>-<n> -- <impl>`, read by a plain heading scan. A plan whose run stopped on a recorded stop (a question, a judgement, `cannot-continue`, a person) is not judged; a run the admin's restart ended, with no recorded stop, is; a phase waiting on a person's judgement is listed, not late; a missing reflog reports unknown. `writeClauseSignals(root, "run-graph.driver", plan, { plan: "run-the-graph", phase: "Build Phase 6" }, verdicts)`. Best-effort.

  </details>
- [ ] Report the signal for the clause that the graph is read again before each launch.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/graph-is-current` — reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, at each launch. A plain scan of `git show plan/<plan>:<impl>` at that moment: the launched phase is open, every phase it depends on is closed, and `admin-sessions.json` holds no other session for that phase. `broken` names the launch and which failed. Best-effort.

  </details>
- [ ] Report the signal for the clause that review phases are phases, when the build starts a ritual step.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/reviews-are-phases` — step half, reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, called by `runBuild` before it starts an audit, falsify, cleanup or retrospective step. A plain scan of `git show plan/<plan>:<impl>` finds no open phase; `broken` names the step and the open phase it started over. Best-effort.

  </details>

#### Build Phase 6 Verification

- [ ] The work-step, launch, read, restart, ritual, question, approval and phase-line tests pass, and the guards stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/build/graph-run.test.ts src/lib/build/graph-run-launch.test.ts src/lib/build/graph-run-current.test.ts src/lib/build/graph-run-restart.test.ts src/lib/build/graph-run-rituals.test.ts src/lib/build/graph-run-question.test.ts src/lib/plans/ask-admin-build.test.ts src/lib/run-record/phase-lines.test.ts src/lib/build/work-prompt-phase.test.ts src/lib/build/graph-run-judgement.test.ts src/lib/build/next-step-boundary.test.ts src/lib/build/manual-path.test.ts && pnpm exec vitest related src/lib/build/graph-run.ts src/lib/build/runner.ts src/lib/build/build-session.ts src/lib/build/graph-run-signals.ts src/lib/plans/ask-admin.ts src/lib/run-record/phase-lines.ts` — T24 to T31, T38 and T39 pass; T32 and T33 stay green. `cd ../indusk-admin && pnpm exec vitest related src/lib/build-host.ts src/instrumentation.ts` passes.

  </details>
- [ ] The live check passes in the system tier and is not in the everyday suite.
  <details><summary>Technical</summary>

  `pnpm test:system -- run-graph.live` from the repo root — T35 passes; `everyday-tests-never-wait.test.ts` passes. Result written under Notes with the date.

  </details>

#### Build Phase 6 Context

- [ ] Write the package rules file's section on running the graph, with every rule this plan's phases hold.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, new section "Run the graph", written only here (this phase depends on every other, so no parallel phase edits the file): phase dependencies and files are read only by `lib/graph/declarations.ts`, mirrored by `hooks/_phase-depends.js`; one session per plan, kind and phase, each phase session counted under `sessions.max`; phase branches are `phase/<plan>/<kind>-<n>` and resume, never re-cut; a phase joins its plan only through `mergePhase` (plan merged in, checked, `--ff-only`), the record is `graph/<plan>.jsonl`; the graph runs only as `runBuild`'s work step in the admin, one launcher, merges off the launch path, 30 s tick; a shared page is declared by each phase that edits it — guard: `graph-run-current.test.ts` carries `clause: the-work-runs-as-a-graph/graph-is-current`.

  </details>

#### Build Phase 6 Document

- [ ] Finish the guide page and publish the decision record.
  <details><summary>Technical</summary>

  Complete `apps/docs/src/guide/phases-in-parallel.md`: "A phase's branch", "When a phase finishes" (Mermaid sequence — merge the plan in, check, fast-forward, or back to the session; a stopped phase and Build again giving it three fresh attempts), what the admin shows per phase, a judgement and a question, restart; `apps/docs/src/decisions/run-the-graph.md` from `adr.md`; the plan's changelog Unreleased entry from the ADR, beside Test Phase 1's line (written before any other phase could run).

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/graph/{declarations,read-graph,schedule,phase-branch,merge,impl-lines,record}.ts` | new: the lines, the graph, the scheduler, phase branches, the checked merge, the record |
| `apps/indusk-mcp/src/lib/graph/{read-graph,schedule,phase-branch,merge}-signals.ts`, `src/lib/build/graph-run-signals.ts` | new: one clause signal per decision, beside the code that decides it |
| `apps/indusk-mcp/src/lib/build/graph-run.ts`, `runner.ts`, `build-session.ts` | new work step with one launcher; the step loop hands it the work step; a phase session told its one phase |
| `apps/indusk-mcp/hooks/check-gates.js`, `hooks/_phase-depends.js` | the gate hook judges a phase by its dependencies and holds a phase session to its phase |
| `apps/indusk-admin/src/instrumentation.ts` | resumes a build the admin's restart ended |
| `apps/indusk-mcp/src/lib/session/manager.ts` | identity by plan, kind and phase; each phase session counted |
| `apps/indusk-mcp/src/lib/run-record/{record,liveness,phase-lines}.ts` | each phase's process and state in the build record; the phase lines |
| `apps/indusk-mcp/src/lib/worktree/provision.ts`, `src/bin/commands/worktree.ts` | one setup for created and phase worktrees |
| `apps/indusk-mcp/src/lib/plans/{test-set,land,ask-admin,approve}.ts`, `src/bin/commands/{plans,run}.ts` | the merge test scope; landing refusals; terminal approval asks the admin; `indusk run` refuses a graph-run plan |
| `apps/indusk-mcp/src/lib/promises/reopen.ts`, `skills/{falsify,cleanup,planner}.md`, `hooks/validate-impl-structure.js` | write and check the two lines |
| `apps/indusk-admin/src/lib/build-host.ts` | hosts the graph work step and its tick; shows each phase |
| `apps/indusk-mcp/vitest.tiers.ts`, `src/__tests__/run-graph.live.test.ts` | the live check in the system tier |
| `apps/indusk-mcp/CLAUDE.md`, `CLAUDE.md` | "Run the graph" rules; Key Decisions line |
| `apps/docs/src/{guide/phases-in-parallel.md,decisions/run-the-graph.md,decisions/sessions-per-plan.md,reference/skills/*.md,changelog.md}` | documentation |
| `.indusk/promises/a-session-belongs-to-its-plan.md` | sentence changed by `promises change` |

## Dependencies
- `a-run-can-be-trusted` and `decisions-as-questions`, landed (the brief's Depends On).
- Node 22; real git with reflogs on; no daemon or server for the everyday suite.

## Notes

- **This impl's own dependency and files lines are dogfood.** They are plain text to today's checks and take effect once Build Phase 1 lands. The intended graph: Test Phase 1 first; then Build Phases 1, 3 and 4 at once; 2 after 1; 5 after 1 and 4; 6 after 2, 3 and 5. Longest chain: Test Phase 1 → 1 (or 4) → 5 → 6.
- **The plan review's findings for the full design, and where the slice answers them:** a finished phase merged, recorded and followed by a fresh read (Build Phase 6 work step; Build Phase 5 merge); plans in progress or completed with open phases stay in the graph (Build Phase 1); a restarted phase resumes its own worktree (Build Phase 4, Build Phase 6); phase worktrees set up like created ones (Build Phase 4); `indusk run` refuses a graph-run plan (Build Phase 3); the landing signal judges by history, so approval merges read upheld (Build Phase 5); ready times come from the plan branch's reflog, so fast-forwards count (Build Phase 6); the graph runs only in the admin's build and a terminal approval asks it (Build Phase 6); a question holds the whole plan (Build Phase 6).
- **The slice's own cold read (`plan-review.md`, 2026-10-19, 22 findings) is answered in place.** The three that would have stopped the plan: a phase session is now told its one phase and held to it by the gate hook (Build Phase 1, Build Phase 6); the merge check runs only tests expected to pass and judges a test phase by the test-phase rule (Build Phase 5); the gate hook judges a phase by its declared dependencies (Build Phase 1). Each later rules-file and guide edit sits in one phase that no parallel phase shares.
- **otel.role is `library`**, so no OTel gate is written; each split and limit clause has a signal task in the phase that writes its deciding code, judged from a source that code does not read.
- **The live check proves no clause.** It runs only at landing and release; each clause it touches is proved by unit rows.
- Live check result: (recorded by Build Phase 6).
