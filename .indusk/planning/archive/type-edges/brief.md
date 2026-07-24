---
title: "Type Edges — TypeScript Type Relationships in the Knowledge Graph"
date: 2026-04-14
status: draft
blocked_by: [graph-knowledge-architecture, lsp-structural-indexing]
---

# Type Edges — Brief

## Problem

The knowledge graph captures semantic knowledge (decisions, corrections, concepts) and structural knowledge (functions, imports, hierarchy via LSP). But it doesn't understand types — which types flow where, what implements what interface, how generics instantiate. TypeScript's compiler knows all of this; we're not tapping it.

Type relationships are richer than import edges. "Function A returns `Promise<BeamResult>` consumed by 3 callers who all await it" tells you more about coupling than "file A imports file B."

## Proposed Direction

The eval agent queries TypeScript's type system (via LSP type hierarchy or the compiler API) for files it's indexing and writes type relationships as edges in the knowledge graph.

Type edges include:
- Interface → implementation relationships
- Generic instantiation chains (which concrete types fill which type parameters)
- Return type → consumer relationships (what functions consume the output of other functions)
- Type narrowing dependencies (which conditionals refine which types)
- Shared type dependencies (files connected by using the same interface/type)

This gives the beam a type-aware dimension: "these files are connected because they both implement `QueryStep`" or "this function's return type changed and these 5 consumers will break."

## Context

- TypeScript's compiler API (`ts.TypeChecker`) is queryable programmatically
- LSP exposes `typeHierarchy/supertypes` and `typeHierarchy/subtypes`
- LSP exposes `callHierarchy` with type information
- lsp-structural-indexing (prerequisite) establishes the pattern of eval agent querying LSP
- JetBrains' code understanding is ~40% types — this is the layer we're missing

## Scope

### In Scope
- Eval agent queries type hierarchy for indexed files
- Interface/implementation edges in the knowledge graph
- Shared type dependencies (files using the same types)
- Beam queries leverage type edges for context delivery

### Out of Scope
- Full program-wide type analysis (focus on touched files, organic growth)
- Custom TypeScript compiler plugins
- Type-level refactoring tools

## Success Criteria
- Beam returns type-based connections ("these files share interface X")
- Type edges surface when the working agent is about to break a type contract
- Knowledge graph captures interface/implementation relationships for actively-worked code

## Depends On
- graph-knowledge-architecture — ontology must support type entity/relationship types
- lsp-structural-indexing — establishes eval agent + LSP pattern

## Blocks
- Nothing — this is an enrichment layer
