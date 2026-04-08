# Runtime Graph

The semantic graph **runtime** is a disposable FalkorDB projection of the event log. It's a query cache, not a source of truth: rebuild it from the log at any time and you get the same state back.

## Where it lives

The runtime graph lives in the existing `indusk-infra` FalkorDB container alongside CGC's graphs. Each project gets its own isolated graph namespace.

| Graph name | Purpose | Authoritative source |
|---|---|---|
| `cgc-{project}` | CGC's structural code intelligence (file/symbol nodes, imports, calls) | Source code via CGC reindex |
| `semantic-{project}` | Semantic graph: anchors + overlay edges | `.indusk/graph/semantic-graph.log` (event log) |

The two graphs are independent. They share a database engine and are queried via the same Redis socket (`localhost:6379`), but the data is partitioned by graph name.

## Schema

### Node labels

| Label | Description | Key fields |
|---|---|---|
| `Anchor` | A file or symbol projected from an adapter source (CGC for v1) | `uuid`, `kind`, `path`, `name`, `parent_uuid`, `blob_hash`, `adapter`, `status` |
| `Edge` | A piece of overlay context attached to an anchor | `uuid`, `source_uuid`, `target_uuid`, `relation`, `payload` (JSON string), `attached_change_id` |

`Anchor.status` is `active` for anchors whose source still exists and `deleted` for tombstoned anchors. Tombstoned anchors are never removed from the graph — their attached edges survive.

### Relationship types

| Type | From → To | Meaning |
|---|---|---|
| `:ATTACHED_TO` | `Edge` → `Anchor` | The edge attaches its overlay context to this anchor. |

A node can have many `Edge`s attached, and an `Edge` always points at exactly one `Anchor` (`target_uuid`). The `source_uuid` is opaque from the graph's perspective — it references something in the overlay layer (e.g. a Graphiti episode id) and is stored as a property, not a relationship.

### Property semantics

- **`uuid`** (Anchor, Edge): the stable identifier from the event log. Created on first observation, never changes.
- **`status`** (Anchor): `active` or `deleted`. Tombstoning sets `deleted`; the node and its edges are preserved.
- **`*_change_id`** (Anchor, Edge): the jj change ID active when the relevant event was written. Used by the query layer for ancestry filtering.
- **`payload`** (Edge): JSON-stringified opaque metadata from the overlay. The graph doesn't interpret it.

## Lifecycle

The runtime graph has no migration story — you don't preserve it across schema changes. The pattern is always:

1. Apply event log → runtime graph (via `replay`)
2. Query the runtime graph
3. If the runtime is corrupt or out of date: clear it, replay again

Because the log is the source of truth, **the runtime is allowed to be wrong** — any drift between the log and the runtime is fixed by replay. This is the core advantage of event sourcing for this use case: there is no "fix the database" operation, only "rebuild it."

## Per-project isolation

Multiple projects in flight at the same time stay isolated by graph name:

```
indusk-infra container (FalkorDB on :6379)
├── cgc-infinitedusky          ← CGC structural data for infinitedusky
├── cgc-chitin_sportsbook      ← CGC structural data for chitin-sportsbook
├── semantic-infinitedusky     ← Semantic graph for infinitedusky
├── semantic-chitin_sportsbook ← Semantic graph for chitin-sportsbook
└── ... (Graphiti group graphs)
```

The `SemanticGraphClient` constructor takes the bare project name and prepends `semantic-` automatically. There is no risk of cross-project contamination because Cypher queries are always scoped to one graph at a time.

## Implementation

[`apps/indusk-mcp/src/lib/semantic-graph/runtime-client.ts`](../../../../apps/indusk-mcp/src/lib/semantic-graph/runtime-client.ts) implements the client with one method per event type:

- `applyEvent(event)` — translates the event to Cypher and applies it
- `clearGraph()` — deletes the project's `semantic-{name}` graph entirely
- `countAnchors({ includeTombstoned })` / `countEdges()` / `getAnchor(uuid)` — diagnostics for status reports and tests

The client uses the official `falkordb` npm client (`FalkorDB.connect`, `db.selectGraph`, `graph.query`).

> **FalkorDB JS gotcha:** query results return rows as objects keyed by the projection alias, **not positional tuples**. Always write `RETURN a.uuid AS uuid` and read `row.uuid`. Reading `row[0]` will return undefined.
