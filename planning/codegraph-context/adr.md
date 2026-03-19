---
title: "CodeGraphContext — Structural Knowledge Layer"
date: 2026-03-19
status: accepted
---

# CodeGraphContext — Structural Knowledge Layer

## Y-Statement

In the context of **an AI-assisted dev system where the agent has decision memory (CLAUDE.md) and enforcement rules (Biome) but no structural understanding of how the code connects**,
facing **the agent needing to grep and read files one-at-a-time to understand dependencies, call chains, and blast radius of changes**,
we decided for **CodeGraphContext as a persistent Docker service via composable-env, providing 19 MCP tools for graph-based code intelligence including dependency analysis, dead code detection, and impact awareness**
and against **building a custom indexer, using static analysis tools without persistence, or relying solely on grep-based exploration**,
to achieve **instant structural queries ("what depends on this?", "what would break?") in under 2 seconds, making verify smarter about affected tests and the agent smarter about change impact**,
accepting **the overhead of running Neo4j as a persistent service and the dependency on an external tool we don't control**,
because **CodeGraphContext already exists, provides exactly the MCP tools we need, and composable-env's `persistent: true` feature makes running it as a local service trivial**.

## Context

The dev system has three knowledge layers: CLAUDE.md (decision memory), Biome (enforcement), and retrospectives (learning loop). What's missing is structural memory — how files relate, what imports what, what the blast radius of a change is. The agent currently discovers this by reading files, which is slow and incomplete.

CodeGraphContext (https://github.com/CodeGraphContext/CodeGraphContext) is an MCP server + CLI that indexes code into a Neo4j graph database. It provides 19 tools covering code search, dependency analysis, complexity metrics, dead code detection, and raw Cypher queries. It watches for file changes and incrementally updates the graph.

See `planning/codegraph-context/brief.md` for the full problem statement and integration points.

## Decision

### Run as a composable-env persistent service

CodeGraphContext requires Neo4j as its graph backend. Both run as Docker containers managed by composable-env:

**Neo4j contract** — persistent, with a named volume for data:
```json
{
  "name": "neo4j",
  "persistent": true,
  "onlyProfiles": ["local"],
  "target": {
    "type": "docker-compose",
    "file": "docker-compose.yml",
    "service": "neo4j",
    "config": {
      "image": "neo4j:5-community",
      "ports": ["7474:7474", "7687:7687"],
      "volumes": ["neo4j-data:/data"],
      "restart": "unless-stopped"
    }
  },
  "vars": {
    "NEO4J_AUTH": "neo4j/${secrets.NEO4J_PASSWORD}"
  }
}
```

**CodeGraphContext contract** — persistent, mounts the project read-only, depends on Neo4j:
```json
{
  "name": "codegraph",
  "persistent": true,
  "onlyProfiles": ["local"],
  "target": {
    "type": "docker-compose",
    "file": "docker-compose.yml",
    "service": "codegraph",
    "config": {
      "image": "codegraphcontext/codegraphcontext:latest",
      "volumes": [".:/workspace:ro"],
      "depends_on": ["neo4j"],
      "restart": "unless-stopped"
    }
  },
  "vars": {
    "NEO4J_URI": "bolt://neo4j-local:7687",
    "NEO4J_USERNAME": "neo4j",
    "NEO4J_PASSWORD": "${secrets.NEO4J_PASSWORD}"
  }
}
```

Managed via `ce persistent up/down/status`. Data survives `ce build` cycles.

### Connect via MCP

Claude Code connects to CodeGraphContext via `.mcp.json` or the MCP settings. The server runs in the Docker container and exposes stdio transport.

### Available tools (19 total)

**Core Analysis** — the tools that integrate with our skill system:
- `find_code` — search by name or fuzzy text
- `analyze_code_relationships` — dependency and call graph analysis
- `calculate_cyclomatic_complexity` — function complexity metrics
- `find_most_complex_functions` — hardest-to-maintain functions
- `find_dead_code` — unused functions with filter support

**System & Management:**
- `monitor_directory` / `list_watched_paths` / `unwatch_directory` — file watching
- `list_indexed_repositories` / `get_repository_stats` / `delete_repository` — repo management
- `add_code_to_graph` / `add_package_to_graph` — manual indexing

**Job Control:**
- `list_jobs` / `check_job_status` — background task management

**Bundles & Registry:**
- `search_registry_bundles` / `load_bundle` — shared graph bundles

**Advanced:**
- `execute_cypher_query` — raw read-only graph queries
- `visualize_graph_query` — Neo4j Browser visualization links

### Integration with skill system

The brief defines four integration points. This ADR formalizes them:

1. **verify skill** — uses `analyze_code_relationships` to determine affected tests instead of guessing. "What test files transitively depend on this module?" Query before running tests.

2. **context skill** — structural context enriches retrospectives and CLAUDE.md updates. "This change touched 4 files across 2 apps and affected 12 downstream consumers."

3. **work skill** — before starting an impl item, query the graph to understand impact. "This function is called by 3 other modules" informs how carefully to approach the change.

4. **plan skill** — during research, structural queries help scope work. "How many files depend on this package?" turns a guess into a number.

These integrations are documented in the skill files as guidance, not enforced programmatically. The agent reads the guidance and decides when to query the graph.

### Per-project instances

Each project gets its own CodeGraphContext + Neo4j instance. The graph is project-scoped — no cross-project contamination. When `ce persistent up` runs, both containers start for that project only.

## Alternatives Considered

### Build a custom indexer
Rejected — CodeGraphContext already exists, is actively maintained, and provides exactly the tools we need. Building our own would be months of work for a worse result.

### Use without persistence (re-index every session)
Rejected — re-indexing takes too long for anything beyond a trivial codebase. Persistence via named volumes and `ce persistent` is the right approach.

### Run CodeGraphContext locally (no Docker)
Possible but rejected for consistency — our dev system puts everything in Docker via composable-env. Running CGC as a local process would be the exception.

## Consequences

### Positive
- Instant structural queries via 19 MCP tools
- Verify gets precise affected-test lists instead of guessing
- Agent understands blast radius before making changes
- Persistent graph survives rebuilds, incremental updates keep it current
- Composable-env manages the service lifecycle

### Negative
- Two additional containers (Neo4j + CGC) running during local dev
- Depends on external tool we don't control — API may change
- Initial indexing takes time for large codebases

### Risks
- **CGC API changes** — Mitigate by pinning the Docker image version
- **Neo4j resource usage** — Mitigate with resource limits in the compose config if needed
- **Stale graph** — Mitigate by enabling file watching for incremental updates

## References
- `planning/codegraph-context/brief.md`
- GitHub: https://github.com/CodeGraphContext/CodeGraphContext
- Docs: https://codegraphcontext.github.io/CodeGraphContext/
- composable-env persistent services: `ce persistent up/down/destroy/status`
