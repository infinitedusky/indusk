---
name: worktree
description: Per-repo worktree management for workbench-shaped indusk projects. One `.indusk/` per workbench survives worktree create/destroy; bare `pnpm wt <slug> <cmd>` is the execution surface; `composeProjectName` enables cross-cwd docker-compose targeting.
type: extension
---

# Worktree

> **Status (2026-05-27)**: under active development on the `indusk-worktree-extension` plan. The manifest and skill (this file) are Phase 1. CLI commands (`indusk worktree create/refresh/list/preflight`), bash scripts (`pnpm wt`, `pnpm wt:pm2`, `preflight`), and the `indusk init --workbench` flag ship across Phases 2–6. Numero migration + dual-workbench dogfood close out Phase 7. Until then, this skill is the design reference; the actual surface may not all exist yet.

## What this extension is for

**Multi-worktree development with one `.indusk/` per project.** The problem it solves: when you create git worktrees of an indusk project, `.indusk/` state (plans, highlights, eval results, config) gets duplicated across worktrees and either has to be merged or risks being lost. The workbench pattern eliminates that — one `.indusk/` at the workbench root; code (with `.git/`) in symlinked subdirs that never carry `.indusk/` content.

This is a hard prerequisite for I.1 (`handoff-multi-agent`): the per-agent presence files that solve the multi-Claude-session collision problem live in the workbench's single `.indusk/`. Without the workbench shape, there's nowhere coherent to put them.

## Workbench layout

A workbench is just an indusk project with a specific directory shape:

```
my-workbench/                       # the indusk project
├── .indusk/                        # single source of truth — plans, eval, highlights, worktree-configs
│   ├── config.json                 # `worktree.shape: "workbench"` + `worktree.sibling_parent`
│   └── worktree-configs/
│       └── <repo>.json             # per-wrapped-repo config (copy_files, apply_commits, preflight, etc.)
├── production/
│   └── <repo>                      # symlink → canonical clone (the actual git repo)
├── worktrees/
│   └── <slug>/                     # active feature branch worktrees (git worktree add'd from production/<repo>)
├── ce.json                         # composable.env config, optionally with `composeProjectName: "<repo>"`
└── package.json                    # has `wt`, `wt:pm2`, `preflight` scripts
```

The wrapped repo's canonical clone lives elsewhere on disk (typically `~/code/<area>/<repo>`); the workbench's `production/<repo>` is a symlink to it. The clone keeps its own `.git/`; the workbench keeps the `.indusk/`.

## When to enable

Enable this extension on:
- A new workbench bootstrapped via `indusk init --workbench --sibling-parent <path>`
- An existing single-repo indusk project being converted to workbench shape (see the numero migration in `.indusk/planning/indusk-worktree-extension/impl.md` Phase 7 for the conversion pattern)

Do NOT enable on:
- A single-repo indusk project that doesn't intend to grow into a workbench — the extension assumes `production/` + `worktrees/` exist; without them, every command errors
- A repo that's a wrapped-repo target (the canonical clone) — the workbench is the indusk project, not the clone

The extension is `required: false` and has no auto-detection. It only lands via explicit `indusk extensions enable worktree`.

## The CLI surface

Four state-management commands, all run from the workbench root:

### `indusk worktree create <repo> <slug> [base-branch]`

Creates a new worktree at `worktrees/<slug>/`, branched off `<base-branch>` (default per the repo's `.indusk/worktree-configs/<repo>.json`'s `base_branch`). Applies the config's `copy_files[]` and `append_files[]` declarations. Applies any `apply_commits[]` entries as **upstream-file-overlay** (full-file replacement via `git show <sha>:<file>` followed by `git update-index --skip-worktree`), NOT cherry-pick — the overlay files are invisible to `git status` / `git diff` / `git commit -a`. Idempotent: invoking twice with the same `<repo> <slug>` exits non-zero with "worktree already exists at <path>".

### `indusk worktree refresh <slug>`

Re-applies the wrapped repo's config to an existing worktree. If `apply_commits[]` has entries removed since the last refresh, clears the corresponding skip-worktree flags so `git status` reflects current state. Workbench-internal state file `worktrees/<slug>/.indusk-overlay-state.json` tracks the prior run's overlay snapshot; it is gitignored.

### `indusk worktree list`

Tabulates every wrapped repo in the workbench with a status badge:
- `(config valid)` — schema-conformant `.indusk/worktree-configs/<repo>.json` + worktrees present
- `(config missing)` — no config file for this `production/<repo>`
- `(no worktrees)` — config present, no worktrees yet created

### `indusk worktree preflight <slug>`

Runs the wrapped repo's `preflight[]` commands against the worktree's diff vs base branch. Exits non-zero on any command failure; stderr surfaces the violations. Exports a stable env contract to each preflight command:
- `CHANGED_FILES` — full list of files changed vs base
- `CHANGED_FILES_BIOME` — same list filtered to biome-relevant extensions
- Any declarative `preflight_env{}` derived booleans (e.g., `MIGRATIONS_RELEVANT=true` when `packages/db/migrations/**` matches)

Out of scope: `remove`, `prune`, orphan-worktree detection. These are manual operations in v1.

## The execution surface — bare `pnpm wt`

The user-facing run-anything surface is `pnpm wt <slug>[:<app>] <command> [args...]`. This matches the shape `dawn-fde-toolkit` ships today.

Resolution is two-pass:
1. Match `<slug>` against `worktrees/<slug>/`
2. Match `<slug>` against `production/<slug>/`

Suffix-match fallback if exact match fails. Exact match wins; ambiguous match errors with the candidates listed; zero match errors with the search paths.

`:<app>` suffix changes the resolved dir from `<resolved>` to `<resolved>/apps/<app>`.

Examples:
- `pnpm wt cancel-polish dev` — cd to `worktrees/cancel-polish/`, run `pnpm dev`
- `pnpm wt cancel-polish:web build` — cd to `worktrees/cancel-polish/apps/web/`, run `pnpm build`
- `pnpm wt trunk lint` — cd to `production/<default-repo>/`, run `pnpm lint`
- `pnpm wt numero dev` — cd to `production/numero/`, run `pnpm dev`

Trunk is always addressable without an `indusk worktree create` step — both `pnpm wt trunk` and `pnpm wt <wrapped-repo-name>` work as soon as the workbench is configured.

### Composing with composable.env

ce composition works inside the bare form: `pnpm wt <slug> ce <ce-cmd>`. The wt script cd's into the worktree dir, then invokes `pnpm ce <ce-cmd>` from there — composable.env picks up the worktree's `.env.local` because that's the cwd.

Example: `pnpm wt cancel-polish ce dc:up local` brings docker-compose up with the `local` profile against the cancel-polish worktree's env, not the trunk's.

### `pnpm wt:pm2` — multi-process orchestration

For parallel dev-server orchestration across worktrees/apps:

```
pnpm wt:pm2 <target>:<app> <cmd> [<target>:<app> <cmd>]...
```

Each `<target>:<app> <cmd>` pair launches as a named pm2 process (name format: `wt-<slug>-<app>`). Single invocation, N pm2 processes. Visible in `pm2 list`. The colon in `wt:pm2` is fine — it's a top-level pnpm script name, not a wildcard.

## `composeProjectName` — cross-cwd docker-compose targeting

A new capability in composable.env ≥ 1.37.7 the worktree extension exploits. Workbench's `ce.json` declares a top-level `composeProjectName` field:

```json
{
  "envDir": "env",
  "defaultProfile": "local",
  "scaffold": "docker",
  "composeProjectName": "numero",
  "profiles": { /* ... */ }
}
```

With it pinned, every `docker compose` invocation that ce generates addresses the named project regardless of cwd. Practical effect:

```
# From the worktree, bring the stack up:
cd worktrees/cancel-polish && pnpm wt cancel-polish ce dc:up local

# From the workbench root, inspect or stop it — no need to cd back:
pnpm ce dc:logs
pnpm ce dc:down
```

The `up` command still needs to be invoked from the worktree so ce reads the right env, but lifecycle/inspection is now cwd-free.

**Tradeoff: only one stack per repo can run at a time.** The project name is pinned — running `dc:up local` from a second worktree of the same repo replaces the first stack's containers. For typical FDE workflows where a single active worktree's stack is the norm, this is the right tradeoff. Multi-active-worktree scenarios are deliberately out of scope; if you need them, don't pin `composeProjectName`.

The starter `.indusk/worktree-configs/<repo>.json` materialized by `indusk extensions enable worktree` includes a `compose_project_name` recommendation defaulting to `<repo>`.

## The per-repo config

`.indusk/worktree-configs/<repo>.json` is the source of truth for what worktrees of `<repo>` look like and how they get assembled. Shape (defined by `apps/indusk-mcp/extensions/worktree/config.schema.json`):

```json
{
  "trunk_branch": "main",
  "base_branch": "main",
  "copy_files": [
    { "src": ".env.example", "dest": ".env.local" }
  ],
  "append_files": [
    { "src": ".gitignore.local", "dest": ".gitignore" }
  ],
  "apply_commits": [
    { "sha": "abc123", "files": ["packages/types/index.ts"] }
  ],
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
  "compose_project_name": "numero"
}
```

Field semantics:
- `trunk_branch` / `base_branch` — what branch to create from; usually both `main`
- `copy_files[]` — files copied from canonical clone to new worktree at create time
- `append_files[]` — files concatenated onto existing destination files under a sentinel header
- `apply_commits[]` — upstream-file-overlay entries; see `indusk worktree create` above for semantics
- `preflight[]` — commands to run as preflight; each has `name`, `command`, and optional `when` (env var name that must be truthy)
- `preflight_env{}` — declarative path filters; for each key, glob-match its patterns against `CHANGED_FILES` and export the key as a truthy env var on match
- `compose_project_name` — populates `ce.json`'s `composeProjectName` field for the workbench (cross-cwd docker-compose targeting)

Malformed configs produce clear errors at validation time naming the offending field — not stack traces.

## Cross-references

- **composable-env skill** — for ce-specific commands (`dc:up`, profiles, `env:build`). Worktree extension composes with ce; doesn't replace it
- **git skill** (`skills/git.md`) — for the underlying git operations the worktree extension orchestrates
- **handoff-multi-agent plan** (`.indusk/planning/handoff-multi-agent/brief.md`) — the multi-agent-coordination plan this extension unblocks
- **ADR** (`.indusk/planning/indusk-worktree-extension/adr.md`) — full decision rationale including why bash port, why bare `pnpm wt`, why workbench-only

## Anti-patterns

- **Don't enable on a single-repo indusk project hoping to use the CLI commands without restructuring.** The commands assume `production/` + `worktrees/`. Convert to a workbench first (see Phase 7 of impl.md for the migration pattern) or skip the extension.
- **Don't commit `.indusk-overlay-state.json`.** It's workbench-internal state tracking the prior `apply_commits[]` snapshot for the refresh-clear-skip-worktree behavior. Gitignored automatically; do not version it.
- **Don't use `git cherry-pick` to apply upstream commits when `apply_commits[]` would do.** The extension's upstream-file-overlay is intentional — files stay invisible to `git status` so the overlay doesn't pollute your worktree's diff. Cherry-pick would leak them.
- **Don't pin `composeProjectName` when you genuinely need multiple parallel worktree stacks of the same repo.** It's a deliberate one-stack-per-repo constraint; omit the field if multi-stack is the norm for your workflow.
