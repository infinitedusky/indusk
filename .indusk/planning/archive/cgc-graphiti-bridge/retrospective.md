---
title: "Semantic Graph Bridge — Retrospective"
date: 2026-04-09
---

# Semantic Graph Bridge — Retrospective

## What We Set Out to Do

Build an event-sourced bridge between CGC (structural code intelligence) and Graphiti (semantic memory). The goal: every file and symbol gets a persistent anchor in a semantic graph, Graphiti captures flow into the log automatically, and the runtime is rebuildable from the log at any time. The architecture was described in the anchor-overlay-pattern whitepaper — this plan was the implementation.

## What Actually Happened

The plan executed across 9 phases over two sessions. The core architecture landed exactly as designed: append-only event log as canonical source, FalkorDB runtime as disposable projection, adapter-agnostic sync engine, jj change IDs as the versioning substrate.

**What diverged from the original spec:**

1. **Anchor count was ~10k, not ~20k as predicted.** The impl estimated ~20k based on raw CGC node counts (19,821 functions), but the adapter's `File -[:CONTAINS]-> Function` join returned fewer because CGC indexes build artifacts (`.js` chunks) that have function nodes but no file-contains-function edges. Not a bug — the estimate was wrong.

2. **Internal import edges were added mid-plan.** The original Phase 6 spec only covered anchor projection (nodes). During implementation, Sandy asked about projecting IMPORTS edges. We discussed the CGC schema (File → Module, where Module is a specifier string), decided to filter to relative imports only (no npm/node: builtins), and added it to Phase 6. This required extending the adapter interface with `AdapterEdge` and an optional `edges()` method, and updating the sync engine to project edges after anchor diffing. Good scope addition — ~30 lines of adapter code, clean interface extension.

3. **The Graphiti capture wrapper can't be called by the agent directly.** The skills instruct the agent to call `mcp__graphiti__add_memory`, but the wrapper is TypeScript library code. The skills were updated to note "use `graph_capture` when available" — but that MCP tool doesn't exist yet. The wrapper is consumed by the MCP tools in graph-tools.ts, but there's no `graph_capture` tool that wraps `captureWithLog`. This is a gap: the dual-write pattern exists in code but isn't wired end-to-end for skill-triggered captures.

4. **Overview docs were pulled forward from Phase 9.** Sandy wanted the system documented with diagrams for presentation before the plan was complete. This was the right call — it forced clarity on the architecture while it was still fresh.

5. **First sync takes 73 seconds.** The bottleneck is 118 sequential `git hash-object` calls (one per file). Could batch with `git hash-object --stdin-paths` but didn't optimize for v1.

**Structural scope:** 11 new TypeScript files in `semantic-graph/`, 3 MCP tool registrations, 3 CLI commands, 9 docs pages, 3 skill updates. 72 semantic-graph tests + plan-parser test fix = 118 total tests passing.

## Getting to Done

**Session 1 (Phases 1–4):** Clean execution. Event schema, log I/O, jj integration, FalkorDB runtime client, replay engine. 49 tests. One notable issue: the `validate-impl-structure` hook repeatedly rejected edits with false-positive "missing OTel" errors during a docker prune. Root cause was transient filesystem reads in the hook's subprocess context. Resolved by waiting for the prune to finish.

**Session 2 (Phases 5–9 + retro):** Also clean, plus:
- Phase 5 landed the adapter interface with `AdapterEdge` — cleaner than the original spec which didn't have edge projection
- Phase 6 CGC adapter worked first try against real data
- Phase 7 Graphiti wrapper had one test failure (tried to JSON.parse a payload that was already an object) — fixed in one edit
- Phase 8 had two type errors at build time (accessing `.adapter` without discriminated union narrowing, and `as const` on a variable) — fixed quickly
- Phase 9 plan-parser test broke because `local-init-mode` was archived earlier in the session — updated the test to reference `cgc-graphiti-bridge` instead
- Composable.env networking cleanup (unrelated to the bridge) was done mid-session

No blockers. No significant debugging. The event-sourced architecture made each phase's tests straightforward — you can test the sync engine with a fake adapter, test the adapter against real data, test replay against a seeded log.

## What We Learned

1. **Event sourcing makes testing trivial.** Every component (writer, reader, sync engine, replay, adapter) can be tested in isolation by constructing the right events. The fake in-memory runtime client in the sync-engine tests is 30 lines and covers all six event types. This is the architecture's biggest win for development velocity.

2. **The adapter interface needs an `edges()` method, not just `snapshot()`.** The original spec had adapters returning only records (nodes). Adding edges mid-plan showed that relationships are a first-class concern — import graphs, call graphs, inheritance hierarchies. The optional `edges()` method was the right design: adapters that don't discover relationships just omit it.

3. **Identity-string-based edge resolution works well.** Edges use identity strings (`file::src/app.ts`) rather than UUIDs. The sync engine maps identities to UUIDs during the diff pass, so edges can reference anchors that were just created in the same sync cycle. This avoided a two-pass architecture.

4. **FalkorDB JS client returns rows as objects keyed by alias, not positional tuples.** This was discovered in Phase 3 (last session) and caused 6 false-positive test failures. Always alias projections in Cypher (`RETURN a.uuid AS uuid`) and read by name (`row.uuid`). Already captured as a gotcha.

5. **Import specifier resolution is straightforward but has edge cases.** Relative imports (`./foo`) need extension resolution (`.ts`, `.tsx`, `.js`, `/index.ts`). The `.js → .ts` substitution is critical for TypeScript projects that use `.js` extensions in imports. 155 of 158 internal imports resolved successfully — 3 unresolvable specifiers were silently skipped.

## What We'd Do Differently

1. **Would have scoped import edge projection from the start.** Adding it mid-Phase-6 was fine technically, but the adapter interface change rippled through the sync engine tests (new `edges_attached` field on `SyncResult`). If edges had been in the original spec, the interface would have been right from Phase 5.

2. **Would have built a `graph_capture` MCP tool in Phase 8.** The wrapper exists but the agent can't call it. The skills say "use graph_capture when available" but that tool was never registered. Phase 8 added `graph_sync`, `graph_rebuild`, `graph_status` but missed `graph_capture`. This means dual-write only works when called programmatically, not from skill-triggered agent captures.

3. **Would have batched `git hash-object` calls.** 73 seconds for first sync is acceptable but unnecessary. `git hash-object --stdin-paths` can hash all 118 files in one subprocess call. Didn't optimize because the spec said "acceptable for v1" — but it's low-hanging fruit.

## Insights Worth Carrying Forward

- The anchor-overlay pattern generalizes. The architecture is domain-agnostic by design — the whitepaper's argument held up during implementation. Adding a new data source means writing one adapter, not touching the engine.
- Event logs as canonical source with disposable runtimes is a powerful testing primitive. You can seed arbitrary state, replay deterministically, and verify end-state — no mocking infrastructure.
- Pulling docs forward (before the plan is complete) forces architectural clarity and is worth the schedule disruption.
- Skills that reference MCP tools should be updated atomically with the tool registration. "Use X when available" is a code smell in skill instructions.
