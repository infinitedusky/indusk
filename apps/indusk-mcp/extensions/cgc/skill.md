# CodeGraphContext

CodeGraphContext (CGC) provides structural code intelligence — dependency analysis, dead code detection, complexity metrics — via a FalkorDB graph database.

## When to Query the Graph

- **Before modifying any file**: call `query_dependencies` to understand blast radius
- **During planning research**: call `analyze_code_relationships` to scope work with real numbers
- **During verification**: call `query_dependencies` with direction "dependents" to find affected tests
- **During retrospective**: call `find_most_complex_functions` and `find_dead_code` for cleanup opportunities

## Available Tools (from codegraphcontext MCP server)

| Tool | When |
|------|------|
| `find_code` | Search by name |
| `analyze_code_relationships` | Understand dependencies |
| `find_most_complex_functions` | Find refactoring targets |
| `find_dead_code` | Find unused code |
| `execute_cypher_query` | Custom graph queries |
| `visualize_graph_query` | Browser visualization link |
| `get_repository_stats` | Codebase size and structure |

## Visualizing

When asked to "show the graph" or "display dependencies":
1. Call `visualize_graph_query` with a Cypher query — returns a browser URL
2. For text output, use `execute_cypher_query` and format as a table

## Setup

- FalkorDB runs as a global Docker container: `falkordb.orb.local`
- CGC installed via pipx: `pipx install codegraphcontext`
- Per-project isolation via `FALKORDB_GRAPH_NAME` in `.mcp.json`
- Index with `add_code_to_graph` or `monitor_directory`
