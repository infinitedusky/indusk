---
title: "Graphiti Infrastructure"
date: 2026-03-27
status: draft
sequence: 1
parent: context-graph
---

# Graphiti Infrastructure — Brief

## Problem
indusk-mcp needs a temporal knowledge graph engine as its core context backend. Graphiti provides entity extraction, deduplication, contradiction detection, and temporal tracking. This plan integrates Graphiti as internal infrastructure — not an extension the agent talks to, but the engine behind indusk-mcp's context tools.

## Proposed Direction
Run the Graphiti MCP server as an internal dependency of indusk-mcp. indusk-mcp calls Graphiti's API to ingest episodes, search context, and manage the knowledge graph. The agent never sees Graphiti directly — it sees indusk-mcp tools (`context_beam`, `context_add`, etc.) that use Graphiti behind the scenes.

Architecture:
```
Agent ←→ indusk-mcp ←→ Graphiti MCP server ←→ FalkorDB
              ↕
             CGC ←→ FalkorDB (same instance, different graph)
```

- Graphiti MCP server runs as a Docker container (composable.env component or managed by `init`)
- indusk-mcp calls Graphiti over MCP/HTTP as an internal client
- API key lives in indusk-mcp config (not an extension `.env`)
- `init` ensures Graphiti is running alongside FalkorDB and CGC
- Health checks include Graphiti as core infrastructure
- If Graphiti is unavailable, indusk-mcp falls back to flat file context (CLAUDE.md, lessons, etc.)

## Key Questions
- Which LLM provider? (Anthropic preferred — confirm Graphiti supports it well, check cost)
- How does indusk-mcp (TypeScript) call Graphiti's API? (MCP client SDK, HTTP, or subprocess)
- What graph name for the semantic graph? (configurable via `database` param on FalkorDriver)
- What's the LLM cost per episode? (3-6 LLM calls per episode for extraction, dedup, contradiction)
- How does `init` manage the Graphiti container lifecycle? (composable.env component, or direct Docker management like FalkorDB)
- Graceful degradation: what's the flat-file fallback experience when Graphiti isn't running?

## Success Criteria
- Graphiti MCP server running, connected to FalkorDB, managed by `init`
- indusk-mcp can call Graphiti's `add_episode` and get entities/facts extracted
- indusk-mcp can call `search_nodes` and `search_facts` and get relevant results
- Contradiction detection works: add conflicting facts via indusk-mcp, verify old one expires
- Health check reports Graphiti status alongside FalkorDB and CGC
- Fallback: if Graphiti is down, indusk-mcp tools still work using flat file context

## Depends On
- FalkorDB running (completed)
- LLM API key (user provides)

## Blocks
- All subsequent context graph plans
