---
title: "Workbench Setup Command — `indusk setup`"
date: 2026-06-30
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Workbench Setup Command — `indusk setup`

## Goal

Add a single CLI verb — `indusk setup <cloned-repo-path>` — that turns an already-cloned git repo into a working InDusk workbench in one command, eliminating the four-step Flow A dance and the `--sibling-parent` footgun. The command derives the workbench name/parent from the path, scaffolds the workbench dir + minimal `package.json`, then **delegates to the existing `init(workbenchDir, { workbench: true, wrappedRepo, siblingParent })`** flow — which already validates the clone, creates the trunk symlink, writes the `worktree` config block, and enables the worktree extension. Delegation (rather than extracting a helper) keeps a single code path with zero drift and makes the `init --workbench` regression guard near-tautological.

## Scope

### In Scope
- New `apps/indusk-mcp/src/bin/commands/setup.ts` exporting `setup(repoPath: string)`.
- Register `setup <repo-path>` in `apps/indusk-mcp/src/bin/cli.ts`.
- Path-derivation: `wrappedRepo = basename`, `siblingParent = dirname`, `workbenchDir = <siblingParent>/<wrappedRepo>-workbench`.
- Up-front validation (non-git / missing path) and collision guard (`<repo>-workbench` exists) — both error clearly and create nothing, per the accepted brief.
- Auto-scaffold the workbench `package.json` (no longer a manual prerequisite).
- Subprocess integration tests (T1–T7) mirroring `init-no-git-warning.test.ts`.
- Docs: rewrite `worktree-setup.md` Flow A to lead with `indusk setup`; add a CLI reference page; changelog entry.

### Out of Scope
- `--name` / `--into` override flags (zero-flag v1, per brief).
- `--move` / real-dir-inside topology (symlink-in-place only).
- Resume-as-update on collision (v1 errors).
- Cloning the repo for the user; Doppler token provisioning; multi-repo workbenches.
- Any change to `init`'s observable behavior (T7 pins this).

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `indusk setup <path>` on a fresh clone (no flags, no pre-made files) creates `<path>-workbench` where `indusk worktree list` reports config valid + trunk resolving | Phase 0 | Phase 1 | passing |
| T2 | After `setup`, the wrapped repo still exists at its original path with its files intact (nothing moved) | Phase 0 | Phase 1 | passing |
| T3 | After `setup`, `indusk worktree create <slug>` produces a working sibling worktree inside the workbench | Phase 0 | Phase 1 | passing |
| T4 | `setup` against a non-git / nonexistent path exits non-zero with a clear message and leaves no workbench dir behind | Phase 0 | Phase 1 | passing |
| T5 | `setup` when `<repo>-workbench` already exists exits non-zero, points at `indusk update`, and leaves the existing workbench's contents untouched | Phase 0 | Phase 1 | passing |
| T6 | A repo with uncommitted + untracked changes can be set up successfully (dirty tree does not block) | Phase 0 | Phase 1 | passing |
| T7 | `indusk init --workbench --wrapped-repo X --sibling-parent Y` still produces a working workbench (regression guard for the delegated-to path) | Phase 0 | Phase 1 | passing |
| T8 | When `<repo>-workbench` exists but is NOT a completed InDusk workbench (no `.indusk/config.json`), `setup` reports a distinct "exists but is not an InDusk workbench" error and does NOT advise `indusk update` | Phase 0 | Phase 2 | planned |
| T9 | A `setup` run that fails during `init` (after the workbench dir is created) leaves no `<repo>-workbench` directory behind — setup is atomic | Phase 0 | Phase 2 | planned |

All rows are `Writable at: Phase 0` — the tests spawn the built CLI and invoke `setup` (or `init --workbench`) as a string subcommand against tmp `git init` repos, so the test source compiles today and fails red (`unknown command 'setup'` for T1–T6; T7 already passes and is a standing guardrail). No `### Trajectory Rationale` subsection is required (it applies only to Phase 1+ rows). No `### Deferred Verification` — every assertion is testable against ephemeral repos with no external services.

## Checklist

### Phase 1: `setup` command

- [x] Create `apps/indusk-mcp/src/bin/commands/setup.ts` exporting `async function setup(repoPathInput: string): Promise<void>`:
  ```typescript
  import { existsSync, mkdirSync, writeFileSync } from "node:fs";
  import { basename, dirname, join, resolve } from "node:path";

  export async function setup(repoPathInput: string): Promise<void> {
    const repoPath = resolve(repoPathInput);
    // T4: validate the target is an existing git repo
    if (!existsSync(repoPath)) {
      console.error(`Error: no such path: ${repoPath}`);
      process.exit(1);
    }
    if (!existsSync(join(repoPath, ".git"))) {
      console.error(`Error: ${repoPath} is not a git repository (no .git/ there).`);
      console.error("  `indusk setup` wraps an already-cloned repo — clone it first, then re-run.");
      process.exit(1);
    }
    const wrappedRepo = basename(repoPath);
    const siblingParent = dirname(repoPath);
    const workbenchDir = join(siblingParent, `${wrappedRepo}-workbench`);
    // T5: collision guard — never clobber an existing workbench
    if (existsSync(workbenchDir)) {
      console.error(`Error: a workbench already exists at ${workbenchDir}.`);
      console.error("  To refresh it, run `indusk update` from there.");
      console.error("  To recreate it, remove that directory first.");
      process.exit(1);
    }
    // Scaffold workbench dir + minimal package.json (the manual prerequisite)
    mkdirSync(workbenchDir, { recursive: true });
    writeFileSync(
      join(workbenchDir, "package.json"),
      `${JSON.stringify({ name: `${wrappedRepo}-workbench`, version: "0.0.1", private: true }, null, 2)}\n`,
    );
    console.info(`[Setup] scaffolded workbench: ${workbenchDir}`);
    // Delegate to the single workbench-init flow (trunk + config + extension enable)
    const { init } = await import("./init.js");
    await init(workbenchDir, { workbench: true, wrappedRepo, siblingParent });
  }
  ```
  Note: validation uses `process.exit(1)` (consistent with `init`); subprocess tests observe the exit code. The collision/validation guards run BEFORE `mkdirSync`, so a failed `setup` creates nothing (T4/T5).
- [x] Register the command in `apps/indusk-mcp/src/bin/cli.ts` immediately after the `init` command block (after the current line ~71):
  ```typescript
  program
    .command("setup <repo-path>")
    .description("Turn an already-cloned git repo into an InDusk workbench (one-shot)")
    .action(async (repoPath) => {
      const { setup } = await import("./commands/setup.js");
      await setup(repoPath);
    });
  ```
  `setup` CREATES a project root (the workbench), so — like `init` — it does NOT call `rootOrExit()`; it operates on the derived `workbenchDir`.
- [x] Create `apps/indusk-mcp/src/__tests__/setup-command.test.ts` mirroring `init-no-git-warning.test.ts`: `CLI_BIN = dist/bin/cli.js`, `describe.skipIf(!existsSync(CLI_BIN))`, `{ timeout: 60000 }`, tmp `projectDir`/`siblingParent` + tmp `INDUSK_HOME`, `INDUSK_SKIP_SELF_UPDATE: "1"`. Cases:
  - **T1** — `git init` + commit a tmp repo; `spawnSync(node, [CLI_BIN, "setup", repoPath])`; assert exit 0, `<repoPath>-workbench/.indusk/config.json` exists with `worktree.shape === "workbench"`, `wrapped_repo`, `sibling_parent`; run `[CLI_BIN, "worktree", "list"]` in the workbench → stderr/stdout contains `config valid` and trunk `resolves`.
  - **T2** — after T1's setup, assert the original repo dir still exists with a sentinel file written pre-setup.
  - **T3** — after setup, `spawnSync(node, [CLI_BIN, "worktree", "create", "feat-smoke"])` in the workbench; assert exit 0 and `<workbench>/feat-smoke` is a directory.
  - **T4** — tmp dir WITHOUT `git init`; `setup` → assert `status !== 0`, stderr matches `/not a git repository/`, and `<dir>-workbench` does NOT exist.
  - **T5** — run `setup` twice; before the 2nd, drop a sentinel file in the workbench; assert 2nd exits non-zero, stderr matches `/already exists/` and `/indusk update/`, and the sentinel survives.
  - **T6** — `git init` + commit, then write an untracked file and modify a tracked one; `setup` → assert exit 0 and workbench is config-valid.
  - **T7** — `git init` + commit a tmp repo; `mkdir` a sibling workbench dir + minimal `package.json`; `spawnSync(node, [CLI_BIN, "init", "--workbench", "--wrapped-repo", name, "--sibling-parent", parent])`; assert exit 0 + config-valid workbench (pins the delegated-to path).
- [x] `git worktree add` requires a commit — every tmp repo in T1/T3/T6/T7 must `git init` + `git config user.*` + an initial `git commit --allow-empty`. (handled by the `initRepo` helper)

#### Phase 1 Verification
- [x] Build first so the subprocess tests run (not skipped): `pnpm --filter @infinitedusky/indusk-mcp build` (tsc clean)
- [x] T1–T7 pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/setup-command.test.ts` (7 passed, 0 skipped)
- [x] Lint/format clean: Biome clean on `setup.ts` + `setup-command.test.ts` (test import-sort + format auto-fixed). Note: 3 pre-existing Biome violations in `cli.ts` (lines ~109 `--large-section-chars`, ~304 git-no-commits message) predate this edit (present in HEAD~3) and are out of scope — not touched to keep the commit siloed.
- [x] Manual dogfood: built CLI `setup <throwaway-repo>` → scaffolded workbench + trunk symlink `myapp -> ../myapp`; `worktree list` → config valid + trunk resolves; re-run `setup` → `Error: a workbench already exists … run \`indusk update\`` (exit 1)

#### Phase 1 Context
- [x] Add to dusk `CLAUDE.md` Conventions: "`indusk setup <cloned-repo-path>` one-shots workbench creation — derives `<repo>-workbench` name/parent from the path, scaffolds `package.json`, symlinks the trunk in-place (repo not moved), and delegates to `init --workbench`. Zero-flag; errors if `<repo>-workbench` already exists (→ `indusk update`). The `setup.ts` command is a thin wrapper over `init`; do not duplicate workbench-init logic."
- [x] Update dusk `CLAUDE.md` Current State to note `workbench-setup-command` impl complete pending falsification + retrospective.

#### Phase 1 Document
- [x] Rewrite `apps/docs/src/guide/worktree-setup.md` Flow A to lead with `indusk setup <repo-path>` as the one-command path; demote the four manual steps to a "what it does under the hood" note. Kept Flow B (migration) intact. Also added the `setup` page to the VitePress CLI sidebar (`config.ts`).
- [x] Add CLI reference page `apps/docs/src/reference/cli/setup.md` (synopsis, derivation rule, collision behavior, symlink-in-place note, errors table).
- [x] Add a changelog entry in `apps/docs/src/changelog.md` under `## [Unreleased]` (siloed from the in-flight 1.31.12 release, a different context's uncommitted work).
- [x] (deferred — asked: "package.json is already at 1.31.12 uncommitted from a different context's in-flight release, and this plan publishes only after `/falsify` + `/retrospective`. Skip the version bump now and do it at publish time?" — user: "continue" — the AskUserQuestion tool errored; user replied "continue" to the posed question, so proceeding with the recommended defer) Bump lands at publish (next version after 1.31.12), not now — avoids entangling with the in-flight release.

### Phase 2: Falsification — non-atomic setup + workbench-blind collision guard

**Goal**: verify whether setup's "creates nothing on failure" and "clear collision message" promises hold against a `<repo>-workbench` that exists-but-isn't-a-workbench (empty dir, foreign dir, or a partial dir left by a failed/interrupted prior run), and against an `init` failure *after* the workbench dir is created. Both gaps are visible in the current `setup.ts`: the collision guard (lines 39-44) is unconditional — it tells the user "a workbench already exists … run `indusk update`" for ANY existing `<repo>-workbench`, even an empty or half-built one where `indusk update` is wrong advice; and the scaffold+init block (lines 48-57) has no `try/catch`, so an `init` failure after `mkdirSync` leaves a partial `<repo>-workbench` behind — which then trips the misleading collision path on the next run, locking the user out of both completing and cleanly retrying.

- [ ] Refine the collision guard in `setup.ts` (currently unconditional, lines 39-44): after `existsSync(workbenchDir)`, branch on `existsSync(join(workbenchDir, ".indusk", "config.json"))`. Real workbench (config present) → keep the current "a workbench already exists … run `indusk update`" message. Dir exists WITHOUT config → a distinct error ("`<dir>` exists but is not an InDusk workbench — remove it and re-run `indusk setup`") that does NOT advise `indusk update`.
- [ ] Make `setup` atomic: wrap the post-guard `mkdirSync` + `writeFileSync` + `await init(...)` (lines 48-57) in `try/catch`. On failure, `rmSync(workbenchDir, { recursive: true, force: true })` before re-throwing / exiting non-zero. Safe because the collision guard already proved `workbenchDir` did not pre-exist, so setup created it this run — cleanup cannot delete pre-existing user data.

#### Phase 2 Verification
- [ ] T8: create an empty `<repo>-workbench` (no `.indusk/config.json`), run `setup <repo>` → stderr does NOT match `/indusk update/` and names the not-a-workbench condition. Red today (guard is unconditional); green after the guard refinement. Also confirm T5 (real-workbench collision → "indusk update") stays green — the two cases must diverge on config presence.
- [ ] T9: run `setup <repo>` with `INDUSK_HOME` pointing at a regular FILE (forces `init`'s registry write to fail *after* the workbench dir is created) → setup exits non-zero AND `<repo>-workbench` does not exist afterward. Red today (partial dir lingers); green after the atomicity fix. If `init` proves robust to that specific fault (degrades instead of throwing), substitute another post-`mkdir` fault injection or downgrade T9 with a recorded reason — do not rubber-stamp it green.

#### Phase 2 Context
- [ ] Add a Known Gotcha to dusk `CLAUDE.md`: `indusk setup`'s collision guard distinguishes a real workbench (`.indusk/config.json` present) from a partial/foreign `<repo>-workbench`, and setup is atomic — it removes the dir it created if `init` fails — so a failed/interrupted setup never leaves a lingering dir that misroutes the next run to `indusk update`.

#### Phase 2 Document
- [ ] Update `apps/docs/src/reference/cli/setup.md` errors table: add the "`<repo>-workbench` exists but is not an InDusk workbench" row (distinct from "a workbench already exists"), and note that a failed setup cleans up the dir it created.

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-mcp/src/bin/commands/setup.ts` | new — `setup()` command function |
| `apps/indusk-mcp/src/bin/cli.ts` | add `setup <repo-path>` command registration after `init` |
| `apps/indusk-mcp/src/__tests__/setup-command.test.ts` | new — T1–T7 subprocess integration tests |
| `apps/docs/src/guide/worktree-setup.md` | rewrite Flow A to lead with `indusk setup` |
| `apps/docs/src/reference/cli/setup.md` | new — CLI reference page |
| `apps/docs/src/changelog.md` | changelog entry |
| `apps/indusk-mcp/package.json` | version bump for release |

## Dependencies
- `indusk-worktree-extension` (shipped) — provides the `init --workbench` machinery `setup` delegates to. Confirmed wiring points: trunk validation/symlink at [init.ts:460-495](../../../apps/indusk-mcp/src/bin/commands/init.ts#L460-L495), `worktree` config block at [init.ts:1281-1289](../../../apps/indusk-mcp/src/bin/commands/init.ts#L1281-L1289), extension-enable at [init.ts:1297-1301](../../../apps/indusk-mcp/src/bin/commands/init.ts#L1297-L1301).

## Notes
- **Delegation vs. extraction:** the brief proposed extracting init's workbench block into a shared function. The impl instead has `setup` call `init(workbenchDir, { workbench: true, ... })` directly — `init` already IS the encapsulated workbench-init flow, so delegation gives the same single-code-path guarantee with less new code and makes T7 near-tautological (init is unchanged). Flagged at impl authoring; strictly simpler/safer than extraction, preserves all behavior.
- `init` will emit its standard "not a git repository" warning for the workbench root (the workbench is intentionally not a git repo, same as numero-workbench). This is benign and matches the manual Flow A output; not suppressed in v1.
- Subprocess tests require a prior `build` (the `skipIf(!CLI_BIN)` guard skips them otherwise). The Verification block builds first so the rows actually execute rather than silently skip.
