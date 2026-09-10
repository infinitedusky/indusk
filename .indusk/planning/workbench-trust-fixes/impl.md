---
title: "Workbench Trust Fixes — Implementation"
date: 2026-09-10
status: completed
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
| A4 | `indusk run <plan>` at a versioned workbench root exits non-zero before any tool call, names the declared repos and where to run instead, makes no commit, writes no pending-eval record | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/run-refuses-workbench-root.test.ts |
| A5 | `indusk run <plan>` in a flat repo gets past the workbench check unchanged | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/run-refuses-workbench-root.test.ts |
| A6 | The cleanup file scan at a versioned workbench root throws naming the workbench shape and its declared repos; it never returns an empty list there | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/lib/cleanup/oversized-workbench-refusal.test.ts |
| A7 | A `git commit` from a cwd at a versioned workbench root is never attributed to the workbench repo: one declared repo resolves to that repo at its declared `path`; several refuse naming the candidates | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A8 | The eval hook's multi-repo refusal reaches the session as `hookSpecificOutput.additionalContext`, not only `system.log` | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A9 | `workbench restore` on a repo declaring `path`: already present → reported present, nothing created; absent → cloned at the declared path; the printed path is the path used; a second run is a no-op | Test Phase 1 | Build Phase 5 | passing | apps/indusk-mcp/src/__tests__/workbench-restore-declared-path.test.ts |
| A10 | `worktree create <slug>` and `worktree refresh <slug>` succeed on a workbench whose repo declares `path`, resolving the trunk where `wt` does | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/wt-declared-path-parity.test.ts |
| A11 | `worktree refresh --all` and `worktree preflight` see worktrees in a declared `worktrees/` dir; preflight excludes a trunk at a declared `path` | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/wt-declared-path-parity.test.ts |
| A12 | The stray-state audit inspects each repo at its declared path and reports a stray there | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/stray-state-audit-declared-path.test.ts |
| A13 | `resolveVerifyRoots`'s refusal on nested and sibling layouts names a directory that exists | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/lib/verify/roots.test.ts |
| A14 | A config declaring `repos[]` without `shape: "workbench"` is workbench-shaped to `isWorkbench`, so verify refuses rather than verifying the wrapper repo | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/lib/verify/roots.test.ts |
| A15 | In a multi-repo workbench, `worktree create <repo> <slug>` applies that repo's config, not the first repo's | Build Phase 6 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/worktree-multi-repo-config.test.ts |
| A16 | A search for "not a git repo" across CLAUDE.md, `apps/indusk-mcp/skills/`, and `apps/docs/src/` (excluding decisions, lessons, archives, changelog) finds nothing | Test Phase 1 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/record-not-a-git-repo-grep.test.ts |
| A17 | `guide/index.md`'s stated hook count equals the rows in its own hook table, and the Dawn master's keep/shed record names every hook on disk, including `workbench-sync.js` | Test Phase 1 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/hooks-record-parity.test.ts |
| A18 | No active plan's `impl.md` names a deleted MCP tool (`mcp__graphiti__*`, `mcp__codegraphcontext__*`) as an acceptance criterion | Test Phase 1 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/active-plans-no-deleted-tools.test.ts |
| A19 | While a build phase is in progress (some items checked), the reminder names that phase's rows still blocking its close and does not repeat that the previous phase is complete | Phase 0 | Phase 8 | passing | apps/indusk-mcp/src/__tests__/gate-reminder-speaks.test.ts |
| A20 | A commit made to the workbench repo itself (plan documents) from a root cwd with one declared repo is attributed to the workbench, not to the code repo's unrelated HEAD; a commit made to the code repo from the same cwd is attributed to the code repo | Phase 0 | Phase 8 | passing | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A21 | In CLI mode (`--source`) at a multi-repo root, the eval hook logs the refusal and prints no JSON envelope to the terminal | Phase 0 | Phase 8 | passing | apps/indusk-mcp/src/__tests__/eval-trigger-versioned-workbench.test.ts |
| A22 | `workbench restore` on a sibling layout with a multi-segment declared `path` clones, links the trunk (creating the link's parent), reports it, and is idempotent — never crashes | Phase 0 | Phase 8 | passing | apps/indusk-mcp/src/__tests__/workbench-restore-declared-path.test.ts |
| A23 | `refresh --all` never treats a declared `worktrees` dir itself, or the first segment of a declared repo `path`, as a worktree candidate | Phase 0 | Phase 8 | passing | apps/indusk-mcp/src/__tests__/wt-declared-path-parity.test.ts |
| A24 | Exactly one phase-and-checkbox-item walk exists under `hooks/` (`_impl-phases.js`), pinned by count; `check-gates.js` and `gate-reminder.js` both import it rather than carrying a copy | Phase 0 | Phase 9 | passing | apps/indusk-mcp/src/__tests__/hook-shared-modules.test.ts |

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
- [x] Author A18 in `active-plans-no-deleted-tools.test.ts` (red: `workbench-mode-rail-integrity` names the deleted Graphiti episodes tool — and, once authored, this impl's own checkoff text did too, which the scan rightly caught): every `.indusk/planning/*/impl.md` outside `archive/` contains no `mcp__graphiti__` / `mcp__codegraphcontext__`. RED (`workbench-mode-rail-integrity`).

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
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`prepareShapeReview` scoped 26 files because the phase-1 boundary predates Test Phase 1; the test files were judged there. This phase's code is `gate-reminder.js` and the `state-ops.ts` deletion: one concern per file, names say what they are for, reached over the process boundary. All rule sets readable.)

#### Build Phase 1 Verification

- [x] A1 and A3 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/gate-reminder-speaks.test.ts src/__tests__/phase-start-nudge-single-definition.test.ts src/lib/trajectory/state-ops.test.ts` — expected: all pass (2026-09-10: 43 passed, 2 skipped across these plus `hook-shared-modules` and `hooks-load-in-cjs-consumer`)
- [x] A2 still green in the same run
- [x] Manual smoke in this worktree: edit an `impl.md` to close a phase and confirm the nudge appears in the session as context — expected: the row list is visible in the conversation. **Done as a scripted smoke against this plan's own impl.md** (Test Phase 1 just closed): the hook emitted `hookEventName: PostToolUse` with `additionalContext` = "Test Phase 1 (Author every assertion, RED) is fully complete. Call advance_plan to validate gates before starting Build Phase 1." — no tests-to-author line, correctly, since no row opens at Build Phase 1. **Then confirmed in-session**: on the very next Edit to this impl.md, the session showed "PostToolUse:Edit hook additional context: Test Phase 1 (Author every assertion, RED) is fully complete. Call advance_plan …" — the worktree's `.claude/hooks/` copy is what fires here, and the nudge is now heard.

#### Build Phase 1 Context

- [x] Add to Known Gotchas: "PostToolUse hooks: stderr at exit 0 goes to the debug log only; a message for the model is a stdout JSON envelope carrying `hookSpecificOutput.additionalContext`, emitted via `console.info` (on the `noConsole` allowlist). `gate-reminder.js` did neither for its whole life."

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/index.md` hooks table: gate-reminder row says the nudge is delivered as additional context (row added; the header's count and the other missing rows are A17's, Build Phase 7)
- [x] `apps/docs/src/changelog.md` Unreleased: "Fixed: the gate reminder has never reached the model; it now emits `additionalContext`."

### Build Phase 2: `indusk run` refuses at a workbench root

- [x] `src/bin/commands/run.ts`: after `resolveImplPath` and before the provider-key check, refuse when `isWorkbench(projectRoot)`:
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
- [x] Note in the code that Dawn 6.5 replaces this check with the shared `resolveExecutionRoots`; do not add a second resolver here
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`run.ts` only, plus docs: the refusal is one more guard in `run()`'s existing sequence of guards, reads the shape through the one reader, and has a test over the command boundary. All rule sets readable.)

#### Build Phase 2 Verification

- [x] A4 green, A5 still green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/run-refuses-workbench-root.test.ts` — expected: 2 passed (2026-09-10: 2 passed)
- [x] `cd apps/indusk-mcp && pnpm exec vitest run src/lib/run` — expected: no regressions (16 files, 73 passed)

#### Build Phase 2 Context

- [x] Add to Conventions (the `indusk run` entry): "**Refuses at a workbench root** until Dawn 6.5 lands cross-repo execution — the loop's one root cannot reach the code."

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/run.md`: a "Workbenches" note stating the refusal and pointing at `dawn-workbench-execution`
- [x] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 3: The cleanup scan refuses at a workbench root

- [x] `src/lib/cleanup/oversized.ts` `listOversizedChangedFiles`: after the git check, `if (isWorkbench(projectRoot)) throw new Error(...)` naming the declared repo dirs and telling the caller to run against the code repo; fix the docblock that still says the root is "deliberately NOT a git repo"
- [x] Confirm the `/cleanup` skill's call site surfaces the thrown message rather than swallowing it (grep `apps/indusk-mcp/skills/cleanup.md` and the cleanup lib entry) — no TypeScript caller exists; the skill invokes the function through `tsx`, so a throw is a script failure the agent sees. The skill's "workbench caveat" sentence asserted the dead invariant; corrected here (and resynced to `.claude/skills/cleanup/SKILL.md`), which retires that entry from Build Phase 7's list.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`oversized.ts`: a second guard beside the first, same shape, message built where it is thrown; the skill prose and CLAUDE.md are not code. All rule sets readable.)

#### Build Phase 3 Verification

- [x] A6 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/cleanup src/lib/shape/gate-interaction.test.ts` — expected: all pass, including the existing flat-repo cases (2026-09-10: 2 files, 5 passed)

#### Build Phase 3 Context

- [x] Update the Known Gotchas cleanup entry: the lib throws on non-git roots **and** refuses workbench roots by declaration; drop "a workbench root is deliberately not a git repo"

#### Build Phase 3 Document

- [x] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 4: The evaluator finds the declared repo or refuses by name

- [x] `hooks/_hook-paths.js`: add `declaredRepoDirs(config)` returning `path ?? name` per declared repo (deliberate port of `repoDir` in `src/lib/worktree/repos.ts`; annotate "change both together"); `findGitPathFromWorkbenchConfig` resolves the single declared repo at its dir — shipped as `declaredRepos(config)` → `{ name, dir }[]` with `declaredRepoNames` derived from it (one loop, not two), plus a `usableRelPath` port for the declared `path`
- [x] `hooks/_hook-paths.js` `resolveStateAndGitPaths`: when `gitPath` resolves to the same real path as a workbench-shaped `statePath`, the found repo is the workbench itself — set `gitPath` from the config fallback instead, never the root. Return a third field `refusal: string | null` built from `declaredReposAt` when more than one repo is declared
- [x] `hooks/eval-trigger.js`: when `refusal` is set, `syslog` it **and** emit `console.info(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: refusal } }))` before exiting 0 (placed in the no-change-id branch, after the eval-enabled check, so a project with eval off gets no attribution noise)
- [x] `src/__tests__/hook-paths.test.ts`: add the git-initialized workbench root fixture (from the helper) so the regression net sees this class from now on — three cases: root cwd with one repo at a path, cwd inside the nested repo, two repos
- [x] Resync the installed copies: `.claude/hooks/_hook-paths.js`, `.claude/hooks/eval-trigger.js`
- [x] Discovered: both hooks' comments still asserted "workbench root, NOT a git repo" (`_hook-paths.js` header, `eval-trigger.js` change-id comment) — rewritten as history here, retiring those two entries from Build Phase 7's code-comment list; the `oversized.ts` comment was retired in Build Phase 3
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`_hook-paths.js`: the resolver keeps one job, resolve two paths, with the discard rule and refusal composed in place and two small named helpers, `usableRelPath` and `samePath`; `eval-trigger.js`: the refusal branch sits in the existing no-change-id block; the test reaches the helper by dynamic import, as its siblings do. All rule sets readable.)

#### Build Phase 4 Verification

- [x] A7 and A8 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/eval-trigger-versioned-workbench.test.ts src/__tests__/eval-trigger-workbench-mode.test.ts src/__tests__/hook-paths.test.ts` — expected: all pass (2026-09-10: 3 files, 15 passed)
- [x] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hooks-load-in-cjs-consumer.test.ts src/__tests__/hook-shared-modules.test.ts` — expected: pass (the `_`-module contract holds) (2 passed, 2 skipped — the cjs-consumer file skips without a built `dist/`)

#### Build Phase 4 Context

- [x] Update the eval-rail Known Gotchas entry: "In a workbench the hook never attributes a commit to the workbench repo; one declared repo resolves at its declared path, several refuse and say so in the session."

#### Build Phase 4 Document

- [x] `apps/docs/src/guide/rail-check.md`: the workbench attribution rule and what a refusal looks like (new section; the page's "NOT a git repo" line is now history, retiring it from Build Phase 7's docs list)
- [x] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 5: `workbench restore` clones where everything else looks

- [x] `src/bin/commands/workbench.ts` `restoreOne`: `const target = join(siblingParent, repoDir(repo))`; `mkdirSync(dirname(target), { recursive: true })` before the clone; the `cloned-unlinked` status line prints `target`, not `${siblingParent}/${repo.name}` (the `cloned` line printed only the sibling parent — fixed to the same path)
- [x] Re-read `isNested` against the new `target` and confirm the nested layout (`repos_root: "."`) still detects correctly — with `siblingParent === workbenchRoot` the new target *is* `join(workbenchRoot, repoDir(repo))`, so `isNested` is true by construction there; A9's nested fixture exercises exactly this and reports `present in the workbench at code/alpha/`
- [x] Shape (`apps/indusk-mcp/src/bin/commands/workbench.ts`) — name the clone target: `join(siblingParent, repoDir(repo))` is written three times (restoreOne + two restoreLine cases); one `cloneTarget(repo, siblingParent)` says what it is and cannot drift. Rule: typescript — a repeated expression that means one thing gets one name. **Fixed in this phase**: `cloneTarget` extracted, three call sites, A9 and the restore suite green after. All rule sets readable.

#### Build Phase 5 Verification

- [x] A9 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/workbench-restore-declared-path.test.ts` — expected: 3 cases pass (2026-09-10: authored as 2 `it`s covering the three cases — absent; present + second run — both pass)
- [x] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__ -t "restore"` — expected: existing restore tests pass (7 passed)

#### Build Phase 5 Context

- [x] Update the `indusk workbench` Conventions entry: restore materializes each repo at `repoDir(repo)` and is idempotent under a declared `path`

#### Build Phase 5 Document

- [x] `apps/docs/src/reference/cli/workbench.md` restore section: declared `path` honored; idempotent
- [x] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 6: Layout parity and the silent degradations

- [x] `src/lib/worktree/repos.ts` `isWorkbench`: `shape === "workbench"` **or** at least one declared repo (`repos[]` or legacy `wrapped_repo`); update the docblock. `run`, cleanup, verify inherit the rule through the one reader. (Seven callers audited: `workbench.ts` ×2 and `worktree.ts` ×2 already pair it with `repos.length`, the rest are this plan's refusals.)
- [x] `extensions/worktree/scripts/setup-worktree.sh`, `refresh-worktree.sh` (the scripts live under the extension, not `hooks/`): resolve `CLIENT_ROOT` via `_wt_resolve_trunk_dir` from `workbench-helpers.sh`; delete the name-based construction. **Also**: `_wt_resolve_trunk_dir` itself looked at `<repos_root>/<name>` as its second candidate — fixed to `<repos_root>/<path-or-name>`, so `wt` gains the sibling-plus-`path` case too; and setup-worktree.sh now reads the declared `worktrees` dir itself (`_wt_declared_worktrees_dir`) when run without the TS wrapper's `--worktrees-dir`
- [x] `refresh-worktree.sh` (`--all` and single) and `preflight.sh`: enumerate worktrees under each declared `worktrees/` dir as well as the root; preflight's reserved list and trunk exclusion come from the shared helper, by resolved path, not name. Single-slug refresh and preflight both go through `_wt_resolve_target` (one resolution surface); `--all` iterates a new `_wt_list_worktree_dirs`; preflight's private scan and reserved list are deleted; a slug that resolves to nothing is now an error rather than a `SKIP` at exit 0
- [x] `src/lib/stray-state-audit.ts`: `join(workbenchRoot, repoDir(repo))`
- [x] `src/lib/verify/roots.ts`: the single-repo refusal suggests `join(planRoot, repoDir(repo))` — shipped as `join(resolveReposRoot(planRoot), repoDir(repo))`: under `planRoot` alone the sibling layout's checkout does not exist either (A13's sibling case), and `resolveReposRoot` is the one definition of where checkouts live
- [x] `src/bin/commands/worktree.ts` post_create: read the config of the repo being created, not `repos[0]` — `readPostCreate(workbenchRoot, repo)` exported; A15 authored from the register body and green
- [x] Resync installed bash hooks under `.claude/hooks/` — nothing to resync: the worktree scripts are run from the package directory (`indusKMcpPackageRoot()`), never copied under `.claude/`; only the `*.js` hooks are installed
- [x] Shape (`apps/indusk-mcp/extensions/worktree/scripts/lib/workbench-helpers.sh`) — reviewed, left as-is: the new _wt_list_worktree_dirs scans the root + declared worktrees dirs the way _wt_resolve_target already does; the resolver needs per-entry repo attribution for qualifier filtering, so folding it onto the list helper means changing the resolver every wt caller depends on — two scans in one file, not yet three, left for /cleanup with the inter-file view
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (TS: `isWorkbench` is two lines with one rule; `readPostCreate` takes the repo it reads for; the audit and the refusal each swap one expression. All rule sets readable.)

#### Build Phase 6 Verification

- [x] A10–A15 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/wt-declared-path-parity.test.ts src/__tests__/wt-trunk-routing.test.ts src/__tests__/stray-state-audit-declared-path.test.ts src/lib/verify/roots.test.ts src/__tests__/worktree-multi-repo-config.test.ts` — expected: all pass (2026-09-10: 5 files, 18 passed)
- [x] Full package suite: `cd apps/indusk-mcp && pnpm test` — expected: green (the `isWorkbench` widening touches every reader). **Result: 1214 passed, 5 skipped, 4 failed — the four are A16, A17 (×2) and A18, red by design until Build Phase 7.** Two things the run surfaced: (1) a fresh worktree needs `pnpm build` *and* `pnpm --filter indusk-admin build && node scripts/bundle-admin.js` before its suite matches main's — without them 150 tests skip and 9 fail for environment reasons (the lesson on file; main was green throughout, checked); (2) two existing tests encoded the rules this phase replaced and were updated with the reason in a comment: `worktree-preflight.test.ts` expected the private scan's exact wording (now the shared resolver's, which also lists trunks), and `worktree-cli.test.ts`'s "non-workbench" fixture only dropped `shape` while keeping `wrapped_repo` — which A14 says IS a workbench — so it now drops the whole `worktree` key.

#### Build Phase 6 Context

- [x] Update the "Workbench topology is DECLARED" Conventions entry: `isWorkbench` is true for any config declaring repos, with or without `shape`; the three bash scripts share `_wt_resolve_trunk_dir`

#### Build Phase 6 Document

- [x] `apps/docs/src/reference/cli/workbench.md` worktree section: declared `path` / `worktrees` honored by create, refresh, preflight
- [x] `apps/docs/src/reference/cli/verify.md`: refusal message wording (and its "deliberately not a git repo" line is now the declaration-based refusal, retiring that page from Build Phase 7's list)
- [x] `apps/docs/src/changelog.md` Unreleased entry

### Build Phase 7: The record says the truth

- [x] CLAUDE.md: remove every "the workbench root is deliberately not a git repo" claim (multi-agent coordination, agent-list, cleanup gotchas); the versioned-workbench entry is the one statement of the shape — the multi-agent lock sentence now says what the lock is for (concurrent processes on one machine; `merge=union` across machines), the agent-list sentence says a fresh root has no history until its first sync/restore, the cleanup gotcha was rewritten in Build Phase 3
- [x] Docs carrying the dead invariant: `guide/multi-agent.md`, `guide/worktree-setup.md`, `reference/cli/setup.md`, `reference/cli/agent.md`, `reference/cli/verify.md`, `guide/rail-check.md`; and `apps/indusk-mcp/skills/cleanup.md` (resync `.claude/skills/cleanup/SKILL.md`) — multi-agent, worktree-setup, setup rewritten here (the setup pages now say the root gains its history on first sync/restore, which is the true reason the benign warning still prints); `guide/cleanup-ritual.md` found by A16 and rewritten too; `agent.md` had no such line left; verify.md (Build Phase 6), rail-check.md (Build Phase 4) and the cleanup skill (Build Phase 3) were done in their phases
- [x] Code comments: `hooks/_hook-paths.js`, `hooks/eval-trigger.js`, `src/lib/cleanup/oversized.ts` — done in Build Phases 3 and 4; A16 also found `src/bin/commands/agent.ts` and `src/lib/eval/evaluator-runner.ts`, rewritten here. **A16 itself was refined**: the first pattern (`/not a git repo/i`) flagged runtime messages about arbitrary directories, quoted errors, and history, and matched "repository" through "repo"; it now targets present-tense claims about the workbench root (all-caps emphasis; "the/workbench root … is … not a git repo"; "deliberately/intentionally not a git repo" unless "was …", tolerant of a comment line wrap) with `\b` word boundaries, and its exemption check tests paths both bare and with a trailing slash — the `$`-anchored `changelog.md` exemption never matched before
- [x] `indusk-v2-dawn/master.md`: hook inventory is six, `workbench-sync.js` recorded as **shed** (sync cadence is a procedure, not an invariant gate); component 6's "runs on every tier" qualified until 6.5 — the shed classification and the "proven in flat repos; refuses in every workbench" qualification were already recorded on 2026-09-03; what was missing was any naming of `validate-impl-structure`, so the cell now carries the full six-hook keep/shed record A17 pins
- [x] `apps/docs/src/guide/index.md`: hook count matches its table — "Six hooks ship" with all six rows (three PreToolUse gates, three PostToolUse), `eval-trigger` added
- [x] `workbench-mode-rail-integrity`: archive it (its Phases 1–4 shipped in 1.31.7–1.31.10; H2's premise is false since 1.37.0; U1's criterion names a deleted tool) with a one-paragraph closing note in its impl frontmatter, or re-scope with a runnable criterion — decide in the item, record which. **Decision: archived.** Frontmatter `status: abandoned` with `closed: 2026-09-10` and a `closed_reason` saying what shipped, why Phase 5 became impossible (Graphiti deleted), why H2's premise is false, and where the mis-attribution it hid was fixed (this plan's Build Phase 4); moved to `planning/archive/`; root master roadmap and CLAUDE.md Current State updated. **Discovered by A18 and done the same way**: `graph-knowledge-architecture` (parked, written against the rejected Graphiti direction, impl naming two Graphiti tools) archived; root master's parked note and CLAUDE.md's direction note updated; `cursor-support` stays parked (it names no deleted tool)
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (Code this phase touched: two comment rewrites, the fixture docblock, and the A16 test, whose three patterns are named and explained in one place. All rule sets readable.)

#### Build Phase 7 Verification

- [x] A16, A17, A18 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/record-not-a-git-repo-grep.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/active-plans-no-deleted-tools.test.ts` — expected: all pass (2026-09-10: 4 passed; full package suite 1218 passed, 5 skipped, 0 failed)
- [x] `indusk context check-pointers` — expected: every CLAUDE.md pointer resolves (57 scanned, PASS)

#### Build Phase 7 Context

- [x] CLAUDE.md Current State: workbench-mode-rail-integrity's line reflects its close or re-scope; the versioned-workbench entry notes the trust-fixes close

#### Build Phase 7 Document

- [x] `apps/docs/src/changelog.md` Unreleased: the record corrections, in one entry
- [x] Root `master.md` Stream 1 row and Day master component 1: status updated at close

### Phase 8: Falsification — what the fixes assumed about where commits, links and worktrees live

**Goal**: verify whether the attested state holds against five specific failure modes found by re-reading the code this plan wrote: a reminder that keeps announcing the previous phase after the next one has started; an evaluator that, having stopped scoring the workbench repo, now scores the code repo's unrelated HEAD when the commit went to the workbench; a refusal envelope printed to a terminal in CLI mode; a trunk link whose parent directory nobody creates on a sibling layout with a two-segment path; and a worktree scan that lists the declared worktrees dir itself as a candidate. Each trajectory row captures one hypothesis; each checklist item captures the fix if it confirms. Discarded after investigation: "the widened `isWorkbench` misclassifies a flat project carrying a stray `wrapped_repo`" — only the workbench init path ever writes that key.

- [x] All five rows authored first and observed red on their own assertions (A19 transition nudge fired; A20 `gitPath` = code repo; A21 envelope on stdout; A22 restore refused, then crashed; A23 `SKIP: code`, `SKIP: wts`). Two helper extensions to reach them: `hook-runner` accepts `args` (CLI mode), `versioned-workbench`'s `commitFile` accepts an env (commit dates). One fixture correction: the sibling layout now declares `repos_root` absolutely, as real configs do — restore refuses a relative `..`
- [x] `hooks/gate-reminder.js`: "the next phase has not started" means it has **zero checked items**, not "has unchecked items"; when the next phase has started, skip the transition nudge so the mid-phase blockers nudge for the in-progress phase is what gets delivered (A19 — observed in this session: "Build Phase 3 is fully complete… before starting Build Phase 4" repeated on every edit while Build Phase 4 was half done). Resync `.claude/hooks/gate-reminder.js`
- [x] `hooks/_hook-paths.js` `resolveStateAndGitPaths`: when the git root found IS the workbench and exactly one repo is declared, the commit may have gone to either repository — attribute to whichever of the workbench root and the declared repo has the **newer HEAD commit** (`git log -1 --format=%ct`); on a tie or a missing code repo prefer the code repo (the 1.31.10 behavior); record the choice in the returned object so `eval-trigger.js` logs it (A20). This corrects A7's over-claim: the invariant is "a commit is attributed to the repository that received it", not "never the workbench" — shipped as a fourth returned field `attribution`, appended to the hook's `statePath:/gitPath:` log line; a declared repo missing from disk attributes to the workbench, the only repository that exists
- [x] `hooks/eval-trigger.js`: emit the refusal envelope only in hook mode (`cliSource === null && !drainPending`); CLI and drain modes syslog the refusal and exit 0 silently (A21). Resync `.claude/hooks/eval-trigger.js` and `_hook-paths.js`
- [x] `src/lib/worktree/layout.ts` `linkTrunk`: `mkdirSync(dirname(link), { recursive: true })` before `symlinkSync` — the one primitive every caller shares, so restore, setup and worktree all gain it (A22). **Second defect on the same path, found while fixing**: `rel` was `relative(workbenchRoot, target)`, but a symlink's relative target resolves from the link's own directory, so a link at `code/alpha` pointed at itself; now `relative(dirname(link), target)`. A22 asserts the link resolves to the clone, which is what caught it
- [x] `extensions/worktree/scripts/lib/workbench-helpers.sh` `_wt_list_worktree_dirs`: skip a root entry that is a declared `worktrees` dir or the first segment of a declared repo `path` (A23)
- [x] Shape (`apps/indusk-mcp/hooks/_hook-paths.js`) — name the rule: "which repository received a root-cwd commit" was three inline branches inside `resolveStateAndGitPaths`; `attributeRootCommit(workbenchRoot, codeRepo)` says what it decides and gives the tie-break a home. Rule: typescript — a decision with its own reason to change gets its own function. **Fixed in this phase**; the eval and hook-paths suites green after. Everything else this phase touched is a one-line condition, a guard, or a test. All rule sets readable.

#### Phase 8 Verification
- [x] A19: mid-phase modern fixture (Build Phase 1 half checked) — `additionalContext` names Build Phase 1's blocking rows and does not contain "Test Phase 1 … fully complete": `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/gate-reminder-speaks.test.ts` — expected: all pass, A1/A2 included (2026-09-10: 5 passed)
- [x] A20 + A21: one-repo fixture, commit to the root then run the hook → `system.log` shows `gitPath: <root>`; commit to `code/alpha` then run → `gitPath: <code/alpha>`; two-repo fixture with `--source handoff` → stdout empty, refusal in `system.log`: `pnpm exec vitest run src/__tests__/eval-trigger-versioned-workbench.test.ts src/__tests__/hook-paths.test.ts src/__tests__/eval-trigger-workbench-mode.test.ts` — expected: all pass (all pass, in the 50-test run across nine files)
- [x] A22: sibling layout, repo `alpha` at `path: "code/alpha"` with a local bare remote: restore exits 0, `<repos_root>/code/alpha/.git` exists, `<workbench>/code/alpha` is a symlink to it, second run reports present: `pnpm exec vitest run src/__tests__/workbench-restore-declared-path.test.ts` — expected: all pass, 30 s timeout (3 passed)
- [x] A23: fixture with `worktrees: "wts"` and `path: "code/alpha"`: `refresh --all` output has no `SKIP: wts` and no `SKIP: code` line: `pnpm exec vitest run src/__tests__/wt-declared-path-parity.test.ts src/__tests__/wt-trunk-routing.test.ts src/__tests__/worktree-preflight.test.ts` — expected: all pass (all pass)
- [x] Full package suite: `cd apps/indusk-mcp && pnpm test` — expected: green (1224 passed, 5 skipped, 0 failed)

#### Phase 8 Context
- [x] Update the eval-rail Known Gotchas entry: in a single-repo workbench, a commit from the root is attributed to whichever repository has the newer HEAD, because the workbench repo can receive commits too (plan documents) — "never the workbench" was the wrong invariant

#### Phase 8 Document
- [x] `apps/docs/src/guide/rail-check.md`: the attribution rule's one-repo bullet says "newer HEAD wins", with the plan-document commit as the example
- [x] `apps/docs/src/changelog.md` Unreleased: the five falsification fixes, one entry

### Phase 9: Cleanup — the copies this plan's files sit beside

**Goal**: decompose what this plan grew into shared units where the rule of three (or this repo's stricter rule for hook-side parsers: extract at two, because divergence is silent) says so, per the typescript and testing extensions — the idiom here is "extract a module", there being no framework extension on. Each item is a concrete extraction or a reasoned leave-as-is; the one new hook-side module gets a count-pinned trajectory row. The oversized scan flagged `workbench.ts` (657), `workbench-helpers.sh` (513), `eval-trigger.js` (482) and `worktree.ts` (418) against a 400-line cap; every one predates this plan and took a small delta from it, and none is split here — the number is attention, not a gate.

- [x] Extract `src/__tests__/helpers/test-git.ts` — `git(cwd, args, env?)` (throws on non-zero), `initRepoWithCommit(dir, label)`, `headOf(dir)` — out of `helpers/versioned-workbench.ts` (which re-exports `git`/`headOf` so its importers are unchanged), and migrate the three copies that do the same job to it: `helpers/worktree-fixture.ts`'s private `git()`, `hook-paths.test.ts`'s `gitInit`, `eval-trigger-workbench-mode.test.ts`'s `gitInit`. Basis: the rule of three (the suite carries fourteen private git runners; this plan added one, and these four share one contract — throw on failure, init with a README commit). The ten others return `{ code, stdout }` or swallow failures and are a different contract; leave them
- [x] (private `runHook` removed; `buildHookEvent` kept — it is an event builder, not a runner) Migrate `eval-trigger-workbench-mode.test.ts` from its private `runHook` / `buildHookEvent` to `helpers/hook-runner.ts`, which this plan extended with stdout, `cwd`, `env` and `args` precisely so that no eval test needs its own runner. Basis: rule of three (five test files define a `runHook`); this plan's own Test Phase 1 item named the migration and deferred it. The other three private runners (`claude-md-budget-hook`, `trajectory-a-prefix-ids`, `rationale-baseline-*`) are outside this plan's files — a follow-on hygiene candidate, not an item here
- [x] (both hooks import `parseImplPhases`; gate-reminder's `AUTHORABLE`/`CLOSES_PHASE` sets survived the cut after one wrong slice caught by its own suite) Extract `hooks/_impl-phases.js` — the fence-masked walk that turns an impl body into phase blocks `{ kind, number, ordinal, name, items: [{ checked, text, gate }] }` (phase heading → gate-kind sections → checkbox items, Forward Intelligence excluded) — from `check-gates.js`, and make `gate-reminder.js` consume it instead of its own copy (whose only difference is dropping `text`). Basis: this repo's standing rule for hook-side parsers, established when `_trajectory-parser.js` was extracted from the same two-copy state ("the copies had already diverged; a duplicated parser does not announce itself"). Annotate it as the deliberate port of the TS phase/item walk (`impl-parser.ts`'s `getPhaseCompletion` family); register it in `hook-shared-modules.test.ts`'s mirror table; `validate-impl-structure.js`'s narrower test-phase/Verification walk is a different question and stays. **Behavior-preserving**: check-gates' scan is the source of truth for the extraction, and its suite is the parity check
- [x] Add A24's pin to `hook-shared-modules.test.ts`: the set of hook modules matching the checkbox-item pattern `^-\s+\[([ x])\]` is exactly `["_impl-phases.js"]`, the way `definers()` already pins the trajectory-row parser to `["_trajectory-parser.js"]` (authored first; its first red was for the wrong reason — the fingerprint was the unescaped regex text and matched nothing — corrected to the literal as it appears in source, then red on three definers, then green)
- [x] Cross-plan note: add to `.indusk/planning/dawn-workbench-execution/brief.md` Context that three refusal sites now compose the same "this is a workbench, its code lives in X" message — `run.ts`, `cleanup/oversized.ts`, `verify/roots.ts` — and that `resolveExecutionRoots` should absorb all three, with the single-definition pin covering them
- [x] (reviewed `src/bin/commands/run.ts`, `src/lib/cleanup/oversized.ts`, `src/lib/verify/roots.ts` — left as-is: the rule of three IS met by their refusal messages, but `dawn-workbench-execution`'s `resolveExecutionRoots` is their designated single home; extracting a refusal helper now would be the abstraction 6.5 replaces a phase later, and this plan's Notes already forbid a second resolver)
- [x] (reviewed `src/bin/commands/workbench.ts` at 657 lines — left as-is: this plan added `cloneTarget` and eleven lines to `restoreOne`; the file is four subcommands that predate it, and splitting them by subcommand is a hygiene plan of its own, not this plan's output)
- [x] (reviewed `extensions/worktree/scripts/lib/workbench-helpers.sh` at 513 lines — left as-is: `_wt_list_worktree_dirs` and `_wt_resolve_target` each scan the root plus declared dirs, but the resolver needs per-entry repo attribution for qualifier filtering; two scans, not three, and the resolver is the `wt` path every caller depends on — recorded the same way in Build Phase 6's Shape)
- [x] (reviewed `hooks/eval-trigger.js` at 482 and `src/bin/commands/worktree.ts` at 418 — left as-is: this plan's deltas are a guarded refusal branch, a log field, and an exported reader; the sizes are pre-existing)
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`_impl-phases.js` is one function with one job and a docblock that names its TS twin; `test-git.ts` is three functions sharing one contract; every other file lost a copy and gained an import. All rule sets readable.)

#### Phase 9 Verification
- [x] A24 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-shared-modules.test.ts src/__tests__/hooks-load-in-cjs-consumer.test.ts` — expected: all pass (red today: `check-gates.js` and `gate-reminder.js` both match) (2026-09-10: 5 passed)
- [x] Hook behavior unchanged after the extraction: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/gate-reminder-speaks.test.ts src/__tests__/hooks-workbench-refactor.test.ts src/__tests__/trajectory-a-prefix-ids.test.ts src/__tests__/rationale-baseline-parity.test.ts $(grep -rl check-gates src --include='*.test.ts')` — expected: all pass (the suites that drive `check-gates.js` are the parity check for the walk; there is no `check-gates*.test.ts` file, the item originally named a glob that does not exist — the real set is fourteen files under `src/__tests__/`, `src/lib/run/`, `src/lib/shape/` and `src/lib/trajectory/`). Result: 17 files, 93 passed
- [x] (no tests flip at this phase for the test-helper migrations — reason: refactor) — the migrated suites pass unchanged: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-paths.test.ts src/__tests__/eval-trigger-workbench-mode.test.ts src/__tests__/worktree-cli.test.ts src/__tests__/worktree-preflight.test.ts src/__tests__/worktree-setup.test.ts` — expected: all pass (5 files, 38 passed)
- [x] Full package suite: `cd apps/indusk-mcp && pnpm test` — expected: green; installed copies resynced (`.claude/hooks/_impl-phases.js` exists byte-equal, `check-gates.js` and `gate-reminder.js` resynced) (1225 passed, 5 skipped, 0 failed; three installed copies byte-equal)

#### Phase 9 Context
- [x] Update the "Heading/parsing definitions are single-definition on purpose" Known Gotchas entry: `_impl-phases.js` is the one hook-side phase/item walk (mirrors the TS walk), joining `_impl-headings.js` and `_trajectory-parser.js`; note the test-helper module `helpers/test-git.ts` as the one throwing git runner for fixtures

#### Phase 9 Document
- [x] `apps/docs/src/changelog.md` Unreleased: one line — hook-side phase/item walk shared by check-gates and gate-reminder; test fixtures share one git runner and one hook runner

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
