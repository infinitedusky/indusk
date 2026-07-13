---
title: "Workbench Setup Command — `indusk setup`"
date: 2026-06-30
status: accepted
---

# Workbench Setup Command — `indusk setup` — Brief

## Problem

Converting an already-cloned git repo into an InDusk workbench is a four-step manual dance: `mkdir <repo>-workbench`, hand-write a minimal `package.json`, place or symlink the repo, then run `indusk init --workbench --wrapped-repo <name> --sibling-parent <path>`. The `--sibling-parent` argument is the chief footgun — its meaning (the *parent directory of the canonical clone*, which is not the same as the workbench root) is non-obvious, and getting it wrong silently produces a different on-disk topology (numero's real-dir-inside layout vs. the documented symlink-in-place layout are both reachable depending on what you pass). The mental model the user actually has is simple: "I cloned a repo; turn it into a workbench." There is no command that expresses that.

## Proposed Direction

Add a single verb: **`indusk setup <cloned-repo-path>`**. Given the path to an existing git clone, it derives everything else and produces a working workbench in one command — no `package.json` to hand-write, no `--sibling-parent` to reason about.

Concretely, `indusk setup ~/code/sandbox/ursa`:
1. Validates `<path>/.git` exists and resolves the repo name (`ursa`) and its parent (`~/code/sandbox`).
2. Creates the workbench dir as a sibling: `~/code/sandbox/ursa-workbench/`.
3. Writes the minimal workbench `package.json` (the thing the user currently writes by hand).
4. Creates the trunk as a **non-destructive symlink** (`ursa-workbench/ursa -> ../ursa`) — the repo stays exactly where it was cloned.
5. Runs the existing workbench-init machinery (config write + worktree-extension enable).
6. Prints the same `worktree list` verification the manual flow ends with.

The command is **sugar over machinery that already exists**, not new behavior. The workbench-init logic currently lives inline in `init --workbench` ([init.ts:460-493](../../../apps/indusk-mcp/src/bin/commands/init.ts#L460-L493) for the trunk/validation block, plus the config write at ~1281-1286 and the extension-enable at ~1297). The first piece of work is to **extract that block into a reusable function** that both `init --workbench` and the new `setup` command call, so there is one code path and no drift.

**Topology default is symlink-in-place.** numero's layout (the clone physically inside the workbench) is an artifact of how numero happened to be set up — it is functionally identical to the symlink layout for daily work (worktrees as siblings, same `worktree create/list/preflight`). Defaulting to the non-destructive symlink means `setup` never moves the user's repo, which matters because a freshly-cloned repo is often dirty or has registered worktrees. A future `--move` flag could reproduce the real-dir-inside layout if anyone wants it, but it is explicitly out of scope for v1.

## Context

This was surfaced while setting up a workbench for `~/code/sandbox/ursa` in the same vein as `numero-workbench`. The manual Flow A was dogfooded end-to-end on ursa → `ursa-workbench` (symlink topology, `worktree list` reports config valid + trunk resolves), which is the **proof-of-concept and first real target** for the command. The friction of the manual flow — especially the `--sibling-parent` arg — is what motivated the request.

Relevant prior art:
- `init --workbench --wrapped-repo X --sibling-parent Y` shipped in `indusk-worktree-extension` Phase 6 — the machinery `setup` wraps. See the worktree extension at `apps/indusk-mcp/extensions/worktree/`.
- The two documented setup workflows live in [`apps/docs/src/guide/worktree-setup.md`](../../../apps/docs/src/guide/worktree-setup.md) — Flow A (fresh setup) is the four-step dance `setup` collapses.

## Scope

### In Scope
- Extract the inline `init --workbench` workbench-init block into a reusable function (e.g. `initWorkbench(opts)`), called by both `init --workbench` and `setup`. No behavior change to the existing `init --workbench` interface.
- New `indusk setup <repo-path>` CLI command.
- Name/parent derivation from the path: `wrapped_repo = basename(path)`, `sibling_parent = dirname(path)`, `workbench_dir = <sibling_parent>/<basename>-workbench`.
- Auto-scaffold the workbench `package.json` (no longer a manual prerequisite).
- Default non-destructive symlink-in-place topology.
- Idempotency / collision handling: defined behavior when `<basename>-workbench` already exists, when the path isn't a git repo, when the path doesn't exist, and when the derived workbench would nest inside the repo.
- Tests (unit for derivation, integration that runs `setup` against a tmp git repo and asserts the workbench resolves / `worktree list` is config-valid).
- Docs: rewrite [`worktree-setup.md`](../../../apps/docs/src/guide/worktree-setup.md) Flow A to lead with `indusk setup`, demoting the four manual steps to a "what it does under the hood" note.

### Out of Scope
- A `--move` flag for numero's real-dir-inside topology (possible follow-up; v1 is symlink-only).
- Multi-repo workbenches (one workbench wrapping several repos — already deferred to a future FDE-agency plan).
- Doppler service-token provisioning / per-app `doppler` config block in `config.json` (separate concern; `setup` leaves env wiring to the doppler extension's own flow).
- Changing or deprecating the existing `init --workbench` flag interface (it stays; `setup` is an additive convenience).
- Cloning the repo for the user (`setup` operates on an *already-cloned* repo, matching the "clone, then setup" mental model).

## Success Criteria
- `git clone <url> ~/code/sandbox/foo && indusk setup ~/code/sandbox/foo` yields a working workbench at `~/code/sandbox/foo-workbench/` in one command.
- `indusk worktree list` (run from the workbench) reports `config valid` and the trunk symlink resolves.
- No contents of the wrapped repo are moved (symlink default); a dirty working tree in the repo does not block setup.
- `init --workbench` continues to work unchanged, sharing the extracted code path (no duplicated workbench-init logic).
- Re-running `setup` on an already-set-up workbench is safe (no clobber, clear message) rather than erroring opaquely or corrupting state.

## Resolved Decisions
_(settled at brief acceptance, 2026-06-30)_
- **Zero-flag v1.** `setup` takes only the repo path — `indusk setup <repo-path>`. Workbench name (`<repo>-workbench`) and parent are derived from the path. No `--name` / `--into` knobs in v1; they can be added later if a real need surfaces.
- **Collision = error with a clear message.** When `<repo>-workbench` already exists, `setup` refuses and points the user at `indusk update` (or removing the dir), rather than clobbering or resuming. Resume-as-update is a possible later refinement, not v1.
- **Workflow = brief + test-plan + impl (no ADR).** The only architectural fork (symlink-in-place vs. move-into-workbench) is settled here in the brief, so an ADR would be ceremony. The plan goes brief → test-plan → impl.

## Depends On
- `indusk-worktree-extension` (shipped) — provides the `init --workbench` machinery being wrapped.

## Blocks
- (none)
