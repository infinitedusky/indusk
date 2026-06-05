# Doppler extension

> **Status:** in development (`doppler-extension` plan). This page is a skeleton —
> the env-pull, worktree auto-provisioning, and migration sections are filled out
> as the plan's phases land (Phases 2–5).

The `doppler` extension is the default InDusk environment layer: env vars from
[Doppler](https://www.doppler.com/) branched configs + plain docker-compose,
materialized per-app via an `env-pull` step, and auto-provisioned into every
worktree from a single InDusk-level service token. It replaces composable.env.

## Configuration

The extension is configured by one gitignored file at the InDusk level:

```
.indusk/extensions/doppler/.env          # gitignored — your real token
.indusk/extensions/doppler/.env.example  # committed template
```

`.env` holds:

| Key | Meaning |
|-----|---------|
| `DOPPLER_TOKEN` | A Doppler **service token** (not a personal login). Scope it to the configs this project needs. |
| `DOPPLER_PROJECT` | The Doppler project the configs live under (e.g. `numero`). |

Enable + set up:

```sh
indusk extensions enable doppler
cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env
# edit .env: paste a service token + project name
```

## The token / auth model

Auth is **one service token at the InDusk level**, shared by the trunk and every
worktree (`.indusk/` lives at the workbench root). No per-worktree auth, no
interactive `doppler login`. A new developer's only step is requesting a token
and dropping it in `.env` once — every worktree they create from then on
auto-provisions its env.

## env-pull

*(Filled out in Phase 2.)* `pnpm env:pull <profile>` downloads each app's
`<prefix>_<app>` Doppler config and writes `apps/<app>/.env.<profile>`
(gitignored).

## Worktree auto-provisioning

*(Filled out in Phase 3.)* `indusk worktree create <slug>` provisions the new
worktree's env automatically — it comes up build-ready with no manual step.

## Migrating off composable.env

*(Filled out in Phases 4–5.)* See numero's `composable-env-removal` plan as the
worked example.
