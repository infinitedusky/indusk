---
title: InDusk Worktree Extension — Brief (for sharing with the InDusk team)
created: 2026-05-09
updated: 2026-05-20
status: accepted
audience: InDusk maintainers + Lazer FDE peers (external) + dusk impl (internal)
plan_type: implementation plan with external brief (dogfood on dusk + Numero; brief remains the external-facing artifact)
---

# InDusk Worktree Extension — Brief

## TL;DR

Lazer FDEs work in multiple client repos in parallel. Across the last six weeks of work at Avoca, we've built a small but load-bearing toolkit pattern in `dawn-fde-toolkit` that wraps git worktrees, per-client env file management, and a CI-equivalent preflight check. Every Lazer FDE who lands in a similar engagement re-invents this wheel by hand, badly.

This brief proposes upstreaming the durable parts as an InDusk extension so future FDEs get the same scaffolding from `indusk update`, parameterized per client engagement via a small JSON config.

## Audience for this brief

- **InDusk maintainers** — to evaluate whether the surface area, dependencies, and config schema fit InDusk's design.
- **Lazer FDE peers** — to react to the workflow shape ("does this match how I'd want to work?") and contribute the patterns from their own engagements.

## The problem

An FDE engagement typically looks like:

- One **toolkit repo** (workbench) — the FDE's home directory. Holds plans, captured client docs, scratch apps, internal scripts.
- N **client repos** the FDE works in (`avoca-next`, `claude-skills`, `vapi`, etc.) — these stay pristine and never carry FDE-internal scaffolding.
- M **active feature branches per client repo** — each in its own git worktree so dev servers, build caches, and uncommitted state don't fight each other.

Without scaffolding, every FDE rediscovers the same friction:

1. **Worktree creation is multi-step**: `git worktree add` is one command, but the actual setup is "create worktree + copy `.npmrc` + copy `.env.local` + append per-client overrides + symlink into a known location for IDE access." Easy to miss a step. Different per client.
2. **Per-client env files vary**: `avoca-next` puts FDE-only env vars in `apps/web/.env.local`. Other clients use root `.env`. Some need `.npmrc` for private registries. Some need bun-lock copying. The mapping is per-client and isn't anywhere except the FDE's head.
3. **Running commands inside a worktree is verbose**: `cd ~/code/.../client.worktrees/<slug>/apps/web && pnpm dev` repeats forever. Easy to run a command in the wrong worktree (we did this multiple times during PR work and silently developed against the wrong code).
4. **CI preflight is per-client-CI-bespoke**: avoca-next's CI runs biome on changed-vs-main files, eslint on changed apps/web files (with one of three URL conventions), Hamming sims on a path filter, etc. Locally reproducing those checks before pushing requires knowing each rule's scope and replicating it. Without that, FDEs push and discover failures in CI 5 minutes later, repeatedly.
5. **Personal dev-env overrides are awkward**: Vapi tunnel hostnames, encryption keys, Inngest local-mode flags, FDE-tunnel URL overrides — these vary per FDE and don't belong in committed env files. Today they live as ad-hoc append blocks on each FDE's machine.
6. **Workbench philosophy bleeds**: without a clear toolkit-vs-client-repo separation, FDEs accidentally check in `.indusk/`, `.claude/`, planning artifacts, or their own scratch tooling into the client repo. Once committed, hard to remove cleanly.

## Prior art in `dawn-fde-toolkit` (Sandy's workbench)

Six durable scripts + patterns. All currently live in this single FDE's toolkit:

### `scripts/setup-worktree.sh`

```
Usage: setup-worktree.sh <repo-name> <slug> [base-branch]
```

For a given client repo and slug:
1. `git worktree add` at `~/code/<org>/<client>.worktrees/<slug>`
2. Branches off `<base-branch>` (default: `main`) as `<branch_prefix><slug>` per per-client config
3. Copies each path in `copy_files[]` from the canonical client clone into the new worktree (typical: `.npmrc`, `apps/web/.env.local`)
4. Appends each `append_files[]` entry — content from a toolkit-side file gets concatenated into a path inside the worktree. Used for FDE-specific env overrides that aren't in the client repo
5. Symlinks the worktree into `<toolkit>/worktrees/<repo>-<slug>` so the FDE's IDE always sees one canonical worktree directory

Per-client config lives at `.indusk/worktree-configs/<repo>.json`:

```json
{
  "repo": "avoca-next",
  "branch_prefix": "feat/",
  "default_base_branch": "main",
  "copy_files": [".npmrc", "apps/web/.env.local"],
  "append_files": [
    {
      "src": "env/avoca-next.fde-overrides.env",
      "dst": "apps/web/.env.local"
    }
  ],
  "preflight": [
    "if [ -n \"$CHANGED_FILES_BIOME\" ]; then pnpm exec biome check --no-errors-on-unmatched -- $CHANGED_FILES_BIOME; else echo 'biome: no eligible changed files'; fi",
    "if [ -n \"$CHANGED_FILES_ESLINT_WEB\" ]; then cd apps/web && NODE_OPTIONS=--max-old-space-size=20000 pnpm exec eslint -- $CHANGED_FILES_ESLINT_WEB; else echo 'eslint: no eligible changed files'; fi",
    "if [ \"$HAMMING_RELEVANT\" = \"true\" ]; then pnpm --filter web test -- --run tests/lib/hamming/tool-drift-check.test.ts && pnpm --filter web test:coverage-hamming; else echo 'hamming: no relevant files changed'; fi"
  ]
}
```

### `scripts/refresh-worktree.sh`

```
Usage: refresh-worktree.sh <slug>
```

Companion to `setup-worktree.sh` — refreshes an existing worktree after the base branch advances. Re-reads `copy_files[]` and `append_files[]` from the per-client config and re-applies them. Useful when the canonical client clone has a new `.env.local` or `.npmrc` change you need to pick up without nuking the worktree. Also re-applies any pending `apply_commits[]` cherry-picks (see "the upstream-overlay pattern" below) and clears stale `skip-worktree` flags for entries that have since merged.

### `scripts/wt.sh`

```
Usage: pnpm wt <slug>[:<app>] <command> [args...]

Examples:
  pnpm wt cancel-polish:web dev      # cd worktree/apps/web, run pnpm dev
  pnpm wt cancel-polish:web build    # cd worktree/apps/web, run pnpm build
  pnpm wt cancel-polish inngest      # cd apps/web, run pnpm inngest
  pnpm wt cancel-polish lint         # cd worktree root, run pnpm lint
```

Slug-resolves to a worktree (matches a name exactly OR ending in `-<slug>`), then runs `pnpm <command>` inside the right directory. Special-cases the `inngest` command to delegate to `apps/web/inngest`. Errors clearly on zero or multiple matches.

### `scripts/wt-pm2.sh`

```
Usage: wt-pm2 <slug>[:<app>] <command>
```

Sibling to `wt.sh` but routes through pm2 instead of running foreground. Used when multiple worktrees need to run their dev servers in parallel without juggling terminal tabs. `pm2 list` shows one named process per (worktree, app, command) combination — easy to start/stop selectively. Crash recovery is automatic via pm2's process supervisor.

### `scripts/preflight.sh`

```
Usage: pnpm preflight <slug> [base-branch]
```

For a given worktree:
1. Computes changed files vs the base branch (default `origin/main`) using `git merge-base` so the diff respects upstream history (including upstream force-pushes — see "Real failure modes we've hit" below).
2. Exports `CHANGED_FILES`, `CHANGED_FILES_BIOME` (space-separated, biome-eligible), `CHANGED_FILES_ESLINT_WEB` (space-separated, eslint-eligible, paths relative to `apps/web/`), and `HAMMING_RELEVANT` (boolean for path-filtered Hamming triggering) as env vars.
3. Reads the per-client config's `preflight[]` array and runs each command sequentially with those env vars available.
4. Exits non-zero on the first failure with the exact command that failed.

The result: if `pnpm preflight cancel-polish` exits 0, the equivalent CI workflows on the client's PR pass. If it exits non-zero, you fix locally before pushing.

### Composable.env contracts for FDE overrides

The `env/avoca-next.fde-overrides.env` file referenced in the worktree config is generated by composable.env from a contract:

```json
// env/contracts/avoca-next.contract.json
{
  "name": "avoca-next",
  "location": "env",
  "outputs": { "local": "avoca-next.fde-overrides.env" },
  "vars": {
    "WEBHOOK_API_KEY_ENCRYPTION_KEY": "${avoca.WEBHOOK_API_KEY_ENCRYPTION_KEY}",
    "INNGEST_DEV": "${avoca.INNGEST_DEV}",
    "ALLOWED_DEV_ORIGINS": "${avoca.ALLOWED_DEV_ORIGINS}",
    "RESPONDER_COMMON_WORKFLOW_URL": "${avoca.RESPONDER_COMMON_WORKFLOW_URL}"
  }
}
```

The component (`env/components/avoca.env`) holds non-secret values. Secret values reference `${secrets.X}` and resolve from `.env.secrets.shared` / `.env.secrets.local` (gitignored). One source of truth, regenerated via `pnpm ce build local`. Per-client envs follow the same shape — one component + one contract per client.

### `apply_commits[]` — the upstream-overlay pattern (load-bearing)

The most reusable mechanism in the toolkit, and the one a new FDE is least likely to invent on their own.

When you need an upstream commit that hasn't yet merged to land in your worktree — a typing fix, a bug fix in shared library code, a feature you depend on — without polluting your feature PR, the per-client config supports:

```jsonc
{
  "apply_commits": [
    {
      "sha": "abc1234",
      "_description": "shared lib type fix from upstream PR #4567",
      "_remove_when": "upstream PR #4567 merges to main",
      "skip_worktree": true
    }
  ]
}
```

For each entry, `setup-worktree.sh`:

1. `git cherry-pick <sha>` applies the change to the worktree's branch.
2. `git update-index --skip-worktree <files>` marks every touched file so git pretends they're unchanged — they no longer surface in `git status`, `git diff`, or `git commit -a`.

Net effect: the commit's contents are **live** in your working tree (dev server picks them up, code runs against them, tests see them) but **invisible** to git operations and structurally impossible to accidentally include in your feature PR.

When the upstream commit merges to main, you delete the entry from config. The next `refresh-worktree.sh` clears the skip-worktree flags and the change naturally reconciles with main.

This is the difference between "I'm blocked on upstream, can't ship until they merge" and "I'm working ahead, my PR stays clean." Promote this with the rest of the worktree extension — it's the single most differentiated affordance in the toolkit.

### Workbench symlink pattern

Documented in `.claude/lessons/workbench-symlink-pattern.md`. The toolkit's `worktrees/` directory contains symlinks to:
- Toolkit-internal worktrees (toolkit's own branches, for docs / scratch work)
- Client-repo worktrees (the actual client repo branches the FDE is shipping)

This lets the FDE's IDE be permanently anchored at the toolkit root, with one canonical view of all active worktrees. Tab completion, recent files, semantic search all work across worktrees without the FDE having to remember which workspace they're in.

### Real failure modes we've hit

Concrete bugs the scaffolding caught (or would have caught with proper preflight):

- **Editing the wrong worktree silently.** Multiple times an FDE was running their dev server in the previous worktree (different branch) and made changes / observed behavior against the wrong code. `wt.sh` makes the slug explicit so this stops happening.
- **CI lint workflow silent-skipping on force-push.** Avoca-next's lint.yml had `git fetch origin main --depth=1`, which combined with a force-pushed main caused `git merge-base` to fail, the diff to return empty, and the lint step to be silently skipped — workflow showing green. We caught it because preflight uses a deeper fetch and would have caught the issue locally before merge. (Submitted a fix back to Avoca; merged 2026-05-08.)
- **Missing FDE-specific env vars per worktree.** Without `setup-worktree.sh` copying `.env.local` and appending FDE-overrides, a fresh worktree was missing the encryption key for AutoOps credential decryption. Looked like a code bug; was actually env config drift.
- **Upstream type fix accidentally landing in a feature PR.** Before `apply_commits` + `skip_worktree`, we maintained an upstream type-fix as a regular local commit on the feature branch. A rebase to pick up main carried the type-fix into the PR — reviewers had to untangle two unrelated changes. The skip-worktree overlay pattern makes this structurally impossible: the upstream change is in the working tree but invisible to commits.

## Why InDusk is the right home

InDusk already owns:
- Per-project memory and feedback patterns
- A per-project `.claude/` and `.indusk/` directory convention
- Skills, lessons, hooks, and extensions
- The `indusk update` flow that propagates updates across projects

The worktree scaffolding is the same shape — per-project config, per-client conventions, machine-local state. It would slot in cleanly as an extension that:
- Reads from `.indusk/worktree-configs/<repo>.json` (the same convention we already use)
- Provides the four scripts as `indusk worktree <subcommand>` commands
- Composes with existing InDusk skills (`/work`, `/handoff`, etc.) which already assume worktree-style isolation

What InDusk would NOT take on:
- Per-FDE env values (those stay in machine-local secrets files)
- Per-FDE tunnel URLs (those stay in the FDE's local config)
- Anything that requires server-side state (current scaffolding is 100% local-machine)

## Proposed extension surface

A single `worktree` extension exposing four subcommands:

```
indusk worktree create <repo-name> <slug> [base-branch]
indusk worktree run <slug>[:<app>] <command> [args...]
indusk worktree preflight <slug> [base-branch]
indusk worktree list                          # show all worktrees + their config status
```

Plus a config schema:

```jsonc
// .indusk/worktree-configs/<repo>.json
{
  "$schema": "https://indusk.../schema/worktree-config.json",
  "repo": "avoca-next",
  "branch_prefix": "feat/",
  "default_base_branch": "main",
  "copy_files": [".npmrc", "apps/web/.env.local"],
  "append_files": [
    {
      "src": "env/avoca-next.fde-overrides.env",
      "dst": "apps/web/.env.local"
    }
  ],
  "apply_commits": [
    {
      "sha": "abc1234",
      "_description": "shared lib type fix from upstream PR #4567",
      "_remove_when": "upstream PR #4567 merges to main",
      "skip_worktree": true
    }
  ],
  "preflight": [
    "if [ -n \"$CHANGED_FILES_BIOME\" ]; then pnpm exec biome check ... -- $CHANGED_FILES_BIOME; ..."
  ]
}
```

The schema:
- Validates required fields (`repo`, `branch_prefix`, `default_base_branch`)
- Documents env vars provided to preflight commands (`CHANGED_FILES`, `CHANGED_FILES_BIOME`, etc.)
- Allows custom path filters per client (the `HAMMING_RELEVANT` boolean is avoca-specific; another client might need `STORYBOOK_RELEVANT` or `MIGRATIONS_RELEVANT` based on their CI)

To support arbitrary path-filter exports, the config could allow:

```jsonc
{
  "preflight_env": {
    "HAMMING_RELEVANT": {
      "type": "boolean-on-paths",
      "match": [
        "apps/web/lib/integrations/hamming*.ts",
        "apps/web/app/api/hamming/**",
        ...
      ]
    },
    "MIGRATIONS_RELEVANT": {
      "type": "boolean-on-paths",
      "match": ["supabase/migrations/**", "**/migrations/**"]
    }
  }
}
```

This makes the path-filter pattern declarative + reusable across clients.

## Surface revision (2026-05-20)

After the test-plan review, the user-facing surface reshapes to align with how `dawn-fde-toolkit` actually composes commands today:

**Execution moves to ce.** Instead of `indusk worktree run <slug> <cmd>`, the command-execution surface is `pnpm ce wt:<target> <command>`. ce is already the user's entry point for command composition (profiles, `dc:up`, env-aware execution); making it the worktree-aware entry point unifies the two-surface model the toolkit has today (`pnpm wt <slug> <cmd>` + `pnpm ce <cmd>`) into one ce-mediated surface in the indusk version.

**Trunk is implicit.** The toolkit's `wt.sh` already resolves slugs against `worktrees/<slug>` AND `production/<slug>` (two-pass fallback) — trunk and worktrees share one namespace. The indusk version inherits this: `wt:trunk` is always-present without a create step. The per-project config declares where the trunk lives — typically `production/<repo>` per the workbench shape (e.g., `production/numero` in a Numero workbench).

**Workbench-only target (Sandy, 2026-05-20).** The extension targets workbench-shaped indusk projects only — those with `production/<repo>` symlinks to canonical client clones and a `worktrees/` directory for active feature branches. Single-repo indusk projects (like Numero standalone) are NOT valid adopters; to dogfood the extension against Numero, we create a new workbench-shaped indusk project (e.g., `numero-workbench/`) that wraps Numero via `production/numero` symlink. There is no downside to this — a workbench is itself an indusk project, so setting one up is the same kind of one-time scaffolding work as any new indusk project, and it gives Sandy the per-engagement anchor he wants per the "all code inside an indusk project" principle.

**`wt:pm2` is multi-process orchestration, not a flag.** The toolkit's `wt-pm2.sh` takes multiple `<target>:<app> <cmd>` pairs and launches each as a named pm2 process. The indusk surface preserves this: `pnpm ce wt:pm2 <target>:<app> <cmd> [<target>:<app> <cmd>]...` rather than a `--pm2` flag on the single-target form.

**Lifecycle stays in indusk.** `indusk worktree create / refresh / list / preflight` remains the CLI for state operations. Execution (`pnpm ce wt:<target> <cmd>`) is the user-facing run-anything surface that composes with whatever ce already exposes (dev, build, `dc:up local`, etc.).

**Implementation direction (Sandy, 2026-05-20):** the indusk extension installs a **local CLI** into the target project. Concretely: on `indusk extensions enable worktree`, the extension's `on_enable` hook scaffolds the necessary scripts (`scripts/wt.sh` analog or TypeScript equivalent), registers pnpm scripts in the target's `package.json` (`wt`, `wt:pm2`, `preflight`), and seeds `.indusk/worktree-configs/` with a starter config. ce itself is not modified — the `pnpm ce wt:<target> <cmd>` shape works because the extension wires up whatever local glue ce needs (env-aware pnpm script, or a thin shim that ce delegates to). Implementation lives in dusk-the-indusk-project, ships with every project that adopts the extension, and matches the "all code we are working on inside an indusk project" principle.

## Phased rollout

The current toolkit code is more than enough for a v0. I'd suggest:

**Phase 0 (now): publish this brief.** Get reactions from InDusk maintainers and other Lazer FDEs. Validate that the four subcommands cover their workflows. Adjust the proposed schema based on patterns from non-Avoca engagements.

**Phase 1: extension scaffolding.** A new `indusk worktree` subcommand entry point. The subcommands are thin wrappers that shell out to scripts initially — no need to rewrite in TypeScript yet. Distribute via `indusk update`. Per-client configs live in `.indusk/worktree-configs/`.

**Phase 2: schema + validation.** Add the JSON schema, validate configs on `worktree create`, surface clear errors. Capture the path-filter pattern as a declarative `preflight_env` block.

**Phase 3: composable.env integration.** If composable.env stabilizes as the recommended env-management pattern for FDEs, the extension can scaffold an FDE-overrides contract on `worktree create` for new client repos (one less manual step).

**Phase 4: cross-FDE pattern library.** A shared registry of per-client configs (anonymized) so a new FDE landing at avoca-next can pull a known-good config rather than authoring one from scratch.

## What this brief is NOT proposing

- A managed service or backend. Everything stays machine-local.
- A replacement for `git worktree`. The extension wraps the standard git command + adds the per-client config layer.
- A way to share secrets across FDEs. Secrets stay in machine-local `.env.secrets.*` files.
- A specific CI integration. Preflight runs LOCALLY only — it mirrors CI's behavior without running CI itself.
- A deployment / CD tool. The work all stops at `git push`.

## Open questions for InDusk maintainers

1. Does the per-client config schema fit alongside InDusk's existing per-project config? Or should it be a separate dimension?
2. Is `indusk worktree <subcommand>` the right shape, or would more granular subcommands be better (e.g., a separate top-level `indusk preflight`)?
3. How does this compose with InDusk's existing notion of plans + skills? Specifically: does `worktree preflight` belong as a standalone or as part of an existing `verify` skill flow?
4. Should the four scripts be canonicalized as TypeScript (matching InDusk's stack) immediately, or shipped as bash wrappers in v1 with a TypeScript rewrite later?
5. Is there an existing extension I'm not aware of that already does some of this? Don't want to duplicate.

## Open questions for Lazer FDE peers

1. Are the four subcommands (`create`, `run`, `preflight`, `list`) sufficient for your workflow, or are you reaching for other operations regularly?
2. What does your per-client config look like? Are there patterns my Avoca-shaped config would miss?
3. How are you handling FDE-specific env overrides today? Is the composable.env contracts approach close to what you'd want, or do you prefer something simpler?
4. Have you hit the "wrong worktree silently" bug? If so, what would have caught it for you?

## Appendix: the four scripts as they stand today

If anyone wants to try the pattern locally before InDusk picks it up, the four scripts are public-domain in the dawn-fde-toolkit repo. Copy them, adjust to your conventions, and point your `.indusk/worktree-configs/` at them. The InDusk extension would just standardize what those scripts look like and remove the per-FDE copy-paste step.
