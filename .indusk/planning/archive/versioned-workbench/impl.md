---
title: "Versioned Workbench"
date: 2026-08-17
status: completed
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Versioned Workbench

## Goal

Make a workbench reconstructible from its remote and shared between machines: the workbench root becomes a git repo with an auto-sync loop, it declares N repos in `worktree.repos[]`, and `indusk workbench restore` materializes it — cloning each declared repo as a sibling and recreating each trunk symlink. Along the way, preserve the detector refusal that today holds only because a workbench root happens not to be a git repo.

## Scope

### In Scope

- `worktree.repos[]` as the single source of truth for a workbench's repo set; `wrapped_repo` reduces to a one-element list
- One `readWorkbenchRepos` in TypeScript, one `_read_workbench_repos` in bash, each pinned by a single-definition test
- `indusk workbench restore` — clone, symlink, optional worktree recreation, out-of-band reporting, loud partial failure
- `indusk worktree create <repo> <slug>` — the repo argument returns, optional at N=1
- Workbench root as a git repo with a shared remote; the pull-first / auto-commit / push-immediately / blind-resolve sync loop
- Root-directory-whitelist `.gitignore` + `merge=union` `.gitattributes` scaffolding
- `indusk update` detects unmaterialized repos and nudges
- D8's floor: detectors take a plan root and a code root, and refuse where they cannot tell them apart

### Out of Scope

- The full two-root split across verify, Shape, and cleanup — this plan preserves the refusal; the split is a named follow-on
- Normal-mode projects like dusk itself (`.indusk/` already ships in the product repo)
- Remote or shared FalkorDB / Graphiti (removed by indusk-makeover)
- Cross-machine locking, real-time guarantees, conflict UI
- Secrets and SSH host-alias distribution — permanently out of scope, reported rather than solved

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | 16 authored assertions, red, plus the two-repo workbench fixture they share | existing `helpers/worktree-fixture.ts`, the POC's `bootstrap.sh` as behavioral reference |
| Build Phase 1 | `worktree.repos[]` schema, `readWorkbenchRepos()`, singular→plural reduction, `worktree list` over N trunks | `.indusk/config.json`, `worktree.ts` |
| Build Phase 2 | `_read_workbench_repos` bash helper; 4 scripts converted; `worktree create <repo> <slug>` | Phase 1's config shape |
| Build Phase 3 | `indusk workbench restore` — clone, symlink, `--worktrees`, partial-failure contract | Phase 1's `readWorkbenchRepos`, Phase 2's `worktree create` |
| Build Phase 4 | out-of-band report, whitelist `.gitignore` + `merge=union` `.gitattributes`, `update` nudge | Phase 3's restore |
| Build Phase 5 | plan-root/code-root resolution + refusal in verify's entry path | existing `assertGitRepo`, `phantom.ts` |
| Build Phase 6 | workbench root git-init + the sync loop | Phase 4's ignore shape, Phase 5's preserved refusal |
| Build Phase 7 | documented onboarding path, end-to-end | every prior phase |
| Build Phase 8 | `path` + `worktrees` declarations; creation honours them | Phase 1's `readWorkbenchRepos` |
| Build Phase 9 | listing grouped by repo, discovered from disk | Phase 8's declarations |
| Build Phase 10 | ignore rules generated per declared location; flat workbenches refused | Phase 4's scaffolding, Phase 9's grouping |
| Build Phase 11 | opt-in migration for an existing flat workbench | Phases 8-10 |
| Build Phase 12 | falsification fixes — claims the code did not enforce | every prior phase |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Scope | Test |
|----|---------|-------------|-----------|-------|-------|------|
| A13 | A two-repo workbench presents both as trunks, each with its own worktrees listed under it | Test Phase 1 | Build Phase 1 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-multi-repo.test.ts` |
| A14 | `worktree create` makes the worktree in the repo named; ambiguity fails listing the declared repos rather than picking one | Test Phase 1 | Build Phase 2 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-multi-repo.test.ts` |
| A10 | One documented command clones every declared repo beside the workbench and links it in, with nothing cloned or linked by hand | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A11 | Re-running that command reports every repo already present and changes nothing on disk | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A12 | One unreachable repo names itself, leaves the others materialized, and completes on re-run after the fix | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A15 | The out-of-band list is shown in full, and no file on it is present in the shared remote | Test Phase 1 | Build Phase 4 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A8 | Trunk symlinks, worktree dirs, the doppler token, and per-app env pulls never appear in the shared remote | Test Phase 1 | Build Phase 4 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-ignore.test.ts` |
| A17 | Verification never reports checked-off work as phantom on a diff that could not have contained the code — it checks the code's repo or refuses naming what it could not identify | Test Phase 1 | Build Phase 5 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-verify-refusal.test.ts` |
| A3 | Any edit to a workbench file is committed automatically with a timestamp-style message, with no prompt | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A2 | A change in one workbench appears in another after its next sync point, with no manual git commands | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A4 | Two workbenches editing concurrently both reach the remote; neither sees a conflict prompt or a blocked command | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-concurrent.test.ts` |
| A5 | Concurrent appends to `current.md` and `highlights.jsonl` both survive the merge | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-concurrent.test.ts` |
| A6 | With the remote unreachable, edits still commit and work is never blocked; changes arrive after it returns | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-offline.test.ts` |
| A16 | A pulled phase marked complete whose code has not arrived is distinguishable from one that has | Test Phase 1 | Build Phase 6 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A1 | A second developer cloning the workbench repo sees the full planning history, lessons, and `current.md` sections | Test Phase 1 | Build Phase 7 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-onboarding.test.ts` |
| A9 | A second developer following the onboarding steps ends up with a working workbench | Test Phase 1 | Build Phase 7 | passing | e2e | `manual: docs/guide/workbench-sharing.md — second checkout location` |
| A18 | A worktree created in a workbench that declares a worktrees location lands there, not at the workbench root | Build Phase 8 | Build Phase 8 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A19 | Renaming a declared directory and updating config keeps everything working — nothing infers layout from a name | Build Phase 8 | Build Phase 8 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A20 | `worktree list` groups worktrees under their repo, and a worktree outside every declared location is shown as unattributed rather than dropped | Build Phase 9 | Build Phase 9 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A21 | A workbench with declared locations needs no deny-by-default rule, and its generated ignore lines can be appended to a hand-written `.gitignore` without changing that file's meaning | Build Phase 10 | Build Phase 10 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-ignore.test.ts` |
| A22 | A flat workbench whose own `.gitignore` cannot carry the contract is refused by name, rather than syncing worktree contents into the shared remote | Build Phase 10 | Build Phase 10 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-ignore.test.ts` |
| A23 | An existing flat workbench opts in with one command: its worktrees move under the declared location and every one of them still works | Build Phase 11 | Build Phase 11 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A24 | A sync whose commit fails stops there, rather than running a blind merge over work that is still uncommitted | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A25 | The sync trigger works on a workbench that is not yet a git repo, instead of silently never firing | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-hook.test.ts` |
| A26 | A repo whose branch has never been pushed is reported as unpublished, not as "in sync with its remote" | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A27 | A declared `path` or `worktrees` naming a reserved directory (`.git`, `.indusk`, `.claude`) is refused, not joined | Phase 0 | Build Phase 12 | passing | unit | `apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts` |
| A28 | `migrate-layout` refuses a move whose destination lies inside the directory being moved | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A29 | `workbench status` finds a repo at its DECLARED path, not at its name | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-layout.test.ts` |
| A30 | `restore` never reports a trunk as linked when it created no link | Phase 0 | Build Phase 12 | passing | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A31 | The reserved root-directory set has exactly one definition, and both listings return the same names for the same workbench | Phase 13 | Build Phase 13 | passing | unit | `apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts` |
| A32 | Worktree-to-repo attribution has exactly one definition, and `worktree list` still attributes correctly after the move | Phase 13 | Build Phase 13 | passing | unit + integration | `apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts`, `apps/indusk-mcp/src/__tests__/workbench-multi-repo.test.ts` |
| A33 | `init --workbench` repairs a dangling trunk symlink and refuses to replace a real directory, the same as `restore` | Phase 13 | Build Phase 13 | passing | integration | `apps/indusk-mcp/src/__tests__/init-workbench.test.ts` |

### Deferred Verification

- **Onboarding on a machine with no prior SSH host-alias configuration**
  - reason: SSH host aliases (e.g. `github-<org>`) are machine configuration outside every repo; a test that provisioned them would be asserting against its own fixture rather than against the product.
  - would require: a second physical machine with a clean `~/.ssh/config`, or a container image standing in for one — neither available to this plan's test lane.
  - mitigation: A15 forces the alias requirement into the printed out-of-band list, so the gap announces itself at restore time rather than surfacing as a failed clone with no explanation. A9's manual smoke walks it once on a real second checkout.

## Checklist

### Test Phase 1: Author all sixteen assertions, RED

**Goal**: author every assertion in the test plan against today's code, and confirm each fails for the reason it is supposed to fail for. Every row is authorable now — this plan's assertions are CLI- and filesystem-observable, so none of them need a symbol that does not exist yet.

- [x] Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter. **dusk is not a workbench** (`worktree` is absent from `.indusk/config.json`), so `indusk worktree create` refuses here by design; the trunk-repo form is `git worktree add ~/code/sandbox/dusk-worktrees/versioned-workbench -b plan/versioned-workbench`
- [x] Build the shared two-repo workbench fixture: a workbench root, two bare `file://` repos standing in for the declared repos, and a helper that clones the workbench into a second location
  ```ts
  // extends apps/indusk-mcp/src/__tests__/helpers/worktree-fixture.ts
  export function twoRepoWorkbench(): { root: string; remotes: [string, string]; cloneTo(dir: string): string }
  ```
- [x] Author A13, A14 in `workbench-multi-repo.test.ts` against a `worktree.repos[]` config today's code does not read, RED
- [x] Author A10, A11, A12, A15 in `workbench-restore.test.ts` invoking `indusk workbench restore`, RED on unknown command
- [x] Author A8 in `workbench-sync-ignore.test.ts` — git-init the workbench root in the fixture and assert the ignore contract, RED
- [x] Author A17 in `workbench-verify-refusal.test.ts` — **git-init the fixture's workbench root**, then run verification and assert it does not report phantom for honestly-changed code
- [x] Author A3, A2, A16 in `workbench-sync.test.ts`, RED
- [x] Author A4, A5 in `workbench-sync-concurrent.test.ts`, RED
- [x] Author A6 in `workbench-sync-offline.test.ts`, RED
- [x] Author A1 in `workbench-onboarding.test.ts`, RED
- [x] Write A9's manual smoke procedure into the plan folder as the script the Build Phase 7 smoke follows
- [x] Give every real-git test an explicit 30s timeout — vitest's 5s default does not survive clone-and-push fixtures

- [x] **Shape** — `helpers/worktree-fixture.ts`: extract the inline gate-script installation out of `buildTwoRepoWorkbench` into a named `installHostGateScripts(workbenchDir)`. It is a distinct job (locate this repo's hooks, copy three named scripts plus the `_`-prefixed modules, fail loudly when they moved) wearing no name, inside a builder whose other branches are all about repo topology. Rule: *typescript / testing — a block that has one reason to change and a nameable purpose should be a named function with a seam a test can reach.*
- [x] **Shape — considered, left as is**: `runCli` is duplicated verbatim across all eight test files. That is cross-file duplication and the rule of three, which the rule set explicitly scopes to `/cleanup` at close, not to Shape's intra-unit question. Extracting it now would also couple eight files to a helper whose right shape is not yet settled — three of them will grow flags as the CLI surface lands. Recorded so "no finding" and "considered and deferred" stay distinguishable.

#### Regression Guards

- **A8** — the ignore contract is partly true today by accident: a workbench root that is not a git repo trivially has no trunk symlink in any remote. The row is authored against a **git-initialized** fixture root precisely so it is red for the real reason (no whitelist `.gitignore` exists yet) rather than green for the accidental one. Recorded here because a reviewer checking "was this red?" against a non-git fixture would reach the wrong conclusion.
- **A17** — the sharpest trap in this plan. Run against today's shape the assertion **passes**, because `assertGitRepo` refuses on a non-git workbench root — the right answer for the wrong reason. Authored against a git-initialized root it goes red, which is the state Build Phase 5 fixes. Anyone re-authoring this row must git-init the fixture first or they will pin the accident instead of the guarantee.

#### Test Phase 1 Verification

- [x] All sixteen rows (A1–A6, A8–A17) exist as authored tests and fail (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] **(checked prematurely on 2026-08-17, corrected same day)** Each red row fails on its own assertion or on a genuinely-absent CLI command — none fails on a missing import, which would mean the test was never authored. **The first pass read the aggregate `22 failed` and checked this off; the eval agent then found `workbench-verify-refusal.test.ts` failing on `ReferenceError: mkdirSync is not defined` — the exact mode this text forbids, in the row the commit message called the sharpest trap. Re-run 2026-08-17 classifies every row individually: 22 failed, 0 passing, 0 incidental (no ReferenceError / missing module). An aggregate count cannot satisfy this item — see [[verify-the-adversarial-gate-you-wrote-not-just-its-presence]]**
- [x] A8 and A17 are confirmed red against a **git-initialized** fixture root, not green against a non-git one — check this by inverting the fixture and observing both flip. **Inversion run 2026-08-17**: non-git → `git ls-tree` exits 128 with empty output (A8's absence assertion passes vacuously) and `verify` refuses at "is not a git repository" before any detector runs (A17 concludes nothing); git-init → both reach the real check. The traps were real
- [x] Trajectory State column updated to `written` for every row (all 16; done as a bulk edit before these checkoffs rather than in the same edit — the table does not lag, which is what the rule protects)

### Build Phase 1: One plural source of truth for the repo set

- [x] Add `worktree.repos[]` to the config schema, with `remote` optional — typed on `InduskConfig` in `lib/config.ts`, which had no `worktree` field at all while `worktree.ts`, `stray-state-audit.ts` and `_hook-paths.js` each hand-rolled a private copy
  ```ts
  interface WorkbenchRepo { name: string; remote?: string }
  ```
- [x] Write `readWorkbenchRepos(root): WorkbenchRepo[]` in `src/lib/worktree/repos.ts` — the single resolution function every TypeScript consumer goes through
- [x] Implement the reduction: `wrapped_repo: "x"` reads as `repos: [{ name: "x" }]`, so no existing workbench needs a config edit
- [x] Guard `name` as a path-join boundary value — via `isCleanSegment`, promoted out of `plan-parser.ts` into `lib/path-segment.ts` rather than copied, since workbench repo names are the second caller and a primitive left in a domain folder gets copied by the next domain — segment-checked, first-occurrence-deduped, before any join
- [x] Convert `worktree.ts`, `init.ts`, `stray-state-audit.ts`, and `_hook-paths.js` to `readWorkbenchRepos` — **`init.ts`'s WRITER deliberately stays singular until Build Phase 2.** Switching it here produced a workbench `indusk worktree create` refused outright (`setup-worktree.sh` still reads `wrapped_repo`); the readers are plural-ready, only the writer waits for the bash lane. Found by running the suite, not by reading the diff — which is the whole argument for the bash lane having its own phase
- [x] Under N > 1, `_hook-paths.js` refuses rather than guessing, and `declaredReposAt` lets the caller name every candidate (D6). Verified against a real config: legacy `wrapped_repo` resolves, one-element `repos[]` resolves, two repos returns null. Deriving from the commit's cwd is deferred — refusing loudly is the floor, and a wrong attribution is indistinguishable from a right one in the eval record
- [x] Add `docs` to `worktreeList`'s reserved set (D7) — currently absent, so a workbench-root `docs/` renders as a worktree
- [x] Pin single-definition: a test asserting exactly one `readWorkbenchRepos` definition exists under `src/` — plus "no TS consumer reads `worktree.wrapped_repo` raw" and the hook-lane port marker. The guard's own scope had to be narrowed twice: it matched its own pattern literal and a prose docstring, the same blind-spot class as `scm-rip-out-grep`

- [x] **Shape** — `bin/commands/worktree.ts`: delete the now-dead `readWorkbenchConfig` + `interface WorkbenchConfig`. The conversion routed every caller through `readWorkbenchRepos` but left the private config-shape copy in place, and a dead local reader is not neutral here — it is the exact thing this plan is consolidating, left where the next caller will reach for it. Rule: *typescript — dead code that duplicates a consolidated concept is a live invitation, not neutral weight.*
- [x] **Shape — considered, left as is**: `worktreeList` has no seam but stdout, so A13 parses printed output. Extracting a listing model would give a testable seam, but the CLI's job IS the printed contract and A13 is a behavioral row — asserting what the user sees is the right level here, and a model-plus-renderer split would let the render drift from the model with tests still green. Recorded so "no finding" stays distinguishable from "considered and deferred".

#### Build Phase 1 Verification
- [x] A13 passes — a two-repo workbench lists both trunks with worktrees attributed correctly (`pnpm exec vitest run src/__tests__/workbench-multi-repo.test.ts`). Attribution asks git via `--git-common-dir` rather than inferring from the slug; a name-prefix heuristic would attribute `alpha-feature` to `alpha` by luck and `experiment` to nothing
- [x] Every other row still red for its own reason; none flipped green as a side effect — per-row classification (not an aggregate count, per [[verify-the-adversarial-gate-you-wrote-not-just-its-presence]]): 20 failed, 7 passed, **0 incidental**. The 7 green are A13's two plus the five single-definition assertions; no other trajectory row moved
- [x] Single-definition test fails when a second `readWorkbenchRepos` is pasted in — assert the refusal, not just the acceptance. **Run 2026-08-17**: a same-file duplicate is a TS error and cannot exist (the suite reported `no tests` — a refusal, but not this guard's); planted in a SECOND FILE it compiles, is exactly the silent cross-file divergence the guard exists for, and the guard failed naming the offending path. Removed, 5/5 green again
- [x] An existing single-repo workbench (`wrapped_repo`, no `repos[]`) still passes the full worktree suite unchanged — `init-workbench` + `setup-command` + `stray-state-detection` + `hook-paths` 23/23, and the fast suite 980 passed / 0 failed

#### Build Phase 1 Context
- [x] Add to Conventions: `worktree.repos[]` is the single source for a workbench's repo set; `wrapped_repo` reduces to a one-element list; all readers go through `readWorkbenchRepos` — pointer to `/decisions/versioned-workbench`. CLAUDE.md 44,093 / 61,440 bytes (72%)

#### Build Phase 1 Document
- [x] Update the worktree extension skill's topology section for N trunks, and note `docs/` as reserved — including that attribution asks git for `--git-common-dir` rather than inferring from the slug

### Build Phase 2: The bash lane

**Goal**: the four shell consumers, where 35 of the 80 `wrapped_repo` occurrences live and nothing type-checks a missed site.

- [x] Write `_read_workbench_repos` as one shared sourced helper under `extensions/worktree/scripts/` — added to the existing `scripts/lib/workbench-helpers.sh` rather than a new file, alongside `_resolve_workbench_repo`. The reduction is jq, and deliberately avoids `unique` (it sorts, and declared order is meaningful — the first repo is the implied one at N=1)
- [x] Convert `setup-worktree.sh` (12 occurrences) — gains `[--repo <name>]`, a flag rather than a positional so there is no arity ambiguity with `<slug> [base-branch]`
- [x] Convert `on_enable.sh` (10 occurrences) — now scaffolds a starter worktree-config **per declared repo**; scaffolding only the first would leave the others silently unconfigured until someone tried to make a worktree in them
- [x] Convert `refresh-worktree.sh` (7 occurrences)
- [x] Convert `preflight.sh` (6 occurrences)
- [x] Restore the `<repo>` argument: `indusk worktree create <repo> <slug>`, optional at N=1, refusing with the declared list when ambiguous. **Disambiguated against the declared set, not by arity** — a leading token is a repo only if the workbench declares it, so every existing single-repo `create my-feature` keeps its old meaning instead of being reinterpreted as a repo name
- [x] Pin single-definition for the bash helper the same way as the TypeScript one — one `_read_workbench_repos` definition, zero `_read_workbench_field wrapped_repo` callers left, and the DELIBERATE PORT marker present so the pairing is checkable by reading two filenames

- [x] **Shape** — `setup-worktree.sh` / `refresh-worktree.sh` / `preflight.sh`: rename the local `WRAPPED_REPO` to `REPO`. (Applied with `perl`, not `sed`: BSD `sed` on macOS does not support `\b` and **silently changes nothing** — the first attempt reported success while renaming zero occurrences. Same class as the half-applied python patches earlier in this plan; the count check is what caught it.) It no longer holds "the single wrapped repo" — it holds the one repo this invocation resolved to, out of N. Stale vocabulary is expensive precisely here: the shell lane has no type checker, so a reader's mental model is the only model. Confined to these three files (`WRAPPED_REPO_NAME` is a separate template placeholder living only in `on_enable.sh` + the template, and must not be touched). Rule: *typescript / testing — a name should say what the value is for, not what it used to be.*

#### Build Phase 2 Verification
- [x] A14 passes — named repo targets that repo; ambiguity refuses listing the declared repos (`pnpm exec vitest run src/__tests__/workbench-multi-repo.test.ts`, 5/5)
- [x] `grep -rn 'wrapped_repo\|WRAPPED_REPO' apps/indusk-mcp/extensions apps/indusk-mcp/src apps/indusk-mcp/hooks` returns only the reduction site and prose — a scripted census, not a reading, because a manual survey of copies undercounts. **Run 2026-08-17**: zero `_read_workbench_field wrapped_repo` callers remain; the only field reads left are `_hook-paths.js`'s documented port and `repos.ts`/`config.ts` themselves. The census also caught three stale claims in `skill.md` (including "the `<repo>` argument is dropped", now false), fixed in this phase's Document gate
- [x] Each converted script runs standalone under `set -u` with an N=1 config, proving the reduction holds in bash and not only in TypeScript — all four resolve `solo` from a legacy `wrapped_repo` config; `REPO_ARG` is read as `${REPO_ARG:-}` in the two scripts that never set it, so `set -u` cannot trip on it

#### Build Phase 2 Context
- [x] Add to Known Gotchas: the bash lane reads the repo set through one sourced helper; a hand-rolled `jq`/`node -e` read in a new script is a silent divergence with no type checker to catch it — folded into the existing versioned-workbench Conventions entry (rule + pointer, per the budget discipline) along with the BSD-`sed`-has-no-`\b` trap. CLAUDE.md 44,500 / 61,440 bytes (72%)

#### Build Phase 2 Document
- [x] Update the worktree extension skill: `worktree create <repo> <slug>`, when the repo argument is required, and what the ambiguity refusal says — plus **five stale claims the census caught**, including the line asserting "the `<repo>` argument from the multi-repo design is dropped", which this phase made false. The only `wrapped_repo` mentions left are the two that deliberately describe the legacy shape reducing

### Build Phase 3: `indusk workbench restore`

- [x] Add the `indusk workbench` command group with `restore` as its first verb
- [x] Clone each declared repo missing at `<sibling_parent>/<name>`; skip and name any repo with no `remote` — "no remote" is only a failure when the repo is also **absent from disk**. A locally-created repo that is already there needs no remote, and failing it would make restore permanently red on a legitimate workbench
- [x] Create or repair each trunk symlink using a relative target, so the workbench stays portable — repairs a link pointing elsewhere, leaves a correct one untouched, and refuses to remove a real directory sitting at that path. Dangling links need `lstat`, not `existsSync`, which follows the link and reports absence
- [x] `--worktrees` accepted, and honestly reports that **no worktree manifest is read yet** — `worktree.worktrees[]` is not in the schema, so recreating from it would be a flag that silently does nothing. Deferred to the phase that adds the declaration; a flag claiming work it cannot do is worse than an absent flag
- [x] Idempotence: re-running reports each repo already present and writes nothing — A11 asserts it by diffing a full tree snapshot, not by trusting the exit code
- [x] Partial-failure contract — a failed clone names the repo and its remote, the other repos still materialize, and the command exits non-zero
- [x] Never abort the loop on the first failure; collect and report every failure at the end — otherwise restoring an N-repo workbench becomes a lottery decided by declaration order

- [x] **Found by the real-workbench run** — `sibling_parent` is an absolute, machine-specific path committed to the SHARED context repo. the POC's says `another machine's home directory`; on another machine that directory does not exist and restore reports every repo missing. A fixture can never catch this, because a fixture sets `sibling_parent` to its own tmpdir. Resolve it as: declared-and-exists → use it; declared-and-missing → say so and fall back to the workbench's parent; absent → the workbench's parent. "Beside the workbench" is the topology `indusk setup` actually builds, so the parent is the right default rather than a guess

#### Build Phase 3 Verification
- [x] A10, A11, A12 pass (`pnpm exec vitest run src/__tests__/workbench-restore.test.ts`) — A1 flipped green early too, since clone+restore is exactly what it observes
- [x] A12 specifically asserts the **failure** path: named repo, preserved siblings, non-zero exit — a restore that clones half and exits 0 must be a test failure, not a warning. Confirmed out-of-band too: the real the POC clone exits **1** (an earlier reading of `0` was my harness reporting `head`'s status through a pipe, not node's)
- [x] Run `indusk workbench restore` verbatim from the docs against a real clone of the POC workbench — a library is not shipped until its documented invocation has been run as written. **This single run found what no fixture could**: (1) the committed `sibling_parent` names another machine's home directory, fixed above; (2) `config.json` declares ONE repo while `workbench.json` declares TWO — the drift D2 rejected the separate manifest to prevent, already live in production; (3) a legacy `wrapped_repo` workbench carries no `remote`, so restore correctly refuses rather than pretending. The temp clone was removed afterwards; the live workbench was never written to
- [x] Re-run against an already-materialized workbench and diff the tree: zero changes (A11's full-tree snapshot)

#### Build Phase 3 Context
- [x] Add to Conventions: `indusk workbench restore` materializes a cloned workbench; partial failure is loud and non-zero; `init` and `update` never clone — plus the `sibling_parent` fallback, folded into the existing versioned-workbench entry as rule + pointer

#### Build Phase 3 Document
- [x] Write `apps/docs/src/reference/cli/workbench.md` — flags, idempotence, the partial-failure contract; add it to the VitePress sidebar (`apps/docs/src/.vitepress/config.ts`, not the stale root scaffold). Includes the `sibling_parent`-across-machines behavior and why `init`/`update` are the wrong homes

### Build Phase 4: What never travels

- [x] Print the out-of-band set after restore: `env/*.env`, `.indusk/extensions/doppler/.env`, repo-local config, required SSH host aliases — landed early, in Phase 3, because restore had nothing honest to say at its end without it
- [x] Scaffold the root-directory-**whitelist** `.gitignore` — deny by default, directories added explicitly, so an unpredicted worktree directory is untracked by construction. **The deny rule is `/*`, not `/*/`**: git stores a trunk symlink as a blob, so a directory-only rule leaves every trunk tracked — caught by A8, not by reading. Ported from the POC's months-tested file rather than authored fresh, including its comment on why the trailing `.env*` glob is load-bearing. Scaffolds only when absent; a hand-tuned ignore file is a decision, not drift
- [x] Scaffold `.gitattributes` with `merge=union` on `current.md` and `highlights.jsonl` (plus `highlights-processed.jsonl`) — deliberately NOT on plan documents, where a blind union interleaves prose
- [x] `indusk update` detects declared-but-unmaterialized repos and nudges to `indusk workbench restore` without cloning anything itself — verified on a workbench declaring a repo that does not exist: it names the repo, points at restore, and performs no network call. **Plus `untrackNowIgnored`**, which the tests forced: ignoring a path does not untrack it, so a workbench git-initialized before these rules kept publishing its symlinks and secrets while `git status` looked clean. Index-only (`--cached`); files stay on disk

#### Build Phase 4 Verification
- [x] A15, A8 pass (`pnpm exec vitest run src/__tests__/workbench-restore.test.ts src/__tests__/workbench-sync-ignore.test.ts`, 8/8). **Both now drive the PRODUCT to write the ignore rules** — a fixture-written `.gitignore` would have made each test verify its own setup, the trap A15 and A17 each fell into earlier here
- [x] Create a worktree with an unpredicted name, then assert the remote never receives it — the whitelist's whole purpose is the directory nobody listed (`feature-nobody-predicted-2026`, invented at runtime, stays untracked)
- [x] Drop a stray `.env` at the workbench root and confirm `git status` leaves it untracked — and that the context which SHOULD travel still does, so this cannot pass by ignoring everything
- [x] `indusk update` on a workbench with a missing repo prints the nudge and performs no network operation — run against a workbench declaring an unreachable `ghost` repo. The run also caught `missingIgnoreRules` still checking for `/*/` after the emitted rule became `/*`: the generator and its checker had drifted, so a correct workbench reported a gap

#### Build Phase 4 Context
- [x] Add to Known Gotchas: the workbench `.gitignore` is a whitelist because worktree directories appear at the root with unpredicted names — a blacklist silently starts tracking the next one. Folded into the versioned-workbench Conventions entry with the `/*` vs `/*/` symlink reason and the ignoring-is-not-untracking rule

#### Build Phase 4 Document
- [x] Document the whitelist shape and the out-of-band set in the sharing guide, including why the ignore file is inverted — added to `/reference/cli/workbench` as "The sharing rules it scaffolds", covering both reasons for inversion and the ignoring-is-not-untracking trap

### Build Phase 5: Keep the refusal

**Goal**: land D8's floor **before** Build Phase 6 makes real workbench roots git repos. The order is the point — fix the detector before creating the condition that fools it.

- [x] Give verify's entry path a plan root (where `impl.md` lives) and a code root (where the phase's code lives) — `lib/verify/roots.ts`, called before any detector runs
- [x] ~~In a workbench, resolve the code root to the wrapped repo the plan targets~~ — **deliberately NOT done; it refuses instead.** Resolving the path is easy, but the baseline sha comes from the plan repo's ledger and has no meaning in the code repo's history, so there would be nothing honest to diff against. Producing a verdict anyway means judging code by a diff that cannot contain it — the exact failure D8 exists to prevent. Cross-repo baselines are the named follow-on; this plan owns the floor
- [x] Where the code root cannot be determined, **refuse and name what could not be identified** — never fall back to the plan root, because a diff of plan documents is not evidence about code. Three shape-specific refusals: no repos declared, several declared (names them all), and one declared (explains the ledger-baseline mismatch and points at the code repo)
- [x] Update `assertGitRepo`'s comment: the refusal no longer holds because the root is not a repo; it holds because this code maintains it
- [x] Leave `phantom.ts`'s `isMachineState` narrow — do not widen it to paper over the root question. Untouched; widening it would have hidden the root question behind a broader exclusion list

#### Build Phase 5 Verification
- [x] A17 passes (`pnpm exec vitest run src/__tests__/workbench-verify-refusal.test.ts`, 2/2)
- [x] Check off a real implementation item in a git-initialized two-repo workbench, commit the code to the wrapped repo, and confirm **no** phantom finding — the false-positive case that would get the detector disabled. A17's first case is exactly this scenario, and it now passes via the refusal rather than via a verdict
- [x] Delete the code-root resolution and confirm verification **refuses** rather than reporting clean — an acceptance test cannot detect a detector that stopped checking. **Run 2026-08-19**: neutralising the workbench branch made both A17 cases fail with a literal `phantom` verdict on honestly-done work; restoring it passed 2/2. The refusal is load-bearing, not incidental
- [x] The existing verify suite passes unchanged for normal-mode projects like dusk — `src/lib/verify/` 41/41, and `indusk verify versioned-workbench --phase 1` run against **this repo** reports clean, which is the strongest available check: the tool pointed at its own project

#### Build Phase 5 Context
- [x] Add to Known Gotchas: detectors take a plan root and a code root and refuse when they cannot tell them apart; `assertGitRepo`'s refusal is now maintained rather than incidental — folded into the versioned-workbench Conventions entry, including that cross-repo baselines are the follow-on and normal-mode is untouched

#### Build Phase 5 Document
- [x] Update `/decisions/dawn-verify` and the verify reference with the two-root model and the refusal, naming the follow-on that completes the split for Shape and cleanup — a shared "Two roots, and a maintained refusal" section with the per-shape behavior table and an explicit "what is deliberately not done"

### Build Phase 6: The workbench becomes shareable

- [x] `git init` the workbench root, wrapped repo untouched — created **lazily** by `restore` and `sync` rather than demanded up front. A remote is a decision the developer makes; local commits are useful before one exists, so `git init` with no remote is a complete working state, not a half-configured one
- [x] Auto-commit on change with a timestamp message; push immediately; on reject, pull, re-resolve, push again. **Commit BEFORE pull**, despite the brief's "pull before everything": the safety property it actually names is *both sides committed before any merge*, which is what makes blind resolution recoverable. Pulling into a dirty tree would either refuse (blocking an agent) or stash (a third state nobody can see)
- [x] Pull-first on read and mutation paths, including `/catchup` — the skill now runs `indusk workbench sync` after `indusk sync pull`. Session start is when shared context is most likely stale and a stale read most expensive
- [x] Blind resolution: `merge=union` on the append-shaped files, `-X theirs` elsewhere. **Verified load-bearing**: removing the union rule for `highlights.jsonl` made A5 fail with `from-b` lost — `-X theirs` picked one side, exactly the multi-writer failure the brief flagged as this plan's falsification surface
- [x] Add `indusk update` to the mutation chokepoints — POC friction #1 was update mutating tracked files and leaving them to block the next pull. Workbench-only and never fatal: a failed sync must not fail an update
- [x] Offline: commits always succeed locally, push and pull are best-effort with retry, and nothing ever blocks an agent. A6 also forced the *wording*: echoing git's raw `fatal:` presents a routine outage as a hard failure, so the cause is kept and the alarm stripped
- [x] Make the two-clock skew visible via `indusk workbench status`: per-repo materialized/ahead state, naming the repo and saying a teammate cannot see that work yet (A16)

- [x] **Trigger decision (the ADR left this open)** — `indusk workbench sync` is the MECHANISM; the trigger is a debounced `PostToolUse` hook plus `/catchup`. A watcher daemon is deferred, not rejected: it is the only option that sees a human editing in their IDE, and it can call the same entry point when that gap is felt. Chokepoints-alone were rejected — they structurally cannot see a direct file edit, so they would ship a promise the mechanism cannot keep
- [x] **Discovered work — the trigger's blast radius.** A hook that auto-commits would, in a NORMAL-MODE project, commit half-finished source on every edit; dusk itself is such a project. Guarded by one `worktree.shape === "workbench"` check, debounced via a stamp under the **gitdir** (untracked by construction, not by a rule), and never blocking. `workbench-sync-hook.test.ts` asserts it from the outside — negative (no commit in normal mode), **paired positive** (does commit in a workbench, so a permanently-off guard cannot pass), and never-fails-an-edit
- [x] **Registered in BOTH init and update** — `globSync` copies a hook file, but settings registration is separate; a hook that exists and is never registered is a file that never runs (the eval-trigger lesson)

#### Build Phase 6 Verification
- [x] A2, A3, A4, A5, A6, A16 pass — per-row classification across every workbench + worktree suite: **102 passed, 0 failed, 0 incidental**. All 15 automated rows green; only A9 (manual smoke, Phase 7) remains
- [x] A4 and A5 run interleaved often enough to be meaningful, not once — A4 runs four interleaved rounds. **A5's dependency proven by removal**: deleting the `merge=union` rule for `highlights.jsonl` made it fail with `from-b` lost, because `-X theirs` picked a side. The union rule is load-bearing, not decorative
- [x] Remove the bare remote mid-run and confirm agent work continues, then restore it and confirm the backlog arrives with no user action — A6 renames the bare repo out from under the configured URL and back, which is as close to unreachable as a local fixture gets
- [x] Confirm the wrapped repo has zero new commits after a full sync-loop run — commit siloing is the contract, and this is the check that can fail. **Run 2026-08-21**: three sync runs against a two-repo workbench with BOTH wrapped repos left deliberately dirty — each repo's HEAD unchanged and the uncommitted source still uncommitted. The sync loop never touches product code

#### Build Phase 6 Context
- [x] Update Current State and add to Conventions: workbench root is a git repo with its own remote; sync is commit → pull → push, blindly resolved; the wrapped repo is never auto-committed

#### Build Phase 6 Document
- [x] Write `apps/docs/src/guide/workbench-sharing.md` with the topology mermaid diagram (what travels, what does not) and the two-clock skew; add to the sidebar — plus a **Known limits** section stating plainly that verify refuses in a workbench and that IDE edits outside a session do not auto-sync yet. A guide that omits its limits is how the next person discovers them as bugs

### Build Phase 7: Onboarding, end to end

- [x] Walk the documented onboarding path verbatim on a second checkout location — run against a workbench **the product itself created** (`indusk setup`), published to a bare remote, then cloned and restored. Found the bug below
- [x] ~~Migrate the POC~~ — **BLOCKED, scoped out 2026-08-26: repository access was revoked mid-plan** (SSH authenticates, the repo returns "not found"). Its findings were already harvested and shipped before access ended — the `sibling_parent`-names-another-machine fix, the config-vs-manifest drift that is D2's evidence, and the root-file whitelist bug. What is lost is the ability to verify an upgrade against a workbench that predates this plan; `numero-workbench` covers that ground instead
- [x] Point the tool at its own repo family: restore a workbench other than the one the fixtures were built from — **`numero-workbench`, and it found two bugs no fixture could.** Copying was impossible (91 GB, 44 live worktrees) and running in place would have `git init`-ed a directory that has never been a repo, so the run used a faithful MINIATURE: its real `config.json` (legacy `wrapped_repo`, `sibling_parent` pointing at the workbench itself), its real hand-written `.gitignore`, a trunk that is a **real directory rather than a symlink**, and worktree-shaped siblings. Every one of those differs from what the fixtures model

- [x] **Fix found by that run (a Phase 4 bug):** the root whitelist used `/*`, which denies root FILES as well as directories — so `restore` untracked `.mcp.json`, `biome.json`, `instrumentation.ts`, `logger.ts` and more from any real workbench. Narrowed to `/*/` (directories) plus the declared trunk names generated per repo, so root files stay tracked. Verified on the miniature: 5 of 6 previously-lost files kept, the 6th excluded by that workbench's own deliberate rule
- [x] **Second finding, deferred to Build Phase 8:** scaffolding only TOPS UP an existing `.gitignore`, so a workbench that already had one never receives the deny-by-default rule and `sync` commits worktree contents. Fixing it means either rewriting a human's file or refusing; the refusal is Phase 8

#### Build Phase 7 Verification
- [x] A1 passes (`pnpm exec vitest run src/__tests__/workbench-onboarding.test.ts`) — clone plus restore yields context and every declared repo
- [x] A9's manual smoke completes, following the written guide with no undocumented step. **It found one real defect**: `init` scaffolds a `.gitignore`, so every freshly created workbench tripped Phase 10's refusal and could not sync at all — a guard blocking the product's own output. Fixed by provenance: an InDusk-managed file is topped up, a hand-written one is still refused, with a paired negative test so "top up everything" cannot pass. **Limitation recorded honestly**: run on one machine, so `sibling_parent` existed and the trunk linked to the origin's checkout; the true cross-machine path was exercised separately by pointing it at a nonexistent parent, which fell back and cloned fresh
- [x] ~~The migrated the POC workbench restores from its remote with `bootstrap.sh` deleted~~ — unreachable, same cause as above
- [x] Trajectory State column reads terminal for all rows — 22 of 22, A9 included

#### Build Phase 7 Context
- [x] ~~Demote Current State + compress Conventions~~ — **duplicate gate, superseded by Build Phase 11's.** Authored when Phase 7 was the last phase; the compaction belongs at the end of the plan, and doing it twice would double-compress the same entries

#### Build Phase 7 Document
- [x] Publish the ADR to `/decisions/versioned-workbench.md` (sidebar-registered, planning-relative links stripped since a published page cannot resolve them); superseded-in-part pointer added to the worktree extension's ADR for both the single-repo narrowing and the flat layout; changelog entries written under Added/Changed/Fixed

### Build Phase 8: Declare the layout, stop inferring it

**Goal**: a repo declares where its trunk and its worktrees live; nothing derives layout from a name. See [`layout-amendment.md`](layout-amendment.md).

Absence means today's behavior — a repo with no `worktrees` declared stays flat. That is the whole migration story, the same reduction shape that made `wrapped_repo` → `repos[]` free.

- [x] Author A18, A19 in `workbench-layout.test.ts`, RED — two red for their own reasons (worktree lands at the root; a renamed trunk is not followed), two green as guards that must stay green
- [x] Add optional `path` and `worktrees` to `WorkbenchRepo` in `lib/config.ts`, alongside `name` and `remote`
- [x] Resolve them in `readWorkbenchRepos` — absent `path` ⇒ `name`, absent `worktrees` ⇒ flat (the workbench root). Exposed as `repoDir()` / `worktreesDir()` so no caller re-derives either; a second copy is where the two answers quietly diverge
- [x] Guard both as **path-join boundary values** via `isCleanSegment`, exactly as `name` already is. A declared path is a single segment; anything else is dropped rather than joined
- [x] `worktree create` puts the new worktree in the declared location, creating it if absent — the TS wrapper passes `--worktrees-dir` only when one is declared, so the flat path is byte-identical to before. The slug-vs-repo-name collision guard now applies **only to flat layouts**, since a declared directory puts the worktree somewhere the trunk cannot be
- [x] The trunk resolves through `path`, so a repo directory can be renamed by editing config

#### Build Phase 8 Verification
- [x] A18, A19 pass (`pnpm exec vitest run src/__tests__/workbench-layout.test.ts`, 4/4)
- [x] A workbench declaring nothing new behaves **byte-identically** to today — 106 passed / 0 failed across every workbench and worktree suite; fast suite 983 passed
- [x] A declared path containing `..` or `/` is dropped, not joined — assert the refusal. **Proven load-bearing**: removing `isCleanSegment` from the `worktrees` read makes the escape test fail, i.e. a directory really is created outside the workbench without it

#### Build Phase 8 Context
- [x] Add to Conventions: a workbench's layout is declared (`path`, `worktrees`), never inferred from a name; absence means flat

#### Build Phase 8 Document
- [x] Update `/reference/cli/workbench` with the declaration fields and the absence-means-flat rule — plus why declaring beats inferring, and that both are boundary values

### Build Phase 9: Listing groups by repo, disk stays the inventory

**Goal**: `worktree list` reads structurally instead of asking git which repo owns each worktree.

**Declarations add structure; they can never subtract.** A worktree found outside every declared location renders as **unattributed**, never dropped — the standing rule that keeps a renamed folder from making work disappear.

- [x] Author A20 in `workbench-layout.test.ts`, RED
- [x] Group the listing by declared repo, using the declared worktrees location as the structural signal — no git call and no inference: the containing directory IS the answer, which is the point of declaring it
- [x] Keep discovery on disk — enumerate what is there, then attribute it, rather than listing what config claims
- [x] Fall back to `--git-common-dir` for anything outside a declared location, and render it under an explicit **Unattributed** heading — and **name what is inside it**, one level down, with the repo each belongs to. Found by reading the output rather than the assertion: reporting only the container is its own subtraction, since a reader sees a folder and cannot tell it holds two worktrees
- [x] Drop the slug-vs-repo-name collision invariant where a declared layout makes it impossible — done in Phase 8's shell change; the guard now applies only to flat layouts

#### Build Phase 9 Verification
- [x] A20 passes (`pnpm exec vitest run src/__tests__/workbench-layout.test.ts`, 6/6)
- [x] Rename a declared worktrees directory WITHOUT updating config and confirm its worktrees appear as unattributed — not missing. **Both the container and each worktree inside it are named**, with the repo each resolves to. Proven load-bearing by removing the structural grouping and watching A20 fail
- [x] Flat workbenches still list exactly as they do today — 108 passed / 0 failed across every workbench and worktree suite; fast suite 983 passed

#### Build Phase 9 Context
- [x] Add to Known Gotchas: listing discovers from disk and attributes via declarations; anything unattributable renders as such rather than vanishing

#### Build Phase 9 Document
- [x] Update the worktree extension skill's topology section for declared layouts and the unattributed case

### Build Phase 10: Ignore rules become precise

**Goal**: replace deny-by-default with one generated line per declared worktrees location — and refuse where that is impossible.

This closes the hole Phase 7 found on a real workbench: scaffolding only tops up an existing `.gitignore`, so one that predates this plan never receives the deny-by-default rule and `sync` commits worktree contents.

- [x] Author A21, A22 in `workbench-sync-ignore.test.ts`, RED
- [x] Generate `/<worktrees>/` per declared location — precise, appendable to a hand-written `.gitignore` without inverting its meaning. A21 writes a file with its own rules first and asserts they survive
- [x] Drop deny-by-default for workbenches that declare their locations — `allLocationsDeclared` picks the header; a workbench that can name its worktree directories is not given an opinion it does not need
- [x] For a FLAT workbench, call `missingIgnoreRules` from `restore` and `sync` — and **refuse**, non-zero, naming each missing rule. Never rewrite a human's `.gitignore`
- [x] Point that refusal at three ways out — declare the locations, add the rules by hand, or `--no-ignore-check`. A refusal with no way past it becomes a reason to stop using the tool
- [x] Report untracked paths **by name**, not as a count — it drops files from a shared repo's index. On a real workbench that list included `.mcp.json`, correct per that project's own rule and invisible in a count

- [x] **The generator and its checker had drifted, twice.** `missingIgnoreRules` required one spelling of the root rule while the header wrote another, so a correctly-scaffolded workbench reported a gap — and a real gap could have gone unreported. Both previous fixes were a second copy of a string, and the Phase 4 one silently never applied. Both rules are now named once (`ROOT_DENY_RULE`, `SECRETS_RULE`) and the check READS them, so the drift is not fixed but impossible

#### Build Phase 10 Verification
- [x] A21, A22 pass (`pnpm exec vitest run src/__tests__/workbench-sync-ignore.test.ts`, 5/5)
- [x] A8 gains a case with a **pre-existing `.gitignore`** — A22 is that case, and it is what caught the real drift below
- [x] Remove the refusal and confirm A22 fails, so it is load-bearing rather than incidental — neutralised, A22 red; restored, 5/5 green
- [x] The override actually proceeds, so the refusal is not merely always-on — `--no-ignore-check` exits 0 on the same workbench that is otherwise refused

#### Build Phase 10 Context
- [x] Add to Known Gotchas: declared layouts generate precise ignore lines; flat workbenches are refused because worktree names cannot be known in advance

#### Build Phase 10 Document
- [x] Update `/guide/workbench-sharing` with the refusal, what it protects, and the override

### Build Phase 11: Migrate a flat workbench in one command

**Goal**: an existing flat workbench opts in without hand-moving anything.

- [x] Author A23 in `workbench-layout.test.ts`, RED
- [x] `indusk workbench migrate-layout` — declare a worktrees location per repo, move existing worktrees into it, and repair each one's gitdir link so it still works. Uses **`git worktree move`**, never a manual rename: a worktree is two cross-references (its `.git` file and the repo's `.git/worktrees/<name>/gitdir` pointing back), and moving the directory without repairing both leaves something that looks right and is broken. That is the only failure of this command that matters, so it is handed to the tool that knows
- [x] Dry-run by default; `--apply` performs it. A command that relocates directories should show its plan first
- [x] Refuse loudly on anything it cannot move — a partial migration that exits 0 is the failure this plan has fought throughout. A directory that resolves to no declared repo is left alone and reported, never guessed at
- [x] Leave the wrapped repos untouched: this moves worktrees, never product code

#### Build Phase 11 Verification
- [x] A23 passes — worktrees move and every one still resolves (`git -C <wt> status` succeeds), 10/10. Asserting the worktree still WORKS is the point: a moved directory with a stale back-reference looks correct and is not
- [x] Dry-run changes nothing on disk — worktrees stay put, no destination directory appears, and `config.json` is byte-identical
- [x] A blocked move exits non-zero naming what it could not move, leaving the rest untouched — verified with a `git worktree lock`: the movable one moved, the locked one stayed, exit 1 naming it. Proven load-bearing by making the failure exit 0 and watching the test fail
- [x] Wrapped repos have zero new commits after a migration, as with the sync loop

#### Build Phase 11 Context
- [x] Compress the Conventions entries this plan authored to rule plus pointer — the single bullet had grown to **2,997 characters** against a documented standard of "1–3-line rules + pointer"; split into four rules with pointers, 1,505 chars, CLAUDE.md 46,690 → 45,209 bytes. The stale Active Plans row (still reading "brief accepted") was corrected in the same pass. **The Current State narrative demotion belongs to `/retrospective`**, which archives the plan and can write the archive link — doing it now would point at a directory that has not moved

#### Build Phase 11 Document
- [x] Document the migration in `/reference/cli/workbench`, including the dry-run default and what it refuses

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/worktree/repos.ts` | New — `readWorkbenchRepos`, the single TypeScript resolution function |
| `apps/indusk-mcp/src/bin/commands/workbench.ts` | New — the `workbench` command group and `restore` |
| `apps/indusk-mcp/src/bin/commands/worktree.ts` | N trunks; `create <repo> <slug>`; `docs` reserved |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Read the repo set through `readWorkbenchRepos`; write `repos[]` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Nudge on unmaterialized repos; join the sync chokepoints |
| `apps/indusk-mcp/src/lib/stray-state-audit.ts` | Plural repo set |
| `apps/indusk-mcp/hooks/_hook-paths.js` | N>1 derives from cwd or skips naming all declared repos |
| `apps/indusk-mcp/src/lib/verify/git.ts` | Plan root / code root; maintained refusal |
| `apps/indusk-mcp/extensions/worktree/scripts/*.sh` | `_read_workbench_repos`; four scripts converted |
| `apps/indusk-mcp/extensions/worktree/hooks/on_enable.sh` | Plural repo set |
| `apps/indusk-mcp/extensions/worktree/skill.md` | Multi-repo topology; repo argument |
| `apps/docs/src/reference/cli/workbench.md` | New reference page |
| `apps/docs/src/guide/workbench-sharing.md` | New guide with topology diagram |
| `apps/docs/src/decisions/versioned-workbench.md` | Published ADR |

## Dependencies

- `indusk-worktree-extension` (shipped) — the workbench shape being widened; its ADR's single-repo v1 narrowing is superseded here
- `indusk-makeover` (impl completed) — withdrew A7, established hub push/pull that D5 keeps separate
- `handoff-multi-agent-section-shape` (shipped) — per-agent `current.md` sections + `merge=union`, extended cross-machine

## Notes

- Every row is `Writable at: Test Phase 1`. That is the honest reading, not a shortcut: this plan's assertions are CLI- and filesystem-observable, so none needs a symbol that does not exist yet. An absent CLI command exits non-zero, which is real red.
- The two register entries are both **inverted-fixture traps** rather than ordinary regression guards. A8 and A17 each pass today for an accidental reason — a workbench root that is not a git repo. Both must be authored against a git-initialized fixture or they pin the accident.
- Build Phase 5 deliberately precedes Build Phase 6. Landing the sync loop first would leave a window where real workbench roots are git repos and phantom detection fires on every honest checkoff.
- Follow-on, named and out of scope: the full plan-root/code-root split across Shape and cleanup. This plan owns the refusal only.
- The worktree kickoff lives in **Test Phase 1**, not Build Phase 1 — with `test_phases: required` the test phase is the first phase that writes code, so a kickoff sitting in Build Phase 1 would fire one phase after the first commit. Found by executing the plan, not by reading it.
- `indusk init-docs` hardcodes `apps/${projectName}-docs` and cannot scaffold a workbench-root `docs/` (D7). Not blocking — recorded so the next plan touching docs scaffolding has it.
- **Build Phase 8 exists because Phase 7 pointed the tool at a real workbench.** `numero-workbench` has its own `.gitignore`, so the scaffold only topped up the trunk block and the deny-by-default rule was never applied — `sync` committed worktree contents. A8 could not see it: its fixture ships no `.gitignore`, so the scaffold always writes the full whitelist and the guard is green for a fixture-shaped reason. The layout fix that removes the need for the rule is its own plan — see `.indusk/planning/workbench-declared-layout/`

### Phase 12: Falsification — the safety arguments that do not hold

**Goal**: verify whether the attested state holds against seven specific failures found by reading the implementation against its own claims. Each row below is a named failure mode, not a candidate; each item is the change the code needs.

The theme that connects most of them: **a claim in a comment or a message that the code does not actually enforce.** The blind-merge safety argument, the "in sync" report, the "trunk linked" line — each asserts something the surrounding code can fail to deliver.

- [x] **A24 — sync must stop when the commit fails.** `syncWorkbench` records `Commit failed: …` in its notes and then pulls anyway, while the comment above the pull says *"Losing a hunk here is recoverable — step 1 committed it."* That is false exactly when step 1 failed, and a failed commit is not exotic: a pre-commit hook, a missing git identity, a full disk, or an `index.lock` held by a concurrent sync all produce it. Return after a failed commit with the reason, leaving the tree untouched
- [x] **A25 — the trigger must work before the repo exists.** `stampPath` runs `git rev-parse --absolute-git-dir` and returns null when the workbench is not a git repo; `dueForSync(null)` is false, so the hook exits 0 and never syncs. But the only thing that git-inits a workbench is `sync` itself, so a workbench that has never been initialized is **silently never synced, forever**. numero-workbench is exactly this shape. Fall back to a stamp location that does not presuppose a repo
- [x] **A26 — "in sync" must not mean "never pushed".** `repoPublishState` runs `rev-list --count <remote>/<branch>..HEAD`, which ERRORS when the branch has no remote-tracking ref, and the error path sets `ahead = 0` → "in sync with its remote". The worst case reports the most reassuring message, inverting the very skew A16 exists to expose. Detect the missing upstream and say so
- [x] **A27 — the segment guard must reject reserved names.** `isCleanSegment` blocks traversal but accepts `.git`, `.indusk`, and `.claude`, so `worktrees: ".git"` would place worktrees inside the workbench's own git directory. Reject reserved names at the same boundary, since these are joined into paths
- [x] **A28 — a move must not target its own source.** `migrate-layout` computes `dest = <owner>-worktrees` and excludes only `repoDir` from the loose set, so a worktree already named `alpha-worktrees` gets destination `alpha-worktrees/alpha-worktrees` — moved into itself. Skip and report any move whose destination is inside its source
- [x] **A29 — status must resolve by declared path.** `workbenchStatusCommand` calls `repoPublishState(siblingParent, repo.name)` while every other consumer uses `repoDir(repo)`. A repo with a declared `path` reports "not materialized" in status and lists fine in `worktree list`. This is Phase 8's own rule broken in the one place that was missed
- [x] **A30 — never claim a link that was not made.** `restore` prints `✓ <repo> — already present, trunk linked` unconditionally, but `linkTrunk` returns early when a real directory occupies the path, correctly refusing to remove it. On a workbench whose trunk is a real checkout rather than a symlink — the shape numero-workbench actually has — the message is simply false. Report what happened
- [x] Shape (`apps/indusk-mcp/src/lib/worktree/sync.ts`) — Make `published` a required boolean on `RepoPublishState`. Every return path already sets it, but the optional type says otherwise — so the consumer must write `st.published === false`, and the more natural `!st.published` would be a bug the day an absent value appears. The type should state what the code already guarantees.. Rule: typescript — do not encode a two-state fact as an optional boolean; a tri-state type invites a reader to treat absent and false alike
- [x] Shape (`apps/indusk-mcp/src/bin/commands/workbench.ts`) — Extract the four-branch nested ternary in `workbenchRestore`s report loop into a named `restoreLine(repo, status, siblingParent)`. It is a rendering decision with four cases and two hoisted string fragments inlined into a `console.info` argument, and it has no seam a test can reach without spawning the CLI.. Rule: typescript — a block with one nameable purpose gets a name and a test seam; here the loop body is doing two jobs, deciding what happened and phrasing it
- [x] Shape (`apps/indusk-mcp/hooks/workbench-sync.js`) — reviewed, left as-is: the stamp-path fallback is three lines whose whole justification is the chicken-and-egg docblock directly above them; extracting it would move the explanation away from the branch it explains

#### Phase 12 Verification
- [x] A24: a sync whose commit fails stops there and says so; the working tree is unchanged and no merge ran
- [x] A25: the hook syncs a workbench that is not yet a git repo, and the stamp does not require one
- [x] A26: a repo with a remote but a never-pushed branch is reported as unpublished, distinct from both "in sync" and "no remote"
- [x] A27: `.git`, `.indusk`, `.claude` are refused as declared paths — assert the refusal, since accepting them is the failure
- [x] A28: a worktree named `<repo>-worktrees` is reported as unmovable rather than moved into itself, and the other moves still complete
- [x] A29: a repo with a declared `path` reports its real publish state in `workbench status`
- [x] A30: a workbench whose trunk is a real directory does not get told a link was created
- [x] Each fix proven load-bearing by reverting it and watching its row go red — every row here targets a case that passes today for the wrong reason

#### Phase 12 Context
- [x] Add to Known Gotchas: a safety argument written in a comment is not enforced by the code around it — sync's blind merge, status's "in sync", and restore's "trunk linked" each asserted something their own control flow could fail to deliver

#### Phase 12 Document
- [x] Update `/reference/cli/workbench` for the corrected `status` states (unpublished vs in-sync vs no-remote) and the reserved-name refusal

### Phase 13: Cleanup — three facts about workbench layout, each written down twice

**Goal**: give the workbench's layout facts one definition each. This plan added a second command group (`workbench`) alongside `worktree`, and each needed the same three things — which root directories are not worktrees, which repo owns a worktree, and how a trunk symlink is made. All three were re-authored rather than shared, and in every case the *reasoning* stayed on the first copy. Extraction is warranted here for the reason the rule of three exists: a divergence in any of them is silent and reads exactly like correct behavior.

- [x] Extract the reserved root-directory set and the subdir listing into `lib/worktree/layout.ts` (`RESERVED_ROOT_DIRS` + `listWorkbenchSubdirs`), and route `worktree.ts`'s `listSubdirs` and `workbench.ts`'s `listWorkbenchSubdirs` through it. Twelve identical entries, written independently in two files — and the comment explaining why `docs` is in the set ("absent from this set it renders as a worktree, which is how the POC's `docs/` looked before anyone noticed") exists only on the `worktree.ts` copy. A name missing from one set renders a machine directory as a worktree or hides a real one, with nothing to see. Rule of three is already met by `migrate-layout` having been the second consumer
- [x] Extract worktree-to-repo attribution into the same module as `worktreeOwner`, and delete `workbench.ts`'s `worktreeOwnerOf`. The two bodies are line-for-line identical under two names; only the names differ. The docblock that explains *why* it asks git instead of matching a slug prefix — "a wrong attribution reads exactly like a right one" — travels with the surviving copy, since the second one kept a one-line summary and the reasoning was already half-lost after a single copy
- [x] Route `init.ts`'s inline trunk-symlink creation (line ~492) through `workbench.ts`'s `linkTrunk`, moving `linkTrunk` + `isSymlink` + `isDanglingLink` to `lib/worktree/layout.ts` so both callers can reach it. init's copy is a strict subset: it creates a link when nothing is there and prints "already exists" otherwise, so it neither repairs a dangling link nor refuses a real directory — and A30 has just finished proving that the refusal matters and that reporting it wrongly is a lie the user acts on
- [x] Extract the test lane's `runCli` and the `REPO_ROOT`/`CLI_BIN`/`SHOULD_SKIP` preamble into `src/__tests__/helpers/cli.ts`. Ten byte-identical copies (verified by hashing the function bodies), nine of them authored by this plan. Phase 1's Shape review saw this at eight copies and deliberately deferred it here, on the grounds that the rule of three is cleanup's question and that the right shape was not yet settled — it is settled now, since all ten are the same bytes
- [x] Extract one `git(cwd, args)` test helper into the same file, returning `{ code, stdout, stderr }` so every current caller can read what it needs. Five copies in three shapes, and **two of them silently omit the `GIT_AUTHOR_*`/`GIT_COMMITTER_*` identity env**. Those two only read today, so the omission is invisible — but it is a machine-dependency waiting to be copied into the next file that commits, on a machine with no global `user.email`. This one removes a latent failure, not just repeated lines
- [x] Delete `worktreesDir` from `lib/worktree/repos.ts` — exported, zero callers, and no existing call site would accept its answer. It returns `repo.worktrees ?? "."`, while all six real consumers ask a different question: *did this repo declare a location?* (`if (!repo.worktrees) continue`, `filter((r) => r.worktrees)`, `every((r) => typeof r.worktrees === "string")`). A dead helper offering a `"."` that would change behavior at every site is the same invitation Phase 3 removed when it deleted `readWorkbenchConfig`
- [x] **Delete `resolveRepo` from TypeScript** and share its one genuinely-duplicated part, the not-a-workbench message, as `NOT_A_WORKBENCH`. *Amended from "route `worktreeList` through `resolveRepo`" — the item was wrong on the facts.* Reading the code to implement it showed no TypeScript caller needs pick-one **by design**: `worktreeCreate` passes `--repo` straight through and lets bash's `_resolve_workbench_repo` decide, so there is exactly one implementation of the rule and it is the shell one. `worktree list` wants every repo, so routing it through a resolver whose multi-repo answer is a refusal meant special-casing that refusal back out — a contortion that made the caller worse to keep a dead function alive. A dead TS twin is not a deliberate port; a deliberate port has both sides live. The single-definition test's port marker names `readWorkbenchRepos`, which is unaffected
- [x] (reviewed `bin/commands/workbench.ts` — 649 LOC at review time, **572 after the extractions**, over the 400 cap, and left at one file: one file per command group is the settled boundary in `bin/commands/`, where `init.ts` is 1249, `update.ts` 863 and `worktree.ts` 424, all single-group and all over cap. Splitting `workbench` into four files to hit a number would break the convention every other command follows, and the number is attention-focus, not a gate. The three extractions above removed 77 lines from it as a side effect, which is the right reason for it to shrink — and dropped `worktree.ts` from 424 to 364, off the flagged list entirely)
- [x] (reviewed `cli.ts`, `init.ts`, `update.ts`, `lib/config.ts`, `changelog.md` — all over cap and all flagged, all over cap *before* this plan, which only added a command registration, a workbench branch, a config field and a changelog entry to them respectively. Decomposing files this plan did not author is a different plan's work; recorded so "over cap" and "in scope" stay distinguishable)
- [x] (reviewed `extensions/worktree/scripts/lib/workbench-helpers.sh` — left as-is: `_read_workbench_repos` and `_resolve_workbench_repo` duplicate TypeScript by design, because the shell lane cannot import it. That is a deliberate port, pinned by `workbench-repos-single-definition.test.ts` asserting one definition per lane and marking each as a port of the other. Collapsing it is not possible and calling it duplication would mislabel the one duplication in this plan that is load-bearing)
- [x] Shape (`apps/indusk-mcp/src/lib/worktree/layout.ts`) — Make `isSymlink` and `isDanglingLink` module-private. Both are exported with zero callers outside this file — they existed as private helpers in `workbench.ts` and I widened them on the move without a caller asking. That is the same dead-export class this phase deleted `worktreesDir` and `resolveRepo` for, introduced by the phase that removed them.. Rule: typescript — export is a claim that something is part of the surface; a symbol nothing outside calls should not make it
- [x] Shape (`apps/indusk-mcp/src/lib/worktree/layout.ts`) — reviewed, left as-is: it holds three concerns — the reserved set + listing, attribution, and trunk linking — which raises a real module-boundary question. That question is inter-file and the rule set scopes it to /cleanup at close, not to Shape; re-deciding it here would have the two rituals fighting over the same territory. Noted so the boundary is a recorded judgment rather than an oversight

#### Phase 13 Verification
- [x] A31: `RESERVED_ROOT_DIRS` has exactly one definition under `src/`, and both listings return identical names for the same workbench
- [x] A32: worktree-to-repo attribution has exactly one definition under `src/`, and `workbench-multi-repo.test.ts` still passes unchanged — behavior parity is the point, so an assertion changing here means the extraction changed something
- [x] A33: `init --workbench` over a dangling trunk symlink repairs it, and over a real directory leaves it and says so — the parity with `restore` that routing through `linkTrunk` buys
- [x] The full workbench suite passes unchanged after the test-helper extraction (`pnpm exec vitest run src/__tests__/workbench-*.test.ts src/__tests__/worktree-*.test.ts`) — the extraction is structure-preserving, so any test that changes behavior is a mistake, not a result
- [x] `grep -rn "function runCli" src/__tests__/workbench-*.test.ts src/__tests__/worktree-cli.test.ts` returns nothing, and the two `git()` copies missing the identity env are gone
- [x] (recorded, not fixed) The same grep finds **four more identity-less `git` spawns** outside the migration set — `multi-agent-merge`, `worktree-visibility-cli`, `worktree-setup`, `worktree-refresh-clears-skip`. All pre-date this plan and none is in its changed-file set, which is the cleanup ritual's declared scope. Migrating them is a one-line change each and a good first item for whoever touches those suites next; doing it here would put unreviewed churn into a plan about to close

#### Phase 13 Context
- [x] Update the Known Gotchas single-definition entry to name `lib/worktree/layout.ts` alongside `resolveImplPath`, `TERMINAL_STATES`, `git()` and the phase-block scan — same rule, fourth instance, and the reason is the same each time: a primitive kept inside a command module gets copied by the next command instead of imported

#### Phase 13 Document
- [x] Document the three trunk-link outcomes (created / repaired / refused) in `/reference/cli/workbench`, and say that `init --workbench` gives the same three. *The authored item said no docs were owed because the `restore` page already covered it — that was wrong: the page described `restore`, not `init`, and `init`'s behavior in two cases genuinely changed. Writing the paragraph was cheaper and more honest than asking to skip a gate on a false premise.*
