---
title: "Context Graph — Two-Dimensional Agent Context"
date: 2026-03-27
status: accepted
role: umbrella
---

# Context Graph — Brief

## Problem
Coding agents lose effectiveness as project context grows. CLAUDE.md becomes a wall of text where critical gotchas get buried. The agent reads everything equally — a one-liner convention gets the same attention weight as a complex architectural decision. This is the "lost in the middle" problem applied to development context: more context in the window means less attention per piece.

Worse: most developer knowledge is never captured at all. When a developer asks "why does this file do X?", debugs for 20 minutes, discovers a workaround, or decides against a library — that's all knowledge that evaporates when the session ends. Today, capturing any of it requires explicit rules ("if the developer corrects you, save a lesson"). Every rule we don't write is knowledge lost.

## Proposed Direction
Two separate graphs, two dimensions, one query interface.

**Dimension 1 — Structural (CGC, read-only reference)**
CGC indexes code structure: files, functions, imports, call graphs. It does full reindexes. It's a snapshot of what the code IS at any point in time. We don't modify CGC — it stays exactly as it is.

**Dimension 2 — Temporal/semantic (Graphiti, living context)**
Graphiti captures what the developer KNOWS about the code: gotchas, conventions, decisions, concepts, research findings, debugging discoveries. It grows organically from developer activity — conversation, plan transitions, test results, research. It has built-in contradiction detection, entity deduplication, temporal validity, and community summarization.

**The bridge — CGC adapter in indusk-mcp**
A thin layer that makes Graphiti code-aware. When a file entity enters the Graphiti graph, the adapter enriches it with structural context from CGC: what does this file import? What functions does it contain? What calls it? This backfill connects the two dimensions — semantic context gains structural awareness without modifying either system.

**The product — `context_beam`**
A two-phase query that starts from a file being edited:
1. Query Graphiti: what semantic context (gotchas, concepts, conventions, decisions) exists for this file? (distance 0, full detail)
2. Query CGC: what are the structural neighbors? (imports, callers, callees)
3. Expand: for each structural neighbor, query Graphiti again (distance 1, summaries)
4. Deliver: narrow, relevant, two-dimensional context with distance-based decay

See `research.md` for the full analysis, `spike-results.md` for the single-graph proof-of-concept (validated the beam query pattern), `research-testing.md` for testing strategy, `research-hygiene.md` for contradiction/staleness detection, and `research-anthropic-alignment.md` for Anthropic alignment.

## How It Works

### Unstructured input (the big win)
Developer activity flows into Graphiti as episodes automatically:
- Conversation: questions asked, explanations given, corrections made
- Research: library evaluations, design discussions, trade-off analysis
- Debugging: error messages, workarounds discovered, root causes identified
- Plan transitions: "started Phase 2", "discovered blocker", "completed retro"

Graphiti's LLM pipeline extracts entities, facts, and relationships from this raw stream. No rules needed — the developer just works and the graph grows.

### Structured input
Plans, impl items, ADRs, and lessons can be written as episodes or directly as entities with explicit types. These get the same temporal tracking and contradiction detection.

### Code awareness (CGC adapter)
When Graphiti creates or encounters a file entity:
1. Look up the file path in CGC's structural graph
2. Fetch structural context: imports, functions, callers, dependencies
3. Attach as enrichment (properties or just-in-time for beam queries)
4. Use structural relationships to expand semantic queries

CGC reindexing is harmless — the Graphiti graph is untouched. The `cgc_path` on file entities is the bridge, a string lookup key, not a graph edge.

### Two dimensions in the beam
```
                    Graphiti (semantic)
                    │
         concepts ──┤── gotchas
         decisions ─┤── conventions
         lessons ───┤── research findings
                    │
    ────────────────┼──────────────── context_beam
                    │
         imports ───┤── callers
         functions ─┤── callees
         classes ───┤── dependencies
                    │
                    CGC (structural)
```

## Context
- CGC is already integrated (FalkorDB + MCP server, used across projects)
- Graphiti supports FalkorDB natively (`graphiti-core-falkordb` on PyPI), has an MCP server, and a Docker image
- Spike validated: semantic + structural nodes coexist in FalkorDB, beam queries return useful results in 3-15ms
- Spike finding: Graphiti can't link to pre-existing CGC nodes (it only resolves against its own Entity nodes) — confirms the two-graph approach
- Graphiti requires an LLM for entity extraction, dedup, and contradiction detection (supports Anthropic, OpenAI, Groq)
- Nobody has applied temporal knowledge graphs to development context specifically — this is novel

## Scope

### In Scope
- Graphiti MCP server running alongside CGC on shared FalkorDB instance (separate graphs)
- CGC adapter: file entity enrichment from CGC structural data
- `context_beam` tool: two-phase query across both graphs with distance-based decay
- Episode capture: hook developer activity (conversation, plan transitions, tool calls) into Graphiti's `add_episode`
- Work skill integration: beam before edit, episodes flow naturally during work
- Bootstrap: parse existing CLAUDE.md, ADRs, and lessons into Graphiti as initial episodes
- Graphiti as a built-in extension in indusk-mcp
- CLAUDE.md slimmed to orientation only — gotchas, conventions, and evolving knowledge move to graph

### Out of Scope
- Modifying CGC (it stays as-is, read-only reference)
- Forking Graphiti (use as-is, adapter layer handles code-awareness)
- Replacing skills, lessons, or the process layer (these remain traditional always-loaded context)
- Learned traversal / reinforcement learning on traversal patterns (future)
- Custom embedding models (use Graphiti's defaults)

## Success Criteria
- Graphiti MCP server runs on FalkorDB alongside CGC, episodes ingest successfully
- CGC adapter enriches file entities with structural context from CGC graph
- `context_beam` on 5 real files returns context Sandy rates as useful (relevant gotchas, conventions, concepts appear at correct distances)
- Developer activity during a work session produces episodes that a new agent session finds valuable via beam query
- Context beam query completes in < 500ms (spike showed 3-15ms for the Cypher portion)
- Graphiti's contradiction detection correctly invalidates outdated context when new facts arrive

## Depends On
- `planning/extension-system/` — Graphiti will be a built-in extension (completed)
- CGC and FalkorDB already running (completed)
- LLM API key for Graphiti (Anthropic or OpenAI)

## Blocks
- `planning/mcp-dashboard/` — dashboard could visualize the context graph
- Future: context skill rewrite (currently edits CLAUDE.md, would write to graph instead)
- Future: cross-project context (multiple CGC graphs enriched by shared Graphiti concepts)
