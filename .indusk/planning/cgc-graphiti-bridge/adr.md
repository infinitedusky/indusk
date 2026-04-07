---
title: "Semantic Graph Bridge"
date: 2026-04-08
status: accepted
---

# Semantic Graph Bridge

## Y-Statement

In the context of **building a per-project semantic graph that anchors developer knowledge (ADRs, lessons, gotchas, conversations, traces) to the code it's about**,
facing **the need for attachment to survive rename and history rewrites, per-project isolation, local-only privacy, and engine portability**,
we decided for **an event-sourced bridge: an append-only log (`.indusk/graph/semantic-graph.log`) tagged with jj change IDs as canonical state, FalkorDB as the disposable runtime projection, and git blob hashes for anchor identity**,
and against **direct database-file versioning, git commit SHAs as the time axis, Kuzu as the v1 engine, UUIDs embedded in source, per-branch forking, and team-shared graphs**,
to achieve **a semantic graph that survives any jj history operation, rebuilds deterministically from text, stays private per developer, and imposes no tax on source code or the team**,
accepting **tight coupling to jj, eventual log compaction as future work, and continued dependence on the `indusk-infra` container**,
because **the event-log/projection split is the only architecture that simultaneously solves versioning, portability, engine flexibility, and branch safety**.

## Context

The `cgc-graphiti-bridge` brief (v2, 2026-04-08) proposes projecting CGC's structural nodes into a per-project semantic graph where everything else — Graphiti-extracted facts, ADRs, lessons, gotchas, conversations, traces — attaches as edges. The brief establishes the vision; this ADR defines the bridge.

The companion whitepaper at `.indusk/research/anchor-overlay-pattern.md` argues this architecture instantiates a general pattern (authoritative structural source → sync pipeline → anchor graph → semantic overlay) that extends beyond code to any domain where structural truth is externally maintained and semantic context needs somewhere stable to live. Section 7 of that document lists design constraints this ADR satisfies.

Prior art: `graphiti-infrastructure` (archived) deployed Graphiti, the `indusk-infra` container, and capture triggers in planner/work/retrospective/catchup. `context-graph/spike-results.md` validated that structural and semantic nodes coexist in one FalkorDB graph with sub-15ms anchored queries. This plan builds on both.

## Decision

Build a **semantic graph bridge** with six structural properties. Each property is a decision that shapes how the bridge works; together they form a coherent architecture.

### How the bridge works

```
CGC (cgc-{project})           Capture triggers (Graphiti)
        │                              │
        ▼  sync pipeline (phase-end)   ▼
        ┌──────────────────────────────┐
        │  Event log                   │
        │  .indusk/graph/               │
        │  semantic-graph.log          │
        │                              │
        │  append-only jsonl           │
        │  jj change ID per event      │
        │  gitignored, local-only      │
        └──────────────┬───────────────┘
                       │  replay
                       ▼
        ┌──────────────────────────────┐
        │  FalkorDB runtime             │
        │  graph name:                 │
        │  semantic-{project}          │
        │                              │
        │  disposable projection       │
        │  ancestry-filtered queries    │
        └──────────────────────────────┘
```

The event log is canonical. The runtime is derived. Everything else falls out of these two facts.

### The six decisions baked into the bridge

**1. Event-sourced state.** The canonical state is an append-only jsonl file at `.indusk/graph/semantic-graph.log`. Every mutation — anchor created, moved, tombstoned; edge attached or invalidated; sync run completed — is one line. The runtime graph in FalkorDB is rebuilt by replaying events in order. The log is never rewritten, only appended. Swapping engines, rebuilding after corruption, and time-travel queries are all variations of "replay the log differently." *Rejected:* committing the database file directly — binary files are hostile to version control, produce opaque diffs, and lock in the engine.

**2. Jj change IDs as the time axis.** Every event carries the jj change ID that was active when it was written. Replay filters by jj ancestry of the current HEAD. Branches, rebase, amend, split, and abandon all work automatically because jj change IDs are stable across those operations. No per-branch forking, no merge reconciliation, no graph surgery. *Rejected:* git commit SHAs — unstable under rebase/amend/squash, which are routine in this workflow.

**3. Graph-stored UUIDs matched via git signals.** Anchors get UUIDs generated on first observation, stored in the graph. Matching across syncs uses a layered strategy: exact path → git blob hash at a different path → `git diff --find-renames` fuzzy threshold → new anchor. Symbols derive identity from their parent file anchor plus name and kind. Source code is never touched. *Rejected:* UUIDs in source (frontmatter/comments) — pollutes every file, creates merge conflicts, language-specific, violates the principle that memory systems should be invisible.

**4. FalkorDB as the v1 runtime, per-project graph name.** The runtime lives in the existing `indusk-infra` FalkorDB container under `semantic-{project}`, alongside `cgc-{project}`. No new container, no new storage, no new dependency. *Rejected for v1:* Kuzu — Graphiti doesn't currently support Kuzu as a backend. The event-log architecture makes Kuzu migration trivial later because replay is engine-agnostic.

**5. Plain file storage, not Redis stream.** The log is a jsonl file, inspectable with `cat`, `jq`, and an editor. *Deferred to future:* Redis streams — a legitimate v2 answer when concurrency, real-time subscriptions, or team sharing become requirements. The schema is storage-agnostic, so the swap is a pure transport change.

**6. Init-mode-aware visibility.** In **`indusk init --local` mode** (team repos where InDusk must be invisible), the entire `.indusk/` directory is already excluded via `.git/info/exclude`, so the log is hidden by the existing mechanism without any additional handling — `--local` inherits the existing exclusion and does nothing special for the graph. In **normal mode** (projects that own InDusk, like infinitedusky), the log file is **not** auto-gitignored by `init` — it lives at `.indusk/graph/semantic-graph.log` as a normal file in the repo, and the developer decides whether to commit it. The tool does not impose a privacy model on normal-mode projects. *Rejected:* shared team graph as a first-class feature — introduces privacy concerns, merge conflicts on the log file, and cross-developer contamination. If team sharing becomes a future goal, a dedicated transport (Redis stream + CRDT, or a separate remote for `.indusk/graph/`) is the natural extension.

### What the bridge looks like from outside

- **Sync pipeline** runs at impl phase boundaries. Reads the `cgc-{project}` graph, diffs against the last-synced anchor state, writes `anchor.created`/`anchor.moved`/`anchor.tombstoned` events to the log, then replays new events into the runtime.
- **Overlay capture** continues to run through Graphiti's existing triggers (planner brief/ADR acceptance, work corrections, retro lessons). A log-writer wrapper mirrors every Graphiti write as an `edge.attached` event in the log with jj change ID tagging. Graphiti remains the extraction engine; the log is the durable record.
- **Rebuild command** (`indusk graph rebuild` or equivalent) blows away the FalkorDB runtime for this project and replays the log from scratch. Used for first-time setup, corruption recovery, and future engine migration.
- **Query layer** (downstream plan) reads from the FalkorDB runtime with an ancestry filter derived from `jj log` on current HEAD.

### Architectural constraint (from the whitepaper)

The sync pipeline MUST NOT know the word "CGC". It is implemented as a generic engine that takes an adapter interface (`snapshot`, `diff`, `identify`, `match`) and applies deltas with move/delete-preserving semantics. CGC is the first adapter; future adapters (Plaid, calendar, EHR, custom tooling) must fit the same interface without touching the pipeline. This adds negligible cost in v1 (one interface boundary) and preserves the architectural optionality the whitepaper argues for.

## Consequences

### Positive
- Attachment survives all history operations — jj change IDs remain valid through rebase/amend/split/abandon
- Semantic graph is rebuildable and portable; engine swaps are free
- Branching works without forking, via ancestry filtering at query time
- Source code is never touched
- Per-developer privacy by default
- No new infrastructure — reuses `indusk-infra` and existing jj workflow
- Debuggable — the log is plain text
- Generalizable — the adapter interface preserves the ability to build future non-code bridges

### Negative
- Tight coupling to jj; projects not using jj cannot use this system as-is
- Log grows forever until a future compaction plan
- First-time setup requires a replay step
- Concurrent writes must serialize (v1: only one writer via phase-gate serialization)
- Team sharing is out of scope; developers cannot benefit from each other's captured knowledge directly
- CGC must be running and current for sync to work

### Risks
- **Jj ancestry semantics change in a future version.** Mitigation: version the filter, test against known jj versions.
- **Log corruption from half-written events.** Mitigation: line-by-line replay with per-line validation, skip and log malformed events.
- **Graphiti writes bypassing the log wrapper.** Mitigation: audit all capture triggers in this plan; add a periodic verification step comparing Graphiti state to log-replay state.
- **Fuzzy rename false positives.** Mitigation: configurable threshold, prefer false negatives, log all rename decisions.
- **First-sync bootstrap cost on large repos.** Mitigation: v1 accepts the cost; future compaction plan can snapshot the initial state.

## Documentation Plan

### Pages
- **New:** `apps/indusk-docs/src/reference/semantic-graph/` — section covering overview, event schema, sync pipeline, CLI, troubleshooting
- **Update:** `apps/indusk-docs/src/guide/architecture.md` — add a section on the event-sourced projection architecture
- **Update:** `apps/indusk-docs/src/.vitepress/config.ts` — sidebar entries
- **Update:** `CLAUDE.md` — one-liner in Key Decisions on ADR acceptance

### Diagrams
- **Architecture flow** (Mermaid, in overview page): CGC + capture triggers → event log → replay → FalkorDB runtime → query layer
- **Anchor lifecycle** (Mermaid, in sync pipeline page): created → moved → tombstoned state transitions driven by events
- **Query model** (Excalidraw, in overview page): jj HEAD → reachable change set → event filter → runtime view

### Changelog
- "Added semantic graph bridge: per-project event-sourced projection of CGC structure and Graphiti knowledge, versioned via jj change IDs, local-only."

### ADR in Docs
- **Publish** this ADR to `apps/indusk-docs/src/decisions/semantic-graph-bridge.md` after acceptance, following `decisions/graphiti-infrastructure.md`.

## References

- **Brief:** `.indusk/planning/cgc-graphiti-bridge/brief.md` (v2, accepted)
- **Whitepaper:** `.indusk/research/anchor-overlay-pattern.md` — the general pattern; Section 7 lists the constraints this ADR satisfies
- **Parent umbrella:** `.indusk/planning/context-graph/brief.md` — broader context-graph plan; stale "two separate graphs" framing to be patched as follow-up
- **Spike results:** `.indusk/planning/context-graph/spike-results.md` — validated coexistence and anchored-query latency
- **Prior art:** `.indusk/planning/archive/graphiti-infrastructure/` — deployed Graphiti, capture triggers, and the `indusk-infra` container
- **Archived v1 brief:** `.indusk/planning/archive/cgc-graphiti-bridge_v1/brief.md` — superseded runtime-adapter framing
- **Jj change ID stability:** https://martinvonz.github.io/jj/latest/
- **Event sourcing pattern:** https://martinfowler.com/eaaDev/EventSourcing.html
- **Git rename detection:** `git-diff(1)` with `-M` / `--find-renames`
