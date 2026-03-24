---
title: "Extension System"
date: 2026-03-22
status: complete
---

# Extension System — Research

## Question

How should indusk-mcp integrate with external tools bidirectionally — both discovering tools that don't know about us (inbound) and providing an API for tools built to work with us (outbound)?

## Findings

### The Problem Today

indusk-mcp currently hardcodes knowledge about external tools:

- FalkorDB connection details are hardcoded in init, graph-tools, system-tools
- CGC is assumed to be installed via pipx at specific paths
- composable.env awareness is in the toolbelt skill as prose, not structured integration
- Verification auto-discovery reads package.json scripts but doesn't know about tool-specific patterns beyond a fixed list

Every new integration requires modifying indusk-mcp source code. When composable.env evolves, indusk-mcp doesn't know. When a project uses Prisma, indusk-mcp has to be updated to detect it.

### Two Integration Directions

**Inbound (indusk-mcp discovers existing tools)**

indusk-mcp scans the project for known patterns and adapts:

| Signal | What we learn |
|--------|-------------|
| `ce.json` exists | composable.env manages Docker services; read contracts for hostnames, ports, networking |
| `prisma/schema.prisma` exists | Prisma ORM in use; add `prisma generate` to verification |
| `.github/workflows/` exists | CI runs checks; know what's tested externally |
| `package.json` scripts | Available commands for verification auto-discovery (already implemented) |
| `docker-compose.yml` exists | Docker services defined; parse for health checks |
| `tsconfig.json` exists | TypeScript project; add `tsc --noEmit` to verification (already implemented) |

This is pattern matching — indusk-mcp knows what to look for. It's extensible via a registry of detection rules but doesn't require the external tool to cooperate.

**Outbound (external tools register with indusk-mcp)**

Tools drop a manifest file that describes what they provide:

```json
// .indusk/extensions/composable-env.json
{
  "name": "composable-env",
  "version": "1.0.0",
  "provides": {
    "services": {
      "description": "Docker service topology from contracts",
      "command": "pnpm ce status --json"
    },
    "networking": {
      "description": "Service hostnames and ports",
      "env_file": "apps/*/.env.local"
    },
    "health_checks": {
      "description": "Docker container health",
      "command": "docker compose ps --format json"
    }
  },
  "hooks": {
    "on_init": "pnpm ce add-skill",
    "on_health_check": "docker compose ps --filter status=running --format json"
  },
  "skill": ".claude/skills/composable-env/SKILL.md"
}
```

indusk-mcp discovers these manifests at startup and integrates the provided capabilities into its own tools — health checks include extension health, onboard shows extension status, etc.

### Manifest Design Considerations

**Discovery location**: `.indusk/extensions/*.json` is explicit but requires setup. Alternatively, indusk-mcp could scan for manifests in `node_modules/*/indusk-extension.json` for npm packages that self-register.

**Capability types** an extension can provide:

| Capability | What it means | How indusk-mcp uses it |
|-----------|--------------|----------------------|
| `services` | External services the project depends on | Health checks, onboard summary |
| `networking` | How to reach services (hostnames, ports) | .mcp.json generation, connection strings |
| `env_vars` | Environment variables the extension manages | Don't hardcode these; read from extension |
| `health_checks` | Commands to verify the extension is working | Include in `check_health` |
| `verification` | Commands to run during verify gate | Add to verification auto-discovery |
| `skill` | Path to a skill file | Tell the agent to read it before using the extension |
| `hooks` | Lifecycle commands | Run on_init during `init`, on_update during `update` |

**Lifecycle hooks** an extension can define:

| Hook | When it runs |
|------|-------------|
| `on_init` | During `indusk-mcp init` |
| `on_update` | During `indusk-mcp update` |
| `on_health_check` | During `check_health` MCP tool |
| `on_onboard` | During `/onboard` — extension can contribute to the summary |

### How This Fixes the FalkorDB Problem

Instead of indusk-mcp hardcoding `falkordb.orb.local`:

1. composable.env provides a manifest saying "I manage networking; read hostnames from my generated env files"
2. indusk-mcp reads the env files to find `FALKORDB_HOST=falkordb.orb.local`
3. `.mcp.json` is generated using the value from composable.env, not a hardcoded default

If composable.env isn't present, indusk-mcp falls back to its current behavior. If it is present, indusk-mcp defers to it for networking.

### How This Enables Third-Party Extensions

A deployment tool could register:

```json
{
  "name": "deploy-tool",
  "provides": {
    "deployment": {
      "description": "Deploy to staging/production",
      "command": "deploy status --json"
    }
  },
  "hooks": {
    "on_health_check": "deploy status --json"
  }
}
```

indusk-mcp would:
- Include deploy health in `check_health`
- Show deploy status in `/onboard`
- The agent knows about the deployment tool without indusk-mcp being updated

### Precedent: MCP Server Discovery

The MCP protocol itself uses `.mcp.json` for server discovery — tools register themselves and the host (Claude Code) discovers them. Our extension system follows the same pattern but at a higher level — tools register capabilities, not just connection details.

### Inbound Detection Registry

For inbound detection (tools that don't register), indusk-mcp needs a registry of detection rules:

```typescript
interface DetectionRule {
  name: string;
  detect: { file?: string; dependency?: string; devDependency?: string };
  provides: string[];
  skill?: string;
  verification_commands?: string[];
  health_check?: string;
}
```

This registry ships with the package and is extensible. It's similar to domain skill detection but broader — it detects tools, not just technologies.

## Open Questions

- Should inbound detection and outbound manifests share the same capability format?
- Should extensions be able to modify .mcp.json entries (e.g., composable.env generating the CGC connection)?
- Should the manifest format support conditional capabilities (e.g., "only provide health_check if Docker is running")?
- Where should the inbound detection registry live — hardcoded, or a JSON file in the package?

## Sources

- indusk-mcp init.ts source (current hardcoded FalkorDB setup)
- MCP protocol .mcp.json discovery pattern
- composable.env contract/component/profile architecture
- Discussion about OrbStack networking and port collision avoidance
