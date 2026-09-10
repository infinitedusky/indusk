---
title: "Graph Knowledge Architecture"
date: 2026-04-14
status: accepted
---

# Graph Knowledge Architecture

## Y-Statement

In the context of **an AI agent system that needs rich, queryable project knowledge — not just flat file dumps — to make better decisions when editing code**,
facing **a knowledge graph (Graphiti) that's underperforming because we dump unstructured text episodes with generic names, scatter writes across four skills with no consistency, and connect files only by static import edges from CGC**,
we decided for **making the eval agent the sole graph writer with a defined domain ontology (custom Graphiti entity types and relationship models) and structured JSON episodes that guide extraction — with skills leaving explicit "graph note" instructions in the transcript instead of writing directly**
and against **replacing Graphiti with a custom knowledge graph on raw FalkorDB, switching to Mem0 or Cognee, keeping the current multi-writer model with unstructured episodes, and building a CGC-style upfront full-codebase index**,
to achieve **a typed, navigable knowledge network where files are connected by shared concepts (not just imports), decisions have provenance, facts have temporal validity, and the graph grows organically from real work rather than bulk indexing**,
accepting **that graph quality depends on the eval agent's write quality, that the graph starts sparse and grows over time, that Graphiti's LLM extraction still runs (we guide it, not bypass it), and that CGC transitions gradually rather than being removed immediately**,
because **research shows semantic coupling (concept-based connections) predicts co-change 15-20% better than structural coupling (imports), Graphiti already supports custom entity types and relationship models via Pydantic that we haven't been using, a single writer ensures consistent ontology application, and structured JSON episodes produce dramatically better extraction than prose**.

## Context

The InDusk dev system has invested heavily in context infrastructure — CLAUDE.md, Graphiti, semantic graph, CGC, eval system, context beam. But the knowledge graph layer is underperforming:

- **Unstructured writes** — episodes are prose dumps. Graphiti's LLM guesses at entities.
- **Scattered writers** — planner, work, retro, and eval judge all write independently with no shared ontology.
- **Import-only connections** — files are linked by CGC's static import graph. No concept-based connections, no co-change edges, no decision provenance.
- **No custom types** — Graphiti supports Pydantic entity types and relationship models. We use none of them.

Meanwhile, research shows:
- Neo4j recommends defining `allowed_nodes` and `allowed_relationships` upfront
- Semantic coupling predicts co-change 15-20% better than structural imports
- Atomic JSON episodes produce cleaner graphs than narrative text
- Graphiti's built-in contradiction detection and temporal tracking work best with structured input

## Decision

### 1. Eval agent as sole graph writer

Remove `graph_capture` / `add_memory` calls from planner, work, and retrospective skills. The eval agent — which already fires on every `jj describe` and reads the full session transcript — is the single writer.

Skills that need specific knowledge captured leave explicit instructions in the conversation:

> **Graph note:** Brief accepted for context-beam. Key decision: fixed 6-query pipeline over recursive traversal.

The eval agent sees these in the transcript, recognizes them as explicit capture instructions, and writes them with proper structure.

**Why single writer:** One writer means one consistent ontology, one place to improve write quality, and no redundant captures. The eval agent has the best vantage point — it sees the complete transcript after the fact and can identify what matters.

### 2. Domain ontology with custom Graphiti types

Define Pydantic entity types:

| Entity Type | Purpose | Key Properties |
|------------|---------|----------------|
| `File` | Source file | path, kind (module/component/config/test), importance |
| `Concept` | Domain concern that connects files | name, description |
| `Decision` | Architectural/design choice | summary, rationale, status (active/superseded) |
| `Pattern` | Recurring approach | name, description, examples |
| `Constraint` | Limitation or rule | description, source (stated/observed/inferred) |

Define relationship types:

| Relationship | Connects | Meaning |
|-------------|----------|---------|
| `shares-concept` | File ↔ Concept | File implements/relates to this concept |
| `constrained-by` | File/Decision ↔ Constraint | Limited by this constraint |
| `decided-in` | Decision ↔ Session context | When/where the decision was made |
| `supersedes` | Decision ↔ Decision | Replaces a previous decision |
| `co-changes-with` | File ↔ File | Files that change together (future: weighted) |
| `implements-pattern` | File ↔ Pattern | Code follows this pattern |
| `violates-constraint` | File ↔ Constraint | Eval finding: code breaks a rule |

### 3. Structured JSON episodes

The eval agent writes episodes as typed JSON:

```json
{
  "type": "decision",
  "summary": "eval agent is sole graph writer",
  "detail": "removed graph writes from planner/work/retro skills...",
  "entities": ["eval-agent", "knowledge-graph"],
  "relationships": [
    {"from": "eval-agent", "to": "knowledge-graph", "type": "writes-to"}
  ],
  "files": ["apps/indusk-mcp/src/lib/eval/prompt-builder.ts"],
  "supersedes": null,
  "confidence": "stated"
}
```

Fields:
- `type` — decision, correction, finding, user-intent, lesson
- `entities` — explicit entity names for Graphiti to extract/resolve
- `relationships` — explicit relationship hints
- `files` — file paths for anchor resolution via `graph_capture`
- `supersedes` — previous episode name if this contradicts one (triggers Graphiti's invalidation)
- `confidence` — stated (user said it), observed (eval saw it), inferred (eval deduced it)

### 4. CGC gradual transition

CGC moves from always-on beam data source to periodic audit tool:
- **Now:** Beam queries both CGC and knowledge graph
- **Soon (lsp-structural-indexing plan):** Eval agent writes structural data from LSP document symbols. Knowledge graph edges start exceeding CGC's import edges.
- **Later:** CGC becomes optional — run on demand for dead code and complexity audits
- **Eventually (type-edges plan):** TypeScript type relationships added as graph edges

## Alternatives Considered

### Replace Graphiti with custom KG on raw FalkorDB
Build our own entity resolution, contradiction detection, hybrid search, and temporal tracking. Rejected: 6-8 weeks of work to replicate what Graphiti already does. Graphiti's extraction pipeline is ~2K lines of battle-tested Python. The problem is how we use it, not the tool itself.

### Switch to Mem0 or Cognee
Mem0g has graph memory with schema guidance. Cognee has ECL pipeline with custom models. Both lack Graphiti's combination of temporal tracking + custom entity types + FalkorDB backend + MCP server. No tool combines all four as well as Graphiti.

### Keep multi-writer model, improve episode quality
Each skill writes its own episodes but with better structure. Rejected: multiple writers means multiple ontologies to keep in sync, redundant captures, and inconsistent entity naming. One writer is simpler and more reliable.

### Build CGC-style upfront full-codebase index
Index everything at setup time. Rejected: most of a codebase is noise for the current task. 19,821 functions indexed when the agent touches 5 files. Organic growth from real work covers what matters and stays current.

## Consequences

### Positive
- Typed, navigable knowledge graph with explicit entity and relationship types
- Files connected by concepts, not just imports — richer context for the beam
- Single writer ensures consistent ontology and no redundant captures
- Structured JSON episodes produce better Graphiti extraction
- Graph grows organically from real work — dense where it matters, sparse where it doesn't
- Foundation for LSP structural indexing, type edges, and Hermes migration

### Negative
- Graph starts sparse — needs commits to accumulate knowledge
- Eval agent becomes more complex (knowledge architect, not just scorer)
- Graphiti's LLM extraction still runs — we guide it, not control it completely
- Custom Pydantic types need to be registered with the Graphiti instance (deployment change)

### Risks
- Graphiti custom types via MCP: the `add_memory` MCP tool takes string bodies, not Pydantic models. Entity hints must be encoded in the episode body for extraction. May need to test whether Graphiti's LLM reliably extracts typed entities from structured JSON.
- Eval agent write quality determines graph quality. If the rubric is wrong, the graph is wrong. Mitigated by trace mode in beam — we can see what the graph contains and tune.
- Removing skill writes means decisions only hit the graph after the next `jj describe`. Acceptable given the commit-driven workflow.

## Documentation Plan

### Pages
- Update: `reference/tools/context-beam.md` — beam now queries typed entities
- New: `reference/semantic-graph/ontology.md` — entity types, relationship types, episode structure

### Diagrams
- Mermaid: eval agent write flow (transcript → structured JSON → Graphiti → knowledge graph → beam)

### Changelog
- Eval agent as sole graph writer, custom ontology, structured episodes

### ADR in Docs
- `decisions/graph-knowledge-architecture.md`

## References
- [Research](research.md) — full findings from 5 research agents
- [Neo4j GraphRAG patterns](https://neo4j.com/blog/developer/rag-tutorial/)
- [Graphiti custom entity types](https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types)
- [Semantic coupling research](https://link.springer.com/article/10.1007/s10664-017-9569-2)
- [Zep temporal knowledge graph paper](https://arxiv.org/html/2501.13956v1)
