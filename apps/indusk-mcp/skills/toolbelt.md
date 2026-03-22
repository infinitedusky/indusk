# InDusk Toolbelt

You have MCP tools from two servers: **indusk** (dev system) and **codegraphcontext** (code graph). This skill tells you when to use them.

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

## Local Development Environment (composable.env)

composable.env manages Docker-based local development. It builds `.env` files and `docker-compose.yml` from declarative contracts and profiles. The CLI command is `ce` (always use `pnpm ce`, never `npx ce`).

### When to use composable.env

| Situation | What to do |
|-----------|-----------|
| New app needs Docker for local dev | Create a contract in `env/contracts/`, a component in `env/components/`, add to profile in `env/profiles/` |
| Setting up a new project | `pnpm ce init` to scaffold the env directory structure |
| Building environment files | `pnpm env:build` (always run before `docker compose`) |
| Adding a new service (database, cache, etc.) | Add a contract with `persistent: true` for services that survive rebuilds |
| Debugging environment issues | `pnpm ce status` to see what's configured |

### How it fits together

composable.env turns this:
```
env/
├── contracts/       # What each app needs (ports, env vars, Docker config)
├── components/      # Shared env var groups (networking, platform)
├── profiles/        # Which contracts run together (local, staging, prod)
└── ce.json          # Root config
```

Into this:
```
docker-compose.yml   # Generated — don't edit directly
apps/*/. env.local   # Generated — per-app env files
```

### Key rules

- **Always `pnpm env:build` before `docker compose`** — the generated files must be current
- **Always `pnpm ce`, never `npx ce`** — the workspace script ensures the right binary
- **Contracts are declarative** — they describe what an app needs, not how to build it
- **Persistent services** (`persistent: true`) survive `ce build` cycles — use for databases, FalkorDB, etc.
- **The docs site Dockerfile is created by `init-docs`** — it uses `docker/Dockerfile.vitepressdev`

### For new projects

When setting up a new project that needs Docker-based local dev:

1. **Install the composable-env skill first**: run `pnpm ce add-skill` to install the composable-env skill to `.claude/skills/composable-env/SKILL.md`
2. **Read the skill before doing anything**: the composable-env skill has full documentation on contract format, profiles, component composition, and the `ce` CLI commands. Read it completely before creating contracts or running commands.
3. Then follow the setup:
   - `pnpm ce init` to scaffold the env directory
   - Create contracts for each app in `env/contracts/`
   - Create a `local` profile in `env/profiles/local.json`
   - `pnpm env:build` to generate docker-compose.yml
   - `docker compose up`

**Do NOT attempt to use composable.env without reading the skill first.** The contract format, component composition, and profile system have specific rules that aren't obvious. The skill teaches you how it works.

## Code Graph (CGC Tools)

These come from the codegraphcontext MCP server:

| When | Tool |
|------|------|
| Search for code by name | `find_code` |
| Understand what depends on a file | `analyze_code_relationships` |
| Find complex functions to refactor | `find_most_complex_functions` |
| Check for dead code | `find_dead_code` |
| Scope a plan during research | `analyze_code_relationships` on the target area |
| Custom graph queries | `execute_cypher_query` |
| Visualize the graph | `visualize_graph_query` — returns a browser link to view the graph |
| Get repo stats | `get_repository_stats` |
| See what's indexed | `list_indexed_repositories` |

### Visualizing the Code Graph

When the user asks to "show the graph", "display dependencies", or "visualize":

1. Call `visualize_graph_query` with a Cypher query like `MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100` — this returns a URL to open in the browser.
2. For a specific file's dependencies: `MATCH (n)-[r]->(m) WHERE n.name CONTAINS 'filename' RETURN n, r, m`
3. For the full project overview: `MATCH (n) RETURN n LIMIT 200`

If the user wants text-based output instead, use `execute_cypher_query` directly and format the results as a table or list.

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
| `list_domain_skills` | See available/installed domain skills |
| `check_health` | Session start, debugging connectivity |
