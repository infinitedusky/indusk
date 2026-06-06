---
title: "Doppler extension — replace composable.env at the InDusk system level"
date: 2026-06-04
status: accepted
---

# Doppler extension — Brief

## Problem

composable.env is custom tooling that costs more than it returns once a
project has more than one developer:

1. **Onboarding tax.** Contracts → components → profiles → profileOverrides
   → `${service.X.host}` → `ce env:build` is a full mental model with zero
   external documentation. CLAUDE.md carries 5+ gotchas just for ce behavior.
2. **Doesn't fit the workbench model.** ce *generates* `.env` + a merged
   `docker-compose` into the checkout — so in a worktree workbench, that gets
   regenerated into every fat worktree (the per-worktree-setup tax the
   workbench was meant to remove).
3. **Recurring upstream band-aids.** The Dockerfile-workspace-layers gap and
   the Jaeger CORS gap exist *because* we generate compose files; both require
   patching node_modules.

InDusk scaffolds composable.env into **every** new project by default, and
dusk itself runs on it. numero has already decided to remove it (accepted
ADR, `composable-env-removal`). This plan does the **system-level** move:
replace the composable-env extension with a Doppler-based one and make it the
default.

## Proposed Direction

A Doppler-specific **`doppler` InDusk extension** that replaces
`composable-env`:

- **Doppler** holds env vars in branched configs (`base → {loc,stg,prd} →
  <env>_<app>`) — the naming numero's accepted ADR settled on.
- **Plain docker-compose** (`include:` per-app fragments) for container shape.
- **`env-pull`** script materializes `.env.<profile>` per app from Doppler.
- **Per-worktree pull, fully automated** (decided): every worktree gets its own
  gitignored `.env` files, pulled **automatically as part of worktree
  provisioning** — the developer runs *nothing*. `indusk worktree create`
  invokes the Doppler env-pull during setup, driven by config; InDusk "just
  knows how to configure it." A freshly created worktree is build-ready with
  zero manual env steps. This is the load-bearing requirement: worktrees must
  *just work*. (Workbench-level *projection* — pull once, share into worktrees —
  is a future optimization deferred to the dawn rework; per-worktree auto-pull
  is the v1 mechanism and already delivers the "no manual steps" guarantee.)
- **Auth lives at the InDusk level, not per-worktree** (decided): the Doppler
  service token is stored once in a gitignored file at the InDusk level —
  `.indusk/extensions/doppler/.env` (the established `.env.example` → gitignored
  `.env` pattern dash0/local-telemetry already use; `.indusk/` sits at the
  workbench root, so this one token is shared by every worktree). `indusk
  worktree create` reads it and provisions each worktree non-interactively — no
  `doppler login` OAuth, no per-worktree auth. Onboarding a 3rd-party dev: they
  request the token, drop it in the gitignored file **once**, and from then on
  every worktree they create auto-provisions.
- **Doppler default, ce deprecated** (decided): `init`/`update` scaffold the
  doppler extension instead of composable.env; the composable-env extension
  stays enable-able for legacy projects (opt-in) but is no longer the default.
- **dusk dogfoods it** — dusk's own env migrates off ce onto the doppler
  extension as the plan's end-to-end validation.

This generalizes numero's project-specific `composable-env-removal` into a
reusable extension + init posture.

## Context

- **Proven template:** numero's `composable-env-removal` (accepted ADR) — read
  it for the concrete Doppler config shape, `env-pull` mechanics, per-app
  compose fragments, committed `.env.test`, boot-time `assertRequiredEnv()`,
  and hand-written Caddyfile. This plan extracts the reusable parts.
- **Doppler is structurally load-bearing** (accepted tradeoff, same as numero):
  local dev now needs Doppler read-access, not just prod.
- **Provider scope (decided):** Doppler-specific, not a pluggable abstraction.
  Couples InDusk's env story to Doppler — acceptable; it's used everywhere.

## Scope

### In Scope
- **`doppler` extension** (`apps/indusk-mcp/extensions/doppler/`): manifest,
  `skill.md`, `.env.example`, `env-pull` script template, health checks,
  `on_enable`/`on_disable` hooks.
- **Worktree-create integration**: the worktree provisioning flow
  (`indusk worktree create` / `setup-worktree.sh`) invokes the Doppler env-pull
  automatically, driven by config, so a new worktree is build-ready with no
  manual env step. This is the integration point that delivers the "worktrees
  just work" guarantee.
- **`init` / `update`**: scaffold the doppler extension + plain-compose
  templates by default; stop scaffolding the `env/` contract tree.
- **Deprecate `composable-env`**: mark deprecated, keep opt-in for legacy,
  document the migration path (point at numero's plan as the worked example).
- **Dogfood**: migrate dusk's own env (`ce.json` + `env/`) off ce onto the
  doppler extension.
- **Docs**: extension reference page + a single "how env works" guide; strip
  the ce gotchas from CLAUDE.md.

### Out of Scope
- **numero's actual migration** — its own accepted plan; a parallel consumer,
  not part of this plan's deliverable.
- **Workbench-level env projection** — per-worktree pull only in v1; projection
  is the dawn / worktree-extension-v2 rework.
- **Pluggable multi-provider abstraction** — Doppler-specific by decision.
- **Deleting composable.env from the ecosystem** — deprecate and stop
  defaulting to it; do not rip it out.

## Success Criteria
- **`indusk worktree create <slug>` yields a build-ready worktree with its env
  already provisioned — zero manual env steps.** (The load-bearing one.)
- A fresh `indusk init` scaffolds the `doppler` extension (not ce) and yields a
  working `env:pull` + plain `docker compose up` flow.
- `indusk update` on an existing ce project surfaces the deprecation + the
  migration path without breaking the project.
- **dusk runs entirely off the doppler extension** — `ce.json` + `env/` removed
  from dusk, stack still comes up.
- Onboarding a new/3rd-party dev to env is: request a Doppler token → drop it
  in the gitignored `.indusk/extensions/doppler/.env` **once** → every worktree
  they create from then on auto-provisions its env. No per-worktree env steps.
- The `composable-env` extension still enables for a legacy project (opt-in).

## Depends On
- (no hard dependency) — numero's `composable-env-removal` is a parallel
  template, not a blocker.

## Blocks
- Future **workbench-level env projection** (worktree-extension-v2 / dawn
  rework) builds on the per-worktree pull this establishes.
