---
title: "InDusk Worktree Extension — ADR"
date: 2026-05-27
status: accepted
deciders: Sandy Corsillo
informed: indusk-mcp maintainers, Lazer FDE peers
inputs:
  - brief.md (revised 2026-05-27)
  - test-plan.md revision 4
  - research.md (2026-05-26 survey of dawn-fde-toolkit + numero + indusk init flow)
---

# Worktree Extension — Architecture Decisions

## Why this shape (the motivation underneath every decision below)

**State-integrity, not FDE quality-of-life.** The earlier framing was "FDE workflow promotion — make per-engagement worktree management less painful." That undersells it. The deeper need Sandy named (2026-05-27): when worktrees of a project are created and destroyed during normal development, the `.indusk/` state (plans, highlights, eval results, config) must NOT be duplicated across worktrees, must NOT get silently lost when a worktree is removed, and must NOT require merge resolution to keep coherent. The workbench pattern — one `.indusk/` at the workbench root, code (with `.git/`) in symlinked subdirs that never carry `.indusk/` content — delivers exactly this: a single InDusk state-of-record that survives every worktree lifecycle event.

This is also the substrate I.1 (`handoff-multi-agent`) builds on. The workbench gives one shared `.indusk/`; I.1 adds per-agent presence files on top of it. Without the workbench shape, I.1 has nowhere coherent to put its presence state.

## Scope reconciliation vs the brief

| Brief said | ADR commits to | Why |
|---|---|---|
| Workbench-only target | Same — confirmed | State-integrity motivation requires the workbench shape; plain projects can't deliver it without becoming workbenches first |
| Dogfood matrix: `dawn-fde-toolkit` + new `numero-workbench` | Same | Both are required to validate cross-workbench portability (A13 load-bearing) |
| Execution via `pnpm ce wt:<slug> <cmd>` | **Reversed → bare `pnpm wt <slug> <cmd>`** | Routing problem (pnpm wildcards lose args, ce upstream out of scope). Bare form already proven in dawn-fde-toolkit. Brief + test-plan already updated |
| `apply_commits[]` is "cherry-pick" | **Renamed → "upstream-file-overlay"** | Research found the actual mechanism is `git show <sha>:<file> > <file>` (full-file replacement), not cherry-pick. Naming matters for the docs + error messages |
| Implementation language deferred | **Bash port, config-driven** | 3x faster than TS port; 1:1 semantic fidelity with the scripts that have a year of real use |

## Decision 1: Execution surface is bare `pnpm wt <slug>[:<app>] <command> [args...]`

**Decision.** The extension's user-facing run-anything surface is the exact shape `dawn-fde-toolkit` ships today: `pnpm wt <slug> <cmd>`. ce composition stays alive INSIDE this form via `pnpm wt <slug> ce <ce-cmd>` (wt cd's into the worktree dir, then invokes ce there; ce reads the cwd's env).

**Why.** Already proven in dawn-fde-toolkit. No routing layer to build. pnpm script-name wildcards (`wt:*`) lose argument access, so any colon-suffix form would either need a shim or break the test-plan's `wt:pm2` multi-pair semantics. The earlier `pnpm ce wt:<slug>` shape was aspirational with no implementation backing.

**Consequences.**
- Test-plan A5/A6/A8 wording updated to bare form (revision 4)
- `wt:pm2` stays as a separate top-level pnpm script name (the colon is fine for a top-level script; it's only wildcards that lose args)
- ce composition is one extra word (`pnpm wt cancel-polish ce dc:up local` vs the rejected `pnpm ce wt:cancel-polish dc:up local`); acceptable tax for not building a routing layer

## Decision 2: Bash port, config-driven

**Decision.** The four scripts (`setup-worktree.sh`, `refresh-worktree.sh`, `wt.sh`, `wt-pm2.sh`) port forward as bash, with hardcoded values lifted into config (see Decision 4). No TypeScript reimplementation in v1. `preflight.sh` ports the same way.

**Why.**
- Bash port is ~3x cheaper than TS to ship and carries forward the operational lessons (and the lessons-doc warnings about edge cases) from a year of real use
- The scripts are inherently shell-shaped (lots of `git`, `cd`, file operations, pm2 invocations) — TS would mostly be re-implementing `child_process.spawn` wrappers
- The state-integrity motivation doesn't depend on language; it depends on the workbench layout, which is shell-friendly
- Future TS rewrite remains possible as Phase 4 (a deliberate later plan), once we know which scripts actually need in-process testing vs end-to-end testing

**Consequences.**
- No `apps/indusk-mcp/src/lib/worktree/` TS module in v1
- Tests are end-to-end subprocess tests (spawn bash, assert exit code + filesystem state) — same shape as `telemetry-cli-lifecycle.test.ts`
- `lib/scm` is not directly imported; the bash scripts use `git` directly (which is fine — workbench currently always wraps git repos, jj routing through lib/scm was only relevant for indusk-mcp internals)
- If a future wrapped repo is jj-backed, the bash scripts will need a small `jj_or_git` helper — flagged as out-of-scope for v1, fix-on-demand

## Decision 3: Numero adopts the workbench pattern at `~/code/sandbox/numero-workbench/`

**Decision.** Create a new workbench at `~/code/sandbox/numero-workbench/`. Inside it:
- `production/numero` — symlink to `../numero` (existing clone stays where it is)
- `worktrees/` — directory for active feature branches
- `.indusk/` — workbench's InDusk state (config, planning, eval, highlights, worktree-configs)
- `package.json`, `ce.json` — minimal workbench scaffolding (the `pnpm wt` scripts get registered here)

**Why.**
- Sibling pattern matches `dawn-fde-toolkit` exactly — no new mental model
- Existing `~/code/sandbox/numero/` clone keeps its on-disk path (zero muscle-memory loss, no risk to in-flight branches/PRs)
- Workbench is the InDusk project; numero clone is "just code with a `.git/`" — clean separation of state vs code

**Migration steps (v1, run once during impl):**

1. `mkdir -p ~/code/sandbox/numero-workbench/{production,worktrees}`
2. `ln -s ../numero ~/code/sandbox/numero-workbench/production/numero`
3. `cd ~/code/sandbox/numero-workbench && indusk init --workbench` (assumes Decision 7 below: init learns a `--workbench` flag)
4. **Migrate state** — move (not copy) `~/code/sandbox/numero/.indusk/` → `~/code/sandbox/numero-workbench/.indusk/`. This is the load-bearing step: it preserves all planning history, eval results, highlights. The clone's `.indusk/` directory ceases to exist; the clone goes back to being "just code"
5. `indusk extensions enable worktree` from the workbench
6. **Re-register** with admin UI + telemetry registries: deregister `numero` at the clone path; register `numero` at the workbench path. Admin UI URL `/p/numero/` continues to work (same name, different path)
7. Existing native git worktrees (per the research doc, numero has some in `.git/worktrees/`) get re-created under `~/code/sandbox/numero-workbench/worktrees/` using `indusk worktree create` — this is a one-time inconvenience, the upside is one shared `.indusk/` for all future worktree work

**Consequences.**
- The clone's path stays usable for raw `git` operations (no path-typing change for the underlying repo)
- Future `cd ~/code/sandbox/numero` works for code-level operations but won't have InDusk affordances — agents are expected to operate from the workbench root or via `pnpm wt <slug> <cmd>` from anywhere
- The admin UI registry's `~/code/sandbox/numero/` entry becomes stale during migration; the impl includes the deregister-then-reregister step explicitly

## Decision 4: Canonical-clone parent dir lives in the workbench's `.indusk/config.json`

**Decision.** Add a new top-level field `worktree.sibling_parent` to the workbench's `.indusk/config.json`. Replaces the hardcoded `SIBLING_PARENT="$HOME/code/lazer/avoca"` in `setup-worktree.sh:33`. Per-workbench, not per-wrapped-repo — every wrapped repo in a given workbench lives under the same parent dir by convention (dawn-fde-toolkit's wrapped repos all live under `~/code/lazer/avoca/`; numero-workbench's wrapped repo lives under `~/code/sandbox/`).

Example: `numero-workbench/.indusk/config.json`:
```json
{
  "mode": "full",
  "scm": "git",
  "worktree": {
    "sibling_parent": "~/code/sandbox",
    "shape": "workbench"
  }
}
```

**Why.** Per-workbench (not per-repo) is correct because the value answers "where do the canonical clones this workbench wraps live?" — and in practice that's one location per workbench. Per-repo would force redundant declarations.

`.indusk/worktree-configs/<repo>.json` continues to hold per-repo config (trunk path, copy_files, apply_commits, preflight) — those genuinely vary per wrapped repo.

**Consequences.**
- `setup-worktree.sh` and `refresh-worktree.sh` read `worktree.sibling_parent` from `.indusk/config.json` at the workbench root (find via walking up from cwd until a config.json with `worktree.shape: "workbench"` exists)
- The bash scripts add a small `_resolve_workbench_root()` helper. ~10 LOC
- `wt.sh` does NOT need `sibling_parent` — it only resolves `worktrees/<slug>` and `production/<slug>` which are local paths. Only the create/refresh scripts that author worktrees as siblings of canonical clones need it

## Decision 5: Starter `.indusk/worktree-configs/<repo>.json`

**Decision.** The extension's `on_enable` hook scaffolds a starter config when none exists. Shape derived from dawn-fde-toolkit's `avoca-next.json`. Includes a `composeProjectName` recommendation (cross-cwd targeting per A18).

```json
{
  "$schema": "../../node_modules/@infinitedusky/indusk-mcp/extensions/worktree/config.schema.json",
  "trunk_branch": "main",
  "base_branch": "main",
  "copy_files": [],
  "append_files": [],
  "apply_commits": [],
  "preflight": [
    {
      "name": "biome",
      "command": "pnpm biome check $CHANGED_FILES_BIOME",
      "when": "CHANGED_FILES_BIOME"
    }
  ],
  "preflight_env": {
    "MIGRATIONS_RELEVANT": ["packages/db/migrations/**"]
  },
  "compose_project_name": "<repo>"
}
```

**Why.** Concrete starter, not a placeholder — adopters can `indusk worktree create <slug>` and have things work without writing config from scratch. The `composeProjectName` field defaults to the wrapped repo's name (e.g., `numero`); adopters can override per workbench. The starter `preflight` block exercises the biome shape so A9 has something to validate against immediately.

**Consequences.**
- Adopters who want a different shape edit the config; the starter is opinionated but not load-bearing
- The schema lives in the extension's source tree and is referenced via `$schema`; validation is best-effort (LSPs may not resolve the relative path, but `indusk worktree list` validates structurally per A11/A12)

## Decision 6: `.fde-overrides.env` stays as an optional pattern, NOT canonized

**Decision.** The extension does NOT scaffold a `.fde-overrides.env` file or composable.env contract for it. The pattern is documented in the extension's `skill.md` (for FDEs using composable.env-based env management) but adopters who don't use composable.env or who want a different override shape are not forced into it.

**Why.** `.fde-overrides.env` is dawn-fde-toolkit-specific convention, not universal. The composable.env integration in numero-workbench may or may not adopt the same shape. Canonizing it now would constrain future adopters whose env-management story differs.

**Consequences.**
- `on_enable` does not touch `env/components/` or `env/contracts/`
- Brief's Phase 3 (composable.env integration) remains optional and per-adopter
- Documentation in skill.md explains the pattern for FDEs who want it

## Decision 7: `refresh-worktree.sh` clears skip-worktree flags for removed entries (fix-in-scope)

**Decision.** The bash port of `refresh-worktree.sh` includes a fix the original script doesn't have: when entries are removed from `apply_commits[]` between two refresh runs, the script clears the skip-worktree flags those entries set. Without this, files keep their stale overlay invisibly. The research doc flagged this as A4's hidden requirement.

**Why.** A4 in the test-plan explicitly asserts this behavior. The original script ships without it (research doc finding 2). Carrying forward unfixed would mean A4 either fails on the dogfood OR gets weakened — neither is acceptable for state-integrity work.

**Consequences.**
- `refresh-worktree.sh` adds a "diff against previous run" step: compare current `apply_commits[]` against the last-run snapshot, find entries removed, run `git update-index --no-skip-worktree` for each
- Previous-run snapshot lives in `worktrees/<slug>/.indusk-overlay-state.json` (workbench-internal state file, gitignored)
- vitest integration test for A4 explicitly removes an entry, runs refresh, and asserts `git status` reflects current state (the test that the brief implied but didn't pin)

## Decision 8: `init` learns a `--workbench` flag

**Decision.** `indusk init --workbench` is a new init shape that scaffolds a workbench-shaped project (creates `production/` + `worktrees/` directories, marks `worktree.shape: "workbench"` in `.indusk/config.json`, registers `worktree` extension as required, accepts `--sibling-parent <path>` to set the canonical-clone parent dir).

Plain `indusk init` is unchanged — single-repo InDusk projects still work, just won't get the worktree extension auto-enabled.

**Why.** Today, creating a workbench requires manual `mkdir production worktrees && indusk init && indusk extensions enable worktree && hand-edit .indusk/config.json`. That's three deliberate moves where one would do. A `--workbench` flag collapses the ritual to a single command and makes the workbench shape a first-class init mode.

**Consequences.**
- `apps/indusk-mcp/src/bin/commands/init.ts` gains the flag and the workbench-mode branch (~80 LOC estimated)
- New test in `apps/indusk-mcp/src/__tests__/init-workbench.test.ts` asserts the workbench scaffolding outcomes
- The numero-workbench migration (Decision 3) uses `indusk init --workbench` rather than manual scaffolding

## What the extension does NOT do (v1 boundaries)

- No support for plain (non-workbench) projects with worktrees (per scope confirmation)
- No `indusk worktree remove` / `prune` — manual cleanup only (per brief)
- No orphan-worktree detection (per brief)
- No cross-FDE shared config registry (Phase 4 of brief)
- No ce-binary modifications (per brief)
- No TypeScript port of bash scripts (per Decision 2)
- No automatic `.fde-overrides.env` scaffolding (per Decision 6)
- No jj-backed wrapped-repo support (per Decision 2 consequences)

## Test-plan reconciliation

All 17 A-assertions + new A18 in revision 4 of the test-plan are addressable by the decisions above:

| Assertion | Addressed by |
|---|---|
| A1, A2 (setup mechanics) | Decision 2 (bash port) + Decision 7 (init --workbench scaffolds the workbench) |
| A3, A4 (apply_commits + refresh) | Decision 7 (fix-in-scope for clearing skip-worktree) |
| A5, A6, A7 (wt resolution + pm2) | Decision 1 (bare wt form) |
| A8 (ce composition) | Decision 1 (bare wt + ce inside) |
| A9, A10 (preflight) | Decision 5 (starter config exercises biome) |
| A11, A12 (list + validation) | Decision 5 (schema + structural validation) |
| A13 (dual-workbench parity) | Decision 3 (numero-workbench migration) + Decision 2 (single bash impl, no workbench-specific branches) |
| A14 (idempotency) | Decision 2 (bash port carries the existing safeguard) |
| A15 (required: false) | Extension manifest declares it; `autoEnableExtensions` honors it (no new code) |
| A16 (enable scaffolds local CLI) | Decision 5 (starter config) + on_enable hook registers pnpm scripts |
| A17 (preflight env contract) | Decision 5 (preflight_env schema in starter config) |
| A18 (composeProjectName cross-cwd) | Decision 5 (starter config recommends the field) + adopters set it per workbench |

## Open items folded to impl

- Exact bash-script line counts and where each script lives in `apps/indusk-mcp/extensions/worktree/scripts/`
- Schema file format and validation library choice
- The `.indusk-overlay-state.json` schema (Decision 7's internal state file)
- ce.json contents for the bootstrap `numero-workbench` (specifically `composeProjectName: "numero"` and any profile shape)
- `indusk init --workbench` flag parsing and the `--sibling-parent` default behavior

These don't change the architectural decisions above; they're impl-phase details.
