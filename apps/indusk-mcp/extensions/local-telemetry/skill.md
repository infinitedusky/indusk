---
name: local-telemetry
description: Local OTel telemetry daemon + MCP tool surface for fast dev-time diagnosis. Query recent spans, full traces, service list, and structured logs from just-now-happened activity — no cloud round-trip, no re-run with verbose logging.
type: extension
---

# Local Telemetry

## What you have

A machine-global daemon running Jaeger (traces) + OTel Collector core (logs) on localhost. Every project with this extension enabled registers with the daemon; the daemon auto-starts on the first enable and gracefully stops when the last project disables. `indusk init` scaffolds your app to send here: its spans, named after the project and carrying its project and environment, reach the daemon from the first run. You — the working agent — read the daemon's data through MCP tools.

- **Trace search**: `search_traces(...)` — find traces by service name, span name, attributes, duration, time window or errors (`service_name` is required). Jaeger's own MCP tool, wired in as the `jaeger` server in `.mcp.json`.
- **Span detail**: `get_span_details(...)` — the full attributes and events of the spans you name, from a trace `search_traces` found.
- **Trace shape**: `get_trace_topology(...)` and `get_critical_path(...)` — the parent/child tree and the slowest path through one trace; `get_trace_errors(...)` lists a trace's error spans.
- **Service list**: `get_services()` — which services have emitted telemetry recently. Useful when you're not sure what's been running; `get_span_names(...)` lists a service's operations.
- **Log tail**: `tail_logs({ service, level, since_minutes, limit })` — recent log records from the SQLite-backed sink, filtered by service, level and time.

From a terminal, `indusk telemetry tail/trace/services` read the same data.

## When to use

Use these tools whenever the user says something like:
- "I just ran X. Why did it fail?"
- "This test passed locally but broke when I tried it through the UI."
- "The API returned a weird shape — what did the server actually do?"
- "I see an error — what happened right before it?"

Do NOT use these tools when:
- The failure is already explained by an assertion message, stack trace, or error log the user already pasted. You don't need telemetry when the evidence is in front of you.
- The question is about historical (> 1 hour) or production behavior. Local telemetry has a short-retention buffer; anything older is gone, and a deployed system is read through its own recording server (`promises.jaeger`).
- The question is about metrics or dashboards. This daemon doesn't do metrics in v1.

## Diagnosis patterns

A log line is for diagnosis: what happened, around the failure. A promise's signal is a span, written with `signal.upheld` or `signal.broken` from the app's `signal` helper; the logs below are how you see what surrounded it.

**Pattern 1: "What just failed?"**

```
1. search_traces({ service_name: "suspected-service", with_errors: true, start_time_min: "-5m" })
2. If error traces are present: get_trace_errors for the trace, then get_span_details for the failing span.
3. Call out in chat: "The error came from service X, operation Y, attribute Z = …."
```

**Pattern 2: "Why was this slow?"**

```
1. search_traces({ service_name: "suspected-service", start_time_min: "-1m", duration_min: "500ms" })
2. Read the slowest trace from the summary.
3. get_critical_path on the outlier's trace, then get_span_details for the slowest span.
4. Report the bottleneck + its attributes.
```

**Pattern 3: "Did the server receive my request?"**

```
1. get_services() — is the server there at all?
2. search_traces({ service_name: "server", start_time_min: "-30s" })
3. Look for a span matching the request's verb + path + attributes.
4. If not present: the request never hit the server (network / routing issue).
5. If present: inspect attributes for the actual handling.
```

**Pattern 4: "What does the log say right around this failure?"**

```
1. Get the trace ID from the failure (from the user, or from search_traces).
2. tail_logs({ service: "suspected-service", since_minutes: 1 })
3. Match records on the trace_id the log transport writes, and correlate their messages with span timing.
```

## Jaeger UI as the fallback

The MCP tools exist for agent-driven diagnosis. When you want to eyeball a trace visually — e.g., a deep microservice call tree where the attribute lists are too dense for chat — tell the user to open the daemon's interface address (`indusk telemetry address` prints it; `http://localhost:24316` when InDusk's block was free) and paste the trace ID you've identified. Jaeger's built-in Gantt chart shows the structure at-a-glance.

## When it's not running

If `indusk telemetry status` reports not-running, the daemon hasn't started or has crashed. Run `indusk telemetry start` to bring it up (or `indusk telemetry restart` to cycle). Spans emitted while the daemon is down are lost — there's no buffering client-side.

If an MCP tool returns an error about the daemon being unreachable, check `indusk telemetry status` first before trying to diagnose a different problem.

## Wiring services to emit here

**You do not wire this by hand.** `indusk init` (and `indusk update`) scaffold the app's instrumentation per runtime: the service named after the project, the project and environment on every span, and the daemon's stored address as the default endpoint. A set `OTEL_EXPORTER_OTLP_ENDPOINT` still wins. The address is chosen once per machine and stored in `~/.indusk/telemetry-address.json`; it never moves, and a start refuses (naming the process) rather than bump a port. `indusk telemetry address` prints it, and `--json` prints it for a script.

If an app must point at the daemon itself (a container, a script outside the scaffold), read the address and set it where the deployment keeps its environment:

```
OTEL_EXPORTER_OTLP_ENDPOINT=<traces address from `indusk telemetry address`>
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=<logs address from `indusk telemetry address`>
```

`.indusk/extensions/local-telemetry/.env.example` is a port reference card; nothing reads it.

### What NOT to do

- Don't hardcode the daemon's port in service code. The standard 4318 is not the daemon's; the scaffold reads the stored address.
- Don't rely on `.indusk/extensions/local-telemetry/.env` being read — it isn't. It's a docs file.
- Don't write a promise's signal as a log line. A signal is a span written by the helper.

## Short reference

| Tool | Purpose | Typical call |
|------|---------|--------------|
| `search_traces` | "What errors / slow traces recently?" | `{ service_name: "server", with_errors: true, start_time_min: "-5m" }` |
| `get_span_details` | "Full context for this span" | `{ trace_id, span_ids }` from a `search_traces` result |
| `get_services` | "What services are emitting?" | `{}` |
| `tail_logs` | "What did the logs say?" | `{ service: "server", level: "error", since_minutes: 1 }` |

## See also

- [Extensions index](../README.md) — full catalog of InDusk extensions with decision matrix
- `apps/docs/src/reference/telemetry/` — CLI + overview docs
- `.indusk/planning/local-telemetry/adr.md` — why this exists
- [`otel/skill.md`](../otel/skill.md) — emit-side instrumentation patterns; pairs with whichever query-side extension you use
