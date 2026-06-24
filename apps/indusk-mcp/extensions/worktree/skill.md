---
name: worktree
description: Single-repo worktree management for workbench-shaped indusk projects. One `.indusk/` survives worktree create/destroy; flat workbench layout (trunk + worktrees side-by-side at workbench root); bare `pnpm wt <slug> <cmd>` execution surface; `composeProjectName` enables cross-cwd docker-compose targeting.
type: extension
---

# Worktree

> **Status (2026-05-28)**: under active development on the `indusk-worktree-extension` plan. Phase 1 = manifest + skill (this file). CLI commands (`indusk worktree create/refresh/list/preflight`), bash scripts (`pnpm wt`, `pnpm wt:pm2`, `preflight`), and the `indusk init --workbench` flag ship across Phases 2–6. Numero migration + demo-workbench dogfood close Phase 7.
>
> **Shape revision 2026-05-28**: workbench layout is flat (trunk symlink + worktrees as siblings at workbench root). Earlier `production/<repo>` + `worktrees/<slug>/` split is dropped. Multi-repo workbench support (one workbench wrapping N repos) is deferred to a future "FDE agency" plan; v1 is single-repo only.

## What this extension is for

**Multi-worktree development with one `.indusk/` per project.** The problem it solves: when you create git worktrees of an indusk project, `.indusk/` state (plans, highlights, eval results, config) gets duplicated across worktrees and either has to be merged or risks being lost. The workbench pattern eliminates that — one `.indusk/` at the workbench root; code (with `.git/`) lives in the symlinked trunk and in worktrees that share that trunk's history.

This is a hard prerequisite for I.1 (`handoff-multi-agent`): the per-agent presence files that solve the multi-Claude-session collision problem live in the workbench's single `.indusk/`. Without the workbench shape, there's nowhere coherent to put them.

## Workbench layout (flat, single-repo)

A workbench is an indusk project with this shape:

```
my-workbench/                  # the indusk project
├── .indusk/                   # single source of truth — plans, eval, highlights, worktree-configs
│   ├── config.json            # `worktree.shape: "workbench"` + `worktree.wrapped_repo` + `worktree.sibling_parent`
│   └── worktree-configs/
│       └── <repo>.json        # per-wrapped-repo config (copy_files, apply_commits, preflight, etc.)
├── <repo>                     # symlink → canonical clone (the trunk; name matches `wrapped_repo`)
├── <slug-1>/                  # active worktree (git worktree add'd from the trunk)
├── <slug-2>/                  # another active worktree
├── ce.json                    # composable.env config, optionally with `composeProjectName: "<repo>"`
└── package.json               # has `wt`, `wt:pm2`, `preflight` scripts
```

The wrapped repo's canonical clone lives elsewhere on disk (typically `~/code/<area>/<repo>`); the workbench's `<repo>` symlink points to it. The clone keeps its own `.git/`; the workbench keeps the `.indusk/`. Worktrees are created via `git worktree add` from inside the trunk symlink and land as siblings of the trunk.

**Trunk vs worktrees**: identified by config (`worktree.wrapped_repo` names the trunk) and structurally (the trunk is a symlink; worktrees are real directories). Worktree slugs must not collide with the trunk's name.

## When to enable

Enable this extension on:
- A new workbench bootstrapped via `indusk init --workbench --wrapped-repo <name> --sibling-parent <path>`
- An existing single-repo indusk project being converted to workbench shape (see the numero migration in `.indusk/planning/indusk-worktree-extension/impl.md` Phase 7 for the conversion pattern)

Do NOT enable on:
- A single-repo indusk project that doesn't intend to grow into a workbench — the extension assumes the flat workbench layout above; without it, every command errors
- A repo that's a wrapped-repo target (the canonical clone) — the workbench is the indusk project, not the clone

The extension is `required: false` and has no auto-detection. It only lands via explicit `indusk extensions enable worktree`.

## The CLI surface

Four state-management commands, all run from the workbench root:

### `indusk worktree create <slug> [base-branch]`

Creates a new worktree at `<workbench-root>/<slug>/`, branched off `<base-branch>` (default per `.indusk/worktree-configs/<wrapped_repo>.json`'s `base_branch`). Applies the config's `copy_files[]` and `append_files[]` declarations. Applies any `apply_commits[]` entries as **upstream-file-overlay** (full-file replacement via `git show <sha>:<file>` followed by `git update-index --skip-worktree`), NOT cherry-pick — the overlay files are invisible to `git status` / `git diff` / `git commit -a`. After setup, env is **auto-provisioned** (doppler extension, if configured) and the config's **`post_create[]`** shell commands run in order inside the new worktree — `pnpm install`, build, anything — so `create` yields a *runnable* worktree in one shot, not a bare checkout. A `post_create` command that exits non-zero stops the rest and prints what to re-run. Idempotent: invoking twice with the same `<slug>` exits non-zero with "worktree already exists at <path>".

The `<repo>` argument from the multi-repo design is dropped — single-repo workbenches know their wrapped repo from `worktree.wrapped_repo` in `.indusk/config.json`.

### `indusk worktree refresh <slug>`

Re-applies the wrapped repo's config to an existing worktree. If `apply_commits[]` has entries removed since the last refresh, clears the corresponding skip-worktree flags so `git status` reflects current state. Workbench-internal state file `<slug>/.indusk-overlay-state.json` tracks the prior run's overlay snapshot; it is gitignored.

### `indusk worktree list`

Tabulates the wrapped repo's status: trunk path + worktree slugs at workbench root + status badge:
- `(config valid)` — schema-conformant `.indusk/worktree-configs/<repo>.json` + trunk symlink resolves
- `(config missing)` — no config file for the wrapped repo
- `(no worktrees)` — config present, trunk healthy, no worktrees yet created

### `indusk worktree preflight <slug>`

Runs the wrapped repo's `preflight[]` commands against the worktree's diff vs base branch. Exits non-zero on any command failure; stderr surfaces the violations. Exports a stable env contract to each preflight command:
- `CHANGED_FILES` — full list of files changed vs base
- `CHANGED_FILES_BIOME` — same list filtered to biome-relevant extensions
- Any declarative `preflight_env{}` derived booleans (e.g., `MIGRATIONS_RELEVANT=true` when `packages/db/migrations/**` matches)

Out of scope: `remove`, `prune`, orphan-worktree detection. These are manual operations in v1.

## The execution surface — bare `pnpm wt`

The user-facing run-anything surface is `pnpm wt <slug>[:<app>] <command> [args...]`. This matches the shape `dawn-fde-toolkit` ships today, simplified for single-repo.

Resolution is a single-pass lookup against subdirs at workbench root. Exact match wins; suffix-match fallback; ambiguous match errors with the candidates listed; zero match errors with the searched directory.

`:<app>` suffix changes the resolved dir from `<resolved>` to `<resolved>/apps/<app>`.

Examples (workbench is wrapping `numero`):
- `pnpm wt cancel-polish dev` — cd to `<workbench>/cancel-polish/`, run `pnpm dev`
- `pnpm wt cancel-polish:web build` — cd to `<workbench>/cancel-polish/apps/web/`, run `pnpm build`
- `pnpm wt numero lint` — cd to `<workbench>/numero/` (the trunk symlink), run `pnpm lint`
- `pnpm wt cancel-polish ce dc:up local` — cd to `<workbench>/cancel-polish/`, run `pnpm ce dc:up local` (ce reads the worktree's env)

The trunk is addressable by its repo name (`pnpm wt numero ...`). No `pnpm wt trunk` alias — keeps the surface minimal; the repo name is already in `worktree.wrapped_repo` config and stable.

### Composing with composable.env

ce composition works inside the bare form: `pnpm wt <slug> ce <ce-cmd>`. wt.sh cd's into the worktree dir, then invokes `pnpm ce <ce-cmd>` from there — composable.env picks up the worktree's `.env.local` because that's the cwd.

### `pnpm wt:pm2` — multi-process orchestration

For parallel dev-server orchestration across worktrees/apps:

```
pnpm wt:pm2 <target>:<app> <cmd> [<target>:<app> <cmd>]...
```

Each `<target>:<app> <cmd>` pair launches as a named pm2 process (name format: `wt-<slug>-<app>`). Single invocation, N pm2 processes. Visible in `pm2 list`.

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
cd cancel-polish && pnpm wt cancel-polish ce dc:up local

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
  "compose_project_name": "numero",
  "post_create": ["pnpm install", "pnpm build"]
}
```

Field semantics:
- `trunk_branch` / `base_branch` — what branch to create from; usually both `main`
- `copy_files[]` — files copied from canonical clone to new worktree at create time
- `append_files[]` — files concatenated onto existing destination files under a sentinel header
- `apply_commits[]` — upstream-file-overlay entries; see `indusk worktree create` above for semantics
- `preflight[]` — commands to run as preflight; each has `name`, `command`, and optional `when` (env var name that must be truthy)
- `preflight_env{}` — declarative path filters; for each key, glob-match its patterns against `CHANGED_FILES` and export the key as a truthy env var on match
- `compose_project_name` — populates `ce.json`'s `composeProjectName` (cross-cwd docker-compose targeting). The same one-stack-per-repo model applies to plain docker-compose via the compose file's `name:` field — the doppler/default world
- `post_create[]` — shell commands run in order inside a new worktree after create + env provisioning (`pnpm install`, build, etc.); first non-zero exit stops the rest and prints what to re-run. Makes `indusk worktree create` yield a *runnable* worktree

Malformed configs produce clear errors at validation time naming the offending field — not stack traces.

## Cross-references

- **composable-env skill** — for ce-specific commands (`dc:up`, profiles, `env:build`). Worktree extension composes with ce; doesn't replace it
- **git skill** (`skills/git.md`) — for the underlying git operations the worktree extension orchestrates
- **handoff-multi-agent plan** (`.indusk/planning/handoff-multi-agent/brief.md`) — the multi-agent-coordination plan this extension unblocks
- **ADR** (`.indusk/planning/indusk-worktree-extension/adr.md`) — full decision rationale including why bash port, why bare `pnpm wt`, why workbench-only, why flat-vs-split layout

## Multi-repo workbenches: deferred

v1 wraps exactly ONE repo per workbench. The pattern dawn-fde-toolkit established (one workbench wrapping `avoca-next` + `claude-skills` + `vapi` side-by-side) is out of scope for v1 and deferred to a future "FDE agency" plan that addresses the relational + multi-engagement concerns it surfaces. If your work needs multi-repo today, dawn-fde-toolkit's ad-hoc scripts continue to work; the worktree extension just doesn't replace them in that mode yet.

## Anti-patterns

- **Don't enable on a single-repo indusk project hoping to use the CLI commands without restructuring.** The commands assume the flat workbench layout. Convert to a workbench first (see Phase 7 of impl.md for the migration pattern) or skip the extension.
- **Don't name a worktree the same as the wrapped repo.** Resolution would be ambiguous. The validator rejects this at create time.
- **Don't commit `<slug>/.indusk-overlay-state.json`.** It's workbench-internal state tracking the prior `apply_commits[]` snapshot for the refresh-clear-skip-worktree behavior. Gitignored automatically; do not version it.
- **Don't use `git cherry-pick` to apply upstream commits when `apply_commits[]` would do.** The extension's upstream-file-overlay is intentional — files stay invisible to `git status` so the overlay doesn't pollute your worktree's diff. Cherry-pick would leak them.
- **Don't pin `composeProjectName` when you genuinely need multiple parallel worktree stacks of the same repo.** It's a deliberate one-stack-per-repo constraint; omit the field if multi-stack is the norm for your workflow.
