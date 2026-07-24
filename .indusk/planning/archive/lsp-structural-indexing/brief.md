---
title: "LSP Structural Indexing — Replace CGC with Eval-Driven Organic Code Intelligence"
date: 2026-04-14
status: draft
blocked_by: [graph-knowledge-architecture]
---

# LSP Structural Indexing — Brief

## Problem

CGC indexes everything upfront — 118 files, 19,821 functions — regardless of relevance. Most of that is noise. The agent editing one file doesn't need every function in the codebase mapped. CGC also creates a stale/fresh cycle (re-index after changes, stale between indexes) and requires a separate FalkorDB graph namespace, a pipx-installed CLI, and its own MCP server.

Meanwhile, VS Code's Outline view (powered by LSP `textDocument/documentSymbol`) already understands every file's structure — functions, classes, interfaces, type signatures, hierarchy — with zero setup. The TypeScript language server already runs in every session.

## Proposed Direction

Replace CGC's upfront full-codebase index with eval-driven organic structural indexing via LSP document symbols.

The eval agent — which already fires on every commit and reads the full transcript — queries document symbols for files the working agent touched. It writes file structure (functions, exports, types, hierarchy) to the knowledge graph alongside the semantic knowledge it already captures (decisions, corrections, findings).

The graph grows from the work, not from a bulk index. Files that are actively worked on get rich structural nodes. Files that are never touched stay unmapped — because they don't matter yet. When they become relevant (the agent edits them, or they show up as dependencies), the eval agent maps them then.

### What replaces each CGC capability

| CGC Feature | Replacement |
|------------|------------|
| Import graph | Eval agent observes which files are edited together + document symbols show imports |
| Callers/callees | Document symbols + type checker's call hierarchy (LSP `callHierarchy/incomingCalls`) |
| Dead code detection | Periodic LSP-based audit (not every commit — on demand) |
| Complexity metrics | Document symbols + line count heuristics, or periodic audit |
| Full codebase index | Not needed — organic growth covers what matters |

### Code-Level Edge Weighting

Structural edges aren't all equal. The eval agent computes weights from signals it can observe at commit time:

- **Co-change frequency** — files that consistently change together in the same commits get high-weight edges. Strongest empirical predictor of coupling — stronger than import graphs. Mined from `jj log` over time. If `config.ts` and `server.ts` change together in 80% of commits touching either, that's a heavily weighted relationship.
- **Fan-in (node weight)** — files imported by many others are critical nodes. `config.ts` with 30 importers has high blast radius. This is node importance, not edge weight — changes to high fan-in files surface more urgently in beam results.
- **Churn (node weight)** — files changed frequently are active and important. A file changed 50 times in 3 months vs one changed twice — the churny file deserves more attention when its neighborhood is queried.
- **Coupling depth (edge weight)** — if file A calls 8 functions from file B but only 1 from file C, the A→B edge is heavier. Not just "imports" but how deeply intertwined.
- **Bug density (node weight)** — files involved in eval findings with severity warning or critical accumulate negative signal. When anything touches a high-bug-density file, beam should surface that history.

These weights accumulate organically — each commit adds a data point. Early on the graph is sparse and unweighted. After 50+ commits the weights reflect real usage patterns and the beam delivers meaningfully ranked context.

**Structural connections are inferred through shared nodes, not direct edges.** If files A and B both import function X from file C, the graph has `A→C` and `B→C`. The connection between A and B is inferred by traversal, not duplicated as an explicit edge. Semantic connections (shared concepts like "authentication") DO get explicit weighted edges because they can't be inferred from structure.

### Proactive gap filling

The eval agent doesn't just index what's touched — it also notices when the working agent is confused by something structural. "The agent tried to import from this SDK and got the API wrong" → the eval agent maps out that module's structure and attaches context. This is demand-driven intelligence — the graph grows where confusion exists, not where a bulk indexer decided to point.

## Context

- LSP `textDocument/documentSymbol` returns the same tree as VS Code's Outline view — name, kind, hierarchy, range, type detail
- LSP `callHierarchy/incomingCalls` and `callHierarchy/outgoingCalls` give callers/callees
- The eval agent already fires on every `jj describe` and reads the full session transcript
- graph-knowledge-architecture (prerequisite) defines the ontology and makes the eval agent the sole graph writer
- CGC requires: FalkorDB graph namespace, pipx CLI, MCP server, periodic re-indexing. All of this goes away.

## Scope

### In Scope
- Eval agent queries document symbols for files touched in each commit
- File structure (functions, classes, exports, hierarchy) written to knowledge graph
- Import relationships extracted from document symbols
- Proactive gap filling when the eval agent detects structural confusion
- Remove CGC as a required MCP server
- Update beam queries to use knowledge graph structural data instead of CGC

### Out of Scope
- Full type system integration (that's the type-edges plan)
- Real-time LSP queries during the working session (eval agent queries post-commit)
- Dead code detection replacement (keep as periodic manual audit until proven unnecessary)

## Success Criteria
- Beam returns structural context (functions, exports, hierarchy) for files that have been worked on — without CGC
- Structural graph grows organically over multiple sessions as more files are touched
- No regression in beam quality for actively-worked files vs CGC-indexed files
- CGC MCP server no longer required in `.mcp.json`
- Eval agent proactively maps structure for files that confused the working agent

## Depends On
- graph-knowledge-architecture — ontology and eval-as-sole-writer must land first

## Blocks
- type-edges — TypeScript type relationships layer on top of structural indexing
