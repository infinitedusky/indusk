# Getting Started

Set up the InDusk development system in a new or existing project.

## Architecture Overview

<ExcalidrawEmbed src="/diagrams/architecture.excalidraw.json" title="InDusk MCP Architecture" />

## Prerequisites

- **Node 22+** — Tailwind 4 requires it
- **pnpm** — package manager
- **Docker** — OrbStack recommended on macOS, Docker Desktop on Windows/Linux

## Quick Start

### 1. Install globally

```bash
npm i -g @infinitedusky/indusk-mcp
```

### 2. Start infrastructure

```bash
indusk infra start
```

First run creates `~/.indusk/config.env` — add your `GOOGLE_API_KEY` there for Graphiti (get one from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)). Without it, FalkorDB and CGC still work, but the knowledge graph won't.

### 3. Initialize a project

```bash
cd your-project
indusk init
```

Or for team repos you don't own:

```bash
indusk init --local
```

See [Local Mode](./local-mode) for details on using InDusk without touching committed files.

`init` sets up:
- `.claude/skills/` — 6 process skills + extension skills
- `.claude/lessons/` — community lessons (rules from past mistakes)
- `CLAUDE.md` — project context template (skipped in local mode)
- `.indusk/planning/` — directory for plan documents
- `.indusk/config.json` — project profile (mode, detected tooling, verify contract)
- `.mcp.json` — MCP server config (InDusk, CodeGraphContext, **Graphiti** ≥ v1.10.0, plus optional dash0 / excalidraw)
- `.vscode/settings.json` — Biome integration (skipped in local mode)
- `biome.json` — base quality config (`.indusk/biome.json` in local mode)
- `instrumentation.ts` — OpenTelemetry auto-instrumentation (skipped in local mode)
- `.indusk/extensions/` — extension manifests (graphiti, cgc, etc.)
- `.cgcignore` — excludes build artifacts from code graph

`init` also:
- Installs CodeGraphContext via pipx (if not already installed)
- Checks the infrastructure container and starts it if stopped
- Indexes the codebase into the code graph
- Auto-enables detected extensions

### 4. Start coding

Open the project in Claude Code. You should see:
- Skills available (`/planner`, `/work`, `/verify`, `/context`, `/document`, `/retrospective`, `/catchup`, `/handoff`, `/jj`)
- **InDusk MCP tools** — lessons, plans, context, extensions, code graph
- **CodeGraphContext MCP tools** — structural code intelligence (`graph_find`, `query_dependencies`, `find_dead_code`, …)
- **Graphiti MCP tools** (≥ v1.10.0) — temporal knowledge graph (`add_memory`, `search_nodes`, `search_memory_facts`, …). See [Graphiti reference](/reference/tools/graphiti). Episodes are written automatically by the planner/work/retrospective skills at trigger points; recall happens at the start of every `/catchup`.

Run `/catchup` to verify everything is connected.

## Updating

### Update the CLI and MCP server

```bash
npm i -g @infinitedusky/indusk-mcp@latest
```

Then in each project:

```bash
indusk init
```

This migrates stale config (e.g., old FalkorDB host), syncs skills/lessons, and picks up new extensions. It never overwrites CLAUDE.md, planning/, or your code.

### Update skills only

```bash
indusk update
```

Compares content hashes and only replaces outdated skills. Doesn't touch project files.

## Workflow

1. **Plan** — `/plan feature-name` creates the planning lifecycle
2. **Brief** → **ADR** → **Impl** — documents advance through stages
3. **Work** — `/work` executes impl items one at a time
4. **Verify** — each phase ends with automated checks
5. **Document** — each phase ends with a docs gate
6. **Retrospective** — closing audit with knowledge handoff

See the [Reference](/reference/) for detailed docs on each skill and tool.

## Troubleshooting

### Container won't start

```bash
indusk infra status   # check what's happening
docker logs indusk-infra  # see container logs
```

If the image doesn't exist, build it from the infinitedusky repo:
```bash
docker build -f docker/Dockerfile.infra -t indusk-infra .
```

### API key not set

Graphiti requires `GOOGLE_API_KEY` in `~/.indusk/config.env`. Without it:
- FalkorDB works (CGC code graph functional)
- Graphiti retries indefinitely (knowledge graph non-functional)

Add the key and restart: `indusk infra stop && indusk infra start`

### Port conflicts

`indusk-infra` uses ports 6379 (FalkorDB) and 8100 (Graphiti). If another service uses these ports:
- Stop the conflicting service
- Or run the container with different port mappings and update `~/.indusk/config.env`

### CGC not working

```bash
cgc --version        # is it installed?
cgc doctor           # run diagnostics
indusk infra status  # is FalkorDB up?
```

If CGC isn't installed, `indusk init` installs it automatically via pipx.
