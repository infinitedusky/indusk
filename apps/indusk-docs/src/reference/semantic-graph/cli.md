# CLI & MCP Tools

Three commands for managing the semantic graph, available as both CLI commands and MCP tools.

## `indusk graph sync`

Snapshot CGC structural data, diff against the runtime, and emit events for changes.

```bash
$ indusk graph sync
Syncing semantic graph...
Created: 10156, Moved: 0, Tombstoned: 0, Edges: 155, Unchanged: 0
Duration: 73269ms
```

**MCP tool:** `graph_sync`

First sync creates anchors for every file, function, class, and interface in the CGC index, plus internal import edges. Subsequent syncs only emit events for changes (new files, renames, deletions).

## `indusk graph rebuild`

Clear the FalkorDB runtime and replay the event log from scratch. Always safe — the runtime is disposable.

```bash
$ indusk graph rebuild
Clearing runtime...
Replaying log...
Total: 10312, Applied: 10312, Skipped: 0, Errors: 0
```

**MCP tool:** `graph_rebuild`

Use when:
- The runtime is corrupted or out of sync
- You want to verify the log replays cleanly
- After manually editing the log (don't do this in production)

Post-rebuild counts should match pre-rebuild counts exactly.

## `indusk graph status`

Show semantic graph diagnostics: log stats, last sync time, runtime counts.

```bash
$ indusk graph status
Project: infinitedusky
Log: /Users/the_dusky/code/sandbox/infinitedusky/.indusk/graph/semantic-graph.log
  Events: 10312
  Size: 3365.7KB
  Last sync: 2026-04-09T14:51:24.833Z
Runtime: 10156 anchors, 155 edges
```

**MCP tool:** `graph_status`

The status tool reports:
- **Log path** and whether it exists
- **Event count** and file size
- **Last sync** timestamp and adapter name
- **Runtime** anchor and edge counts (or "FalkorDB not available" if the container is down)
