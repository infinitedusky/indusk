---
title: "Context Beam"
date: 2026-04-12
status: accepted
---

# Context Beam

## Y-Statement

In the context of **agents needing file-specific context when editing code, rather than the flat dump of CLAUDE.md/lessons/skills they get during catchup**,
facing **no mechanism to answer "what do I need to know about *this* file?" — Graphiti facts, eval findings, structural dependencies, and lessons are all available but not surfaced by proximity**,
we decided for **a fixed query pipeline (`context_beam` MCP tool) that takes a file path and runs 6 discrete queries across the semantic graph, Graphiti, eval findings, and CGC — assembling results with distance-based relevance decay and optional graph weights**
and against **a single recursive graph traversal, a vector similarity search, a pre-computed context cache per file, and embedding beam logic into the catchup process**,
to achieve **targeted, high-signal context delivery under 500ms that the agent (or a future PreToolUse hook) can invoke before editing any file, with trace mode for transparency and a configurable pipeline for tuning**,
accepting **that v1 requires explicit invocation (no auto-injection), that graph weights are deferred (all neighbors equal), and that the quality of results depends on the richness of the underlying data in Graphiti and the semantic graph**,
because **the data sources are live and populated, the eval system continuously identifies what context is missing, and a fixed pipeline of discrete queries is transparent, debuggable, and tunable — unlike a recursive traversal or black-box retrieval system**.

## Context

InDusk has invested heavily in context infrastructure:
- **CLAUDE.md** — conventions, gotchas, decisions (loaded at session start)
- **Graphiti** — episodic memory with decisions, corrections, eval findings (recalled during catchup)
- **Semantic graph** — file/function anchors with import edges (synced at phase boundaries)
- **CGC** — structural code intelligence, callers/callees
- **Eval system** — per-commit scorecards identifying "missing context" gaps

All of this is available but delivered as a flat dump. The agent editing `judge-runner.ts` gets the same context as the agent editing `biome.json`. There's no way to focus context on the task at hand.

The eval system's "missing context" question produces a continuous signal: "the agent needed X but didn't have it." Context beam is the mechanism that delivers X at the right time — when the agent is about to touch the file where X matters.

## Decision

### 1. Fixed query pipeline, not recursive traversal

The beam is 6 discrete queries in sequence, each targeting a specific data source. Not a recursive graph walk — each query is independent, debuggable, and removable.

| Query | Source | Returns | Distance |
|-------|--------|---------|----------|
| 1. Anchor lookup | Semantic graph (FalkorDB) | Target file's anchor node | 0 |
| 2. Structural neighbors | Semantic graph (FalkorDB) | Import/imported-by files (1 hop) | 1 |
| 3. Target facts | Graphiti API | Decisions, corrections, eval findings for this file | 0 |
| 4. Neighbor facts | Graphiti API | Facts for structural neighbors (summaries) | 1 |
| 5. Eval findings | Local file (findings.json) | Unresolved findings referencing this file | 0 |
| 6. Callers/callees | CGC MCP | Function-level dependencies | 1 |

Each query is a known shape with a known data source. Adding a query step is adding a row. Removing a noisy one is removing a row. The pipeline definition is data — a list of steps with source, distance, max_results, and detail_level.

### 2. Distance-based relevance decay

Results are bucketed by distance from the target:
- **Distance 0**: Full detail — every fact, finding, and anchor attribute
- **Distance 1**: Summaries — file paths, relationship type, one-line fact descriptions
- **Distance 2**: Names only (future — for callees-of-callees expansion)

This prevents information overload. The agent gets deep context for the file it's editing and progressively less detail for surrounding files.

### 3. Temporal weighting

Facts from the last 7 days rank higher than older ones. Eval findings always rank highest — they're active, unresolved problems. This ensures the most recent and most actionable information surfaces first.

### 4. Optional graph weights (future-ready)

Queries use `COALESCE` for optional weight properties:
- `importance` on Anchor nodes (in-degree, fact density, eval finding count)
- `weight` on IMPORTS edges (symbol usage count, co-change frequency)

V1 ships without weights — all neighbors are equal. A future plan computes weights during `indusk graph sync`. The beam automatically uses them when available, no code change needed.

### 5. Trace mode for transparency

`context_beam --trace` logs each query step: what it queried, how many results, what was found. This makes the beam fully transparent — you can see exactly why certain context was surfaced and tune the pipeline accordingly.

### 6. Explicit invocation first, auto-injection later

V1: `context_beam <file>` MCP tool, called explicitly by the agent or user.

V2 (separate plan): PreToolUse hook on Edit/Write that auto-runs the beam and injects context before every file edit. Deferred because we need to prove the queries return useful data before making it automatic — a noisy auto-injection is worse than no injection.

### 7. Dual output format

The beam returns both:
- **Structured JSON** — for programmatic consumption (future auto-injection, dashboards)
- **Formatted markdown** — for agent consumption in conversation

The MCP tool returns JSON; the agent can request markdown rendering if needed.

## Alternatives Considered

### Single recursive graph traversal
Start at the target anchor and recursively walk edges up to N hops, collecting everything. Rejected because: recursive traversal mixes structural and semantic results unpredictably, can't be tuned per-source, and is hard to debug. "Why did this fact surface?" is unanswerable with a recursive walk. The fixed pipeline makes every result traceable to a specific query step.

### Vector similarity search
Embed file content and query by cosine similarity. Rejected because: we already have structured relationships (imports, Graphiti facts, eval findings) that are more meaningful than content similarity. A file with similar code isn't necessarily relevant — a file that imports yours, or that has a correction attached about your module, is. Structured beats unstructured for this use case.

### Pre-computed context cache per file
During `graph sync`, pre-compute and cache the beam result for every file. Rejected because: the cache invalidates on every Graphiti write, every eval finding, every sync. The computation is cheap enough to run on demand (target: < 500ms). Caching adds complexity without meaningful speed gain.

### Embed beam into catchup
Run the beam for "likely files" during `/catchup` and pre-load context. Rejected because: we don't know which files the agent will edit during catchup. Pre-loading all files is wasteful. The beam should run at the point of need — when the agent is about to touch a specific file.

### Single Graphiti search with file path as query
Just call `search_memory_facts({ query: filePath })` and return the results. Rejected because: Graphiti search is semantic, not structural. It finds facts that mention the file path in their text, but misses structural neighbors, eval findings, and CGC relationships. The beam needs multiple data sources, not just one.

## Consequences

### Positive
- File-specific context at the point of need — not a flat dump
- Transparent pipeline — trace mode shows exactly what each query found
- Tunable — add/remove/reorder query steps without changing code
- Future-ready for graph weights and auto-injection
- Directly connected to eval system — "missing context" findings drive what beam surfaces
- Measurable improvement — eval scores before/after beam should show fewer "missing context" findings

### Negative
- V1 requires explicit invocation — agent must call the tool, it won't auto-fire
- Quality depends on data richness — sparse Graphiti/eval data = sparse beam results
- 6 queries per invocation — may be slow if FalkorDB or Graphiti are under load
- No vector/semantic similarity — misses "conceptually similar but structurally unrelated" files

### Risks
- Beam results may be noisy initially — mitigated by trace mode and pipeline tuning
- Graphiti search may not match file paths reliably — mitigated by using exact path in eval findings and anchored facts
- CGC may return stale data if not recently indexed — mitigated by `graph_ensure` during catchup
- Performance may exceed 500ms target with all 6 queries — mitigated by parallel execution of independent queries (1+3+5 can run in parallel, then 2+4+6)

## Documentation Plan

### Pages
- New: `reference/tools/context-beam.md` — how beam works, query pipeline, trace mode, tuning
- New: `guide/context-beam.md` — getting started, interpreting results, when to use it

### Diagrams
- Mermaid flowchart: file → 6 queries → assembly → result
- Mermaid sequence diagram showing parallel query execution

### Changelog
- Added context beam — file-specific context delivery via 6-query pipeline across semantic graph, Graphiti, eval findings, and CGC

### ADR in Docs
- `decisions/context-beam.md`

## References
- [Brief](brief.md)
- [Eval system ADR](../archive/semantic-graph-eval/adr.md) — produces the "missing context" signal
- [Semantic graph bridge ADR](../archive/cgc-graphiti-bridge/adr.md) — the unified graph beam queries
- [Anchor-overlay pattern](../../research/anchor-overlay-pattern.md) — graph architecture
