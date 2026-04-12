# Context Beam

**Date:** 2026-04-12
**Status:** Accepted

## Decision

Build `context_beam` as a fixed 6-query pipeline MCP tool that takes a file path and returns targeted context from all available data sources — semantic graph, Graphiti, eval findings, and CGC — with distance-based relevance decay.

## Why

Agents receive all context equally during catchup — CLAUDE.md, lessons, and skills arrive as a flat dump. When editing a specific file, there's no way to ask "what do I need to know about *this* file?" The eval system continuously identifies missing context, and beam is the mechanism that delivers it at the point of need.

## Key Choices

- **Fixed pipeline over recursive traversal** — 6 discrete queries, each targeting a specific source. Transparent, debuggable, tunable. A recursive graph walk would mix results unpredictably and be impossible to trace.
- **Distance-based decay** — distance 0 (target file) gets full detail, distance 1 (neighbors) gets summaries, distance 2 gets names only. Prevents information overload naturally.
- **Explicit invocation first** — v1 is manual (`context_beam` tool / `indusk beam` CLI). Auto-injection via PreToolUse hook deferred to prove data quality before automating delivery.
- **Graceful degradation** — if any query source is down (FalkorDB, Graphiti, CGC), that query is skipped and the rest still return results.
- **Optional graph weights** — queries use `COALESCE` for weight properties that don't exist yet. When a future plan adds weight computation, beam uses them automatically.

## Tradeoffs

- v1 requires explicit invocation — the agent must call the tool, it won't auto-fire
- Quality depends on data richness — sparse Graphiti/eval data means sparse beam results
- No vector/semantic similarity — misses "conceptually similar but structurally unrelated" files

## References

- [Full ADR](../../.indusk/planning/archive/context-beam/adr.md)
- [Reference docs](/reference/tools/context-beam)
- [Guide](/guide/context-beam)
