---
title: "Context Bootstrap"
date: 2026-03-27
status: draft
sequence: 5
parent: context-graph
---

# Context Bootstrap — Brief

## Problem
The graph starts empty. Organic episode capture (Plan 3) will grow it over time, but existing knowledge — lessons, conventions, gotchas, ADR decisions, retrospective findings — already exists in flat files. We need to seed the graph so the beam has content from day one.

## Proposed Direction
Parse existing knowledge artifacts into Graphiti episodes:
- CLAUDE.md conventions and gotchas → episodes with file/concept entity links
- Lesson files → episodes with temporal context (when learned, from which plan)
- ADR decisions → episodes with rationale and the files/concepts they affect
- Retrospective findings → episodes with lessons and quality improvements
- Plan research → episodes with evaluated alternatives and trade-offs

## Key Questions
- One-time migration or repeatable sync? (probably one-time, then organic capture takes over)
- What's the right episode granularity? (one episode per lesson? per CLAUDE.md section? per ADR?)
- How do we preserve temporal context? (lessons have dates, ADRs have dates — use as `reference_time`)
- Should we validate bootstrap quality before proceeding to migration?

## Success Criteria
- All existing lessons, conventions, and gotchas are queryable via the beam
- Bootstrapped entities are properly linked to code files
- Temporal context is preserved (facts have correct `valid_at` dates)
- No duplicate entities from bootstrap vs organic capture
- Beam quality improves measurably after bootstrap

## Depends On
- graphiti-infrastructure (Plan 1)
- episode-capture (Plan 3) — informs the right episode format
- context-beam (Plan 4) — needed to validate bootstrap quality

## Blocks
- context-migration (Plan 6)
