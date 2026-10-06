---
title: "Plan authoring from the admin"
date: 2026-10-06
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Plan authoring from the admin

## Goal

A plan can be started, planned, built to review, reviewed, accepted and
released from the admin, through the developer's own `claude`; the same plan
commands serve the admin, the skills and the terminal; a build decides its
next step in code; and nothing lands before it is accepted ([ADR](adr.md)).

## Scope

### In Scope
- `indusk plans start | approve | accept | land | next | review` (ADR D3, D4,
  D6), and the lifecycle positions they create, rendered (D9)
- The session module (D1) and the admin daemon that owns sessions: localhost
  only, a session record, routes, the panel (D2)
- The build runner, gate skips in a build (D5), the review, acceptance and the
  built-in release workflow with auto-accept (D6, D7)
- The skills: the planner starts a plan with `plans start`; work, falsify and
  cleanup gain an unattended section; the retrospective lands with `plans
  land`
- A plan written on `main` marked as a violation (D8)

### Out of Scope
- Configuring the release workflow (`release-checks-run-once`) and choosing a
  plan's workflow (`workflow-builder`)
- More than one session at a time, editing documents in place, hosting
- Dawn (`indusk run`); its silent exit on a gate question is a separate fix

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test that can be written, red, over the CLI and the admin's components | today's tree |
| Build Phase 1 | `lib/plans/`: `start`, `approve`, `accept`, `land`; `indusk plans` verbs | `createPlanWorktree`, the assignment record, `checkPlanContract` |
| Build Phase 2 | `lib/build/next-step.ts` (`nextBuildStep`); `indusk plans next`; `detectHumanGate` in a shared module; the `approved` / `in review` / `accepted` positions, rendered | Build Phase 1's frontmatter keys, `lifecycle` |
| Build Phase 3 | `lib/build/review.ts` (`buildReview`); `indusk plans review`; `INDUSK_GATE_POLICY` read by both hooks | the confirm reader, Build Phase 2's positions |
| Build Phase 4 | `lib/session/`: the protocol functions and `startSession` | the developer's `claude` |
| Build Phase 5 | the daemon on `127.0.0.1`; the session record and its cleanup; the admin's routes and origin check | Build Phase 4's sessions |
| Build Phase 6 | the panel: New plan, the conversation, questions, permissions, Stop, Approve | Build Phase 5's routes, Build Phase 1's commands |
| Build Phase 7 | `lib/build/runner.ts`; the review panel; Accept; the release workflow; `release.auto_accept` | Build Phases 2–6 |
| Build Phase 8 | the skills; `markPromise`; the trunk-commit mark in `eval-trigger.js` | Build Phases 1 and 7 |
| Build Phase 9 | the live checks, this plan's promises confirmed | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | New plan in the admin, with a type and a name, starts a planning session, and what the session says appears in the panel as it says it | Build Phase 4 | Build Phase 6 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-mcp/src/lib/session/trust.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A2 | A question the session asks appears in the panel with its choices; the answer reaches the session and it continues | Build Phase 4 | Build Phase 6 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A3 | A tool-use request appears in the panel; allowing it lets the session go on, denying it tells the session no | Build Phase 4 | Build Phase 6 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A4 | A planning session asks before every write, even when the developer's own Claude Code allows writes without asking | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts |
| A5 | Claude Code still answers a question, a permission request and an interrupt over the session's stream | Build Phase 4 | Build Phase 4 | passing | contract | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts |
| A6 | A plan started in the admin and one started in the editor produce the same plan folder and registry entries, and either continues from the other | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-plan-can-start-from-the-admin | manual: recorded in Build Phase 9 |
| A7 | Starting a plan with a type and a name creates its branch and worktree, recorded so the admin and plan tools read the plan from there | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A8 | Until approval, the plan's documents and declared promises exist on its branch and not on `main` | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A9 | Approving brings the documents and promises to `main`, and the build then runs on the same branch | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A10 | Starting a plan whose name already has a folder, branch or worktree is refused, naming which | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A11 | An approved plan's build goes from its first phase through falsification and cleanup without asking anything, when the plan declares no judgement item | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A12 | A build stops at a judgement item the plan declared and names the item | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A13 | A build that cannot continue stops and says why: a session error after its retries, two steps with no progress, or a `blocker:` line | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A14 | A build stops at review when every phase, falsification and cleanup is closed, and does not start the retrospective | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A15 | The review lists each promise the plan makes with the passing tests naming it; one with none is unproven | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A16 | The review shows what falsification looked for, what it found and what was fixed | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A17 | The review shows the files the plan's branch changed against `main` | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A18 | A plan that has not been accepted cannot be landed on `main`; the refusal names the plan | Test Phase 1 | Build Phase 1 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A19 | Accepting a plan in the panel runs the release workflow: the retrospective, the merge to `main`, the branch and worktree removed | Build Phase 7 | Build Phase 7 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/build/runner.test.ts |
| A20 | With `release.auto_accept`, a build that reaches review goes on to the release workflow without the person | Build Phase 7 | Build Phase 7 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/build/runner.test.ts |
| A21 | Stopping a session from the panel ends it, and what it wrote stays written | Build Phase 5 | Build Phase 6 | passing | unit | promise: a-session-can-be-stopped | apps/indusk-mcp/src/lib/session/manager.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A22 | When the admin stops, or starts again after a crash, no session it started is still running | Build Phase 5 | Build Phase 5 | passing | contract | promise: a-session-can-be-stopped | apps/indusk-mcp/src/__tests__/admin-session-lifecycle.test.ts |
| A23 | Approving runs the same brief check as the command line and refuses with its message when a promise is missing from the registry | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A24 | In a build session the admin starts, a checkoff that skips a gate without a reason is refused | Build Phase 7 | Build Phase 7 | passing | contract | promise: gates-ran-at-every-checkoff | apps/indusk-mcp/src/__tests__/build-session-gates.test.ts |
| A25 | The admin starts plans, creates worktrees, checks briefs, lands plans and starts `claude` only through the package's code | Test Phase 1 | Build Phase 7 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-admin/src/__tests__/admin-uses-package-commands.test.ts |
| A26 | With this plan's tests added, no everyday test starts Claude, a server or a detached process, or waits | Test Phase 1 | Build Phase 9 | written | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A27 | In a scratch project, one plan goes the whole way in the admin without a terminal: started, planned, promises accepted, approved, built to review, evidence read, accepted, released | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-build-runs-to-review-unasked | manual: recorded in Build Phase 9 |
| A28 | This plan's six promises go from `declared` to `enforced` when it closes | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-review-shows-its-evidence | manual: `indusk promises confirm admin-plan-authoring`, recorded in Build Phase 9 |
| A29 | A non-merge commit on `main` that changes an active plan's documents is marked as a violation of the own-branch promise; a merge from the plan's branch is marked upheld; the commit is never refused | Build Phase 8 | Build Phase 8 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts |
| A30 | A build writes inside its worktree without asking and is refused outside it; a gate item it skips carries its reason, and the review lists every skip | Build Phase 3 | Build Phase 7 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/gate-policy-env.test.ts, apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A31 | A plan that is in review or accepted shows that position on its admin page | Test Phase 1 | Build Phase 2 | passing | unit | the planning rule that a plan adding a lifecycle position renders it in the admin, in the same plan | apps/indusk-mcp/src/lib/lifecycle-review.test.ts, apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts |

### Deferred Verification

- **An unattended build does good work (U1)**
  - reason: it is an agent following prose through each step; whether its work is good cannot be asserted by a test
  - would require: many builds judged by the people who accept them
  - mitigation: falsification and cleanup still run; the review shows the evidence (A15–A17, A30); nothing lands before acceptance (A18); the brief's second expectation counts the stops over the next five plans
- **A plan started in the editor is written on its own branch (U2)**
  - reason: the editor path is the planner skill, an agent following prose, and Sandy chose to keep it a convention (2026-10-06)
  - would require: a trunk guard that refuses plan documents on `main`, which was rejected
  - mitigation: the trunk-commit mark (A29) records each plan written on `main` as a violation, read by `indusk promises status` and the admin's Promises page

## Checklist

### Test Phase 1: Every test that can be written over the CLI and the admin's components, red

**Goal**: write every test that reaches its subject over a boundary — the `indusk plans` verbs through the CLI, the admin's plan page through its component — and record the ones whose subject is a symbol a build phase introduces.

- [x] Create/confirm this plan's worktree (`indusk worktree create admin-plan-authoring`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [x] A7, A8, A10: `plans-start.test.ts`, through the CLI in a fixture git repository: `indusk plans start feature demo-plan` creates `plan/demo-plan`, its worktree and assignment, and the folder with `workflow: feature` only in the worktree; a second start, and a start over an existing branch or worktree, is refused naming which. RED: `plans start` is not a command — 6 tests red: exit 1 where 0 is expected, or "unknown command" where the refusal's name is expected. Found writing the fixture: `indusk worktree create` and `assign` refuse a plan with no folder on the trunk ("a plan is assigned after its folder exists on the trunk"), which a plan written on its own branch never has; the shared fixture (`helpers/plan-lifecycle-fixture.ts`) makes and assigns the worktree by hand, and Build Phase 1 has to lift that rule
- [x] A9, A23: `plans-approve.test.ts`, through the CLI: approving a plan whose branch holds only `.indusk/` changes merges it into `main` and sets the impl `approved`, the branch still checked out in its worktree; a brief naming a promise the registry lacks is refused with the contract's message, `main` unchanged; a branch touching a file outside `.indusk/` is refused. RED: `plans approve` is not a command — 3 tests red on their assertions
- [x] A18: `plans-land.test.ts`, through the CLI: landing a plan with no `accepted` is refused naming the plan, `main` unchanged; after `plans accept` it merges `--no-ff`, removes the worktree and deletes the branch. RED: `plans land` is not a command — 2 tests red on their assertions
- [x] A11, A12, A14: `plans-next.test.ts`, through the CLI over fixture impls: an open build phase answers `work`; every phase closed and no falsification answers `falsify`, then `cleanup`; all closed answers `review` and never `retrospective`; an open Deferred Verification item answers `judgement` naming it. RED: `plans next` is not a command — 4 tests red on their assertions
- [x] A15, A16, A17: `plans-review.test.ts`, through the CLI in a fixture repository with a plan branch: each promise the brief makes with its passing rows, one with none marked unproven; the falsification phase's rows and fix items; the changed files against the merge base. RED: `plans review` is not a command — 3 tests red on their assertions
- [x] A31: `lib/lifecycle-review.test.ts` — `review` and `accepted` are positions between cleanup and the retrospective; a plan with every phase and ritual closed derives `review`, and one whose impl has `accepted:` derives `accepted`. The admin's existing `lifecycle-render-parity` test then requires a label for each. RED: the positions do not exist and both plans read `retrospective` — 3 tests. Changed from the planned component test: `impl-approved` already renders, and `review` is derived from closed phases and rituals rather than a `review: ready` key, so the subject is the lifecycle's derivation; a component test fed a position by hand would pass before anything is built
- [x] A25: `admin-uses-package-commands.test.ts` reads every file under `apps/indusk-admin/src` and refuses a `git worktree`, `git merge` or `claude` spawn, and any import of a `plans` or `session` module that is not the package's subpath. Passes on today's tree (no such code); see Regression Guards — 3 tests pass; only `lib/git-only-path.ts` and `lib/vcs.ts` start a process, both read-only
- [x] A26: run the never-wait guard over this phase's new tests — 6 pass; the new tests start only `git` and the CLI, each to completion

#### Deferred to Build Phase 2

- **A13** — its subject is `nextBuildStep`'s handling of the outcome of the step just run, which the CLI cannot be handed; the function does not exist until Build Phase 2. The shape:

  ```ts
  it("stops when two steps in a row change nothing", () => {
    const plan = fixturePlan({ open: "Build Phase 2" });
    const same = { progressed: false, error: null };
    expect(nextBuildStep(plan, { last: same, previous: same })).toEqual({
      step: "cannot-continue",
      why: "two steps in a row made no progress",
    });
  });
  ```

#### Deferred to Build Phase 3

- **A30** — half its subject is the gate-policy environment variable both hooks read, writable over the hook boundary in Build Phase 3 when the variable has a name both sides agree on; the other half is the session's permission decision (Build Phase 4) and the runner (Build Phase 7), where it passes.

#### Deferred to Build Phase 4

- **A1, A2, A3, A4** — their subject is the session protocol, pure functions in `lib/session/` that do not exist; a test importing them fails to load, which is not a red. The panel half of A1–A3 is written in Build Phase 6. The protocol shape:

  ```ts
  it("turns a question into an event and an answer into a reply", () => {
    const ev = parseSessionLine(fixtureLine("can_use_tool-AskUserQuestion"));
    expect(ev).toMatchObject({ type: "question", questions: [{ question: "Which workflow?" }] });
    expect(JSON.parse(answerQuestion(ev, { "Which workflow?": "feature" }))).toMatchObject({
      type: "control_response",
      response: { response: { behavior: "allow", updatedInput: { answers: { "Which workflow?": "feature" } } } },
    });
  });
  ```
- **A5** — a contract test of the real `claude` through `startSession`; the module is this phase's.

#### Deferred to Build Phase 5

- **A21, A22** — their subject is the session manager and the daemon's session record, neither of which exists.

#### Deferred to Build Phase 7

- **A19, A20, A24** — their subject is the build runner, which takes a session starter and a clock as inputs and does not exist until Build Phase 7.

#### Deferred to Build Phase 8

- **A29** — its subject is the decision a commit hook makes about a commit on the trunk, through `markPromise`; neither exists.

#### Deferred to Build Phase 9

- **A6, A27, A28** — live checks, run once against the real system after everything above exists.

#### Regression Guards

- **A25** — the admin has no write code today, so the guard passes when written; it exists to stay green as Build Phases 5–7 add routes and the runner.
- **A26** — the never-wait guard exists and passes; this plan's everyday tests start only short-lived `git` and `indusk` processes.

#### Test Phase 1 Verification

- [x] Every row writable here is authored and each red one fails on its own assertion, not a load error (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-start src/__tests__/plans-approve src/__tests__/plans-land src/__tests__/plans-next src/__tests__/plans-review src/lib/lifecycle-review src/__tests__/everyday-tests-never-wait` and `cd apps/indusk-admin && pnpm exec vitest run --project node src/__tests__/admin-uses-package-commands src/lib/lifecycle-render-parity`); A25 and A26 pass — 21 red across six files, each an exit 1 or "unknown command" where the command's answer is expected, or `retrospective` where `review`/`accepted` is; none a load error; the guards and the render parity pass, 15 tests
- [x] The deferred bodies above reviewed: each compiles at the phase it names and asserts what its row claims — A13's body needs a `fixturePlan` helper written in its own file, and calls `nextBuildStep(plan, outcomes)` as ADR D4 names it; A1–A4's body needs the recorded fixture lines Build Phase 4's first item makes, and its reply shape (`control_response` → `response.response.updatedInput.answers`) is the one the spike answered with
- [x] Shape — eight files, every enabled extension's rules readable. `plan-lifecycle-fixture.ts` has one job (a trunk and assigned plan worktrees) and says why it assigns by hand; each test file reaches one verb over the CLI and names its rows. One thing looked at and kept: `plans-next.test.ts` builds its impls with its own small writer rather than `implText`, whose fixed one-phase shape cannot express falsification and cleanup phases. Nothing to change

### Build Phase 1: The plan commands

- [x] (discovered) `lib/worktree/plan-worktree-commands.ts`: a plan is assigned once its folder exists on the trunk *or in the worktree being assigned*, and `createPlanWorktree` takes a `seed` that writes the first documents before assigning — the old rule ("a plan is assigned after its folder exists on the trunk") refused every plan written on its own branch (found writing Test Phase 1's fixture)
- [x] (discovered) `lib/worktree/plan-worktrees.ts`: `resolvePlanCopies` also lists a plan that only its assigned worktree holds. Every reader started from the trunk's folders, so a plan on its own branch was invisible to the admin and the plan tools; A7 gained the assertion that `get_plan_status` reads it, red with the old loop and green with this
- [x] `lib/plans/start.ts`: `startPlan(root, type, name)` — refuses a taken folder, branch or worktree, naming which; calls `createPlanWorktree`; writes the plan folder with `workflow: <type>` in the worktree only
- [x] `lib/plans/approve.ts`: `approvePlan(root, name)` — `checkPlanContract` on the worktree's copy; refuses a branch touching anything outside `.indusk/`, and a trunk dirty on the branch's paths; merges `--no-ff` into the trunk; sets the impl `approved`
- [x] `lib/plans/accept.ts`: `acceptPlan(root, name, by)` — writes `accepted` and `accepted_by` to the impl's frontmatter and commits on the branch
- [x] `lib/plans/land.ts`: `landPlan(root, name)` — refuses without `accepted`; merges the trunk into the branch, runs the project's checks, merges `--no-ff` into the trunk, releases and removes the worktree, deletes the branch — the checks are `plans.land_checks` in `.indusk/config.json`, none when unset; which checks a project runs is `release-checks-run-once`'s
- [x] `indusk plans start | approve | accept | land` in `bin/commands/plans.ts`; the package exports `./plans`

#### Build Phase 1 Verification

- [x] A7, A8, A9, A10, A18, A23 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-start src/__tests__/plans-approve src/__tests__/plans-land`) — 12 tests, 2.5 s; `tsc --noEmit` clean
- [x] `src/__tests__/plan-worktree*.test.ts` still pass with `createPlanWorktree` shared — with `worktree-cli` and `worktree-visibility-cli`: 6 files, 43 tests
- [x] Shape — `plan-branch.ts` holds what every verb after `start` needs (find the plan's worktree, the trunk, the refusals, the merge) so each verb file reads as its steps in order; `setFrontmatterKeys` edits lines in place rather than re-serialising, so a document's formatting survives approval and acceptance. One thing looked at and kept: `landPlan` runs `plans.land_checks` through `sh -c`, the one place a project's own command runs, because the commands are the project's to write. Nothing to change

#### Build Phase 1 Context

- [x] planning: in `templates/planning/CLAUDE.md`, the worktree entry says a plan starts with `indusk plans start`, approval merges its documents, and `plans land` refuses an unaccepted plan — then `indusk update` here — a new entry beside the worktree one; `update` run with this branch's build. Found doing it: `indusk update` run in a plan worktree registers the worktree as a project of its own in `~/.indusk/projects.json` (removed by hand); not this plan's to fix, noted for the backlog

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `start`, `approve`, `accept`, `land`, each with what it refuses

### Build Phase 2: The next step, and the positions it reads

- [x] Move `detectHumanGate` from `lib/run/loop.ts` to `lib/build/judgement.ts`; `loop.ts` imports it; add it to `one-definition-per-shared-rule`'s tests — `judgement-single-definition.test.ts`: one definition, imported by `run/loop.ts` and `build/next-step.ts`
- [x] `lib/build/next-step.ts`: `nextBuildStep(plan, outcomes)` per ADR D4's table, with cannot-continue's three causes — and a fourth found writing it: every phase closed but a row not terminal, which the gates should never allow; it stops rather than calling the plan built. An unproven promise goes to review, where it is shown
- [x] `indusk plans next <name>` prints the step as JSON — with `--json`; a sentence without. `lib/build/read-plan.ts` reads the plan's live copy for it, the one place the build's decisions meet the disk
- [x] `lib/lifecycle.ts`: positions `review` (every phase and ritual closed, not accepted) and `accepted` (the impl has `accepted:`), between `cleanup` and `retrospective`; `ParsedImpl` carries `accepted`; the admin's plan page renders each (`impl-approved` already does) — both join `IMPL_DEPENDENT_POSITIONS`. Two tests from admin-ui-phase-progress asserted a cleaned plan reads "awaiting /retrospective"; they now assert review, keeping their point (the bar never claims what it does not hold; an unproven promise is still named). Found doing it: the admin parsed the impl's body without its frontmatter, so `accepted` never reached the position; it now parses the whole file it already read for readiness
- [x] A13 written red, then passing — written before `next-step.ts` existed, when it could only fail to load; its subject is the new function, so there was no honest assertion-red before it (the reason it was deferred to this phase). Passing: 5 tests

#### Build Phase 2 Verification

- [x] A11, A12, A13, A14, A31 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-next src/lib/build src/lib/run` and `cd apps/indusk-admin && pnpm exec vitest run src/components/PlanDetail`) — with `src/lib/lifecycle-review`: 21 files, 96 tests; the admin's PlanDetail and bars browser tests, 8 files, 60 tests; `tsc --noEmit` clean in both packages
- [x] `src/lib/run/loop.test.ts` and `lifecycle-render-parity.test.ts` still pass — the loop's tests are in the 96; render parity 6 of 6, now with labels for `review` and `accepted`
- [x] Shape — `next-step.ts` is one pure decision with its types; `read-plan.ts` is its only contact with the disk; `judgement.ts` is the moved rule, unchanged. One thing looked at and kept: `resolvePosition`'s completed branch now names the unproven promises in two messages through one `unproven` suffix rather than two branches. Nothing to change

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: `lib/build/` holds the build's decisions — the next step and judgement items — and Dawn reads the same judgement rule — the file was 22 bytes under its 16,384-byte budget; room made by shortening the run entry's restatement of its own gate and dropping two implementation details from the cleanup entry (merge-base fallbacks, `isNew`'s `cat-file`), which state how the code works rather than a rule. Now 16,376 bytes; `check-pointers` passes

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `next`, its answers and the three causes of cannot-continue; `apps/docs/src/reference/admin-ui/overview.md`: the three new positions — two new positions (`review`, `accepted`; `impl approved` already existed)

### Build Phase 3: The review, and skips with reasons

- [x] `lib/build/review.ts`: `buildReview(root, plan)` per ADR D6, reading promises and rows through the confirm module's reader, never a copy — `promises/rows.ts`'s `rowProofs`, the half of confirmation that reads only the impl, so the review cannot call proven what the close refuses; a promise the brief makes but the registry lacks is still listed, by name
- [x] `indusk plans review <name>` prints it, `--json` for the admin
- [x] `check-gates.js` and `validate-impl-structure.js` read `INDUSK_GATE_POLICY` before the impl and settings; under `auto` a skip without a reason is refused — through one hook-local module, `hooks/_gate-policy.js` (`policyFromEnvironment`, `skipCarriesReason`). The reason rule applies when the environment set `auto`; a plan that sets `gate_policy: auto` itself keeps the bare `(none needed)` it has today. A value that is not a policy is ignored, never read as `auto`
- [x] A30's hook half written red over the hook boundary, then passing — `gate-policy-env.test.ts`: 4 red on their assertions (exit 2 where 0 is expected, or a hint with no word about a reason), 2 controls green; then 6 of 6. The review's half is a case in `plans-review.test.ts` (every skip, with its reason); the worktree half waits for the session, Build Phase 4

#### Build Phase 3 Verification

- [x] A15, A16, A17 pass, and A30's hook half (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-review src/__tests__/gate-policy-env`) — 10 tests; `tsc --noEmit` clean
- [x] `hook-cwd-independence.test.ts` and `check-gates` tests still pass — with the shared-module, registration, CJS-consumer and init hook tests and `src/lib/run`: 25 files, 119 tests
- [x] Shape — `review.ts` is one assembly function and three small readers (promises, files, the skip test), each named for what it reads; `_gate-policy.js` holds the two facts both hooks need and nothing else. One thing looked at and kept: `review.ts` resolves the trunk branch itself rather than through `plans/plan-branch.ts`, because a review must also work for a plan with no worktree (it then lists no files), and `planBranch` refuses that case by design. Nothing to change

#### Build Phase 3 Context

- [x] guard: `gate-policy-env.test.ts` carries `lesson: a-build-skips-a-gate-only-with-its-reason`; the lesson file is written with it — `.claude/lessons/a-build-skips-a-gate-only-with-its-reason.md`, written in the worktree by hand (the lesson tool writes to the session's trunk)

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/skills/work.md`: the gate policy table gains the environment level — the page had no policy table; it now has the four levels and what each policy counts as a skip. `reference/cli/plans.md` gains `plans review`

### Build Phase 4: The session

- [x] Record fixture streams from a real `claude` session: a question, a permission request, an interrupt, a result, an error — taken from the spike's recordings of 2026-10-05 (Claude Code 2.1.197) rather than new sessions: `__fixtures__/question.jsonl` (the planner's first question, the reply sent, the result), `permission.jsonl` (a Write and a Bash request, each with its reply), `interrupt.jsonl` (the interrupt, its acknowledgement, the `error_during_execution` result — the error case). Trimmed to the lines the protocol reads; the home directory rewritten to `/Users/dev`
- [x] `lib/session/protocol.ts`: `parseSessionLine`, `answerQuestion`, `decidePermission`, `interrupt`, `buildArgs(kind)` (`default` for planning, `acceptEdits` for build) — and `userMessage`; each reply checked equal to the one Claude accepted in the recording
- [x] `lib/session/permissions.ts`: a build's decision — allowed inside the worktree, denied outside — a tool given a path is judged by it (a sibling named like the worktree is outside); a tool given none runs in the worktree and the hooks judge it, which is a boundary on what is asked, not a sandbox; a build's question is answered by telling it to decide on its own judgement and record why
- [x] `lib/session/start.ts`: `startSession({ cwd, prompt, kind })` — refuses an untrusted project, saying how to trust it; the package exports `./session` — **changed from the ADR**: it does not refuse. Every plan worktree is a new path Claude Code has never trusted (`~/.claude.json` records each existing worktree of this repository as untrusted, the trunk as trusted), so refusing would refuse every plan; an untrusted project still runs and only ignores its own allow-list, so more is asked (the spike ran that way). The session reports `untrusted` as its first event instead, for the panel to show. Whether to trust a trusted trunk's worktrees automatically is Sandy's to decide
- [x] A1–A4 protocol halves and A5 written red, then passing; A5 added to `vitest.tiers.ts` `SYSTEM` — the protocol tests were written before `protocol.ts` and could only fail to load (their subject is the new module, the reason they were deferred here); 12 then passed, and A30's worktree half 5 more. A5 against Claude Code 2.1.197: 3 of 3 in 22 s

#### Build Phase 4 Verification

- [x] A4 and the protocol halves of A1–A3 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session`) — 17 tests with A30's worktree half; with the never-wait guard, 23; `tsc --noEmit` clean
- [x] A5 passes against the installed `claude` (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/session-protocol-contract`) — Claude Code 2.1.197 on Sonnet: a question answered and its answer written to a file, a denied write that stayed unwritten, an interrupt that ended the session; 3 of 3, 22 s
- [x] Shape — `protocol.ts` is pure (lines to events, answers to replies); `start.ts` owns only the process and its pipes; `permissions.ts` is a build's two decisions. One thing looked at and kept: `start.ts`'s `isTrusted` reads Claude Code's own config by exact path and infers nothing, because whether Claude Code honours a trusted trunk for its worktrees is not ours to guess. Nothing to change

#### Build Phase 4 Context

- [x] guard: `session-protocol-contract.test.ts` carries `lesson: the-admin-drives-claude-over-an-undocumented-flag-and-a-contract-test-watches-it`; the lesson file is written with it

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: how a session is started, its two kinds, and the trust requirement — new page, in the sidebar; trust is described as it was found (reported, not required)

### Build Phase 5: The daemon owns sessions

- [x] (discovered — Sandy, 2026-10-06: "Trust automatic") `lib/session/trust.ts`: before a session starts, a worktree of a project Claude Code already trusts is trusted like it (`hasTrustDialogAccepted` only, read-modify-rename); a project nobody trusted never is, and an unreadable config is left alone. `startSession` reports `trusted` or `untrusted` as its first event. `trust.test.ts` (A1's Test cell): 6 cases against a temporary config, never the developer's
- [x] `daemon.ts` starts Next with `-H 127.0.0.1` — every client already reached it on 127.0.0.1 (the identity probe, the port check, the Caddy route); `admin-cli-lifecycle.test.ts` exercises the start at this phase's verification
- [x] `lib/session/manager.ts`: one session at a time; the record in `~/.indusk/admin-sessions.json`; `stopAll()`; `reapRecorded()` checks each pid is the `claude` it started — by the process's command line (`ps -o command=`) containing the program it started; the manager also keeps each session's events, so a panel that connects late replays them (`subscribe`)
- [x] `indusk ui stop` calls `stopAll()` before the daemon; the daemon calls `reapRecorded()` at start — `ui stop` is its own process, not the daemon, so it cannot reach the daemon's manager; both `ui stop` (before the daemon stops) and `ui start` (before one starts) end the recorded sessions from the record with `reapRecorded`, which A22 exercises against real processes
- [x] The admin's routes: `POST /api/sessions`, `POST /api/sessions/:id/reply`, `POST /api/sessions/:id/stop`, `GET /api/sessions/:id/events`; each `POST` refuses an `Origin` that is not the admin's — plus `GET /api/sessions` (the running one). The origin is compared with the request's `Host`, so the Caddy route (`indusk.dawn`) works; `session-host.test.ts` pins it. Matching a reply to its request is the manager's (`reply`, one answer per request), so no route spells the protocol. Smoke-tested on the production build: GET answers, a POST with no or a foreign origin is 403, a bad body 400, and the server listens on 127.0.0.1 only
- [x] A21 manager half and A22 written red, then passing; A22 in `SYSTEM` — both written before `manager.ts` existed (load errors; their subject is the new manager). A21's half: 8 tests with a fake session. A22: 3 against real processes — a stand-in `claude` that never stops is ended by `stopAll`, ended by a later manager after its owner was dropped, and a recorded pid now running another program is left alone

#### Build Phase 5 Verification

- [x] A21's manager half passes (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager`) — 8 tests; the admin's `session-host.test.ts` 3; `tsc --noEmit` clean in both packages; the admin's production build compiles the four routes
- [x] A22 passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-session-lifecycle`), and `admin-cli-lifecycle.test.ts` still passes — 10 of 10, after `node scripts/bundle-admin.js`: a fresh worktree has no admin bundle (it is gitignored), so `ui start` refused and six lifecycle tests failed until it was built — nothing this plan changed. A first run also overlapped another process running the same file in this worktree
- [x] Shape — `manager.ts` holds one job (own sessions: start, record, answer, stop, reap) and its record I/O is two private functions; `session-host.ts` only finds the manager, the plan's location and the origin rule; each route reads its body, asks the manager, and maps a refusal to a status. One thing looked at and kept: the manager keeps every event of a running session in memory so a late panel can replay them; a session's events end with it, and only one runs at a time. Nothing to change

#### Build Phase 5 Context

- [x] `apps/indusk-admin/CLAUDE.md`: the admin is no longer read-only; it writes only through package commands and sessions, its routes are localhost-only and check their origin — the first entry, naming its guard; "read-only" dropped from the next one

#### Build Phase 5 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: the routes, one session at a time, stopping, and what happens when the daemon stops or crashes; `apps/docs/src/decisions/admin-ui-hosting.md` notes the amendment

### Build Phase 6: The panel

- [x] `components/session/SessionPanel.tsx`: the stream, a question with its choices, a permission request with Allow and Deny, Stop — also says whether the worktree was trusted, and how the session ended; an answered request is not offered again. Imports only types from the package; the session code is Node's
- [x] New plan on the project page: a type and a name, then `plans start` and a planning session in the new worktree — `POST /api/plans` refuses before making anything while another session runs, so no worktree is left without its conversation; the page then moves to the plan, where `PlanSession` finds the running session and connects
- [x] Approve on a plan's page, once its impl is written: `plans approve`, its refusal shown as the command gives it — offered for a plan on its own branch whose impl is not yet approved; `POST /api/plans/approve` calls `approvePlan` and returns a refusal's words with 409
- [x] The plan page refreshes when the session reports a write — `SessionConnector` calls `router.refresh()` on a Write, Edit, MultiEdit or NotebookEdit event and when the session ends; seen working in Build Phase 9's live checks, not by a test here
- [x] A1–A3 and A21 panel halves written red, then passing — written before `SessionPanel.tsx` existed (a load error; its subject is the new component). Two then failed on the test's own lookup (an option's text includes its description); the lookup reads the option's label. 9 pass

#### Build Phase 6 Verification

- [x] A1, A2, A3, A21 pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/session`) — the panel 9; their package halves (`src/lib/session`: protocol, trust, manager) 31; `tsc --noEmit` clean in the admin
- [x] A25 still passes (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/admin-uses-package-commands`) — 3; the new routes import only `/plans` and `/session` from the package and spawn nothing
- [x] Shape — `SessionPanel` renders events and reports choices, with `EventView` and `QuestionView` each one job; `SessionConnector` owns only the event stream and the POSTs; `PlanSession` decides only what to offer on a plan's page; each route reads, calls one package function, maps a refusal. One thing looked at and kept: `NewPlanForm` and `PlanSession` each have a small `fetch`-then-show-the-error block — two copies, below the rule of three, and the place to share them is cleanup's question. Nothing to change

#### Build Phase 6 Context

- [x] `apps/indusk-admin/CLAUDE.md`: the session panel reads one event stream and sends replies; it never parses the session's protocol itself — added to the entry Build Phase 5 wrote, with the rule that a client component imports only types from `/session`

#### Build Phase 6 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: the panel, with a screenshot of a question — the panel is described in words. The screenshot was taken (the real component, styled, in the admin's test browser) but not committed: `.gitignore` ignores every `*.png`, and overriding a repository-wide rule is Sandy's call, raised at this phase's close; the image is kept in the session scratchpad

### Build Phase 7: Build, review, accept, release

- [x] `lib/build/runner.ts`: `runBuild({ plan, startSession, now })` — a fresh build session per step with `INDUSK_GATE_POLICY=auto`, `nextBuildStep` after each, stops at judgement, cannot-continue or review; never starts the retrospective — its inputs are `read`, `run(step)` and `accept`, so its decisions are tested with fakes; progress is a fingerprint of the checkboxes, row states and missing rituals before and after a step. The session side is `build-session.ts` (`runStepSession`): a `build` session in the worktree, writes judged by `permissions.ts`, questions declined, a rate-limited step retried after 15, 45 and 90 s. Found writing its test: the manager could not decline a question, only answer it; it now can
- [x] On review: Accept runs `plans accept`, then a session running `/retrospective <plan>`; `release.auto_accept: true` accepts at review — `runRelease` in the package; `release-config.ts` reads the setting (only `true` counts); the admin's `POST /api/plans/accept` runs it in the daemon
- [x] The review panel renders `plans review --json`: promises and their tests, falsification, files, skips — `GET /api/plans/review` returns `buildReview`; `ReviewPanel.test.tsx` checks each part reaches the page
- [x] Build on an approved plan's page starts the runner; the panel shows its current step and why it stopped — `BuildControls` polls `GET /api/plans/build` every 3 s and connects the panel to each step's session as it starts; in review it shows the evidence and Accept. The production build warns that the routes' trace reaches the whole project through `worktree/repos.js`; nothing uses that trace, and it is left as found
- [x] A19, A20 and A24 written red, then passing; A24 in `SYSTEM` — A19 and A20 were written with `runner.ts` in the same step and not run before it existed (they could only have failed to load). A24 against the real `claude`: first runs were rate limited by the API ("not your usage limit"), which showed the refusal case could pass without the gate ever running; it now retries a rate-limited session and requires that an Edit was attempted. 2 of 2

#### Build Phase 7 Verification

- [x] A19, A20, A30 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/build src/lib/session src/__tests__/gate-policy-env src/__tests__/plans-review`); A25 still passes — 9 files, 61 tests; A25 3; the admin's session and review panels 10; `tsc --noEmit` clean in both; the admin's production build compiles all nine routes
- [x] A24 passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/build-session-gates`) — 2 of 2 against Claude Code 2.1.197, each case having attempted the edit
- [x] Shape — `runner.ts` is the loop and the release, with its world as three inputs; `build-session.ts` words a step and runs it as one session; `build-host.ts` in the admin holds a build's state and supplies the runner's inputs, nothing more. One finding acted on: the manager's `reply` refused to decline a question, which a build must do for every one — now it declines (found by `build-session.test.ts`). One thing looked at and kept: `build-host.ts`'s `startBuild` and `startRelease` share their refusal and state set-up in two copies, below the rule of three

#### Build Phase 7 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: a build's sessions run with `INDUSK_GATE_POLICY=auto` and every skip is read at review; the runner never starts the retrospective — the `lib/build/` entry rewritten in place (the file is at its budget); "the judgement rule Dawn shares" dropped from it, because `judgement-single-definition.test.ts` now enforces it, and the skip-with-reason rule is the guard `gate-policy-env.test.ts` and its lesson

#### Build Phase 7 Document

- [x] `apps/docs/src/guide/plan-lifecycle.md`: plan, approve, build, review, accept, release, from the admin or the editor, with the Mermaid sequence — a new section in the existing guide; the note about a plan written on `main` describes Build Phase 8's mark, which lands next

### Build Phase 8: The skills, and a plan written on main

- [ ] `skills/planner.md`: starting fresh calls `indusk plans start`; approval calls `indusk plans approve`
- [ ] `skills/work.md`, `falsify.md`, `cleanup.md`: an unattended section — finish on the agent's own judgement where today they ask, record every gate skip with its reason; the "human-gated by design" text replaced
- [ ] `skills/retrospective.md`: landing calls `indusk plans land`, and the plan must be accepted first
- [ ] `lib/promises/mark.ts`: `markPromise(span, name, outcome, symptom)`; `markEvaluation` uses it
- [ ] `eval-trigger.js`: a commit landed on the trunk branch that is not a merge and changes an active plan's folder marks `a-plan-is-written-on-its-own-branch` violated, naming the plan and the commit; a merge from `plan/<name>` marks it upheld
- [ ] A29 written red, then passing; `indusk update` here

#### Build Phase 8 Verification

- [ ] A29 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-plan-commit-mark src/__tests__/eval-trigger-commit-anchor src/__tests__/monitor-mark`)
- [ ] `src/__tests__/skill-*.test.ts` and `planner-brief-template.test.ts` still pass

#### Build Phase 8 Context

- [ ] planning: `templates/planning/CLAUDE.md` — a plan is written on its own branch by convention, and a plan written on `main` is marked, not refused

#### Build Phase 8 Document

- [ ] `apps/docs/src/reference/skills/work.md` and `retrospective.md`: the unattended section and landing by `plans land`

### Build Phase 9: The whole way, once

- [ ] A27: in a scratch project, one plan from New plan to release in the admin with no terminal; record what happened, every stop and why
- [ ] A6: one plan started in the editor and continued in the admin, and one the other way round; record both
- [ ] A28: `indusk promises confirm admin-plan-authoring`; the six promises read `enforced`

#### Build Phase 9 Verification

- [ ] A26 passes over every test this plan added (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/everyday-tests-never-wait`), and a full `pnpm test` is marked held
- [ ] `indusk promises check` passes with the six promises enforced

#### Build Phase 9 Context

- [ ] current.md: the live checks' results, and any stop in A27 that was not declared

#### Build Phase 9 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: the admin can start, build, review and release a plan; `indusk plans` verbs; a plan cannot land before it is accepted

## Files Affected

- `apps/indusk-mcp/src/lib/plans/`, `lib/build/`, `lib/session/` (new); `lib/promises/mark.ts` (new); `lib/run/loop.ts`, `lib/lifecycle.ts`, `lib/admin/daemon.ts`, `lib/eval/otel.ts`
- `apps/indusk-mcp/src/bin/commands/plans.ts`, `ui.ts`; `package.json` exports; `vitest.tiers.ts`
- `apps/indusk-mcp/hooks/check-gates.js`, `validate-impl-structure.js`, `eval-trigger.js`
- `apps/indusk-mcp/skills/planner.md`, `work.md`, `falsify.md`, `cleanup.md`, `retrospective.md`; `templates/planning/CLAUDE.md`
- `apps/indusk-admin/src/app/api/sessions/**` (new), `components/session/` (new), the project and plan pages
- `apps/docs/src/reference/cli/plans.md`, `reference/admin-ui/sessions.md`, `guide/plan-lifecycle.md`, `decisions/admin-ui-hosting.md`, `changelog.md`

## Dependencies

- [planner-promises](../archive/planner-promises/) (closed): `checkPlanContract`, the confirm reader, the promise tools.

## Notes

- This plan was planned on `main`, before its own branch rule exists. Its build starts on `plan/admin-plan-authoring` as today.
- The live checks need a scratch project Claude Code trusts.
