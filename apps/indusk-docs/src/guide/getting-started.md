# Getting Started

Set up the InDusk development system in a new or existing project.

## Architecture Overview

<ExcalidrawEmbed src="/diagrams/architecture.excalidraw.json" title="InDusk MCP Architecture" />

## Prerequisites

- **Node 22+** — Tailwind 4 requires it
- **pnpm** — package manager
- **Docker / OrbStack** — for FalkorDB and local dev containers
- **pipx** — for installing CodeGraphContext

## Quick Start

### 1. Install the dev system

```bash
npx indusk-mcp init
```

This creates:
- `.claude/skills/` — 6 skill files (plan, work, verify, context, document, retrospective)
- `CLAUDE.md` — project context template with 6 sections
- `planning/` — directory for plan documents
- `.mcp.json` — MCP server config for Claude Code
- `.vscode/settings.json` — Biome integration
- `biome.json` — base quality config
- `instrumentation.ts` — OpenTelemetry auto-instrumentation (Node.js/Next.js) or `instrumentation.py` (Python)
- `filtering-exporter.ts` — category-based span filtering (instrument everything, control export volume)
- `logger.ts` — Pino structured logger with dual output (stdout + OTLP)

### 2. Install Biome

```bash
pnpm add -D @biomejs/biome
```

### 3. Set up FalkorDB (for code graph)

```bash
docker run -d --name falkordb --restart unless-stopped \
  -p 6379:6379 -v falkordb-global:/data \
  falkordb/falkordb:latest
```

### 4. Install CodeGraphContext

```bash
pipx install codegraphcontext
```

Add CGC to `.mcp.json`:

```json
{
  "mcpServers": {
    "codegraphcontext": {
      "command": "cgc",
      "args": ["mcp", "start"],
      "env": {
        "DATABASE_TYPE": "falkordb-remote",
        "FALKORDB_HOST": "localhost",
        "FALKORDB_PORT": "6379",
        "FALKORDB_GRAPH_NAME": "your-project-name"
      }
    }
  }
}
```

### 5. Start a Claude Code session

Open the project in Claude Code. You should see:
- 6 skills available (`/plan`, `/work`, `/verify`, etc.)
- InDusk MCP tools available (20 tools)
- CodeGraphContext MCP tools available (19 tools)

Run `check_health` to verify everything is connected.

## Updating Skills

When the package releases new skill versions:

```bash
npx indusk-mcp update
```

This compares content hashes and only replaces outdated skills. It never touches CLAUDE.md, planning/, biome.json, or .mcp.json.

## Workflow

1. **Plan** — `/plan feature-name` creates the planning lifecycle
2. **Brief** → **ADR** → **Impl** — documents advance through stages
3. **Work** — `/work` executes impl items one at a time
4. **Verify** — each phase ends with automated checks
5. **Document** — each phase ends with a docs gate
6. **Retrospective** — closing audit with knowledge handoff

See the [Reference](/reference/) for detailed docs on each skill and tool.
