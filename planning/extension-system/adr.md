---
title: "Extension System"
date: 2026-03-22
status: accepted
---

# Extension System

## Y-Statement

In the context of **a dev system that needs to integrate with external tools (FalkorDB, composable.env, CGC, framework-specific patterns) without hardcoding knowledge of each one**,
facing **every new integration requiring source code changes, port collisions from hardcoded connection details, and a separate domain skills system that duplicates the integration concept**,
we decided for **a unified extension system where built-in and third-party extensions use the same manifest format, discovered from `.indusk/extensions/`, managed via an `extensions` CLI**
and against **maintaining separate systems for domain skills, tool detection, and hardcoded integrations, or requiring all tools to implement our spec before we can integrate them**,
to achieve **any tool can integrate with indusk-mcp by providing a manifest — either shipped built-in or pulled from the tool's own package — and domain skills, health checks, verification commands, and networking all flow through one system**,
accepting **the complexity of a manifest spec, the migration of existing domain skills, and the dependency on tool authors adopting the spec for deep integration**,
because **one integration system is simpler than three (domain skills + hardcoded tools + ad-hoc detection), and publishing a spec lets the ecosystem grow without us maintaining every integration**.

## Context

indusk-mcp currently has three separate integration mechanisms:
1. Hardcoded tool knowledge (FalkorDB host/port in init, CGC paths in system-tools)
2. Domain skills (8 markdown files with best practices, auto-detected from package.json)
3. Verification auto-discovery (reads package.json scripts, detects config files)

These all do the same thing — adapt indusk-mcp's behavior based on what's in the project. The extension system unifies them.

The FalkorDB port collision incident and the composable.env networking discussion demonstrated that hardcoding breaks when tools interact. Extensions solve this by letting each tool declare its own topology.

See `planning/extension-system/research.md` for the manifest format analysis and `brief.md` for the two-source model.

## Decision

### One System, Two Sources

All extensions use the same manifest format and sit in `.indusk/extensions/`. The only difference is where they come from:

**Built-in**: Ship with the indusk-mcp package under `extensions/`. Available immediately — just enable them.

**Third-party**: Live in the other tool's codebase as `indusk-extension.json`. Users add them by pointing indusk-mcp at the source — npm package, git repo, URL, or local path.

### Manifest Format

```json
{
  "name": "composable-env",
  "description": "Docker-based local dev environment via declarative contracts",
  "version": "1.0.0",

  "provides": {
    "skill": true,
    "networking": {
      "description": "Service hostnames from OrbStack DNS",
      "env_file": "apps/*/.env.local"
    },
    "services": {
      "description": "Docker service topology",
      "command": "pnpm ce status --json"
    },
    "health_checks": [
      { "name": "docker-services", "command": "docker compose ps --format json" }
    ],
    "verification": [
      { "name": "env-build", "command": "pnpm env:build", "detect": { "file": "ce.json" } }
    ],
    "env_vars": {
      "source": "env_file",
      "files": ["apps/*/.env.local"]
    }
  },

  "hooks": {
    "on_init": "pnpm ce add-skill",
    "on_health_check": "docker compose ps --filter status=running",
    "on_onboard": "pnpm ce status"
  },

  "detect": {
    "file": "ce.json"
  }
}
```

### Capability Types

| Capability | What it means | How indusk-mcp uses it |
|-----------|--------------|----------------------|
| `skill` | Extension includes a SKILL.md | Installed to `.claude/skills/{name}/SKILL.md` when enabled |
| `networking` | Extension manages service hostnames/ports | Read env files for connection strings; don't hardcode |
| `services` | Extension manages external services | Include in onboard summary |
| `health_checks` | Commands to verify the extension is healthy | Run during `check_health` |
| `verification` | Commands to run during verify gate | Add to verification auto-discovery |
| `env_vars` | Environment variables the extension manages | Read from specified files |

### Lifecycle Hooks

| Hook | When | What |
|------|------|------|
| `on_init` | `extensions enable {name}` or during `init` | Set up the extension (install skill, create config) |
| `on_update` | `update` command | Sync extension artifacts |
| `on_health_check` | `check_health` MCP tool | Check if extension's services are running |
| `on_onboard` | `/onboard` skill | Contribute to the session-start summary |

### Detection (for `extensions suggest`)

Extensions can include a `detect` field that describes how to find them in a project:

```json
"detect": {
  "file": "ce.json"
}
```

or

```json
"detect": {
  "dependency": "next"
}
```

or

```json
"detect": {
  "file_pattern": "*.sol"
}
```

`extensions suggest` scans the project and recommends extensions whose detection rules match. It doesn't auto-enable — it suggests.

### CLI Commands

```
extensions list              # Show all available (built-in + added)
extensions status            # Show enabled/disabled state and health
extensions enable <name>     # Enable an extension (runs on_init hook)
extensions disable <name>    # Disable without removing
extensions add <name> --from <source>  # Add third-party extension
extensions remove <name>     # Remove a third-party extension
extensions suggest           # Recommend extensions based on project contents
```

### Migration: Domain Skills → Extensions

Current domain skills become built-in extensions with `"provides": { "skill": true }`:

| Current domain skill | Becomes extension | Additional capabilities |
|---------------------|-------------------|----------------------|
| nextjs.md | nextjs | `detect: { dependency: "next" }`, verification hints |
| tailwind.md | tailwind | `detect: { dependency: "tailwindcss" }` |
| react.md | react | `detect: { dependency: "react" }` |
| solidity.md | solidity | `detect: { file_pattern: "*.sol" }` |
| typescript.md | typescript | `detect: { devDependency: "typescript" }`, verification: tsc |
| testing.md | testing | `detect: { devDependency: "vitest" }`, verification: vitest |
| docker.md | docker | `detect: { file_pattern: "Dockerfile*" }` |
| vitepress.md | vitepress | `detect: { dependency: "vitepress" }` |

Plus new rich extensions:

| Extension | Type | Capabilities |
|-----------|------|-------------|
| falkordb | Built-in | Health check, networking (OrbStack hostname) |
| cgc | Built-in | Health check, verification (code graph queries) |

### How indusk-mcp Consumes Extensions

**At startup** (session start / onboard):
1. Scan `.indusk/extensions/` for enabled extensions
2. For each: run `on_onboard` hook if defined, collect health status
3. Report in onboard summary

**During check_health**:
1. Run built-in checks (existing)
2. For each enabled extension with `health_checks`: run the commands
3. Merge results

**During verification**:
1. Run auto-discovered checks (existing)
2. For each enabled extension with `verification`: add their commands
3. Merge results

**During init**:
1. For each enabled extension with `on_init`: run the hook
2. For extensions with `skill: true`: install the skill file

**For networking/env_vars**:
1. Read from specified env files or commands
2. Use these values instead of hardcoded defaults
3. Fall back to defaults only when no extension provides the value

### Directory Structure

```
.indusk/
├── extensions/
│   ├── falkordb.json       # Built-in, enabled
│   ├── cgc.json            # Built-in, enabled
│   ├── typescript.json     # Built-in, enabled
│   ├── nextjs.json         # Built-in, enabled
│   ├── composable-env.json # Third-party, added + enabled
│   └── .disabled/          # Disabled extensions moved here
│       └── docker.json     # Built-in, disabled
```

### Skill Files

Extensions with `skill: true` have a corresponding skill markdown file. For built-in extensions, these ship in the package under `extensions/{name}/skill.md`. For third-party extensions, the skill is pulled from the source alongside the manifest.

Installed to `.claude/skills/{name}/SKILL.md` when the extension is enabled.

## Alternatives Considered

### Keep domain skills separate from extensions
Rejected — two systems doing the same thing (providing tool-specific knowledge and configuration). Unifying them reduces conceptual overhead and maintenance.

### Auto-enable extensions based on detection
Rejected — too magical. Detection suggests, the user decides. Enabling runs hooks that may modify the project, so it should be explicit.

### Require all tools to implement the spec (no built-in extensions)
Rejected — FalkorDB and Redis will never ship an indusk-mcp manifest. Built-in extensions for common infrastructure tools are necessary.

### Store extensions in `.claude/` instead of `.indusk/`
Rejected — `.claude/` is Claude Code's space (skills, hooks, settings). `.indusk/` is our space. Clear separation.

## Consequences

### Positive
- One system for all integrations — domain skills, tool knowledge, health checks, networking
- Third parties can integrate without our code changing
- Networking and connection details come from extensions, not hardcodes
- `extensions suggest` helps with project setup
- Migration path for existing domain skills
- Published spec enables ecosystem growth

### Negative
- Migration effort for existing domain skills
- Manifest format must be stable — breaking changes affect third-party authors
- More complexity than the current "just a markdown file" domain skills
- `.indusk/` directory is a new convention projects need to adopt

### Risks
- **Third-party adoption** — tool authors may not write manifests. Mitigate with built-in extensions for common tools.
- **Manifest format evolution** — v1 may be wrong. Mitigate by keeping it simple, adding fields later, never removing.
- **Extension conflicts** — two extensions providing the same capability. Mitigate by making the last-enabled one win, with a warning.

## References
- `planning/extension-system/research.md`
- `planning/extension-system/brief.md`
- MCP protocol `.mcp.json` discovery pattern (similar concept)
- composable.env contract/component architecture (inspiration for declarative manifests)
