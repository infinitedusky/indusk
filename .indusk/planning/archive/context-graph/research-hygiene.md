---
title: "Context Graph — Context Hygiene (Contradiction, Staleness, Pruning)"
date: 2026-03-25
status: complete
---

# Context Hygiene — Research

Extracted from the main research doc. See `research.md` for the full context graph proposal.

## The Hypothesis

A graph that only grows is eventually as bad as a flat file that only grows. The context graph should also **forget**, **detect contradictions**, and **self-correct**.

## What the Field Says

### Graphiti / Zep (2025)
Temporal knowledge graph engine for agent memory. Key features for hygiene:
- **Bi-temporal tracking**: every edge has a validity window — when it became true and when it was superseded
- **Automatic contradiction detection**: LLM compares new edges against semantically related existing ones. Contradictions trigger invalidation of the old edge.
- **Incremental processing**: new data integrates without batch recomputation
- 18.5% accuracy improvements, 90% latency reduction vs baselines
- [Paper](https://arxiv.org/abs/2501.13956) | [GitHub](https://github.com/getzep/graphiti)

### KG Inconsistency Survey (2025)
Three approaches to inconsistency:
1. **Detection**: find the parts of the graph that cause inconsistency
2. **Repair**: fix inconsistent parts
3. **Tolerant reasoning**: reason correctly despite inconsistencies
- [Paper](https://arxiv.org/html/2502.19023v1)

### Memory Decay Models
Temporal decay modulated by recall relevance and frequency, emulating psychological memory retention curves. Unaccessed context decays in priority.

### Lorien Memory
Every fact has a source, every rule has a priority, contradictions are detected automatically, knowledge evolves over time.

## How This Could Work for Us

### Contradiction detection (context vs code)
```cypher
MATCH (conv:Convention)-[:APPLIES_TO]->(f:File)-[:CONTAINS]->(fn:Function)
WHERE conv.rule CONTAINS 'no any' AND fn.source CONTAINS ': any'
RETURN conv.name, f.path, fn.name
```

### Staleness detection
```cypher
MATCH (g:Gotcha)-[:AFFECTS]->(f:File)
WHERE f.last_modified > g.created_date
RETURN g.name, g.description, f.path
```

### Orphan detection
```cypher
MATCH (c:Concept)
WHERE NOT (c)-[:IMPLEMENTS|RELATES_TO|DEPENDS_ON]-()
RETURN c.name, c.description
```

### Temporal validity (Graphiti-style)
Mark outdated context with `valid_until` timestamp instead of deleting. The context beam query filters to only return currently-valid nodes.

## Open Questions
- Should contradiction detection run continuously or periodically?
- Should the agent auto-fix contradictions or flag them for human review?
- What's the decay model? Time-based, usage-based, or both?
- Should we adopt Graphiti's bi-temporal model or keep it simpler?
- Is there value in keeping invalidated context for historical queries?

## Sources
- [Graphiti — GitHub](https://github.com/getzep/graphiti)
- [Zep Paper — arXiv](https://arxiv.org/abs/2501.13956)
- [KG Inconsistency Survey](https://arxiv.org/html/2502.19023v1)
- [Detecting Inconsistency in Large KGs — ACM](https://dl.acm.org/doi/10.1145/3688671.3688766)
