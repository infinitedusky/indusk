---
title: "Context Beam"
date: 2026-03-27
status: draft
sequence: 4
parent: context-graph
---

# Context Beam — Brief

## Problem
Agents load all context equally. We need a query interface that starts from the code being edited and delivers narrow, high-signal context with distance-based relevance decay — pulling from both structural (CGC) and semantic (Graphiti) dimensions.

## Proposed Direction
Build `context_beam` as an MCP tool in indusk-mcp. Two-phase query:

1. **Semantic phase**: Query Graphiti for entities and facts linked to the target file (distance 0, full detail)
2. **Structural phase**: Query CGC for the file's structural neighborhood (imports, callers, callees)
3. **Expansion**: For each structural neighbor, query Graphiti again (distance 1, summaries)
4. **Assembly**: Merge results with distance-based decay, temporally filtered

The beam leverages the CGC-Graphiti bridge (Plan 2) for file entity recognition and structural enrichment.

## Key Questions
- How many hops for each distance level? (research says 2-4 hops is the sweet spot)
- What's the right output format for the agent? (structured JSON, formatted markdown, both?)
- Should the beam auto-run before every file edit, or be explicitly invoked?
- How do we handle files with no semantic context yet? (graceful fallback to structural only)
- Can we add relevance weighting beyond distance? (recency, severity, traversal frequency)

## Success Criteria
- `context_beam` on real files returns context Sandy rates as useful
- Distance 0 results are high-signal (directly relevant gotchas, conventions, concepts)
- Distance 1+ results provide useful awareness without noise
- Query completes in < 500ms (spike showed 3-15ms for single-graph; two-phase may be slower)
- Agent with beam context makes fewer mistakes than agent with flat CLAUDE.md

## Depends On
- cgc-graphiti-bridge (Plan 2)
- episode-capture (Plan 3) — graph needs data to query

## Blocks
- context-migration (Plan 6)
