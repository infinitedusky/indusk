# Extension Spec

Extensions integrate external tools with InDusk MCP. Any tool can become an extension by providing a manifest file.

## Manifest Format

Create a file named `indusk-extension.json` in your package root:

```json
{
  "name": "my-tool",
  "description": "What this tool does",
  "version": "1.0.0",

  "provides": {
    "skill": true,
    "health_checks": [
      { "name": "my-service", "command": "docker ps --filter name=my-service" }
    ],
    "verification": [
      { "name": "my-check", "command": "my-tool check" }
    ],
    "networking": {
      "description": "Service hostnames",
      "env_file": "apps/*/.env.local"
    },
    "services": {
      "description": "Managed services",
      "command": "my-tool status --json"
    },
    "env_vars": {
      "MY_HOST": "my-service.orb.local",
      "MY_PORT": "5432"
    }
  },

  "hooks": {
    "on_init": "my-tool setup",
    "on_health_check": "my-tool health",
    "on_onboard": "my-tool status"
  },

  "detect": {
    "file": "my-tool.config.json"
  }
}
```

## Fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique extension name (kebab-case) |
| `description` | string | One-line description |
| `provides` | object | What capabilities this extension offers |

### Optional

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Semver version |
| `hooks` | object | Lifecycle commands |
| `detect` | object | How to detect this tool in a project |

## Capabilities (`provides`)

| Capability | Type | How InDusk uses it |
|-----------|------|-------------------|
| `skill` | boolean | If true, the extension includes a `skill.md` file. Installed to `.claude/skills/{name}/SKILL.md` when enabled. |
| `health_checks` | array of `{name, command}` | Commands run during `check_health`. Exit 0 = healthy. |
| `verification` | array of `{name, command, detect?}` | Commands added to verification auto-discovery. |
| `networking` | `{env_file?, command?, description}` | Where to read service hostnames/ports. |
| `services` | `{command?, description}` | Command that returns service topology (JSON). |
| `env_vars` | object or `{source, files}` | Environment variables the extension manages. |

## Lifecycle Hooks

| Hook | When it runs | Expected behavior |
|------|-------------|-------------------|
| `on_init` | `extensions enable {name}` | Set up the extension (install deps, create config) |
| `on_update` | `update` command | Sync extension artifacts |
| `on_health_check` | `check_health` MCP tool | Return health status (exit 0 = ok) |
| `on_onboard` | `/onboard` skill | Output status info for session summary |

Hooks are shell commands. They run in the project root directory.

## Detection Rules

Detection rules tell `extensions suggest` how to find your tool in a project:

```json
"detect": { "file": "ce.json" }
"detect": { "dependency": "next" }
"detect": { "devDependency": "vitest" }
"detect": { "file_pattern": "*.sol" }
```

Only one rule per extension. If it matches, `extensions suggest` recommends enabling it.

## Skills

If `provides.skill` is true, include a `skill.md` file alongside your manifest. This file is installed to `.claude/skills/{name}/SKILL.md` when the extension is enabled.

Skills should contain best practices, patterns, gotchas, and conventions for your tool.

## Two Sources

| Source | How to get it | Example |
|--------|--------------|---------|
| **Built-in** | Ships with indusk-mcp. `extensions enable {name}` | typescript, nextjs, worktree |
| **Third-party** | `extensions add {name} --from npm:pkg` or `--from github:user/repo` | composable-env |

Once enabled, both types sit in `.indusk/extensions/` and work identically.

## Example: Minimal Extension

```json
{
  "name": "tailwind",
  "description": "Tailwind CSS patterns and best practices",
  "provides": {
    "skill": true
  },
  "detect": {
    "dependency": "tailwindcss"
  }
}
```

## Example: Rich Extension

```json
{
  "name": "composable-env",
  "description": "Docker-based local dev via declarative contracts",
  "provides": {
    "skill": true,
    "networking": { "env_file": "apps/*/.env.local" },
    "services": { "command": "pnpm ce status --json" },
    "health_checks": [
      { "name": "docker-services", "command": "docker compose ps --format json" }
    ]
  },
  "hooks": {
    "on_init": "pnpm ce add-skill",
    "on_health_check": "docker compose ps --filter status=running"
  },
  "detect": { "file": "ce.json" }
}
```

## Overriding a shipped manifest

`.indusk/extensions/` is **package-owned**. `indusk update` flat-copies the
built-in manifest over yours whenever the hashes differ — no merge, no
local-preserve path. A hand-edited `manifest.json` is a fork parked in a
directory whose purpose is to be replaced, and every update silently reverts it.

Put local changes in **`manifest.local.json`**, beside the manifest. `update`
never writes that file, and it is merged over the built-in at load:

```jsonc
// .indusk/extensions/otel/manifest.local.json
{
  "provides": {
    "health_checks": [
      { "name": "otel-packages-installed",
        "command": "backend/.venv/bin/python -c 'import opentelemetry'" }
    ]
  }
}
```

**Named entries merge by name** — `health_checks` and `verification` alike. An
entry replaces the built-in of the same name; a new name is appended. Overriding
one entry does not fork the rest, so upstream improvements to the others keep
arriving. Anything else in `provides` is replaced wholesale.

That is the reason this is a separate file rather than a preserve-local-edits
rule in `update`. Preserving edits would pin the project to a stale fork and
hide every upstream fix behind it — trading a loud-once problem for a
silent-forever one. Observed in practice: a project forked the otel manifest,
a later release improved that same manifest, and the fork would have masked the
improvement indefinitely.

`indusk extensions status` marks an extension whose manifest was overridden with
`[manifest.local.json applied]`, so a check you are reading can be told apart
from the one upstream ships. A malformed override **throws** rather than falling
back to the built-in — silently ignoring it would restore the silence this
mechanism exists to remove.
