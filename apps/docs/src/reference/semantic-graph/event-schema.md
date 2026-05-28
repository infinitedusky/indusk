# Event Schema

The semantic graph event log (`.indusk/graph/semantic-graph.log`) is an append-only JSONL file where every mutation of the semantic graph is a single line. Six event types cover the full lifecycle of anchors and edges.

All events carry two common fields:

| Field | Type | Description |
|---|---|---|
| `change_id` | string | The jj change ID active when this event was written. Used by the replay engine for ancestry filtering. |
| `ts` | string | ISO-8601 timestamp when the event was appended. |

## `anchor.created`

Emitted by the sync pipeline when a new file or symbol is observed in the adapter source (e.g. CGC) for the first time, or when a tombstoned anchor is re-created.

| Field | Type | Description |
|---|---|---|
| `type` | `"anchor.created"` | |
| `uuid` | string | Fresh UUID for the new anchor. |
| `kind` | `"file"` \| `"function"` \| `"class"` \| `"interface"` | Anchor category. |
| `path` | string | Repo-relative path to the file. |
| `name` | string? | Symbol name (omitted for file anchors). |
| `parent_uuid` | string? | Parent file anchor UUID (present for symbols). |
| `blob_hash` | string? | Git blob hash at creation (files only). |
| `adapter` | string | Adapter name that produced this record (e.g. `"cgc"`). |

```json
{"type":"anchor.created","uuid":"7b3c9f12","kind":"file","path":"src/foo.ts","blob_hash":"abc123","adapter":"cgc","change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## `anchor.moved`

Emitted when the sync pipeline detects that an existing anchor's file has been renamed or moved. The anchor's UUID is unchanged; only its path descriptor updates. All edges attached to the anchor ride along.

| Field | Type | Description |
|---|---|---|
| `type` | `"anchor.moved"` | |
| `uuid` | string | UUID of the existing anchor. |
| `from_path` | string | Old path (for audit). |
| `to_path` | string | New path. |
| `blob_hash` | string? | Current blob hash (may have changed during the move). |

```json
{"type":"anchor.moved","uuid":"7b3c9f12","from_path":"src/foo.ts","to_path":"lib/foo.ts","blob_hash":"abc123","change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## `anchor.tombstoned`

Emitted when an anchor's underlying source record has been deleted. The anchor is marked `status: deleted` in the runtime graph but **not removed** — edges attached to it are preserved. This is how "the memory of the dead branch" is retained across refactors.

| Field | Type | Description |
|---|---|---|
| `type` | `"anchor.tombstoned"` | |
| `uuid` | string | UUID of the anchor to tombstone. |

```json
{"type":"anchor.tombstoned","uuid":"7b3c9f12","change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## `edge.attached`

Emitted by the Graphiti capture wrapper (and future adapters) when a piece of overlay context is attached to an anchor. The `target_uuid` references the anchor; the `source_uuid` references the overlay node (e.g. a Graphiti episode or entity).

| Field | Type | Description |
|---|---|---|
| `type` | `"edge.attached"` | |
| `edge_uuid` | string | Fresh UUID for the edge. |
| `source_uuid` | string | UUID of the overlay node (e.g. a Graphiti episode id). |
| `target_uuid` | string | UUID of the anchor the edge attaches to. |
| `relation` | string | Edge semantics: `"describes"`, `"explains"`, `"governs"`, `"violates"`, etc. |
| `payload` | object | Opaque metadata (summary, captured commit, tags). |

```json
{"type":"edge.attached","edge_uuid":"e1","source_uuid":"episode-42","target_uuid":"7b3c9f12","relation":"describes","payload":{"summary":"ADR on settlement flow"},"change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## `edge.invalidated`

Emitted when an edge is superseded by new information or detected as stale. The edge is not deleted — its `invalidated_at` timestamp is set, preserving history for retrospective queries.

| Field | Type | Description |
|---|---|---|
| `type` | `"edge.invalidated"` | |
| `edge_uuid` | string | UUID of the edge to invalidate. |
| `reason` | string | Why: `"superseded by ADR-42"`, `"contradicts current code"`, etc. |

```json
{"type":"edge.invalidated","edge_uuid":"e1","reason":"superseded by ADR-42","change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## `sync.completed`

Emitted at the end of every sync run as a bookmark — not a graph mutation. Replay ignores these for graph state but tooling uses them to report sync history and delta counts.

| Field | Type | Description |
|---|---|---|
| `type` | `"sync.completed"` | |
| `adapter` | string | Adapter that ran (e.g. `"cgc"`). |
| `deltas` | object | `{ created, moved, tombstoned }` counts. |
| `duration_ms` | number | Wall time of the sync run in milliseconds. |

```json
{"type":"sync.completed","adapter":"cgc","deltas":{"created":3,"moved":1,"tombstoned":0},"duration_ms":420,"change_id":"ulqxwpkwmvsr","ts":"2026-04-08T12:00:00.000Z"}
```

## Parsing and serialization

Event types are defined in [`apps/indusk-mcp/src/lib/semantic-graph/events.ts`](../../../../apps/indusk-mcp/src/lib/semantic-graph/events.ts) as a Zod discriminated union. `parseEvent(line)` validates and narrows; `serializeEvent(event)` produces a single JSONL line with no embedded newlines. The log reader uses `parseEvent` per line and surfaces parse failures through an `onMalformed` callback so replay can skip and log rather than abort mid-file.
