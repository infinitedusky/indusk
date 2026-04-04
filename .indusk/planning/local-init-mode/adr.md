---
title: "Local Init Mode"
date: 2026-04-05
status: accepted
---

# Local Init Mode

## Y-Statement

In the context of **using InDusk on team codebases you don't own**,
facing **the constraint that init creates committed files (biome.json, CLAUDE.md, .gitignore) that affect the shared repo**,
we decided for **a `--local` flag that confines all InDusk artifacts to `.indusk/` and `.claude/`, excluded via `.git/info/exclude`, with a central `config.json` as the project profile**
and against **a separate tool, a container-based isolation approach, or modifying committed files and relying on discipline to not push them**,
to achieve **full InDusk functionality (plans, skills, hooks, CGC, verify, docs, tests) without any visible footprint in the team's repo**,
accepting **that `.claude/settings.json` requires an overlay approach and that local-mode tests/docs live outside conventional locations**,
because **the value of InDusk is in the workflow and tooling, not in owning the repo's config files**.

## Context

InDusk currently assumes it owns the project — init creates biome.json, CLAUDE.md, .gitignore entries, and OTel scaffolding at the repo root. This works for personal projects but breaks down when joining a team. You can't impose your dev system on day one.

The insight: most of what InDusk provides (planning, lessons, skills, hooks, CGC, verify) doesn't need to touch committed files at all. The few things that do (biome config, test runner config, docs) can live in `.indusk/` with their own configs. The only truly shared file is `.claude/settings.json`, which needs an overlay.

This also motivates consolidating `.indusk/` as InDusk's home directory — moving `planning/` there and establishing `config.json` as the central project profile. These changes benefit both modes.

## Decision

### 1. `.indusk/` is the InDusk home directory (both modes)

Everything InDusk owns lives here:

```
.indusk/
├── config.json          # Project profile — mode, detected tooling, verify contract
├── planning/            # Plans (moved from root planning/)
├── extensions/          # Extension manifests (already here)
├── settings-overlay.json # What InDusk merged into .claude/settings.json
├── biome.json           # Linter config (local mode; full mode uses root)
├── vitest.config.ts     # Test runner config (local mode, or jest.config.js)
├── tests/               # Local test files (local mode)
└── docs/                # Plain markdown docs (local mode; full mode uses VitePress)
```

`planning/` moves from repo root to `.indusk/planning/` for all projects. This is a closed-system change — only InDusk tools reference these paths.

### 2. `.indusk/config.json` as project profile

Central config that records mode, detected tooling, and the verify contract:

```json
{
  "mode": "local",
  "verify": {
    "linter": { "tool": "biome", "config": ".indusk/biome.json" },
    "testRunner": { "tool": "jest", "config": ".indusk/jest.config.js" },
    "typeCheck": "tsc"
  },
  "detected": {
    "otel": true,
    "testRunner": "jest",
    "linter": "eslint"
  }
}
```

- **Init** detects the team's tooling and writes config
- **Verify** reads config — deterministic, no re-detection
- **Catchup** reads config — only checks relevant health, prioritizes relevant skills
- **Extensions** register capabilities here when enabled
- **Both modes** use the same config shape; paths differ (`.indusk/biome.json` vs `biome.json`)

### 3. `--local` flag on init

Local mode behavior:

- **Creates:** `.indusk/` (full tree), `.claude/skills/`, `.claude/hooks/`, `.claude/lessons/`
- **Excludes via `.git/info/exclude`:** `.indusk/`, `.claude/` (InDusk additions), `.cgcignore`
- **Skips:** CLAUDE.md at root, .gitignore, composable-env, OTel scaffolding, VS Code settings
- **Detects:** team's existing linter, test runner, OTel — records in config
- **Biome:** creates `.indusk/biome.json`, verify uses `--config-path`
- **Tests:** creates `.indusk/tests/` + config for detected runner (or Vitest default). Tests import source read-only.
- **Docs:** creates `.indusk/docs/` for plain markdown. Portable to VitePress later.

### 4. Settings overlay

`.indusk/settings-overlay.json` records what InDusk merged into `.claude/settings.json` (hooks, permissions). This is the source of truth for what's "ours."

- **Init/update:** merges overlay into settings
- **`indusk pr-clean`:** strips overlay entries from settings before a PR
- **Re-apply:** `indusk update` re-merges after team changes to the base file

The overlay contents aren't sensitive — hooks and permissions. Accidentally committing them is noise, not a security issue.

### 5. `.git/info/exclude` for local isolation

Git's built-in local-only ignore file. Never committed, never seen by teammates. Local mode writes all InDusk paths here instead of `.gitignore`. This is a standard Git feature, not a hack.

## Alternatives Considered

### Separate tool / wrapper
Run InDusk outside the repo entirely, keeping all state in `~/.indusk/projects/{name}/`. Rejected because: skills, hooks, and lessons need to live in `.claude/` for Claude Code to find them. Claude Code's contract requires project-local paths.

### Discipline-based approach (modify files, don't commit them)
Just add everything normally and rely on the developer to not commit InDusk files. Rejected because: one `git add .` and you've pushed biome.json, CLAUDE.md, and planning docs to the team repo. The point of `--local` is to make this impossible, not just unlikely.

### Container / devcontainer isolation
Run the InDusk-enhanced environment in a container where the host repo is mounted read-only. Rejected because: too heavy for a personal overlay. You'd need Docker just to use your dev tools. And Claude Code runs on the host, not in containers.

### Prefixing everything `indusk-`
Name all files with an `indusk-` prefix (e.g., `indusk-biome.json`, `indusk-planning/`). Rejected because: Claude Code looks for `.claude/` specifically, and tools like biome need `--config-path` anyway. The `.indusk/` directory already provides namespacing. Prefixing individual files adds visual noise without solving the core problem.

## Consequences

### Positive
- Full InDusk functionality on any repo without affecting teammates
- `.indusk/` consolidation makes the InDusk footprint explicit in both modes
- `config.json` makes verify, catchup, and extensions deterministic — no guessing what tools are available
- Planning in `.indusk/` keeps repo root cleaner (both modes)
- Settings overlay is a clean separation of concerns

### Negative
- `.claude/settings.json` still shows as locally modified (mitigated by `pr-clean`)
- Local-mode tests in `.indusk/tests/` have longer import paths
- Two verify paths to maintain (root configs vs `.indusk/` configs) — mitigated by config.json being the single contract

### Risks
- Claude Code could change how it discovers `.claude/` paths — low risk, it's been stable
- Team could add their own `.indusk/` directory — extremely unlikely, namespaced to InDusk
- `.git/info/exclude` is per-clone — if Sandy re-clones, needs to re-run `init --local`. Mitigated by init being idempotent.

## Documentation Plan

### Pages
- New: guide/local-mode.md — how to use `--local`, what it does, the config file
- Update: guide/getting-started.md — mention local mode as an option
- Update: reference/cli/init.md — document `--local` flag

### Diagrams
- Architecture diagram showing `.indusk/` directory structure in both modes
- Mermaid in guide/local-mode.md

### Changelog
- Added `indusk init --local` for using InDusk on team codebases without touching committed files
- Moved planning to `.indusk/planning/` (all modes)
- Added `.indusk/config.json` as central project profile

### ADR in Docs
- decisions/local-init-mode.md

## References
- [Brief](brief.md)
- [Extension system ADR](../extension-system/adr.md) — `.indusk/extensions/` already established
- [Verify skill ADR](../verify-skill/adr.md) — verify's adaptive detection
- Git docs on `.git/info/exclude`: local-only excludes, standard feature
