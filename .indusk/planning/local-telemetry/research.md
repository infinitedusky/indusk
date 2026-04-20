---
title: "Local Telemetry — Research"
date: 2026-04-20
status: complete
---

# Local Telemetry — Research

## Question

How do we give every InDusk-scaffolded project a **local OTel receiver + short-term diagnostic buffer** that the working agent can query directly, so the loop "I just ran X, why did it fail?" collapses from cloud round-trip (Dash0 query UI → copy-paste → paste back into chat) to a single MCP tool call returning the relevant spans?

Constraints that shape the answer:

- **Dev OTel must stop going to Dash0.** Dash0 is for production + staging monitoring. Dev noise burns quota, pollutes production-facing queries, and makes "recent spans" slower to retrieve than they should be.
- **Not a full observability stack.** No dashboards, no metric alerts, no Grafana, no long-term retention. The use case is "why did this just fail" diagnosis during dev + test runs — not period-over-period SRE analysis.
- **Primary consumer is the agent, not a human.** MCP tool interface (`get_recent_spans`, `get_trace`, `tail_logs`). A minimal trace viewer for human eyeballing is a bonus, not the goal.
- **Same OTel substrate as future production.** `instrumentation.ts` scaffolded by `indusk init` already emits OTel — local-telemetry just changes where it exports in dev. Staging + prod keep exporting to Dash0. No new instrumentation layer, no new SDK dependency, just exporter config.
- **Machine-global daemon, admin-UI pattern.** Rather than folding telemetry into `indusk-infra` (which is scoped to working-agent graph infrastructure — FalkorDB + Graphiti), local-telemetry runs as its own machine-global daemon following the 1.27.x `indusk ui` pattern: pre-built container image shipped in the indusk-mcp tarball, one `indusk telemetry start` from anywhere brings it up, a registry at `~/.indusk/telemetry/projects.json` tracks which projects point at it. Cross-project `service.name` filtering happens naturally inside Jaeger. Decouples telemetry lifecycle from graph-infra lifecycle — reindexing the code graph shouldn't bounce your trace buffer.

## Findings

### Candidate backends

| Option | Storage | Traces | Logs | Metrics | UI | Query API | Bundle weight | Fit |
|--------|---------|--------|------|---------|----|-----------|--------------|-----|
| **Jaeger all-in-one** | in-memory or Badger (on-disk) | ✓ | ✗ | ✗ | minimal trace search + timeline | REST + gRPC | small (~60 MB image) | **Best fit for traces-only diagnosis.** |
| Grafana stack (Tempo + Loki + Prometheus + Grafana) | bucketed | ✓ | ✓ | ✓ | dashboards | PromQL/LogQL/TraceQL | heavy (~500 MB+) | Overkill — user explicitly rejected. |
| OTel Collector + SQLite sink (custom) | custom | ✓ | ✓ | ✓ | none | hand-written | light | Maintenance burden — recreates Jaeger poorly. |
| SigNoz | ClickHouse | ✓ | ✓ | ✓ | dashboards | ClickHouse SQL | very heavy | Out of scope. |
| Honeycomb self-host | proprietary | ✓ | partial | partial | dashboards | unique query lang | medium | Doesn't exist (Honeycomb is cloud-only). |

**Recommendation: Jaeger all-in-one as the trace backend.** Reasons:

- **OTLP receiver built in.** Jaeger since 1.35 accepts OTLP HTTP (port 4318) and OTLP gRPC (port 4317) directly. No separate OTel Collector needed for the happy path. The scaffolded `instrumentation.ts` points `OTEL_EXPORTER_OTLP_ENDPOINT` at `http://localhost:4318` in dev and the spans land in Jaeger's storage.
- **REST query API is stable and well-documented.** `GET /api/traces?service=X&operation=Y&start=...&end=...&tags={}` returns recent traces in JSON. An MCP tool wraps this directly — no custom query DSL.
- **Storage options match the use case.** Jaeger's in-memory storage is designed for short-term buffer exactly as we want (sliding window, configurable size). Badger storage adds disk persistence across container restart if we want it. Neither requires operator expertise.
- **Minimal UI when you want one.** `localhost:16686` shows trace search + Gantt chart for when you'd rather click through than query via MCP.
- **Battle-tested.** Jaeger is a CNCF graduated project. No surprise deprecations, no license churn.

### OTel Collector is structural, not optional

Jaeger is traces-only. Two architectural options existed briefly:

1. Services export directly to Jaeger's OTLP receiver; logs skipped in v1.
2. **An OTel Collector in front of everything.** Services export to the Collector (`localhost:4318`), which fans out to Jaeger (traces) and a SQLite log sink (logs). Standard OTel pipeline pattern.

**Option 2 is required, not optional.** Each project has multiple services (game-server, admin-server, UI, eval agent, etc.); per-service sidecar exporters mean per-service batching / retry / filtering config, duplicated everywhere. The Collector centralizes that once. Every service's `instrumentation.ts` just points at `localhost:4318`. Future downstream exporters (sampling fraction of dev traces forward to Dash0 for debugging prod-parity, OpenInference for LLM runs, whatever) bolt onto the Collector — zero service changes.

Pipeline:

```
[service A] ─┐
             │
[service B] ─┼──→ OTel Collector (4318) ──┬──→ Jaeger (traces → 16686 UI, REST query API)
             │   (in telemetry daemon)    │
[service C] ─┘                            └──→ SQLite log sink (queryable via MCP tail_logs)
```

Bundle weight: Jaeger ~60 MB + OTel Collector ~150 MB = ~210 MB total added to the telemetry image. Acceptable — admin-ui's bundle is ~12 MB native Next.js; telemetry is ~210 MB container image (pulled or built once, cached locally).

Log sink: SQLite table with schema `(timestamp, service, level, trace_id, span_id, body, attributes_json)`, rolling retention via row count or time window. Collector's `file` exporter writes; MCP tool queries via a thin SQL layer. Simple, queryable, inspectable with `sqlite3` if needed.

### Environment-aware OTel exporter

OTel SDKs support env-var-driven exporter config out of the box:

```bash
# dev
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# staging / prod
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingress.dash0.com
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20$DASH0_TOKEN
```

The scaffolded `instrumentation.ts` today reads these env vars and configures the OTLP exporter accordingly. Local-telemetry adds **a) defaults** (composable.env component that sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` for the dev profile and the Dash0 endpoint for staging/prod profiles) and **b) a discovery step** (init detects if the project has composable.env and wires the right component; otherwise falls back to a plain `.env.example` entry).

No code change to `instrumentation.ts` itself — it's already env-driven. The behavior change is "what env var values does the dev environment ship with."

### Eval agent stays on Dash0

The eval agent's existing OTel (opt-in, routes to Dash0's `agent` dataset) is unchanged. It's always production-grade telemetry **about the InDusk system itself** — trended, alertable, historical. Local-telemetry affects project-level runtime telemetry only. The separation is clean because the eval agent sets its own exporter endpoint explicitly in `initEvalOtel` and doesn't read `OTEL_EXPORTER_OTLP_ENDPOINT` for that span tree.

### MCP tool surface

The agent needs three query primitives:

| Tool | Purpose | Jaeger API |
|------|---------|------------|
| `get_recent_spans(service?, status?, since?, until?, limit?)` | List recent spans matching filters. Default: last 5 min, ERROR status, any service. | `GET /api/traces` with `minDuration`, `lookback`, `tags={error:true}` |
| `get_trace(trace_id)` | Full span tree for one trace. | `GET /api/traces/{id}` |
| `get_services()` | List services that have emitted spans recently. | `GET /api/services` |
| `tail_logs(service?, level?, since?)` | Recent log lines. | Backed by log sink (option 1 above), not Jaeger. |

All reads; no writes. The tool wraps Jaeger's HTTP API with sensible defaults and returns JSON the agent can reason over. Response size budget: ~100 spans / ~100 KB per call — enough to diagnose, small enough to include in context.

### Connection to the three-tier agent model

InDusk already has three tiers (working agent / eval agent / infrastructure). Local-telemetry fits naturally:

- **Infrastructure tier** (the substrate): machine-global telemetry daemon — Jaeger + OTel Collector + SQLite log sink, packaged as a single container image shipped in the indusk-mcp tarball, managed by `indusk telemetry start/stop/restart/status` (admin-UI pattern). Lifecycle is independent of `indusk-infra` so reindexing the code graph doesn't touch the trace buffer.
- **Working agent** (the consumer): calls the MCP tool when diagnosing. Reads spans, answers "why did this fail."
- **Eval agent + future watcher agent** (async observers): the eval agent currently observes commits; a future watcher would observe the local telemetry stream and surface anomalies. Watcher is a downstream plan (`telemetry-watcher-agent`).

Same discipline: infrastructure is passive, agents are the sole writers to graph/highlights, the working agent asks questions of the infrastructure.

### Comparable projects

- **`jaeger all-in-one` Docker image** — the canonical single-container Jaeger. `jaegertracing/all-in-one:latest`, ~60 MB. Default ports: 4318 (OTLP HTTP), 4317 (OTLP gRPC), 16686 (UI), 14268 (collector HTTP), 6831 (agent UDP). Runs in-memory by default; pass `SPAN_STORAGE_TYPE=badger` + volume mount for persistence.
- **OpenTelemetry Collector contrib distribution** (`otel/opentelemetry-collector-contrib`) — ~150 MB. Has receivers for OTLP + lots of others, processors for filtering/transforming, and exporters for everything (including Jaeger and file). Use only if we need the log sink path.
- **Existing InDusk OTel scaffold** — `apps/indusk-mcp/templates/instrumentation.ts` already uses `OTLPTraceExporter` + `OTLPLogExporter` keyed to `OTEL_EXPORTER_OTLP_ENDPOINT`. No template changes needed; only defaults change.

## Open Questions (Resolved in Impl Phase 1 Spike)

The impl Phase 1 is a **hands-on research spike** — not prose research but actual wiring. The spike exists because the answers below can only be validated by running the system:

1. **Query latency under realistic load.** Can Jaeger return 100 spans across 5 seconds of recent activity in under 500 ms? Budget matters because the agent will call the MCP tool inline during diagnosis — a slow call breaks the "instant" UX.
2. **Jaeger storage choice.** In-memory (fast, lost on daemon restart) vs Badger (disk, survives restart, slightly slower writes). The spike measures both and picks.
3. **Retention knob.** What's a reasonable default ring-buffer size (hours / MB)? Spike runs against a realistic dev session (tests + some manual clicking) and measures.
4. **MCP tool signature ergonomics.** First-draft signatures may not survive contact with real agent usage. Spike has the agent actually call them in a debugging scenario and adjusts.
5. **Container packaging shape.** Single-container-with-supervisord (Jaeger + Collector + SQLite sink in one image, one process manager) vs docker-compose-with-multiple-containers (separate services, orchestrated). The admin-UI's single-bundle precedent leans single-image; but supervisord has its own failure modes. Spike prototypes both and picks.
6. **Image distribution.** Pull from a public registry (Docker Hub / ghcr.io — requires CI publishing) vs build-locally-from-Dockerfile (ships Dockerfile in the tarball, first `start` builds the image, ~30 s initial cost, no registry dependency). The spike measures initial build time and tarball-size impact.

Spike outputs go into a new `spike-findings.md` in this plan folder, which then informs Phase 2+ of the impl AND feeds the follow-up `telemetry-watcher-agent` plan's brief.

## Sources

- [Jaeger Getting Started](https://www.jaegertracing.io/docs/latest/getting-started/) — all-in-one setup
- [Jaeger OTLP Receiver](https://www.jaegertracing.io/docs/latest/deployment/#opentelemetry-protocol-otlp) — since 1.35
- [Jaeger HTTP Query API](https://www.jaegertracing.io/docs/latest/apis/#http-json-internal) — the `/api/traces` / `/api/services` endpoints the MCP tool wraps
- [OpenTelemetry SDK env-var-driven config](https://opentelemetry.io/docs/specs/otel/protocol/exporter/) — the spec that makes env-swap trivial
- `apps/indusk-mcp/templates/instrumentation.ts` — current InDusk scaffold
- `apps/indusk-mcp/templates/filtering-exporter.ts` — category-based filtering already in place
- CLAUDE.md Known Gotchas section — the existing FalkorDB/Graphiti bundled-container precedent
- `.indusk/planning/graphiti-infrastructure/adr.md` — prior art for bundled-container decision
- `.indusk/research/test-strategy/induskbrief.md` — downstream consumer (test-strategy plan benefits from local spans during integration tests)
