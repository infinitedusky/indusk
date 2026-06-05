# How environment variables work in InDusk

InDusk's default environment layer is the **`doppler` extension**: env vars come
from [Doppler](https://www.doppler.com/), container shape is plain
docker-compose, and a freshly created worktree provisions its own env
automatically. No custom config language.

> **composable.env is deprecated.** It was the right tool for a solo developer,
> but it imposes an onboarding tax (contracts → components → profiles →
> templating) and bakes generated config into every worktree. New projects get
> the `doppler` extension instead. Existing composable.env projects keep working
> (nothing is removed) — `indusk init`/`update` print a migration nudge when they
> see a `ce.json`. To migrate, follow numero's `composable-env-removal` plan as
> the worked example.

## The model

1. **Doppler holds env vars** in branched configs:

   ```
   <project>/base                ← cross-environment defaults
     ├─ <project>/loc            ← local-dev overrides
     │   ├─ <project>/loc_<app>  ← one leaf per app under apps/*
     ├─ <project>/stg            ← staging
     └─ <project>/prd            ← production + secrets
   ```

2. **One service token at the InDusk level** authenticates everything. Put it
   once in the gitignored `.indusk/extensions/doppler/.env`:

   ```sh
   cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env
   # edit: DOPPLER_TOKEN + DOPPLER_PROJECT
   ```

   In a worktree workbench, `.indusk/` sits at the workbench root, so this one
   token is shared by the trunk and every worktree.

3. **`env-pull` materializes `.env` files** for each app:

   ```sh
   indusk doppler env-pull local        # → apps/*/.env.local
   indusk doppler env-pull production   # → apps/*/.env.production
   ```

   These files are gitignored. `.env.test` is the exception — committed with safe
   defaults so tests run without a Doppler token.

4. **Plain docker-compose** defines container shape (per-app fragments via the
   `include:` directive). Every Docker user already understands it.

## Worktrees just work

When the doppler extension is enabled, `indusk worktree create <slug>`
**auto-provisions the new worktree's env** — it comes up build-ready with zero
manual steps. A new developer's only setup is dropping a Doppler token into the
gitignored file once; every worktree they create from then on provisions itself.

See the [doppler extension reference](/reference/extensions/doppler) for details.

## Onboarding a new developer

```sh
# 1. request a Doppler service token, then:
cp .indusk/extensions/doppler/.env.example .indusk/extensions/doppler/.env
# paste the token + project into .env
# 2. create a worktree — env is provisioned automatically
indusk worktree create my-feature
```

No `doppler login`, no per-worktree env steps.
