# InDusk Toolbelt

You have MCP tools from multiple servers. This skill tells you when to use them and how they connect.

## MCP Server Types

There are two types of MCP servers in your `.mcp.json`:

**Command-based** (`"command": "..."`) — a local process that runs on your machine. Examples: indusk, codegraphcontext. These start when Claude Code starts and communicate via stdio.

**Streamable HTTP** (`"type": "streamableHttp"`) — a remote server hosted externally. Example: Dash0. These connect over HTTPS to a URL. No local process, no npm package, no `npx`. They just need a URL and auth credentials in `.mcp.json`.

Both types expose tools the same way — you call them identically. The difference is where they run.

To see which MCP servers and extensions are active, call `extensions_status`.

## How the Skills Work Together

```
/plan → creates planning docs (research, brief, ADR, impl)
                ↓
/work → executes impl checklist, phase by phase
         each phase has four gates:
           implement → verify → context → document → next phase
         hooks enforce gates — can't skip (see Gate Policy below)
                ↓
/retrospective → audit, quality ratchet, knowledge handoff, archive
```

**Process skills**: plan (writes), work (executes), verify (checks), context (remembers), document (records), retrospective (audits), onboard (orients)

**Extensions**: provide tool-specific knowledge (skills), health checks, networking, verification commands. Run `extensions status` to see what's active.

## Lessons First

The lesson system is how this project teaches you. Before writing any code, **always read the lessons**. They capture hard-won patterns and mistakes from past work — community-wide and personal.

1. Call `list_lessons` at the start of every session. Read each one. These are not suggestions — they are rules this project has learned the hard way.
2. When you discover a non-obvious pattern during work, capture it with `add_lesson`. Good lessons are actionable: they say what to do, why, and what goes wrong if you don't.
3. During retrospectives, review whether any new lessons should be added based on what worked and what didn't.

## Session Start

When a new session begins:

1. Call `list_lessons` — **read all lessons first**. Internalize these patterns before touching anything.
2. Call `check_health` — verify FalkorDB and CGC are running. If unhealthy, tell the user what's down and how to fix it before proceeding.
3. Call `list_plans` — understand what plans exist, their stages, and what's in progress.
4. Call `get_context` — read the project's CLAUDE.md to understand architecture, conventions, and current state.

## Creating a New App

When starting a new service or app in the monorepo, follow this sequence:

### 1. Create the app

| Runtime | Command |
|---------|---------|
| **Next.js** | `npx create-next-app apps/my-app` |
| **React SPA** (Vite) | `pnpm create vite apps/my-app --template react-ts` |
| **Node.js** (Express/Fastify) | Create `apps/my-app/` with `package.json`, `src/index.ts` |
| **Python** | Create `apps/my-app/` with `pyproject.toml` or `requirements.txt` |

### 2. Initialize indusk-mcp

```bash
cd apps/my-app
npx @infinitedusky/indusk-mcp init
```

This detects the runtime and scaffolds:
- Skills, hooks, lessons, CLAUDE.md
- **Next.js**: `instrumentation.ts` (app root) using `@vercel/otel`, `src/logger.ts` using Pino
- **Node.js**: `src/instrumentation.ts` (full OTel SDK + FilteringExporter), `src/filtering-exporter.ts`, `src/logger.ts`
- **Python**: `instrumentation.py` (OTel SDK with auto-instrumentation)
- Biome config, VS Code settings, `.cgcignore`

### 3. Install the printed packages

`init` prints the install command — run it:
- **Next.js**: `pnpm add @vercel/otel pino pino-opentelemetry-transport`
- **Node.js**: `pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node ...` (full list printed by init)
- **Python**: `pip install opentelemetry-distro opentelemetry-instrumentation opentelemetry-exporter-otlp`

### 4. Wire instrumentation into the entry point

- **Next.js**: automatic — Next.js loads `instrumentation.ts` from the app root
- **Node.js**: `node --import ./src/instrumentation.ts src/index.ts`
- **Python**: `opentelemetry-instrument python your_app.py`

### 5. Create a composable.env contract (if using composable.env)

Create `env/contracts/my-app.contract.json`:
```json
{
  "name": "my-app",
  "location": "apps/my-app",
  "vars": {
    "OTEL_SERVICE_NAME": "my-app",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "${dash0.HTTP_ENDPOINT}",
    "OTEL_EXPORTER_OTLP_HEADERS": "${dash0.OTLP_HEADERS}"
  }
}
```

Then `pnpm ce env:build` generates the `.env` files.

### 6. Enable extensions

```bash
npx @infinitedusky/indusk-mcp extensions enable dash0
```

If `.indusk/extensions/dash0/.env` has credentials, this auto-configures the MCP server. Otherwise it tells you what to create.

### 7. Verify

- Start the app, hit an endpoint
- Check Dash0 for traces: `mcp__dash0__getSpans` with `service.name = my-app`
- Check health: `mcp__indusk__check_health` should show OTel extension healthy

## Before Modifying Code

Before touching any file:

1. Call `get_plan_status` for the active plan — know which phase you're in and what items remain.
2. Use CGC's `analyze_code_relationships` on the files you're about to change — understand dependencies and blast radius.
3. If the blast radius is large (many downstream consumers), flag it to the user before proceeding.

## During Work

While executing impl items:

- After completing verification items, call `quality_check` to confirm Biome passes.
- After completing context items, call `get_context` to verify CLAUDE.md was updated correctly.
- After completing document items, call `list_docs` to verify the doc page exists.

## Gate Policy

Gates prevent skipping important work. Three enforcement levels, set via `gate_policy` in impl frontmatter or `.claude/settings.json`:

| Mode | Writing the impl (`/plan`) | Executing the impl (`/work`) |
|------|---------------------------|------------------------------|
| **`strict`** | Every gate must have a real item. No `(none needed)`. | Every item must be completed. No skipping. |
| **`ask`** (default) | Every gate must have a real item. No `(none needed)`. | Skip only with conversation proof: `(none needed — asked: "..." — user: "...")` |
| **`auto`** | `(none needed)` / `skip-reason:` allowed at write time. | Skip without asking using `(none needed)` or `skip-reason:`. |

Hooks enforce both stages. See the work skill "Gate Override Policy" for full details.

## Advancing Phases

When you think a phase is complete:

1. Call `advance_plan` — it will tell you if anything is missing across all four gates (implementation, verification, context, document).
2. If blocked, work through the missing items before trying again.
3. Never manually mark a phase complete without calling `advance_plan` first.

## After a Retrospective

1. Call `check_docs_coverage` — flag any completed plans missing decision pages.
2. Call `get_quality_config` — review if new Biome rules should be added based on lessons learned.
3. If a new rule is needed, call `suggest_rule` with a description of the mistake to find matching Biome rules.

## Skill and System Management

- Call `get_skill_versions` to check if installed skills are current or outdated.
- Call `get_system_version` to verify the installed package version.

## Extensions

Tools integrate with indusk-mcp via the extension system. Run `extensions status` to see what's enabled. Run `extensions suggest` to discover what's available for your project.

Extensions provide skills, health checks, networking, verification commands, and more. See the extension spec docs for details.

For composable.env: enable the `composable-env` extension. It provides Docker networking, service topology, and its own skill. **Read the skill before using composable.env** — the contract format has specific rules.

## Code Graph

Enable the `cgc` extension for code graph tools (`extensions enable cgc`). The CGC extension skill has the full reference for when to use each tool. Key ones: `query_dependencies` (blast radius), `find_code` (search), `visualize_graph_query` (browser visualization).

## Tool Reference

### indusk (20 tools)

| Tool | When to use |
|------|-------------|
| **Graph (use these constantly)** | |
| `index_project` | After init, or when codebase changed significantly |
| `query_dependencies` | **BEFORE modifying any file** — understand blast radius |
| `query_graph` | Custom Cypher queries for advanced structural analysis |
| **Plans** | |
| `list_plans` | Session start, orientation |
| `get_plan_status` | Before working on a plan, checking progress |
| `advance_plan` | End of every phase — validates all gates and blockers |
| `order_plans` | Understanding plan dependencies |
| **Context** | |
| `get_context` | Session start, after context updates |
| `update_context` | Updating CLAUDE.md sections programmatically |
| **Quality** | |
| `get_quality_config` | Reviewing Biome rules, after retros |
| `suggest_rule` | Finding Biome rules for new patterns |
| `quality_check` | Auto-discovers and runs checks; use `discover` mode to see available commands |
| **Lessons** | |
| `list_lessons` | **Session start** — read all lessons before writing code |
| `add_lesson` | After retros, or when discovering a non-obvious pattern |
| **Docs** | |
| `list_docs` | After document items, checking coverage |
| `check_docs_coverage` | After retros, finding doc gaps |
| **System** | |
| `get_system_version` | Debugging, version checks |
| `get_skill_versions` | Checking for outdated process skills |
| `extensions_status` | See available/installed extensions |
| `check_health` | Session start, debugging connectivity |
