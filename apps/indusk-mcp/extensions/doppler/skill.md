---
name: doppler
description: Doppler-backed env management for InDusk projects — env vars from Doppler branched configs + plain docker-compose, materialized per-app via env-pull, auto-provisioned into every worktree from a single InDusk-level service token. The default InDusk env layer (replaces composable.env).
---

# Doppler — Environment Management

This extension is how InDusk projects get their environment, replacing
composable.env. Two pieces, both things every developer already knows:

- **Doppler** holds the env vars (in branched configs).
- **Plain docker-compose** defines container shape (per-app fragments via `include:`).

There is no custom contract/component/profile language to learn. Env reaches a
checkout via an `env-pull` step that downloads from Doppler and writes ordinary
`.env` files.

## The model

### Doppler branched configs

Env vars live in Doppler, organized as a project with branched configs:

```
<project>/base                ← cross-environment defaults (CHAIN_ID, LOG_LEVEL)
  ├─ <project>/loc            ← local-dev overrides
  │   ├─ <project>/loc_<app>  ← per-app leaf (one per app under apps/*/)
  │   └─ ...
  ├─ <project>/stg            ← staging
  └─ <project>/prd            ← production + secrets
```

Naming: per-target leaves are `<prefix>_<target>`. The prefix is **whatever you
name your env roots** (e.g. `local`/`prd`, or `loc`/`stg`/`prd`) — you map the
profile arg to the prefix via `doppler.profiles` in `.indusk/config.json`. Leaves
inherit from the env root, which inherits from `base`.

### env-pull materializes `.env` files

`indusk doppler env-pull <profile>` reads the project's `.indusk/config.json`
`doppler` section and, for each target, downloads its Doppler config and writes
`<path>/.env.<profile>` — gitignored. CI runs the same step before `docker compose up`.

```jsonc
"doppler": {
  "project": "indusk",                                     // Doppler project
  "profiles": { "local": "local", "production": "prd" },   // profile → config-root prefix
  "apps": [
    { "dir": "docs" },                          // → apps/docs/.env.<profile>  (config local_docs)
    { "dir": "admin", "config": "admin" },      // folder name ≠ Doppler leaf
    { "path": "packages/db", "config": "db" },  // ANY path, not just apps/ → packages/db/.env.<profile>
    { "path": ".", "config": "root" }           // repo-root .env
  ]
}
```

- **`dir`** = `apps/<dir>` shorthand. **`path`** = any dir relative to the project
  root (`.`, `packages/*`, `services/*`). Output is `<path>/.env.<profile>`.
- **`config`** = the Doppler leaf suffix (downloads `<prefix>_<config>`); defaults
  to the dir/basename.
- **`profiles`** maps the profile arg to the Doppler config-root (`local`→`local`).

With no `doppler` section, env-pull falls back to globbing `apps/*` with the default
prefixes (`local`→`loc`, `staging`→`stg`, `production`→`prd`).

Test profile is the exception: `.env.test` files are committed to git with safe,
non-secret defaults so tests run without a Doppler token.

## Auth — login (devs) or token (CI), optional locally

env-pull resolves auth in this order:

1. **`DOPPLER_TOKEN` env var** — CI / deployment (set from a GitHub secret).
2. **`.indusk/extensions/doppler/.env`** — an optional service token file (gitignored).
3. **The logged-in Doppler CLI session** — `doppler login`.

A dev who ran `doppler login` needs **no token file at all** — that's the
recommended path. The token exists for CI and headless boxes. `.indusk/` is at the
workbench root, so whichever you use is shared by the trunk and every worktree.

```sh
doppler login                              # dev — recommended, no token file
# CI: set DOPPLER_TOKEN from a secret (no login)
# optional headless token file:
cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env   # paste DOPPLER_TOKEN
```

The Doppler **project** lives in `.indusk/config.json` (`doppler.project`), not in
the `.env` — the `.env` is only ever the secret.

## Doppler is the source of truth (one-way)

env-pull only **pulls** — Doppler → local `.env` files. It never pushes back:

- **Manage env in Doppler** — the UI, or `doppler secrets set KEY=val --config <leaf>` —
  then `env-pull`.
- The local `.env.*` files are **disposable, gitignored projections**. Editing one by
  hand is ephemeral; the next pull overwrites it. Never manage env via `.env.local`.
- One-time migration seed: `doppler secrets upload <file> --config <leaf>` (manual,
  deliberate). After that it's pull-only.

## Worktrees auto-provision (the load-bearing behavior)

When the doppler extension is enabled, **`indusk worktree create <slug>` pulls
env automatically** as part of provisioning — the developer runs nothing. A
freshly created worktree is build-ready: its targets already have populated `.env`
files, pulled from Doppler using the workbench-level auth (login or token). Then the
worktree config's `post_create[]` commands run (install/build) — so the worktree is
not just env-ready but **runnable** in one shot.

This is the whole point: worktrees "just work" with zero per-worktree steps.

## Docker across worktrees

`docker-compose.yml` lives in the repo (committed), with a pinned project `name:`.
There's one Docker daemon + one pinned-name stack, so **`docker compose up` from any
worktree (or the trunk) addresses the same stack** — it builds *that* worktree's code
with *that* worktree's pulled `.env`. Tradeoff: **one stack per repo at a time** (two
worktrees can't both `up` — same name + ports collide). env is per-worktree; docker is
shared. (Inherited from the worktree extension's `compose_project_name` model.)

## Commands

| Command | What |
|---------|------|
| `indusk doppler env-pull local` | write each target's `.env.local` (targets from `.indusk/config.json` `doppler.apps`) |
| `indusk doppler env-pull production` | same for `.env.production` |
| `indusk worktree create <slug>` | create a worktree with env auto-provisioned + `post_create` run |
| `doppler login` | authenticate the CLI once (no token file needed after) |

## Health

- `doppler-cli-installed` — the `doppler` binary is on PATH (`brew install dopplerhq/cli/doppler`).
- `doppler-authenticated` — asks whether Doppler can actually authenticate
  (`doppler me`), falling back to a service-token file. `doppler login` satisfies
  it. It used to test only for the token file, so it went red for anyone logged
  in — a check that reports a working setup as broken.

If a worktree comes up without env: confirm the CLI is installed and you're either
logged in (`doppler login`) or have a token (file / `DOPPLER_TOKEN`), and that
`.indusk/config.json` has a `doppler.project` plus the target in `doppler.apps`.

## Migrating off composable.env

composable.env is deprecated. To migrate a project, see numero's
`composable-env-removal` plan as the worked example: restructure Doppler into
branched configs, write `env-pull`, replace the generated compose with
hand-written per-app fragments, delete `env/` + `ce.json`. Reversible until the
final cleanup.
