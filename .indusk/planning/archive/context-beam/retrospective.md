---
title: "Context Beam Retrospective"
date: 2026-04-13
plan: context-beam
---

# Context Beam — Retrospective

## What We Set Out to Do

Build a `context_beam` MCP tool that takes a file path and returns targeted, high-signal context from all available data sources — semantic graph, Graphiti, eval findings, and CGC — with distance-based relevance decay and trace mode for transparency. The goal: answer "what do I need to know about *this* file?" instead of dumping everything flat during catchup.

## What Actually Happened

The plan delivered exactly what was scoped. 4 phases (Phase 5 auto-injection was wisely deferred before impl began). The implementation produced 11 new files in `apps/indusk-mcp/src/lib/beam/` plus 2 doc pages, CLI command, and MCP tool registration.

Key metrics from testing:
- 185-276ms per query (well under the 500ms target)
- 6-query pipeline runs with graceful degradation — any source can be down without failing the beam
- Trace mode works and is genuinely useful for understanding what each query finds

The plan was a clean, focused delivery. No scope creep, no major surprises, no debugging spirals.

## Getting to Done

The unplanned work was minimal:
- **`graph-client.ts`** was added as a thin wrapper around the FalkorDB client for beam-specific queries. Not in the original impl but a natural extraction.
- **`formatBeamCompact`** was built proactively in `format.ts` for the future auto-injection use case (Phase 5). Not used yet but ready.
- **Graphiti query latency** was the one surprise — `search_memory_facts` took ~1048ms in one test, making it the bottleneck. The beam still completed under 500ms overall because other queries ran in parallel, but this is a known issue for beam-heavy workloads.

## What We Learned

1. **Fixed pipelines beat recursive traversals for debuggability.** The 6-query pipeline is transparent — trace mode shows exactly what each step found. A recursive graph walk would have been impossible to debug when results were unexpected.

2. **Graphiti search is the latency bottleneck.** FalkorDB Cypher queries take 3-55ms. Graphiti `search_memory_facts` takes 100-1048ms. For beam to stay fast, Graphiti queries need to run in parallel with everything else, never on the critical path.

3. **Distance-based decay is the right mental model.** Full detail at distance 0, summaries at distance 1 — this naturally prevents information overload without arbitrary truncation.

4. **Data quality matters more than query sophistication.** Beam results are sparse on new/unindexed files. The fix is always "enrich the data" (sync, index, let eval run), not "make the queries smarter."

## What We'd Do Differently

1. **Add tests from the start, even with live dependencies.** The impl deferred all tests because queries depend on live FalkorDB/Graphiti. In hindsight, mock-based unit tests for the runner and assembly logic would have been quick to write and valuable. The runner's sort/filter/assembly logic is pure and testable.

2. **Measure Graphiti latency earlier.** The 1048ms Graphiti query was discovered during Phase 3 manual testing. If we'd benchmarked Graphiti search in research or Phase 1, we could have designed the parallel execution strategy with that constraint in mind from the start.

## Insights Worth Carrying Forward

- The "fixed pipeline of discrete queries" pattern is reusable. Any system that needs to gather context from multiple sources (beam, catchup, auto-docs) can use the same shape: a list of query steps, each with source/distance/detail, executed with graceful degradation.
- `COALESCE` in Cypher for optional weights is a clean pattern for future-proofing graph queries without requiring schema migrations.
- Proving data quality through manual invocation before automating delivery (v1 explicit, v2 auto-inject) was the right call. We can now see exactly what beam finds and tune it before it fires on every edit.
