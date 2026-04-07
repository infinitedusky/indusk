---
title: "Semantic Graph — CGC-Anchored, Graphiti-Enriched, Versioned Per Project"
date: 2026-04-08
status: accepted
sequence: 2
parent: context-graph
supersedes: archive/cgc-graphiti-bridge_v1/brief.md
companion: .indusk/research/anchor-overlay-pattern.md
---

# Semantic Graph — Brief

## Problem

Context about code lives apart from the code itself. CLAUDE.md is a flat wall of text. ADRs live in plan folders. Lessons live in markdown. Retrospective insights live in archives. Dash0 traces live in another system entirely. None of it is attached to the files it's actually about, and the moment a file is renamed or refactored, any ad-hoc mapping breaks.

CGC already knows the structural truth: files, functions, imports, call graphs, continuously reindexed. Graphiti already knows how to extract entities and facts from text with temporal and contradiction-aware semantics. What's missing is a **projection**: a pipeline that takes CGC's live structural state and creates corresponding **anchor nodes** in a shared semantic graph, so every other piece of captured knowledge — decisions, gotchas, lessons, rule violations, traces, conversations — has a stable place to attach itself.

The attachment must survive code change. When a file is renamed, attached context rides along. When a file is deleted, attached context is preserved as a tombstone. When a branch rewrites history, attached context doesn't evaporate. Nothing today gives us this.

## Proposed Direction

Build a **semantic graph per project**: a unified graph containing CGC-sourced structural anchors and Graphiti-sourced semantic overlay, living alongside (but not shared with) the code. The graph is versioned via an append-only event log committed locally (never pushed), tagged with jj change IDs so it survives rebase and amend.

Four moving parts:

1. **Sync pipeline** — phase-triggered, one-way: observes CGC's current state, diffs against the semantic graph's last known state, writes anchor events (create/move/tombstone) into the event log, then replays those events into the runtime graph.
2. **Event log** (`.indusk/semantic-graph.log`) — append-only, jsonl, gitignored, local-only, versioned via jj's operation log. The canonical source of truth. Contains both anchor events (from CGC sync) and overlay events (from Graphiti captures, ADRs, conversations, lessons).
3. **Runtime graph** (FalkorDB, per-project graph name, reused from existing `indusk-infra` container) — disposable query cache, rebuilt from the event log at any time. The semantic graph lives here; CGC's graph lives here separately and remains untouched.
4. **Query layer** — reads from the runtime graph, filters by jj ancestry so branch-scoped edges don't leak. Downstream plans (`context-beam`, `describe_file`) build on top.

Move/delete semantics:

| CGC change | Event | Runtime behavior |
|---|---|---|
| New file/symbol | `anchor.created` | Create anchor, no edges |
| Moved/renamed | `anchor.moved` | Update path in place, edges preserved |
| Deleted | `anchor.tombstoned` | Mark `deleted`, keep node + edges |
| Unchanged | (no event) | No-op |

## Terminology

To keep the vocabulary precise from here forward:

- **Semantic graph** — the full per-project graph. Lives in FalkorDB (runtime), lives in the event log (canonical). Contains everything.
- **Anchors** — the CGC-sourced subgraph. File, Function, Class, Interface nodes. Projected from CGC via the sync pipeline. Never hand-edited.
- **Overlay** — the Graphiti-sourced subgraph. Episodes, facts, entities, decisions, lessons, comments — everything attached to anchors via edges. Authored by the work loop, captured automatically at trigger points.
- **Event log** — the append-only file recording every mutation to the semantic graph. Replay = reconstruct runtime state. Versioned via jj. Not pushed.
- **Sync** — the act of observing CGC and writing anchor events to the log.

The anchor-overlay vocabulary and the architectural rationale are defined in `.indusk/research/anchor-overlay-pattern.md`. This brief assumes that document as background.

## How It Works

### Sync pipeline

1. **Snapshot CGC** — read current state (files, symbols) from the `cgc-{project}` FalkorDB graph
2. **Diff** — compare to the last-synced state recorded in the event log. Classify each delta: new, moved, deleted, unchanged. Use git blob hashes (free from git) for content identity; use `git diff --find-renames` for fuzzy rename detection
3. **Write events** — append anchor events to `.indusk/semantic-graph.log`, each tagged with the current jj change ID
4. **Replay** — apply the new events to the runtime graph in FalkorDB
5. **Record sync run** — append a `sync.completed` event with delta counts and any errors

### Overlay capture

Overlay events come from existing capture triggers — they already work in Graphiti post-`graphiti-infrastructure`:
- Planner skill on brief acceptance → `brief-accepted` event
- Planner skill on ADR acceptance → `adr` event
- Work skill on correction → `correction` event
- Retrospective skill on lesson capture → `lesson` event

All of these currently write directly to Graphiti via `mcp__graphiti__add_memory`. This plan adds a **log-writer wrapper** that mirrors every Graphiti write into the event log with jj change ID tagging. Graphiti remains the runtime extraction engine; the log is the durable record.

### Versioning and branch awareness

The log file is gitignored. Jj's operation log tracks its changes locally. Every event carries the jj change ID active when it was written. Replay filters events by ancestry: when you're on change X, only events whose change ID is an ancestor of X get replayed into the runtime graph.

When you rebase, jj change IDs are stable — events remain valid. When you abandon a branch, its events become unreachable and drop out of replay. When you split a change, the split event inherits the parent's ancestry. No manual graph surgery.

The log never syncs to a git remote. Each developer has their own local semantic graph. Shared team knowledge stays in the normal places: committed docs, ADR markdown, CLAUDE.md.

### Runtime graph lifecycle

The FalkorDB runtime is a projection. You can blow it away at any time and rebuild it from the log via `indusk graph rebuild`. First-time setup or a corrupted cache is just "replay the log." No state is held exclusively in FalkorDB.

CGC's own graph (`cgc-{project}`) stays in the same FalkorDB container, untouched. CGC is authoritative for structure and is rebuilt from code by CGC itself; we don't version it, don't back it up, don't interfere with it.

### Local mode compatibility

In normal mode (projects that own InDusk, like infinitedusky), `init` adds `.indusk/graph/` to `.gitignore`; everything else under `.indusk/` stays committed. In local mode (`indusk init --local`, team repos where InDusk must be invisible), the entire `.indusk/` directory is already excluded via `.git/info/exclude`, so the graph log is hidden by the existing mechanism without additional handling.

## What This Unlocks

The semantic graph is the anchor skeleton everything else hangs off of. Once it exists, downstream plans become natural:

- **`context-beam`** — query the semantic graph from a file anchor outward, distance-weighted, spanning both anchor and overlay layers
- **`describe_file`** — an MCP tool that returns "everything known about this file" as a single response
- **Refactor tests** — rule checkers attach violations as edges to file/symbol anchors, persistent across renames
- **Lint projection** — Biome violations become graph state rather than ephemeral output
- **ADR attachment** — ADRs attach as edges to the files/symbols they govern
- **Retrospective lessons** — attach to files touched in the plan
- **Dash0 error projection** (later) — stack traces become edges from production errors to the file/symbol anchors involved
- **Conversation captures** — "why does this file do X?" explanations attach to their target

None of these are in scope for this plan. **They are the reason this plan matters.** Without the semantic graph, each of them has to invent its own attachment mechanism and each of them breaks on the next rename.

## Context

- **`.indusk/research/anchor-overlay-pattern.md`** — companion whitepaper defining the general pattern this plan instantiates. Section 7 lists design constraints the ADR should satisfy: the sync pipeline must not know the word "CGC", identity is a per-adapter strategy, anchor types are adapter-declared, move/delete semantics live in the pipeline not the adapter. These don't add cost to the code implementation; they preserve optionality for future adapters (Plaid, calendar, EHR, etc. — all described in the whitepaper).
- **`context-graph` umbrella brief** — parent plan. Note: the parent's "two separate graphs, `cgc_path` as a string lookup key" framing is now stale. This plan's ADR formally supersedes it. The parent brief should be patched after this ADR is accepted.
- **`context-graph/spike-results.md`** — proved that structural and semantic nodes coexist in one FalkorDB graph and that anchored queries are 3-15ms. Still valid; only the direction has flipped (spike wrote semantic nodes into CGC's graph; this plan projects CGC into a separate semantic graph).
- **`graphiti-infrastructure` (archived)** — Graphiti runtime is already deployed, capture triggers are already wired into planner/work/retrospective/catchup. This plan sits on top.

## Scope

### In Scope
- Sync pipeline: diff CGC state against event log, classify deltas, write events
- Move/rename detection via git blob hashes and `git diff --find-renames`
- Delete handling with tombstone semantics
- Symbol-level granularity: File, Function, Class, Interface anchors
- Phase-boundary trigger wired into the work skill (runs once per phase)
- Event log format and writer (`.indusk/semantic-graph.log`)
- Log replay into FalkorDB runtime (`indusk graph rebuild`)
- Gitignore entry for the log file, added during `init`
- jj change ID tagging on every event
- Ancestry-filtered query support (query layer reads only events reachable from current jj HEAD)
- Overlay-write wrapper: every Graphiti capture also appends to the log
- CLI/MCP tool to run sync on demand (`indusk graph sync` or equivalent)
- Smoke test on infinitedusky and chitin-sportsbook — confirms the pipeline is generic and not project-tweaked
- ADR resolving: stable identifier strategy, log format details, replay semantics, graph layout

### Out of Scope
- The query layer (`context-beam`, `describe_file`) — separate plans, blocked on this one
- Kuzu migration — deferred to a follow-up plan. FalkorDB is the v1 runtime.
- Refactor tests, lint projection, Dash0 projection — downstream consumers, each their own plan
- Shared team graphs / remote sync — the log is local-only, period. Team sharing is not in scope.
- Bi-directional sync (writing back to CGC) — CGC is authoritative; one-way only
- Real-time / continuous sync — v1 is phase-triggered
- Long-lived feature branches that never merge — edges on abandoned branches become unreachable by design
- Rebase-proof overlay edges referencing git commit SHAs — we use jj change IDs instead, which sidesteps the problem
- Patching the parent `context-graph/brief.md` — flagged as a follow-up, not part of this plan's scope

## Success Criteria

- Running sync on infinitedusky populates anchors for every File, Function, Class, and Interface CGC knows about
- Renaming a file between syncs moves the anchor in place and preserves any edges attached to it
- Deleting a file between syncs marks the anchor `deleted` and preserves its edges
- Blowing away the FalkorDB runtime and running `indusk graph rebuild` reconstructs the exact same semantic graph from the log
- Creating a jj change on a feature branch, capturing an overlay event, then rebasing → the event is still present and correctly attributed after the rebase
- Abandoning a jj change → the event's change ID is unreachable and the event is excluded from replay
- Sync runs in under 5 seconds for infinitedusky's current size (~118 files, ~20k symbols)
- The work skill's phase-end gate runs sync automatically and reports deltas
- chitin-sportsbook sync works end-to-end without project-specific tweaks
- Both projects end up with per-project semantic graphs that don't leak into each other
- The log file is gitignored by default; a `git status` in either project shows no semantic-graph changes

## Depends On
- `graphiti-infrastructure` (completed, archived) — Graphiti container, MCP server, capture triggers
- CGC indexing (working) — `cgc-{project}` graph is the sync source
- jj usage (already established) — the versioning substrate

## Blocks
- `context-beam`
- `episode-capture` (if kept as a separate plan after scoping; the overlay-write wrapper may absorb it)
- `context-migration`
- Future: refactor-test plan, lint-projection plan, Dash0-projection plan, Kuzu-migration plan
- Future: patch to `context-graph/brief.md` to align parent framing with the current direction

## Open Questions

Deferred to the ADR:

- **Stable identifier strategy in detail.** UUIDs in the graph, matching via git blob hash and rename detection is the agreed direction. The ADR fills in: UUID generation scheme, collision handling, what happens on moved-and-modified simultaneously, handling of pathological cases (copy-paste creating duplicate content hashes, etc).
- **Event log format.** JSONL is the default assumption. The ADR decides schema per event type, field names, serialization of jj change IDs, how to represent edge deletions vs tombstones.
- **Replay semantics.** Full replay vs incremental; whether replay is idempotent; how long-running replays are checkpointed; whether replay is transactional in FalkorDB.
- **Query ancestry filter.** How is "is this change ID an ancestor of HEAD" computed efficiently at query time. Cache the reachable set per session? Recompute per query? Push the filter into Cypher via an IN clause?
- **Symbol identity rules.** When a function's signature changes, is it the same symbol? v1 answer is probably "no, new anchor" but the ADR should be explicit.
- **Overlay-write wrapper placement.** Is it a Graphiti MCP proxy? A library used by the capture triggers? A hook? The ADR picks.
- **CGC graph-name discovery.** Currently hardcoded as `cgc-{basename}`. Should the sync pipeline read this from config or discover it? Minor but worth deciding.
- **First-sync bootstrap cost.** For a repo with 20k symbols, first sync produces 20k anchor events. Is that acceptable in the log, or do we snapshot differently for the initial sync?
