---
title: "Graph Knowledge Architecture"
date: 2026-04-13
status: accepted
blocked_by: [agent-roles]
---

# Graph Knowledge Architecture — Brief

## Problem

The knowledge graph is underperforming because we're using Graphiti wrong. We dump unstructured text episodes with generic names and hope the LLM extracts useful entities. The eval agent writes findings but doesn't think about entity types, relationship semantics, or graph structure. Meanwhile, graph writes are scattered across four skills (planner, work, retrospective, eval judge) with no consistency.

The result: a graph full of loosely-connected text blobs instead of a typed, navigable knowledge network. The beam queries it and gets sparse, noisy results. Files are connected only by import edges from CGC, missing the concept-based connections that research shows predict co-change 15-20% better than structural coupling.

## Proposed Direction

Three changes, in order:

### 1. Eval agent becomes the sole graph writer

Remove `graph_capture`/`add_memory` calls from planner, work, and retrospective skills. The eval agent — which already fires on every `jj describe` and reads the full transcript — is the single writer. Skills that need something captured leave explicit instructions in the conversation (e.g., "Graph note: brief accepted for X, key decision was Y"). The eval agent sees these in the transcript and writes them with proper structure.

**Why:** One writer means one consistent ontology, one place to improve write quality, and no redundant captures. The eval agent has the best vantage point — it sees the complete transcript after the fact and can identify what matters.

### 2. Define a domain ontology with custom Graphiti types

Define custom Pydantic entity types and relationship models that Graphiti uses during extraction:

**Entity types:**
- `File` — source file with path, kind (module/component/config/test), and importance score
- `Concept` — a domain concern that connects files (e.g., "authentication", "prompt size", "graph writes")
- `Decision` — an architectural or design choice with rationale and status (active/superseded)
- `Pattern` — a recurring approach (e.g., "fixed pipeline", "graceful degradation", "distance decay")
- `Constraint` — a limitation or rule that shapes code (e.g., "Graphiti search is slow", "Node 22 required")

**Relationship types:**
- `shares-concept` — two files connected by a shared concern (weighted by strength)
- `constrained-by` — a file or decision limited by a constraint
- `decided-in` — links a decision to the session/context where it was made
- `supersedes` — a fact that replaces a previous one (triggers Graphiti's contradiction detection)
- `co-changes-with` — files that change together (weighted by frequency)
- `implements-pattern` — code that follows a known pattern
- `violates-constraint` — code that breaks a known rule (eval findings)

**Why:** Research shows defining `allowed_nodes` and `allowed_relationships` upfront produces dramatically better graphs than freestyle LLM extraction. Graphiti supports this via Pydantic models — we just haven't used it.

### 3. Structured JSON episodes from the eval judge

Replace the eval judge's current prose-style writes with typed JSON episodes:

```json
{
  "type": "decision",
  "summary": "eval agent is sole graph writer",
  "detail": "removed graph writes from planner/work/retro skills, eval agent captures everything from transcript",
  "entities": ["eval-agent", "knowledge-graph", "planner-skill"],
  "relationships": [
    {"from": "eval-agent", "to": "knowledge-graph", "type": "writes-to"},
    {"from": "planner-skill", "to": "knowledge-graph", "type": "no-longer-writes-to"}
  ],
  "files": ["apps/indusk-mcp/src/lib/eval/prompt-builder.ts"],
  "supersedes": null,
  "confidence": "stated"
}
```

This gives Graphiti maximum signal for entity extraction, deduplication, and contradiction detection. The eval judge's rubric is updated to think in terms of entities and relationships, not just findings.

**Why:** Atomic structured episodes produce cleaner graphs than narrative text. Entity hints guide extraction. Explicit `supersedes` references help contradiction detection. Confidence levels distinguish "Sandy said X" from "the eval judge inferred X."

### CGC transition

CGC moves from always-on beam data source to periodic audit tool. The knowledge graph's concept-based connections and co-change edges replace import edges as the primary file-to-file relationships. CGC is still valuable for dead code detection and complexity metrics — things that require static analysis of the full codebase — but it's no longer on the critical path for context delivery.

This is gradual, not a flag day. The beam queries both sources during the transition. As the knowledge graph's file connections become richer (through eval agent observations over many commits), CGC edges become less important.

## Context

- Graphiti supports custom entity types (Pydantic models) and custom relationship models — we haven't been using either
- The eval judge already fires on every `jj describe` and reads the full session transcript
- Research shows semantic coupling (concept-based connections) predicts co-change 15-20% better than structural coupling (import edges)
- Neo4j's GraphRAG guidance: "define allowed_nodes and allowed_relationships upfront to constrain LLM extraction"
- Graphiti's own docs recommend structured JSON episodes over prose for extraction quality
- The handoff from last session already stated "working agent is read-only for graph, eval judge is write-only" — this formalizes that direction

## Scope

### In Scope
- Remove graph write calls from planner, work, and retrospective skills
- Add "graph note" convention for skills to leave instructions in the transcript
- Define custom Pydantic entity types and relationship models for Graphiti
- Register custom types with the Graphiti instance (requires changes to indusk-infra or Graphiti config)
- Update eval judge rubric and prompt to write structured JSON episodes
- Update eval judge to recognize explicit "graph note" instructions from the working agent
- Update beam queries to leverage typed entities and relationships
- Begin CGC transition (beam queries knowledge graph first, CGC second)

### Out of Scope
- Forking Graphiti (use as-is with custom types)
- Co-change weight computation (future — needs jj log analysis)
- Edge weight computation beyond Graphiti's built-in scoring (future)
- Removing CGC entirely (gradual transition, not this plan)
- Replacing the semantic graph event log (it stays as the append-only canonical store)
- Context migration / replacing CLAUDE.md (separate plan, depends on this one)

## Success Criteria
- Eval agent is the only writer to Graphiti — no graph writes in planner/work/retro skills
- Custom entity types (File, Concept, Decision, Pattern, Constraint) registered and used in extraction
- Eval judge writes structured JSON episodes with entity/relationship hints
- Beam returns concept-based connections between files (not just import edges)
- Graph quality improves measurably — beam results rated as more useful by Sandy on 5 real files
- No regression in capture completeness — decisions, corrections, and lessons still appear in the graph

## Depends On
- Nothing blocking — Graphiti, eval system, and beam are all live
- Soft: `hermes-inspired-improvements` — transcript search gives the eval agent access to past session history, enabling richer knowledge writes (e.g., recognizing patterns discussed sessions ago)

## Blocks
- lsp-structural-indexing — replace CGC with eval-driven organic code intelligence via LSP document symbols
- type-edges — TypeScript type relationships as graph edges
- context-migration — can't slim CLAUDE.md until the graph is carrying rich, queryable knowledge
