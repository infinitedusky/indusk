---
title: "Context Graph — CGC + Graphiti"
date: 2026-03-25
status: draft
---

# Context Graph — Brief

## Problem
Coding agents lose effectiveness as project context grows. CLAUDE.md becomes a wall of text where critical gotchas get buried. The agent reads everything equally — a one-liner convention gets the same attention weight as a complex architectural decision. This is the "lost in the middle" problem applied to development context: more context in the window means less attention per piece.

Humans don't work this way. A developer editing a file has dense, focused awareness of what's directly relevant and fuzzy awareness of what's connected. The further from the immediate task, the less detail they hold — but they can pull threads deeper when needed. Current LLM context management (dump everything into the window) is the opposite of this.

## Proposed Direction
Merge two existing open-source systems — **CGC** (CodeGraphContext, structural code intelligence) and **Graphiti** (temporal semantic memory by Zep) — on a shared FalkorDB backend. Build a bridge layer in indusk-mcp that queries both graphs simultaneously, providing agents with distance-weighted context anchored to the file they're editing.

CGC already indexes code structure (files, functions, imports, calls). Graphiti already handles temporal knowledge (facts with validity windows, automatic contradiction detection, incremental updates). Neither knows about the other. The value is the bridge — `context_beam` — that starts from a code file and traverses outward through both structural AND semantic edges, assembling a "context cloud" with relevance decay by graph distance.

See `research.md` for the full analysis, `research-testing.md` for the testing strategy, `research-hygiene.md` for contradiction/staleness detection, and `research-anthropic-alignment.md` for how this aligns with Anthropic's context engineering guidance.

## Context
- CGC is already integrated (FalkorDB + MCP server, used across projects)
- Graphiti supports FalkorDB natively (`graphiti-core-falkordb` on PyPI), has an MCP server, and a Docker image
- Both are Python, both use FalkorDB, both are actively maintained open-source
- GraphRAG / context graphs are an active research area (Microsoft GraphRAG, ReMindRAG at NeurIPS 2025, LazyGraphRAG)
- Anthropic's own guidance says "find the smallest set of high-signal tokens" — this is the infrastructure to do that for coding
- Nobody has applied this to development context specifically — document QA yes, coding no

## Scope

### In Scope
- Spike: get Graphiti MCP server running alongside CGC on shared FalkorDB, prove combined queries work
- Bridge tools in indusk-mcp: `context_beam` (distance-weighted query), `context_add` (write semantic nodes linked to code), `context_link` (bridge edges between graphs)
- Work skill integration: query context before editing, enrich context after verified work
- Bootstrap: parse existing CLAUDE.md, ADRs, and lessons into the graph
- Graphiti as a built-in extension in indusk-mcp
- CLAUDE.md slimmed to orientation only (What This Is, Architecture, Key Decisions) — gotchas and conventions move to graph

### Out of Scope
- Forking CGC or Graphiti into a single codebase (evaluate after spike proves value)
- Custom graph engine (use Graphiti's temporal/contradiction features as-is)
- Replacing skills, lessons, or the process layer (these remain traditional context — always loaded)
- Production deployment of Graphiti (local dev only for now)
- Learned traversal / reinforcement learning on traversal patterns (Phase 5+ if this works)

## Success Criteria
- Spike proves technical feasibility: both MCP servers coexist on FalkorDB, combined query returns results
- `context_beam` on 5 real files from numero returns context that Sandy rates as useful (precision > 80%, recall > 70%)
- A/B comparison: agent with graph context makes fewer convention violations and gotcha hits than agent with flat CLAUDE.md
- Context enrichment during work produces nodes that a new agent would find valuable
- Context beam query completes in < 500ms

## Depends On
- `planning/extension-system/` — Graphiti will be a built-in extension (completed)
- CGC and FalkorDB already running (completed)

## Blocks
- `planning/mcp-dashboard/` — dashboard could visualize the context graph
- Future: context skill rewrite (currently edits CLAUDE.md, would write to graph instead)
