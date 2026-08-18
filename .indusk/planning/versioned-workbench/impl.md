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
| A13 | A two-repo workbench presents both as trunks, each with its own worktrees listed under it | Test Phase 1 | Build Phase 1 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-multi-repo.test.ts` |
| A14 | `worktree create` makes the worktree in the repo named; ambiguity fails listing the declared repos rather than picking one | Test Phase 1 | Build Phase 2 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-multi-repo.test.ts` |
| A10 | One documented command clones every declared repo beside the workbench and links it in, with nothing cloned or linked by hand | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A11 | Re-running that command reports every repo already present and changes nothing on disk | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A12 | One unreachable repo names itself, leaves the others materialized, and completes on re-run after the fix | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A15 | The out-of-band list is shown in full, and no file on it is present in the shared remote | Test Phase 1 | Build Phase 4 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-restore.test.ts` |
| A8 | Trunk symlinks, worktree dirs, the doppler token, and per-app env pulls never appear in the shared remote | Test Phase 1 | Build Phase 4 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-ignore.test.ts` |
| A17 | Verification never reports checked-off work as phantom on a diff that could not have contained the code — it checks the code's repo or refuses naming what it could not identify | Test Phase 1 | Build Phase 5 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-verify-refusal.test.ts` |
| A3 | Any edit to a workbench file is committed automatically with a timestamp-style message, with no prompt | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A2 | A change in one workbench appears in another after its next sync point, with no manual git commands | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A4 | Two workbenches editing concurrently both reach the remote; neither sees a conflict prompt or a blocked command | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-concurrent.test.ts` |
| A5 | Concurrent appends to `current.md` and `highlights.jsonl` both survive the merge | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-concurrent.test.ts` |
| A6 | With the remote unreachable, edits still commit and work is never blocked; changes arrive after it returns | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync-offline.test.ts` |
| A16 | A pulled phase marked complete whose code has not arrived is distinguishable from one that has | Test Phase 1 | Build Phase 6 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-sync.test.ts` |
| A1 | A second developer cloning the workbench repo sees the full planning history, lessons, and `current.md` sections | Test Phase 1 | Build Phase 7 | written | integration | `apps/indusk-mcp/src/__tests__/workbench-onboarding.test.ts` |
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

- [ ] Add `worktree.repos[]` to the config schema, with `remote` optional
  ```ts
  interface WorkbenchRepo { name: string; remote?: string }
  ```
- [ ] Write `readWorkbenchRepos(root): WorkbenchRepo[]` in `src/lib/worktree/repos.ts` — the single resolution function every TypeScript consumer goes through
- [ ] Implement the reduction: `wrapped_repo: "x"` reads as `repos: [{ name: "x" }]`, so no existing workbench needs a config edit
- [ ] Guard `name` as a path-join boundary value — segment-checked, first-occurrence-deduped, before any join
- [ ] Convert `worktree.ts`, `init.ts`, `stray-state-audit.ts`, and `_hook-paths.js` to `readWorkbenchRepos`
- [ ] Under N > 1, `_hook-paths.js` derives the repo from the commit's cwd and otherwise skips naming every declared repo — never guessing (D6)
- [ ] Add `docs` to `worktreeList`'s reserved set (D7) — currently absent, so a workbench-root `docs/` renders as a worktree
- [ ] Pin single-definition: a test asserting exactly one `readWorkbenchRepos` definition exists under `src/`

#### Build Phase 1 Verification
- [ ] A13 passes — a two-repo workbench lists both trunks with worktrees attributed correctly (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] Every other row still red for its own reason; none flipped green as a side effect
- [ ] Single-definition test fails when a second `readWorkbenchRepos` is pasted in — assert the refusal, not just the acceptance
- [ ] An existing single-repo workbench (`wrapped_repo`, no `repos[]`) still passes the full worktree suite unchanged

#### Build Phase 1 Context
- [ ] Add to Conventions: `worktree.repos[]` is the single source for a workbench's repo set; `wrapped_repo` reduces to a one-element list; all readers go through `readWorkbenchRepos` — pointer to `/decisions/versioned-workbench`

#### Build Phase 1 Document
- [ ] Update the worktree extension skill's topology section for N trunks, and note `docs/` as reserved

### Build Phase 2: The bash lane

**Goal**: the four shell consumers, where 35 of the 80 `wrapped_repo` occurrences live and nothing type-checks a missed site.

- [ ] Write `_read_workbench_repos` as one shared sourced helper under `extensions/worktree/scripts/`
- [ ] Convert `setup-worktree.sh` (12 occurrences)
- [ ] Convert `on_enable.sh` (10 occurrences)
- [ ] Convert `refresh-worktree.sh` (7 occurrences)
- [ ] Convert `preflight.sh` (6 occurrences)
- [ ] Restore the `<repo>` argument: `indusk worktree create <repo> <slug>`, optional at N=1, refusing with the declared list when ambiguous
- [ ] Pin single-definition for the bash helper the same way as the TypeScript one

#### Build Phase 2 Verification
- [ ] A14 passes — named repo targets that repo; ambiguity refuses listing the declared repos (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] `grep -rn 'wrapped_repo\|WRAPPED_REPO' apps/indusk-mcp/extensions apps/indusk-mcp/src apps/indusk-mcp/hooks` returns only the reduction site and prose — a scripted census, not a reading, because a manual survey of copies undercounts
- [ ] Each converted script runs standalone under `set -u` with an N=1 config, proving the reduction holds in bash and not only in TypeScript

#### Build Phase 2 Context
- [ ] Add to Known Gotchas: the bash lane reads the repo set through one sourced helper; a hand-rolled `jq`/`node -e` read in a new script is a silent divergence with no type checker to catch it

#### Build Phase 2 Document
- [ ] Update the worktree extension skill: `worktree create <repo> <slug>`, when the repo argument is required, and what the ambiguity refusal says

### Build Phase 3: `indusk workbench restore`

- [ ] Add the `indusk workbench` command group with `restore` as its first verb
- [ ] Clone each declared repo missing at `<sibling_parent>/<name>`; skip and name any repo with no `remote`
- [ ] Create or repair each trunk symlink using a relative target, so the workbench stays portable
- [ ] `--worktrees` recreates declared worktrees via the existing `indusk worktree create`
- [ ] Idempotence: re-running reports each repo already present and writes nothing
- [ ] Partial-failure contract — a failed clone names the repo and its remote, the other repos still materialize, and the command exits non-zero
- [ ] Never abort the loop on the first failure; collect and report every failure at the end

#### Build Phase 3 Verification
- [ ] A10, A11, A12 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] A12 specifically asserts the **failure** path: named repo, preserved siblings, non-zero exit — a restore that clones half and exits 0 must be a test failure, not a warning
- [ ] Run `indusk workbench restore` verbatim from the docs against a real clone of the avoca workbench — a library is not shipped until its documented invocation has been run as written
- [ ] Re-run against an already-materialized workbench and diff the tree: zero changes

#### Build Phase 3 Context
- [ ] Add to Conventions: `indusk workbench restore` materializes a cloned workbench; partial failure is loud and non-zero; `init` and `update` never clone

#### Build Phase 3 Document
- [ ] Write `apps/docs/src/reference/cli/workbench.md` — flags, idempotence, the partial-failure contract; add it to the VitePress sidebar (`apps/docs/src/.vitepress/config.ts`, not the stale root scaffold)

### Build Phase 4: What never travels

- [ ] Print the out-of-band set after restore: `env/*.env`, `.indusk/extensions/doppler/.env`, repo-local config, required SSH host aliases
- [ ] Scaffold the root-directory-**whitelist** `.gitignore` — deny by default, directories added explicitly, so an unpredicted worktree directory is untracked by construction
- [ ] Scaffold `.gitattributes` with `merge=union` on `current.md` and `highlights.jsonl`
- [ ] `indusk update` detects declared-but-unmaterialized repos and nudges to `indusk workbench restore` without cloning anything itself

#### Build Phase 4 Verification
- [ ] A15, A8 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] Create a worktree with an unpredicted name, then assert the remote never receives it — the whitelist's whole purpose is the directory nobody listed
- [ ] Drop a stray `.env` at the workbench root and confirm `git status` leaves it untracked
- [ ] `indusk update` on a workbench with a missing repo prints the nudge and performs no network operation

#### Build Phase 4 Context
- [ ] Add to Known Gotchas: the workbench `.gitignore` is a whitelist because worktree directories appear at the root with unpredicted names — a blacklist silently starts tracking the next one

#### Build Phase 4 Document
- [ ] Document the whitelist shape and the out-of-band set in the sharing guide, including why the ignore file is inverted

### Build Phase 5: Keep the refusal

**Goal**: land D8's floor **before** Build Phase 6 makes real workbench roots git repos. The order is the point — fix the detector before creating the condition that fools it.

- [ ] Give verify's entry path a plan root (where `impl.md` lives) and a code root (where the phase's code lives)
- [ ] In a workbench, resolve the code root to the wrapped repo the plan targets
- [ ] Where the code root cannot be determined, **refuse and name what could not be identified** — never fall back to the plan root, because a diff of plan documents is not evidence about code
- [ ] Update `assertGitRepo`'s comment: the refusal no longer holds because the root is not a repo; it holds because this code maintains it
- [ ] Leave `phantom.ts`'s `isMachineState` narrow — do not widen it to paper over the root question

#### Build Phase 5 Verification
- [ ] A17 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] Check off a real implementation item in a git-initialized two-repo workbench, commit the code to the wrapped repo, and confirm **no** phantom finding — the false-positive case that would get the detector disabled
- [ ] Delete the code-root resolution and confirm verification **refuses** rather than reporting clean — an acceptance test cannot detect a detector that stopped checking
- [ ] The existing verify suite passes unchanged for normal-mode projects like dusk

#### Build Phase 5 Context
- [ ] Add to Known Gotchas: detectors take a plan root and a code root and refuse when they cannot tell them apart; `assertGitRepo`'s refusal is now maintained rather than incidental

#### Build Phase 5 Document
- [ ] Update `/decisions/dawn-verify` and the verify reference with the two-root model and the refusal, naming the follow-on that completes the split for Shape and cleanup

### Build Phase 6: The workbench becomes shareable

- [ ] `git init` the workbench root with its own remote during `setup` / `update`, wrapped repo untouched
- [ ] Auto-commit on change with a timestamp message; push immediately; on reject, pull, re-resolve, push again
- [ ] Pull-first on read and mutation paths, including `/catchup`
- [ ] Blind resolution: `merge=union` on the append-shaped files, take-changes elsewhere
- [ ] Add `indusk update` to the mutation chokepoints — POC friction #1 was update mutating tracked files and leaving them to block the next pull; regenerable-file conflicts discard and regenerate
- [ ] Offline: commits always succeed locally, push and pull are best-effort with retry, and nothing ever blocks an agent
- [ ] Make the two-clock skew visible: a pulled phase whose commits have not arrived is distinguishable from one whose have (A16)

#### Build Phase 6 Verification
- [ ] A2, A3, A4, A5, A6, A16 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] A4 and A5 run interleaved often enough to be meaningful, not once — the union-merge dedup was built for rebase noise, not multi-writer logs
- [ ] Remove the bare remote mid-run and confirm agent work continues, then restore it and confirm the backlog arrives with no user action
- [ ] Confirm the wrapped repo has zero new commits after a full sync-loop run — commit siloing is the contract, and this is the check that can fail

#### Build Phase 6 Context
- [ ] Update Current State and add to Conventions: workbench root is a git repo with its own remote; sync is pull-first / auto-commit / push-immediately / blind-resolve; the wrapped repo is never auto-committed

#### Build Phase 6 Document
- [ ] Write `apps/docs/src/guide/workbench-sharing.md` with the topology mermaid diagram (what travels, what does not) and the two-clock skew; add to the sidebar

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
