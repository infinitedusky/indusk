---
title: "Context Graph — CGC + Graphiti"
date: 2026-03-25
status: complete
---

# Context Graph — Research

## Goal
Merge CGC (structural code intelligence) with Graphiti (temporal semantic memory) on a shared FalkorDB backend to create a unified context system for coding agents. The combined system gives agents distance-weighted, contradiction-aware context anchored to the code they're editing — something neither tool provides alone.

## Question
Can we replace or augment the flat CLAUDE.md context file with a graph-based context system that layers semantic meaning (concepts, decisions, gotchas, conventions) on top of CGC's structural code graph in FalkorDB? And critically: does the graph become the sole context for the agent, or is it a layer within a larger, more traditional context window?

## The Problem

CLAUDE.md is a flat file. As the project grows:
- It becomes a wall of text the agent reads entirely to find one relevant gotcha
- No relationships between concepts — "composable.env" and "OrbStack networking" are related but not linked
- Everything is at the same level of detail — a one-liner convention sits next to a complex architectural explanation
- The agent can't query for "what do I need to know about this file" — it reads everything or nothing
- More context in the window = less attention per piece ("lost in the middle" problem)

## The "Context Cloud" Model

Human cognition doesn't work by loading all knowledge into working memory. A developer editing a file has:

**Center (full attention)**: the file, the function, the immediate problem
**First ring**: related concepts — "this uses the settlement system, which has that EIP-712 thing"
**Second ring**: awareness — "settlement relates to on-chain, which relates to Viem, which has that caching gotcha"
**Outer edge**: available but not loaded — "there's something about Diamond patterns I could look up if needed"

This is graph traversal with relevance decay by distance. The most important context is dense and detailed at the center. As you move outward, context becomes sparser — summaries, then mentions, then just "I know this exists."

The key insight: **humans don't load all context equally**. They focus deeply on what's relevant and maintain fuzzy awareness of what's connected. Current LLM context management (dump everything into the window) is the opposite — equal weight to everything, diminishing returns as it grows.

## What the Field Says (2024-2026)

### GraphRAG (Microsoft, open source 2024)
The pioneer of graph-based retrieval for LLMs. Builds a knowledge graph from documents, creates "community summaries" at different hierarchy levels, then does:
- **Local search**: start from relevant entities, traverse outward, prioritize by node degree and relevance. Results are filtered to fit within a context window of pre-defined size.
- **Global search**: use community summaries for broad questions.
- Their local search is closest to the "context cloud" — focused beam from a starting point, expanding outward with budget constraints.

### Context Graphs (2025 emerging pattern)
Distinguished from traditional knowledge graphs by being **optimized for LLM consumption**:
- Token efficiency — don't waste context window on low-relevance info
- Relevance ranking — distance-based, recency-based, strength-based
- Provenance tracking — know where context came from
- Architecture: query entry → neighbor expansion → multi-hop pathfinding (2-4 hops) → context assembly
- "Most valuable relationships are within 2-4 hops" — beyond that, diminishing returns

### ReMindRAG (NeurIPS 2025)
LLM-guided graph traversal with memory:
- Agent decides which node to visit next based on relevance
- "Memorizes" traversal patterns in edge embeddings (train-free)
- 5-10% better results, 50% cheaper per query
- Key insight: **the traversal itself can be a learned behavior**, not fixed

### LazyGraphRAG (Microsoft, 2025)
Outperforms GraphRAG on local queries at comparable cost. 700x cheaper than global search. Key optimization: don't build the full graph upfront — build it lazily as queries demand.

### What nobody is doing yet
All GraphRAG research targets **document retrieval** — answering questions from a corpus. Nobody is applying it to **development context** — the combination of code structure, semantic concepts, and the work loop. This is our opportunity.

## The Critical Question: Sole Context or Layer?

Three architectures are possible:

### Option A: Graph replaces everything
The graph IS the context. CLAUDE.md goes away. Skills go away. Lessons go away. The agent queries the graph for everything — procedures, conventions, gotchas, orientation.

**Problem**: Skills are procedural instructions ("here's how to run /plan"). They don't have relationships to code files. Forcing them into a graph makes them harder to maintain and no easier to retrieve. You'd always load all skills anyway — they're not file-specific.

### Option B: Graph is one layer among several
The traditional context window has layers, each serving a different purpose:

| Layer | What it provides | How it's loaded | Changes how often |
|-------|-----------------|-----------------|-------------------|
| **Skills** (plan, work, verify, etc.) | Procedural knowledge — how to do things | Always loaded, every session | Rarely (package updates) |
| **Lessons** | Universal rules — don't mock DBs, no fallback values | Always loaded, every session | Occasionally (retros) |
| **CLAUDE.md** | Orientation — what is this project, architecture, conventions | Always loaded, first read | Per work session |
| **Context Graph** (new) | Relational context — what's connected to what I'm working on RIGHT NOW | Queried per-file, per-task | Continuously (every work item) |
| **Code** | The actual files | Read on demand | Continuously |

The graph doesn't replace the other layers. It replaces the part of CLAUDE.md that doesn't scale — the gotchas, the file-specific conventions, the "I need to know X before touching Y" knowledge. The stuff that's relational and grows without bound.

**This maps to human cognition:**
- Skills = habits and procedures (you don't "look up" how to write a for loop)
- Lessons = internalized rules (you don't derive "don't touch a hot stove" from first principles)
- CLAUDE.md = general project knowledge (you know "I work at a poker company" without querying anything)
- Context graph = relational awareness ("this file connects to settlement which has that FK gotcha")

### Option C: Graph generates the traditional context
The graph is the source of truth. CLAUDE.md is auto-generated from it — a snapshot. The agent reads CLAUDE.md for quick orientation, then queries the graph for depth.

**Problem**: Still loads the full CLAUDE.md into context. Doesn't solve the "lost in the middle" problem. Just changes where the flat file comes from.

### Recommendation: Option B

The graph is a **focused, queryable layer** that provides targeted context based on what the agent is currently doing. It doesn't replace skills, lessons, or project orientation. It replaces the unbounded, file-specific knowledge that currently lives in CLAUDE.md's Gotchas and Conventions sections (and grows without limit).

The key difference: skills and lessons are **always relevant** (load them every session). The context graph is **situationally relevant** (query it when you're about to touch a specific file).

## How It Works in Practice

### Before editing a file (the "context beam")
```
Agent is about to edit FundsManager.ts

Query: MATCH (f:File {name: 'FundsManager.ts'})<-[r]-(ctx)
        WHERE ctx:Concept OR ctx:Gotcha OR ctx:Convention OR ctx:Decision
        RETURN ctx, type(r),
               CASE WHEN ctx:Gotcha THEN 3
                    WHEN ctx:Convention THEN 2
                    WHEN ctx:Decision THEN 1
                    ELSE 0 END as priority
        ORDER BY priority DESC

Returns (distance 0 — full detail):
  - Gotcha: "DB hand_actions FK constraint — recordBlinds fires before hands row exists"
  - Convention: "no chain client caching — always query DB for active deployment"
  - Decision: "FundsManager replaces in-memory fields — see ADR"
  - Concept: "settlement"

Then expand (distance 1 — summaries):
  - settlement RELATES_TO "EIP-712 receipts" (one-liner)
  - settlement DEPENDS_ON "per-table balance tracking" (one-liner)

Then mention (distance 2 — just names):
  - EIP-712 relates to Viem, Diamond pattern
  - (available if agent pulls the thread)
```

### After verified work (enriching the graph)
```
Agent just added a new endpoint to game-server

Questions the work skill asks:
1. "Did this change introduce a new concept?" → add Concept node
2. "Did you discover a gotcha?" → add Gotcha node, link to file
3. "Did a convention apply that should be recorded?" → add Convention node
4. "What existing concepts does this file now implement?" → add IMPLEMENTS edges
```

### What CLAUDE.md becomes
Smaller. It keeps:
- **What This Is** — project orientation (always read)
- **Architecture** — directory structure (always read)
- **Key Decisions** — one-liner summaries with ADR links (always read)

It loses:
- **Known Gotchas** → moved to Gotcha nodes in graph
- **Conventions** → moved to Convention nodes in graph
- **Current State** → queryable from graph + plan status

## Our Unique Position

| Factor | Typical GraphRAG | Our system |
|--------|-----------------|------------|
| Graph source | Extracted from documents | CGC indexes code structure automatically |
| Context source | Extracted from text | Agent-curated during work loop |
| Entry point | Any query | Always the file being edited |
| Graph growth | One-time indexing | Continuous enrichment every session |
| Node quality | Automated extraction (noisy) | Human/agent curated (high signal) |

## Graph Schema

### New Node Types (added to CGC's existing graph)

| Node | Properties | Purpose |
|------|-----------|---------|
| `Concept` | name, description, created_date | A named idea: "settlement", "agent API", "diamond pattern" |
| `Decision` | name, description, adr_path, date, status | Links to ADRs: "hybrid settlement — see planning/X/adr.md" |
| `Gotcha` | name, description, severity, learned_from | Things that bite: "pots() after showdown crashes" |
| `Convention` | name, rule, reason | Rules to follow: "no DB from Next.js" |
| `Lesson` | name, description, source | Broader patterns: "spike before integrating external systems" |

### New Edge Types

| Edge | From → To | Purpose |
|------|-----------|---------|
| `RELATES_TO` | Concept → Concept | "settlement" relates to "EIP-712 receipts" |
| `DECIDED_IN` | Decision → Concept | "hybrid settlement" decided in ADR |
| `APPLIES_TO` | Convention → File/Function/Module | "no DB from Next.js" applies to Next.js apps |
| `AFFECTS` | Gotcha → File/Function | "pots() guard" affects game-server |
| `LEARNED_FROM` | Lesson → plan path | "spike first" learned from poker-agent-runner-0 |
| `IMPLEMENTS` | File/Function → Concept | `SettlementFacet.sol` implements "settlement" |
| `DEPENDS_ON` | Concept → Concept | "agent API" depends on "game server WebSocket" |

## Pivot: Graphiti Integration Instead of Building From Scratch

### Discovery

[Graphiti](https://github.com/getzep/graphiti) (by Zep, 14K+ GitHub stars, active development) already implements the temporal knowledge graph engine we were going to build:
- Bi-temporal tracking (valid_from, valid_until on every edge)
- Automatic contradiction detection via LLM comparison of new vs existing edges
- Fact invalidation (not deletion) preserving history
- FalkorDB support (`graphiti-core-falkordb` on PyPI)
- MCP server with tools: `add_episode`, `search_nodes`, `search_facts`, `delete_entity_edge`
- Docker image: `falkordb/graphiti-knowledge-graph-mcp`
- Supports Anthropic, OpenAI, Groq for LLM inference
- [FalkorDB Docs](https://docs.falkordb.com/agentic-memory/graphiti-mcp-server.html) | [FalkorDB Blog](https://www.falkordb.com/blog/mcp-knowledge-graph-graphiti-falkordb/) | [PyPI](https://pypi.org/project/graphiti-core-falkordb/)

### What Graphiti Doesn't Do (Our Value)

Graphiti is a general-purpose agent memory system. It doesn't know about codebases. Coding context is fundamentally different from general knowledge:

| General agent memory (Graphiti) | Coding agent memory (what we build) |
|---|---|
| Unbounded context — any topic | **Bounded** — anchored to a codebase |
| Entry point is a query | Entry point is **always a file** being edited |
| Nodes are entities from conversation | Nodes are files, functions, concepts, decisions, gotchas |
| No structural graph | **CGC provides the structural layer** — imports, calls, dependencies |
| Traversal is semantic search | Traversal is **distance from the code you're touching** |
| Memory is about what was said | Memory is about **what the code means and why it's that way** |

The thing that doesn't exist yet: a system that bridges structural code intelligence (CGC) with temporal semantic memory (Graphiti) to give a coding agent **anchored, distance-weighted, contradiction-aware context** based on what file it's currently editing.

### The Architecture

```
┌─────────────────────────────────────────────┐
│               indusk-mcp                     │
│                                              │
│  context_beam  ──→  queries both layers      │
│  context_add   ──→  writes to Graphiti       │
│  context_link  ──→  bridges Graphiti ↔ CGC   │
│                                              │
├──────────────────┬──────────────────────────┤
│   Graphiti MCP   │   CGC MCP                │
│   (semantic)     │   (structural)           │
│                  │                           │
│   Concepts       │   Files                  │
│   Decisions      │   Functions              │
│   Gotchas        │   Classes                │
│   Conventions    │   Imports/Calls          │
│   Lessons        │   Dependencies           │
│                  │                           │
│   temporal       │   auto-indexed           │
│   contradiction  │   from code              │
│   detection      │                           │
├──────────────────┴──────────────────────────┤
│              FalkorDB                        │
│         (single instance, shared)            │
└─────────────────────────────────────────────┘
```

The `context_beam` tool is the key innovation — it starts from a File node in CGC's graph, traverses outward through both structural edges (IMPORTS, CALLS) AND semantic edges (IMPLEMENTS, AFFECTS, APPLIES_TO) simultaneously, assembling context with distance-based relevance decay.

### Revised Implementation Path

### Phase 1: Graphiti integration as extension
- Add Graphiti MCP server to Docker setup (or composable.env component)
- Create `graphiti` built-in extension in indusk-mcp
- Configure Graphiti to use the existing FalkorDB instance
- Test basic operations: add_episode, search_nodes, search_facts

### Phase 2: Bridge tools (the product)
- Build `context_beam` — distance-weighted query across both graphs
- Build `context_add` — wrapper that creates Graphiti nodes AND links them to CGC file nodes
- Build `context_link` — create edges between Graphiti semantic nodes and CGC structural nodes
- These tools query both MCP servers and merge results

### Phase 3: Work skill integration
- Before edit: `context_beam` on target file → distance-weighted context loaded
- After verified work: `context_add` to enrich the graph
- Slim down CLAUDE.md — gotchas and conventions live in Graphiti

### Phase 4: Bootstrap + migration
- Parse existing CLAUDE.md into Graphiti episodes
- Parse ADRs into semantic nodes
- Parse lessons into the graph
- One-time migration, then continuous enrichment

### Phase 5: Context hygiene
- Leverage Graphiti's built-in contradiction detection
- Add code-aware contradiction queries (convention vs actual code)
- Staleness detection based on file modification dates
- Pruning based on traversal frequency

## Alignment with Anthropic's Context Engineering Guidance

Anthropic published [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) which defines their recommended patterns for managing context in agentic systems. Their core principle: "find the smallest set of high-signal tokens that maximize the likelihood of some desired outcome." They document **context rot** — as context length increases, models show reduced ability to recall information. They note LLMs have a limited "attention budget."

Anthropic doesn't mention graphs or structured knowledge representations. Their solutions operate at the prompt engineering level. But the principles they recommend are exactly what the context graph implements:

| Anthropic's principle | Their solution | Our implementation |
|---|---|---|
| **Just-in-time loading** — don't pre-load all data, maintain lightweight identifiers and load at runtime | Tools that fetch data on demand | `context_beam` queries the graph when the agent is about to edit a file — loads only what's relevant to that file, not everything |
| **Progressive disclosure** — agents incrementally discover context through exploration, guided by metadata signals | File hierarchies, naming conventions, timestamps | Graph distance as the disclosure mechanism — distance 0 is full detail, distance 1 is summary, distance 2+ is awareness. The agent pulls threads deeper only when needed |
| **Context rot** — recall degrades as context grows | Keep context minimal, high-signal | The graph replaces unbounded flat files (CLAUDE.md gotchas growing forever) with targeted queries that return only what's relevant to the current task |
| **Structured note-taking** — agents maintain external memory files they reference later | Markdown files, scratchpads | Graph enrichment after verified work — the agent writes structured nodes and edges instead of appending to a flat file. Queryable, relational, not just text |
| **Compaction** — summarize and reset context windows | Periodic summarization | The graph enables this naturally — instead of carrying 500 lines of CLAUDE.md, carry a 5-line orientation summary + the ability to query for depth. The graph IS the compressed knowledge that can be expanded on demand |
| **Sub-agent architectures** — focused agents return condensed summaries to a coordinator | Specialized sub-agents | Future: a context sub-agent could run the `context_beam` query and return a pre-formatted context block, keeping the main agent's window clean |

The key validation: Anthropic's guidance says to do exactly what we're building, but they stop at flat files and prompt structure. The context graph is the infrastructure that makes their patterns work at scale — when the project is too large for any flat file to remain "the smallest set of high-signal tokens."

## Risks

- **Graph complexity** — adding semantic nodes to the code graph could create noise. Mitigation: distinct node labels, separate queries.
- **Cold start** — new projects start empty. Mitigation: bootstrap from CLAUDE.md.
- **CGC reindexing** — could disrupt edges to File nodes. Mitigation: use file paths as stable identifiers, reconnect after reindex.
- **Over-engineering** — the flat file works for small projects. Mitigation: opt-in feature, CLAUDE.md remains the default for projects that don't need this.
- **Stale context** — graph nodes could become outdated. Mitigation: the work loop continuously enriches, and retrospectives audit.

## Context Hygiene: Contradiction Detection, Staleness, and Pruning

A graph that only grows is eventually as bad as a flat file that only grows. The hypothesis: the context graph should also **forget**, **detect contradictions**, and **self-correct**. This section explores what the field says about this.

### The Problem

Context accrues errors over time:
- A convention says "never use `any` types" but a file linked to that convention has `any` types (contradiction between context and code)
- A gotcha was written when FundsManager used in-memory fields, but FundsManager was refactored to use DB persistence (stale context)
- Two conventions conflict: "always use strict TypeScript" and "use `as any` for third-party library gaps" (internal contradiction)
- A concept node exists but nothing links to it anymore — the code it described was deleted (orphaned context)

### What the Field Says

**Graphiti / Zep (2025)** — A temporal knowledge graph engine for agent memory. The most relevant system found. Key features:
- **Bi-temporal tracking**: every edge has a validity window — when it became true and when it was superseded. Old facts are invalidated, not deleted. You can query "what's true now" or "what was true at any point."
- **Automatic contradiction detection**: when new information is ingested, an LLM compares new edges against semantically related existing edges. Temporally overlapping contradictions trigger invalidation of the old edge.
- **Incremental processing**: new data integrates immediately without batch recomputation. The graph evolves in real-time.
- Zep achieves 18.5% accuracy improvements and 90% latency reduction vs baselines.
- [Paper](https://arxiv.org/abs/2501.13956) | [GitHub](https://github.com/getzep/graphiti)

**KG Inconsistency Survey (2025)** — A survey on dealing with inconsistency in knowledge graphs identifies three approaches:
1. **Detection**: find the parts of the graph that cause inconsistency
2. **Repair**: fix inconsistent parts to render them consistent
3. **Tolerant reasoning**: reason correctly despite inconsistencies
- KGs developed through semi-automated extraction often have contradictions, especially when integrating knowledge from different sources — which is exactly what we do (agent-curated + code-indexed).
- [Paper](https://arxiv.org/html/2502.19023v1)

**Memory Decay Models** — Research on LLM agent memory uses temporal decay modulated by recall relevance and frequency, emulating psychological memory retention curves. Context that hasn't been accessed decays in priority. This maps to: "if a gotcha node was never traversed in the last 10 work sessions, maybe it's not relevant anymore."

**Lorien Memory** — A practical system where every fact has a source, every rule has a priority, contradictions are detected automatically, and knowledge evolves over time. When new data arrives, it's tested for consistency with existing axioms.

### How This Could Work for Us

**Contradiction detection (context vs code):**
```cypher
// Find conventions that are violated by actual code
MATCH (conv:Convention)-[:APPLIES_TO]->(f:File)-[:CONTAINS]->(fn:Function)
WHERE conv.rule CONTAINS 'no any' AND fn.source CONTAINS ': any'
RETURN conv.name, f.path, fn.name
```
This would surface: "Convention 'no any types' applies to `game-server/routes.ts` but `handleAction` has `any` parameters."

**Staleness detection:**
```cypher
// Find gotchas linked to files that changed since the gotcha was created
MATCH (g:Gotcha)-[:AFFECTS]->(f:File)
WHERE f.last_modified > g.created_date
RETURN g.name, g.description, f.path, f.last_modified, g.created_date
```

**Orphan detection:**
```cypher
// Find concept nodes with no edges to code
MATCH (c:Concept)
WHERE NOT (c)-[:IMPLEMENTS|RELATES_TO|DEPENDS_ON]-()
RETURN c.name, c.description
```

**Temporal validity (Graphiti-inspired):**
Instead of deleting outdated context, mark it with a `valid_until` timestamp. The context beam query filters to only return currently-valid nodes. History is preserved for retrospectives and audits.

### Open Questions on Context Hygiene
- Should contradiction detection run continuously (every work item) or periodically (weekly, per-retro)?
- Should the agent auto-fix contradictions or flag them for human review?
- What's the decay model? Time-based (old = less relevant), usage-based (untraversed = less relevant), or both?
- Should we adopt Graphiti's bi-temporal model (valid_from, valid_until on every edge) or keep it simpler?
- Is there value in keeping invalidated context for "what did we used to believe about this file?"

## Open Questions
- Same FalkorDB graph or separate graph name? Same enables cross-queries. Separate prevents interference.
- Should the `context_beam` query be a single Cypher query or multiple round-trips (one per distance level)?
- How does this interact with the lessons system? Lessons could become Lesson nodes instead of markdown files, or both.
- What's the migration path? Opt-in for now, default later?
- Should we track traversal effectiveness (did the agent use the context it retrieved)?

## Sources
- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)
- [GraphRAG Local Search](https://microsoft.github.io/graphrag/query/local_search/)
- [Context Graphs for AI Agents](https://www.cloudraft.io/blog/context-graph-for-ai-agents)
- [ReMindRAG — NeurIPS 2025](https://arxiv.org/abs/2510.13193)
- [Graph RAG Survey — ACM 2025](https://dl.acm.org/doi/10.1145/3777378)
- [LazyGraphRAG](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)
- [Context Graphs vs Knowledge Graphs](https://atlan.com/know/context-graph-vs-knowledge-graph/)
- [DRIFT Search — Microsoft](https://www.microsoft.com/en-us/research/blog/introducing-drift-search-combining-global-and-local-search-methods-to-improve-quality-and-efficiency/)
- [Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Graphiti — Temporal Knowledge Graph for Agent Memory](https://github.com/getzep/graphiti)
- [Zep: Temporal Knowledge Graph Architecture — arXiv](https://arxiv.org/abs/2501.13956)
- [Dealing with Inconsistency for Reasoning over Knowledge Graphs — Survey](https://arxiv.org/html/2502.19023v1)
- [Detecting and Fixing Inconsistency of Large Knowledge Graphs — ACM](https://dl.acm.org/doi/10.1145/3688671.3688766)
- CGC graph schema: `Repository`, `File`, `Module`, `Class`, `Function` nodes
- Current context skill: CLAUDE.md with 6 fixed sections
