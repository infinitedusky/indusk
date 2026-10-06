---
title: "Workbench plan authoring"
date: 2026-10-06
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Workbench plan authoring

## Goal

The admin's plan flow works in a workbench: documents at the root, code on
`plan/<name>` in the repo the plan names, linked by the plan's `code.json`.
A repo has one contract: its own `.indusk/promises/`, or the workbench's
shadow contract until it adopts one, read through one resolver ([ADR](adr.md)).

## Scope

### In Scope
- The contract resolver and every promise reader behind it (D4)
- `plans start --repo`, `code.json`, and a plan-aware `resolveExecutionRoots` (D1, D2)
- Approve, accept, review and land in a workbench (D3, D6, D7, D8)
- Build and planning sessions at the root with the code worktree added (D5)
- The admin: actions on a workbench plan; the repo picker in New plan (D9)

### Out of Scope
- The new plan page from the mockup; moving a shadow contract into its repo;
  plans across two repos; Create project; the Update button

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test reachable over the CLI, red, over every workbench layout | today's tree, `helpers/versioned-workbench.ts` |
| Build Phase 1 | `contractDir`; every promise reader behind it | `promisesDir`, `declaredRepoDirs` |
| Build Phase 2 | `plans start --repo`, `code.json`, `readPlanCode`, plan-aware `resolveExecutionRoots` | the worktree extension's setup script |
| Build Phase 3 | approve, accept, review, land in a workbench | Build Phase 2's code file |
| Build Phase 4 | sessions at the root with `--add-dir`; two-root permissions | Build Phase 2 |
| Build Phase 5 | the admin's workbench actions and repo picker | Build Phases 2–4 |
| Build Phase 6 | the live check; the promises confirmed | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Starting a plan in a one-repo workbench writes its documents at the root, makes a code worktree in that repo on `plan/<name>`, and records both | Test Phase 1 | Build Phase 2 | written | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A2 | In a two-repo workbench, starting needs the repo named and records it; without one it is refused, naming the repos | Test Phase 1 | Build Phase 2 | written | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A3 | Every later step finds the code worktree from the plan's record; a record naming a worktree that is gone is reported, never guessed | Test Phase 1 | Build Phase 3 | written | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A4 | In a workbench whose repo holds `.indusk/promises/`, promises are read from the repo and the workbench's folder is not read | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A5 | In a workbench whose repo holds no promises folder, promises are read and written in the workbench | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A6 | Declaring a promise in a plan whose repo holds a contract writes it in the plan's code worktree | Test Phase 1 | Build Phase 2 | written | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A7 | The registry check, `promises status` and `promises list` give the same promises for a project, with or without a contract in its repo | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A8 | Two workbenches on one repo that holds a contract read the same promises | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A9 | New plan in a workbench project, in the admin, starts the plan; with more than one repo the form asks which | Build Phase 5 | Build Phase 5 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-admin/src/components/session/NewPlanForm.test.tsx |
| A10 | A workbench plan's page offers Continue planning, Approve, Build and Review at the moments a normal-mode plan's does | Build Phase 5 | Build Phase 5 | planned | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-admin/src/lib/plan-actions.test.ts |
| A11 | Approving a workbench plan runs the brief check and marks it approved with nothing merged; a refused brief is refused with the check's message | Test Phase 1 | Build Phase 3 | written | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A12 | A workbench plan's code stays on its branch in the repo until it lands; the repo's trunk is unchanged before then | Test Phase 1 | Build Phase 3 | written | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A13 | A workbench build writes code in its code worktree and checks items off at the root without asking; a write outside both is refused | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/session/permissions.test.ts |
| A14 | In a workbench, a real build session's checkoff is refused by the workbench's gates when an earlier phase skipped a gate without its reason | Build Phase 4 | Build Phase 4 | planned | contract | promise: gates-ran-at-every-checkoff | apps/indusk-mcp/src/__tests__/build-session-gates-workbench.test.ts |
| A15 | A workbench plan's review lists the files its code branch changed in its repo, and uncommitted work on that repo's trunk on those paths | Test Phase 1 | Build Phase 3 | written | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A16 | Landing an unaccepted workbench plan is refused; once accepted, its code merges into the repo's trunk and its code worktree and branch are removed | Test Phase 1 | Build Phase 3 | written | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A17 | No module but the contract resolver joins a path to `.indusk/promises`, and none but `resolveExecutionRoots` decides a code root | Test Phase 1 | Build Phase 2 | written | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/contract-resolver-single-definition.test.ts |
| A18 | In a normal-mode project every plan command, the build and the admin behave as in 1.63.0 | Test Phase 1 | Test Phase 1 | passing | unit | normal mode stays as it shipped; the existing plans, build, session and admin tests are the proof, run unchanged | apps/indusk-mcp/src/__tests__/plans-start.test.ts, apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A19 | In a scratch copy of a real workbench, one plan goes from New plan to landed in the admin, without a terminal | Build Phase 6 | Build Phase 6 | planned | live check | the whole flow in a workbench, recorded in Build Phase 6; each promise it walks is proven by its own rows | manual: recorded in Build Phase 6 |

### Deferred Verification

- **The new contract model holds across a real adoption (U1)**
  - reason: a repo adopting its contract (the shadow moving in) is the next plan's command
  - would require: that command, and a repo whose owner accepts the folder
  - mitigation: A4 and A8 prove reading a repo's contract when one exists; the adoption plan's first test is the move itself

## Checklist

### Test Phase 1: Every test reachable over the CLI, red, in every layout

**Goal**: write each row that reaches its subject over the CLI, across the versioned-workbench `LAYOUTS`, and see each fail on its own assertion.

- [x] Confirm this plan's worktree (`indusk plans start feature workbench-plan-authoring` made it and recorded the assignment) — worktree-per-plan default
- [x] root (Key Decisions): the ADR's one-line entry, added here rather than at ADR acceptance — `plans approve` refuses a branch that changes anything outside `.indusk/`, and the planner skill adds the line before approval; that mismatch is a follow-on
- [x] A1, A2, A3, A6, A11, A12, A15, A16: `plans-workbench.test.ts`, through the CLI over `LAYOUTS` and a two-repo workbench: start, the code file, approve without a merge, a declared promise landing in the code worktree, review's files, land in the repo, and a missing worktree reported. RED today: `plans start` refuses in a workbench
- [x] A4, A5, A7, A8: `contract-resolver.test.ts`, through `indusk promises list`, `status` and `check` over a workbench whose repo holds a contract and one whose does not, and two workbenches on one repo. RED today: the workbench's folder is read — written against `promises check` and the `list_promises` tool: there is no `promises list` command, and `status` needs a running Jaeger, so status's agreement rests on A17 (every reader through one resolver). A4, A7 and A8 red on their assertions; A5 passes today, as it should, since the shadow contract is what a repo without one already reads, and it guards that path through the change
- [x] A17: `contract-resolver-single-definition.test.ts` scans `src/lib` for a join to `.indusk/promises` outside the resolver, and for a code root decided outside `resolveExecutionRoots`. RED today: `promisesDir` and `confirm.ts` each join it
- [x] A18: run the existing `plans-*`, build and session tests unchanged; they pass, and stay the guard — 17 files, 122 tests

#### Deferred to Build Phase 4

- **A13, A14** — A13's subject is `decideBuildPermission` taking two roots, a signature Build Phase 4 introduces; A14 needs Build Phase 2's workbench start to set up its project.

#### Deferred to Build Phase 5

- **A9, A10** — their subjects are the New plan form's repo picker and the plan page's action rule for a workbench plan, both introduced there.

#### Deferred to Build Phase 6

- **A19** — the live check, run once after everything above exists.

#### Regression Guards

- **A18** — normal mode passes today and must keep passing; the existing tests are the guard.

#### Test Phase 1 Verification

- [x] (19 of 19 workbench cases red, in all four layouts and the two-repo workbench, every one on its assertion: `plans start` refuses with the normal-mode message; contract A4, A7, A8 red reading the shadow over the repo's contract; A17 red with no `contractDir` and `confirm.ts` joining its own path) The new files run red on their own assertions, in every layout (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plans-workbench src/__tests__/contract-resolver`), and A18's existing tests pass

### Build Phase 1: One contract resolver

**Goal**: every promise reader finds the folder through `contractDir`.

- [x] `contractDir(root, plan?)` in `lib/promises/registry.ts` (D4): normal mode, the project's folder; a workbench, the plan's repo's folder (its code worktree for a plan in flight) when that repo holds one, else the workbench's — `contractDir(root)` here; a workbench with several repos reads its own folder until a plan names its repo, and the plan argument comes with Build Phase 2's code file
- [x] Every caller of `promisesDir`, and `confirm.ts`'s own join, goes through it; `promisesDir` is removed — three sites: the registry's reader, the writer, and confirm's empty-registry fallback

#### Build Phase 1 Verification

- [x] A4, A5, A7, A8 pass (`pnpm exec vitest run src/__tests__/contract-resolver`), and `vitest related` over the changed modules — 7 of 7 with A17's file; related, 15 files and 116 tests. A7 first failed on the test's own pattern (`promises check` says "1 promise", singular), fixed in the test
- [x] Shape — `contractDir` is one rule with one job, beside the reader it serves. Nothing to change

#### Build Phase 1 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, Promises and telemetry): the registry is found through `contractDir`; a repo's own contract wins over the workbench's

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/contract.md` (new): one contract per repo, the shadow contract, and how a repo adopts one; added to the sidebar

### Build Phase 2: A workbench plan starts, and knows its code

**Goal**: `plans start` works in a workbench and writes `code.json`; every step can read it.

- [ ] `plans start <type> <name> [--repo <repo>]` in a workbench (D1): the document at the root, committed there; the code worktree on `plan/<name>` through the worktree extension's setup script; `--repo` required when more than one repo is declared
- [ ] `code.json` and `readPlanCode(root, plan)` (D2): the problem a malformed file or a missing worktree gives, by name
- [ ] `resolveExecutionRoots` takes the plan: a workbench plan's code root is its code worktree, including in a multi-repo workbench
- [ ] Declaring a promise in a plan whose repo holds a contract writes it in the code worktree (A6)

#### Build Phase 2 Verification

- [ ] A1, A2, A6, A17 pass, and the existing `roots`, `run` and `verify` workbench tests stay green (`pnpm exec vitest run src/__tests__/plans-workbench src/__tests__/contract-resolver-single-definition src/lib/worktree/roots src/lib/run/workbench-split src/lib/verify/workbench-split`)

#### Build Phase 2 Context

- [ ] planning (`templates/planning/CLAUDE.md`): a workbench plan's documents are at the root and its code is named in `code.json`

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: `--repo`, the code file, and starting in a workbench

### Build Phase 3: Approve, review and land in a workbench

**Goal**: the rest of the plan commands read the code file.

- [ ] Approve in a workbench (D3): the brief check, `status: approved`, committed at the root; nothing merged
- [ ] Accept and `plans next` read the plan at the root and its code from `code.json`
- [ ] The review reads the repo (D6): changed files on the code branch against the repo's trunk branch, and uncommitted trunk work on those paths
- [ ] Land in a workbench (D7, D8): refuse unaccepted; bring the repo's trunk into the code branch; land checks in the code worktree; `--no-ff` into the repo's trunk; remove the worktree and branch; root writes committed at once

#### Build Phase 3 Verification

- [ ] A3, A11, A12, A15, A16 pass, and A18's normal-mode tests stay green (`pnpm exec vitest run src/__tests__/plans-`)

#### Build Phase 3 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`): the plan commands read a workbench plan's code from `readPlanCode`, never by name

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: approve, review and land in a workbench

### Build Phase 4: Sessions at the root

**Goal**: build and planning sessions in a workbench start at the root and reach the code.

- [ ] A13 and A14 written red (A13 against the two-root `decideBuildPermission`; A14 in the system tier over a workbench project)
- [ ] `startSession` takes extra directories and passes `--add-dir`; build and planning sessions in a workbench start at the root with the code worktree added (D5)
- [ ] `decideBuildPermission(ev, roots)` allows a write inside any of its roots

#### Build Phase 4 Verification

- [ ] A13 passes (`pnpm exec vitest run src/lib/session/permissions`); A14 passes three times from a clean environment in the system tier

#### Build Phase 4 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`): a workbench session starts at the root, so the workbench's hooks judge its checkoffs

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: sessions in a workbench, where they start and what they can write

### Build Phase 5: The admin in a workbench

**Goal**: a workbench plan gets its buttons, and New plan asks for the repo.

- [ ] A9 and A10 written red against the form and the action rule
- [ ] The plan reader exposes a workbench plan's code file; Continue planning, Approve, Build and Review use it where a normal-mode plan uses its worktree (D9)
- [ ] New plan lists the workbench's repos and asks when there is more than one; the route passes `--repo`

#### Build Phase 5 Verification

- [ ] A9, A10 pass, the admin's node and session component tests stay green (`cd apps/indusk-admin && pnpm exec vitest run src/components/session src/lib`)

#### Build Phase 5 Context

- [ ] admin (`apps/indusk-admin/CLAUDE.md`): a plan's actions read its worktree in normal mode and its code file in a workbench, through one rule

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: New plan's repo picker

### Build Phase 6: The live check, and the promises

**Goal**: one plan in a copy of a real workbench, the whole way in the admin; the promises confirmed.

- [ ] A19: copy a real workbench (concierge or numero) into a scratch home; New plan, plan, approve, build to review, accept, land, all in the admin; record each step and any stop
- [ ] `indusk promises confirm workbench-plan-authoring`: both new promises and the three changed ones enforced

#### Build Phase 6 Verification

- [ ] A19 is recorded with its result, and the full `pnpm test` and `pnpm test:system` pass from a clean environment

#### Build Phase 6 Context

- [ ] current.md: the live check's result and any stop it found

#### Build Phase 6 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: plans in workbenches; one contract per repo

## Files Affected

- `apps/indusk-mcp/src/lib/promises/` (registry, confirm, write), `lib/plans/`, `lib/build/review.ts`, `lib/session/` (start, permissions), `lib/worktree/roots.ts`
- `apps/indusk-mcp/src/bin/commands/plans.ts`
- `apps/indusk-admin/src/lib/planning-reader.ts`, `components/session/`, the plan page, `app/api/plans/route.ts`
- `apps/docs/src/guide/contract.md` (new), `reference/cli/plans.md`, `reference/admin-ui/sessions.md`, `changelog.md`

## Dependencies

- admin-plan-authoring and publish-hygiene (1.63.0)
