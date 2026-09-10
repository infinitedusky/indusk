---
title: "Graph Knowledge Architecture"
date: 2026-04-13
status: complete
---

# Graph Knowledge Architecture — Research

## Question

How should the eval agent structure its writes to the knowledge graph so that it becomes a rich, queryable representation of project knowledge — with edge weights, concept-based file connections, and an ontology designed for software development context? And does CGC remain a permanent layer, or does the knowledge graph subsume it over time?

## Findings

### 1. The Three Approaches to GraphRAG

Three major approaches have emerged for building knowledge graphs that serve as context for LLMs:

**Neo4j GraphRAG** — dual-graph: a lexical graph (documents + chunks with embeddings) paired with an entity graph (nodes + relationships). Key insight: **define `allowed_nodes` and `allowed_relationships` upfront** to constrain LLM extraction. Property filtering retains only schema-defined attributes, reducing noise. Retrieval combines keyword search, vector embeddings, and Cypher graph traversal — hybrid beats any single method.

**Microsoft GraphRAG** — community detection via Leiden algorithm. Entities cluster into hierarchical communities with bottom-up summaries. Excels at global questions ("what are the main themes?") and connecting disconnected information. Different use case from ours — we need relational traversal (Neo4j style), not global summarization.

**Graphiti (Zep)** — three-tier architecture:
1. **Episode subgraph** — raw input data (non-lossy source of truth)
2. **Semantic entity subgraph** — extracted/deduplicated entities and relationships
3. **Community subgraph** — high-level entity clusters with summaries

Graphiti's temporal tracking is its distinguishing feature: bi-temporal (event time T + ingestion time T'), automatic contradiction detection, fact invalidation rather than deletion.

**Takeaway for us:** We're already on Graphiti. The key leverage point is guiding its extraction with a defined ontology and structured episodes, not changing the infrastructure.

### 2. Ontology Design for Software Knowledge

Research identifies entity types beyond structural code elements:

| Category | Entity Types |
|----------|-------------|
| Structural | File, Function, Class, Module |
| Semantic | Concept, Pattern, Concern, Domain |
| Decision | ADR, Constraint, Trade-off, Assumption |
| Process | Person, Requirement, Bug, Feature |
| Change | Commit, Refactoring, Deprecation |

**Relationship types that matter** (beyond imports/calls):

| Relationship | Meaning | Example |
|-------------|---------|---------|
| `shares-concept` | Files connected by domain concept | auth-middleware.ts ↔ session-store.ts via "authentication" |
| `constrained-by` | A decision or file limited by a constraint | judge-runner.ts constrained-by "prompt size limit" |
| `decided-in` | Where/when a decision was made | "use graph_capture not add_memory" decided-in session 2026-04-12 |
| `contradicts` | A fact that overrides a previous one | "write to Graphiti directly" contradicted by "use graph_capture" |
| `co-changes-with` | Files that change together (weighted by frequency) | runner.ts ↔ format.ts |
| `implements-pattern` | Code that follows a known pattern | beam queries implement "fixed pipeline" pattern |
| `violates-constraint` | Code that breaks a known rule | Eval finding: "missing error handling" violates "let errors propagate" |

**Key finding from semantic coupling research:** Files linked by shared concepts predict co-change 15-20% better than files linked by structural imports alone. This is "the most insidious coupling type" — when modules share knowledge of each other's inner workings without explicit dependencies.

### 3. Graphiti Episode Design: What Works

**Atomic > narrative for changeability.** Small episodes describing single facts or state changes produce cleaner graphs. When a fact changes, Graphiti invalidates the specific edge cleanly rather than trying to update a dense edge bundle from a large narrative.

**Structured JSON > prose for extraction quality.** JSON with clear field names guides the LLM better than free-form text. Example:

```json
{
  "type": "decision",
  "subject": "graph writes",
  "decision": "eval agent is sole writer to knowledge graph",
  "rationale": "eval agent sees full transcript, can identify all decisions/corrections/lessons",
  "supersedes": "skills write at trigger points",
  "files_affected": ["planner/SKILL.md", "work/SKILL.md", "retrospective/SKILL.md"],
  "constraint": "skills can leave instructions for eval agent in transcript"
}
```

**Naming matters for findability.** Descriptive episode names (`"eval-finding-missing-error-handling-judge-runner"`) rank higher in search than generic names (`"finding-1"`). Consistent terminology across episodes improves entity resolution.

**Custom entity types via Pydantic models.** Graphiti supports extending built-in types (Person, Organization, etc.) with custom schemas. We can define `File`, `Concept`, `Decision`, `Pattern`, `Constraint` as first-class entity types with typed attributes.

### 4. Edge Weights: What to Compute

Research identifies several weighting strategies:

**Co-change frequency** — files that change together in commits get weighted edges. Recent research on "hyper co-change graphs" shows this outperforms unweighted approaches by 15-20% for defect prediction. Weight should factor commit size — small focused commits signal stronger coupling than bulk changes.

**Fact density** — nodes with more attached facts are more important. A file with 8 decisions attached is more contextually rich than one with 0.

**Recency** — recent facts rank higher. Graphiti already tracks `created_at` and `valid_at` — the beam can use these for temporal weighting.

**Retrieval signal** — Graphiti's search uses reciprocal rank fusion (RRF) across semantic + BM25 + graph traversal, plus node distance reranking. We don't need to implement our own ranking — but we can improve it by structuring writes so the underlying signals are stronger.

**Practical approach:** Don't compute weights independently. Instead, **let weights emerge from the graph's own structure**:
- In-degree (how many things point to this node) = importance
- Edge count between two nodes = coupling strength
- Temporal density (facts per time period) = activity/hotspot signal
- Contradiction count = volatility/risk signal

### 5. The CGC Question: Permanent Layer or Bootstrap?

**What CGC provides that the knowledge graph can't (today):**
- Full codebase structural index from static analysis — day-one coverage
- Dead code detection — requires AST analysis of every file
- Complexity metrics — requires parsing, not observation
- Function-level callers/callees — fine-grained, complete

**What the knowledge graph provides that CGC can't:**
- Concept-based connections — files linked by shared concerns, not just imports
- Decision provenance — why code is shaped the way it is
- Temporal validity — facts that were true, then weren't
- Weighted relationships — which connections matter most
- Cross-session memory — what the agent learned last time

**The answer: CGC is a cold-start bootstrap, not a permanent peer.**

As the eval agent writes observations over time, the knowledge graph accumulates:
- Which files are conceptually related (richer than import edges)
- Which files change together (co-change > imports for predicting relevance)
- Which files have constraints, decisions, and gotchas attached

The import graph becomes one signal among many — and not the strongest one. CGC's unique contributions (dead code, complexity) are useful but infrequent — you don't need them on every beam query.

**Practical path:**
1. **Now:** CGC provides structural edges, knowledge graph provides semantic edges. Beam queries both.
2. **Soon:** Eval agent starts writing concept-based file connections. Knowledge graph edges start duplicating and exceeding CGC's import edges.
3. **Later:** CGC becomes an optional enrichment — run it periodically for dead code and complexity audits, but the knowledge graph is the primary source for beam queries.
4. **Eventually:** If the knowledge graph's file connections are rich enough, CGC can be dropped entirely. The beam queries only the knowledge graph.

This is not a flag day — it's a gradual transition driven by data quality.

### 6. Temporal Fact Management

Graphiti's temporal model is already strong:
- `valid_at` — when the fact was true in the real world
- `invalid_at` — when it was superseded (set automatically on contradiction)
- `created_at` — when ingested

**What we should add deliberately:**
- **Explicit `supersedes` references** in episodes — "this decision replaces X" helps Graphiti's contradiction detection find the right edge to invalidate
- **Validity windows** — some facts are time-bounded ("we're freezing merges until Thursday")
- **Confidence levels** — "the eval judge observed X" vs "Sandy explicitly stated X" carry different weight

### 7. The Eval Agent as Knowledge Architect

The eval agent shouldn't just "dump findings." It should think about the graph:

**Per-write checklist:**
1. What entities does this create or reference? (Use consistent names)
2. What relationships does this establish? (Be explicit about type)
3. Does this contradict anything already in the graph? (Include `supersedes` if so)
4. What files does this attach to? (Use `file_path` for anchor resolution)
5. Is this a permanent fact or time-bounded? (Set `valid_at` appropriately)

**Episode structure for the eval judge:**
```json
{
  "type": "decision|correction|finding|user-intent|lesson",
  "summary": "one-line description",
  "detail": "full context with reasoning",
  "entities": ["entity-name-1", "entity-name-2"],
  "relationships": [
    {"from": "entity-1", "to": "entity-2", "type": "constrained-by"}
  ],
  "files": ["path/to/file.ts"],
  "supersedes": "previous-episode-name or null",
  "confidence": "observed|stated|inferred"
}
```

This gives Graphiti maximum signal for entity extraction, deduplication, and contradiction detection.

### 8. Implementation Sequence

Based on the research, the work breaks down as:

1. **Define the ontology** — entity types, relationship types, custom Pydantic models for Graphiti
2. **Restructure eval judge writes** — atomic JSON episodes with explicit entity/relationship hints
3. **Add concept-based connections** — eval judge identifies shared concepts between files
4. **Add co-change tracking** — compute from jj log, write as weighted edges
5. **Update beam queries** — query concept edges and weighted relationships, not just import edges
6. **Gradually reduce CGC dependency** — as knowledge graph edges become richer

### 11. TypeScript Type System as a Future Edge Source

JetBrains' code understanding is 40% structure, 40% types, 20% intent. We're building structure (CGC) and intent (knowledge graph) but ignoring types entirely. TypeScript's compiler knows:
- Type relationships and flow (which types propagate where)
- Control flow narrowing (type refinements through conditionals)
- Generic instantiation chains
- Interface/implementation relationships with full type hierarchy

This is richer than CGC's import/call graph — "function A returns `Promise<BeamResult>` consumed by 3 callers who all await it" vs "function A calls function B." The TypeScript compiler API (`ts.createProgram`, `ts.TypeChecker`) is queryable programmatically.

**Plan:** After graph-knowledge-architecture lands (ontology + structured writes + eval-as-sole-writer), a follow-on plan adds TypeScript type edges to the knowledge graph. Type relationships become another edge source alongside concept connections, co-change, and structural imports. This gives the beam a fourth dimension of context.

LSP's call hierarchy and type hierarchy endpoints could also feed the graph without needing direct compiler API access — worth evaluating which approach is simpler.

### 12. Hermes Agent as Eval Deployment Target

Nous Research's Hermes Agent is an open-source persistent AI agent daemon (32K+ stars, Feb 2026). It runs 24/7, has full MCP support (stdio + HTTP), and can spawn Claude CLI as a sub-agent — meaning it uses Claude Code (existing subscription), not the API. No API costs.

**Why this matters:** The eval agent currently runs as a Claude Code PostToolUse hook — it only fires during Claude Code sessions, only on `jj describe`. If the eval agent ran as a Hermes daemon instead:
- It watches ALL commits — manual, CI, other tools — not just Claude Code sessions
- It runs between sessions, continuously building the knowledge graph
- It uses Claude Code via `claude` CLI, not the API (no additional cost)
- It connects to InDusk MCP servers (Graphiti, FalkorDB) natively via Hermes' MCP support
- It could use cheaper LLM backends for routine structural indexing, Claude for complex evaluation

**This is a deployment decision, not an architecture decision.** The ontology, structured writes, and LSP integration are the same regardless of whether the eval agent runs as a hook or a Hermes daemon. Build the knowledge architecture first (this plan), then migrate the eval agent to Hermes as a follow-on.

**Sequence:** graph-knowledge-architecture → lsp-structural-indexing → hermes-eval-migration (new plan, after the architecture proves out)

## Open Questions

- **Graphiti custom entity types in practice** — the MCP server's `add_memory` takes a string body, not structured Pydantic models. How do we pass custom entity hints through the MCP interface? May need to encode hints in the episode body for the LLM to extract.
- **Co-change computation** — should this run in the eval judge (per-commit, incremental) or as a batch job (periodic, full history)?
- **Concept taxonomy** — do we predefine concepts (authentication, caching, error-handling) or let them emerge from the eval judge's observations?
- **Graph size management** — as episodes accumulate, does search quality degrade? What's the practical ceiling?
- **Cost** — each episode triggers multiple LLM calls in Graphiti. What's the cost per commit at the write volumes we're planning?

## Sources

### Neo4j / GraphRAG
- [Neo4j GraphRAG Tutorial](https://neo4j.com/blog/developer/rag-tutorial/)
- [neo4j-graphrag-python Documentation](https://neo4j.com/docs/neo4j-graphrag-python/current/)
- [Neo4j Knowledge Graph Builder](https://neo4j.com/labs/genai-ecosystem/llm-graph-builder/)
- [Neo4j Temporal Best Practices](https://medium.com/neo4j/keeping-track-of-graph-changes-using-temporal-versioning-3b0f854536fa)

### Microsoft GraphRAG
- [Microsoft GraphRAG Research Blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)

### Graphiti / Zep
- [Graphiti Overview](https://help.getzep.com/graphiti/getting-started/overview)
- [Adding Episodes](https://help.getzep.com/graphiti/core-concepts/adding-episodes)
- [Custom Entity Types](https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types)
- [Searching the Graph](https://help.getzep.com/graphiti/working-with-data/searching)
- [Zep Temporal Knowledge Graph Paper](https://arxiv.org/html/2501.13956v1)
- [FalkorDB + Graphiti Blog](https://www.falkordb.com/blog/building-temporal-knowledge-graphs-graphiti/)

### 9. Alternatives Survey: Graphiti Is the Right Tool, Used Wrong

Surveyed: Mem0/Mem0g, Cognee, WhyHow, LlamaIndex PropertyGraphIndex, LangGraph memory, MemGraph, raw FalkorDB with custom layer.

**Finding: nothing else combines temporal tracking + custom entity types + FalkorDB backend + MCP server.** Mem0g is closest but relies on LLM extraction guidance rather than enforced schema. Cognee and WhyHow are RAG-focused, not agent memory. LlamaIndex lacks temporal tracking. Building custom on raw FalkorDB would take 6-8 weeks to replicate Graphiti's entity resolution and contradiction detection alone.

**The problem isn't Graphiti — it's how we've been using it.** We've been calling `add_memory` with unstructured text and generic names, hoping the LLM extracts useful entities. Graphiti supports:
- Custom Pydantic entity types (File, Concept, Decision, Pattern, Constraint)
- Custom relationship models with typed properties
- Structured JSON episodes that guide extraction
- Ontology-first extraction where types are defined before episodes arrive

The fix is not replacing Graphiti. It's:
1. Define custom entity types for our domain
2. Define custom relationship types (shares-concept, constrained-by, supersedes, etc.)
3. Structure eval judge writes as typed JSON episodes
4. Let Graphiti's extraction pipeline work with good input instead of guessing from prose

**Build-vs-buy verdict:** Keep Graphiti. Define our ontology. Structure our writes. If we later need deeper control, fork Graphiti (2-3 weeks) rather than build from scratch (6-8 weeks).

### 10. The CGC Question Revisited

With a properly structured knowledge graph:
- **CGC's import edges** are subsumed by concept-based connections that emerge from eval observations
- **CGC's callers/callees** are partially subsumed by co-change edges (which files actually change together matters more than which files could theoretically affect each other)
- **CGC's dead code detection** remains uniquely valuable — requires static analysis
- **CGC's complexity metrics** remain uniquely valuable — requires AST parsing

**Verdict:** CGC transitions from "always-on peer" to "periodic audit tool." The beam's primary source becomes the knowledge graph. CGC runs on demand for dead code and complexity checks.

## Conclusion

The architecture is: **Graphiti as the knowledge graph engine, with a defined ontology and structured writes from the eval agent.** Not a replacement, not a fork, not a custom build. Just using Graphiti properly.

The work ahead:
1. Define custom entity types and relationship models (Pydantic)
2. Restructure eval judge to write structured JSON episodes with entity/relationship hints
3. Remove graph write calls from planner/work/retro skills (eval agent is sole writer)
4. Allow skills to leave explicit instructions in the transcript for the eval agent
5. Update beam queries to leverage typed entities and relationships
6. Gradually reduce CGC from always-on to periodic audit

## Sources

### Software Engineering Knowledge Graphs
- [Semantic Code Graph (2023)](https://arxiv.org/html/2310.02128v2)
- [Temporal Knowledge Graph Survey (2024)](https://arxiv.org/html/2403.04782v1)
- [Semantic Coupling Research](https://link.springer.com/article/10.1007/s10664-017-9569-2)
- [Co-Change Graph Defect Prediction (SANER 2026)](https://conf.researchr.org/details/saner-2026/saner-2026-papers/44/)
- [Sourcegraph Code Graph](https://sourcegraph.com/docs/cody/core-concepts/code-graph)
- [Code Embeddings Landscape (2026)](https://dasroot.net/posts/2026/04/embedding-searching-millions-code-lines-efficiently/)
