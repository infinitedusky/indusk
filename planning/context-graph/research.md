---
title: "Context Graph — Semantic Layer on Code Graph"
date: 2026-03-24
status: complete
---

# Context Graph — Research

## Question
Can we replace the flat CLAUDE.md context file with a graph-based context system that layers semantic meaning (concepts, decisions, gotchas, conventions) on top of CGC's structural code graph in FalkorDB?

## The Problem

CLAUDE.md is a flat file. As the project grows:
- It becomes a wall of text the agent reads entirely to find one relevant gotcha
- No relationships between concepts — "composable.env" and "OrbStack networking" are related but not linked
- Everything is at the same level of detail — a one-liner convention sits next to a complex architectural explanation
- Context updates are append-only in practice — editing the right section of a growing file is error-prone
- The agent can't query for "what do I need to know about this file" — it reads everything or nothing

## The Idea

Two layers on the same FalkorDB graph:

**Layer 1 (CGC — exists today):** Files, functions, classes, imports, calls. Structural. Automated by indexing.

**Layer 2 (Context — proposed):** Concepts, decisions, gotchas, conventions. Semantic. Curated by the agent during the work loop.

They connect via edges. The concept "hybrid settlement" links to `SettlementFacet.sol`, `FundsManager.ts`, `player_sessions` table. The gotcha "no chain client caching" links to the functions that query the DB for active deployment.

## How It Fits Into the Work Loop

The work skill already has a per-item loop. The context graph adds reads and writes at natural points:

### Before editing a file
```
1. Query graph: "what concepts, decisions, gotchas link to this file?"
2. Query graph: "what conventions apply to this area?"
3. Agent has targeted context — not 200 lines of CLAUDE.md
```

### After tests pass
```
1. Did this change introduce a new concept? → add Concept node, link to files
2. Did we learn a gotcha? → add Gotcha node, link to affected files/functions
3. Did a convention change? → update Convention node
4. Did we make a decision? → add Decision node, link to ADR and affected code
```

### During documentation
```
1. Query graph for all concepts touched in this phase
2. Document based on graph relationships, not memory
```

No extra ceremony — the reads and writes happen as part of what the agent is already doing.

## Graph Schema

### New Node Types (added to CGC's existing graph)

| Node | Properties | Purpose |
|------|-----------|---------|
| `Concept` | name, description, created_date | A named idea: "settlement", "agent API", "diamond pattern" |
| `Decision` | name, description, adr_path, date, status | Links to ADRs: "hybrid settlement — see planning/X/adr.md" |
| `Gotcha` | name, description, severity, learned_from | Things that bite: "pots() after showdown crashes" |
| `Convention` | name, rule, reason | Rules to follow: "no DB from Next.js" |
| `Lesson` | name, description, source | Broader than gotchas: "spike before integrating external systems" |

### New Edge Types

| Edge | From → To | Purpose |
|------|-----------|---------|
| `RELATES_TO` | Concept → Concept | "settlement" relates to "EIP-712 receipts" |
| `DECIDED_IN` | Decision → Concept | "hybrid settlement" decided in ADR |
| `APPLIES_TO` | Convention → File/Function/Module | "no DB from Next.js" applies to all Next.js app files |
| `AFFECTS` | Gotcha → File/Function | "pots() guard" affects game-server hand handling |
| `LEARNED_FROM` | Lesson → plan path | "spike first" learned from poker-agent-runner-0 |
| `IMPLEMENTS` | File/Function → Concept | `SettlementFacet.sol` implements "settlement" |
| `DEPENDS_ON` | Concept → Concept | "agent API" depends on "game server WebSocket" |

### Connection to CGC's Existing Schema

CGC already has: `Repository`, `File`, `Module`, `Class`, `Function` with edges `CONTAINS`, `CALLS`, `IMPORTS`, `INHERITS`.

The context graph adds edges FROM its semantic nodes TO CGC's structural nodes. CGC never needs to know about the context layer — it's additive.

## Example Queries

**"What do I need to know before editing FundsManager.ts?"**
```cypher
MATCH (f:File {name: 'FundsManager.ts'})<-[:AFFECTS|APPLIES_TO|IMPLEMENTS]-(ctx)
RETURN ctx.name, labels(ctx)[0] as type, ctx.description
```
Returns: Gotcha("DB hand_actions FK constraint"), Convention("no chain client caching"), Concept("settlement"), Decision("FundsManager replaces in-memory fields")

**"What concepts relate to the agent system?"**
```cypher
MATCH (c:Concept {name: 'agent API'})-[:RELATES_TO|DEPENDS_ON*1..2]-(related)
RETURN related.name, labels(related)[0] as type
```

**"Show all gotchas for the game-server app"**
```cypher
MATCH (g:Gotcha)-[:AFFECTS]->(f:File)
WHERE f.path CONTAINS 'game-server'
RETURN g.name, g.description, f.path
```

## What CLAUDE.md Becomes

A generated summary. The context skill reads the graph and writes a human-readable CLAUDE.md from it. The graph is the source of truth. CLAUDE.md is a snapshot for quick orientation.

Or CLAUDE.md becomes minimal — just "What This Is" and "Architecture" — and the agent queries the graph for everything else.

## Implementation Path

### Phase 1: Schema + MCP tools
- Define Cypher queries for creating context nodes and edges
- Add MCP tools: `context_add`, `context_link`, `context_query`, `context_learn`
- Use the existing FalkorDB instance (same graph, new node types)

### Phase 2: Work skill integration
- Before edit: query graph for context on target file
- After verified work: prompt agent to update context nodes
- Replace CLAUDE.md section edits with graph writes

### Phase 3: Bootstrap existing projects
- Parse existing CLAUDE.md sections into graph nodes
- Parse ADRs into Decision nodes linked to concepts
- Parse lessons into Lesson nodes
- One-time migration, then graph is the source of truth

### Phase 4: CLAUDE.md generation
- Generate CLAUDE.md from graph as a summary view
- Run on demand or as part of retrospective
- Keeps the flat file for backward compat and human reading

## Risks

- **Graph complexity** — adding semantic nodes to the code graph could create noise for CGC queries that only care about structure. Mitigation: use distinct node labels, CGC queries already filter by type.
- **Cold start** — new projects start empty. Mitigation: bootstrap from CLAUDE.md and ADRs.
- **Overhead** — every work item has graph reads/writes. Mitigation: the reads replace CLAUDE.md parsing (same or less time), writes are simple Cypher inserts.
- **Visualization noise** — context nodes mixed with code nodes in the graph viz. Mitigation: filter by label in Cypher queries, or use a separate graph name.
- **CGC updates** — CGC reindexing could disrupt context edges if it deletes and recreates File nodes. Mitigation: context edges use file paths as stable identifiers, reconnect after reindex.

## Open Questions
- Same graph or separate graph name? Same graph means single queries across both layers. Separate means no interference but cross-graph joins are impossible.
- Should concepts be auto-detected from code patterns, or always human/agent curated?
- How does this interact with the lessons system? Lessons could become Lesson nodes in the graph instead of markdown files.
- What's the migration path for existing indusk-mcp users? Opt-in feature vs default?

## Sources
- CGC graph schema: `Repository`, `File`, `Module`, `Class`, `Function` nodes
- FalkorDB Cypher documentation
- Current context skill: CLAUDE.md with 6 fixed sections
- Current lessons system: markdown files in `.claude/lessons/`
