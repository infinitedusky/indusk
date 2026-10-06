---
title: "Plan authoring from the admin"
date: 2026-10-06
status: draft
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
| A1 | New plan in the admin, with a type and a name, starts a planning session, and what the session says appears in the panel as it says it | Build Phase 4 | Build Phase 6 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A2 | A question the session asks appears in the panel with its choices; the answer reaches the session and it continues | Build Phase 4 | Build Phase 6 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A3 | A tool-use request appears in the panel; allowing it lets the session go on, denying it tells the session no | Build Phase 4 | Build Phase 6 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A4 | A planning session asks before every write, even when the developer's own Claude Code allows writes without asking | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/lib/session/protocol.test.ts |
| A5 | Claude Code still answers a question, a permission request and an interrupt over the session's stream | Build Phase 4 | Build Phase 4 | planned | contract | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts |
| A6 | A plan started in the admin and one started in the editor produce the same plan folder and registry entries, and either continues from the other | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-plan-can-start-from-the-admin | manual: recorded in Build Phase 9 |
| A7 | Starting a plan with a type and a name creates its branch and worktree, recorded so the admin and plan tools read the plan from there | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A8 | Until approval, the plan's documents and declared promises exist on its branch and not on `main` | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A9 | Approving brings the documents and promises to `main`, and the build then runs on the same branch | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A10 | Starting a plan whose name already has a folder, branch or worktree is refused, naming which | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-start.test.ts |
| A11 | An approved plan's build goes from its first phase through falsification and cleanup without asking anything, when the plan declares no judgement item | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A12 | A build stops at a judgement item the plan declared and names the item | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A13 | A build that cannot continue stops and says why: a session error after its retries, two steps with no progress, or a `blocker:` line | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A14 | A build stops at review when every phase, falsification and cleanup is closed, and does not start the retrospective | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/plans-next.test.ts |
| A15 | The review lists each promise the plan makes with the passing tests naming it; one with none is unproven | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A16 | The review shows what falsification looked for, what it found and what was fixed | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A17 | The review shows the files the plan's branch changed against `main` | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A18 | A plan that has not been accepted cannot be landed on `main`; the refusal names the plan | Test Phase 1 | Build Phase 1 | planned | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A19 | Accepting a plan in the panel runs the release workflow: the retrospective, the merge to `main`, the branch and worktree removed | Build Phase 7 | Build Phase 7 | planned | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/build/runner.test.ts |
| A20 | With `release.auto_accept`, a build that reaches review goes on to the release workflow without the person | Build Phase 7 | Build Phase 7 | planned | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/build/runner.test.ts |
| A21 | Stopping a session from the panel ends it, and what it wrote stays written | Build Phase 5 | Build Phase 6 | planned | unit | promise: a-session-can-be-stopped | apps/indusk-mcp/src/lib/session/manager.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A22 | When the admin stops, or starts again after a crash, no session it started is still running | Build Phase 5 | Build Phase 5 | planned | contract | promise: a-session-can-be-stopped | apps/indusk-mcp/src/__tests__/admin-session-lifecycle.test.ts |
| A23 | Approving runs the same brief check as the command line and refuses with its message when a promise is missing from the registry | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-briefs-promises-are-in-the-registry | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A24 | In a build session the admin starts, a checkoff that skips a gate without a reason is refused | Build Phase 7 | Build Phase 7 | planned | contract | promise: gates-ran-at-every-checkoff | apps/indusk-mcp/src/__tests__/build-session-gates.test.ts |
| A25 | The admin starts plans, creates worktrees, checks briefs, lands plans and starts `claude` only through the package's code | Test Phase 1 | Build Phase 7 | planned | unit | promise: one-definition-per-shared-rule | apps/indusk-admin/src/__tests__/admin-uses-package-commands.test.ts |
| A26 | With this plan's tests added, no everyday test starts Claude, a server or a detached process, or waits | Test Phase 1 | Build Phase 9 | planned | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A27 | In a scratch project, one plan goes the whole way in the admin without a terminal: started, planned, promises accepted, approved, built to review, evidence read, accepted, released | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-build-runs-to-review-unasked | manual: recorded in Build Phase 9 |
| A28 | This plan's six promises go from `declared` to `enforced` when it closes | Build Phase 9 | Build Phase 9 | planned | live check | promise: a-review-shows-its-evidence | manual: `indusk promises confirm admin-plan-authoring`, recorded in Build Phase 9 |
| A29 | A non-merge commit on `main` that changes an active plan's documents is marked as a violation of the own-branch promise; a merge from the plan's branch is marked upheld; the commit is never refused | Build Phase 8 | Build Phase 8 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts |
| A30 | A build writes inside its worktree without asking and is refused outside it; a gate item it skips carries its reason, and the review lists every skip | Build Phase 3 | Build Phase 7 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/gate-policy-env.test.ts, apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A31 | A plan that is approved, in review or accepted shows that position on its admin page | Test Phase 1 | Build Phase 2 | planned | unit | the planning rule that a plan adding a lifecycle position renders it in the admin, in the same plan | apps/indusk-admin/src/components/PlanDetail.positions.test.tsx |

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

- [ ] Create/confirm this plan's worktree (`indusk worktree create admin-plan-authoring`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [ ] A7, A8, A10: `plans-start.test.ts`, through the CLI in a fixture git repository: `indusk plans start feature demo-plan` creates `plan/demo-plan`, its worktree and assignment, and the folder with `workflow: feature` only in the worktree; a second start, and a start over an existing branch or worktree, is refused naming which. RED: `plans start` is not a command
- [ ] A9, A23: `plans-approve.test.ts`, through the CLI: approving a plan whose branch holds only `.indusk/` changes merges it into `main` and sets the impl `approved`, the branch still checked out in its worktree; a brief naming a promise the registry lacks is refused with the contract's message, `main` unchanged; a branch touching a file outside `.indusk/` is refused. RED: `plans approve` is not a command
- [ ] A18: `plans-land.test.ts`, through the CLI: landing a plan with no `accepted` is refused naming the plan, `main` unchanged; after `plans accept` it merges `--no-ff`, removes the worktree and deletes the branch. RED: `plans land` is not a command
- [ ] A11, A12, A14: `plans-next.test.ts`, through the CLI over fixture impls: an open build phase answers `work`; every phase closed and no falsification answers `falsify`, then `cleanup`; all closed answers `review` and never `retrospective`; an open Deferred Verification item answers `judgement` naming it. RED: `plans next` is not a command
- [ ] A15, A16, A17: `plans-review.test.ts`, through the CLI in a fixture repository with a plan branch: each promise the brief makes with its passing rows, one with none marked unproven; the falsification phase's rows and fix items; the changed files against the merge base. RED: `plans review` is not a command
- [ ] A31: `PlanDetail.positions.test.tsx` renders a plan whose impl is `approved`, one with `review: ready`, and one with `accepted:` set, and expects each position's label. RED: the page shows none of them
- [ ] A25: `admin-uses-package-commands.test.ts` reads every file under `apps/indusk-admin/src` and refuses a `git worktree`, `git merge` or `claude` spawn, and any import of a `plans` or `session` module that is not the package's subpath. Passes on today's tree (no such code); see Regression Guards
- [ ] A26: run the never-wait guard over this phase's new tests

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

- [ ] Every row writable here is authored and each red one fails on its own assertion, not a load error (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-start src/__tests__/plans-approve src/__tests__/plans-land src/__tests__/plans-next src/__tests__/plans-review` and `cd apps/indusk-admin && pnpm exec vitest run src/components/PlanDetail.positions src/__tests__/admin-uses-package-commands`); A25 and A26 pass
- [ ] The deferred bodies above reviewed: each compiles at the phase it names and asserts what its row claims

### Build Phase 1: The plan commands

- [ ] `lib/plans/start.ts`: `startPlan(root, type, name)` — refuses a taken folder, branch or worktree, naming which; calls `createPlanWorktree`; writes the plan folder with `workflow: <type>` in the worktree only
- [ ] `lib/plans/approve.ts`: `approvePlan(root, name)` — `checkPlanContract` on the worktree's copy; refuses a branch touching anything outside `.indusk/`, and a trunk dirty on the branch's paths; merges `--no-ff` into the trunk; sets the impl `approved`
- [ ] `lib/plans/accept.ts`: `acceptPlan(root, name, by)` — writes `accepted` and `accepted_by` to the impl's frontmatter and commits on the branch
- [ ] `lib/plans/land.ts`: `landPlan(root, name)` — refuses without `accepted`; merges the trunk into the branch, runs the project's checks, merges `--no-ff` into the trunk, releases and removes the worktree, deletes the branch
- [ ] `indusk plans start | approve | accept | land` in `bin/commands/plans.ts`; the package exports `./plans`

#### Build Phase 1 Verification

- [ ] A7, A8, A9, A10, A18, A23 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-start src/__tests__/plans-approve src/__tests__/plans-land`)
- [ ] `src/__tests__/plan-worktree*.test.ts` still pass with `createPlanWorktree` shared

#### Build Phase 1 Context

- [ ] planning: in `templates/planning/CLAUDE.md`, the worktree entry says a plan starts with `indusk plans start`, approval merges its documents, and `plans land` refuses an unaccepted plan — then `indusk update` here

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: `start`, `approve`, `accept`, `land`, each with what it refuses

### Build Phase 2: The next step, and the positions it reads

- [ ] Move `detectHumanGate` from `lib/run/loop.ts` to `lib/build/judgement.ts`; `loop.ts` imports it; add it to `one-definition-per-shared-rule`'s tests
- [ ] `lib/build/next-step.ts`: `nextBuildStep(plan, outcomes)` per ADR D4's table, with cannot-continue's three causes
- [ ] `indusk plans next <name>` prints the step as JSON
- [ ] `lib/lifecycle.ts`: positions `approved`, `in review` (impl `review: ready`) and `accepted`; the admin's plan page renders each
- [ ] A13 written red, then passing

#### Build Phase 2 Verification

- [ ] A11, A12, A13, A14, A31 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-next src/lib/build src/lib/run` and `cd apps/indusk-admin && pnpm exec vitest run src/components/PlanDetail`)
- [ ] `src/lib/run/loop.test.ts` and `lifecycle-render-parity.test.ts` still pass

#### Build Phase 2 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: `lib/build/` holds the build's decisions — the next step and judgement items — and Dawn reads the same judgement rule

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: `next`, its answers and the three causes of cannot-continue; `apps/docs/src/reference/admin-ui/overview.md`: the three new positions

### Build Phase 3: The review, and skips with reasons

- [ ] `lib/build/review.ts`: `buildReview(root, plan)` per ADR D6, reading promises and rows through the confirm module's reader, never a copy
- [ ] `indusk plans review <name>` prints it, `--json` for the admin
- [ ] `check-gates.js` and `validate-impl-structure.js` read `INDUSK_GATE_POLICY` before the impl and settings; under `auto` a skip without a reason is refused
- [ ] A30's hook half written red over the hook boundary, then passing

#### Build Phase 3 Verification

- [ ] A15, A16, A17 pass, and A30's hook half (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-review src/__tests__/gate-policy-env`)
- [ ] `hook-cwd-independence.test.ts` and `check-gates` tests still pass

#### Build Phase 3 Context

- [ ] guard: `gate-policy-env.test.ts` carries `lesson: a-build-skips-a-gate-only-with-its-reason`; the lesson file is written with it

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/skills/work.md`: the gate policy table gains the environment level

### Build Phase 4: The session

- [ ] Record fixture streams from a real `claude` session: a question, a permission request, an interrupt, a result, an error
- [ ] `lib/session/protocol.ts`: `parseSessionLine`, `answerQuestion`, `decidePermission`, `interrupt`, `buildArgs(kind)` (`default` for planning, `acceptEdits` for build)
- [ ] `lib/session/permissions.ts`: a build's decision — allowed inside the worktree, denied outside
- [ ] `lib/session/start.ts`: `startSession({ cwd, prompt, kind })` — refuses an untrusted project, saying how to trust it; the package exports `./session`
- [ ] A1–A4 protocol halves and A5 written red, then passing; A5 added to `vitest.tiers.ts` `SYSTEM`

#### Build Phase 4 Verification

- [ ] A4 and the protocol halves of A1–A3 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session`)
- [ ] A5 passes against the installed `claude` (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/session-protocol-contract`)

#### Build Phase 4 Context

- [ ] guard: `session-protocol-contract.test.ts` carries `lesson: the-admin-drives-claude-over-an-undocumented-flag-and-a-contract-test-watches-it`; the lesson file is written with it

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: how a session is started, its two kinds, and the trust requirement

### Build Phase 5: The daemon owns sessions

- [ ] `daemon.ts` starts Next with `-H 127.0.0.1`
- [ ] `lib/session/manager.ts`: one session at a time; the record in `~/.indusk/admin-sessions.json`; `stopAll()`; `reapRecorded()` checks each pid is the `claude` it started
- [ ] `indusk ui stop` calls `stopAll()` before the daemon; the daemon calls `reapRecorded()` at start
- [ ] The admin's routes: `POST /api/sessions`, `POST /api/sessions/:id/reply`, `POST /api/sessions/:id/stop`, `GET /api/sessions/:id/events`; each `POST` refuses an `Origin` that is not the admin's
- [ ] A21 manager half and A22 written red, then passing; A22 in `SYSTEM`

#### Build Phase 5 Verification

- [ ] A21's manager half passes (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager`)
- [ ] A22 passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-session-lifecycle`), and `admin-cli-lifecycle.test.ts` still passes

#### Build Phase 5 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: the admin is no longer read-only; it writes only through package commands and sessions, its routes are localhost-only and check their origin

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: the routes, one session at a time, stopping, and what happens when the daemon stops or crashes; `apps/docs/src/decisions/admin-ui-hosting.md` notes the amendment

### Build Phase 6: The panel

- [ ] `components/session/SessionPanel.tsx`: the stream, a question with its choices, a permission request with Allow and Deny, Stop
- [ ] New plan on the project page: a type and a name, then `plans start` and a planning session in the new worktree
- [ ] Approve on a plan's page, once its impl is written: `plans approve`, its refusal shown as the command gives it
- [ ] The plan page refreshes when the session reports a write
- [ ] A1–A3 and A21 panel halves written red, then passing

#### Build Phase 6 Verification

- [ ] A1, A2, A3, A21 pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/session`)
- [ ] A25 still passes (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/admin-uses-package-commands`)

#### Build Phase 6 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: the session panel reads one event stream and sends replies; it never parses the session's protocol itself

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: the panel, with a screenshot of a question

### Build Phase 7: Build, review, accept, release

- [ ] `lib/build/runner.ts`: `runBuild({ plan, startSession, now })` — a fresh build session per step with `INDUSK_GATE_POLICY=auto`, `nextBuildStep` after each, stops at judgement, cannot-continue or review; never starts the retrospective
- [ ] On review: Accept runs `plans accept`, then a session running `/retrospective <plan>`; `release.auto_accept: true` accepts at review
- [ ] The review panel renders `plans review --json`: promises and their tests, falsification, files, skips
- [ ] Build on an approved plan's page starts the runner; the panel shows its current step and why it stopped
- [ ] A19, A20 and A24 written red, then passing; A24 in `SYSTEM`

#### Build Phase 7 Verification

- [ ] A19, A20, A30 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/build src/lib/session src/__tests__/gate-policy-env src/__tests__/plans-review`); A25 still passes
- [ ] A24 passes (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/build-session-gates`)

#### Build Phase 7 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: a build's sessions run with `INDUSK_GATE_POLICY=auto` and every skip is read at review; the runner never starts the retrospective

#### Build Phase 7 Document

- [ ] `apps/docs/src/guide/plan-lifecycle.md`: plan, approve, build, review, accept, release, from the admin or the editor, with the Mermaid sequence

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
