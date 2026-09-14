---
title: "InDusk Worktree Extension — Test Plan"
date: 2026-05-20
status: draft
revision: 5 (2026-05-28 — workbench layout flattens: trunk symlink + worktrees as siblings at workbench root, replacing the `production/<repo>` + `worktrees/<slug>/` split. Single-repo-only narrowed; multi-repo deferred to future FDE-agency plan. A1/A2/A5/A6/A11/A13/A16 wording reads against the flat shape; A13's dual-workbench dogfood collapses to single-workbench-with-numero dogfood since dawn-fde-toolkit is multi-repo and now out of scope.)
revision: 4 (2026-05-27 — execution surface flips from `pnpm ce wt:<slug> <cmd>` to bare `pnpm wt <slug> <cmd>`; new A18 covers `composeProjectName` cross-cwd targeting per composable.env ≥ 1.37.7)
---

# InDusk Worktree Extension — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the worktree extension is working. Each assertion names the mechanism by which it will be tested. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The extension targets **workbench-shaped indusk projects only** — those with `production/<repo>` symlinks to canonical client clones and a `worktrees/` directory for active feature branches. Single-repo indusk projects are NOT valid adopters; to use the extension against a non-workbench codebase, a workbench wrapping that codebase is created first.

The dogfood matrix is therefore **two workbenches**:

1. **`dawn-fde-toolkit`** — existing workbench (wraps `avoca-next` + `claude-skills` + `vapi`). The extension's local CLI replaces the current ad-hoc `scripts/wt.sh` + `scripts/wt-pm2.sh` + `scripts/preflight.sh`. This is the "swap a working pattern for its canonical version" smoke.
2. **`numero-workbench`** — new workbench created as part of this plan. Wraps Numero via a `production/numero` symlink to `/Users/the_dusky/code/sandbox/numero` plus a `worktrees/` directory. The extension is installed via `indusk extensions enable worktree`. This is the "extension works on a workbench it built from scratch" smoke.

Sandy's directive ("all code we are working on inside an indusk project") makes cross-workbench parity non-negotiable. No Avoca-specific assumptions in config or CLI behavior; both workbenches use the same surface.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows is constrained by "what makes all these assertions true?" rather than invented from intuition.

## Surface (what we are testing)

- **Lifecycle** (`indusk worktree ...`) — `create`, `refresh`, `list`, `preflight`. State operations the indusk-mcp CLI owns directly.
- **Execution** (`pnpm wt <target>[:<app>] <command> [args...]`) — runs any pnpm command from the resolved target's directory. Installed into the workbench by the extension's `on_enable` hook (the extension scaffolds a local CLI; ce itself is not modified). `<target>` resolves to a worktree slug OR the trunk (typically `production/<repo>`). ce composition still works inside this form — e.g., `pnpm wt cancel-polish ce dc:up local` cd's into the worktree, then invokes `pnpm ce dc:up local` from there.
- **Multi-process** (`pnpm wt:pm2 <target>:<app> <cmd> [<target>:<app> <cmd>]...`) — launches each pair as a named pm2 process for parallel dev-server orchestration. (`wt:pm2` is a top-level pnpm script name, not a wildcard.)
- **Cross-cwd targeting** (`composeProjectName` in `ce.json`) — when the workbench's `ce.json` declares a top-level `composeProjectName: "<repo>"`, docker-compose lifecycle commands target the named project regardless of cwd (composable.env ≥ 1.37.7). Tradeoff: only one stack per repo can run at a time.
- **Config** (`.indusk/worktree-configs/<repo>.json`) — per-wrapped-repo source of truth for trunk path, `copy_files[]`, `append_files[]`, `apply_commits[]`, `preflight[]`, and declarative `preflight_env{}` path filters.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | `indusk worktree create <repo> <slug> [base-branch]` (run from a workbench) creates a new worktree at the configured filesystem path under `worktrees/`, branched off the configured base of the named wrapped repo. | vitest integration (tmpdir-init'd workbench fixture wrapping a sample client repo; assert directory exists + branch name) |
| A2 | The new worktree contains every file declared in `copy_files[]` copied from the wrapped repo's canonical clone, with every `append_files[]` entry concatenated onto its destination path under a sentinel header. | vitest integration (config exercising both fields; assert file presence + content suffixes) |
| A3 | When `apply_commits[]` entries are configured, the cherry-picked commits' changes are present in the worktree's working tree but invisible to `git status`, `git diff`, and `git commit -a` (skip-worktree active). | vitest integration (sample upstream commit on a side branch of the wrapped repo; apply via config; assert working-tree content diverges from `git status` output) |
| A4 | After removing an entry from `apply_commits[]` and running `indusk worktree refresh <slug>`, the skip-worktree flags for that entry's files are cleared and `git status` reflects current state. | vitest integration (remove entry, refresh, assert `git status` reports changes again or reconciles to merged-upstream cleanly) |
| A5 | `pnpm wt <target>[:<app>] <command> [args...]` resolves `<target>` to either a worktree slug under `worktrees/` OR the trunk (`production/<repo>`) using the toolkit's existing two-pass scheme. Runs `pnpm <command>` from the resolved directory (or `<resolved>/apps/<app>` when `:<app>` is present). Errors clearly on zero or multiple matches. | vitest integration (workbench fixture with multiple worktrees + a trunk; exercise exact match, suffix match, ambiguous match, zero match, trunk addressing) |
| A6 | `pnpm wt trunk` (and `pnpm wt <wrapped-repo-name>`, e.g. `pnpm wt numero`) is always-present-addressable — no `indusk worktree create` step needed for the trunk. `pnpm wt numero dev` works against the workbench's `production/numero` checkout as soon as the workbench is configured. | vitest integration (workbench fixture with two wrapped repos; assert both trunk forms resolve) |
| A7 | `pnpm wt:pm2 <target>[:<app>] <cmd> [<target>[:<app>] <cmd>]...` launches each pair as a named pm2 process visible in `pm2 list` with a name containing the slug. Single invocation, N pm2 processes. | manual smoke (pm2 absent in CI; assert by hand on both workbenches) |
| A8 | `pnpm wt <target> ce <ce-command>` composes with ce's existing command set — running `pnpm wt cancel-polish ce dc:up local` brings docker-compose up with the `local` profile against the cancel-polish worktree's `.env.local` (the worktree's env is in scope, not the trunk's). | manual smoke (requires docker; on both workbenches with a known dc:up-shaped command) |
| A9 | `indusk worktree preflight <slug>` against a worktree whose diff contains a real biome violation exits non-zero with the violation surfaced in stderr. | vitest integration (commit a known-violation file to a feature branch; run preflight; assert exit code + stderr substring) |
| A10 | `indusk worktree preflight <slug>` against a worktree whose diff touches only files outside the configured scope exits 0 in under 2 seconds. | vitest integration (timing assertion + exit code 0) |
| A11 | `indusk worktree list` shows every wrapped repo in the workbench with a status badge — `(config valid)`, `(config missing)`, or `(no worktrees)` — derived from `.indusk/worktree-configs/<repo>.json` presence and schema validation. | vitest integration (set up three configs in three states; assert table output rows) |
| A12 | A malformed `.indusk/worktree-configs/<repo>.json` (missing required field, wrong type, unknown top-level key) produces a clear error naming the offending field and the expected shape — not a stack trace. | vitest unit (validator with malformed fixtures; assert error message contents) |
| A13 | **The same extension, same CLI, same config schema, and same `pnpm wt` surface work against both `dawn-fde-toolkit` (existing workbench, swapping its scripts for the extension) and a new `numero-workbench` (created as part of this plan, wrapping Numero).** No Avoca-specific assumptions in either workbench's config or CLI behavior. | manual smoke (Sandy runs end-to-end against both workbenches) + vitest integration parameterized with two minimal workbench fixtures, both passing |
| A14 | Running `indusk worktree create` twice with the same `<repo> <slug>` exits non-zero with `worktree already exists at <path>` rather than corrupting state. | vitest integration (second invocation; assert exit code + stderr) |
| A15 | The `worktree` extension is `required: false`. An indusk project without `production/` + `worktrees/` directories and without explicit `indusk extensions enable worktree` does not have the extension auto-enabled after `indusk init`/`update`. | vitest unit (`autoEnableExtensions` against a non-workbench fixture) |
| A16 | After `indusk extensions enable worktree`, the workbench gains the expected local CLI artifacts — pnpm scripts registered in `package.json` (`wt`, `wt:pm2`, `preflight`), required script files on disk, a starter `.indusk/worktree-configs/<repo>.json` if absent — and these artifacts produce working `pnpm wt <target> <cmd>` invocations without modifying ce upstream. | vitest integration (enable extension against a fresh workbench fixture; assert files + package.json scripts + smoke invocation) |
| A17 | `indusk worktree preflight` exports a consistent env-var contract to its preflight commands regardless of which wrapped repo's config is in play — `CHANGED_FILES`, `CHANGED_FILES_BIOME`, and any declarative `preflight_env{}` derived booleans (e.g., `MIGRATIONS_RELEVANT`). Schema is the contract; Avoca-shaped values are NOT baked. | vitest integration (two configs with different `preflight_env` declarations; run against synthetic diffs; assert env vars match per-config declaration) |
| A18 | A workbench whose `ce.json` declares a top-level `composeProjectName: "<repo>"` produces a single docker-compose project namespace regardless of cwd: running `pnpm wt <slug> ce dc:up local` (from the worktree) and then `pnpm ce dc:down` (from the workbench root) addresses the same stack. The starter `.indusk/worktree-configs/<repo>.json` (or the extension's `on_enable` hook) recommends the `composeProjectName` field so adopters get cross-cwd targeting by default. | manual smoke (requires docker + composable.env ≥ 1.37.7; on `numero-workbench` with a known dc:up-shaped command) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | FDEs experience meaningfully less context-switching friction across worktrees after adopting the extension. | UX outcome; only observable through user feedback over weeks of real use. | Sandy reports back after 4 weeks of dogfood use on `numero-workbench`. If "did `pnpm wt <...>` save me time today?" gets yes more often than no, retain; otherwise reshape. Captured as a retrospective audit item. |
| U2 | The extension generalizes beyond `dawn-fde-toolkit` + `numero-workbench` to a third unrelated FDE engagement. | Requires a third workbench we don't have today. | Brief's "Open questions for Lazer FDE peers" stays as the discovery channel. When a third engagement lands, a follow-up plan (`F1.next` in master.md) validates and patches any assumptions that leaked through. |

## Notes

- **A13 is load-bearing.** Sandy's directive makes the two-workbench dogfood the acceptance criterion. If A13 fails — for example, if `dawn-fde-toolkit`'s adoption needs a config-shape that `numero-workbench` doesn't, or vice versa — the extension isn't shipped. The two-workbench matrix replaces the earlier "two project shapes" framing now that single-repo adopters are out of scope.
- **A8 (ce composability) and A7/A13's manual smoke are the assertions that cannot run in CI.** They're real assertions, just human-driven; captured in `Deferred Verification` of the impl with explicit `mitigation:` entries (per-PR smoke checklist tied to the two workbenches).
- **A16 codifies the "extension installs local CLI" implementation direction.** Without it, the ADR could quietly pick "modify ce upstream" or "ship as a global tool" — both of which break Sandy's "all code inside an indusk project" principle.
- **A17 forces the `preflight_env{}` schema** (audit-promoted from a Phase 2 idea to v1 in the brief) to actually be exercised — not just exist. Without an explicit assertion, the schema would silently accept malformed declarations.
- **`numero-workbench` creation is a deliverable of this plan**, not a prerequisite. The impl will scaffold it (create the directory, symlink `production/numero`, init it as an indusk project, enable the worktree extension) as part of the dogfood smoke. Document in retrospective whether the scaffolding itself surfaced anything worth promoting (e.g., an `indusk init --workbench` shape).
- **SCM-awareness stays via `lib/scm/detect.ts`.** All current candidate wrapped repos are git, so cross-SCM coverage is theoretical for v1, but the extension routes SCM-specific calls through the existing abstraction so a future jj-backed wrapped repo would work without rewrite.
- **Out of scope for v1**: single-repo indusk-project adopters (workbench-only by design); `indusk worktree remove`/`prune` (no cleanup affordance); orphan-worktree detection; cross-FDE shared config registry (Phase 4 of brief); ce-binary modifications.
