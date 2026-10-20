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

Slice 1: within one approved plan that is not a workbench plan, every phase whose dependencies are done runs at once, each in its own worktree on its own branch, and joins the plan's branch only when its tests and the plan's touched clauses' tests pass. Brief: [brief.md](brief.md). Assertions: [test-plan.md](test-plan.md) (A1 to A45). Decisions D1 to D11 and the inventory table: [adr.md](adr.md). Rebuilt on 2026-10-19 around the inventory in [research.md](research.md): the seven-item smallest change set, what the brief's promises strictly add, and `indusk run` refusing a plan the graph is running. Earlier versions are in this file's history (`0842d3fdf`, `0a4d7a091`).

## Scope

### In Scope
- The seven items of the inventory's smallest change set: a worktree and branch per phase cut from the plan's branch (Build Phase 3); session identity carrying the phase, each phase session counted (Build Phase 2); the work step launching every ready phase and waiting for all (Build Phase 5); the session told its phase (Build Phase 5); the gate hook judging by dependency (Build Phase 1); a join that combines the impl's lines and fast-forwards the plan's branch (Build Phase 4); the run record listing its phases (Build Phase 2).
- What the brief's clauses add: the two label lines and the default chain, the graph read and the pure scheduler (Build Phase 1); the join's check — the phase's tests, the touched clauses' tests, the test-phase rule, no unchecked join (Build Phase 4); a person's stop, an amendment and a question still stopping the build, the question holding the whole plan (Build Phase 5); one signal per split and limit clause, beside the code that decides it.
- Dawn's `indusk run` refusing a plan the graph is building (Build Phase 2).

### Out of Scope
- Everything the brief lists as Not promised, including workbench plans (they build one phase at a time, as today).
- The admin's pages showing each phase, resuming a build after an admin restart without Build being pressed, a terminal approval starting the build, save-time refusal of a bad dependency line, landing housekeeping, and every other inventory entry the ADR lists as later or out of scope, each with its reason (ADR, "Inventory, entry by entry").
- Effort in the tier (`research.md`'s proposed shape): no promise names it.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | red tests for the session rule, the cap, the run record, Dawn's refusal, the gate hook and the work prompt; the register | existing modules only |
| Build Phase 1 | `lib/graph/declarations.ts` (`readDeclarations`, `phaseKey`, `fileSetsOverlap`); `hooks/_phase-depends.js`; `lib/graph/read-graph.ts` (`readGraph`); `lib/graph/schedule.ts` (`pickPhasesToStart`); `check-gates.js` judging by dependencies and holding a session to its phase; the two lines in the planner skill and the planning rules | `lib/models/tiers.ts` label parsing, `fencedLineMask`, `next-step.ts` `isOpen`, `judgement.ts`, `hooks/_impl-headings.js` |
| Build Phase 2 | session identity by plan, kind and phase and a place per phase session in `lib/session/manager.ts`; `phases` in the run record and its liveness; Dawn's refusal; a question's phase and its id under the lock | existing manager, `lib/run-record/`, `lib/questions/`, `lib/run/` |
| Build Phase 3 | `lib/worktree/provision.ts` (`provisionWorktree`); `lib/graph/phase-branch.ts` (`startPhase`, `removePhaseWorktree`) | `plan-worktree-commands.ts`, `bin/commands/worktree.ts`, `lib/worktree/layout.ts` |
| Build Phase 4 | `lib/graph/record.ts`; the `merge` scope of `planTestSet`; `lib/graph/impl-join.ts`; `lib/graph/join.ts` (`joinPhase`, `nextForPhase`) | Build Phase 3; `lib/plans/test-set.ts` |
| Build Phase 5 | `lib/build/graph-run.ts` (`runGraphStep`); the one-phase prompt and environment; `runBuild` handing it the work step; the admin host wiring; the work skill's one-phase section; the live check | Build Phases 1, 2, 4; `runBuild`, `build-session.ts`, `build-host.ts` |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | Phases naming dependencies show exactly those, every build phase also depending on Test Phase 1 when there is one; phases naming none depend on the one before; the first depends on nothing (A1, A2) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/lib/graph/declarations.test.ts |
| T2 | `Phase 6` and `Build Phase 6` name one phase under either heading form; the hook's reader and the package's give the same dependencies and files (A3) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/__tests__/phase-depends-parity.test.ts |
| T3 | A plan naming a missing phase, itself, or a loop is not run: the read refuses it naming the phase and the problem (A4) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs | apps/indusk-mcp/src/lib/graph/read-graph-refused.test.ts |
| T4 | Falsification, Cleanup, Audit and Maintenance phases are nodes with their declared or default dependencies; the steps that write them are not (A21) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/graph/read-graph.test.ts |
| T5 | A draft plan has no node; an approved, in-progress, or completed-with-an-open-phase plan has its open phases; a phase closed on the plan's branch is done (A39) | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/lib/graph/read-graph-status.test.ts |
| T6 | Independent phases are picked together; a dependent one only once its last dependency is done; a ready phase is not picked while the cap is full (A5, A6) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/graph/schedule-ready.test.ts |
| T7 | A phase waits only for a dependency, a running phase sharing a file, the cap, a question or amendment, or its own judgement or blocker, and says which; an undeclared phase shares with every phase; only the impl is exempt; two phases freed together never take one file; one phase's judgement holds back no other (A11 to A14, A17) | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/lib/graph/schedule-wait.test.ts |
| T8 | With the cap at one and phases naming nothing, the order equals today's one-phase-at-a-time build (A15) | Build Phase 1 | Build Phase 1 | planned | unit | a regression guard: the zero-migration claim of the dependency clause | apps/indusk-mcp/src/lib/graph/chain-parity.test.ts |
| T9 | In a phase's own worktree the gate hook lets its items be ticked while an earlier phase it does not depend on is open, refuses while a phase it depends on is open, and with no dependency lines refuses as today (A16) | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/__tests__/check-gates-depends.test.ts |
| T10 | With a session's phase set, the gate hook refuses ticking an item of any other phase, naming the session's phase (A9) | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/__tests__/check-gates-session-phase.test.ts |
| T11 | A plan's second phase session starts while its first runs; a second session on the same phase is refused naming the first (A37) | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager-parallel.test.ts |
| T12 | An admitted build's place covers one of its sessions; each further phase session takes its own place; a session beyond the cap is refused (A20) | Test Phase 1 | Build Phase 2 | planned | unit | promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/cap-per-phase.test.ts |
| T13 | A build run record keeps each running phase's process and reads running while any is alive; a record without phases still reads (A38) | Test Phase 1 | Build Phase 2 | planned | unit | a regression guard: a-run-is-read-from-its-record, which one process per run breaks once phases run together | apps/indusk-mcp/src/lib/run-record/record-phases.test.ts |
| T14 | `indusk run` refuses a plan the admin is building with the graph, naming the build (A33) | Test Phase 1 | Build Phase 2 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/run/refuse-graph-run.test.ts |
| T15 | Two phase sessions of one plan asking at the same moment get two questions with two ids, each naming its phase (A42) | Build Phase 2 | Build Phase 2 | planned | unit | promise: the-cost-sets-the-wait | apps/indusk-mcp/src/lib/questions/question-phase.test.ts |
| T16 | Two running phases sit in two worktrees on two `phase/<plan>/<kind>-<n>` branches cut from the plan's branch, one's work absent from the other's; Test Phase 2 and Build Phase 2 get different branches; neither is assigned as the plan's worktree (A23) | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/graph/phase-worktree.test.ts |
| T17 | A phase started again reuses its worktree and branch with its commits; a branch whose worktree is gone gets it back from the branch, never a fresh cut (A24) | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/graph/phase-resume.test.ts |
| T18 | A phase worktree and `indusk worktree create` run the same setup through one function; with no setup steps the lockfile's install runs; a failed step stops the phase naming it (A25) | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-phase-builds-on-its-own-branch/own-worktree | apps/indusk-mcp/src/lib/worktree/provision.test.ts |
| T19 | A phase depending on two joined phases starts with both phases' files (A26) | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-phase-builds-on-its-own-branch/starts-from-its-dependencies | apps/indusk-mcp/src/lib/graph/phase-start.test.ts |
| T20 | Phases branch from the plan's branch, never the trunk (A40) | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/graph/phase-base.test.ts |
| T21 | A green phase is fast-forwarded into the plan, the plan's worktree shows its files and the phase's worktree goes; a phase green alone but red once the plan is merged in is not joined and is sent back naming the tests; of two that break only together the first stays joined (A27, A28) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/join.test.ts |
| T22 | The merge scope's real selection on a fixture plan picks the phase's tests that pass at it, every clause named by a done phase's row or by a token in a changed file, and the Must-not-break tests; it leaves out rows not yet written and a row written at a done phase that passes only at a later one (A29) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/plans/test-set-merge.test.ts |
| T23 | A test phase joins when its own rows pass and each row it writes for a later phase fails on its own assertion; a row whose file does not load refuses the join, naming it (A30) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/join-test-phase.test.ts |
| T24 | A red check, a conflict outside the impl or a dirty worktree sends the phase back told why; the third failure stops it with its reason (A31) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/green-before-merging | apps/indusk-mcp/src/lib/graph/join-failed.test.ts |
| T25 | Two phases ticking boxes and filling result cells on neighbouring impl lines join with no session involved (A32) | Build Phase 4 | Build Phase 4 | planned | unit | parallel phases' impl ticks must never become a session's conflict (ADR decision D6) | apps/indusk-mcp/src/lib/graph/impl-join.test.ts |
| T26 | A phase that ran no test, or only deferred rows, is not joined; one touching a clause with no signal task in it or a done phase is not joined, naming the clause; one with both joins (A34, A35) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/every-phase-is-checked | apps/indusk-mcp/src/lib/graph/join-checked.test.ts |
| T27 | Joined work is on the plan's branch, not the trunk, until landing; nothing the join does moves the trunk (A36) | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-phase-builds-on-its-own-branch/only-the-plan-lands | apps/indusk-mcp/src/lib/graph/only-the-plan-lands.test.ts |
| T28 | The work step, with stand-in sessions, starts Phases 1 and 3 of the six-phase plan at once; a phase's end joins it and launches what waited only for it; Phase 5 starts once 2 and 3 have joined; the step returns when no phase is open (A5, A8) | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/graph-run.test.ts |
| T29 | With the real session manager and a stand-in process, a plan's second phase gets its own session, and one beyond the cap is refused and launched when a session ends (A7) | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/graph-run-launch.test.ts |
| T30 | A phase session's work prompt names its one phase and says to work only it, its environment names the phase, and a session sent back after a failed join is told why (A9) | Test Phase 1 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/ready-phases-start | apps/indusk-mcp/src/lib/build/work-prompt-phase.test.ts |
| T31 | Each phase end is followed by a fresh read before a launch; the tick launches a phase whose end event was missed; a join whose check never returns holds up no launch; two phases ending together join one after the other and their dependent starts once; a tick during a phase end starts each ready phase once (A18, A19) | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/graph-is-current | apps/indusk-mcp/src/lib/build/graph-run-current.test.ts |
| T32 | Ritual steps start only once every phase has joined; a phase a step writes is run by the graph before the next step (A22) | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/reviews-are-phases | apps/indusk-mcp/src/lib/build/graph-run-rituals.test.ts |
| T33 | A ready phase carrying a blocker or an item a person must judge is not launched, other phases go on, and the step then stops on that judgement or blocker (A17) | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-work-runs-as-a-graph/no-needless-wait | apps/indusk-mcp/src/lib/build/graph-run-judgement.test.ts |
| T34 | A phase session stopping on a question holds the plan: nothing new launches, running phases finish and join, the step ends on the question, the answer resumes the asking phase in its worktree and is told to it alone; an answer given while other phases finish is not refused, resumes the asking phase in the same run, and leaves nothing held; the freed-slot check judges the asking session alone (A42, A43) | Build Phase 5 | Build Phase 5 | planned | unit | promise: the-cost-sets-the-wait | apps/indusk-mcp/src/lib/build/graph-run-question.test.ts |
| T35 | A held question still frees its plan's place and resumes on the answer (A43) | Test Phase 1 | Test Phase 1 | planned | unit | promise: the-cost-sets-the-wait | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T36 | Approving a plan and closing a phase still end by naming the command for what runs next (A41) | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/models/next-session.test.ts |
| T37 | The manual one-phase path gives the same next step as today when no graph run is active (A44) | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: the graph step is added beside the manual path | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| T38 | While an amendment waits, the graph launches nothing, running phases finish, and the step stops on the amendment (A45) | Build Phase 5 | Build Phase 5 | planned | unit | a regression guard: a-change-to-what-was-agreed-needs-the-person, which the step loop checks before each step | apps/indusk-mcp/src/lib/build/graph-run-amendment.test.ts |
| T40 | With two phases of one plan running, the plan page and its nav row name both, and the run-record signals for where it is and whether it died judge each phase by its own process, reporting no break | Build Phase 5 | Build Phase 5 | planned | unit | a regression guard over a-run-is-read-from-its-record, which this slice must not falsely break (Sandy, 2026-10-20) | apps/indusk-mcp/src/lib/run-record/situation-phases.test.ts |
| T39 | A real plan with two independent phases and a dependent third, built from the admin's host with a scripted agent, runs the two at once and ends with all three on the plan's branch (A10) | Build Phase 5 | Build Phase 5 | planned | live check | a live check run at landing and release: the real run the clause signals report from; the clauses it touches are proved by the unit rows | apps/indusk-mcp/src/__tests__/run-graph.live.test.ts |

### Deferred Verification

- **A plan finishing in about the time of its longest chain** (the brief's expectation)
  - reason: real phases' durations over hours or days cannot be compressed into a test.
  - would require: the next plan with independent phases run to review.
  - mitigation: read from the launch and join times in the graph record when that plan reaches review.

## Checklist

### Test Phase 1: Author what can be authored, record what cannot

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/session/manager-parallel.test.ts, apps/indusk-mcp/src/lib/session/cap-per-phase.test.ts, apps/indusk-mcp/src/lib/run-record/record-phases.test.ts, apps/indusk-mcp/src/lib/run/refuse-graph-run.test.ts, apps/indusk-mcp/src/__tests__/check-gates-depends.test.ts, apps/indusk-mcp/src/__tests__/check-gates-session-phase.test.ts, apps/indusk-mcp/src/lib/build/work-prompt-phase.test.ts, apps/docs/src/changelog.md

This phase writes the tests whose subjects already exist — the session rule, the cap, the run record, the refusal in Dawn's run command, the gate hook and the work prompt, all of which must change, and the question slot, the boundary command and the manual path, which must not — and records, with a body, every test that waits for a module a later phase creates. It hands the build phases red tests to turn green and a register to check each later test against.

- [ ] Confirm this plan's worktree exists and is the one in use.
  <details><summary>Technical</summary>

  `indusk worktree create run-the-graph` (or `indusk worktree assign run-the-graph <path>` for one made another way). No `worktree: none` in frontmatter.

  </details>
- [ ] Write the per-phase session and cap tests so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T11 `apps/indusk-mcp/src/lib/session/manager-parallel.test.ts`: a build session on plan `p` phase `Build Phase 1`, then one on `Build Phase 2` must start (RED: refused as the same kind on the same plan); a second on `Build Phase 1` is refused naming the first (green). T12 `cap-per-phase.test.ts`: cap 4, `admitBuild("x", "p")`, three phase sessions of `p` and one session of plan `q` — a fifth start is refused at the cap (RED: today the second `p` session is refused as a duplicate, and an admitted build's sessions are all exempt). Pass `phase` in the start options with a cast until Build Phase 2 types it.

  </details>
- [ ] Write the run-record test and the test of Dawn's refusal so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T13 `lib/run-record/record-phases.test.ts`: a build record with `process: null` and `phases: [{ phase: "Build Phase 2", process: <this test's own pid> }]` reads `running` from `runStatus` (RED: liveness reads only `process`); a record with no `phases` reads as today. T14 `lib/run/refuse-graph-run.test.ts`: with such a record written for plan `p` under the project's machine-state home, starting Dawn's run on `p` is refused with a message naming the admin's build (RED: it starts).

  </details>
- [ ] Write the gate-hook and work-prompt tests so each fails on its own assertion today.
  <details><summary>Technical</summary>

  T9 `src/__tests__/check-gates-depends.test.ts`, through `gateTransition` from `__tests__/helpers/hook-runner.ts`: an impl where Build Phase 3 says `**Depends on**: none` and Build Phase 1 is open — ticking a Build Phase 3 implementation item exits 0 (RED: refused today, "complete Build Phase 1 gates first"); with Build Phase 3 depending on Build Phase 1 it is refused; an impl with no dependency lines is refused as today. T10 `src/__tests__/check-gates-session-phase.test.ts`: with `INDUSK_BUILD_PHASE=Build Phase 3`, ticking a Build Phase 1 item exits 2 naming Build Phase 3 (RED: allowed today). T30 `src/lib/build/work-prompt-phase.test.ts`: `stepPrompt("work", "p", …)` given phase `Build Phase 3` names it and says to work only that phase; `stepEnv` for it carries `INDUSK_BUILD_PHASE`; a retry note appears in the prompt (RED: the prompt says to work the open phases in order). Pass the phase with a cast until Build Phase 5 types it.

  </details>
- [ ] Confirm the guard tests for what must not change pass today.
  <details><summary>Technical</summary>

  T35 is the existing `lib/session/question-wait.test.ts`, T36 the existing `lib/models/next-session.test.ts`, T37 the existing `lib/build/next-step.test.ts`; all green, and they must stay green.

  </details>
- [ ] Record each later test in the register below and confirm none fails only on a missing file.
  <details><summary>Technical</summary>

  Every other row imports a module a later phase creates, so it is deferred with a body; none uses `.skip()`.

  </details>

#### Deferred to Build Phase 1

- **T1** to **T8** — import `readDeclarations`, `readGraph` and `pickPhasesToStart`, introduced in Build Phase 1. Body reviewed:

  ```typescript
  const d = readDeclarations(sixPhaseImpl); // P1, P3 none; P2 "Build Phase 1"; P5 "Build Phase 2, Build Phase 3"
  expect(d.dependsOn("Build Phase 5")).toEqual(["Test Phase 1", "Build Phase 2", "Build Phase 3"]);
  expect(readDeclarations(unlabelledImpl).dependsOn("Build Phase 2")).toEqual(["Build Phase 1"]);
  expect(phaseKey("Phase 6")).toBe("Build Phase 6");
  expect(() => readGraph(worktreeWith("**Depends on**: Build Phase 9"), "p")).toThrow(/Build Phase 9/);
  const r = pickPhasesToStart({ graph, running: [], stopped: [], waitingOn: null, room: 4 });
  expect(r.start.map((p) => p.phase)).toEqual(["Build Phase 1", "Build Phase 3"]);
  expect(r.waiting.find((w) => w.phase === "Build Phase 2")?.reason).toEqual({ kind: "dependency", on: "Build Phase 1" });
  ```

#### Deferred to Build Phase 2

- **T15** — imports the question writer Build Phase 2 adds, which takes the id under the history lock. Body reviewed:

  ```typescript
  const [a, b] = await Promise.all([
    askQuestion(root, "p", { ...input, phase: "Build Phase 1" }),
    askQuestion(root, "p", { ...input, phase: "Build Phase 3" }),
  ]);
  expect(a.id).not.toBe(b.id);
  expect(readQuestions(root, "p").map((q) => q.phase).sort()).toEqual(["Build Phase 1", "Build Phase 3"]);
  ```

#### Deferred to Build Phase 3

- **T16** to **T20** — import `startPhase` and `provisionWorktree`, introduced in Build Phase 3; they use real throwaway git repositories. Body reviewed:

  ```typescript
  const a = await startPhase(repo, "p", "Build Phase 1", { provision: noop });
  const b = await startPhase(repo, "p", "Build Phase 3", { provision: noop });
  expect(a.worktree).not.toBe(b.worktree);
  expect(a.branch).toBe("phase/p/build-1");
  expect(await tip(a.branch)).toBe(await tip("plan/p"));
  expect(livePlanCopy(repo, "p")).toBe(planWorktree); // never assigned
  await commitIn(a.worktree, "wip.ts");
  const again = await startPhase(repo, "p", "Build Phase 1", { provision: noop });
  expect(await tip(again.branch)).toBe(await tip(a.branch)); // resumed, not re-cut
  ```

#### Deferred to Build Phase 4

- **T21** to **T27** — import `joinPhase`, `joinImplLines` and the `merge` test-set scope, introduced in Build Phase 4. Body reviewed:

  ```typescript
  const r = await joinPhase({ repo, plan: "p", phase: "Build Phase 3", run: fixtureRunner, home });
  expect(r.outcome).toBe("joined");
  expect(existsSync(join(planWorktree, "src/three.ts"))).toBe(true);
  const set = planTestSet(readsOf(fixturePlan), { merge: { phase: build(3), done: [build(1)], changed } });
  expect(set.mustPass.map((f) => f.path)).toContain("src/clause-a.test.ts"); // For: clause on a Build Phase 1 row
  expect(set.mustPass.map((f) => f.path)).not.toContain("src/later.test.ts"); // written at Test Phase 1, passes at Build Phase 4
  const t = await joinPhase({ repo, plan: "p", phase: "Test Phase 1", run: realRunner, home });
  expect(t.outcome).toBe("joined"); // its later rows fail on their assertions
  ```

#### Deferred to Build Phase 5

- **T28**, **T29**, **T31** to **T34**, **T38**, **T39** — import the graph work step, introduced in Build Phase 5; T39 is a system-tier test. Body reviewed:

  ```typescript
  const manager = new SessionManager({ start: standIn, max: 4 });
  const step = runGraphStep(depsWith(manager, sixPhasePlan));
  await until(() => running(manager, "p").length === 2);
  expect(running(manager, "p").map((s) => s.phase)).toEqual(["Build Phase 1", "Build Phase 3"]);
  finish(manager, "Build Phase 1"); // stand-in ticks its boxes and commits
  await until(() => running(manager, "p").some((s) => s.phase === "Build Phase 2"));
  ```

#### Regression Guards

- **T35** — the held-question slot rule holds today; the row keeps it holding once sessions carry a phase.
- **T36** — the boundary command is right today; the row keeps the graph from changing what a boundary names.
- **T37** — the manual path works today; the row keeps the graph beside it, not instead of it.

#### Test Phase 1 Verification

- [ ] The per-phase session and cap tests exist and fail on their own assertions, not on a missing file.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager-parallel.test.ts src/lib/session/cap-per-phase.test.ts` — T11 fails because the second phase's start is refused (its same-phase case is green); T12 fails on its refusal assertion.

  </details>
- [ ] The run-record test and the test of Dawn's refusal exist and fail on their own assertions.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/run-record/record-phases.test.ts src/lib/run/refuse-graph-run.test.ts` — T13 reads `stopped` where it expects `running`; T14 finds no refusal.

  </details>
- [ ] The gate-hook and work-prompt tests exist and fail on their own assertions.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/__tests__/check-gates-depends.test.ts src/__tests__/check-gates-session-phase.test.ts src/lib/build/work-prompt-phase.test.ts` — T9 fails because the independent phase's tick is refused (its dependent-phase and no-lines cases are green); T10 fails because the other phase's tick is allowed; T30 fails because the prompt names no phase.

  </details>
- [ ] The guard tests pass today.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/lib/session/question-wait.test.ts src/lib/models/next-session.test.ts src/lib/build/next-step.test.ts` — T35, T36, T37 green.

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

- [ ] Add an Unreleased changelog line saying the per-phase session, cap and record tests were written first.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, Unreleased: "Tests: the per-phase session, cap, run-record and gate-hook rules are written before the graph."

  </details>

### Build Phase 1: The plan reads as a graph, and the gate hook judges by it

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/graph/declarations.ts, apps/indusk-mcp/src/lib/graph/declarations.test.ts, apps/indusk-mcp/src/lib/graph/read-graph.ts, apps/indusk-mcp/src/lib/graph/read-graph.test.ts, apps/indusk-mcp/src/lib/graph/read-graph-refused.test.ts, apps/indusk-mcp/src/lib/graph/read-graph-status.test.ts, apps/indusk-mcp/src/lib/graph/read-graph-signals.ts, apps/indusk-mcp/src/lib/graph/schedule.ts, apps/indusk-mcp/src/lib/graph/schedule-ready.test.ts, apps/indusk-mcp/src/lib/graph/schedule-wait.test.ts, apps/indusk-mcp/src/lib/graph/chain-parity.test.ts, apps/indusk-mcp/src/lib/graph/schedule-signals.ts, apps/indusk-mcp/hooks/_phase-depends.js, apps/indusk-mcp/hooks/check-gates.js, apps/indusk-mcp/src/__tests__/phase-depends-parity.test.ts, apps/indusk-mcp/src/__tests__/check-gates-depends.test.ts, apps/indusk-mcp/src/__tests__/check-gates-session-phase.test.ts, apps/indusk-mcp/skills/planner.md, .claude/skills/planner/SKILL.md, apps/indusk-mcp/templates/planning/CLAUDE.md, apps/docs/src/reference/skills/planner.md

This phase gives every phase of an impl two optional lines — the phases it needs and the files it writes — reads a plan's open phases from its branch as a graph, and decides, in one pure function, which ready phases start and why each other phase waits. A phase with no dependency line still depends on the one before it, so every existing plan runs as a chain. The gate hook learns the same lines, so a phase working in its own worktree is judged only against the phases it needs, and a session started for one phase cannot tick another phase's boxes. The planner and the planning rules teach the two lines, so new plans can use them.

- [ ] Read each phase's dependency line and files line, with the default chain.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/graph/declarations.ts`: `readDeclarations(implText)` parsed as `**Tier**:` is (`lib/models/tiers.ts`, outside fences by `fencedLineMask`). `phaseKey(name)`: `Test Phase N` or `Build Phase N` from a heading or a line, `Phase N` → `Build Phase N`, the words after the colon dropped (ADR D1). `dependsOn(phase)`: the named phases, `none` → nothing, no line → the phase before (the first: nothing); every build phase gains `Test Phase 1` when the impl has one. `files(phase)`: declared paths and globs, or `undeclared`. `fileSetsOverlap(a, b)` ignores only `.indusk/planning/<plan>/impl.md`; an undeclared set overlaps every set. T1.

  </details>
- [ ] Read an approved plan's open phases from its branch as a graph, and refuse a line naming an unknown phase, the phase itself or a loop.
  <details><summary>Technical</summary>

  `lib/graph/read-graph.ts`: `readGraph(planWorktree, plan)` reads `impl.md` in the plan's worktree; a phase closed there (`isOpen` from `lib/build/next-step.ts`) is done; nodes are open phases `{ phase, dependsOn, files, position, judgement, blocker }`, `judgement` the items `detectHumanGate` (`lib/build/judgement.ts`) finds, `blocker` the phase's blocker line. Status `approved`, `in-progress`, or `completed` with an open phase is read; a draft gives an empty graph (ADR D2). An unknown name, a self-dependency or a cycle throws a `GraphRefusal` naming the phase and the problem; the graph step (Build Phase 5) turns it into a `cannot-continue` stop. Review phases are ordinary nodes. T3, T4, T5.

  </details>
- [ ] Choose which ready phases start, and why each other phase waits, in one pure function.
  <details><summary>Technical</summary>

  `lib/graph/schedule.ts`: `pickPhasesToStart({ graph, running, stopped, waitingOn, room })` → `{ start, waiting }` (ADR D3). Reasons: `dependency` (named), `shares-file` (the running phase and the file, or `undeclared`), `cap`, `question` or `amendment` (`waitingOn`), `person` (the node's `judgement` or `blocker`). Starts chosen one at a time, each added to the running set before the next is judged. No reads, no clock. T6, T7, T8.

  </details>
- [ ] Make the gate hook judge a phase against the phases it depends on, not every earlier phase.
  <details><summary>Technical</summary>

  Read `apps/indusk-mcp/hooks/CLAUDE.md` first. New shared hook module `hooks/_phase-depends.js` (beside `_impl-headings.js`) mirrors `declarations.ts` (a hook cannot import `.ts`); `src/__tests__/phase-depends-parity.test.ts` feeds both the same forms (`none`, a fenced block, a missing line, a list, `Phase 6` against `### Build Phase 6:`, a Test Phase 1) and asserts equal results (T2). `hooks/check-gates.js`: the implementation-item loop (today every phase earlier in the document, around line 535) and Gates A and B (around lines 444–529) take the advancing phase's dependencies, direct and through them, in place of every earlier ordinal; with no dependency lines that set is every earlier phase, so behaviour and Dawn's probe are unchanged (ADR D9). `phaseOrdinal` stays for display. T9.

  </details>
- [ ] Make the gate hook refuse a phase session's tick of another phase's item, naming the session's phase.
  <details><summary>Technical</summary>

  `hooks/check-gates.js`: when `INDUSK_BUILD_PHASE` is set, a newly checked item under any other phase's heading exits 2 with "this session works <phase>; <other> is another phase's". The manual path sets no such variable. T10.

  </details>
- [ ] Teach the planner skill and the planning rules the two lines, and that a phase with no files line runs alone.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md` (never `.claude/skills/` directly; resync `.claude/skills/planner/SKILL.md` as the package rules say): where phases are cut, write `**Depends on**:` and `**Files**:` under each phase's `**Tier**:` line; no line means the phase before; the impl, alone, is never a shared file; a shared page is declared by each phase that edits it, and the plan's shared rules and changelog are written by a last phase that depends on the others. `apps/indusk-mcp/templates/planning/CLAUDE.md` "Impl phases are two sequences" entry: phases are ordered by their dependency lines, document position when there are none (the installed copy is refreshed by `indusk update`).

  </details>
- [ ] Report the signal for the clause that each phase names what it needs, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/a-phase-names-what-it-needs` — reported from `apps/indusk-mcp/src/lib/graph/read-graph-signals.ts`, called by `readGraph` after it builds the nodes (and before it throws a refusal). Judged against the impl text, not `readDeclarations`: a plain scan of headings and `**Depends on**:` lines outside fences gives the expected list (the named phases, nothing for `none`, the phase before when absent, nothing for the first, plus `Test Phase 1` for a build phase when present); each node's `dependsOn` must equal it, and a name the scan does not find among the headings, or a loop, is `broken`. `writeClauseSignals(root, "run-graph.read", plan, { plan: "run-the-graph", phase: "Build Phase 1" }, verdicts)` from `lib/promises/clause-signal.ts`; `broken` names the plan, the phase and both lists. Best-effort.

  </details>
- [ ] Report the signal for the clause that review phases are phases of the graph, on every graph read.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/reviews-are-phases` — read half, reported from `apps/indusk-mcp/src/lib/graph/read-graph-signals.ts`, same call. A plain heading scan finds each open phase whose heading names Falsification, Cleanup, Audit or Maintenance; each must have a node with its declared or default dependencies, and no node may be a step (planning, the audit step, falsify or cleanup authoring, the retrospective). `broken` names the plan and the heading. The step half is reported in Build Phase 5. Best-effort.

  </details>
- [ ] Report the signal for the clause that no phase waits without a reason, after each scheduling call.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/no-needless-wait` — reported from `apps/indusk-mcp/src/lib/graph/schedule-signals.ts`, `reportScheduleSignals(root, plan, result)`, which the graph step calls after each `pickPhasesToStart` (Build Phase 5); the scheduler stays pure. It re-derives each waiting phase's reason from its own reads: dependencies by a plain scan of `git show plan/<plan>:<impl>`, running phases from `admin-sessions.json`, overlap on the declared strings, on the declared sets expanded against `git ls-files` at the plan branch's tip, and on each running phase branch's `git diff --name-only plan/<plan>...phase/<plan>/<kind>-<n>`. A waiting phase whose reason is none of dependency, shared file, cap, question or amendment, or its own judgement or blocker — or a ready phase with none not started — is `broken`, naming it. `writeClauseSignals(root, "run-graph.schedule", plan, { plan: "run-the-graph", phase: "Build Phase 1" }, verdicts)`. Best-effort.

  </details>

#### Build Phase 1 Verification

- [ ] The declaration, parity, graph, scheduler and gate-hook tests pass, and the existing gate-hook tests stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/declarations.test.ts src/__tests__/phase-depends-parity.test.ts src/lib/graph/read-graph-refused.test.ts src/lib/graph/read-graph.test.ts src/lib/graph/read-graph-status.test.ts src/lib/graph/schedule-ready.test.ts src/lib/graph/schedule-wait.test.ts src/lib/graph/chain-parity.test.ts src/__tests__/check-gates-depends.test.ts src/__tests__/check-gates-session-phase.test.ts && pnpm exec vitest related src/lib/graph/declarations.ts src/lib/graph/read-graph.ts src/lib/graph/schedule.ts hooks/check-gates.js hooks/_phase-depends.js` — T1 to T10 pass.

  </details>
- [ ] This plan's own impl still passes the save check and the gate hook as before.
  <details><summary>Technical</summary>

  Re-save this file through the Edit tool — no refusal; `readGraph` on it names no unknown phase and no loop.

  </details>

#### Build Phase 1 Context

- [ ] Hold, as a guard, that phase dependencies and files are read by one parser in the package and one module in the hooks.
  <details><summary>Technical</summary>

  guard: a single-definition scan in `declarations.test.ts`, which carries `clause: the-work-runs-as-a-graph/a-phase-names-what-it-needs`, and `phase-depends-parity.test.ts` holding the hook module equal. The package's `CLAUDE.md` "Run the graph" section is written once, by Build Phase 5, so parallel phases never edit it.

  </details>

#### Build Phase 1 Document

- [ ] Describe the two lines and the default chain on the planner skill's reference page.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/planner.md`: the two lines, how a phase is named, the default chain, that only the impl is exempt from overlap, and that a bad line stops the build when it is read. The guide page is Build Phase 4's and Build Phase 5's.

  </details>

### Build Phase 2: Sessions, the run record and questions carry the phase

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/session/manager.ts, apps/indusk-mcp/src/lib/session/manager-parallel.test.ts, apps/indusk-mcp/src/lib/session/cap-per-phase.test.ts, apps/indusk-mcp/src/lib/run-record/record.ts, apps/indusk-mcp/src/lib/run-record/liveness.ts, apps/indusk-mcp/src/lib/run-record/record-phases.test.ts, apps/indusk-mcp/src/lib/run/graph-refusal.ts, apps/indusk-mcp/src/bin/commands/run.ts, apps/indusk-mcp/src/lib/run/refuse-graph-run.test.ts, apps/indusk-mcp/src/lib/questions/record.ts, apps/indusk-mcp/src/lib/questions/history.ts, apps/indusk-mcp/src/lib/questions/question-phase.test.ts, apps/docs/src/decisions/sessions-per-plan.md

This phase lets one plan have several build sessions at once, one per phase: a session is known by its plan, its kind and its phase, and only a second session on the same phase is refused. Each phase session after the first takes its own place under the machine's session cap. The build's run record keeps every running phase's process and reads the build running while any of them lives, so the admin does not read a plan stopped while one of its phases still works. Dawn's run command refuses a plan the admin is building this way, and a question remembers which phase asked it and gets an id no other question can share.

- [ ] Identify a session by plan, kind and phase, refusing only a second session on the same phase.
  <details><summary>Technical</summary>

  `lib/session/manager.ts`: `SessionRecord` and `ManagedStart` gain `phase?: string`; `refusalFor` refuses a second session of the same project, plan, kind and phase (no phase equals no phase, so planning sessions and the manual path are unchanged), naming the running one (`alreadyRunningOnThisPlan` names the phase when there is one); `forPlan(project, plan, kind, phase?)` matches the phase when given. The promise `a-session-belongs-to-its-plan` already reads the brief's changed sentence. T11.

  </details>
- [ ] Count every phase session under the cap, the build's admission covering one.
  <details><summary>Technical</summary>

  `lib/session/manager.ts` `capRefusal`: an admitted build's place covers at most one of its running sessions; every further build session of that plan counts as its own session against `sessions.max`. T12.

  </details>
- [ ] Keep each running phase's process in the build's run record, and read the build running while any of them lives.
  <details><summary>Technical</summary>

  `lib/run-record/record.ts`: `RunRecord` gains optional `phases: { phase: string; process: RunProcess | null }[]`; reading a record without it gives `[]`. `lib/run-record/liveness.ts` `runStatus`: running when the record's own process or any listed phase process is alive (same program and start check), or the daemon holds it. The admin writes the list in Build Phase 5. T13.

  </details>
- [ ] Make Dawn's run command refuse a plan the admin is building with the graph, naming the build.
  <details><summary>Technical</summary>

  `lib/run/graph-refusal.ts` `graphBuildRefusal(projectRoot, plan)`: reads the plan's build run record under the project's machine-state home; a record with a live listed phase process gives "`<plan>` is being built by the admin (phases: …) — stop that build first". `bin/commands/run.ts` calls it before the loop starts and exits 1 with it. T14.

  </details>
- [ ] Give a question the phase that asked it, and take its id under the history lock.
  <details><summary>Technical</summary>

  `lib/questions/record.ts`: `Question` gains optional `phase`. `lib/questions/history.ts`: `askQuestion(root, plan, input)` takes `nextQuestionId` and writes the record inside the one history lock (`lib/plans/history.ts`), so two askers never share an id; the build session's store uses it in Build Phase 5. T15.

  </details>

#### Build Phase 2 Verification

- [ ] The session, cap, run-record, refusal and question tests pass, and the existing manager, record and question tests stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager-parallel.test.ts src/lib/session/cap-per-phase.test.ts src/lib/run-record/record-phases.test.ts src/lib/run/refuse-graph-run.test.ts src/lib/questions/question-phase.test.ts && pnpm exec vitest related src/lib/session/manager.ts src/lib/run-record/record.ts src/lib/run-record/liveness.ts src/lib/run/graph-refusal.ts src/lib/questions/history.ts` — T11 to T15 pass; T35 stays green.

  </details>

#### Build Phase 2 Context

- [ ] Hold, as a guard, that a session is refused only on the same plan, kind and phase.
  <details><summary>Technical</summary>

  guard: `manager-parallel.test.ts` carries `promise: a-session-belongs-to-its-plan`; the rule's text goes into the package's `CLAUDE.md` with Build Phase 5.

  </details>

#### Build Phase 2 Document

- [ ] Update the sessions-per-plan decision page to say a plan may run one session per phase.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/sessions-per-plan.md`: an addendum dated with the change — one session per plan, kind and phase; each phase session counted under the cap; pointer to `/decisions/run-the-graph`.

  </details>

### Build Phase 3: A phase gets its own worktree and branch

**Tier**: med — the step's default tier for work
**Depends on**: none
**Files**: apps/indusk-mcp/src/lib/worktree/provision.ts, apps/indusk-mcp/src/lib/worktree/provision.test.ts, apps/indusk-mcp/src/lib/worktree/plan-worktree-commands.ts, apps/indusk-mcp/src/bin/commands/worktree.ts, apps/indusk-mcp/src/lib/graph/phase-branch.ts, apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts, apps/indusk-mcp/src/lib/graph/phase-worktree.test.ts, apps/indusk-mcp/src/lib/graph/phase-resume.test.ts, apps/indusk-mcp/src/lib/graph/phase-start.test.ts, apps/indusk-mcp/src/lib/graph/phase-base.test.ts, apps/docs/src/reference/cli/worktree.md

This phase gives each running phase a place of its own: a branch named for the plan and the phase, cut from the plan's branch so it holds every phase it depends on, and a worktree beside the plan's, set up exactly as a plan's worktree is. A phase started again picks up its own branch and worktree with its earlier commits, never a fresh cut, and a phase worktree is never recorded as the plan's, so everything that reads the plan still reads the plan's own worktree. A joined phase's worktree can be removed in the background while its branch is kept.

- [ ] Set up every new worktree through one function, used both by worktree create and by phase worktrees.
  <details><summary>Technical</summary>

  `lib/worktree/provision.ts` `provisionWorktree(projectRoot, worktreePath, { run })`: copy `.mcp.json` (`provisionMcpJson`), the environment provisioning (`provisionWorktreeEnv` when the project uses it), then the install — the project's `post_create` steps when it declares them, else the install command its lockfile names (`pnpm install` for `pnpm-lock.yaml`, and so on); the first failing command is returned, named. `createPlanWorktree` (`lib/worktree/plan-worktree-commands.ts`) and the normal-mode `worktree create` in `bin/commands/worktree.ts` call it, so the "install the project's dependencies there" line goes. T18.

  </details>
- [ ] Cut a phase's branch and worktree from its plan's branch, or resume the ones it has, never assigning it as the plan's worktree.
  <details><summary>Technical</summary>

  `lib/graph/phase-branch.ts` `startPhase(projectRoot, plan, phase, { provision })`: branch `phase/<plan>/test-<n>` or `phase/<plan>/build-<n>` from `phaseKey`; worktree `<project>-worktrees/<plan>--<kind>-<n>` (`lib/worktree/layout.ts`). An existing branch with a live worktree is returned as it is; an existing branch whose worktree is gone gets `git worktree add <path> <branch>`; only a missing branch is cut, `git worktree add -b <branch> <path> plan/<plan>`, then `provisionWorktree`. Never calls `assignPlan`, so `livePlanCopy` still answers the plan's own worktree. A failed setup returns `{ stopped: <command> }`. T16, T17, T19, T20.

  </details>
- [ ] Remove a joined phase's worktree in the background, keeping its branch.
  <details><summary>Technical</summary>

  `lib/graph/phase-branch.ts` `removePhaseWorktree(projectRoot, plan, phase)`: `git worktree remove --force <path>` spawned detached, never awaited by its caller and never raising; the branch stays until the plan lands. Called by the join in Build Phase 4. T21 checks the worktree is gone after the join settles.

  </details>
- [ ] Report the signal for the clause that each running phase has its own worktree and branch, at each start and resume.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/own-worktree` — reported from `apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts`, called by `startPhase` after it returns a worktree. Plain git, not the layout code: the branch name equals the signal's own rule for the phase's kind and number; `git worktree list --porcelain` shows the worktree on that branch and no other worktree on it; `git merge-base --is-ancestor` finds the branch's first commit on `plan/<plan>`'s history; the plan's assignment record still names the plan's own worktree; and for a resume, the tip equals the tip read before the call and the branch's reflog shows no re-creation. `writeClauseSignals(root, "run-graph.phase-branch", plan, { plan: "run-the-graph", phase: "Build Phase 3" }, verdicts)`; `broken` names the phase and what failed. Best-effort.

  </details>
- [ ] Report the signal for the clause that a phase starts with its dependencies' work, at each start.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/starts-from-its-dependencies` — reported from `apps/indusk-mcp/src/lib/graph/phase-branch-signals.ts`, same call. For each dependency (a plain scan of the impl's dependency lines), its last joined tip — the `plan/<plan>` reflog entry naming `phase/<plan>/<kind>-<n>` — must be an ancestor of the worktree's `HEAD`, and `git ls-files -u` must be empty there. `broken` names the phase and the missing dependency. Best-effort.

  </details>

#### Build Phase 3 Verification

- [ ] The setup, branch, resume, start and base tests pass on real throwaway repositories, and the existing worktree tests stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/worktree/provision.test.ts src/lib/graph/phase-worktree.test.ts src/lib/graph/phase-resume.test.ts src/lib/graph/phase-start.test.ts src/lib/graph/phase-base.test.ts && pnpm exec vitest related src/lib/worktree/provision.ts src/lib/worktree/plan-worktree-commands.ts src/bin/commands/worktree.ts src/lib/graph/phase-branch.ts` — T16 to T20 pass.

  </details>

#### Build Phase 3 Context

- [ ] Hold, as a guard, that a phase worktree is never assigned as its plan's.
  <details><summary>Technical</summary>

  guard: `phase-worktree.test.ts` carries `clause: a-phase-builds-on-its-own-branch/own-worktree` and scans `src/lib/graph/` for an `assignPlan` call. The rule's text goes into the package's `CLAUDE.md` with Build Phase 5.

  </details>

#### Build Phase 3 Document

- [ ] Describe phase worktrees and the shared setup on the worktree command's reference page.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/worktree.md`: `worktree create` now runs the install; phase worktrees (`<plan>--<kind>-<n>` on `phase/<plan>/<kind>-<n>`) are made by the build, set up the same way, never assigned, removed after their join.

  </details>

### Build Phase 4: A finished phase joins its plan only when green

**Tier**: strong — the join's check and the fast-forward are what keep a plan's branch green while phases run side by side
**Depends on**: Build Phase 3
**Files**: apps/indusk-mcp/src/lib/graph/record.ts, apps/indusk-mcp/src/lib/graph/impl-join.ts, apps/indusk-mcp/src/lib/graph/join.ts, apps/indusk-mcp/src/lib/graph/join-signals.ts, apps/indusk-mcp/src/lib/graph/join.test.ts, apps/indusk-mcp/src/lib/graph/join-test-phase.test.ts, apps/indusk-mcp/src/lib/graph/join-failed.test.ts, apps/indusk-mcp/src/lib/graph/impl-join.test.ts, apps/indusk-mcp/src/lib/graph/join-checked.test.ts, apps/indusk-mcp/src/lib/graph/only-the-plan-lands.test.ts, apps/indusk-mcp/src/lib/plans/test-set.ts, apps/indusk-mcp/src/lib/plans/test-set-merge.test.ts, apps/indusk-mcp/src/lib/plans/land.ts, apps/indusk-mcp/src/lib/plans/approve.ts, apps/docs/src/guide/phases-in-parallel.md

This phase adds a phase's end: the plan's branch is merged into the finished phase, the impl's ticks and result cells from both sides are combined line by line, the phase's tests and the tests of every clause the plan has touched run on that result, and only a green result moves the plan's branch forward, in the plan's own worktree so its files follow. A test phase is judged by the test-phase rule, so its tests that are red on purpose never block it. A red check or a conflict sends the phase back to its own session; the third failure stops it without stopping anything that does not need it. Nothing here moves the trunk.

- [ ] Add the record a plan's graph run keeps in machine state.
  <details><summary>Technical</summary>

  `lib/graph/record.ts`: `appendGraphRecord(home, plan, entry)`, one never-raising writer modelled on the plan-timing writer, file `graph/<plan>.jsonl` under the `indusk eval home` directory; entries `run-started`, `launched`, `ended`, `join { phase, outcome: joined | red | conflict | dirty | unchecked, commit, report }`, `stopped { phase, why }`. `readGraphRecord` drops a torn last line; `attemptsSince(entries, phase)` counts failed joins since the last `run-started` (ADR D8).

  </details>
- [ ] Choose the join check's tests: the phase's own, those of every clause the plan has touched, and what must not break.
  <details><summary>Technical</summary>

  `lib/plans/test-set.ts`: `TestSetRow` gains `for`; new scope `{ merge: { phase, done: PhaseRef[], changed: string[], tokens: (path) => string[] } }` returning `mustPass` and `mustFail`. Must pass: rows of this phase or a done phase whose Passes-at phase is this one or a done one, every row whose `For` names a clause such a row names or whose `clause:`/`promise:` token appears in a changed file, and the Must-not-break promises' tests. Must fail on an assertion (a test phase only): the rows this test phase writes whose Passes-at phase is later. A row whose Passes-at phase has not joined is in neither. T22 runs it on a fixture plan with nothing injected, including a row written at a done Test Phase 1 that passes at a later build phase.

  </details>
- [ ] Merge the plan's branch into a finished phase, combining the impl's ticks and cells line by line and sending any other conflict back.
  <details><summary>Technical</summary>

  `lib/graph/join.ts` `joinPhase({ projectRoot, plan, phase, run, home })`, in ADR D6's order. Dirty phase worktree → `dirty`. `git merge plan/<plan>` in the phase worktree; if `impl.md` is the only unmerged path, `lib/graph/impl-join.ts` `joinImplLines(base, ours, theirs)` runs `git merge-file -p --diff3` over the three stages (`git show :1:`, `:2:`, `:3:`) and resolves each conflict block whose three versions have the same line count by taking, per line, the side that changed it (equal changes are fine); any block it cannot resolve, or any other unmerged path → `git merge --abort`, outcome `conflict` naming the files. T25.

  </details>
- [ ] Run the check on the merged result, judge a test phase by the test-phase rule, and refuse a join that ran no test or carries a touched clause with no signal.
  <details><summary>Technical</summary>

  `run(files, reportPath)` runs the project's test command on `mustPass ∪ mustFail` in the phase worktree with the JSON reporter (`--reporter=json --outputFile=<home>/graph/reports/<sha>.json`). Red in `mustPass` → `red` naming the failing tests. Each `mustFail` file must have run with at least one assertion failure; a file with no assertion results (it did not load) or one already all green → `red` naming it. Empty `mustPass` with no test run, or zero non-skipped tests → `unchecked`. For each clause the phase touches (its rows' `For`, tokens in `git diff --name-only plan/<plan>...HEAD`), a signal task for it must be in this phase's section or a done phase's, read with `lib/promises/clause-signal-rules.ts`; otherwise `unchecked` naming the clause. T21, T23, T26.

  </details>
- [ ] Move the plan's branch forward in the plan's worktree only on a green result, repeating if it moved meanwhile.
  <details><summary>Technical</summary>

  In the plan's worktree, `git merge --ff-only phase/<plan>/<kind>-<n>`; refused because `plan/<plan>` moved → repeat from the merge (not an attempt); refused for local changes in the plan's worktree → `stopped` naming them. On success append `join … joined` and call `removePhaseWorktree` (Build Phase 3). The graph step calls `joinPhase` for one phase of a plan at a time (Build Phase 5). T21, T27.

  </details>
- [ ] Send a failed phase back to its session up to three attempts, then stop it with its reason.
  <details><summary>Technical</summary>

  `nextForPhase(entries, phase, outcome)` in `join.ts` answers `retry` with the reason to tell the session while `attemptsSince` is under three, else appends `stopped` and answers `stop`. Same tier on retry (ADR open decision). T24.

  </details>
- [ ] Report the signal for the clause that a phase joins only when green, after each join and on each tick.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/green-before-merging` — reported from `apps/indusk-mcp/src/lib/graph/join-signals.ts`, `reportJoinSignals(root, plan)`, called by `joinPhase` after a fast-forward and by the graph step's tick (Build Phase 5). It walks `git reflog show --date=iso plan/<plan>` past the last entry it judged (kept in its own file beside the reports). A move whose new tip brings a `phase/<plan>/*` tip must have `<home>/graph/reports/<new tip>.json` in which every expected test passed, the expected list recomputed by a plain scan of the trajectory read as text at the new tip: the `Test` file of every row of a phase closed there whose Passes-at phase is closed there, the test files of every clause those rows' `For` cells name or a `clause:`/`promise:` token in `git diff --name-only <trunk>...<new tip>` names, and the `tests:` each Must-not-break promise's file lists (the brief's Must-not-break names, read as text). For a test phase's join, each row it wrote that passes later must be in the report with an assertion failure. A move bringing no phase tip while `admin-sessions.json` shows a phase session of the plan running is `broken` as an outside move. `writeClauseSignals(root, "run-graph.join", plan, { plan: "run-the-graph", phase: "Build Phase 4" }, verdicts)`; `broken` names the commit and what was red, missing or left out. Best-effort.

  </details>
- [ ] Report the signal for the clause that every joined phase was checked, after each join.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/every-phase-is-checked` — reported from `apps/indusk-mcp/src/lib/graph/join-signals.ts`, same call. The report for the new tip (not the record) shows at least one test that ran and was not skipped; for each clause the joined phase touches (its rows' `For` cells read as text, tokens in its changed files), a task naming that clause's signal exists in its section or a closed phase's section, read with the rule in `lib/promises/clause-signal-rules.ts`. `broken` names the phase and "no test ran" or the clause. Best-effort.

  </details>
- [ ] Report the signal for the clause that only a plan's branch reaches the trunk, after each landing, each approval and on each tick.
  <details><summary>Technical</summary>

  signal: `a-phase-builds-on-its-own-branch/only-the-plan-lands` — reported from `apps/indusk-mcp/src/lib/graph/join-signals.ts`, `reportLandsSignal(root, trunk, landedPlan?)`, called by `lib/plans/land.ts` after the landing merge, by `lib/plans/approve.ts` after its approval merge, and by the graph step's tick (Build Phase 5). Plain git, never commit subjects: the phase tips are each `git for-each-ref refs/heads/phase/` tip and each tip `git reflog show plan/<plan>` records being merged in; each one that `git merge-base --is-ancestor`s the trunk must be an ancestor of a landing merge's second parent. At a landing, each promise the brief's "This plan makes" names must read `state: enforced` in `git show <second parent>:.indusk/promises/<name>.md`. An approval merge brings only documents and reads upheld. `broken` names the phase tip and the trunk commit, or the unconfirmed promise. Best-effort.

  </details>

#### Build Phase 4 Verification

- [ ] The join, test-phase, retry, impl-line, check and trunk tests pass on real throwaway repositories, and the existing landing and test-set tests stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/graph/join.test.ts src/lib/graph/join-test-phase.test.ts src/lib/graph/join-failed.test.ts src/lib/graph/impl-join.test.ts src/lib/graph/join-checked.test.ts src/lib/graph/only-the-plan-lands.test.ts src/lib/plans/test-set-merge.test.ts && pnpm exec vitest related src/lib/graph/join.ts src/lib/graph/impl-join.ts src/lib/graph/record.ts src/lib/graph/join-signals.ts src/lib/plans/test-set.ts src/lib/plans/land.ts src/lib/plans/approve.ts` — T21 to T27 pass.

  </details>

#### Build Phase 4 Context

- [ ] Hold, as a guard, that a plan's branch moves from a phase only by the checked fast-forward.
  <details><summary>Technical</summary>

  guard: `join.test.ts` carries `clause: a-phase-builds-on-its-own-branch/green-before-merging` and scans `src/` for another `merge --ff-only phase/` caller. The rule's text goes into the package's `CLAUDE.md` with Build Phase 5.

  </details>

#### Build Phase 4 Document

- [ ] Start the guide page for phases in parallel with what a join does.
  <details><summary>Technical</summary>

  New `apps/docs/src/guide/phases-in-parallel.md`: "When a phase finishes" — merge the plan in, combine the impl's lines, check (the phase's tests, the touched clauses', the Must-not-break tests; the test-phase rule), fast-forward, or back to the session; three attempts; a Mermaid sequence. Build Phase 5 adds the rest.

  </details>

### Build Phase 5: The admin's build runs the phases as a graph

**Tier**: strong — joins the scheduler, the sessions, the branches and the join, and decides when each read and launch happens
**Depends on**: Build Phase 1, Build Phase 2, Build Phase 4
**Files**: apps/indusk-mcp/src/lib/build/graph-run.ts, apps/indusk-mcp/src/lib/build/graph-run-signals.ts, apps/indusk-mcp/src/lib/build/runner.ts, apps/indusk-mcp/src/lib/build/index.ts, apps/indusk-mcp/src/lib/build/build-session.ts, apps/indusk-mcp/src/lib/build/graph-run.test.ts, apps/indusk-mcp/src/lib/build/graph-run-launch.test.ts, apps/indusk-mcp/src/lib/build/work-prompt-phase.test.ts, apps/indusk-mcp/src/lib/build/graph-run-current.test.ts, apps/indusk-mcp/src/lib/build/graph-run-rituals.test.ts, apps/indusk-mcp/src/lib/build/graph-run-judgement.test.ts, apps/indusk-mcp/src/lib/build/graph-run-question.test.ts, apps/indusk-mcp/src/lib/build/graph-run-amendment.test.ts, apps/indusk-admin/src/lib/build-host.ts, apps/indusk-mcp/skills/work.md, .claude/skills/work/SKILL.md, apps/indusk-mcp/src/__tests__/run-graph.live.test.ts, apps/indusk-mcp/vitest.tiers.ts, apps/indusk-mcp/CLAUDE.md, CLAUDE.md, apps/docs/src/guide/phases-in-parallel.md, apps/docs/src/decisions/run-the-graph.md, apps/docs/src/reference/skills/work.md, apps/docs/src/changelog.md

This phase connects the pieces inside the admin's existing build. When the build reaches its work step for a plan that is not a workbench plan, it runs the plan's phases as a graph: every ready phase gets its own branch and a session told to work that one phase, each finished phase is joined into the plan, the plan is read again, and what is now ready starts — until no phase is open, when the build goes on to its review steps as today. One launcher does every launch, and joins never hold one up. A phase a person must judge is not started and still stops the build once nothing else can run; a waiting amendment stops new launches; a question holds the whole plan and an answer given early is kept. The work skill tells a session started for one phase how to work. As the last phase, it writes the plan's shared rules section, the guide's remaining sections and the changelog entry.

- [ ] Run the work step as a graph: launch every ready phase, join each as it ends, read the plan again, and launch what is now ready.
  <details><summary>Technical</summary>

  `lib/build/graph-run.ts`: `runGraphStep(deps)` with `deps` = `{ readGraph, schedule, startPhase, startSession, joinPhase, record, room, now, tick }`. Append `run-started`. One launcher: `pass()` is single-flight — a call while a pass runs sets an `again` flag and the running pass loops once more; session ends, join results and the tick only call `pass()` (ADR D4). A pass reads the graph from the plan's worktree (a `GraphRefusal` returns `cannot-continue` naming it), calls `pickPhasesToStart` with `room` from the session manager's cap, then `reportScheduleSignals`, and for each start runs `startPhase` then `startSession` (`step: "work"`, the phase's worktree, its phase, its tier's model from `buildStepModel`), appending `launched`. On a session's end: `ended`; when its phase is closed in its worktree, push it on the plan's join queue, which runs `joinPhase` one at a time and is never awaited by `pass()`; `retry` relaunches the session with the reason, `stop` marks it stopped; any other end (the phase not closed, an error) is a failed attempt the same way. Returns when nothing is open, running, joining or ready: `done`, a person's stop (below), or `cannot-continue` naming stopped phases. T28, T31.

  </details>
- [ ] Hand the build's work step to the graph for a plan that is not a workbench plan, and start ritual steps only when every phase has joined.
  <details><summary>Technical</summary>

  `lib/build/runner.ts` `runBuild`: when `nextBuildStep` answers `work` and `deps.runGraph` is given, call it instead of `deps.run("work", phase)`; its `cannot-continue`, `judgement`, `amendment` and `question` stops end the run as they do today. Audit, falsify, cleanup and retrospective steps run as today; `nextBuildStep` answers `work` while a phase is open, so a phase a ritual wrote runs as a graph before the next step. A workbench plan gets no `runGraph` (ADR D4). Export from `lib/build/index.ts`. T32.

  </details>
- [ ] Tell each phase session its one phase and why it was sent back, name the phase in its environment, tell only the asking phase its answers, and judge a freed place on the asking session alone.
  <details><summary>Technical</summary>

  `lib/build/build-session.ts`: `stepPrompt` and `runStepSession` take `phase` and an optional `retry` note; the `work` text for a phase session reads "Work only <phase> of the plan; leave every other phase as it is; end when <phase> is closed", the retry note after it; `stepEnv` adds `INDUSK_BUILD_PHASE=<phase>`, which the gate hook enforces (Build Phase 1); `phase` is passed to `manager.start`. The decision store records questions through `askQuestion` with the session's phase (Build Phase 2); `told` takes only untold answers whose question has this session's phase or none. The `a-hold-frees-the-slot` check uses `forPlan(project, plan, "build", phase)`. The manual path and a workbench plan keep today's text. T30, T34.

  </details>
- [ ] Keep a declared judgement, a blocker and a waiting amendment stopping the build, without holding back phases that do not need them.
  <details><summary>Technical</summary>

  The scheduler leaves a node with `judgement` items or a `blocker` waiting with reason `person` (Build Phase 1). When nothing is running, joining or ready and such a phase waits, `runGraphStep` returns `{ step: "judgement", phase, item, items }` (or `cannot-continue` naming the blocker), the stop `nextBuildStep` gives today. Each pass reads the plan's amendments with the graph (`readBuildPlan`'s `amendments`); while one waits, `waitingOn` is `amendment`, nothing launches, and once running phases end the step returns `{ step: "amendment", amendments }`. T33, T38.

  </details>
- [ ] Hold the whole plan when a phase session stops on a question, and resume the asking phase in its worktree on the answer, keeping an answer given while others finish.
  <details><summary>Technical</summary>

  A phase session returning `waiting` (a question that holds): `waitingOn` becomes `question`, nothing more launches, running phases end and join; then, unless the question's record now reads answered, return `{ step: "question", id }`, which `startBuild` already turns into `holdQuestion(project, plan)`. If it reads answered, resume the asking phase with `startPhase` and a session told the answer, and carry on. `resumeAfterQuestion` in `apps/indusk-admin/src/lib/build-host.ts`, finding the plan's build running, releases the question and returns the running state instead of calling `startBuild`; the stop handler calls `holdQuestion` only for a question still unanswered. A later answer restarts the build as today; the graph resumes the asking phase from its branch. T34.

  </details>
- [ ] Host the graph step in the admin's build: launch phase sessions through its one session manager, keep each phase's process in the run record, and tick every thirty seconds.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `depsFor`: for a plan that is not a workbench plan, supply `runGraph`, wiring `startSession` to `runStepSession` with `manager: sessionManager()`, the phase's worktree and its phase, and `room` from the manager's cap; each phase's `onSession` writes its process into the record's `phases` (Build Phase 2) and removes it when the session ends. The graph is read from `planLocation`'s worktree, the plan's own. A 30-second tick (`setInterval`, cleared when the step returns) calls the step's `pass()` — it never launches on its own — and `reportJoinSignals` and `reportLandsSignal`. T29.

  </details>
- [ ] Tell a session started for one phase, in the work skill, how to work: in its own worktree, on its phase alone, leaving what comes next to the build.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/work.md` (resync `.claude/skills/work/SKILL.md`), new section "When you were started for one phase" placed before "Work through the checklist in order", which it overrides for such a session: your phase is the one your prompt and `INDUSK_BUILD_PHASE` name; work it only, starting from its first unchecked item; read and tick the impl in your own worktree, never through the plan-status tools; never create, assign or leave your worktree; never change the impl's `status`; commit on your branch; end by running `indusk plans next-session <plan>` as always — the build, not you, joins your phase and starts what is next. It covers the work skill's lines the inventory marks blocking (ADR table).

  </details>
- [ ] Write the live check that builds a real three-phase plan from the admin's host with a scripted agent.
  <details><summary>Technical</summary>

  `src/__tests__/run-graph.live.test.ts`, added to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`: a fixture plan with Phases 1 and 2 independent and 3 depending on both, built through `startBuild` with a scripted agent process that ticks its phase's boxes, commits and exits; asserts two phase sessions overlapped and all three phases are on `plan/<plan>`. It proves no clause; it is the real run the clause signals report from, and its result is recorded in the retrospective. T39.

  </details>
- [ ] Report the signal for the clause that ready phases start within a minute, at each launch and on each tick.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/ready-phases-start` — reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, called after each launch and on each tick while the build runs. Not from the graph record: a phase's ready time is the first `git reflog show --date=iso plan/<plan>` entry whose commit has its last dependency's `phase/` tip as an ancestor (a fast-forward and a merge read alike), or, with no dependency left to wait for, the run record's `startedAt`; its launch time is the creation entry in its own branch's reflog. Cap room is read at each tick from `admin-sessions.json` against `readSessionsMax()` and kept in the signal's own log. `broken`: a launch over sixty seconds after ready while the log showed room; a phase ready over a minute with room now and no branch; a phase branch over fifteen minutes old with no session and no stop for it in the graph record; at each phase end, a box ticked outside the launched phase's section in `git diff plan/<plan>...phase/<plan>/<kind>-<n> -- <impl>`, read by a plain heading scan. A phase waiting on a person's judgement is listed, not late; a missing reflog reports unknown. `writeClauseSignals(root, "run-graph.step", plan, { plan: "run-the-graph", phase: "Build Phase 5" }, verdicts)`. Best-effort.

  </details>
- [ ] Report the signal for the clause that the graph is read again before each launch.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/graph-is-current` — reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, at each launch. A plain scan of `git show plan/<plan>:<impl>` at that moment: the launched phase is open, every phase it depends on is closed, and `admin-sessions.json` holds no other session for that phase. `broken` names the launch and which failed. Best-effort.

  </details>
- [ ] Report the signal for the clause that review phases are phases, when the build starts a ritual step.
  <details><summary>Technical</summary>

  signal: `the-work-runs-as-a-graph/reviews-are-phases` — step half, reported from `apps/indusk-mcp/src/lib/build/graph-run-signals.ts`, called by `runBuild` before it starts an audit, falsify, cleanup or retrospective step. A plain scan of `git show plan/<plan>:<impl>` finds no open phase; `broken` names the step and the open phase it started over. Best-effort.

  </details>
- [ ] Show every running phase on the plan page and in its nav row, and judge the run-record signals per phase, so two phases running at once never read as a false break.
  <details><summary>Technical</summary>

  Added at approval (Sandy, 2026-10-20): with the run record listing phases (Build Phase 2), the plan's situation names each running phase ("building — Build Phase 2, Build Phase 3"), and `a-run-is-read-from-its-record`'s `shows-where-it-is` and `dead-reads-stopped` judge each listed phase against its own process (`run-record/situation-signals.ts`, `liveness.ts`), never the first phase alone. Uses existing words and components: no look changes. T40.

  </details>

#### Build Phase 5 Verification

- [ ] The work-step, launch, prompt, read, ritual, judgement, question and amendment tests pass, and the guards stay green.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/build/graph-run.test.ts src/lib/build/graph-run-launch.test.ts src/lib/build/work-prompt-phase.test.ts src/lib/build/graph-run-current.test.ts src/lib/build/graph-run-rituals.test.ts src/lib/build/graph-run-judgement.test.ts src/lib/build/graph-run-question.test.ts src/lib/build/graph-run-amendment.test.ts src/lib/session/question-wait.test.ts src/lib/models/next-session.test.ts src/lib/build/next-step.test.ts && pnpm exec vitest related src/lib/build/graph-run.ts src/lib/build/runner.ts src/lib/build/build-session.ts src/lib/build/graph-run-signals.ts` — T28 to T34 and T38 pass; T35 to T37 stay green. `cd ../indusk-admin && pnpm exec vitest related src/lib/build-host.ts` passes.

  </details>
- [ ] The live check passes in the system tier and is not in the everyday suite.
  <details><summary>Technical</summary>

  `pnpm test:system -- run-graph.live` from the repo root — T39 passes; `everyday-tests-never-wait.test.ts` passes. Result written under Notes with the date.

  </details>

#### Build Phase 5 Context

- [ ] Write the package rules file's section on running the graph, with every rule this plan's phases hold.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, new section "Run the graph", written only here (this phase depends on every other, so no parallel phase edits the file), and the lines the inventory marks blocking rewritten (89-93, 113-121, 178-183, 324): phase dependencies and files are read only by `lib/graph/declarations.ts`, mirrored by `hooks/_phase-depends.js`; one session per plan, kind and phase, each phase session counted under `sessions.max`; the build's run record lists its phases; phase branches are `phase/<plan>/<kind>-<n>`, never assigned, resumed, never re-cut; a phase joins its plan only through `joinPhase` (plan merged in, impl lines combined, checked, `--ff-only`), the record is `graph/<plan>.jsonl`; the graph runs only as `runBuild`'s work step in the admin, one launcher, joins off the launch path, 30 s tick; a shared page is declared by each phase that edits it — guard: `graph-run-current.test.ts` carries `clause: the-work-runs-as-a-graph/graph-is-current`.

  </details>
- [ ] Add the root Key Decisions line for this plan.
  <details><summary>Technical</summary>

  root (Key Decisions): "Run the graph (slice 1): a phase declares `**Depends on**:` and `**Files**:`; the admin's build runs a plan's ready phases at once on `phase/<plan>/<kind>-<n>` branches and fast-forwards each into the plan after a green check — see `/decisions/run-the-graph`" — always-on because every plan's author decides its phases' lines.

  </details>

#### Build Phase 5 Document

- [ ] Finish the guide page, describe a one-phase session on the work skill's page, and publish the decision record and the changelog entry.
  <details><summary>Technical</summary>

  Complete `apps/docs/src/guide/phases-in-parallel.md`: what runs together, the two lines, why a phase waits, a phase's branch, a judgement, an amendment and a question, a stopped phase and Build again, a Mermaid graph of the brief's six-phase plan; `apps/docs/src/reference/skills/work.md`: the one-phase section; `apps/docs/src/decisions/run-the-graph.md` from `adr.md`; the changelog Unreleased entry from the ADR, beside Test Phase 1's line.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/graph/{declarations,read-graph,schedule}.ts`, `hooks/_phase-depends.js`, `hooks/check-gates.js` | the two lines, the graph, the scheduler; the gate hook judges by dependencies and holds a session to its phase |
| `apps/indusk-mcp/src/lib/session/manager.ts`, `src/lib/run-record/{record,liveness}.ts`, `src/lib/questions/{record,history}.ts`, `src/lib/run/graph-refusal.ts`, `src/bin/commands/run.ts` | sessions by plan, kind and phase, each counted; phases in the run record; a question's phase and its id under the lock; Dawn's refusal |
| `apps/indusk-mcp/src/lib/worktree/provision.ts`, `plan-worktree-commands.ts`, `src/bin/commands/worktree.ts`, `src/lib/graph/phase-branch.ts` | one setup for created and phase worktrees; phase branches cut, resumed, removed |
| `apps/indusk-mcp/src/lib/graph/{record,impl-join,join}.ts`, `src/lib/plans/test-set.ts` | the join: impl lines combined, the check, the fast-forward, attempts, the record |
| `apps/indusk-mcp/src/lib/build/{graph-run,runner,build-session,index}.ts`, `apps/indusk-admin/src/lib/build-host.ts` | the graph as the work step, one launcher, the one-phase session, the question and amendment holds, the host wiring |
| `apps/indusk-mcp/src/lib/graph/{read-graph,schedule,phase-branch,join}-signals.ts`, `src/lib/build/graph-run-signals.ts`, `src/lib/plans/{land,approve}.ts` | one clause signal per decision, beside the code that decides it |
| `apps/indusk-mcp/skills/{planner,work}.md`, `templates/planning/CLAUDE.md`, `.claude/skills/{planner,work}/SKILL.md` | the two lines; a session started for one phase |
| `apps/indusk-mcp/vitest.tiers.ts`, `src/__tests__/run-graph.live.test.ts` | the live check in the system tier |
| `apps/indusk-mcp/CLAUDE.md`, `CLAUDE.md` | "Run the graph" rules; Key Decisions line |
| `apps/docs/src/{guide/phases-in-parallel.md,decisions/run-the-graph.md,decisions/sessions-per-plan.md,reference/skills/{planner,work}.md,reference/cli/worktree.md,changelog.md}` | documentation |

## Dependencies
- `a-run-can-be-trusted` and `decisions-as-questions`, landed (the brief's Depends On).
- Node 22; real git with reflogs on; no daemon or server for the everyday suite.

## Notes

- **Confirmed by Sandy before approval (2026-10-20):** after an admin restart the build stays stopped until Build is pressed (resuming on its own is a later slice); a terminal `plans approve` names the next session and does not start the build (approving in the admin does); a bad dependency line stops the build when the graph is read, not at save. Added at Sandy's request: every running phase is shown and judged per phase (the task and T40 in Build Phase 5), so no false break of `a-run-is-read-from-its-record`.
- **This impl's own dependency and files lines are dogfood.** They are plain text to today's checks and take effect once Build Phase 1 lands. The intended graph: Test Phase 1 first; then Build Phases 1, 2 and 3 at once (their files do not overlap); 4 after 3; 5 after 1, 2 and 4. Longest chain: Test Phase 1 → 3 → 4 → 5.
- **Inventory coverage** (ADR, "Inventory, entry by entry"): of the 37 entries marked blocking, 24 are changed by a named task and 13 are out of scope with a reason; the wrong and cosmetic entries handled here are the nine that would make a promise of this brief read false.
- **Read as scope, for the person at approval:** the clauses about launching are judged while the plan's build runs in the admin. An admin restart leaves the build stopped until Build is pressed again, and a terminal approval names the next session as today (ADR D4); both are the later slice "nothing stops". The admin shows one phase per build until `activity-and-graph`.
- **otel.role is `library`**, so no OTel gate is written; each split and limit clause has a signal task in the phase that writes its deciding code, judged from a source that code does not read.
- **The live check proves no clause.** It runs only at landing and release; each clause it touches is proved by unit rows.
- Live check result: (recorded by Build Phase 5).
