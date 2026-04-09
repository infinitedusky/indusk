# Semantic Graph Bridge

## Decision

Build an event-sourced bridge between CGC (structural code intelligence) and Graphiti (semantic memory). Per-project append-only event log is canonical, FalkorDB runtime is a disposable projection, sync pipeline is adapter-agnostic, jj change IDs are the versioning substrate.

## Context

Two systems know things about code but don't talk to each other. CGC knows structure (files, functions, imports). Graphiti knows narrative (decisions, corrections, lessons). The semantic graph connects them by projecting CGC's structural data into anchor nodes and attaching Graphiti's knowledge as edges.

The architecture follows the anchor-overlay pattern described in the [companion whitepaper](../../.indusk/research/anchor-overlay-pattern.md) — authoritative structural sources provide stable attachment surfaces for semantic memory.

## Key Tradeoffs

- **Event log over direct graph writes** — canonical state is a file, not a database. Enables rebuild, branch safety via jj ancestry filtering, and crash recovery. Costs: log grows unbounded (compaction is future work).
- **Jj change IDs over git commit SHAs** — stable across rebase/amend/split/abandon. Costs: requires jj; no git-only fallback in v1.
- **Adapter-agnostic sync engine** — CGC is the first adapter; the engine never references it. Costs: slightly more abstract than a direct CGC integration. Benefits: adding new data sources means writing one adapter.
- **FalkorDB runtime is disposable** — delete and rebuild from the log at any time. Costs: no data stored exclusively in the runtime. Benefits: no migration concerns, deterministic state.

## What Was Built

- 11 TypeScript files in `apps/indusk-mcp/src/lib/semantic-graph/`
- 3 MCP tools + 3 CLI commands (`graph_sync`, `graph_rebuild`, `graph_status`)
- 9 documentation pages with Mermaid diagrams
- 72 tests (unit + integration against real FalkorDB)
- Live semantic graphs for infinitedusky (~10k anchors) and chitin-sportsbook (18 anchors)

## Full ADR

See [`.indusk/planning/archive/cgc-graphiti-bridge/adr.md`](../../.indusk/planning/archive/cgc-graphiti-bridge/adr.md)

## Reference

See the [Semantic Graph overview](../reference/semantic-graph/overview.md) for architecture diagrams and full documentation.
