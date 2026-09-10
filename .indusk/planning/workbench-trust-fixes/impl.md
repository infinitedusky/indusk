---
title: "Workbench Trust Fixes — Implementation"
date: 2026-09-10
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Workbench Trust Fixes — Implementation

## Goal

Every surface the brief names either works correctly in a versioned workbench
or refuses loudly, naming why, and the gate reminder reaches the agent. The
principle throughout: a tool that cannot answer correctly refuses and says
so; it never guesses and never reports the happy case. Brief:
[brief.md](brief.md). Assertions: [test-plan.md](test-plan.md). Evidence:
[research.md](research.md).

The brief's **Phase A** (blocking) is Build Phases 1–5 here; its **Phase B**
(trailing) is Build Phases 6–7. Only Phases 1–5 gate `dawn-workbench-execution`
and Midnight.

## Scope

### In Scope
- Gate-reminder nudge delivered as `hookSpecificOutput.additionalContext`; one
  definition of the phase-start nudge
- `indusk run`, the cleanup file scan, and the eval hook refuse (or resolve
  honestly) at a versioned workbench root
- `workbench restore` clones and reports at the declared path
- Bash worktree scripts, stray-state audit, verify's refusal message,
  `isWorkbench`, and multi-repo worktree config read the declared layout
- The record (CLAUDE.md, docs, code comments, Dawn master) stops asserting the
  root is not a git repo; `workbench-mode-rail-integrity` closed or re-scoped

### Out of Scope
- Making run / verify / eval actually work across the plan-repo / code-repo
  split (`dawn-workbench-execution`, Dawn 6.5). This plan installs refusals;
  that plan lifts them case by case and owns the shared `resolveExecutionRoots`
  and its single-definition pin.
- `indusk init` authoring `repos[]` / `repos_root`
- Multi-repo verify

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `src/__tests__/helpers/versioned-workbench.ts` (git-initialized workbench fixtures: one repo at a declared `path`; two repos), every test file in the trajectory, RED | current hooks, commands, and libs |
| Build Phase 1 | `gate-reminder.js` emitting a stdout JSON envelope; `getPhaseStartNudge` removed | hook harness from Test Phase 1 |
| Build Phase 2 | workbench refusal at `run.ts` entry | `isWorkbench`, `readWorkbenchRepos`, `repoDir` from `lib/worktree/repos.ts` |
| Build Phase 3 | workbench refusal in `listOversizedChangedFiles` | same readers |
| Build Phase 4 | `_hook-paths.js` resolving declared repos by dir and never attributing to the workbench itself; `eval-trigger.js` visible refusal | fixtures; `declaredReposAt` |
| Build Phase 5 | `restoreOne` targeting `repoDir(repo)` | `repoDir` |
| Build Phase 6 | bash siblings on the shared resolver; `isWorkbench` shape rule widened; audit / verify message / multi-repo config by declared path | `_wt_resolve_trunk_dir`, `repoDir` |
| Build Phase 7 | record corrected; `workbench-mode-rail-integrity` closed or re-scoped | grep tests from Test Phase 1 |

## Test Trajectory

Test paths are repo-root-relative (the verify runner's cwd is the repo root).

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | Editing an `impl.md` so a build phase opens with unauthored rows puts a nudge naming those rows on stdout as `hookSpecificOutput.additionalContext`, exit 0 | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/__tests__/gate-reminder-speaks.test.ts |
| A2 | Editing a non-`impl.md` file produces no output from the gate-reminder hook | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/gate-reminder-speaks.test.ts |
| A3 | Exactly one implementation of the phase-start nudge text exists in the package | Test Phase 1 | Build Phase 1 | written | apps/indusk-mcp/src/__tests__/phase-start-nudge-single-definition.test.ts |
| A4 | `indusk run <plan>` at a versioned workbench root exits non-zero before any tool call, names the declared repos and where to run instead, makes no commit, writes no pending-eval record | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/run-refuses-workbench-root.test.ts |
| A5 | `indusk run <plan>` in a flat repo gets past the workbench check unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/run-refuses-workbench-root.test.ts |
| A6 | The cleanup file scan at a versioned workbench root throws naming the workbench shape and its declared repos; it never returns an empty list there | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/lib/cleanup/oversized-workbench-refusal.test.ts |
| A7 | A `git commit` from a cwd at a versioned workbench root is never attributed to the workbench repo: one declared repo resolves to that repo at its declared `path`; several refuse naming the candidates | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A8 | The eval hook's multi-repo refusal reaches the session as `hookSpecificOutput.additionalContext`, not only `system.log` | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A9 | `workbench restore` on a repo declaring `path`: already present → reported present, nothing created; absent → cloned at the declared path; the printed path is the path used; a second run is a no-op | Test Phase 1 | Build Phase 5 | written | apps/indusk-mcp/src/__tests__/workbench-restore-declared-path.test.ts |
| A10 | `worktree create <slug>` and `worktree refresh <slug>` succeed on a workbench whose repo declares `path`, resolving the trunk where `wt` does | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/wt-declared-path-parity.test.ts |
| A11 | `worktree refresh --all` and `worktree preflight` see worktrees in a declared `worktrees/` dir; preflight excludes a trunk at a declared `path` | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/wt-declared-path-parity.test.ts |
| A12 | The stray-state audit inspects each repo at its declared path and reports a stray there | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/stray-state-audit-declared-path.test.ts |
| A13 | `resolveVerifyRoots`'s refusal on nested and sibling layouts names a directory that exists | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/lib/verify/roots.test.ts |
| A14 | A config declaring `repos[]` without `shape: "workbench"` is workbench-shaped to `isWorkbench`, so verify refuses rather than verifying the wrapper repo | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/lib/verify/roots.test.ts |
| A15 | In a multi-repo workbench, `worktree create <repo> <slug>` applies that repo's config, not the first repo's | Build Phase 6 | Build Phase 6 | planned | apps/indusk-mcp/src/__tests__/worktree-multi-repo-config.test.ts |
| A16 | A search for "not a git repo" across CLAUDE.md, `apps/indusk-mcp/skills/`, and `apps/docs/src/` (excluding decisions, lessons, archives, changelog) finds nothing | Test Phase 1 | Build Phase 7 | written | apps/indusk-mcp/src/__tests__/record-not-a-git-repo-grep.test.ts |
| A17 | `guide/index.md`'s stated hook count equals the rows in its own hook table, and the Dawn master's keep/shed record names every hook on disk, including `workbench-sync.js` | Test Phase 1 | Build Phase 7 | written | apps/indusk-mcp/src/__tests__/hooks-record-parity.test.ts |
| A18 | No active plan's `impl.md` names a deleted MCP tool (`mcp__graphiti__*`, `mcp__codegraphcontext__*`) as an acceptance criterion | Test Phase 1 | Build Phase 7 | written | apps/indusk-mcp/src/__tests__/active-plans-no-deleted-tools.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: build the fixture the regression net has never had, a git-initialized
workbench root, and author every row against current behavior so each fails on
its own assertion.

- [x] Confirm this plan's worktree: `dusk-worktrees/workbench-trust-fixes` on `plan/workbench-trust-fixes` (created 2026-09-10; worktree-per-plan default)
- [x] Write `src/__tests__/helpers/versioned-workbench.ts`: `makeVersionedWorkbench({ repos })` creates a temp dir, `git init`s the **root** (README + initial commit), writes `.indusk/config.json` with `worktree.shape: "workbench"` and the declared `repos[]` (each with optional `path`, `worktrees`), `git init`s each repo at `repoDir`, and returns `{ root, repos: { name, dir }[], cleanup }`. Two presets: `oneRepoAtPath()` (repo `alpha` at `path: "code/alpha"`) and `twoRepos()`. Real git, no mocks.
- [x] Author A1 + A2 in `gate-reminder-speaks.test.ts` (three A1 cases: legacy shape, modern Test/Build shape, mid-phase blockers; all red on "the hook wrote nothing to stdout"; A2 green): spawn `hooks/gate-reminder.js` with a PostToolUse Edit event whose `file_path` is a fixture `impl.md` where Build Phase 1 is fully checked and Build Phase 2 has rows `Writable at: Build Phase 2`, state `planned`. A1 expects stdout to parse as JSON with `hookSpecificOutput.additionalContext` containing each row ID; A2 expects empty stdout for a `.ts` path. A1 RED (stdout empty today), A2 green.
- [x] Author A3 in `phase-start-nudge-single-definition.test.ts` (red: carriers are `hooks/gate-reminder.js` and `src/lib/trajectory/state-ops.ts`): grep `apps/indusk-mcp/{hooks,src}` for the literal `opens with these tests to author`; expect exactly one file. RED (two today: the hook and `state-ops.ts`).
- [x] Author A4 + A5 in `run-refuses-workbench-root.test.ts` (A4 red: the run stops at the missing provider key and never names the workbench; A5 green): call `run(root, planName, { model: "claude" })` from `bin/commands/run.ts` with a plan whose `impl.md` sits in the fixture root's `.indusk/planning/`. A4 (workbench fixture): `process.exitCode === 1`, stderr names `code/alpha` and does not mention an API key, root HEAD unchanged, no `.indusk/eval/*.jsonl`. A5 (flat temp repo): the message is the provider-key one, proving the check was passed. A4 RED, A5 green.
- [x] Author A6 in `oversized-workbench-refusal.test.ts` (red: returned `[]` instead of refusing): `listOversizedChangedFiles(fixture.root, "main")` throws; message contains `workbench` and `alpha`. RED (returns `[]`).
- [x] Author A7 + A8 in `eval-trigger-versioned-workbench.test.ts`, on the shared `helpers/hook-runner.ts` (now stdout-capturing, cwd/env-aware) rather than the older test's private runner; the evaluator spawn is neutralized with a PATH holding only node and the system bins. Red: one-repo logs `gitPath: <root>`, two-repo logs no refusal, stdout empty. One-repo fixture: event cwd = root, commit made in `code/alpha`; `system.log` shows `gitPath:` ending in `code/alpha`, never the root. Two-repo fixture: `system.log` shows a refusal naming both repos (A7), and stdout carries `hookSpecificOutput.additionalContext` with the same text (A8). Both RED.
- [x] Author A9 in `workbench-restore-declared-path.test.ts` (red: absent → restore clones at `alpha/` then crashes linking at the declared path whose parent was never made; present → a second copy at `alpha/`): a local bare remote; workbench declaring `alpha` at `path: "code/alpha"` with that remote. Case 1: `code/alpha` already cloned → `workbenchRestore` prints "present", no `alpha/` created beside it. Case 2: absent → clone lands at `code/alpha`, printed path equals it. Case 3: run again → no-op. Explicit 30 s timeout. RED (clones at `alpha/`).
- [x] Author A10 + A11 in `wt-declared-path-parity.test.ts`, spawning the scripts directly the way `wt-trunk-routing.test.ts` does (red: create says `alpha is not a git repo`; refresh reports `SKIP … directory not found`; `--all` never sees `wts/`; preflight finds no worktree). Scripts live at `extensions/worktree/scripts/`, not `hooks/` as the Build Phase 6 items say: spawn `setup-worktree.sh`, `refresh-worktree.sh --all`, `preflight.sh` against a fixture with `path` + `worktrees` declared. RED (name-based `CLIENT_ROOT`).
- [x] Author A12 in `stray-state-audit-declared-path.test.ts` (red: findings `[]`): plant `.indusk/` under `code/alpha`; audit reports it. RED (audits `alpha/`).
- [x] Author A13 + A14 in `src/lib/verify/roots.test.ts` (first tests for the module; red: the suggested dir is `<root>/alpha` on both layouts, and a shapeless `repos[]` config resolves as flat): A13 nested and sibling fixtures, the refusal's suggested directory `existsSync`; A14 config with `repos[]` and no `shape` → `isRefusal`. Both RED.
- [x] A15 is deferred to Build Phase 6 (register below): its subject is the per-repo `post_create` reader that phase exports, and today the reader is private and takes no repo argument, so a test importing it fails to load rather than to assert. Reviewed the carried body against both register questions.
- [x] Author A16 in `record-not-a-git-repo-grep.test.ts` (red: lists every living page and comment still asserting the dead invariant) (scoped like `scm-rip-out-grep.test.ts`, exempting `/decisions/**`, `/lessons/**`, `**/archive/**`, `changelog.md`, `.indusk/planning/**`): zero matches. RED.
- [x] Author A17 in `hooks-record-parity.test.ts` (red: the guide's table lists 4 of 6 hooks; the Dawn master never names `validate-impl-structure`): parse the count in `guide/index.md`'s hooks heading and its table rows; parse hook names in `indusk-v2-dawn/master.md`'s keep/shed text; compare both to `globSync("hooks/*.js")` minus `_`-prefixed modules. RED.
- [x] Author A18 in `active-plans-no-deleted-tools.test.ts` (red: `workbench-mode-rail-integrity: mcp__graphiti__get_episodes`): every `.indusk/planning/*/impl.md` outside `archive/` contains no `mcp__graphiti__` / `mcp__codegraphcontext__`. RED (`workbench-mode-rail-integrity`).

#### Deferred to Build Phase 6

- **A15** — its subject is `readPostCreate(workbenchRoot, repoName)`, the per-repo reader Build Phase 6 introduces by exporting it from `src/bin/commands/worktree.ts`. Today the reader is a private function with no repo argument, so a test importing it fails to *load*, not to assert — an absent test wearing a failure's clothes. The alternative, driving `worktree create beta <slug>` end to end, needs the bash scripts A10 fixes and would go red for A10's reason. Body reviewed:

  ```typescript
  import { readPostCreate } from "../bin/commands/worktree.js";
  import { twoRepos } from "./helpers/versioned-workbench.js";

  // wb.root/.indusk/worktree-configs/alpha.json → { post_create: ["echo alpha"] }
  // wb.root/.indusk/worktree-configs/beta.json  → { post_create: ["echo beta"] }
  const wb = twoRepos();
  expect(readPostCreate(wb.root, "beta")).toEqual(["echo beta"]);
  expect(readPostCreate(wb.root, "alpha")).toEqual(["echo alpha"]);
  ```

#### Regression Guards

- **A2** — the fast path (non-impl edit → silence) works today; the row exists so Build Phase 1's envelope cannot leak onto every edit.
- **A5** — a flat repo passes the workbench check today because there is no check; the row exists so Build Phase 2's refusal cannot fire in normal mode.

#### Test Phase 1 Verification

- [x] (2026-09-10: 23 failed, every one an `AssertionError` on its own expect — none on a missing import or fixture error; 2 passed) A1, A3, A4, A6, A7, A8, A9, A10–A14, A16–A18 authored and RED (A15 deferred, see register): `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/gate-reminder-speaks.test.ts src/__tests__/phase-start-nudge-single-definition.test.ts src/__tests__/run-refuses-workbench-root.test.ts src/lib/cleanup/oversized-workbench-refusal.test.ts src/__tests__/eval-trigger-versioned-workbench.test.ts src/__tests__/workbench-restore-declared-path.test.ts src/__tests__/wt-declared-path-parity.test.ts src/__tests__/stray-state-audit-declared-path.test.ts src/lib/verify/roots.test.ts src/__tests__/record-not-a-git-repo-grep.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/active-plans-no-deleted-tools.test.ts` — expected: every red row fails on its own `expect`, none on a missing import or fixture error (read each failure message, not just the count)
- [x] A2 and A5 green in the same run (the 2 passed)
- [x] `pnpm exec biome check src/__tests__ src/lib/verify src/lib/cleanup` — expected: no errors (this phase's 14 files: clean; the directory carried five pre-existing errors on untouched main, fixed in a separate hygiene commit; 2 warnings remain on deliberate bash `${VAR:-}` strings in `worktree-preflight.test.ts`)

- [x] Shape (Test Phase 1, recorded by hand): reviewed the 14 files this phase wrote — the fixture helper, the hook-runner extension, and twelve test files — against the typescript and testing craft prose. Nothing found: each helper has one job and a name that says what it is for, every test reaches its subject over a boundary (spawned hook, spawned script, real git, the exported function), and the one considered-and-left-alone is `versioned-workbench.ts`'s `git()` runner, which repeats `worktree-fixture.ts`'s private one — cross-file, so `/cleanup`'s, not Shape's. **Discovered gap**: `prepareShapeReview` addresses phases by number and maps 1 to Build Phase 1, so it cannot review a test phase at all ("verification is not green" is Build Phase 1's). The Shape library predates test-phase-structure; follow-on noted in Notes.

#### Test Phase 1 Context

- [x] Add to Known Gotchas: "Tests that need a versioned workbench use `src/__tests__/helpers/versioned-workbench.ts`; a fixture whose root is not `git init`ed reproduces the pre-1.37 shape and cannot see any of the trust-fixes class."

#### Test Phase 1 Document

- [x] `apps/docs/src/changelog.md` Unreleased: "Tests: a git-initialized workbench fixture; the regression net can now see the versioned-workbench shape."

### Build Phase 1: The reminder speaks

- [x] `hooks/gate-reminder.js`: build one `additionalContext` string from the phase-complete message plus `writableAtNudge`, and from the mid-phase blockers message; emit `console.info(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext } }))` on stdout, exit 0. Delete the `_result` shell and the `console.error` calls (the linter allowlist admits `info`; `log` would be swept again). **Also**: the hook's phase model predated test-phase-structure — its private trajectory-row parser read `Build Phase 2` as `NaN` and its "next phase" was `number + 1`, so it could never have nudged a modern impl even with the channel fixed. Rewritten on the shared `_impl-headings.js` (`phaseSequence` / `phaseOrdinal`, document order) and `_trajectory-parser.js`, deleting the private parser copy.
- [x] Rewrite the file's docblock to describe the actual channel and the fast path
- [x] Delete `getPhaseStartNudge` from `src/lib/trajectory/state-ops.ts` and its case in `state-ops.test.ts` (zero production callers; the hook is the one definition because hooks cannot import TS)
- [x] Resync the installed copy: `cp apps/indusk-mcp/hooks/gate-reminder.js .claude/hooks/gate-reminder.js` (hooks are package-owned; parity is byte-equality)

#### Build Phase 1 Verification

- [ ] A1 and A3 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/gate-reminder-speaks.test.ts src/__tests__/phase-start-nudge-single-definition.test.ts src/lib/trajectory/state-ops.test.ts` — expected: all pass
- [ ] A2 still green in the same run
- [ ] Manual smoke in this worktree: edit an `impl.md` to close a phase and confirm the nudge appears in the session as context — expected: the row list is visible in the conversation

#### Build Phase 1 Context

- [ ] Add to Known Gotchas: "PostToolUse hooks: stderr at exit 0 goes to the debug log only; a message for the model is a stdout JSON envelope carrying `hookSpecificOutput.additionalContext`, emitted via `console.info` (on the `noConsole` allowlist). `gate-reminder.js` did neither for its whole life."

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/index.md` hooks table: gate-reminder row says the nudge is delivered as additional context
- [ ] `apps/docs/src/changelog.md` Unreleased: "Fixed: the gate reminder has never reached the model; it now emits `additionalContext`."

### Build Phase 2: `indusk run` refuses at a workbench root

- [ ] `src/bin/commands/run.ts`: after `resolveImplPath` and before the provider-key check, refuse when `isWorkbench(projectRoot)`:
  ```typescript
  if (isWorkbench(projectRoot)) {
  	const dirs = readWorkbenchRepos(projectRoot).map(repoDir);
  	console.error(
  		`${projectRoot} is a workbench: its plan documents and its code (${dirs.join(", ") || "no repos declared"}) live in different repositories, ` +
  			"and this loop takes one root as its whole world — it would commit checkbox edits to the workbench and never reach the code. " +
  			"Refusing. Run inside the repository the plan's code lives in; cross-repo execution is dawn-workbench-execution's.",
  	);
  	process.exitCode = 1;
  	return;
  }
  ```
- [ ] Note in the code that Dawn 6.5 replaces this check with the shared `resolveExecutionRoots`; do not add a second resolver here

#### Build Phase 2 Verification

- [ ] A4 green, A5 still green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/run-refuses-workbench-root.test.ts` — expected: 2 passed
- [ ] `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run` — expected: no regressions

#### Build Phase 2 Context

- [ ] Add to Conventions (the `indusk run` entry): "**Refuses at a workbench root** until Dawn 6.5 lands cross-repo execution — the loop's one root cannot reach the code."

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/run.md`: a "Workbenches" note stating the refusal and pointing at `dawn-workbench-execution`
- [ ] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 3: The cleanup scan refuses at a workbench root

- [ ] `src/lib/cleanup/oversized.ts` `listOversizedChangedFiles`: after the git check, `if (isWorkbench(projectRoot)) throw new Error(...)` naming the declared repo dirs and telling the caller to run against the code repo; fix the docblock that still says the root is "deliberately NOT a git repo"
- [ ] Confirm the `/cleanup` skill's call site surfaces the thrown message rather than swallowing it (grep `apps/indusk-mcp/skills/cleanup.md` and the cleanup lib entry)

#### Build Phase 3 Verification

- [ ] A6 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/cleanup src/lib/shape/gate-interaction.test.ts` — expected: all pass, including the existing flat-repo cases

#### Build Phase 3 Context

- [ ] Update the Known Gotchas cleanup entry: the lib throws on non-git roots **and** refuses workbench roots by declaration; drop "a workbench root is deliberately not a git repo"

#### Build Phase 3 Document

- [ ] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 4: The evaluator finds the declared repo or refuses by name

- [ ] `hooks/_hook-paths.js`: add `declaredRepoDirs(config)` returning `path ?? name` per declared repo (deliberate port of `repoDir` in `src/lib/worktree/repos.ts`; annotate "change both together"); `findGitPathFromWorkbenchConfig` resolves the single declared repo at its dir
- [ ] `hooks/_hook-paths.js` `resolveStateAndGitPaths`: when `gitPath` resolves to the same real path as a workbench-shaped `statePath`, the found repo is the workbench itself — set `gitPath` from the config fallback instead, never the root. Return a third field `refusal: string | null` built from `declaredReposAt` when more than one repo is declared
- [ ] `hooks/eval-trigger.js`: when `refusal` is set, `syslog` it **and** emit `console.info(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: refusal } }))` before exiting 0
- [ ] `src/__tests__/hook-paths.test.ts`: add the git-initialized workbench root fixture (from the helper) so the regression net sees this class from now on
- [ ] Resync the installed copies: `.claude/hooks/_hook-paths.js`, `.claude/hooks/eval-trigger.js`

#### Build Phase 4 Verification

- [ ] A7 and A8 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/eval-trigger-versioned-workbench.test.ts src/__tests__/eval-trigger-workbench-mode.test.ts src/__tests__/hook-paths.test.ts` — expected: all pass
- [ ] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hooks-load-in-cjs-consumer.test.ts src/__tests__/hook-shared-modules.test.ts` — expected: pass (the `_`-module contract holds)

#### Build Phase 4 Context

- [ ] Update the eval-rail Known Gotchas entry: "In a workbench the hook never attributes a commit to the workbench repo; one declared repo resolves at its declared path, several refuse and say so in the session."

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/rail-check.md`: the workbench attribution rule and what a refusal looks like
- [ ] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 5: `workbench restore` clones where everything else looks

- [ ] `src/bin/commands/workbench.ts` `restoreOne`: `const target = join(siblingParent, repoDir(repo))`; `mkdirSync(dirname(target), { recursive: true })` before the clone; the `cloned-unlinked` status line prints `target`, not `${siblingParent}/${repo.name}`
- [ ] Re-read `isNested` against the new `target` and confirm the nested layout (`repos_root: "."`) still detects correctly

#### Build Phase 5 Verification

- [ ] A9 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/workbench-restore-declared-path.test.ts` — expected: 3 cases pass
- [ ] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__ -t "restore"` — expected: existing restore tests pass

#### Build Phase 5 Context

- [ ] Update the `indusk workbench` Conventions entry: restore materializes each repo at `repoDir(repo)` and is idempotent under a declared `path`

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/cli/workbench.md` restore section: declared `path` honored; idempotent
- [ ] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 6: Layout parity and the silent degradations

- [ ] `src/lib/worktree/repos.ts` `isWorkbench`: `shape === "workbench"` **or** at least one declared repo (`repos[]` or legacy `wrapped_repo`); update the docblock. `run`, cleanup, verify inherit the rule through the one reader.
- [ ] `hooks/setup-worktree.sh`, `hooks/refresh-worktree.sh`: resolve `CLIENT_ROOT` via `_wt_resolve_trunk_dir` from `workbench-helpers.sh`; delete the name-based construction
- [ ] `hooks/refresh-worktree.sh` (`--all` and single) and `hooks/preflight.sh`: enumerate worktrees under each declared `worktrees/` dir as well as the root; preflight's reserved list and trunk exclusion come from the shared helper, by resolved path, not name
- [ ] `src/lib/stray-state-audit.ts`: `join(workbenchRoot, repoDir(repo))`
- [ ] `src/lib/verify/roots.ts`: the single-repo refusal suggests `join(planRoot, repoDir(repo))`
- [ ] `src/bin/commands/worktree.ts` post_create: read the config of the repo being created, not `repos[0]`
- [ ] Resync installed bash hooks under `.claude/hooks/`

#### Build Phase 6 Verification

- [ ] A10–A15 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/wt-declared-path-parity.test.ts src/__tests__/wt-trunk-routing.test.ts src/__tests__/stray-state-audit-declared-path.test.ts src/lib/verify/roots.test.ts src/__tests__/worktree-multi-repo-config.test.ts` — expected: all pass
- [ ] Full package suite: `cd apps/indusk-mcp && pnpm test` — expected: green (the `isWorkbench` widening touches every reader)

#### Build Phase 6 Context

- [ ] Update the "Workbench topology is DECLARED" Conventions entry: `isWorkbench` is true for any config declaring repos, with or without `shape`; the three bash scripts share `_wt_resolve_trunk_dir`

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/cli/workbench.md` worktree section: declared `path` / `worktrees` honored by create, refresh, preflight
- [ ] `apps/docs/src/reference/cli/verify.md`: refusal message wording
- [ ] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 7: The record says the truth

- [ ] CLAUDE.md: remove every "the workbench root is deliberately not a git repo" claim (multi-agent coordination, agent-list, cleanup gotchas); the versioned-workbench entry is the one statement of the shape
- [ ] Docs carrying the dead invariant: `guide/multi-agent.md`, `guide/worktree-setup.md`, `reference/cli/setup.md`, `reference/cli/agent.md`, `reference/cli/verify.md`, `guide/rail-check.md`; and `apps/indusk-mcp/skills/cleanup.md` (resync `.claude/skills/cleanup/SKILL.md`)
- [ ] Code comments: `hooks/_hook-paths.js`, `hooks/eval-trigger.js`, `src/lib/cleanup/oversized.ts`
- [ ] `indusk-v2-dawn/master.md`: hook inventory is six, `workbench-sync.js` recorded as **shed** (sync cadence is a procedure, not an invariant gate); component 6's "runs on every tier" qualified until 6.5
- [ ] `apps/docs/src/guide/index.md`: hook count matches its table
- [ ] `workbench-mode-rail-integrity`: archive it (its Phases 1–4 shipped in 1.31.7–1.31.10; H2's premise is false since 1.37.0; U1's criterion names a deleted tool) with a one-paragraph closing note in its impl frontmatter, or re-scope with a runnable criterion — decide in the item, record which

#### Build Phase 7 Verification

- [ ] A16, A17, A18 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/record-not-a-git-repo-grep.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/active-plans-no-deleted-tools.test.ts` — expected: all pass
- [ ] `indusk context check-pointers` — expected: every CLAUDE.md pointer resolves

#### Build Phase 7 Context

- [ ] CLAUDE.md Current State: workbench-mode-rail-integrity's line reflects its close or re-scope; the versioned-workbench entry notes the trust-fixes close

#### Build Phase 7 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: the record corrections, in one entry
- [ ] Root `master.md` Stream 1 row and Day master component 1: status updated at close

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/__tests__/helpers/versioned-workbench.ts` | new: git-initialized workbench fixtures |
| `apps/indusk-mcp/hooks/gate-reminder.js` | stdout JSON envelope via `console.info`; docblock |
| `apps/indusk-mcp/src/lib/trajectory/state-ops.ts` | remove `getPhaseStartNudge` |
| `apps/indusk-mcp/src/bin/commands/run.ts` | workbench refusal at entry |
| `apps/indusk-mcp/src/lib/cleanup/oversized.ts` | workbench refusal; docblock |
| `apps/indusk-mcp/hooks/_hook-paths.js` | `declaredRepoDirs`; never attribute to the workbench; `refusal` |
| `apps/indusk-mcp/hooks/eval-trigger.js` | visible refusal |
| `apps/indusk-mcp/src/bin/commands/workbench.ts` | restore clones at `repoDir` |
| `apps/indusk-mcp/src/lib/worktree/repos.ts` | `isWorkbench` shape rule |
| `apps/indusk-mcp/hooks/{setup-worktree,refresh-worktree,preflight}.sh` | shared trunk resolver; declared worktrees dirs |
| `apps/indusk-mcp/src/lib/stray-state-audit.ts`, `src/lib/verify/roots.ts`, `src/bin/commands/worktree.ts` | declared path |
| `.claude/hooks/*`, `.claude/skills/cleanup/SKILL.md` | resynced installed copies |
| `CLAUDE.md`, `apps/docs/src/**`, `indusk-v2-dawn/master.md` | record corrections |
| `.indusk/planning/workbench-mode-rail-integrity/` | closed or re-scoped |

## Dependencies

- None. 1.42.0's `_wt_resolve_trunk_dir` is the pattern Build Phase 6 ports.

## Notes

- Refusals installed here are lifted case by case by `dawn-workbench-execution`
  (Dawn 6.5), which also owns the shared `resolveExecutionRoots` and its
  single-definition pin. This plan deliberately uses the existing readers
  (`isWorkbench`, `readWorkbenchRepos`, `repoDir`) at each surface rather than
  writing a resolver 6.5 would then have to replace.
- Whether a refused model ticks a checkbox anyway (brief, item 1) is not a
  claim of this plan and has no row; the refusal at entry makes the question
  moot in a workbench.
- Build Phase 7's `workbench-mode-rail-integrity` item makes a decision inside
  the checklist. Record the choice in that item's checkoff text.
- **Follow-on found in Test Phase 1**: the Shape library (`lib/shape/`) has no
  notion of a test phase — `prepareShapeReview({ phase: 1 })` means Build
  Phase 1, so a test phase's craft review cannot be scoped or recorded by the
  library and was done by hand here. Same class as the admin UI's private
  phase regex (admin-ui-phase-progress): a reader that predates
  test-phase-structure. Not this plan's; belongs with the next Shape change.
