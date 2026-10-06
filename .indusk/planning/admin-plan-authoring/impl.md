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
| A6 | A plan started in the admin and one started in the editor produce the same plan folder and registry entries, and either continues from the other | Build Phase 9 | Build Phase 9 | passing | live check | a live check of a-plan-can-start-from-the-admin, recorded in Build Phase 9; the promise is proven by its unit and contract rows (A1–A5) | manual: recorded in Build Phase 9 |
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
| A26 | With this plan's tests added, no everyday test starts Claude, a server or a detached process, or waits | Test Phase 1 | Build Phase 9 | passing | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A27 | In a scratch project, one plan goes the whole way in the admin without a terminal: started, planned, promises accepted, approved, built to review, evidence read, accepted, released | Build Phase 9 | Build Phase 9 | passing | live check | a live check of the whole flow, recorded in Build Phase 9; each promise it walks is proven by its own unit and contract rows | manual: recorded in Build Phase 9 |
| A28 | This plan's six promises go from `declared` to `enforced` when it closes | Build Phase 9 | Build Phase 9 | passing | live check | the plan's own close: confirming its promises is what this row records, so it cannot also be one of their proofs | manual: `indusk promises confirm admin-plan-authoring`, recorded in Build Phase 9 |
| A29 | A non-merge commit on `main` that changes an active plan's documents is marked as a violation of the own-branch promise; a merge from the plan's branch is marked upheld; the commit is never refused | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts |
| A30 | A build writes inside its worktree without asking and is refused outside it; a gate item it skips carries its reason, and the review lists every skip | Build Phase 3 | Build Phase 7 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/__tests__/gate-policy-env.test.ts, apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A31 | A plan that is in review or accepted shows that position on its admin page | Test Phase 1 | Build Phase 2 | passing | unit | the planning rule that a plan adding a lifecycle position renders it in the admin, in the same plan | apps/indusk-mcp/src/lib/lifecycle-review.test.ts, apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts |
| A32 | Approving or landing a plan commits InDusk's own bookkeeping left uncommitted on `main` (its `current.md`, highlight logs, evaluator results, lessons) in a commit of its own, and still refuses any other uncommitted change on a path the plan touches, naming it | Build Phase 10 | Build Phase 10 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-land.test.ts, apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A33 | The review lists uncommitted changes on `main` that are not InDusk's bookkeeping, on paths the plan touches, so the person sorts them out before accepting | Build Phase 10 | Build Phase 10 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts, apps/indusk-admin/src/components/session/ReviewPanel.test.tsx |
| A34 | A page on another site whose name resolves to the loopback address (DNS rebinding: `Origin: http://evil.example:3996`, `Host: evil.example:3996`) cannot start a session, answer one, read its events, approve, build or accept a plan; only the admin's own hosts are served | Build Phase 11 | Build Phase 11 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-admin/src/lib/admin-hosts.test.ts |
| A35 | A build-step session (work, falsify, cleanup) that runs `indusk plans accept` or `plans land` is refused, naming why; the release session started by acceptance still lands | Build Phase 11 | Build Phase 11 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-land.test.ts, apps/indusk-mcp/src/lib/build/build-session.test.ts |
| A36 | A planning session asks before writing a file even when the developer's or the project's Claude Code settings allow that write (`permissions.allow: ["Edit(...)"]`) | Build Phase 11 | Build Phase 11 | skipped | contract | promise: a-plan-can-start-from-the-admin | none — dropped (Sandy, 2026-10-06): an allow rule is the developer's explicit, per-tool choice and applies in their terminal too; A4 guards against the blanket `auto` default. Run against the real CLI, an untrusted folder's allow rule was not honoured and the write was asked about; proving the trusted case would mean writing `~/.claude.json` while Claude Code writes it |
| A38 | Reading the trunk's branch gives the branch, whether it is one of the project's trunk branches, and the list, the same answer for starting, approving, landing and reviewing a plan | Build Phase 12 | Build Phase 12 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/lib/trunk-branch.test.ts |
| A39 | A panel's request to the admin gives back the server's body when it succeeds, and when it fails the server's error, else its status, else why the request itself failed | Build Phase 12 | Build Phase 12 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-admin/src/lib/post-json.test.ts |
| A40 | A build step and the evaluator judge the same run as rate-limited, or not, by one rule, and wait the same schedule before trying again | Build Phase 12 | Build Phase 12 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/lib/session/rate-limit.test.ts |
| A37 | A staged rename of a bookkeeping file on `main` (`git mv` of a lesson) does not crash approve or land with a raw git error; the rename is committed as bookkeeping, and a staged rename of the person's file is named by its new path | Build Phase 11 | Build Phase 11 | passing | unit | approve and land read the trunk's status exactly, so A32's commit and refusal hold for every status git reports | apps/indusk-mcp/src/__tests__/plans-approve.test.ts, apps/indusk-mcp/src/__tests__/plans-land.test.ts |

### Deferred Verification

- **An unattended build does good work (U1)**
  - reason: it is an agent following prose through each step; whether its work is good cannot be asserted by a test
  - would require: many builds judged by the people who accept them
  - mitigation: falsification and cleanup still run; the review shows the evidence (A15–A17, A30); nothing lands before acceptance (A18); the brief's second expectation counts the stops over the next five plans
- **A plan started in the editor is written on its own branch (U2)**
  - reason: the editor path is the planner skill, an agent following prose, and Sandy chose to keep it a convention (2026-10-06)
  - would require: a trunk guard that refuses plan documents on `main`, which was rejected
  - mitigation: the trunk-commit mark (A29) records each plan written on `main` as a violation, read by `indusk promises status` and the admin's Promises page

- **The published package does the whole flow (U3, smoke)**
  - reason: a session runs whatever `indusk` is on the developer's PATH, and until this plan is published that is 1.62.0, which has no `plans` verbs — A27's release landed by hand for that reason; only the published tarball tests the bundled admin, `indusk update` installing these skills and hooks, and the global CLI together (Sandy, 2026-10-06: test "with the actual latest published" package)
  - would require: the release, which follows this plan's close
  - mitigation: a smoke run right after `pnpm release` — install the published version, `indusk update` a scratch project, and take one small plan from New plan through Build, Accept and `indusk plans land` in the admin; the result is recorded in `current.md`, and a defect opens a bugfix plan whose first failing test is that defect. Before the release, Build Phase 9 reruns the release step with this branch's CLI first on the sessions' PATH, so `plans land` is seen live

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

#### Deferred to Build Phase 10

- **A32, A33** — added after A27 (Sandy, 2026-10-06): the unattended release met InDusk's own uncommitted notes on the trunk and settled it itself; InDusk's bookkeeping should be InDusk's to commit, and anything else the person's to see before accepting. Both reach their subject over the CLI, red on today's refusals and today's review.

#### Deferred to Build Phase 12

- **A38–A40** — from the cleanup ritual, run after Build Phase 11 closed: each names a unit Build Phase 12 extracts, so its subject does not exist yet.

#### Deferred to Build Phase 11

- **A34–A37** — hypotheses from the falsification ritual, run after Build Phase 10 closed; each is writable now against today's code and red on it, and passes when Build Phase 11's fixes land.

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

- [x] `skills/planner.md`: starting fresh calls `indusk plans start`; approval calls `indusk plans approve` — step 3 starts the plan on its own branch and works in its worktree (a plan the admin started is already there); a new step 10 approves through the command, never by hand
- [x] `skills/work.md`, `falsify.md`, `cleanup.md`: an unattended section — finish on the agent's own judgement where today they ask, record every gate skip with its reason; the "human-gated by design" text replaced — `work.md`'s "Unattended" section names what a build session does and does not do; falsify's and cleanup's loop exits end on the agent's own judgement and write the summary into the phase
- [x] `skills/retrospective.md`: landing calls `indusk plans land`, and the plan must be accepted first — Step 10's merge and removal steps are now the command; the reviewers' path keeps its spelled-out order. `plan-worktrees-skills.test.ts` (admin-plan-worktrees) pinned the order merge → release → remove in the prose; it now pins it in `land.ts`, where it is decided, and in the reviewers' path
- [x] `lib/promises/mark.ts`: `markPromise(span, name, outcome, symptom)`; `markEvaluation` uses it — `markPromise(span, { promise, outcome, project?, symptom? })`
- [x] `eval-trigger.js`: a commit landed on the trunk branch that is not a merge and changes an active plan's folder marks `a-plan-is-written-on-its-own-branch` violated, naming the plan and the commit; a merge from `plan/<name>` marks it upheld — the reading is `lib/promises/trunk-commit.ts` (`trunkCommitMarks`, then `markTrunkCommit` on the evaluator's tracer); the trigger's detached evaluator process runs it before evaluating, so the marks flush with the evaluation's; it never throws, and a package without the module evaluates as before. Any merge that brings a plan's documents in counts as upheld (approval, landing, or a reviewer's merge)
- [x] A29 written red, then passing; `indusk update` here — written before `mark.ts` and `trunk-commit.ts` existed (a load error; its subjects were new), then 7 passing. `update` run with this branch's build: it installed the changed skills and hooks, among them `_gate-policy.js`, which Build Phase 3 added and nothing had installed; its version stamp in `config.json` and its registration of this worktree as a project were undone again

#### Build Phase 8 Verification

- [x] A29 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-plan-commit-mark src/__tests__/eval-trigger-commit-anchor src/__tests__/monitor-mark`) — 10 everyday; `monitor-mark` is in the system tier and was run there: 6 of 6, the evaluator's mark unchanged through `markPromise`; `tsc --noEmit` clean
- [x] `src/__tests__/skill-*.test.ts` and `planner-brief-template.test.ts` still pass — 35, with every installed skill byte-identical to its source after `update`
- [x] Shape — `mark.ts` is the mark and nothing else; `trunk-commit.ts` separates the reading (`trunkCommitMarks`, which the test drives over real git) from the emitting (`markTrunkCommit`, which never throws); the hook gained one chained import. Nothing to change

#### Build Phase 8 Context

- [x] planning: `templates/planning/CLAUDE.md` — a plan is written on its own branch by convention, and a plan written on `main` is marked, not refused — the entry Build Phase 1 wrote, amended; the installed `.indusk/planning/CLAUDE.md` copied from the template (byte-identical), not by a second `update`, whose side effects were already undone once; `check-pointers` passes

#### Build Phase 8 Document

- [x] `apps/docs/src/reference/skills/work.md` and `retrospective.md`: the unattended section and landing by `plans land`

### Build Phase 9: The whole way, once

- [x] (discovered) A planning session is a conversation: the planner asks in prose and presents each document for review, and waits for a reply in the person's words, which the panel could not send. The manager's `say` (recorded as a `you` event, so the panel shows both sides), `POST /api/sessions/:id/say`, and a message box in the panel. Tests: the manager's `say` (red on its assertion first) and the panel sending what was typed, both under A1
- [x] (discovered in A27) The admin's `readActivePlans` listed only the trunk's plan folders, so New plan opened a 404: a plan on its own branch reaches the sidebar and its page now (`planning-reader.own-branch.test.ts`, red first). And a plan with no running session had no way to start one: Continue planning on its page
- [x] (discovered in A27) The session log holds to about ten lines and follows new events (Sandy, 2026-10-06: "we need the content to scroll after 10 lines")
- [x] (discovered in A27) A planning session leaves its documents uncommitted, which approval refused; `approvePlan` now commits the plan's own `.indusk/` changes on the branch and still refuses uncommitted work outside `.indusk/`, naming it (two cases in `plans-approve.test.ts`, red first; the first fix cut a character off the first status line, because `git` trims its output)
- [x] (discovered in A27) A question could not be answered in the person's own words, nor with several choices; the panel now offers Other with a text field, and several choices when the question allows it (two panel cases, red first)
- [x] A27: in a scratch project, one plan from New plan to release in the admin with no terminal; record what happened, every stop and why — `seatbox` (a one-file greeter, `indusk init`, this branch's admin on port 3996 with a private InDusk home), plan `shout-flag` (bugfix). **Start**: New plan made `plan/shout-flag` and its worktree. **Plan**: the panel carried the conversation — two questions answered by choice, permission requests allowed, one denied with a typed reason; brief, test plan and impl appeared on the page as written; the promise was declared through the CLI (the untrusted worktree loaded no project MCP server). **Approve**: the Approve button merged the documents and the promise to `main`. **Build**: unattended to review — Test Phase 1 red on assertions, the fix, Build Phase 1 green, falsification (7 hypotheses, none survived) and cleanup each skipped with its reason; no item skipped, a commit per item, `HELLO, SANDY!`. **Stops**: none undeclared — the build stopped only at review. **Review**: the promise proven by A1–A3, both skipped rituals with reasons, six files. **Accept → release**: the retrospective landed and archived the plan; the promise `enforced`. Two gaps in that release: the session's `indusk` was the installed 1.62.0, without `plans land`, so it landed by the manual steps; and it committed another session's uncommitted `current.md` notes on the trunk to clear its path, a decision raised with Sandy. Rerun with this branch's CLI first on the sessions' PATH (plan `whisper-flag`, built by hand to review): Accept in the admin, and the retrospective landed through `indusk plans land`. Fixed on the way, each test-first: branch-only plans missing from the admin's reader (a 404), Continue planning, typed replies, Other and multi-select answers, a ten-line scrolling log, approval committing the plan's own documents, skipped rituals in the review and on the plan page, one panel per session (the last two found by Sandy)
- [x] A6: one plan started in the editor and continued in the admin, and one the other way round; record both — `whisper-flag` was started from a terminal (`indusk plans start`, documents and promise written there, `plans approve`) and accepted and released in the admin; `echo-flag` was started with New plan in the admin, stopped, and continued by a terminal `claude -p "/planner echo-flag …"` in its worktree, which accepted its brief, declared its promise and committed on `plan/echo-flag` — and the admin then read it ("brief accepted, awaiting the next document"). The three plans' registry entries carry the same fields, owned by their plans; their folders have the same shape
- [x] A28: `indusk promises confirm admin-plan-authoring`; the six promises read `enforced` — the first run refused four times, each rightly: the live-check rows A6 and A27 named a `manual:` procedure as a test file under a promise, A28 was still `written`, and no code carried any of the six tokens. The three live-check rows now say what they are rather than claiming a proof; the code that keeps each promise carries its token (the session protocol and New plan route; `plans start`, `approve` and the trunk-commit mark; the runner and next step; the review; `land`; the session manager). Then: all six `enforced`, 18 test files and 16 code sites recorded, the registry check passing

#### Build Phase 9 Verification

- [x] A26 passes over every test this plan added (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/everyday-tests-never-wait`), and a full `pnpm test` is marked held — the guard 6 of 6; `pnpm test` 296 + 56 files, 2,293 tests, `everyday-suite-stays-fast` marked upheld at 63 s. Its first run caught three of this plan's own: `plan-branch.ts` spelling `rev-parse HEAD` instead of `headSha`, `session/trust.ts` spawning `--git-common-dir` instead of `gitCommonDirOf`, and the root CLAUDE.md past its 20 % margin from this plan's Key Decisions line (shortened, and the admin-ui-phase-progress entry trimmed to its rule)
- [x] `indusk promises check` passes with the six promises enforced — 18 promises: 17 enforced, 1 known-violated (`every-commit-evaluated`, its incident open from before this plan), none declared
- [x] Shape — Build Phase 9 wrote `session-owner.ts` (one rule for which control owns a running session), the reply route and message box, Continue planning, approval committing the plan's own documents, Other and multi-select answers, skipped rituals in the review and on the page. Each is one job where it lives. One finding acted on during the phase: two controls each decided ownership of the same session, which is why a build's panel appeared twice; the rule now lives once. Nothing more to change

#### Build Phase 9 Context

- [x] current.md: the live checks' results, and any stop in A27 that was not declared — this session's section, through `update_current_section` (the trunk's copy; left uncommitted beside the other sessions' changes there): the run, the fixes, no undeclared stop, and the open questions (the unattended retrospective committing another session's notes; the U3 smoke; `update` registering a worktree)

#### Build Phase 9 Document

- [x] `apps/docs/src/changelog.md` Unreleased: the admin can start, build, review and release a plan; `indusk plans` verbs; a plan cannot land before it is accepted

### Build Phase 10: InDusk's bookkeeping, and the person's work, on main

**Goal**: InDusk takes care of its own notes left uncommitted on the trunk; anything else there that a plan's merge would touch is shown to the person at review and stops the release, never settled by a session (Sandy, 2026-10-06). Where bookkeeping should be written at all is the follow-on brief's question.

- [x] A32 and A33 written red over the CLI
- [x] `lib/plans/bookkeeping.ts`: `isBookkeeping(path)` — `.indusk/current.md`, `.indusk/highlights.jsonl`, `.indusk/highlights-processed.jsonl`, `.indusk/eval/`, `.claude/lessons/` — and `commitTrunkBookkeeping(pb)`, one commit labelled as bookkeeping; `approvePlan` and `landPlan` call it before checking the trunk
- [x] `buildReview` gains `uncommittedOnMain`: changes on the trunk, outside bookkeeping, on paths the branch touches; the review panel shows them above Accept
- [x] `skills/work.md` unattended: never commit, stash or discard work that is not the plan's; InDusk's bookkeeping is committed by `plans land`; anything else stops the release with cannot-continue

#### Build Phase 10 Verification

- [x] A32, A33 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-land src/__tests__/plans-approve src/__tests__/plans-review` and `cd apps/indusk-admin && pnpm exec vitest run src/components/session/ReviewPanel`) — 3 files, 16 tests; the admin's session components 16 of 16; every everyday test driving a `plans` verb 6 files, 29 tests; both packages type-check; biome clean on the touched files
- [x] Shape — Build Phase 10 wrote `bookkeeping.ts` (what counts as InDusk's own and the two trunk reads over it), `refuseDirtyTrunk` now committing that first, the review's `uncommittedOnMain`, and the panel's warning. `statusPaths` replaced two hand-rolled porcelain parses (approve's and the trunk check's), the one finding, acted on during the phase. Nothing more to change

#### Build Phase 10 Context

- [x] planning: `templates/planning/CLAUDE.md` — at approval and landing InDusk commits its own bookkeeping on the trunk; other uncommitted work there is the person's, shown at review — added to the own-branch entry (8,692 bytes); installed copy synced, and `skills/work.md`'s unattended rule with it

#### Build Phase 10 Document

- [x] `apps/docs/src/reference/cli/plans.md`: what `approve` and `land` commit and what they refuse; `reference/skills/work.md`: the unattended rule — a section naming the five bookkeeping paths, both refusal lists amended, and the unattended list's new line linking to it

### Build Phase 11: Falsification — who can drive a session, and who can say a plan ships

**Goal**: verify whether nothing-ships-until-accepted and a-plan-can-start-from-the-admin hold against four failure modes:
- a page on another site reaching the daemon by DNS rebinding;
- a build step accepting and landing its own plan;
- the developer's own allow rules letting a planning session write unasked;
- a staged rename on `main` breaking the trunk check.

Each row is one hypothesis; each item is the fix if it confirms.

Evidence found while hunting:
- `sameOrigin` (`apps/indusk-admin/src/lib/session-host.ts`) compares `Origin` with `Host`, and a rebound name makes both the attacker's. The events route checks nothing. An attacker's page could start a session, read its events, answer its own permission requests, and `POST /api/plans/accept`.
- `decideBuildPermission` allows every Bash call, so a build session can run `indusk plans accept` and `plans land`. Only the work skill's prose stops it.
- `buildArgs("planning")` sets only `--permission-mode default`. This project's settings already allow `Edit(.claude/handoff.md)`, and the developer's allow `Bash(git merge:*)` and `Bash(git checkout:*)`.
- `statusPaths` reads `R  old -> new` as one path, and `git add` of that string fails.

- [x] The admin serves its API only to its own hosts: one check, in `session-host.ts`, that `Host` is the loopback address or `localhost` on the daemon's port, or a host the admin's proxy route declares (`indusk.dawn`), applied to every route under `app/api/sessions` and `app/api/plans`, the events `GET` included; `sameOrigin` stays as the second check on every POST — `isAdminHost` in the package's session module (any port: the port is the daemon's to choose, and loopback is local whatever it is), `adminOnly(request)` first in all twelve handlers. Writing it found two more unguarded `GET`s than the phase named: `sessions` (it hands out the running session's id) and `plans/build`; A34 now reads every handler each route module exports rather than a list
- [x] Build-step sessions carry `INDUSK_BUILD_STEP=<work|falsify|cleanup>` (set in `build-session.ts`); `acceptPlan` and `landPlan` refuse under it, naming the step, and the release session (`retrospective`) is not marked so it still lands. This is a boundary against a confused session, not a sandbox, and the doc says so
- [x] (not done — dropped with A36; asked: "A36 passed today… an allow rule is your own explicit, per-tool choice that applies in your terminal too. What should happen to A36?" — user: "Drop it (Recommended)") A planning session starts with `--settings` carrying `permissions.ask` for `Edit`, `Write`, `MultiEdit` and `NotebookEdit`, so an allow rule in any settings file still reaches the panel as a request; `buildArgs` gains it, and A4's unit test asserts it
- [x] `statusPaths` reads `git status --porcelain -z`, taking a rename's new path (and committing both sides of a bookkeeping rename); `commitTrunkBookkeeping`, `uncommittedWork` and approve's worktree check use it — `statusPaths(checkout, paths?)` now runs the status itself, so its three callers no longer spell the command; it returns both sides of a rename as paths. The fix found a second failure behind the first: a rename's old side is gone from the index and the disk, so `git add` refuses it; only paths on disk are added, and the commit takes the rest by name

#### Build Phase 11 Verification

- [x] A34: a request to each `app/api` route with `Host: evil.example:3996` and a matching `Origin` is refused 403; the same request with `Host: 127.0.0.1:3996` is served (red today: `sameOrigin` passes it, the events route checks nothing) — passing: twelve handlers in ten route modules, each refusing the rebound host and serving loopback, plus the inventory (`cd apps/indusk-admin && pnpm exec vitest run --project node src/lib/admin-hosts.test.ts`, 25 tests); the admin's node suite 22 files, 208 tests
- [x] A35: `INDUSK_BUILD_STEP=work indusk plans accept <plan>` and `… plans land <plan>` are refused naming the step; without the variable both run (red today: both run) — passing, with `stepEnv` marking work, falsify and cleanup and not the retrospective (`build-session.test.ts`)
- [x] (skipped — A36 dropped; asked: "What should happen to A36?" — user: "Drop it (Recommended)") A36: in the system tier, a real planning session in a scratch project whose `.claude/settings.json` allows `Edit(notes.md)` is asked to edit `notes.md`, and a permission request reaches the stream before the file changes (red today: the edit happens unasked)
- [x] A37: with a lesson `git mv`-ed and staged on the trunk, `plans approve` commits it as bookkeeping and succeeds; with a staged rename of a file the plan touches, the refusal names the new path (red today: `git add` fails on `old -> new`) — passing; every everyday test driving a `plans` verb and the build module's, 55 tests; both packages type-check; biome clean on the touched files
- [x] Shape — Build Phase 11 wrote `session/hosts.ts` (which hosts are the admin's), `adminOnly` (the one check every handler makes first), `build/step-env.ts` (the marker's name and its reader, a module of its own so `plans` and `build` share it without importing each other), `stepEnv` beside the gate policy it extends, `refuseInsideBuildStep`, and `statusPaths` reading `-z` itself. Each is one job where it lives. One finding acted on during the phase: three callers spelled the porcelain status command and parsed it apart from each other; the reader now runs it. Nothing more to change

#### Build Phase 11 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a route under `app/api` that changes something or streams a session checks the host first, then the origin; the reason is DNS rebinding, and a new route without the check is how the next hole opens — every handler, reads included (two of the three unguarded `GET`s hand out what an attacker needs next), with its guard named

#### Build Phase 11 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: the hosts the admin answers on, and why; `reference/cli/plans.md`: `accept` and `land` refuse inside a build step; `reference/skills/work.md`: a planning session asks before every file write, whatever the settings allow — the first two as written; the third dropped with A36 (asked: "What should happen to A36?" — user: "Drop it (Recommended)"), and `reference/skills/work.md` says instead that accept and land refuse inside a build step

### Build Phase 12: Cleanup — one definition for what three files each spell

**Goal**: decompose the rules this plan's files repeat across each other, under the project's promise `one-definition-per-shared-rule` (a rule shared by two callers has one definition) and the rule of three for the rest. Each item is one extraction or a reasoned leave-as-is. Each new unit gets a row.

What was reviewed: `listOversizedChangedFiles` against `main` flags 19 files. All 19 existed before this plan, and its edits to them are small. Every file the plan created is under its cap, so the work below is about duplication, not size.

- [x] Extract `currentTrunkBranch(projectRoot)` → `{ branch, allowed, onTrunk }` into `apps/indusk-mcp/src/lib/trunk-branch.ts`. Three sites read the trunk's branch and check it against `getTrunkBranches`, each on its own:
  - `worktree/plan-worktree-commands.ts` (before this plan);
  - `plans/plan-branch.ts`;
  - `build/review.ts`, which falls back silently to a literal `main`.

  The first two keep their own refusal messages. The review diffs against the trunk branch the reader returns, and lists no files when the trunk is on no trunk branch. Basis: the rule of three.
- [x] `build/review.ts` reads the branch's changed files through `plan-branch.ts`'s `branchChanges`, extended to return each file's status. Today `changedFiles` repeats the same `git diff trunk...branch`. Basis: `one-definition-per-shared-rule`.
- [x] Extract `postJson(url, body)` → `{ ok: true, body } | { ok: false, error }` into `apps/indusk-admin/src/lib/post-json.ts`. Four panel components spell "POST JSON; when not ok, read `{ error }` or fall back to the status" five times between them:
  - `BuildControls`;
  - `PlanSession`, twice;
  - `NewPlanForm`;
  - `SessionConnector`.

  Each component keeps its own state handling. Basis: the rule of three. The helper is a plain function, not a component or a hook, so react's one-component-per-file does not apply.
- [x] (done: the stream's `result` event is the message `-p --output-format json` prints whole, where the evaluator reads `api_error_status`; the protocol now carries it as `apiErrorStatus`, so no text match remains) One rate-limit rule, shared by the build and the evaluator. Today `build/build-session.ts` matches error text against `429|rate limit` and waits 15, 45 and 90 s. `eval/persistent-evaluator.ts` reads `api_error_status === 429`, the field that incident `i-2026-10-05-every-commit-evaluated` showed is reliable, and waits on the same schedule. Move the rule and the schedule into `apps/indusk-mcp/src/lib/session/rate-limit.ts` and have both use them. First check that the stream's `result` event carries `api_error_status`. If it doesn't, record that here and keep the text match beside the shared schedule. Basis: `one-definition-per-shared-rule`.
- [ ] (reviewed the admin's route handlers under `app/api` — left as-is: each parses a body of a different shape, and what they share is two lines, `getProjectPath` then a 404. A helper would take more lines than it saves, and `adminOnly` already holds the part that must not differ.)
- [ ] (reviewed `apps/indusk-mcp/src/bin/cli.ts`, 1,059 lines — left as-is for this plan: almost all of it predates this plan, whose additions are the verb registrations, and those point at `bin/commands/plans.ts`. Splitting the CLI is its own plan, not this one's cleanup.)
- [ ] (reviewed `lib/lifecycle.ts`, 542 lines, and the admin's `lib/planning-reader.ts`, 597 lines — left as-is: this plan added two positions to the first and branch-only plans plus skipped rituals to the second. Both stay single modules, each with one reason to change: the positions are one table, and the reader is the one place the admin reads a plan.)
- [ ] (reviewed `hooks/check-gates.js`, `hooks/validate-impl-structure.js` and `hooks/eval-trigger.js` — left as-is: hooks are standalone scripts by design (hooks/CLAUDE.md), and this plan's edits are one policy read each, plus the trunk-commit mark, which calls the package's `markTrunkCommit` rather than repeating it.)
- [ ] (reviewed the skills and docs pages flagged by size — left as-is: they are prose, and the cap is a lens for code.)

#### Build Phase 12 Verification

- [ ] A38: `currentTrunkBranch` reports the branch, whether it is a trunk branch, and the configured list, for a trunk on `main`, on `master` with `master` configured, and on a feature branch. `plans start`, `approve`, `land` and `review` tests stay green (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/trunk-branch src/__tests__/plans-`)
- [ ] A39: `postJson` returns the body on a 2xx, the server's `{ error }` on a 4xx, the status when the body has none, and the failure when `fetch` rejects. The session components' tests stay green (`cd apps/indusk-admin && pnpm exec vitest run src/lib/post-json src/components/session`)
- [ ] A40: the build step and the evaluator judge the same result as rate-limited or not, and wait the same schedule (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/rate-limit src/lib/build/build-session src/lib/eval`)

#### Build Phase 12 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: the trunk's branch is read through `currentTrunkBranch`, and a rate limit is judged by `session/rate-limit.ts`. A third copy of either is the duplication this phase removed.

#### Build Phase 12 Document

- [ ] Search `apps/docs/src` for the review's fallback to `main`, `changedFiles`, and the build's text match on rate limits, and correct any page that describes them; the changelog's Unreleased entry gains the review's trunk-branch fix if the review's behavior changed

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
