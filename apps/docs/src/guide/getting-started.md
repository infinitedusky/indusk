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

### 2. Initialize a project

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
- `.mcp.json` — MCP server config (InDusk, plus whatever your enabled extensions register)
- `.vscode/settings.json` — Biome integration (skipped in local mode)
- `biome.json` — base quality config (`.indusk/biome.json` in local mode)
- `instrumentation.ts` — OpenTelemetry auto-instrumentation (skipped in local mode)
- `.indusk/extensions/` — extension manifests for the extensions you enable
- `.claude/hooks/` — the gate hooks that enforce plan structure at write time

`init` also:
- Auto-enables detected extensions
- Removes registrations for MCP servers InDusk has retired
- Installs the gate hooks into `.claude/hooks/`

### 3. Start coding

Open the project in Claude Code. You should see:
- Skills available — the plan lifecycle (`/planner`, `/work`, `/verify`, `/claude-md`, `/document`, `/falsify`, `/cleanup`, `/retrospective`), and the session and workflow skills (`/catchup`, `/handoff`, `/git`, `/highlight`, `/research`, `/rail-check`, `/compact-context`)
- **InDusk MCP tools** — lessons, plans, context, extensions, health
- **Extension MCP tools** — whatever your enabled extensions provide. On a project with `local-telemetry` on, that includes Jaeger's tools for querying traces.

Durable knowledge lives in **lessons** (`.claude/lessons/`), written by the eval agent from highlights the working agent flags. `indusk sync pull` merges the shared channel in at `/catchup`.

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

This migrates stale config, syncs skills/lessons/hooks, removes registrations for MCP servers InDusk has retired, and picks up new extensions. It never overwrites CLAUDE.md, planning/, or your code.

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

### Hooks aren't firing

The gate hooks live in `.claude/hooks/` and are registered in `.claude/settings.json`. Both halves must be present — a registration without the file, or a file without the registration, fails silently.

```bash
ls .claude/hooks/          # the hook files
indusk update              # reinstall hooks + re-register them
```

If your project's `package.json` declares `"type": "commonjs"`, you need 1.36.1 or newer: the hooks are ESM, and older versions did not scope a module type to the hooks directory, so every hook died at load without reporting anything.

### `check_health` reports an extension error

```bash
indusk extensions status   # which extension, which check
```

Each check is a shell command declared in the extension's manifest, so the failing command is shown verbatim — run it directly to see why. Errors from extensions you do not use are expected; disable them with `indusk extensions disable <name>`.

### Telemetry: the daemon looks up but no traces arrive

Usually a stray daemon holding the port your exporter targets. A telemetry process whose `--config` path no longer exists is an orphan — from a deleted temp home or worktree — and it answers on the port without being an OTLP receiver.

```bash
indusk telemetry reap --dry-run   # what is orphaned
indusk telemetry reap             # kill them
indusk telemetry status           # the real daemon's ports
```

Since 1.36.2, `indusk telemetry start` refuses to bind a different port than you asked for rather than silently choosing a random one, which is what made this failure invisible.
