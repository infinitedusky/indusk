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

Naming convention: `<prefix>_<app>` where prefix is `loc` (local), `stg`
(staging), `prd` (production). Per-app leaves inherit from the env parent, which
inherits from `base`.

### env-pull materializes `.env` files

`pnpm env:pull <profile>` walks `apps/*/`, calls
`doppler secrets download --project <p> --config <prefix>_<app> --format env`
for each app, and writes `apps/<app>/.env.<profile>` — gitignored. CI runs the
same step before `docker compose up`.

Test profile is the exception: `.env.test` files are committed to git with safe,
non-secret defaults so tests run without a Doppler token.

## Auth — one token at the InDusk level

Auth is a Doppler **service token** stored once in a gitignored file:

```
.indusk/extensions/doppler/.env      ← gitignored; DOPPLER_TOKEN + DOPPLER_PROJECT
.indusk/extensions/doppler/.env.example  ← committed template
```

`.indusk/` lives at the workbench root, so this **one token is shared by the
trunk and every worktree**. No `doppler login` OAuth, no per-worktree auth.

Setup (once per machine/workbench):

```sh
cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env
# edit .env: paste a Doppler service token + the project name
```

A new/3rd-party dev requests a token, drops it in that file once — done.

## Worktrees auto-provision (the load-bearing behavior)

When the doppler extension is enabled, **`indusk worktree create <slug>` pulls
env automatically** as part of provisioning — the developer runs nothing. A
freshly created worktree is build-ready: its apps already have populated `.env`
files, pulled from Doppler using the workbench-level token.

This is the whole point: worktrees "just work" with zero per-worktree env steps.

## Commands

| Command | What |
|---------|------|
| `pnpm env:pull local` | write `apps/*/.env.local` from Doppler `loc_*` configs |
| `pnpm env:pull staging` | write `apps/*/.env.staging` from `stg_*` |
| `pnpm env:pull production` | write `apps/*/.env.production` from `prd_*` |
| `indusk worktree create <slug>` | create a worktree with env auto-provisioned |

## Health

- `doppler-cli-installed` — the `doppler` binary is on PATH (`brew install dopplerhq/cli/doppler`).
- `doppler-token-present` — `.indusk/extensions/doppler/.env` exists and has a `DOPPLER_TOKEN`.

If a worktree comes up without env, check both: the binary must be installed and
the token file must be present at the InDusk level.

## Migrating off composable.env

composable.env is deprecated. To migrate a project, see numero's
`composable-env-removal` plan as the worked example: restructure Doppler into
branched configs, write `env-pull`, replace the generated compose with
hand-written per-app fragments, delete `env/` + `ce.json`. Reversible until the
final cleanup.
