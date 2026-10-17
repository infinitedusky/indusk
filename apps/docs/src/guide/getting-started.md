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

Usually a stray daemon: an InDusk Jaeger or collector of this home that the record does not name, left by a start that did not know the daemon was running (or an orphan, whose home was deleted underneath it). `status` lists them, with the time each started and the ports it holds.

```bash
indusk telemetry status           # the real daemon's ports; finds a daemon whose record is gone
indusk telemetry reap --dry-run   # which strays of this home, and which orphans, would be stopped
indusk telemetry reap             # stop them (never the recorded daemon, another live home's, or a stranger's)
```

If the record (`~/.indusk/telemetry.json`) went missing while the daemon kept running, nothing needs repairing by hand (the same holds for a record that names only dead processes): the next command that looks (`status`, a promise reader, the evaluator) finds the daemon from the process list and its listening sockets and writes the record again.

The daemon runs on its own ports, chosen once and stored (`indusk telemetry address` prints them: `24318` for traces, `24319` for logs, `24316` for the interface and `24317` for MCP when the block was free). `indusk telemetry start` takes over a daemon that is already running and never starts a second; a port that something else holds is refused with the port, the process and its command named, never silently replaced by a random one, which is what made this failure invisible.
