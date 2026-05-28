# Local Init Mode

## Decision

Use a `--local` flag on `indusk init` that confines all InDusk artifacts to `.indusk/` and `.claude/`, excluded via `.git/info/exclude`, with a central `config.json` as the project profile.

## Context

InDusk assumed it owned the project — init created `biome.json`, `CLAUDE.md`, `.gitignore` entries at the repo root. This breaks down when joining a team codebase where you can't impose your dev system on day one.

Most of what InDusk provides (planning, lessons, skills, hooks, CGC, verify) doesn't need to touch committed files. The few things that do (biome config, test runner config, docs) can live in `.indusk/` with their own configs.

## Key Tradeoffs

- **`.claude/settings.json` requires an overlay approach** — InDusk merges its hooks/permissions into the shared file, records what it added in `.indusk/settings-overlay.json`, and strips them via `pr-clean` before PRs
- **Local-mode tests/docs live in `.indusk/`** — unconventional paths, but invisible to teammates
- **`.git/info/exclude` is per-clone** — re-cloning requires re-running `init --local` (init is idempotent)

## What Changed

- `.indusk/` became the InDusk home directory (both modes)
- `planning/` moved to `.indusk/planning/` (all modes)
- `.indusk/config.json` serves as the central project profile — mode, detected tooling, verify contract
- `pr-clean` / `pr-restore` lifecycle for settings management

## Full ADR

See [`.indusk/planning/archive/local-init-mode/adr.md`](../../.indusk/planning/archive/local-init-mode/adr.md)
