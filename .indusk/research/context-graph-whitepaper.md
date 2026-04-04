---
title: "Graph-Backed Context for Coding Agents"
subtitle: "Two-Dimensional Agent Memory via Structural Code Graphs and Temporal Knowledge Graphs"
authors: ["Sandy (InfiniteDusky)"]
date: 2026-03-27
status: living-draft
version: 0.1
---

# Graph-Backed Context for Coding Agents

## Abstract

Current coding agents manage context through flat files — system prompts, instruction documents, and retrieval-augmented generation over text. As projects grow, these approaches degrade: context windows fill with low-relevance information, critical knowledge gets buried, and agents lose effectiveness precisely when they're needed most. We propose a two-dimensional context architecture that combines structural code intelligence (files, functions, imports, call graphs) with temporal semantic memory (concepts, decisions, gotchas, conventions) in a graph-based system. The structural dimension is a read-only snapshot of what the code IS. The semantic dimension is a living, contradiction-aware record of what developers KNOW about the code. A query interface — the "context beam" — starts from the code being edited and traverses both dimensions simultaneously, delivering narrow, high-signal context with distance-based relevance decay. Early validation shows beam queries completing in 3-15ms against a 245K-node graph, with results that match the "focus center, fuzzy periphery" pattern of human developer cognition.

---

## 1. The Problem

### 1.1 Context Degrades at Scale

Coding agents operate within a fixed context window. As projects grow, the amount of potentially relevant context exceeds this window. Current approaches to managing this are:

- **Flat instruction files** (CLAUDE.md, system prompts): every convention, gotcha, and architectural decision in a single document. The agent reads all of it regardless of what it's working on. As the file grows, attention per item decreases — the "lost in the middle" problem applied to development context.

- **Retrieval-augmented generation (RAG)**: embed documents, retrieve by text similarity to the current query. Works for "find me the docs about X" but fails for structural relationships. The fact that `extension-loader.ts` imports `plan-parser.ts` is not capturable by text similarity — it's a code relationship.

- **Always-loaded rules**: lessons, conventions, and process instructions loaded into every session. A project with 15 skill files and 13 lessons consumes significant context before any work begins. Most of it is irrelevant to the specific task.

### 1.2 Knowledge Evaporates Between Sessions

When a developer asks "why does this file do X?", debugs for 20 minutes, discovers a workaround, or evaluates and rejects a library — that knowledge exists only in the conversation. When the session ends, it's gone.

Capturing this knowledge today requires explicit rules: "if the developer corrects the agent, save a lesson." "After a retrospective, update the context file." Every rule not written is knowledge permanently lost. This creates an impossible maintenance burden — the system for capturing knowledge requires more rules than the knowledge itself.

### 1.3 No Spatial Awareness

Human developers have spatial awareness of their codebase. Editing a file, they hold dense knowledge of the immediate context (this function, this module) and fuzzy awareness of related concerns (the settlement system connects to EIP-712 receipts, which relates to Viem). The further from the immediate task, the less detail — but they can pull threads deeper when needed.

Current agents have no equivalent. They either know everything in their context window or nothing. There is no middle ground of "aware but not detailed" that enables efficient exploration.

---

## 2. Two-Dimensional Context

We propose separating agent context into two dimensions, each managed by a purpose-built system, queryable through a single interface.

### 2.1 Dimension 1: Structural (What the Code IS)

A graph of code structure: files, functions, classes, imports, call relationships, dependencies. This is automatically indexed from source code and represents the current state of the codebase.

Properties:
- **Automatically generated** — no manual curation needed
- **Complete** — every file, every function, every import relationship
- **Snapshot-based** — rebuilt on reindex, represents a point in time
- **Read-only reference** — the agent queries it but doesn't modify it

This dimension answers: "What files exist? What does this file import? What functions does it contain? What calls this function?"

### 2.2 Dimension 2: Semantic/Temporal (What Developers KNOW About the Code)

A temporal knowledge graph of concepts, decisions, gotchas, conventions, and facts — anchored to code artifacts but growing from developer activity. This is the living memory of the project.

Properties:
- **Grows organically** — developer conversation, research, debugging, plan transitions all contribute
- **Temporally tracked** — every fact has validity windows (when it became true, when it was superseded)
- **Contradiction-aware** — new facts that contradict existing facts trigger automatic invalidation
- **Entity-resolved** — duplicate references to the same concept are detected and merged
- **Community-summarized** — clusters of related concepts have automatically generated summaries

This dimension answers: "What gotchas exist for this file? What conventions apply? What decisions were made about this module? What did the last developer learn when they worked here?"

### 2.3 The Bridge: Code-Aware Entity Resolution

The structural graph knows about files. The semantic graph knows about concepts. The bridge connects them: when a file is mentioned in developer activity, the system recognizes it as a code artifact and enriches it with structural context from the code graph.

This is not a graph merge — the two graphs remain separate. The bridge is a lookup: "this entity in the semantic graph corresponds to this node in the structural graph." The lookup key is the file path, which is stable across reindexes of either system.

---

## 3. The Context Beam

The primary query interface is the "context beam" — a distance-weighted traversal that starts from the code being edited and expands outward through both dimensions.

### 3.1 Query Pattern

```
Agent is about to edit extension-loader.ts

Distance 0 (full detail):
  Semantic: "extension-system" concept, "skills-are-package-owned" gotcha
  Structural: functions contained in this file, direct imports

Distance 1 (summaries):
  Semantic: "context-management" concept (related to extension-system)
  Structural: files that import this file, files this file imports

Distance 2 (awareness):
  Semantic: gotchas and conventions on structurally adjacent files
  Structural: second-degree imports, callers of callers

Distance 3+ (available on request):
  Not loaded. Agent knows these exist and can pull threads deeper.
```

### 3.2 Properties

- **Anchored**: always starts from a specific code artifact, not a freeform query
- **Two-dimensional**: traverses structural edges (imports, calls) AND semantic edges (implements, affects, relates-to) simultaneously
- **Decay by distance**: distance 0 is full detail, distance 1 is summaries, distance 2+ is entity names only
- **Temporally filtered**: only currently-valid facts appear (expired/contradicted facts excluded)
- **Fast**: early validation shows 3-15ms for the graph portion of the query

### 3.3 Comparison to Existing Approaches

| Approach | Entry point | Relevance signal | Temporal awareness | Structural awareness |
|----------|------------|------------------|-------------------|---------------------|
| Flat file (CLAUDE.md) | None (load all) | None (equal weight) | None | None |
| RAG | Text query | Text similarity | None | None |
| Microsoft GraphRAG | Text query | Community + local search | None | None (document graph) |
| **Context beam** | **Code artifact** | **Graph distance** | **Bi-temporal validity** | **Code structure (imports, calls)** |

---

## 4. Knowledge Capture Without Rules

### 4.1 The Episode Pipeline

Rather than requiring explicit rules for knowledge capture ("if X happens, save a lesson"), developer activity flows into the semantic graph as raw episodes. A temporal knowledge graph engine (Graphiti) processes each episode through an LLM-powered pipeline:

1. **Entity extraction**: identify concepts, files, decisions mentioned in the text
2. **Entity resolution**: deduplicate against existing entities (deterministic fuzzy match + LLM fallback)
3. **Fact extraction**: identify relationships and facts, resolve temporal expressions
4. **Contradiction detection**: compare new facts against existing facts, invalidate outdated ones
5. **Summarization**: update entity and community summaries

This means a developer debugging a test failure naturally produces:
- An entity for the test file
- An entity for the root cause concept
- A fact linking the two ("this test fails when X because Y")
- A temporal marker (valid as of this session)
- Contradiction resolution if a previous session recorded a different cause

No rules. No "save a lesson" instructions. The developer just works.

### 4.2 What Moves to the Graph

| Current system | Current form | Graph form | Benefit |
|---------------|-------------|-----------|---------|
| Lessons | Flat files, always loaded | Facts with temporal validity, linked to files | Surface only when relevant |
| CLAUDE.md conventions | Section in flat file | Convention entities linked to applicable files | Don't load conventions about Next.js when editing MCP tools |
| CLAUDE.md gotchas | Section in flat file | Gotcha entities linked to affected files | Distance-0 context when editing the affected file |
| Handoff files | Session state document | Session episodes with temporal markers | Beam query surfaces relevant handoff context automatically |
| Memory files | User preferences, project context | Facts about developer and project | Surface when relevant, not loaded as index |
| Skill knowledge | Multi-page procedural documents | Concepts and conventions | Agent already knows how to code; it needs project-specific rules, not procedures |

### 4.3 What Remains Outside the Graph

- **Project identity**: 3-5 lines ("This is infinitedusky, a pnpm monorepo")
- **Slash command triggers**: one-liner mappings ("/plan starts the plan lifecycle")
- **The instruction to use the graph**: "Before any work, run context_beam on your target"
- **Active impl checklists**: these are actively edited during work and need file-based tracking

Everything else comes from the graph, on demand, weighted by relevance to the current task.

---

## 5. Early Validation

### 5.1 Single-Graph Spike (2026-03-27)

We added semantic nodes (Concept, Gotcha, Convention) directly to an existing structural code graph (245K nodes, 246K edges) in FalkorDB and ran context beam queries.

**Results:**
- Schema coexistence: 12 node labels (9 structural + 3 semantic), 7 edge types (3 structural + 4 semantic), zero conflicts
- Beam from `impl-parser.ts`: distance-0 returned the exact gotcha relevant to that file ("must handle 4 gate types, not 3")
- Beam from `extension-loader.ts`: distance-1 traversed concept-to-concept edges to surface "context-management" as related to "extension-system"
- Query latency: 3-15ms (FalkorDB internal), 45-56ms wall time
- Anchored queries (from specific file) were 10-100x faster than full scans — confirming the beam pattern is inherently efficient

### 5.2 Limitations of Single-Graph Approach

The spike used a single graph, but further investigation revealed that the two-graph approach (separate structural and semantic graphs) is architecturally better:
- Structural reindexing won't orphan semantic edges
- Each system (CGC, Graphiti) manages its own schema independently
- The bridge is a lightweight path-based lookup, not a graph merge
- Graphiti's full pipeline (entity extraction, dedup, contradiction detection, temporal tracking) requires its own schema

---

## 6. Architecture

```
Developer Activity                     Code Changes
(conversation, research,               (file saves, git commits)
 debugging, plan transitions)                 │
        │                                     ▼
        ▼                            Structural Indexer (CGC)
Temporal Knowledge Graph             (full reindex, read-only)
Engine (Graphiti)                            │
  - Entity extraction                       │
  - Entity resolution                       │
  - Contradiction detection                 │
  - Temporal tracking                       │
        │                                     │
        ▼                                     ▼
Semantic Graph                       Structural Graph
(FalkorDB)                           (FalkorDB)
  - Entity nodes                       - File nodes
  - Episodic nodes                     - Function nodes
  - Community nodes                    - Class nodes
  - RELATES_TO edges                   - CONTAINS edges
  - MENTIONS edges                     - IMPORTS edges
  - Temporal validity                  - CALLS edges
        │                                     │
        └──────────────┬──────────────────────┘
                       │
                CGC Adapter
          (file path → structural context)
                       │
                       ▼
                 context_beam
          (two-phase, distance-weighted)
                       │
                       ▼
                 Agent Context
          (narrow, relevant, temporal)
```

---

## 7. Implications

### 7.1 For Agent Frameworks

Current agent frameworks (Claude Code, Cursor, Windsurf, Aider, open-source alternatives) manage context through flat files and system prompts. The context graph represents a different paradigm:

- **Agents get smarter as projects grow** — more developer activity means more semantic context in the graph. Today, agents get dumber as projects grow because flat files become walls of text.
- **Context compression becomes irrelevant** — knowledge lives in the graph, not the context window. Window compression doesn't lose knowledge; the agent just re-queries.
- **Cross-session continuity is automatic** — no handoff files, no catchup procedures. The graph IS the continuity.
- **Multi-agent coordination improves** — agents working on different parts of the codebase contribute to the same graph. Agent A's discovery about a gotcha in file X is immediately available to Agent B when it touches a related file.

### 7.2 For Developer Experience

- **No more "remember to save a lesson"** — knowledge capture is automatic
- **No more stale documentation** — contradictions are detected and resolved
- **No more context loading ceremonies** — the agent knows what it needs for the specific task
- **Progressive disclosure** — the agent starts with what's directly relevant and goes deeper only when needed

### 7.3 Open Questions

- What is the right LLM cost budget for episode processing? Each episode triggers 3-6 LLM calls for extraction and resolution.
- How does the graph perform at scale (10K+ semantic nodes, 100K+ episodes across many sessions)?
- Can the context beam replace ALL traditional context, or is there an irreducible minimum of always-loaded instructions?
- How do we handle multi-project graphs where concepts span repositories?
- Can traversal patterns be learned (which paths through the graph are most useful for which tasks)?

---

## 8. Related Work

- **Microsoft GraphRAG (2024)**: Knowledge graph from documents with community summaries. Local search is closest to context beam but lacks code structure awareness and temporal tracking.
- **Graphiti / Zep (2025)**: Temporal knowledge graph engine for agent memory. Provides the semantic dimension of our architecture. Novel contribution: bi-temporal tracking and automatic contradiction detection.
- **CodeGraphContext (CGC)**: Structural code intelligence via graph database. Provides the structural dimension. Novel contribution: automatic code structure indexing with function-level granularity.
- **ReMindRAG (NeurIPS 2025)**: LLM-guided graph traversal with learned edge weights. Future direction for optimizing beam traversal patterns.
- **LazyGraphRAG (Microsoft 2025)**: Lazy graph construction (build as queries demand). Relevant for bootstrapping — don't build the full semantic graph upfront, build it as the developer works.
- **Anthropic Context Engineering (2025)**: "Find the smallest set of high-signal tokens." The context beam is infrastructure for this principle — it returns only what's relevant to the current task, not everything.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-03-27 | Initial draft. Problem statement, two-dimensional architecture, context beam, single-graph spike results, knowledge capture model. |
