# Release checks run once

**Decided 2026-10-08; shipped in 1.67.0.** Full ADR: `.indusk/planning/archive/release-checks-run-once/adr.md`.

The slow test tier ran twice between landing a plan and publishing it, six to eight minutes each time on code that differed only by the version bump. And the landing and release steps every InDusk project installs named dusk's own commands (`pnpm test:system`, `release-guard.sh`, dusk's changelog path), which most projects do not have.

## What was decided

- **A project names what its workflow steps run**, under `workflow.steps` in `.indusk/config.json`: landing's slow tests; release's command, version file, changelog and covered paths. `indusk checks show` names them back, or says plainly what not declaring one means (no slow tests at landing; nothing to publish). The retrospective's landing and release steps use only what it prints.
- **Facts, never logic.** Every value is a command, a path or a name. No conditions, templating or expressions: a step that needs one names a script the project owns, and a command is whatever the project already runs. A later plan that wants more argues against this by name. This is the guard against the configuration complexity clock, where settings grow rules and rules grow a language nobody can debug.
- **`indusk checks slow` runs the declared slow tests once per piece of code.** A fully green run over a clean tree is recorded in the project's home, keyed by the content of the covered files (the changelog left out, the version file read without its version). `--unless-covered` skips when a record covers the code at hand, so a release after a green landing runs nothing twice.

## What dusk itself does

Dusk declares its release command, version file, changelog and covered paths, and **no slow tests**. Its landing waits only for the fast suite; `pnpm release` runs no slow tier. Sandy's decision at the plan's last phase: dusk's releases are its own development loop, nearly the only user is its author, and the slow tier blocking every landing and release cost more flow than a patch release costs. The tier is to run after release, in the background, as a promise whose breaking is an incident (see `known-issues.md`, Releases). The product keeps `checks slow` at landing as the default for projects whose releases go public.

## Rejected

- **Keying on the commit**: the bump commit always differs, so release would never skip.
- **A standalone `release` config block**: a third home for step tooling beside `verify.testRunner` and `plans.land_checks`; one section shaped for every step costs the same.
- **An existing standard for the steps**: none describes a project's workflow tooling (AGENTS.md is prose; Spec Kit and OpenSpec fix their own order; CDEvents describes what happened, not what to run).
- **Keeping the record in git**: it would travel to machines that never ran the tests.
