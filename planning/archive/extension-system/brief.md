---
title: "Extension System"
date: 2026-03-22
status: accepted
---

# Extension System — Brief

## Problem

indusk-mcp hardcodes knowledge about every external tool it integrates with. FalkorDB connection details, CGC paths, composable.env awareness — all baked into source code. When a tool evolves or a project uses something new, it requires an indusk-mcp code change and a new release. There's no way for external tools to integrate without us updating our code.

## Proposed Direction

One extension system, two sources.

**Built-in extensions** ship with indusk-mcp. We maintain them. FalkorDB, CGC, and common infrastructure tools. They're available by default — the user enables the ones they need.

**Third-party extensions** live in the other tool's codebase. The tool's authors write an `indusk-extension.json` manifest following our published spec. The user adds it to their project by telling indusk-mcp where to find it — an npm package, a git repo, a URL, or a local path.

Once added, both types are identical. They sit in `.indusk/extensions/` and indusk-mcp treats them the same way.

### The CLI

```bash
# Built-in: list what ships with indusk-mcp
extensions list

# Built-in: enable one
extensions enable falkordb

# Third-party: add from external source
extensions add composable-env --from npm:composable-env
extensions add my-tool --from github:user/repo
extensions add local-tool --from ./path/to/manifest.json

# Enable after adding
extensions enable composable-env

# See what's installed and active
extensions status

# Disable without removing
extensions disable composable-env

# Remove a third-party extension
extensions remove my-tool
```

### The Manifest

Every extension — built-in or third-party — is defined by a manifest:

```json
{
  "name": "composable-env",
  "description": "Docker-based local dev environment via declarative contracts",
  "provides": {
    "networking": { "env_file": "apps/*/.env.local" },
    "services": { "command": "pnpm ce status --json" },
    "health_checks": { "command": "docker compose ps --format json" }
  },
  "hooks": {
    "on_init": "pnpm ce add-skill",
    "on_health_check": "docker compose ps --filter status=running"
  },
  "skill": "composable-env"
}
```

indusk-mcp reads these and integrates the capabilities into its tools — check_health runs extension health checks, onboard shows extension status, init runs extension on_init hooks, verification includes extension verification commands.

### Extensions Replace Domain Skills

Domain skills (nextjs, tailwind, react, etc.) become extensions. Instead of a separate domain skills system with its own detection logic and init flags, they're just lightweight extensions that primarily provide a skill:

```json
{
  "name": "nextjs",
  "description": "Next.js 13+ patterns, App Router, server components",
  "provides": {
    "skill": true,
    "verification": { "detect": { "dependency": "next" } }
  }
}
```

Rich extensions (composable.env) provide networking, services, health checks, AND a skill. Lightweight extensions (tailwind) provide just a skill and maybe detection/verification. Same system, different depth.

The current domain skill commands:
- `init --skills nextjs,tailwind` → `extensions enable nextjs tailwind`
- `init --no-domain-skills` → just don't enable any
- Auto-detection from package.json → `extensions suggest` (recommends extensions based on what's in the project)
- `list_domain_skills` MCP tool → `extensions status`

### How Third Parties Implement It

A tool author who wants their tool to work with indusk-mcp:

1. Reads our published spec (docs page with the manifest schema)
2. Creates `indusk-extension.json` in their package/repo
3. Publishes their tool normally (npm, GitHub, etc.)
4. Users add it: `extensions add their-tool --from npm:their-tool`

They don't need to know our codebase. They just follow the spec.

## Context

The FalkorDB port collision showed the cost of hardcoding. The OrbStack networking discussion showed that networking knowledge belongs in composable.env, not in indusk-mcp. The extension system makes this separation clean — composable.env tells indusk-mcp about networking via its manifest, and indusk-mcp listens.

## Scope

### In Scope
- Extension manifest spec (`indusk-extension.json` schema)
- `.indusk/extensions/` as the local registry
- `extensions` CLI subcommand (list, enable, disable, add, remove, status)
- Built-in extensions: FalkorDB, CGC, plus all current domain skills migrated to extensions (nextjs, tailwind, react, solidity, typescript, testing, docker, vitepress)
- Manifest discovery from npm packages, git repos, URLs, local paths
- Refactor check_health, onboard, init to consume extension capabilities
- Capability types: services, networking, env_vars, health_checks, verification, skill, hooks
- Published spec as a docs page
- composable.env manifest as the reference implementation (lives in composable.env's codebase)

### Out of Scope
- Building or modifying composable.env itself
- Extension marketplace / hosted registry
- Extension versioning / compatibility checking
- Auto-detection of unregistered tools (just prompt: "you have ce.json but composable-env extension isn't enabled")
- Maintaining a separate domain skills system (replaced by extensions)

## Success Criteria
- Built-in extensions available via `extensions list` and enabled via `extensions enable`
- Third-party extensions added via `extensions add --from` and enabled
- `check_health` includes all enabled extension health checks
- `/onboard` shows all enabled extensions and their status
- init runs `on_init` hooks from enabled extensions
- FalkorDB connection details come from the FalkorDB extension, not hardcoded
- The manifest spec is documented well enough for a third party to implement it from docs alone
- composable.env manifest exists in composable.env's codebase as reference implementation
- Domain skills (nextjs, tailwind, etc.) work as extensions — `extensions enable tailwind` installs the skill
- `extensions suggest` recommends extensions based on package.json and file patterns

## Depends On
- `planning/enforce-plan-gates/` (completed)
- `planning/gsd-inspired-improvements/` (completed)

## Blocks
- composable.env monorepo integration (needs the spec to implement against)
- Any future tool integrations (should use extensions, not hardcoded logic)
