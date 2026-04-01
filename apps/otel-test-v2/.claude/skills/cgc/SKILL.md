# CodeGraphContext

CodeGraphContext (CGC) provides structural code intelligence — dependency analysis, dead code detection, complexity metrics — via a FalkorDB graph database.

## How to Use the Graph

**All graph operations go through indusk-mcp tools.** Do not call CGC's MCP tools directly — use the `graph_*` tools from indusk-mcp instead. They handle configuration, error recovery, and provide a consistent interface whether calling the MCP server or CLI under the hood.

## When to Query the Graph

- **Before modifying any file**: call `query_dependencies` to understand blast radius
- **During planning research**: call `graph_find` and `query_dependencies` to scope work with real data
- **During verification**: call `graph_callers` to find affected consumers, then test them
- **During retrospective**: call `graph_find_dead_code` and `graph_complexity` for cleanup opportunities
- **When debugging structure**: call `graph_visualize` to see the graph in the browser

## Available Tools (all from indusk-mcp)

### Core
| Tool | When |
|------|------|
| `index_project` | After init or when codebase changed significantly |
| `query_dependencies` | Before modifying any file — understand blast radius |
| `query_graph` | Custom Cypher queries for advanced structural analysis |
| `graph_stats` | Codebase size and structure overview |

### Analysis
| Tool | When |
|------|------|
| `graph_callers` | Find all functions that call a given function |
| `graph_callees` | Find all functions a given function calls |
| `graph_find` | Search for functions, classes, modules by name or content |
| `graph_find_dead_code` | Find unused functions for cleanup |
| `graph_complexity` | Find most complex functions for refactoring targets |

### Operations
| Tool | When |
|------|------|
| `graph_visualize` | Launch interactive graph UI in the browser |
| `graph_watch` | Auto-update graph on file changes (stays current) |
| `graph_doctor` | Diagnose graph issues (connection, config, health) |

## Visualizing

When asked to "show the graph", "display dependencies", or "visualize":
1. Call `graph_visualize` — launches the interactive playground UI at http://localhost:8111
2. For text output, use `query_graph` with a Cypher query and format as a table
3. FalkorDB's own browser UI is also available at `falkordb.orb.local:3000`

## Troubleshooting

**If any graph tool fails, call `graph_doctor` first.** It checks:
- CGC installation
- FalkorDB connection
- Configuration validity
- Parser availability

**Common issues:**
- FalkorDB not running → `docker start falkordb` (or start OrbStack)
- Repo not indexed → call `index_project`
- Data lost after container recreation → volume was on wrong path, reindex
- OrbStack not running → DNS resolution fails, start OrbStack app

## Setup

- FalkorDB runs as a global Docker container at `falkordb.orb.local`
- CGC installed via pipx: `pipx install codegraphcontext`
- Per-project isolation via `FALKORDB_GRAPH_NAME` in `.mcp.json`
- Auto-watch enabled: graph updates automatically on file changes
- SCIP indexer enabled: higher accuracy call resolution for TypeScript
- Volume mount: `/var/lib/falkordb/data` (not `/data` — see community lesson)

## Known Limitations

- **Import resolution noise**: CGC creates Module nodes for every import, including npm packages (React, Next, etc.). These are orphan nodes. Filter in Cypher with `WHERE EXISTS((m)-[:CONTAINS]->())` to see only project modules.
- **No dependency resolution control**: Can't disable Module node creation for external imports. This is a CGC limitation.
