---
title: "Context Beam"
date: 2026-04-12
status: accepted
parent: context-graph
---

# Context Beam — Brief

## Problem

Agents load all context equally — CLAUDE.md, lessons, and skills arrive as a flat dump during catchup. When editing a specific file, the agent has no way to ask "what do I need to know about *this* file?" The relevant Graphiti facts, related lessons, structural dependencies, and eval findings are all there but not surfaced by proximity.

The eval system now produces a continuous stream of "missing context" findings — things the agent needed but didn't have. Context beam is the mechanism that delivers that context at the right time.

## Proposed Direction

Build `context_beam` as an MCP tool in indusk-mcp. Given a target file (or set of files), it radiates outward through both structural and semantic dimensions, returning high-signal context with distance-based relevance decay.

### The query pipeline

The beam is a sequence of discrete queries, each targeting a different data source. Not recursive — it's a fixed pipeline you can see, tune, and extend.

**Query 1 — Semantic graph anchors (FalkorDB)**
```cypher
MATCH (a:Anchor {path: $filePath, status: 'active'})
RETURN a.uuid, a.kind, a.path
```
Find the target file's anchor in the semantic graph. This is the starting node for structural traversal.

**Query 2 — Structural neighbors (FalkorDB)**
```cypher
MATCH (a:Anchor {path: $filePath})-[:IMPORTS|IMPORTED_BY]-(neighbor:Anchor)
WHERE neighbor.status = 'active'
RETURN neighbor.path, neighbor.kind, type(r) AS relationship
```
One hop outward — what does this file import, and what imports it? These are distance-1 files.

**Query 3 — Graphiti facts for target (Graphiti API)**
```
search_memory_facts({
  query: $filePath,
  group_ids: [$projectGroup, "shared"],
  max_facts: 10
})
```
Decisions, corrections, eval findings attached to this specific file. Full detail — these are distance 0.

**Query 4 — Graphiti facts for neighbors (Graphiti API)**
```
search_memory_facts({
  query: $neighborPaths.join(", "),
  group_ids: [$projectGroup, "shared"],
  max_facts: 5
})
```
Facts about the structural neighbors. Summaries only — distance 1.

**Query 5 — Eval findings (local file)**
```
readFindings(projectRoot).filter(f =>
  f.evidence.includes(filePath) || f.finding.includes(filePath)
)
```
Unresolved eval findings that reference this file. These are the "you've been warned" signals.

**Query 6 — CGC callers/callees (CGC MCP)**
```
analyze_code_relationships({ path: $filePath })
```
Function-level dependencies — who calls functions in this file, what functions does it call. Finer-grained than import edges.

**Assembly** — merge all results into a single response:
- Distance 0 (queries 1, 3, 5): full detail — every fact, finding, and anchor attribute
- Distance 1 (queries 2, 4): summaries — file paths, relationship type, fact one-liners
- Distance 2 (query 6 callees-of-callees, if we expand): names only

Temporal weighting: facts from the last 7 days rank higher than older ones. Eval findings always rank highest (they're active problems).

### Weighted graph (future-ready)

The beam reads optional weight properties on nodes and edges if they exist:
- **`importance`** on Anchor nodes — in-degree, fact density, eval finding count, complexity
- **`weight`** on IMPORTS edges — symbol usage count, co-change frequency

Queries use `COALESCE` so missing weights default to neutral:
```cypher
MATCH (a:Anchor {path: $filePath})-[r:IMPORTS]-(neighbor:Anchor)
WHERE neighbor.status = 'active'
RETURN neighbor.path, COALESCE(neighbor.importance, 0) AS importance, COALESCE(r.weight, 1) AS weight
ORDER BY weight DESC, importance DESC
```

V1 ships without weights — all neighbors are equal, beam still works. A future plan adds weight computation to `indusk graph sync` and the beam automatically starts using them. No beam code changes needed.

### Configurability

The pipeline is a list of query steps. Each step has:
- **source**: which system to query (semantic-graph, graphiti, eval, cgc, claude.md)
- **distance**: 0, 1, or 2
- **max_results**: how many items to return
- **detail_level**: full, summary, or name

Adding a query is adding a step to the list. Removing a noisy query is removing a step. The pipeline definition is data, not code — you can tune it without changing the beam implementation.

### Trace mode

`context_beam --trace` shows each query step as it runs:

```
[beam] target: src/lib/eval/judge-runner.ts

[query 1] semantic-graph anchors
  → 1 anchor found: file, uuid=a3f2..., active

[query 2] structural neighbors (1 hop)
  → 6 imports: prompt-builder.ts, rubric.ts, log-writer.ts, types.ts, findings.ts, config.ts
  → 2 imported-by: persistent-judge.ts, eval-trigger.js

[query 3] graphiti facts (distance 0)
  → 3 facts:
    - "detached+unref causes close handler to never fire" (correction, 2026-04-10)
    - "prompt too large with inline diff" (correction, 2026-04-10)
    - "captures usage.costUsd from claude --print output" (decision, 2026-04-11)

[query 4] graphiti facts for neighbors (distance 1)
  → 2 facts:
    - prompt-builder.ts: "diff not embedded in prompt" (correction)
    - findings.ts: "findings persist until fixed or ignored" (decision)

[query 5] eval findings
  → 0 unresolved findings for this file

[query 6] CGC callers/callees
  → 3 callers of runJudgeSync: persistent-judge.ts, eval-trigger.js (inline)
  → 5 callees: spawn, buildJudgePrompt, EvalLogWriter, ingestScorecard, postTelemetry

[assembly] 14 items total — 6 high-signal (d0), 8 awareness (d1)
```

This makes the beam transparent — you see exactly what each query found and can decide if it's useful or noise.

### Integration points

- **Before file edits**: A PreToolUse hook on Edit/Write could auto-run the beam and inject context. The agent sees "here's what you should know about this file" before making changes.
- **Explicit invocation**: `context_beam <file>` MCP tool for manual queries.
- **Eval-driven**: The "missing context" findings from the eval judge tell us what beam should surface. If the judge keeps finding the same gap, beam needs to fill it.

### Data sources

All data sources are live and populated:
- **Semantic graph** (`semantic-{project}` in FalkorDB) — anchors for files/functions/classes, import edges. Built by `indusk graph sync`.
- **Graphiti** — episodic memory with decisions, corrections, retro lessons, eval findings. Captured automatically by skills and the eval judge.
- **Eval findings** (`.indusk/eval/findings.json`) — unresolved findings per file/question.
- **CGC** (`cgc-{project}` in FalkorDB) — structural code intelligence, callers/callees, complexity.
- **CLAUDE.md** — conventions, gotchas, key decisions.

## Context

The eval system (semantic-graph-eval, completed 2026-04-12) produces per-commit scorecards with a "missing context" question. Every time the judge finds information that would have helped the working agent, it's a signal for what beam should deliver.

The semantic graph bridge (cgc-graphiti-bridge, completed 2026-04-09) unified CGC structure and Graphiti knowledge into a single FalkorDB graph per project. Beam queries this unified graph rather than hitting CGC and Graphiti separately.

The persistent judge session (eval Phase 8) means the eval judge accumulates knowledge across commits within a session. Its findings are increasingly informed by prior evaluations — beam benefits from this compounding signal.

## Scope

### In Scope
- `context_beam` MCP tool — given file path(s), returns relevant context from all sources
- Distance-based relevance decay (0 = full, 1 = summary, 2 = name)
- Temporal weighting (recent facts rank higher)
- Eval findings integration (surface unresolved findings for the target file)
- Output format: structured JSON for programmatic use + formatted markdown for agent consumption
- Performance: < 500ms for single-file queries

### Out of Scope
- Auto-injection via PreToolUse hook (v2 — prove the tool works manually first)
- Context migration / replacing CLAUDE.md (separate plan)
- Training or fine-tuning on beam output
- Non-FalkorDB backends

## Success Criteria
- `context_beam` on real files returns context rated as useful by Sandy
- Distance 0 results are high-signal — directly relevant gotchas, decisions, eval findings
- Distance 1+ provides useful awareness without noise
- Query completes in < 500ms
- Agent with beam context makes fewer mistakes (measurable via eval scores)
- "Missing context" eval findings decrease over time as beam fills the gaps

## Depends On
- Nothing — all data sources are live (semantic graph, Graphiti, eval, CGC)

## Blocks
- context-migration — beam is the query layer that migration will route through
