# Graphiti — Temporal Knowledge Graph

Graphiti is an episodic memory system backed by FalkorDB. It extracts entities and facts from text, detects contradictions, and supports semantic search across project-specific and shared knowledge.

The Graphiti MCP server runs inside the `indusk-infra` container on `http://localhost:8100/mcp` and is registered automatically by `indusk init`. The agent has direct access via `mcp__graphiti__*` tools — there is no wrapping layer.

## When to Use

- **Capture**: After a decision, retro finding, or correction — anything worth remembering across sessions
- **Search**: Before making assumptions — check what's already known about a topic
- **Recall**: At session start (`/catchup` does this automatically) or when working in an unfamiliar area

## Tools

The agent has nine `mcp__graphiti__*` tools. The five you'll use most:

| Tool | Purpose |
|------|---------|
| `add_memory` | Capture an episode (text/JSON/message) — entities and facts are extracted asynchronously |
| `search_nodes` | Find entities by natural-language query |
| `search_memory_facts` | Find facts (relationships between entities) by query |
| `get_episodes` | List recent episodes by group |
| `get_status` | Check that Graphiti is reachable and the database is healthy |

The other four (`delete_episode`, `delete_entity_edge`, `get_entity_edge`, `clear_graph`) are for cleanup — use sparingly, never in normal flow.

## Core Concepts

### Episodes
An episode is a chunk of text that Graphiti processes into entities and facts. Think of it as "something that happened" — a decision was made, a bug was found, a convention was established. Episodes are processed in the background; entities appear in search results once extraction completes (a few seconds).

### Group IDs
Every episode belongs to a group. Groups isolate knowledge:

| Group | Purpose | Example |
|-------|---------|---------|
| `{project-name}` | Project-specific knowledge | `infinitedusky`, `numero` |
| `shared` | Cross-project conventions | Developer preferences, universal patterns |

When searching, always include both the project group and `shared` to get the full picture. Use `getProjectGroupId(projectRoot)` (from `apps/indusk-mcp/src/lib/config.ts`) to get the project group consistently — it reads `.indusk/config.json` `graphiti.groupId` if set, otherwise falls back to the project directory basename.

### Entities and Facts
Graphiti extracts:
- **Entities**: Named things (tools, patterns, files, concepts)
- **Facts**: Relationships between entities with temporal validity

Facts can be contradicted — if you add "the parser handles three gate types" and later "the parser handles four gate types", Graphiti invalidates the old fact. The contradicted fact gets `invalid_at` set; the new one gets `valid_at` set. Search results respect this — invalid facts are excluded by default.

## Patterns

### Capturing a Decision

After an ADR is accepted or a significant choice is made, the planner skill calls this automatically. To do it manually:

```
mcp__graphiti__add_memory({
  name: "auth-approach-decision",
  episode_body: "We chose JWT with refresh tokens over session cookies because the API serves both web and mobile clients. Session cookies don't work well with React Native.",
  group_id: "myproject",
  source: "text",
  source_description: "ADR"
})
```

The `name` should be short and topical — the agent uses it as a handle when re-discussing the decision. The `episode_body` should be detailed enough that someone reading it cold understands the decision and the reasoning.

### Capturing a Correction

When the user corrects the agent, the work skill prompts `context learn` AND captures the correction as an episode:

```
mcp__graphiti__add_memory({
  name: "correction-pnpm-ce",
  episode_body: "Always use `pnpm ce`, never `npx ce`. The composable.env skill specifies pnpm and the project's package.json maps `ce` to the binary. npx invokes a different code path.",
  group_id: "shared",
  source: "text",
  source_description: "user correction"
})
```

Choosing `shared` vs project group:
- **`shared`**: tools, conventions, patterns that apply across projects ("always use pnpm ce", "never mock the database in integration tests")
- **`{project-name}`**: facts specific to one project's code, data, or domain ("the impl-parser handles four gate types per phase", "the bet matching engine is order-book based")

When in doubt, ask: "Would this correction make sense to a different project?" Yes → `shared`. No → project group.

### Searching Before Acting

Before making assumptions about how something works:

```
mcp__graphiti__search_nodes({
  query: "authentication middleware",
  group_ids: ["myproject", "shared"],
  max_nodes: 10
})

mcp__graphiti__search_memory_facts({
  query: "how does auth work in this project",
  group_ids: ["myproject", "shared"],
  max_facts: 10
})
```

Always search both the project group and `shared` — knowledge is split across them. The wrapper class `GraphitiClient` in `apps/indusk-mcp/src/lib/graphiti-client.ts` does this automatically when called internally; agents calling `mcp__graphiti__*` tools directly need to pass both group ids in the request.

### Capturing a Retrospective Finding

After a plan retrospective surfaces a useful insight, the retrospective skill captures it as an episode:

```
mcp__graphiti__add_memory({
  name: "retro-gate-enforcement-1",
  episode_body: "Plan gates need hook-based enforcement, not just instructions. The agent skipped gates when they were advisory only. PreToolUse hooks that block phase transitions are the fix.",
  group_id: "infinitedusky",
  source: "text",
  source_description: "retrospective insight"
})
```

One episode per insight, named `retro-{plan}-{n}`. If the retro surfaces a contradiction (we thought X, found Y), capture both framings as separate episodes — Graphiti's contradiction detection invalidates the older one.

### Recall at Session Start

The `/catchup` skill calls this automatically after reading project context, but you can also trigger it manually:

```
mcp__graphiti__search_nodes({
  query: "recent decisions",
  group_ids: ["myproject", "shared"],
  max_nodes: 5
})
```

Surface anything notable to the user. Pay extra attention to facts where `invalid_at` is recent — those are areas where prior decisions changed and active plans may be working from stale assumptions.

## Capture Triggers (Where Episodes Come From)

In normal workflow, episodes are written automatically by other skills. The agent rarely calls `add_memory` directly:

| Trigger | Skill | Episode |
|---------|-------|---------|
| Brief accepted | `planner` | `brief-accepted-{plan}` — Problem + Proposed Direction in project group |
| ADR accepted | `planner` | `adr-{plan}` — Y-statement in project group |
| User correction (`context learn`) | `work` | `correction-{slug}` — lesson body in `shared` or project group |
| Retrospective lesson | `retrospective` | `retro-{plan}-{n}` — one per insight in project group |
| Retrospective "would do differently" | `retrospective` | `retro-{plan}-wdid-{n}` — one per item in project group |

The agent should call `add_memory` directly **only** when something worth remembering happens outside these trigger points. Most of the time, just trust the skills to capture and let `/catchup` recall.

## What NOT to Capture

- **Code structure** — CGC handles this. `function X calls function Y` is a graph relationship, not an episode.
- **Git history** — `git log` is authoritative.
- **Ephemeral state** — current task, in-progress work, todo lists. Use the TodoWrite tool, not Graphiti.
- **Things already in CLAUDE.md or lessons** — those layers exist for stable, project-wide truths. Graphiti is for things that have temporal context and might be contradicted.

Graphiti is for knowledge that has temporal context — decisions that might change, facts that might be contradicted, insights that accumulate over time.

## Infrastructure

Graphiti runs inside the `indusk-infra` container alongside FalkorDB:

```bash
indusk infra start    # start the container
indusk infra status   # check health
indusk infra stop     # stop (preserves data)
```

Global config (API keys, OTel): `~/.indusk/config.env`

### Graceful Degradation
If the `indusk-infra` container is down:
- `mcp__graphiti__*` tools will report a clean error (the MCP transport fails to connect)
- The agent should fall back to flat-file context (CLAUDE.md, lessons, skills) and continue working
- The `GraphitiClient` wrapper class (used internally by indusk-mcp) returns null/empty instead of throwing
- Don't pretend the call succeeded — if Graphiti is down, capture is lost. Tell the user to `indusk infra start`.

### Health Check
```
mcp__graphiti__get_status({})
```
Returns `{ status: "healthy", message: "..." }` when Graphiti is reachable and the database is connected.
