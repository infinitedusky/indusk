---
title: "Local Init Mode"
date: 2026-04-05
status: accepted
---

# Local Init Mode — Brief

## Problem

When joining an existing team repo, `indusk init` creates files that affect the shared codebase — biome.json, ce.json, .gitignore entries, CLAUDE.md. You don't want to change the team's setup on day one. There's no way to use InDusk's full tooling (plans, skills, hooks, CGC, lessons) without touching committed files.

## Proposed Direction

### 1. `.indusk/` becomes the InDusk home directory (all modes)

Move `planning/` into `.indusk/planning/`. The `.indusk/` directory already holds extension manifests — now it holds everything InDusk owns: plans, extensions, config, settings overlay. One directory. Whether to commit it is the user's choice.

### 2. `.indusk/config.json` — the project profile

Central config file that records mode, detected tooling, and verify contract:

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

Init detects what the team uses and writes it here. Verify reads it — no guessing, no re-detecting. In full mode it works the same way, just pointing to root-level configs instead of `.indusk/` paths. One verify path, one config contract, both modes.

### 3. `indusk init --local`

Local mode creates the same InDusk setup, but nothing touches committed files. The model is simple:

| What | Where | Local mode |
|------|-------|------------|
| Plans, extensions, config | `.indusk/` | Git-excluded via `.git/info/exclude` |
| Skills, hooks, lessons, handoff | `.claude/` (InDusk additions) | Git-excluded via `.git/info/exclude` |
| Settings (hooks, permissions) | `.claude/settings.json` | Overlay — merged on init, stripped on `pr-clean` |
| Biome config | `.indusk/biome.json` | Git-excluded. Verify uses `--config-path .indusk/biome.json` |
| Tests | `.indusk/tests/` + `.indusk/vitest.config.ts` | Local test runner. Tests import source read-only. |
| Documentation | `.indusk/docs/` | Plain markdown. Portable to VitePress later. |
| composable-env, OTel, VS Code, CLAUDE.md, .gitignore | — | Not created. Team owns these. |

**Settings overlay:** `.indusk/settings-overlay.json` records exactly what InDusk merged into `.claude/settings.json`. This is the source of truth for what's "ours." `indusk pr-clean` reads the overlay and strips those entries before a PR. `indusk update` re-applies it. The additions aren't sensitive (hooks and permissions), so accidentally including them is noise, not a security issue.

**`.git/info/exclude`:** Git's local-only ignore file. Never committed, never seen by teammates. Local mode writes InDusk paths here instead of `.gitignore`.

### What works in local mode

- MCP servers (indusk, CGC) configured via `claude mcp add`
- CGC indexing the codebase
- Skills, lessons, hooks all fire locally
- Planning workflow (plans live in `.indusk/planning/`)
- Graph tools, quality tools, extensions (except composable-env)
- Infrastructure container (`indusk-infra`)

### What local mode skips

composable-env, OTel scaffolding, VS Code settings, CLAUDE.md at root, .gitignore modifications. Team owns all of these.

## Context

Sandy wants to use InDusk as a personal dev system when working on other teams' codebases. The tooling is valuable regardless of whether the project was set up with InDusk. Local mode makes InDusk a personal overlay — invisible to teammates, fully functional for the developer.

## Scope

### In Scope
- `--local` flag on `indusk init`
- Move `planning/` → `.indusk/planning/` (all modes)
- Update all tools and skills that reference `planning/` paths
- `.git/info/exclude` management for local mode
- Biome config at `.indusk/biome.json` in local mode, verify uses `--config-path`
- Local docs at `.indusk/docs/` — plain markdown, document skill targets this in local mode. Portable to VitePress later.
- Local tests at `.indusk/tests/` with `.indusk/vitest.config.ts` — verify uses this config in local mode
- Settings overlay (`.indusk/settings-overlay.json`) — merge/strip/re-apply
- `indusk pr-clean` command — strips overlay from settings before PR
- `.indusk/config.json` as central project profile — mode, detected tooling, verify contract. Both modes use it.
- Migrate existing `planning/` → `.indusk/planning/` for current projects

### Out of Scope
- Migration from local → full mode (just re-run init without --local)
- composable-env in local mode
- OTel scaffolding in local mode
- Changes to how `.claude/` itself works (Claude Code owns that contract)

## Success Criteria
- `indusk init --local` in a team repo: `git status` shows nothing new
- All InDusk paths excluded via `.git/info/exclude`
- `indusk pr-clean` produces a clean `.claude/settings.json` (no InDusk entries)
- All MCP tools work: plans, lessons, graph, health, extensions
- `indusk update` preserves local mode
- Existing projects migrate `planning/` → `.indusk/planning/` cleanly

## Depends On
- Nothing — can start immediately

## Blocks
- Nothing currently
