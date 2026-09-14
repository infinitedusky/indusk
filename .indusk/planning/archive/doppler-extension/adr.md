---
title: "Doppler extension — replace composable.env as the default InDusk env layer"
date: 2026-06-04
status: accepted
---

# Doppler extension — replace composable.env as the default InDusk env layer

## Goal

**When this ships, a developer creates a worktree and it is immediately
build-ready — env provisioned automatically — and new InDusk projects get
Doppler + plain docker-compose instead of composable.env.**

Today a new worktree is not build-ready: someone has to generate env into it,
and composable.env's contract/component/profile/template model is a custom
onboarding tax that also bakes generated config into every fat worktree. A new
developer can't run the stack until they've learned a tool no external resource
documents. This ADR replaces that custom layer with two things every contributor
already knows — Doppler and plain docker-compose — and makes worktree env
automatic.

## Y-Statement

**In the context of:**
InDusk projects — especially worktree workbenches — that need environment
configuration to build and run, where composable.env's custom layering
(contracts → components → profiles → profileOverrides → `${service.X.host}` →
`ce env:build`) imposes a multi-hour onboarding tax with zero external
documentation, doesn't fit the workbench model (it *generates* env + a merged
docker-compose into each checkout, so config gets baked into every fat
worktree), and forces recurring upstream node_modules patches. numero has
already decided to drop it (accepted `composable-env-removal` ADR), and InDusk
itself scaffolds composable.env into every new project by default.

**Facing:**
The need for env to reach every worktree *automatically* — a freshly created
worktree must build with zero per-worktree steps — while keeping secrets out of
git and not forcing every contributor to learn a bespoke tool.

**We decided for:**
A Doppler-specific `doppler` InDusk extension that replaces `composable-env`.
Doppler holds env in branched configs (`base → {loc,stg,prd} → <env>_<app>`);
plain docker-compose (`include:` per-app fragments) defines container shape; an
env-pull step materializes per-app `.env.<profile>` files. `init`/`update`
scaffold it by default and the composable-env extension is deprecated to opt-in.
Auth is a single Doppler **service token** in a gitignored file at the InDusk
level — `.indusk/extensions/doppler/.env`, which lives at the workbench root and
is therefore shared by every worktree. `indusk worktree create` reads that token
and provisions each new worktree's env non-interactively, so worktrees just
work. dusk dogfoods the extension by migrating its own env off ce.

**And against:**
Keeping composable.env (pay the onboarding tax forever); a pluggable
multi-provider abstraction (more work, defers shipping, Doppler is already used
everywhere); workbench-level env *projection* in v1 (more design surface;
per-worktree auto-pull already delivers the zero-manual-steps guarantee);
leaving composable.env as the default with doppler opt-in (init keeps pushing the
complex tool — fails the "move off ce" goal); interactive `doppler login` OAuth
(can't run inside non-interactive worktree provisioning).

**To achieve:**
Worktrees that are build-ready on creation with no manual env step; env
onboarding that is "request a token, drop it in one gitignored file" for any new
or 3rd-party dev; new InDusk projects free of custom env tooling; and permanent
elimination of the compose-generation bug class (the Dockerfile-layers and
Jaeger-CORS template gaps exist only because ce generates compose).

**Accepting:**
Doppler becomes structurally load-bearing for local dev, not just prod (a dev
needs the token to build); env is per-worktree-pulled, so it still physically
lives in each worktree (cheap to fill, but not yet projected — that's a later
optimization); InDusk's env story is coupled specifically to Doppler; and making
doppler the default + deprecating ce + migrating dusk touches `init`/`update`
and the extension system, a real blast radius.

**Because:**
Every value composable.env provides — env-file generation, compose generation,
service-hostname resolution, profile switching — has a direct equivalent in
Doppler + plain docker-compose, tools every contributor already knows. And only
the service-token-at-the-InDusk-level model makes worktree env *automatic*
without secrets-in-git or interactive auth — which is the load-bearing
requirement the whole plan exists to satisfy.

## Context

Reference the [brief](brief.md), the [test plan](test-plan.md), and numero's
accepted [`composable-env-removal`](../../../../numero-workbench/.indusk/planning/composable-env-removal/adr.md)
(the project-specific proven template: Doppler config shape, `env-pull`
mechanics, per-app compose fragments via `include:`, committed `.env.test`,
boot-time `assertRequiredEnv()`, hand-written Caddyfile). This plan extracts the
reusable parts into a system-level extension and changes the InDusk default.

The four system-level decisions (resolved with the user 2026-06-04):
1. **Worktree env delivery** → per-worktree pull, *fully automated* on
   `worktree create`.
2. **Provider scope** → Doppler-specific (not a pluggable abstraction).
3. **init posture** → Doppler default, composable-env deprecated to opt-in.
4. **Auth model** → single Doppler service token in gitignored
   `.indusk/extensions/doppler/.env` at the workbench root.

## Decision

1. Build a `doppler` extension at `apps/indusk-mcp/extensions/doppler/`
   (manifest, `skill.md`, `.env.example`, `env-pull` script template, health
   checks, `on_enable`/`on_disable` hooks).
2. The `env-pull` step reads the gitignored InDusk-level token and runs
   `doppler secrets download --project <p> --config <env>_<app> --format env`
   per app, writing `apps/<app>/.env.<profile>` (gitignored).
3. Integrate env-pull into worktree provisioning: `indusk worktree create` /
   `setup-worktree.sh` invokes it automatically so a new worktree is
   build-ready.
4. `init`/`update` scaffold the doppler extension + plain docker-compose
   templates by default and stop scaffolding the composable.env `env/` tree;
   `composable-env` is marked deprecated but stays enable-able (opt-in).
5. Migrate dusk's own env off composable.env onto the doppler extension as the
   end-to-end dogfood.

## Alternatives Considered

### Keep composable.env
Rejected: every hire pays the onboarding cost; it doesn't fit the workbench
(bakes generated config into each worktree); the upstream template-gap loop
continues.

### Composable.env compose-only (Doppler for env, ce for compose)
Rejected: keeps half the custom tooling, and the template-gap bugs live in the
compose-generation layer ce would still own.

### Pluggable multi-provider abstraction (Doppler as first impl)
Rejected: more upfront design + code for generality we don't need — Doppler is
already used across every project. Revisit only if a second backend ever appears.

### Workbench-level env projection in v1 (pull once, share into worktrees)
Rejected for v1: a new mechanism to design and build, when per-worktree
auto-pull already delivers the "zero manual steps" guarantee. Projection is a
disk/cost optimization deferred to the dawn / worktree-extension-v2 rework.

### Doppler opt-in, composable.env stays the default
Rejected: it fails the actual goal. If `init` keeps scaffolding ce, new projects
keep paying the onboarding tax; "move off ce" never happens.

### Interactive `doppler login` (OAuth) per machine
Rejected: OAuth can't run inside non-interactive worktree provisioning. A
service token in a gitignored file is non-interactive, scriptable, and shared
across worktrees — the only model that makes auto-provisioning work.

## Consequences

### Positive
- Worktrees are build-ready on creation; no per-worktree env setup.
- New-dev env onboarding collapses to "request token → one gitignored file."
- New InDusk projects ship with universally-known tools (Doppler + compose).
- The compose-generation bug class disappears.
- CLAUDE.md sheds the composable.env gotchas.

### Negative
- Doppler is load-bearing for local dev; no Doppler token → can't build.
- Env still physically lives in each worktree (per-worktree pull, not projected).
- InDusk's env story is coupled to Doppler specifically.
- Per-project compose YAML is hand-written (more lines than contract JSON, but
  universally readable).

### Risks
- **A3 not stub-testable** → if worktree-create can't provision deterministically
  against a stubbed `doppler` binary, the auto-provisioning design needs rework.
  Mitigation: prove A3 in an early phase before the init/dusk-migration phases.
- **Stub drifts from the real CLI's output format** → A8/A9 manual smokes catch
  it; keep the stub fixture honest against a real `doppler secrets download
  --format env` sample.
- **Deprecating ce breaks a legacy project** → ce stays enable-able (opt-in) and
  `update` is non-destructive (A5/A6 guard this).
- **dusk dogfood migration regresses dusk's stack** → A8 manual smoke gates it;
  ce config kept alongside until the doppler path is green (reversible).

## Documentation Plan

### Pages
- New: `apps/docs/src/reference/extensions/doppler.md` — extension reference
  (config, env-pull, worktree integration, the token/auth model).
- New/Update: `apps/docs/src/guide/env.md` — "how env works in InDusk" (Doppler +
  plain compose), replacing any composable.env-centric guidance.
- Update: composable-env extension docs — mark deprecated, point at the doppler
  extension + numero's migration as the worked example.

### Diagrams
- Mermaid in the reference page: token (InDusk level) → `worktree create` →
  env-pull → per-app `.env` in the new worktree.

### Changelog
- "Added the `doppler` extension (Doppler + plain docker-compose); `init` now
  scaffolds it by default and composable-env is deprecated. Worktree creation
  auto-provisions env."

### ADR in Docs
- Publish to `apps/docs/src/decisions/doppler-extension.md`.

## References
- [Brief](brief.md)
- [Test plan](test-plan.md)
- numero `composable-env-removal` (proven template, parallel consumer)
- `indusk-v2-dawn` research — workbench-level projection (deferred optimization)
- worktree extension v2 (future) — the projection mechanism builds on this
