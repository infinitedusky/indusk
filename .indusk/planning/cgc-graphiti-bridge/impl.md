---
title: "Semantic Graph Bridge"
date: 2026-04-08
status: in-progress
gate_policy: ask
---

# Semantic Graph Bridge

## Goal

Build the semantic graph bridge described in `adr.md`: an event-sourced projection of CGC structural data and Graphiti-captured knowledge into a per-project semantic graph, versioned by jj change IDs, stored as an append-only log, and projected into a FalkorDB runtime. When this plan is done, every file and symbol in infinitedusky and chitin-sportsbook has a persistent anchor in the semantic graph, Graphiti captures flow into the log automatically, and the runtime is rebuildable from the log at any time.

## Scope

### In Scope
- Generic event-sourced sync engine (adapter-agnostic)
- CGC adapter (first implementation of the adapter interface)
- Event log writer and replay engine
- FalkorDB runtime with `semantic-{project}` graph name
- Jj change ID resolution and ancestry filter
- Log-writer wrapper around Graphiti captures
- Phase-boundary sync trigger in the work skill
- MCP tools + CLI (`graph_sync`, `graph_rebuild`, `graph_status`)
- `--local` mode compatibility (no special handling needed, inherits exclusion)
- Smoke tests on infinitedusky and chitin-sportsbook

### Out of Scope
- Query layer (`context-beam`, `describe_file`) — separate plan
- Kuzu migration — future plan
- Log compaction — future plan
- Team-shared semantic graphs — future plan
- Refactor-test, lint, Dash0 projections — downstream plans
- Git-only fallback (non-jj projects) — future plan
- Patching `context-graph/brief.md` — follow-up

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1: Event schema & log I/O | `semantic-graph/events.ts`, `paths.ts`, `log-writer.ts`, `log-reader.ts`, unit tests | `config.ts`, node `fs`/`path` |
| Phase 2: Jj integration | `jj.ts` (change ID + ancestry), unit tests | child_process, Phase 1 paths |
| Phase 3: FalkorDB runtime client | `runtime-client.ts`, integration test | `indusk-infra` FalkorDB, Phase 1 events |
| Phase 4: Replay engine | `replay.ts`, integration tests | Phases 1-3 |
| Phase 5: Generic sync engine + adapter interface | `adapter.ts`, `sync-engine.ts`, unit tests with fake adapter | Phases 1-2 |
| Phase 6: CGC adapter | `adapters/cgc.ts`, integration test against cgc-infinitedusky | Phase 5 interface, FalkorDB, `git hash-object` |
| Phase 7: Graphiti capture wrapper | `graphiti-log-wrapper.ts`, skill updates | Phase 1 events, `GraphitiClient` |
| Phase 8: MCP tools + CLI | `tools/graph-*.ts`, `cli/graph.ts`, unit tests | Phases 1-7 |
| Phase 9: Init plumbing + work skill gate + smoke tests | `init --local` handling verified, work skill gate, smoke test results | Phase 8 |

## Checklist

### Phase 1: Event schema and log I/O

- [x] Create `apps/indusk-mcp/src/lib/semantic-graph/` with `index.ts` barrel export
- [x] Define event types in `events.ts` as a discriminated union:
  ```typescript
  type AnchorKind = "file" | "function" | "class" | "interface";
  export type SemanticGraphEvent =
    | { type: "anchor.created"; uuid: string; kind: AnchorKind; path: string; name?: string; parent_uuid?: string; blob_hash?: string; adapter: string; change_id: string; ts: string }
    | { type: "anchor.moved"; uuid: string; from_path: string; to_path: string; blob_hash?: string; change_id: string; ts: string }
    | { type: "anchor.tombstoned"; uuid: string; change_id: string; ts: string }
    | { type: "edge.attached"; edge_uuid: string; source_uuid: string; target_uuid: string; relation: string; payload: Record<string, unknown>; change_id: string; ts: string }
    | { type: "edge.invalidated"; edge_uuid: string; reason: string; change_id: string; ts: string }
    | { type: "sync.completed"; adapter: string; deltas: { created: number; moved: number; tombstoned: number }; duration_ms: number; change_id: string; ts: string };
  ```
- [x] Write validators (zod or hand-rolled) for each event variant
- [x] Implement `paths.ts` with `getLogPath(projectRoot: string): string` returning `{projectRoot}/.indusk/graph/semantic-graph.log`
- [x] Implement `log-writer.ts` with a `LogWriter` class: `append(event)`, ensures directory exists, serializes to jsonl with fsync, documents single-writer assumption
- [x] Implement `log-reader.ts` as a streaming reader that yields validated events and logs-and-skips malformed lines
- [x] Unit tests covering: write/read roundtrip per event type, malformed line handling, empty file, missing directory creation

#### Phase 1 Verification
- [x] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/` passes with ≥ 12 tests (19 passing)
- [x] `pnpm check --filter=indusk-mcp` passes (no Biome violations)
- [x] Manual: roundtrip test (covered by log-reader.test.ts "roundtrips events written by LogWriter" — 3-event roundtrip verified)

#### Phase 1 Context
- [x] Add to CLAUDE.md Known Gotchas: "Semantic graph event log is append-only jsonl at `.indusk/graph/semantic-graph.log` — never edited in place, never rewritten. Malformed lines are skipped on replay with a warning."

#### Phase 1 Document
- [x] Create `apps/indusk-docs/src/reference/semantic-graph/event-schema.md` documenting the six event types with field tables and one JSON example each

---

### Phase 2: Jj integration

- [x] Implement `jj.ts`:
  - `getCurrentChangeId(cwd: string): Promise<string>` — runs `jj log -r @ --no-graph --template 'change_id'`
  - `getReachableChangeIds(cwd: string): Promise<Set<string>>` — runs `jj log -r '::@' --no-graph --template 'change_id ++ "\n"'`, returns ancestor set
  - `isChangeReachable(changeId: string, reachable: Set<string>): boolean`
- [x] Handle "jj not available" case: typed `NotAJjRepoError` thrown when `jj` is missing or cwd is not a jj repo
- [x] Unit tests with mocked child_process covering: normal case, empty repo, not a jj repo, malformed output

#### Phase 2 Verification
- [x] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/jj` passes (11 tests)
- [x] Manual: smoke-tested against real jj in infinitedusky — current change id `lrowmounwpxnmortzuyumsomuprkrspv`, reachable ancestry set of 86 change ids, current is in reachable ✓

#### Phase 2 Context
- [x] Add to CLAUDE.md Known Gotchas: "Semantic graph bridge requires jj — projects without jj cannot use it in v1. If `jj` is missing or the cwd is not a jj repo, sync fails with `NotAJjRepoError` explicitly rather than silently degrading."

#### Phase 2 Document
- [x] Create `apps/indusk-docs/src/reference/semantic-graph/jj-dependency.md` explaining why jj is required (stable change IDs across rebase/amend), what breaks without it, and the future git-only fallback path

---

### Phase 3: FalkorDB runtime client

- [x] Check for existing FalkorDB client in `apps/indusk-mcp/src/lib/`; extend or install `falkordb` npm package (installed `falkordb@^6.6.2`)
- [x] Implement `runtime-client.ts`:
  - `SemanticGraphClient` class with constructor `(projectName: string)`, derives graph name `semantic-{projectName}`
  - `ensureConnection()` — connects to FalkorDB at `localhost:6379` (the `indusk-infra` container)
  - `applyEvent(event)` — translates each event type to Cypher:
    - `anchor.created` → `MERGE (a:Anchor {uuid: $uuid}) SET a += $props`
    - `anchor.moved` → `MATCH (a:Anchor {uuid: $uuid}) SET a.path = $to_path, a.blob_hash = $blob_hash`
    - `anchor.tombstoned` → `MATCH (a:Anchor {uuid: $uuid}) SET a.status = 'deleted', a.tombstoned_at = $ts`
    - `edge.attached` → `MATCH (a:Anchor {uuid: $target_uuid}) MERGE (e:Edge {uuid: $edge_uuid}) MERGE (e)-[:ATTACHED_TO]->(a) SET e += $props`
    - `edge.invalidated` → `MATCH (e:Edge {uuid: $edge_uuid}) SET e.invalidated_at = $ts, e.invalidation_reason = $reason`
    - `sync.completed` → log-only, no graph write
  - `clearGraph()` — deletes the `semantic-{projectName}` graph
  - `getAnchor(uuid)`, `countAnchors()`, `countEdges()` helpers
- [x] Integration test against running `indusk-infra`: create/move/tombstone anchor, attach edge, verify each via direct Cypher read
- [x] Skip integration test cleanly when `indusk-infra` is not running (via `describeIfFalkor` probe)

#### Phase 3 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/runtime-client` passes when indusk-infra is running
- [ ] Manual: `redis-cli -h localhost -p 6379 GRAPH.QUERY semantic-infinitedusky "MATCH (a:Anchor) RETURN count(a)"` returns 0 before any sync

#### Phase 3 Context
- [ ] Add to CLAUDE.md Architecture: "FalkorDB holds two graph namespaces per project: `cgc-{project}` (CGC's structural index) and `semantic-{project}` (the semantic graph with anchors and overlay edges). Both live in the same `indusk-infra` container but are independent."

#### Phase 3 Document
- [x] Add `apps/indusk-docs/src/reference/semantic-graph/runtime-graph.md` explaining the graph naming convention and the `semantic-{project}` schema

---

### Phase 4: Replay engine

- [ ] Implement `replay.ts` with `replay(logPath, client, options?: { ancestryFilter?: Set<string> })`:
  - Reads events from log in order
  - If `ancestryFilter` provided, skips events whose `change_id` is not in the set
  - Applies each kept event to the runtime client
  - Returns `{ total, applied, skipped, errors }`
  - Malformed events counted as errors and logged; replay continues
- [ ] Integration test: seed a log with 10 events (mix of anchor and edge types), clear runtime, replay, verify end state matches expected
- [ ] Ancestry filter test: seed 10 events with mixed change IDs, replay with partial reachable set, verify only reachable events applied

#### Phase 4 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/replay` passes
- [ ] Manual: create test log with 5 events, clear semantic-test graph, run replay, check via Cypher that all 5 events are reflected

#### Phase 4 Context
- [ ] Add to CLAUDE.md Conventions: "`indusk graph rebuild` is safe to run at any time — the FalkorDB runtime is disposable and reconstructs deterministically from the log. No data is stored exclusively in the runtime."

#### Phase 4 Document
- [ ] Add a "Rebuild and Replay" section to the semantic-graph docs explaining that the runtime graph is disposable and rebuildable from the log

---

### Phase 5: Generic sync engine + adapter interface

- [ ] Define `adapter.ts`:
  ```typescript
  export interface SemanticGraphAdapter {
    readonly name: string;
    snapshot(projectRoot: string): Promise<AdapterRecord[]>;
    identify(record: AdapterRecord): string;
    contentFingerprint(record: AdapterRecord): string | undefined;
  }
  export type AdapterRecord = {
    kind: AnchorKind;
    path: string;
    name?: string;
    parent_identity?: string;
    metadata?: Record<string, unknown>;
  };
  ```
- [ ] Implement `sync-engine.ts` with `runSync(adapter, projectRoot, logWriter, runtimeClient)`:
  1. `adapter.snapshot(projectRoot)` → current records
  2. Read existing anchors from runtime (excluding tombstoned)
  3. Diff current vs existing via `adapter.identify`, falling back to `contentFingerprint` match for rename detection
  4. Unmatched existing anchors → tombstone
  5. Generate events tagged with current jj change ID
  6. Write each event to log AND apply to runtime
  7. Emit `sync.completed` event
- [ ] Unit tests with a fake in-memory adapter covering: fresh sync, no-op, pure rename, delete, mixed delta. **These tests are the enforcement mechanism for adapter genericity — they must not import anything CGC-related.**

#### Phase 5 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/sync-engine` passes
- [ ] Manual: build a fake adapter returning 3 file records, run sync twice, second run produces 0 deltas
- [ ] Grep `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` for "cgc" — should return zero matches (case-insensitive). Same for `adapter.ts`.

#### Phase 5 Context
- [ ] Add to CLAUDE.md Conventions: "The semantic graph sync pipeline is adapter-agnostic by design (see `.indusk/research/anchor-overlay-pattern.md` Section 7). CGC is the first adapter; adding a new adapter means implementing `SemanticGraphAdapter` — the sync engine itself never changes. Enforced by sync-engine tests, which cannot import anything CGC-related."

#### Phase 5 Document
- [ ] Create `apps/indusk-docs/src/reference/semantic-graph/adapter-interface.md` documenting the interface with the fake in-memory adapter as the worked example

---

### Phase 6: CGC adapter

- [ ] Implement `adapters/cgc.ts`:
  - `snapshot(projectRoot)`:
    - Connect to `cgc-{basename(projectRoot)}` FalkorDB graph
    - Query all `File` nodes → file records with path and `git hash-object {path}` as `metadata.blob_hash`
    - Query `Function`, `Class`, `Interface` nodes → symbol records with `name` and `parent_identity` (file path)
  - `identify(record)`:
    - File → `file::{path}`
    - Symbol → `{kind}::{parent_identity}::{name}`
  - `contentFingerprint(record)`:
    - File → `metadata.blob_hash`
    - Symbol → `undefined` (v1)
- [ ] Integration test against real `cgc-infinitedusky` graph: run sync, count anchors, verify against direct CGC queries for files + functions + classes + interfaces

#### Phase 6 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/cgc-adapter` integration test passes
- [ ] Manual: `runSync(cgcAdapter, '/Users/the_dusky/code/sandbox/infinitedusky', ...)` creates ~20k anchors, log file has ~20k+ events, `sync.completed` event at the end with matching delta counts

#### Phase 6 Context
- [ ] Add to CLAUDE.md Known Gotchas: "CGC adapter reads from `cgc-{basename}` graph, writes to `semantic-{basename}` graph. Different graph namespaces, same FalkorDB instance. Don't mix them up in manual Cypher."

#### Phase 6 Document
- [ ] Create `apps/indusk-docs/src/reference/semantic-graph/cgc-adapter.md` explaining how the CGC adapter maps CGC nodes to anchor records

---

### Phase 7: Graphiti capture wrapper

- [ ] Implement `graphiti-log-wrapper.ts`:
  - Wraps calls to `mcp__graphiti__add_memory` via `GraphitiClient`
  - After a successful Graphiti write, appends an `edge.attached` event to the log
  - Resolves `target_uuid` from a file path referenced in the capture (if any); if no path reference, attaches to a synthetic project-root anchor with a warning
- [ ] Update planner skill's brief/ADR capture triggers to route through the wrapper
- [ ] Update work skill's correction capture to route through the wrapper
- [ ] Update retrospective skill's lesson capture to route through the wrapper
- [ ] Unit test with fake GraphitiClient and fake log writer

#### Phase 7 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- semantic-graph/graphiti-wrapper` passes
- [ ] Manual: trigger a planner brief acceptance on a throwaway test plan; log gains an `edge.attached` event alongside the normal Graphiti episode

#### Phase 7 Context
- [ ] Update CLAUDE.md Key Decisions: append to the existing semantic-graph-bridge line: "Graphiti captures flow through a log-writer wrapper that mirrors every Graphiti write as an `edge.attached` event in the semantic graph log."

#### Phase 7 Document
- [ ] Add `apps/indusk-docs/src/reference/semantic-graph/capture-flow.md` showing the dual-write: Graphiti extraction + semantic graph log append

---

### Phase 8: MCP tools and CLI

- [ ] Add MCP tools in `apps/indusk-mcp/src/tools/`:
  - `graph_sync` — runs CGC adapter sync, returns delta counts
  - `graph_rebuild` — clears `semantic-{project}` runtime, replays log, returns counts
  - `graph_status` — log path, event count, current change ID, last sync time, anchor/edge counts
- [ ] Register the tools in the MCP server entrypoint
- [ ] Add CLI commands mirroring the tools: `indusk graph sync`, `indusk graph rebuild`, `indusk graph status`
- [ ] Unit tests for each tool with mocked dependencies

#### Phase 8 Verification
- [ ] `pnpm turbo test --filter=indusk-mcp -- tools/graph-` passes
- [ ] Manual: `indusk graph status` in infinitedusky shows log path, event count, runtime anchor count
- [ ] Manual: `indusk graph rebuild` clears and rebuilds the runtime; final anchor count matches pre-rebuild count

#### Phase 8 Context
- [ ] Add to CLAUDE.md Conventions: "Use `indusk graph sync` to manually sync the semantic graph; `indusk graph rebuild` to clear and replay the runtime; `indusk graph status` for diagnostics."

#### Phase 8 Document
- [ ] Create `apps/indusk-docs/src/reference/semantic-graph/cli.md` documenting all three commands with example output

---

### Phase 9: Init plumbing, work skill gate, smoke tests

- [ ] Verify `indusk init` (normal mode) does **not** add `.indusk/graph/` to `.gitignore` — the log is a normal file in normal mode, visibility is the developer's choice
- [ ] Verify `indusk init --local` inherits the existing `.git/info/exclude` entry for `.indusk/` with no additional handling for the graph directory
- [ ] Add a test that `init --local` on a fresh repo leaves the semantic graph log invisible to `git status`
- [ ] Update the work skill's phase-end gate runner to call `graph_sync` after verify/context/document gates succeed, for projects where the semantic graph is enabled (v1: always enabled when `.indusk/` exists)
- [ ] Smoke test on infinitedusky:
  - `indusk graph sync` from clean state
  - Log file exists, has > 100 events
  - Runtime graph has > 100 anchors
  - Make a throwaway file change, re-run sync
  - Delta reflected in log and runtime
- [ ] Smoke test on chitin-sportsbook:
  - `indusk graph sync` from chitin-sportsbook directory
  - `semantic-chitin_sportsbook` graph populated (hyphen sanitization inherited)
  - No interference with `semantic-infinitedusky`

#### Phase 9 Verification
- [ ] Full test suite passes: `pnpm turbo test --filter=indusk-mcp`
- [ ] `pnpm check` passes
- [ ] Both smoke tests complete without errors
- [ ] `indusk init --local` on a throwaway repo leaves the log invisible to `git status`

#### Phase 9 Context
- [ ] Update CLAUDE.md Current State: add a line saying the semantic graph bridge is live, anchors exist for infinitedusky and chitin-sportsbook, sync runs at phase boundaries automatically
- [ ] Update CLAUDE.md Architecture: add `.indusk/graph/` to the directory tree with the note "runtime log, not gitignored by default in normal mode; inherits `.indusk/` exclusion in --local mode"

#### Phase 9 Document
- [ ] Write `apps/indusk-docs/src/reference/semantic-graph/overview.md` as the landing page tying together event schema, sync pipeline, adapter interface, capture flow, CLI, rebuild/replay
- [ ] Add Mermaid architecture diagram to the overview: CGC + capture triggers → event log → replay → FalkorDB runtime → (future) query layer
- [ ] Update `apps/indusk-docs/src/.vitepress/config.ts` sidebar with the new `reference/semantic-graph/` section
- [ ] Add changelog entry: "Added semantic graph bridge: per-project event-sourced projection of CGC structure and Graphiti knowledge, versioned via jj change IDs"

---

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/semantic-graph/events.ts` | new — event type definitions and validators |
| `apps/indusk-mcp/src/lib/semantic-graph/paths.ts` | new — log file path resolution |
| `apps/indusk-mcp/src/lib/semantic-graph/log-writer.ts` | new — append-only jsonl writer |
| `apps/indusk-mcp/src/lib/semantic-graph/log-reader.ts` | new — streaming reader with validation |
| `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` | new — jj change ID and ancestry |
| `apps/indusk-mcp/src/lib/semantic-graph/runtime-client.ts` | new — FalkorDB client for semantic graph |
| `apps/indusk-mcp/src/lib/semantic-graph/replay.ts` | new — log replay engine |
| `apps/indusk-mcp/src/lib/semantic-graph/adapter.ts` | new — adapter interface |
| `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` | new — generic sync engine |
| `apps/indusk-mcp/src/lib/semantic-graph/adapters/cgc.ts` | new — CGC adapter |
| `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts` | new — Graphiti capture wrapper |
| `apps/indusk-mcp/src/tools/graph-sync.ts` | new — MCP tool |
| `apps/indusk-mcp/src/tools/graph-rebuild.ts` | new — MCP tool |
| `apps/indusk-mcp/src/tools/graph-status.ts` | new — MCP tool |
| `apps/indusk-mcp/src/cli/graph.ts` | new — CLI command surface |
| `apps/indusk-mcp/skills/planner/SKILL.md` | modify — route brief/ADR capture through wrapper |
| `apps/indusk-mcp/skills/work/SKILL.md` | modify — route correction capture through wrapper, add phase-end sync gate |
| `apps/indusk-mcp/skills/retrospective/SKILL.md` | modify — route lesson capture through wrapper |
| `CLAUDE.md` | modify — context updates per phase |
| `apps/indusk-docs/src/reference/semantic-graph/*.md` | new — full documentation section |
| `apps/indusk-docs/src/.vitepress/config.ts` | modify — sidebar entries |

## Dependencies

- `graphiti-infrastructure` (completed) — Graphiti runtime and capture triggers
- `indusk-infra` container running — source and destination FalkorDB
- CGC indexing current for infinitedusky and chitin-sportsbook
- jj installed and in use in both test projects

## Notes

- **Adapter genericity is enforced by tests**, not just documentation. The sync engine tests use a fake in-memory adapter; if CGC-specific assumptions creep into the engine, those tests fail. Phase 5 verification includes a grep check that `sync-engine.ts` and `adapter.ts` contain zero mentions of "cgc".
- **No OTel sections** — infinitedusky/indusk-mcp has `otel.role: library` in `.indusk/config.json`, so OTel gates are suppressed per the role-aware gate system.
- **Rebuild is not idempotent across manual edits** — if the runtime has manually-added data not in the log, rebuild drops it. v1 accepts this; the runtime is explicitly disposable.
- **First-sync bootstrap cost** — full sync of infinitedusky produces ~20k events. Acceptable for v1; compaction is a future plan.
- **Symbol identity rules** — in v1, a function that changes signature but keeps its name is the same anchor. Rename + move is a new anchor; the old one tombstones.
- **Concurrency** — v1 assumes a single writer at a time. Phase boundaries serialize sync; overlay captures run sequentially in skill execution. File locking or Redis stream swap is the mitigation path if this breaks.
- **Jj dependency is strict** — if a project doesn't use jj, this system doesn't work. Future git-only fallback is out of scope for v1.
- **Init mode visibility** — normal mode leaves the log file as an ordinary file (developer decides whether to commit). `--local` mode inherits the existing `.git/info/exclude` entry for `.indusk/` and needs no special handling.
