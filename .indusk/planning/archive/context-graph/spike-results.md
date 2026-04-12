---
title: "Context Graph — Spike Results"
date: 2026-03-27
status: complete
---

# Context Graph — Spike Results

## Goal
Prove that semantic context nodes (Concept, Gotcha, Convention) can coexist with CGC's structural code graph in a single FalkorDB graph, and that a "context beam" query can traverse both structural and semantic edges from a file entry point with distance-based relevance decay.

## What We Did

### 1. Added semantic nodes to the existing CGC graph
Created 10 nodes in the `infinitedusky` graph (the same graph CGC uses):
- 4 `Concept` nodes: plan-lifecycle, extension-system, gate-enforcement, context-management
- 3 `Gotcha` nodes: impl-parser-four-gates, skills-are-package-owned, biome-2x-api-differs
- 3 `Convention` nodes: biome-not-eslint, pnpm-ce-not-npx, plan-before-code

### 2. Created bridge edges
14 edges linking semantic nodes to CGC File nodes:
- `AFFECTS` (Gotcha → File): 3 edges
- `APPLIES_TO` (Convention → File): 2 edges
- `IMPLEMENTS` (File → Concept): 7 edges
- `RELATES_TO` (Concept → Concept): 2 edges

### 3. Ran context_beam queries
Started from specific files and traversed outward through both structural (IMPORTS, CONTAINS) and semantic (AFFECTS, APPLIES_TO, IMPLEMENTS, RELATES_TO) edges.

## Results

### Schema coexistence: PASS
- CGC labels (9): Repository, File, Module, Directory, Variable, Function, Parameter, Interface, Class
- Semantic labels (3): Concept, Gotcha, Convention
- No conflicts. FalkorDB treats them as distinct label sets in the same graph.
- CGC relationship types (3): CONTAINS, IMPORTS, HAS_PARAMETER
- Semantic relationship types (4): AFFECTS, APPLIES_TO, IMPLEMENTS, RELATES_TO
- No conflicts.

### Context beam quality: PASS

**From `impl-parser.ts`:**
| Distance | Type | Name | Detail |
|----------|------|------|--------|
| 0 | Gotcha | impl-parser-four-gates | Must handle all four gate types per phase |
| 2 | Gotcha | biome-2x-api-differs | (via quality-tools.ts) |
| 2 | Convention | biome-not-eslint | (via quality-tools.ts) |
| 2 | Concept | plan-lifecycle | (via plan-parser.ts) |
| 2 | Concept | context-management | (via context-parser.ts) |

The distance-0 result is exactly the most critical thing you need to know before editing impl-parser.ts. Distance-2 results provide awareness of the broader system.

**From `extension-loader.ts`:**
| Distance | Type | Name | Detail |
|----------|------|------|--------|
| 0 | Concept | extension-system | Full description of the plugin system |
| 1 | RelatedConcept | context-management | Reached via extension-system → RELATES_TO |
| 2 | (13 items) | Various | Sibling file context via shared imports |

Distance 1 traversed from the file's concept through a concept-to-concept edge — proving the "go wide" capability. The agent would see that extensions relate to context management without loading every file.

### Latency: PASS (target < 500ms)

| Query | FalkorDB internal | Wall time (incl. redis-cli) |
|-------|-------------------|---------------------------|
| Beam from plan-tools.ts | 14.5ms | 56ms |
| Beam from impl-parser.ts | 14.5ms | 56ms |
| Beam from extension-loader.ts | 3.8ms | 45ms |
| Node creation (each) | 0.2-2.0ms | — |
| Edge creation (each) | 0.3-20ms | — |
| Full scan (count all semantic nodes) | 115ms | — |
| Full scan (count all bridge edges) | 327ms | — |

Anchored queries (from a specific file) are 3-15ms. Full scans are 100-300ms. This confirms the design: narrow traversal is fast, broad scans are expensive. The beam pattern is inherently efficient.

### CGC reindexing impact: UNTESTED
We did not test what happens when CGC re-indexes the repo. Risk: File node IDs could change, breaking edges. Mitigation: use file paths as stable identifiers in queries (which we did — all MATCH clauses used `f.path CONTAINS` or `f.name`). Edges reference node IDs internally, so a reindex that deletes and recreates File nodes would break semantic edges. This needs a reconnection step after reindex.

## Key Findings

### 1. Single graph works — no need for Graphiti as a separate system
The core thesis is validated: semantic nodes and structural nodes coexist in one FalkorDB graph. Cross-type traversal works natively in Cypher. No bridge layer needed between separate systems.

### 2. The beam pattern produces useful context
Starting from a file and expanding outward through mixed edge types gives exactly the "narrow attention, wide availability" pattern described in the research. Distance 0 is high-signal, distance 2 is awareness.

### 3. FalkorDB Cypher has limitations
- No `WITH` clause chaining with complex aggregations (got `Unable to locate value` errors)
- `UNION ALL` works well as an alternative
- `OPTIONAL MATCH` is supported but compound optional matches are fragile
- The query must be structured as distance-level UNIONs, not a single traversal with distance tracking

### 4. Graphiti's value is in temporal/contradiction features, not the graph
We don't need Graphiti for storage or traversal — FalkorDB + our own schema handles that. What Graphiti offers that we'd want to build:
- Bi-temporal tracking (valid_from, valid_until on edges)
- LLM-powered contradiction detection
- Automatic fact invalidation
These can be implemented as indusk-mcp tools without depending on Graphiti's runtime.

### 5. Reindex resilience needs solving
CGC reindexing could orphan semantic edges. Options:
- A: Hook into CGC's reindex to reconnect edges by file path
- B: Store file paths on semantic edges (not just node references) and rebuild edges after reindex
- C: Use a separate "anchor" node type that maps file paths to semantic context, surviving reindexes

## Recommendation

**Proceed to ADR.** The spike validates the core architecture. The single-graph approach is simpler, faster, and more queryable than the two-system bridge originally proposed. The implementation path shifts:

1. **Build context tools in indusk-mcp** — `context_beam`, `context_add`, `context_link` as MCP tools that read/write directly to the FalkorDB graph
2. **Add temporal properties** — `valid_from`, `valid_until`, `created_by` on semantic nodes and edges
3. **Build contradiction detection** — compare new context against existing context for the same file (can use LLM or rule-based)
4. **Integrate with work skill** — beam before edit, enrich after verified work
5. **Solve reindex resilience** — reconnect semantic edges after CGC reindexes

The Graphiti Docker image and MCP server are not needed. We build the semantic layer directly into the graph CGC already manages.
