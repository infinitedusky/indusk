---
title: "Context Migration"
date: 2026-03-27
status: draft
sequence: 6
parent: context-graph
---

# Context Migration — Brief

## Problem
Traditional context (CLAUDE.md, lessons, skills, handoff files, memory) consumes significant context window space and loads everything regardless of relevance. Now that the graph carries this knowledge, we can slim the traditional system and let the beam deliver context on demand.

## Proposed Direction
Progressively migrate context layers from flat files to graph-backed queries:

1. **Lessons** → remove flat files, graph carries them (lowest risk)
2. **CLAUDE.md gotchas/conventions** → remove sections, graph carries them
3. **Handoff** → replace with session episodes, beam surfaces relevant state
4. **Memory** → replace with graph facts about developer and project
5. **Skills** → slim to one-liner triggers, graph carries the knowledge

A/B test at each stage: agent with graph context vs agent with traditional context.

## Key Questions
- What's the irreducible minimum of always-loaded context? (project identity + "use the graph")
- How do we A/B test agent quality? (same task, different context sources, measure mistakes)
- What's the rollback plan if the graph doesn't carry enough? (keep flat files as fallback)
- Can catchup become just a beam query instead of reading 30+ files?
- Do skills need to exist at all if the graph has the project-specific knowledge?

## Success Criteria
- Agent with graph-backed context performs equal to or better than agent with flat file context
- Context window consumption drops significantly (measure token count before/after)
- New sessions start faster (beam query vs reading 30+ files)
- No regression in convention adherence, gotcha avoidance, or process compliance
- Catchup reduces to a single beam query

## Depends On
- context-bootstrap (Plan 5) — graph must have content before removing flat files
- context-beam (Plan 4) — must be proven reliable

## Blocks
- Nothing — this is the endgame
