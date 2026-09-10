---
title: "Workbench Mode Rail Integrity"
date: 2026-06-28
status: accepted
audience: indusk-mcp maintainers
---

# Workbench Mode Rail Integrity — Brief

## Why

The eval→Graphiti pipeline has been structurally broken on workbench-shaped InDusk projects since the worktree extension shipped. Evidence from numero_workbench traced 2026-06-28:

- 86 highlights queued in `.indusk/highlights.jsonl` (2026-04-19 → today; 31 critical, 53 important)
- 0 episodes in the `numero_workbench` Graphiti group
- Eval-trigger hook logs `skip — no git commit ID available` on every commit
- Pre-May: separate "Could not find @infinitedusky/indusk-mcp package" error (now resolved)

The pipeline works on single-repo InDusk projects (dusk itself, chitin-sportsbook). It's broken on workbench-shaped projects because the hooks assume `.indusk/` and the git repo live in the same directory. In workbench mode they don't:

```
~/code/numero/                    ← workbench root (NOT a git repo)
├── .indusk/                      ← InDusk state (highlights, config, .mcp.json)
├── .mcp.json                     ← MCP servers, mcp__indusk__* etc
├── numero/                       ← wrapped repo (git repo lives HERE)
│   ├── .git/
│   └── (production code)
└── feat-new-thing/               ← worktree
    └── (working tree of a branch)
```

The eval-trigger hook walks up from cwd looking for `.indusk/`, locks onto workbench root, then runs `git rev-parse --short HEAD` against workbench root — which isn't a git repo. The hook bails. The eval agent never spawns. The 86 highlights never get materialized as Graphiti episodes. 2 months of brief-acceptance, ADR-acceptance, correction, and retro-lesson moments accumulated with zero downstream effect.

**Workbench mode is the going-forward operating model for Numero and future FDE engagements.** This rail must work. The lesson `community-hook-bypass-is-rail-integrity-not-pacing` says a broken harness rail like this gets fixed and filed upstream, not normalized. This plan is the upstream fix.

## Proposed Direction

Three pieces, separable:

### 1. Workbench-aware path resolution in all hooks (the load-bearing fix)

The TS substrate already distinguishes `statePath` (where `.indusk/` lives) from operations that need the git repo. The hooks duplicate `findProjectRoot()` in pure JS and don't make the same distinction. Fix:

- New shared helper `apps/indusk-mcp/hooks/_hook-paths.js` (CJS or ESM matching hook convention) exporting `resolveStateAndGitPaths(cwd)` that returns `{statePath, gitPath}`. `statePath` walks up to `.indusk/`; `gitPath` derives from `git rev-parse --show-toplevel` against the commit's actual cwd (the cwd the hook event carries — not the InDusk state directory).
- All 4 hooks (`eval-trigger.js`, `check-catchup.js`, `check-gates.js`, `validate-impl-structure.js`) replace their local `findProjectRoot()` with calls to the new helper.
- Eval-trigger specifically: `git rev-parse --short HEAD` runs with `cwd: gitPath`, not `cwd: statePath`.
- State paths (highlights queue, config, settings.json registration, system.log) keep using `statePath`.

### 2. Audit + clean stray `.indusk/` state in wrapped repo and worktrees

Sandy's concern: workbench-shape means `.indusk/` lives at workbench root and nowhere else — but earlier `indusk init` runs (pre-worktree-extension, or run inside the wrong directory) may have created stray `.indusk/` directories inside `numero/` or inside worktrees. These would silently confuse path resolution (a hook's walk-up might find the wrong `.indusk/`), and "no lingering state at the app level" is a non-negotiable for going-forward operation.

Two parts:

- **Detection**: extend `check_health` (or add `indusk doctor`) to detect `.indusk/` directories inside any sub-path of a workbench root. Any such directory in workbench mode is a stray.
- **Manual cleanup, not auto-delete**: report the stray paths with a recommended `rm -rf` command. Don't auto-delete — the operator confirms each one, in case any directory legitimately needs to migrate content (e.g., committed highlights that should drain to workbench root).

### 3. One-shot manual backfill of the 86-entry queue

After the fix lands and is verified working on a single commit, run the eval agent manually with the corrected resolution to drain the 86-entry queue in a single pass. The eval agent's prompt is designed to drain `highlights_unprocessed` in one run; this is the designed mechanism, not a side-script.

Cost estimate: $0.50–2 in claude-sonnet tokens for the single drain pass.

## Context

This plan is also a **retroactive falsification of indusk-worktree-extension** (just shipped in 1.31.0-ish). The worktree extension's brief asserted that workbench-shape works end-to-end; it didn't verify against the eval-trigger hook. The hook gap is the kind of finding the falsification ritual is designed to catch — and the worktree extension's falsification + retrospective are owed (per master.md catchup state). This finding is captured here so it lands when worktree-extension's retro runs.

The bug pattern is also a textbook **`community-brief-author-bias-ground-truth-verification`** failure — the worktree extension's brief said "workbench-shape works" without grep-verifying that all four hooks understood the new layout. Ground-truth verification at brief time would have been ~30 minutes; the cost of letting it ship was 2 months of Numero accumulating a dark queue.

## Scope

### In Scope

- `apps/indusk-mcp/hooks/_hook-paths.js` — new shared workbench-aware path helper
- 4 hooks refactored to use the helper
- `apps/indusk-mcp/src/lib/health.ts` (or `apps/indusk-mcp/src/bin/commands/doctor.ts`) — stray `.indusk/` detection in workbench mode
- Unit tests against a numero-shaped fixture (workbench root + wrapped repo + worktree)
- Integration test: eval-trigger fires correctly from a wrapped-repo cwd
- Manual smoke procedure: drain the 86-entry backfill on numero_workbench

### Out of Scope

- A full `indusk doctor` command surface (just detection is enough for v1; full command can come later)
- Auto-cleanup of stray state (manual confirmation per directory is the policy)
- Per-worktree `.indusk/` SHOULD exist for tests / per-developer scratch — only the wrapped repo's stray state is the concern. Detection logic must distinguish.
- Migration tooling for projects that have BOTH workbench-root `.indusk/` and stray wrapped-repo `.indusk/` with diverged content. Such projects are rare; report and let the operator merge manually.

## Success Criteria

- A `git commit` from any cwd inside `numero_workbench/numero/` or any worktree triggers the eval-trigger hook successfully, resolves the git commit ID, and spawns the eval agent against the workbench root's state directory.
- After the backfill drain, `numero_workbench` Graphiti group contains episodes for the 86 unprocessed highlights (or a clear reason why specific entries were skipped).
- A future fresh workbench-shaped init produces a single `.indusk/` at workbench root; no stray `.indusk/` in the wrapped repo or worktrees.
- `check_health` (or `indusk doctor`) on numero_workbench reports clean (no stray state).

## Depends On

- None. The fix is internal to indusk-mcp. The deferred indusk-worktree-extension falsification + retrospective can reference this plan's finding; they don't block.

## Blocks

- Going-forward operation of Numero (any other workbench-shaped project, e.g. Avoca, future FDE engagements). Without this fix the eval→Graphiti pipeline doesn't work on the operating model Sandy has committed to.
- Indusk-worktree-extension's still-owed falsification + retrospective will need to reference this plan's finding as the rail-integrity gap the extension's original shipping missed.
