---
title: "CGC-Graphiti Bridge"
date: 2026-03-27
status: draft
sequence: 2
parent: context-graph
---

# CGC-Graphiti Bridge — Brief

## Problem
Graphiti is a general-purpose knowledge graph. It doesn't know about codebases. We need an adapter layer that makes Graphiti code-aware — recognizing file entities, enriching them with structural context from CGC, and pre-wiring structural relationships.

## Proposed Direction
Build a bridge in indusk-mcp that:
1. Detects when a Graphiti entity corresponds to a code artifact (file, function, module)
2. Looks it up in CGC's structural graph and attaches structural metadata
3. Optionally pre-seeds Graphiti with file entities from CGC so the structural scaffolding exists before any developer activity
4. Uses CGC's structural edges (imports, calls) to create relationships between file entities in Graphiti

## Key Questions
- How do we detect that an extracted entity is a file? (path patterns, entity type hints, CGC lookup)
- Should we pre-seed all files or lazily create entities on first encounter?
- When CGC reindexes and node IDs change, how do we keep references valid? (file paths as stable keys)
- How much structural context do we copy into Graphiti vs fetch on demand from CGC?

## Success Criteria
- File entities in Graphiti carry a `cgc_path` that maps to CGC's structural graph
- Structural neighbors (imports, callers) of a file entity are queryable via the bridge
- CGC reindex doesn't break Graphiti references
- Structurally coupled files are pre-connected in Graphiti

## Depends On
- graphiti-infrastructure (Plan 1)
- CGC running and indexing (completed)

## Blocks
- context-beam (Plan 4)
