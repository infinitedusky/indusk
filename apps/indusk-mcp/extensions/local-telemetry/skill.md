---
name: local-telemetry
description: Local OTel telemetry daemon + MCP tool surface for fast dev-time diagnosis. Query recent spans, full traces, service list, and structured logs from just-now-happened activity — no cloud round-trip, no re-run with verbose logging.
type: extension
---

# Local Telemetry

## What you have

A machine-global daemon running Jaeger (traces) + OTel Collector core (logs) on localhost. Every project with this extension enabled registers with the daemon; the daemon auto-starts on the first enable and gracefully stops when the last project disables. You — the working agent — access the daemon's data via four MCP tools.

- **Trace query**: `get_recent_spans(service?, status?, sinceMs?, limit?)` — list recent spans matching filters. Default: last 5 min, any status, any service.
- **Full trace**: `get_trace(traceId)` — the complete span tree for one trace, including parent/child relationships + attributes + events.
- **Service list**: `get_services()` — which services have emitted telemetry recently. Useful when you're not sure what's been running.
- **Log tail**: `tail_logs(service?, level?, sinceMs?, limit?)` — recent log records from the SQLite-backed sink, filtered by service + level + time.

(Phase 5 lands these tools. Before Phase 5 ships, use the CLI equivalents: `indusk telemetry tail/trace/services` from a terminal.)

## When to use

Use these tools whenever the user says something like:
- "I just ran X. Why did it fail?"
- "This test passed locally but broke when I tried it through the UI."
- "The API returned a weird shape — what did the server actually do?"
- "I see an error — what happened right before it?"

Do NOT use these tools when:
- The failure is already explained by an assertion message, stack trace, or error log the user already pasted. You don't need telemetry when the evidence is in front of you.
- The question is about historical (> 1 hour) or production behavior — that's Dash0's job, not this daemon's. Local telemetry has a short-retention buffer; anything older is gone.
- The question is about metrics or dashboards. This daemon doesn't do metrics in v1.

## Diagnosis patterns

**Pattern 1: "What just failed?"**

```
1. get_recent_spans({ status: "error", sinceMs: 5 * 60_000, limit: 20 })
2. If error spans present: get_trace(spans[0].traceId) for the full context.
3. Call out in chat: "The error came from service X, operation Y, attribute Z = …."
```

**Pattern 2: "Why was this slow?"**

```
1. get_recent_spans({ service: "suspected-service", sinceMs: 60_000, limit: 50 })
2. Sort by duration; find the outlier.
3. get_trace(outlier.traceId) — inspect the slowest span + its children.
4. Report the bottleneck + its attributes.
```

**Pattern 3: "Did the server receive my request?"**

```
1. get_recent_spans({ service: "server", sinceMs: 30_000, limit: 100 })
2. Look for a span matching the request's verb + path + attributes.
3. If not present: the request never hit the server (network / routing issue).
4. If present: inspect attributes for the actual handling.
```

**Pattern 4: "What does the log say right around this failure?"**

```
1. Get the trace ID from the failure (from the user, from get_recent_spans, from Jaeger UI).
2. tail_logs({ traceId, sinceMs: 60_000 })
3. Correlate log messages with span timing.
```

## Jaeger UI as the fallback

The MCP tools exist for agent-driven diagnosis. When you want to eyeball a trace visually — e.g., a deep microservice call tree where the attribute lists are too dense for chat — tell the user to open `http://localhost:16686` and paste the trace ID you've identified. Jaeger's built-in Gantt chart shows the structure at-a-glance.

## When it's not running

If `indusk telemetry status` reports not-running, the daemon hasn't started or has crashed. Run `indusk telemetry start` to bring it up (or `indusk telemetry restart` to cycle). Spans emitted while the daemon is down are lost — there's no buffering client-side.

If an MCP tool returns an error about the daemon being unreachable, check `indusk telemetry status` first before trying to diagnose a different problem.

## Environment routing

This extension sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in the dev profile. Staging + prod profiles continue to use Dash0 via the `dash0` extension. A project with both extensions enabled has env-aware routing: `dev` → local daemon, `staging`/`prod` → Dash0.

## Short reference

| Tool | Purpose | Typical call |
|------|---------|--------------|
| `get_recent_spans` | "What errors / spans recently?" | `{ status: "error", sinceMs: 300000 }` |
| `get_trace` | "Full context for this trace ID" | `{ traceId: "abc…" }` |
| `get_services` | "What services are emitting?" | `{}` |
| `tail_logs` | "What did the logs say?" | `{ service: "server", level: "error", sinceMs: 60000 }` |

## See also

- `apps/indusk-docs/src/reference/telemetry/` — CLI + overview docs
- `.indusk/planning/local-telemetry/adr.md` — why this exists
- `dash0` extension — the staging/prod counterpart
