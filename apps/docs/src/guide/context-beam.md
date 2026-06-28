# Getting Started with Context Beam

Context beam gives you file-specific context before editing code. Instead of remembering everything about the project, the agent can ask "what do I need to know about this file?"

## Quick Start

```bash
# See what the system knows about a file
indusk beam src/lib/eval/judge-runner.ts

# See the raw query results
indusk beam src/lib/eval/judge-runner.ts --trace
```

Or use the MCP tool in a Claude Code session:

```
context_beam({ path: "src/lib/eval/judge-runner.ts" })
```

## What You Get

Beam returns context organized by distance from the file:

**Distance 0 (this file):**
- Graphiti facts — decisions, corrections, lessons attached to this file
- Eval findings — unresolved issues the eval judge found
- Semantic graph anchor — the file's node in the graph

**Distance 1 (neighbors):**
- Structural neighbors — files that import or are imported by this one
- Neighbor facts — Graphiti facts about those neighbors
- CGC relationships — module imports, function callers/callees

## Making Beam Results Better

Beam is only as useful as the data in the graph. Three things improve results:

1. **Let the eval agent run.** Every `git commit` triggers an evaluation that writes findings to the graph — with file paths attached. More commits = richer context.

2. **Keep the graph synced.** Run `indusk graph sync` periodically (it runs automatically at plan phase boundaries). This keeps the semantic graph anchors current.

3. **Re-index after big changes.** If you've added many files, `indusk index_project` updates the CGC structural graph.

## Reading Trace Output

Use `--trace` to understand what the beam is doing:

```
[anchor-lookup] semantic-graph (55ms)
  → 1 results
```

This tells you: the anchor-lookup query ran against the semantic graph, took 55ms, and found 1 result. If a query shows 0 results, either:
- The data source doesn't have info about this file (need sync/index)
- The file is new and hasn't been captured yet
- The query path doesn't match the stored path (check absolute vs relative)

## When to Use Beam

- **Before editing a complex file** — "what gotchas should I know?"
- **Before modifying shared code** — "what depends on this?"
- **After the eval judge flags missing context** — "what does the graph have about this area?"
- **When you're new to an area of the codebase** — "what history does this file have?"
