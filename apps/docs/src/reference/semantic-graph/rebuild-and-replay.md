# Rebuild and Replay

The semantic graph runtime in FalkorDB is **disposable**. It's a projection of the event log, not a source of truth, and it can be rebuilt from scratch at any time without data loss.

## Why this matters

Event sourcing inverts the usual "fix the database" reflex. When something goes wrong with the runtime graph — corrupted state, partial sync, schema drift, container rebuild, switching engines — the answer is always the same: **clear the runtime and replay the log**. There's no migration step, no recovery procedure, no "hopefully the data is still intact" moment. The runtime is always allowed to be wrong because the log is always right.

## The replay function

The engine lives at [`apps/indusk-mcp/src/lib/semantic-graph/replay.ts`](../../../../apps/indusk-mcp/src/lib/semantic-graph/replay.ts):

```typescript
async function replay(
  logPath: string,
  client: SemanticGraphClient,
  options?: ReplayOptions,
): Promise<ReplayResult>;

interface ReplayOptions {
  ancestryFilter?: Set<string>;
  onError?: (error: Error, lineNumber: number) => void;
  onMalformed?: (line: string, error: Error, lineNumber: number) => void;
}

interface ReplayResult {
  total: number;   // events observed in the log
  applied: number; // successfully applied to the runtime
  skipped: number; // excluded by ancestry filter
  errors: number;  // malformed lines + application failures
}
```

It streams events from the log one at a time through the `LogReader`, optionally filters by jj ancestry, and calls `client.applyEvent()` on each surviving event. Malformed lines are swallowed via the reader's `onMalformed` callback and counted as errors — replay never aborts mid-file.

## The rebuild pattern

To fully reconstruct the runtime graph:

```typescript
import {
  replay,
  SemanticGraphClient,
  getLogPath,
  getReachableChangeIds,
} from "@infinitedusky/indusk-mcp/semantic-graph";

const projectRoot = process.cwd();
const client = new SemanticGraphClient("dusk");
await client.ensureConnection();

// 1. Wipe the runtime
await client.clearGraph();

// 2. Reopen a fresh graph handle (FalkorDB requires this after delete)
await client.close();
const rebuilt = new SemanticGraphClient("dusk");
await rebuilt.ensureConnection();

// 3. Replay the log with ancestry filtering
const ancestryFilter = await getReachableChangeIds(projectRoot);
const result = await replay(getLogPath(projectRoot), rebuilt, { ancestryFilter });

console.log(`Rebuilt: ${result.applied} events applied, ${result.skipped} skipped, ${result.errors} errors`);
```

Clearing the runtime is cheap (one Cypher `GRAPH.DELETE` call). Replay cost scales with log length: ~20 μs per event on a warm FalkorDB, so a 100k-event log rebuilds in a couple of seconds.

## Ancestry filtering (historical — jj-only)

> **Historical reference.** This section describes the original jj-based ancestry filtering design. As of 1.31.0 ([`git-only-substrate`](/decisions/git-only-substrate)), the semantic graph is git-only and rebase tolerance comes via content-keyed dedup at sync time (`(path, blob_hash)` lookup) rather than ancestry-set replay filtering. Events whose underlying content matches a previous event get tombstoned by the runtime's identity matching on the next sync; the system converges to current file state after one cycle. The content below is preserved as a time-stamped record of the original design.


The `ancestryFilter` option is the bridge between the event log and jj's version control. Every event carries a `change_id` field; `getReachableChangeIds(projectRoot)` returns the set of jj change IDs that are ancestors of the current HEAD (`::@` in jj revset terms). Events whose `change_id` isn't in that set are skipped during replay.

The effect: **switching branches in jj changes which events get replayed**, without any graph surgery. Rebase, amend, split, and abandon all work automatically because jj change IDs are stable across those operations.

| jj operation | Effect on replay |
|---|---|
| `jj new` (new empty change) | New events tagged with new change ID, old ancestry still reachable |
| `jj describe` (edit description) | No effect — change ID stable |
| `jj rebase` | No effect — change IDs preserved across rebase |
| `jj abandon` | Abandoned change's events become unreachable and drop out of replay |
| Branch to feature, commit, sync | New events tagged with branch's change ID, visible only on that branch |
| Merge branch to main | Merge commit's ancestry now includes branch events, visible on main |

No explicit promotion step is needed — merging the branch in jj automatically makes the branch's events visible in main's replay, because they become reachable from main's HEAD.

## Partial replay for catch-up

If you don't want a full rebuild — for example, the runtime is already in a valid state and you just want to apply any events appended since the last run — skip the `clearGraph()` call and rely on the applyEvent Cypher's idempotency:

```typescript
// Incremental catch-up (no clear)
const result = await replay(getLogPath(projectRoot), client, { ancestryFilter });
```

Because `anchor.created` uses `MERGE` and every other event type is `MATCH`-based, re-applying an already-applied event is a no-op. Safe, but slower than the full rebuild for large logs because every event still gets processed.

For v1 we recommend full rebuild — it's fast enough and has simpler semantics. Incremental catch-up is a future optimization once log length becomes a bottleneck.

## Error handling

Replay never throws on bad data. Three failure modes are all handled inline:

1. **Malformed log lines** (bad JSON, missing fields, schema mismatch) — surfaced through `options.onMalformed`, counted in `result.errors`. Replay continues past them.
2. **Event application failures** (Cypher errors, graph constraint violations, connection drops mid-event) — surfaced through `options.onError`, counted in `result.errors`. Replay continues to the next event.
3. **Missing log file** — returns `{ total: 0, applied: 0, skipped: 0, errors: 0 }`. Fresh projects start with an empty log.

The philosophy: **rebuild should never refuse to run**. If some events fail, the result object tells you how many and which line numbers, but you still get a runtime graph that reflects everything that *did* apply. You can then investigate the errors and decide what to do — edit the log, ignore them, or report a bug.

## CLI

Once Phase 8 of the bridge plan lands, you'll be able to run:

```bash
indusk graph rebuild    # clear runtime + replay log
indusk graph status     # log size, last change ID, runtime anchor count
indusk graph sync       # run the CGC adapter sync, append events, apply to runtime
```

Until then, use the library directly from a tsx script or an MCP tool call.
