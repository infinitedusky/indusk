# Adapter Interface

The semantic graph sync engine is adapter-agnostic. It doesn't know what data source it's syncing — it delegates to an adapter that implements a three-method interface.

## The Interface

```typescript
interface SemanticGraphAdapter {
  readonly name: string;
  snapshot(projectRoot: string): Promise<AdapterRecord[]>;
  identify(record: AdapterRecord): string;
  contentFingerprint(record: AdapterRecord): string | undefined;
}

type AdapterRecord = {
  kind: AnchorKind; // "file" | "function" | "class" | "interface"
  path: string;
  name?: string;
  parent_identity?: string;
  metadata?: Record<string, unknown>;
};
```

### `snapshot(projectRoot)`

Returns the full current set of records from the data source. Each record maps to one potential anchor in the semantic graph. The sync engine calls this once per sync cycle.

### `identify(record)`

Returns a stable identity string used to match records across syncs. Two records with the same identity are the same anchor. Convention:

- Files: `file::src/app.ts`
- Symbols: `function::src/app.ts::handleRequest`

### `contentFingerprint(record)`

Returns a content hash for rename detection. If a file disappears by identity but a new file appears with the same fingerprint, the sync engine treats it as a **move** (preserving the anchor UUID) rather than tombstone + create.

Return `undefined` for record types that don't support rename detection (e.g., symbols in v1).

## How the Sync Engine Uses It

```
adapter.snapshot()
  → current records with identities + fingerprints

runtime graph
  → existing active anchors with identities + fingerprints

diff by identity
  → matched: no-op (unchanged)
  → new record, no identity match:
      check fingerprint against unmatched existing anchors
        → fingerprint match: anchor.moved
        → no match: anchor.created
  → existing anchor, no record match: anchor.tombstoned
```

All events are tagged with the current jj change ID and written to both the event log and the FalkorDB runtime.

## Example: Fake In-Memory Adapter

The sync engine's test suite uses a fake adapter — this is also the template for writing new adapters:

```typescript
function createFakeAdapter(records: AdapterRecord[]): SemanticGraphAdapter {
  return {
    name: "fake",
    snapshot: async () => records,
    identify: (record) => {
      if (record.kind === "file") return `file::${record.path}`;
      return `${record.kind}::${record.path}::${record.name ?? ""}`;
    },
    contentFingerprint: (record) => {
      return (record.metadata?.blob_hash as string) ?? undefined;
    },
  };
}
```

## Genericity Constraint

The sync engine and adapter interface must never import or reference any concrete adapter (e.g., CGC). This is enforced by:

1. A grep check in Phase 5 verification: zero matches for "cgc" in `sync-engine.ts` and `adapter.ts`
2. The test suite importing only the fake adapter — if CGC-specific assumptions creep in, these tests break

See [anchor-overlay-pattern.md](../../../../.indusk/research/anchor-overlay-pattern.md) Section 7 for the architectural reasoning.

## Existing Adapters

| Adapter | Source | Records |
|---------|--------|---------|
| CGC | `cgc-{project}` FalkorDB graph | Files, functions, classes, interfaces |

Future adapters could sync calendar events, API endpoints, EHR records, or any structured data source.
