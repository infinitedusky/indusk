---
title: "Workbench plan authoring"
date: 2026-10-06
status: completed
falsification: skipped
falsification_reason: "Hunted the landing run's findings and the paths the live check added. The approve path's hardcoded promises folder was found by A17 at landing and fixed with its test; trust writes only its flag and leaves an unreadable config alone (A25); the new plan prompt is pinned by A24. One concrete hypothesis formed and was deferred to the shadow-contract adopt plan: with a repo-held contract, confirm writes into the code worktree and land refuses it dirty. No repo can hold a contract until that plan, so it is unreachable here (known-issues.md). Sandy asked to close without further scope (2026-10-06)."
cleanup: skipped
cleanup_reason: "listOversizedChangedFiles flagged five files, all over their cap before this plan, each touched lightly: changelog.md (entries), planning-reader.ts (the code field), cli.ts (--repo), commands/worktree.ts (the package-root helper), promises/registry.ts (contractDir, the one resolver). The workbench verbs already share workbenchPlan and commitAtRoot, and trust has one write path; no cross-file duplication found. Nothing warrants extraction."
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
| A1 | Starting a plan in a one-repo workbench writes its documents at the root, makes a code worktree in that repo on `plan/<name>`, and records both | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A2 | In a two-repo workbench, starting needs the repo named and records it; without one it is refused, naming the repos | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A3 | Every later step finds the code worktree from the plan's record; a record naming a worktree that is gone is reported, never guessed | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-knows-its-code | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A4 | In a workbench whose repo holds `.indusk/promises/`, promises are read from the repo and the workbench's folder is not read | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A5 | In a workbench whose repo holds no promises folder, promises are read and written in the workbench | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A6 | Declaring a promise in a plan whose repo holds a contract writes it in the plan's code worktree | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A7 | The registry check, `promises status` and `promises list` give the same promises for a project, with or without a contract in its repo | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A8 | Two workbenches on one repo that holds a contract read the same promises | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/contract-resolver.test.ts |
| A9 | New plan in a workbench project, in the admin, starts the plan; with more than one repo the form asks which | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-admin/src/components/session/NewPlanForm.test.tsx |
| A10 | A workbench plan's page offers Continue planning, Approve, Build and Review at the moments a normal-mode plan's does | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-admin/src/lib/plan-actions.test.ts |
| A11 | Approving a workbench plan runs the brief check and marks it approved with nothing merged; a refused brief is refused with the check's message | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A12 | A workbench plan's code stays on its branch in the repo until it lands; the repo's trunk is unchanged before then | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A13 | A workbench build writes code in its code worktree and checks items off at the root without asking; a write outside both is refused | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/build/build-session.test.ts |
| A14 | In a workbench, a real build session's checkoff is refused by the workbench's gates when an earlier phase skipped a gate without its reason | Build Phase 4 | Build Phase 4 | passing | contract | promise: gates-ran-at-every-checkoff | apps/indusk-mcp/src/__tests__/build-session-gates.test.ts |
| A15 | A workbench plan's review lists the files its code branch changed in its repo, and uncommitted work on that repo's trunk on those paths | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A16 | Landing an unaccepted workbench plan is refused; once accepted, its code merges into the repo's trunk and its code worktree and branch are removed | Test Phase 1 | Build Phase 3 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A17 | No module but the contract resolver joins a path to `.indusk/promises`, and none but `resolveExecutionRoots` decides a code root | Test Phase 1 | Build Phase 2 | passing | unit | promise: one-definition-per-shared-rule | apps/indusk-mcp/src/__tests__/contract-resolver-single-definition.test.ts |
| A18 | In a normal-mode project every plan command, the build and the admin behave as in 1.63.0 | Test Phase 1 | Test Phase 1 | passing | unit | normal mode stays as it shipped; the existing plans, build, session and admin tests are the proof, run unchanged | apps/indusk-mcp/src/__tests__/plans-start.test.ts, apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A19 | In a scratch copy of a real workbench, one plan goes from New plan to landed in the admin, without a terminal | Build Phase 6 | Build Phase 6 | skipped | live check | the whole flow in a workbench, recorded in Build Phase 6; each promise it walks is proven by its own rows. Skipped past build by Sandy's call (2026-10-06: "whatever I have been testing will work"): New plan, planning and build ran live in a numero copy; review, accept and land did not, and rest on A15 and A16 | manual: recorded in Build Phase 6 |
| A24 | A plan started from New plan opens a session told to read the project's state first, then say it is ready and ask for a description, and not to infer the plan from its name | Build Phase 6 | Build Phase 6 | passing | unit | the admin's opening (ADR D11); what the agent then does is observed in A19 | apps/indusk-mcp/src/lib/session/new-plan-prompt.test.ts |
| A25 | A project Claude Code does not trust shows "Trust in Claude Code" on its admin pages; one click trusts it, writing only that flag and keeping everything else in the config, and the button is gone | Build Phase 6 | Build Phase 6 | passing | unit | the admin's trust step (ADR D12); sessions then run on the project's allow-list, observed in A19 | apps/indusk-mcp/src/lib/session/trust.test.ts, apps/indusk-admin/src/components/session/TrustNotice.test.tsx |

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

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`, Promises and telemetry): the registry is found through `contractDir`; a repo's own contract wins over the workbench's — delivered by the enforcer tier, which comes first: guard `contract-resolver-single-definition.test.ts` carries lesson: a-repo-has-one-contract-and-one-resolver-finds-it. The package file is 2 bytes under its budget and stays unchanged

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/contract.md` (new): one contract per repo, the shadow contract, and how a repo adopts one; added to the sidebar — the docs site builds

### Build Phase 2: A workbench plan starts, and knows its code

**Goal**: `plans start` works in a workbench and writes `code.json`; every step can read it.

- [x] (the setup script gained `--branch`, its default still the slug; a repo without `.indusk/worktree-configs/<repo>.json` (writing-workbench has none, the other seven do) gets a plain `git worktree add` instead of a refusal; a code worktree inside the root not already ignored there gets an ignore line, committed with the plan, so sync never sweeps it in; the package-root walk moved to `lib/package-root.ts` so the CLI and the plan commands share it) `plans start <type> <name> [--repo <repo>]` in a workbench (D1): the document at the root, committed there; the code worktree on `plan/<name>` through the worktree extension's setup script; `--repo` required when more than one repo is declared
- [x] (in `lib/worktree/roots.ts`, beside `chooseCodeRepo`: the home for where code lives) `code.json` and `readPlanCode(root, plan)` (D2): the problem a malformed file or a missing worktree gives, by name
- [x] `resolveExecutionRoots` takes the plan: a workbench plan's code root is its code worktree, including in a multi-repo workbench
- [x] Declaring a promise in a plan whose repo holds a contract writes it in the code worktree (A6) — `contractDir(root, plan)`

#### Build Phase 2 Verification

- [x] (A1 in all four layouts and without a worktree config, A2 with two repos, A6, A17: passing; the five files 34 tests; related to the seven changed modules, 32 files and 204 tests; the worktree script's own tests, 4 files and 24 tests) A1, A2, A6, A17 pass, and the existing `roots`, `run` and `verify` workbench tests stay green
- [x] Shape — `startWorkbenchPlan` does one job (start a plan in a workbench) through named steps: `chooseCodeRepo`, `setupThroughExtension`, `ignoreAtRoot`. `readPlanCode` and `chooseCodeRepo` sit where code roots are decided. Nothing to change (`pnpm exec vitest run src/__tests__/plans-workbench src/__tests__/contract-resolver-single-definition src/lib/worktree/roots src/lib/run/workbench-split src/lib/verify/workbench-split`)

#### Build Phase 2 Context

- [x] planning (`templates/planning/CLAUDE.md`): a workbench plan's documents are at the root and its code is named in `code.json` — added to the own-branch entry; installed copy synced

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `--repo`, the code file, and starting in a workbench

### Build Phase 3: Approve, review and land in a workbench

**Goal**: the rest of the plan commands read the code file.

- [x] (one module, `lib/plans/workbench-plan.ts`: `workbenchPlan` finds the plan at the root, its code from `code.json` and its repo's trunk, or refuses by name; `commitAtRoot` commits the verb's own writes) Approve in a workbench (D3): the brief check, `status: approved`, committed at the root; nothing merged
- [x] Accept and `plans next` read the plan at the root and its code from `code.json` — accept writes and commits at the root; `plans next` already read the plan at the root and needs no code
- [x] (the code file is read before anything else, so a worktree that is gone is the review's refusal) The review reads the repo (D6): changed files on the code branch against the repo's trunk branch, and uncommitted trunk work on those paths
- [x] Land in a workbench (D7, D8): refuse unaccepted; bring the repo's trunk into the code branch; land checks in the code worktree; `--no-ff` into the repo's trunk; remove the worktree and branch; root writes committed at once

#### Build Phase 3 Verification

- [x] (the workbench file 20 of 20, every layout; the normal-mode plans and build tests 10 files, 73 tests; `vitest related` finds nothing, since these modules are reached through the CLI) A3, A11, A12, A15, A16 pass, and A18's normal-mode tests stay green (`pnpm exec vitest run src/__tests__/plans-`)
- [x] Shape — each verb branches once at its top to its workbench form, and the workbench forms share `workbenchPlan` and `commitAtRoot`. `landWorkbenchPlan` repeats the normal-mode landing's steps against the repo rather than the project. They differ in every root they touch, so a merged version would take five parameters to say what the two functions already say; left as two, and named in the cleanup ritual's scope

#### Build Phase 3 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`): the plan commands read a workbench plan's code from `readPlanCode`, never by name — delivered by the enforcer: A17's third check (the plan, build and session modules never look a repo up) carries lesson: a-repo-has-one-contract-and-one-resolver-finds-it, which names this rule; the package file stays unchanged at 2 bytes under its budget

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/plans.md`: approve, review and land in a workbench

### Build Phase 4: Sessions at the root

**Goal**: build and planning sessions in a workbench start at the root and reach the code.

- [x] A13 and A14 written red (A13 against the two-root `decideBuildPermission`; A14 in the system tier over a workbench project) — A13 through the build session's scripted fake in `build-session.test.ts`, red: the session starts with no added directory and refuses the code worktree. A14 as a second `describe` in `build-session-gates.test.ts`, sharing its session helpers rather than copying them (the rows' Test cells name those files). It passes already, from a clean environment, both cases, because a session at the root is judged by the root's hooks; it stays as the guard that adding the code directory does not move the gates. Building its project found that `indusk init` rewrites `config.json` and drops a workbench's declaration, so the test restores it
- [x] `startSession` takes extra directories and passes `--add-dir`; build and planning sessions in a workbench start at the root with the code worktree added (D5) — the package side: `startSession({ addDirs })` and `runStepSession({ addDirs })`. The admin passes them from the plan's code file in Build Phase 5, where it decides where a session runs
- [x] `decideBuildPermission(ev, roots)` allows a write inside any of its roots — still accepts one root, so every existing caller is unchanged

#### Build Phase 4 Verification

- [x] (A13 with the session and build tests, 8 files and 59 tests; the gates contract three of three from a clean environment, its two normal-mode cases (from admin-plan-authoring) and A14's two each time; the session protocol and lifecycle contracts, 2 files and 6 tests) A13 passes (`pnpm exec vitest run src/lib/session/permissions`); A14 passes three times from a clean environment in the system tier
- [x] Shape — `decideBuildPermission` takes one root or several and judges a path against each, with no other change; `addDirs` is passed through and nothing else touches it. Nothing to change

#### Build Phase 4 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`): a workbench session starts at the root, so the workbench's hooks judge its checkoffs — delivered by the enforcer: A14 in `build-session-gates.test.ts` refuses a workbench session whose checkoff escapes the root's gates. The package file stays unchanged at 2 bytes under its budget; growing it needs an entry moved down a tier first, which is this plan's retrospective's periodic pass

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: sessions in a workbench, where they start and what they can write

### Build Phase 5: The admin in a workbench

**Goal**: a workbench plan gets its buttons, and New plan asks for the repo.

- [x] A9 and A10 written red against the form and the action rule — A9 red on its assertion (no repo picker; its one-repo case already holds); A10 red because `plan-actions.ts`, the rule this phase extracts from the page, does not exist yet
- [x] The plan reader exposes a workbench plan's code file; Continue planning, Approve, Build and Review use it where a normal-mode plan uses its worktree (D9) — `planActions` (`lib/plan-actions.ts`) is the one rule the page reads; `planLocation` gives a workbench session its root and its code worktree, which the sessions route and the build host pass on; the package exports `./worktree/roots` for the reader
- [x] New plan lists the workbench's repos and asks when there is more than one; the route passes `--repo` — and starts the planning session at the root with the code worktree added

#### Build Phase 5 Verification

- [x] (27 files, 237 tests: the session components in the browser, the node tests, the admin-hosts and package-commands guards; both packages type-check) A9, A10 pass, the admin's node and session component tests stay green
- [x] Shape — the page's three inline conditions became one named rule with a test of its own; `planLocation` gained the code worktree and nothing else; the form's picker shows only when there is a choice. Nothing to change (`cd apps/indusk-admin && pnpm exec vitest run src/components/session src/lib`)

#### Build Phase 5 Context

- [x] admin (`apps/indusk-admin/CLAUDE.md`): a plan's actions read its worktree in normal mode and its code file in a workbench, through one rule

#### Build Phase 5 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: New plan's repo picker

### Build Phase 6: The live check, and the promises

**Goal**: one plan in a copy of a real workbench, the whole way in the admin; the promises confirmed.

- [x] Discovered preparing the live check: numero's repo is checked out on `staging`, and its worktree config declares `base_branch: staging` (`trunk_branch: master`). Approve and land refused it as "not a trunk branch", because `currentTrunkBranch` reads the repo's own config, which a client repo doesn't have, and falls back to main and master. A workbench plan now lands on its repo's declared `base_branch`, else its `trunk_branch` (`codeRepoBase` in `roots.ts`), where the worktree extension already cut it from; main and master only without either. Proven by a new case under A16 in `plans-workbench.test.ts` (the code branch cut from staging lands on staging, and main is unchanged), red on that refusal first; the plan tests 6 files, 53 tests
- [x] Discovered in the live check (Sandy, 2026-10-06): asked to rename `new-game-type`, the planner renamed the folder, branch and worktree by hand with git; the running session stayed filed under the old name, whose page no longer existed, and waited on a permission nobody could see. Recovered by allowing its `code.json` edit and stopping it. A rename command was designed and written in (a promise, rows A20–A23, ADR D10), then moved to its own plan by Sandy's call so this one ships: the promise withdrawn, the rows and the design moved to `known-issues.md`
- [x] Discovered in the live check (Sandy, 2026-10-06): given only `/planner <type> <name>`, the agent planned from the title. A new plan's agent should prepare on its own, say when it is ready, and ask for a description (brief decision; ADR D11, the decision that one package function writes the first prompt). Moves the known issue "a new agent starts without the project's state" into this plan. A24 written red first, against a `newPlanPrompt` that returns today's prompt
- [x] `lib/session/new-plan-prompt.ts`: `newPlanPrompt(type, plan)`, exported through `/session`; the New plan route sends it (A24: 4 tests)
- [x] Discovered in the live check (Sandy, 2026-10-06: "just fix it"): Claude Code had never trusted the workbench, so every session ignored its allow-list and asked about everything; the admin only said so. Known since admin-plan-authoring, which trusted a worktree like its project but never an untrusted project. The person's click is the consent (ADR D12, the decision that the admin offers trust and writes it on a click). A25 written red first
- [x] `trustProject(path)` in `lib/session/trust.ts` (one write path with `trustLikeProject`); `POST /api/trust` behind `adminOnly`, and in `admin-hosts.test.ts`; `TrustNotice` on the project page and the plan page when `isTrusted` is false, read through `lib/trust-reader.ts` (A25: the package's 3 cases and the notice's 2; the admin suite 61 files, 390 tests)
- [x] A19: copy a real workbench (concierge or numero) into a scratch home; New plan, plan, approve, build to review, accept, land, all in the admin; record each step and any stop — numero copied to `numero-scratch` (no remote) with its own InDusk home and an admin built from this branch. Ran: New plan (`increase-chat-field-height`, bugfix, code worktree cut from `staging`), planning in the panel, and the build of a one-line change. Stops and fixes: the staging base branch (fixed above); a hand rename stranding the session (moved out); planning from the title (fixed, A24); an untrusted workbench asking about everything (fixed, A25); the copy's emptied `post_create` (my edit, restored); numero on InDusk 1.56.0, whose planner writes no promises, and a planning agent that built and set the impl in-progress itself, skipping Approve (both to `known-issues.md`). Review, accept and land were not run live, by Sandy's call; they rest on A15 and A16
- [x] `indusk promises confirm workbench-plan-authoring`: both new promises and the three changed ones enforced — the three changes recorded with `promises change` first (their History keeps the normal-mode sentences), and the brief's Changes entries now read as the registry does; "5 promises confirmed; the registry check passes"

#### Build Phase 6 Verification

- [x] A19 is recorded with its result, and the full `pnpm test` and `pnpm test:system` pass from a clean environment — the first clean run failed four everyday tests, three of them real: a workbench approve joined its own path to `.indusk/promises` (A17 caught it; it now commits the contract at the root only while it is the workbench's shadow), day-promises' A12 still asserted the registry was workbench-only (D4 reversed that; the test now asserts the repo's own folder is read), and publish-hygiene's archived impl named other plans' rows by bare ID (the corpus check; reworded); the fourth, the eight-CLI workbench case, timed out at 5 s under load and has 20 s. The second run: `pnpm test` 2,001 and 392 passed, the everyday suite upheld at 71 s. `pnpm test:system`: 38 of 40 files passed; the gates contract and the session-protocol contract failed only on Anthropic's API rate limit (HTTP 429, the limit seen in the panel), and pass on rerun from a clean environment, 7 of 7
- [x] Shape — Build Phase 6 wrote `newPlanPrompt` (one function, one job), `trustProject` (sharing one `writeTrust` with `trustLikeProject` rather than a second copy of the read-modify-rename), `TrustNotice` with its route and one reader module for the pages, and approve's contract path through `contractDir`. Nothing to change

#### Build Phase 6 Context

- [x] current.md: the live check's result and any stop it found — this session's section, through `update_current_section` (the trunk's copy, left uncommitted beside the other sessions' changes there)

#### Build Phase 6 Document

- [x] `apps/docs/src/changelog.md` Unreleased: plans in workbenches; one contract per repo; a new plan's agent prepares, then asks; Trust in Claude Code
- [x] `apps/docs/src/reference/admin-ui/sessions.md`: a new plan's opening, and Trust in Claude Code (with `POST /api/trust` in the routes table)

## Files Affected

- `apps/indusk-mcp/src/lib/promises/` (registry, confirm, write), `lib/plans/`, `lib/build/review.ts`, `lib/session/` (start, permissions), `lib/worktree/roots.ts`
- `apps/indusk-mcp/src/bin/commands/plans.ts`
- `apps/indusk-admin/src/lib/planning-reader.ts`, `components/session/`, the plan page, `app/api/plans/route.ts`
- `apps/docs/src/guide/contract.md` (new), `reference/cli/plans.md`, `reference/admin-ui/sessions.md`, `changelog.md`

## Dependencies

- admin-plan-authoring and publish-hygiene (1.63.0)
