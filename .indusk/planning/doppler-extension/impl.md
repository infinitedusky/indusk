---
title: "Doppler extension — Implementation"
date: 2026-06-04
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Doppler extension — Implementation

## Goal

Build a Doppler-specific `doppler` InDusk extension that replaces composable.env
as the default env layer, with `indusk worktree create` auto-provisioning a new
worktree's env from a single InDusk-level gitignored service token. Dogfood it by
migrating dusk off ce.

## Scope

### In Scope
- `doppler` extension package (manifest, skill, `.env.example`, `env-pull`
  script, health checks, hooks).
- Worktree-create env auto-provisioning.
- `init`/`update` scaffolding doppler by default; `composable-env` deprecated.
- dusk's own env migrated off ce.
- Docs (reference page, env guide, ADR publish).

### Out of Scope
- numero's migration (its own plan).
- Workbench-level env projection (deferred to dawn).
- Pluggable multi-provider abstraction.
- Deleting composable.env from the ecosystem.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `doppler` extension package (manifest, skill, `.env.example`, health checks, on_enable/on_disable) | extension system (`extensionsEnable`, `copyExtensionAssets`, `.env.example` pattern) |
| Phase 2 | `env-pull` script + stubbed-`doppler` test harness; per-app `.env.<profile>` writes; gitignore wiring | Phase 1 extension + the InDusk-level token file |
| Phase 3 | worktree-create env auto-provision hook | Phase 2 env-pull; worktree extension's `setup-worktree.sh` / `worktree create` |
| Phase 4 | `init`/`update` posture: doppler default, ce deprecated (opt-in), non-destructive update | Phase 1 extension; `autoEnableExtensions`; composable-env manifest |
| Phase 5 | dusk migrated off ce (Doppler configs + plain docker-compose; `ce.json`+`env/` removed); finalized docs, changelog, published ADR | Phases 1–4; numero's `composable-env-removal` as template |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Kind |
|----|---------|-------------|-----------|-------|------|
| T1 | Enabling the doppler extension produces `.indusk/extensions/doppler/.env.example` documenting the token + config | Phase 0 | Phase 1 | planned | integration |
| T2 | With a token in the gitignored `.env`, the env-pull step populates each app's `.env.<profile>` from Doppler | Phase 0 | Phase 2 | planned | integration (stub) |
| T3 | After `indusk worktree create <slug>`, the new worktree's apps have populated `.env` files — no manual env step | Phase 0 | Phase 3 | planned | integration (stub) |
| T4 | A fresh `indusk init` enables the doppler extension and does not create the composable.env `env/` contract tree | Phase 0 | Phase 4 | planned | integration |
| T5 | `indusk update` on a composable.env project reports the ce deprecation + migration path and leaves ce working | Phase 0 | Phase 4 | planned | integration |
| T6 | The composable-env extension can still be explicitly enabled (opt-in for legacy) | Phase 0 | Phase 4 | planned | integration |
| T7 | doppler-provisioned `.env.<profile>` files never appear in `git status` (trunk or worktree) | Phase 0 | Phase 2 | planned | integration (stub) |
| T8 | dusk's local stack comes up with composable.env removed — no `ce` invocation in the run path | Phase 0 | Phase 5 | planned | manual smoke |
| T9 | A dev whose only setup was dropping the token in the gitignored file creates a worktree that builds | Phase 0 | Phase 5 | planned | manual smoke |

All rows are writable at Phase 0: each test drives an existing CLI surface
(`indusk init`/`update`/`worktree create`/`extensions enable`) plus a stubbed
`doppler` binary, and fails red today because the feature is unbuilt — no
not-yet-existing TypeScript symbol is referenced. No `### Trajectory Rationale`
subsection is required (no Phase 1+ rows).

### Deferred Verification

- **Live Doppler API automated coverage**
  - reason: Doppler is a paid external integration; CI has no shared test
    Doppler project + token, and the upstream CLI's `secrets download` output
    contract can change.
  - would require: a CI-available test Doppler project + service token scoped to
    non-secret values.
  - mitigation: script-logic paths fully covered by stubbed-binary tests
    (T2/T3/T7); live behavior covered by manual smoke (T8/T9); the first real
    `worktree create` on numero acts as the canary; the stub fixture is kept
    honest against a real `doppler secrets download --format env` sample.

## Checklist

### Phase 1: `doppler` extension package
- [x] Create `apps/indusk-mcp/extensions/doppler/manifest.json` — `name: doppler`,
      `required: false` for now (default-enable lands in Phase 4), `provides:
      [skill, health_checks]`, `hooks: { on_enable, on_disable }`.
- [x] Write `apps/indusk-mcp/extensions/doppler/skill.md` — agent-facing: env via
      Doppler + plain docker-compose, the `env-pull` step, worktree
      auto-provisioning, and the InDusk-level token model.
- [x] Write `apps/indusk-mcp/extensions/doppler/.env.example` — documents
      `DOPPLER_TOKEN` + `DOPPLER_PROJECT` with inline comments (the `.env.example`
      → gitignored `.env` pattern dash0/local-telemetry already use).
- [x] Health checks: `doppler` binary on PATH; token file present + non-empty.
- [x] `on_enable`: `copyExtensionAssets` (lands `.env.example`) + `printEnvSetupHint`
      (`cp .env.example .env`). `on_disable`: cleanup.

#### Phase 1 Verification
- [ ] Set up the stubbed-`doppler`-binary test harness (fixture secrets on PATH) and write T1–T7 as integration tests; assert all currently fail red (tripwires).
- [ ] T1 goes green — `pnpm turbo test --filter=indusk-mcp -- doppler` (enabling `doppler` lands `.env.example`).

#### Phase 1 Context
- [ ] Add to CLAUDE.md Architecture: the `doppler` extension exists at
      `apps/indusk-mcp/extensions/doppler/` (Doppler + plain compose env layer).

#### Phase 1 Document
- [ ] Create skeleton `apps/docs/src/reference/extensions/doppler.md` (config +
      token model sections; filled out in Phase 5).

### Phase 2: `env-pull` script + per-app provisioning
- [ ] Write the `env-pull` script (extension-owned): read the token from the
      InDusk-level gitignored `.env`, iterate `apps/*/`, run `doppler secrets
      download --project $P --config <prefix>_<app> --format env` per app, write
      `apps/<app>/.env.<profile>`.
- [ ] gitignore wiring: ensure `.env.<profile>` (and the extension `.env`) are
      gitignored in the target project.
- [ ] `pnpm env:pull <profile>` alias template for scaffolded projects.

#### Phase 2 Verification
- [ ] T2 goes green — env-pull writes each app's `.env.<profile>` from the
      stubbed Doppler fixture (`pnpm turbo test --filter=indusk-mcp -- doppler`).
- [ ] T7 goes green — provisioned files are gitignored (clean `git status`).

#### Phase 2 Context
- [ ] Add to CLAUDE.md Conventions: doppler env-pull writes per-app
      `.env.<profile>` (gitignored) from the InDusk-level token; these files are
      machine-local provisioning output and must never be committed.

#### Phase 2 Document
- [ ] Add the `env-pull` + per-app `.env` section to `reference/extensions/doppler.md`.

### Phase 3: Worktree-create auto-provisioning (load-bearing — A3)
- [ ] Hook env-pull into the worktree provisioning flow (`indusk worktree create`
      / `setup-worktree.sh`): after the worktree dir is created and `copy_files`
      applied, run env-pull for the worktree's apps using the workbench-level token.
- [ ] Provisioning is automatic when the doppler extension is enabled (config-driven,
      no extra per-worktree flag).

#### Phase 3 Verification
- [ ] T3 goes green — `indusk worktree create <slug>` against the stubbed Doppler
      yields a worktree whose apps have populated `.env` files, with no manual step.

#### Phase 3 Context
- [ ] Add to CLAUDE.md Conventions: worktree creation auto-provisions env via the
      doppler extension from the workbench-level token; no per-worktree env step.

#### Phase 3 Document
- [ ] Add the worktree auto-provision flow + a Mermaid diagram (token → create →
      env-pull → per-app `.env`) to `reference/extensions/doppler.md`.

### Phase 4: init/update posture — doppler default, ce deprecated
- [ ] `init`: scaffold the `doppler` extension + plain docker-compose templates by
      default; stop scaffolding the composable.env `env/` contract tree.
- [ ] Mark the `composable-env` extension deprecated in its manifest; keep it
      enable-able (opt-in).
- [ ] `update`: detect composable.env projects, print the deprecation + migration
      path (point at numero's `composable-env-removal` as the worked example);
      non-destructive (do not remove ce config).

#### Phase 4 Verification
- [ ] T4 goes green — fresh `indusk init` enables doppler, no `env/` tree.
- [ ] T5 goes green — `indusk update` on a ce project prints deprecation + path,
      ce config still present.
- [ ] T6 goes green — `indusk extensions enable composable-env` still activates it.

#### Phase 4 Context
- [ ] Update CLAUDE.md Conventions: `init`/`update` scaffold the doppler extension
      by default; composable-env is deprecated to opt-in.

#### Phase 4 Document
- [ ] Write `apps/docs/src/guide/env.md` ("how env works in InDusk" — Doppler +
      plain compose); mark the composable-env docs deprecated, pointing at doppler
      + numero's migration.

### Phase 5: dusk dogfood + docs finalize
- [ ] Restructure dusk's Doppler configs (`base → {loc,...} → <env>_<app>`) for
      dusk's apps (indusk-docs, indusk-admin).
- [ ] Write dusk's plain docker-compose (per-app fragments + root `include:`),
      replacing `ce.json` + `env/`.
- [ ] Verify the stack via env-pull + `docker compose up`; once green, remove
      dusk's `ce.json` + `env/` (reversible — keep ce config until the doppler
      path is confirmed).

#### Phase 5 Verification
- [ ] T8 (manual smoke) — `pnpm wt`/`docker compose up` brings up dusk's apps with
      ce removed; no `ce` in the run path. Record result in the trajectory State.
- [ ] T9 (manual smoke) — a fresh-env simulation with only the token in the
      gitignored file produces a build-ready worktree. Record result.

#### Phase 5 Context
- [ ] Update CLAUDE.md Current State + Conventions: dusk runs on the doppler
      extension; `ce.json` + `env/` removed from dusk.

#### Phase 5 Document
- [ ] Update dusk's local-dev / env docs to the Doppler + plain-compose flow.
- [ ] Complete `reference/extensions/doppler.md` and `guide/env.md`; add the
      changelog entry; publish the ADR to
      `apps/docs/src/decisions/doppler-extension.md`.

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-mcp/extensions/doppler/{manifest.json,skill.md,.env.example}` | new extension package |
| `apps/indusk-mcp/extensions/doppler/env-pull.*` | new env-pull script |
| `apps/indusk-mcp/extensions/composable-env/manifest.json` | mark deprecated |
| `apps/indusk-mcp/extensions/worktree/hooks/setup-worktree.sh` | invoke env-pull on create |
| `apps/indusk-mcp/src/bin/commands/init.ts` / `update.ts` | doppler default; ce deprecation message |
| `apps/indusk-mcp/src/__tests__/doppler-*.test.ts` | trajectory tests + stub harness |
| `ce.json`, `env/`, `docker-compose.*.yml` (dusk root) | dusk dogfood migration |
| `apps/docs/src/reference/extensions/doppler.md`, `guide/env.md`, `decisions/doppler-extension.md` | docs |

## Dependencies
- The worktree extension (Phase 3 integrates env-pull into `worktree create`).
- numero's `composable-env-removal` (accepted) as the worked template.
- The Doppler CLI (`doppler`) available where worktrees are provisioned.

## Notes
- A3 (Phase 3) is the gating proof. If it can't pass deterministically against the
  stubbed binary, stop and rework the auto-provision design before Phases 4–5.
- Keep the stub fixture honest against a real `doppler secrets download --format
  env` sample so T8/T9 catch drift.
- dusk is `otel.role: library` — no OTel sections; the extension emits no runtime telemetry.
