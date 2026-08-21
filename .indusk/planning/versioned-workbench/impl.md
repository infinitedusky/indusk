---
title: "Versioned Workbench"
date: 2026-08-17
status: in-progress
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
| Test Phase 1 | 16 authored assertions, red, plus the two-repo workbench fixture they share | existing `helpers/worktree-fixture.ts`, the avoca POC's `bootstrap.sh` as behavioral reference |
| Build Phase 1 | `worktree.repos[]` schema, `readWorkbenchRepos()`, singular→plural reduction, `worktree list` over N trunks | `.indusk/config.json`, `worktree.ts` |
| Build Phase 2 | `_read_workbench_repos` bash helper; 4 scripts converted; `worktree create <repo> <slug>` | Phase 1's config shape |
| Build Phase 3 | `indusk workbench restore` — clone, symlink, `--worktrees`, partial-failure contract | Phase 1's `readWorkbenchRepos`, Phase 2's `worktree create` |
| Build Phase 4 | out-of-band report, whitelist `.gitignore` + `merge=union` `.gitattributes`, `update` nudge | Phase 3's restore |
| Build Phase 5 | plan-root/code-root resolution + refusal in verify's entry path | existing `assertGitRepo`, `phantom.ts` |
| Build Phase 6 | workbench root git-init + the sync loop | Phase 4's ignore shape, Phase 5's preserved refusal |
| Build Phase 7 | documented onboarding path, end-to-end | every prior phase |

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
| A9 | A second developer following the onboarding steps ends up with a working workbench | Test Phase 1 | Build Phase 7 | written | e2e | `manual: docs/guide/workbench-sharing.md — second checkout location` |

### Deferred Verification

- **Onboarding on a machine with no prior SSH host-alias configuration**
  - reason: SSH host aliases (e.g. `github-avoca`) are machine configuration outside every repo; a test that provisioned them would be asserting against its own fixture rather than against the product.
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

- [x] **Found by the real-workbench run** — `sibling_parent` is an absolute, machine-specific path committed to the SHARED context repo. avoca's says `/Users/sandycorsillo/code/lazer/avoca`; on another machine that directory does not exist and restore reports every repo missing. A fixture can never catch this, because a fixture sets `sibling_parent` to its own tmpdir. Resolve it as: declared-and-exists → use it; declared-and-missing → say so and fall back to the workbench's parent; absent → the workbench's parent. "Beside the workbench" is the topology `indusk setup` actually builds, so the parent is the right default rather than a guess

#### Build Phase 3 Verification
- [x] A10, A11, A12 pass (`pnpm exec vitest run src/__tests__/workbench-restore.test.ts`) — A1 flipped green early too, since clone+restore is exactly what it observes
- [x] A12 specifically asserts the **failure** path: named repo, preserved siblings, non-zero exit — a restore that clones half and exits 0 must be a test failure, not a warning. Confirmed out-of-band too: the real avoca clone exits **1** (an earlier reading of `0` was my harness reporting `head`'s status through a pipe, not node's)
- [x] Run `indusk workbench restore` verbatim from the docs against a real clone of the avoca workbench — a library is not shipped until its documented invocation has been run as written. **This single run found what no fixture could**: (1) the committed `sibling_parent` names another machine's home directory, fixed above; (2) `config.json` declares ONE repo while `workbench.json` declares TWO — the drift D2 rejected the separate manifest to prevent, already live in production; (3) a legacy `wrapped_repo` workbench carries no `remote`, so restore correctly refuses rather than pretending. The temp clone was removed afterwards; the live workbench was never written to
- [x] Re-run against an already-materialized workbench and diff the tree: zero changes (A11's full-tree snapshot)

#### Build Phase 3 Context
- [x] Add to Conventions: `indusk workbench restore` materializes a cloned workbench; partial failure is loud and non-zero; `init` and `update` never clone — plus the `sibling_parent` fallback, folded into the existing versioned-workbench entry as rule + pointer

#### Build Phase 3 Document
- [x] Write `apps/docs/src/reference/cli/workbench.md` — flags, idempotence, the partial-failure contract; add it to the VitePress sidebar (`apps/docs/src/.vitepress/config.ts`, not the stale root scaffold). Includes the `sibling_parent`-across-machines behavior and why `init`/`update` are the wrong homes

### Build Phase 4: What never travels

- [x] Print the out-of-band set after restore: `env/*.env`, `.indusk/extensions/doppler/.env`, repo-local config, required SSH host aliases — landed early, in Phase 3, because restore had nothing honest to say at its end without it
- [x] Scaffold the root-directory-**whitelist** `.gitignore` — deny by default, directories added explicitly, so an unpredicted worktree directory is untracked by construction. **The deny rule is `/*`, not `/*/`**: git stores a trunk symlink as a blob, so a directory-only rule leaves every trunk tracked — caught by A8, not by reading. Ported from the avoca POC's months-tested file rather than authored fresh, including its comment on why the trailing `.env*` glob is load-bearing. Scaffolds only when absent; a hand-tuned ignore file is a decision, not drift
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

- [ ] Walk the documented onboarding path verbatim on a second checkout location: clone, restore, supply out-of-band, update
- [ ] Migrate the avoca POC — `.indusk/workbench.json` folds into `worktree.repos[]`, `scripts/bootstrap.sh` retires
- [ ] Point the tool at its own repo family: restore a workbench other than the one the fixtures were built from

#### Build Phase 7 Verification
- [ ] A1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] A9's manual smoke completes on a real second checkout, following the written guide with no undocumented step — an undocumented step discovered here is a documentation bug, not a smoke failure
- [ ] The migrated avoca workbench restores from its remote with `bootstrap.sh` deleted
- [ ] Trajectory State column reads terminal for all sixteen rows

#### Build Phase 7 Context
- [ ] Demote this plan's Current State narrative to one line plus an archive link, and compress the Conventions entries this plan authored to rule plus pointer

#### Build Phase 7 Document
- [ ] Publish the ADR to `/decisions/versioned-workbench.md`; add the superseded-in-part pointer to the worktree extension's ADR; write the changelog entries

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
