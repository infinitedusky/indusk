---
title: "Local Telemetry — Phase 1 Spike Findings"
date: 2026-04-20
status: final
---

# Local Telemetry — Phase 1 Spike Findings

Phase 1 was a hands-on investigation to resolve the ADR's open questions before committing Phase 2+ to specific shapes. Measurements + decisions below are binding on downstream phases.

## Headline Finding: Jaeger v2 IS an OTel Collector distribution

Jaeger v2 (tested: v2.17.0) is implemented as a Collector distribution that bundles Jaeger's trace storage + query + UI as native otelcol components. A single native binary provides:

- **Receivers**: `otlp` (Stable for logs/metrics/traces), `jaeger`, `zipkin`, `kafka`, `nop`
- **Processors**: `batch`, `memory_limiter`, `filter`, `attributes`, `tail_sampling`, `adaptive_sampling`
- **Exporters**: `jaeger_storage_exporter` (writes to Jaeger's backends), `kafka`, `prometheus`, `debug`, `nop`
- **Extensions**: `jaeger_storage` (in-memory OR Badger), `jaeger_query` (REST API + UI), `healthcheckv2`, `jaeger_mcp` (!), `zpages`, `pprof`, `basicauth`, `sigv4auth`, `remote_sampling`, `remote_storage`, `storage_cleaner`, `expvar`
- **Config format**: standard otelcol YAML (`service.pipelines`, `receivers`, `processors`, `exporters`, `extensions`)

This **eliminates Spike Item 3** ("launch otelcol in front of Jaeger") and **redefines Spike Item 2** ("decide otelcol variant"): there is no separate otelcol-k8s binary to install. Jaeger v2 IS the Collector.

**Downstream impact**:
- Platform packages contain ONE binary (~114 MB on darwin-arm64), not two. ADR's `~100 MB per platform` estimate is close but slightly undercounts — revise to `~120 MB per platform`.
- `daemon.ts` supervises ONE child process, not two. Simpler lifecycle code.
- Config is one YAML file: `jaeger-config.yaml`. No separate `collector-config.yaml`.

## Item 1: Binary download + native launch — VERIFIED

- **Source**: [Jaeger v2.17.0 darwin-arm64](https://github.com/jaegertracing/jaeger/releases/download/v2.17.0/jaeger-2.17.0-darwin-arm64.tar.gz), tarball 52 MB compressed.
- **Checksum**: provided by Jaeger project in `jaeger-2.17.0-darwin-arm64.sha256sum.txt` — per-file hashes, verified via `shasum -a 256 jaeger-2.17.0-darwin-arm64/jaeger` matched `dac2348882ba6fe52e05efa95a97f1155830f9d4bb4b629146bb1bdeb7ece827`.
- **Extracted binary**: 114 MB uncompressed.
- **Launch**: `./jaeger --config=file:jaeger-config.yaml` starts instantly (<1s to "ready"), binds 4317 (OTLP gRPC), 4318 (OTLP HTTP), 16686 (UI), 13133 (health).
- **Health check**: `curl http://localhost:13133/status` → 200.
- **UI**: `curl http://localhost:16686/` → 200.
- **OTLP HTTP**: `POST /v1/traces` with empty `{"resourceSpans":[]}` → 200.

**Minimal working config** (binding shape for Phase 2's platform packages):

```yaml
service:
  extensions: [jaeger_storage, jaeger_query, healthcheckv2]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger_storage_exporter]
  telemetry:
    resource:
      service.name: jaeger

extensions:
  healthcheckv2:
    use_v2: true
    http:
      endpoint: 0.0.0.0:13133
  jaeger_storage:
    backends:
      some_storage:
        memory:
          max_traces: 100000
  jaeger_query:
    storage:
      traces: some_storage
    http:
      endpoint: 0.0.0.0:16686
    grpc:
      endpoint: 0.0.0.0:16685

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}

exporters:
  jaeger_storage_exporter:
    trace_storage: some_storage
```

## Item 4: Query latency — PASS (40x headroom under budget)

Methodology: emit 100 spans via `@opentelemetry/sdk-trace-node` + `@opentelemetry/exporter-trace-otlp-http` trickled across 5 seconds (10 spans per 500ms batch); wait 500ms for Jaeger to index; then 10 calls to `GET /api/traces?service=spike-latency&limit=100&lookback=1m`.

**Results** (10 runs, ms wall-clock):
- min: 3.2
- p50: 5.5
- p95: 12.2
- p99: 12.2
- max: 29.5

**T12 budget**: 500ms p95 → PASS with 40x headroom. No budget renegotiation needed.

First-call was 29.5ms (max) — likely cold Jaeger-query-extension warmup. Subsequent calls tracked 3–12ms consistently. Budget is safe even under 5x worst-case growth.

## Item 5: Storage mode — in-memory chosen; Badger deferred

**Decision: `jaeger_storage.backends.some_storage.memory.max_traces: 100000` as the v1 default.**

Rationale:
- Diagnosis loop is minutes-to-hours window. 100k traces covers a typical dev session (tests + manual clicks) comfortably — at ~100 spans per test and ~500 tests/hour that's ~50k spans/hour worst-case, well under the cap.
- In-memory trivially meets the latency budget; Badger would be slightly slower writes with identical query latency.
- Restart behavior: in-memory loses the buffer on daemon restart. Acceptable — the diagnosis loop is "query AFTER the dev run," not "query across restarts." If a dev wants a trace to survive restart, they copy the trace ID from the UI before restarting.
- Badger adds a ~20–50 MB disk footprint and config complexity for marginal benefit. Not worth it at v1.

**Config knob**: v1 locks in-memory with `max_traces: 100000` as default; `JAEGER_STORAGE` env var can override to `badger` at `indusk telemetry start` time for power users. Documented at v2 release time if demand appears.

## Item 2: Collector variant — REDEFINED

Original spike question: "pick otelcol-contrib vs otelcol-core vs minimal-build." **This question is moot.** Jaeger v2 IS the Collector. Platform packages don't ship a separate otelcol binary.

If logs are included in v1 (see below), a second binary may be needed OR logs use an alternative path within Jaeger v2. See "Open Decision" section.

## LOCKED: Logs path for v1 — Option A (Jaeger + otelcol-k8s)

**Decided 2026-04-20.** Platform packages ship TWO binaries per platform: `jaeger` (traces end-to-end) + `otelcol-k8s` (logs pipeline only). Two-PID supervision in `daemon.ts`. Platform package size estimate: ~170 MB per platform. The ~150 MB brief criterion is relaxed to ~180 MB accordingly.

Rationale: evaluated OpenObserve, SigNoz, Uptrace, Grafana LGTM, and a custom Jaeger distribution with otelcol-builder as single-binary alternatives. All traded off smaller-binary wins against maturity / heaviness / build-pipeline costs that outweighed the benefit. Jaeger + otelcol are OTel-ecosystem siblings designed to compose; the one extra binary is a small, well-understood cost. See alternatives table in the Phase 1 /work session transcript.

---

## Earlier framing retained for history: Logs path options considered

Jaeger v2's OTLP receiver accepts logs signals (the components list shows `otlp` is Stable for logs), BUT:
- There's no **Jaeger log storage extension** — only `jaeger_storage` which handles traces.
- There's no **file or SQLite log exporter** in Jaeger v2's bundled components.
- Options: `debug` (prints to stdout), `nop` (discards), `kafka` (external infra — out of scope), `prometheus` (metrics only).

Three paths forward — this needs a decision before Phase 2:

### Option A: Ship a second binary (minimal otelcol-k8s) just for logs

Platform package contains: `jaeger` (traces) + `otelcol-k8s` (logs → SQLite or file exporter). Daemon supervises both. ~50 MB extra per platform (k8s distribution).

- ✅ Matches Dash0's recommended Collector pattern (otelcol-k8s + OTLP pipelines for all three signals) — adapted to route traces to Jaeger-OTLP + logs to local sink
- ✅ Pipeline-level separation is clean
- ❌ Two binaries per platform package → slightly larger, two PIDs to supervise
- ❌ `daemon.ts` gets more complex (two-child supervision)

### Option B: SQLite-backed Pino transport in instrumentation.ts scaffolding

Services write logs directly to `~/.indusk/telemetry/logs.db` via a custom Pino transport shipped in the `indusk init` logger.ts template. MCP `tail_logs` reads from that SQLite file. Logs never touch OTLP.

- ✅ One binary (Jaeger only)
- ✅ Simpler daemon
- ❌ Logs are NOT in the OTel pipeline — diverges from "use the OTel substrate for everything"
- ❌ Each service needs the Pino transport; new runtimes (Python, Go services in a polyglot project) need per-language equivalents
- ❌ Asymmetric with staging/prod (Dash0 receives logs via OTLP; local gets them via file)

### Option C: Skip logs in v1 — `tail_logs` is a v2 deliverable

Platform package contains only Jaeger. `tail_logs` MCP tool returns "not yet implemented — see v2 plan."

- ✅ Smallest v1 (~120 MB platform packages, one binary)
- ✅ Ship faster, get diagnosis-via-traces working first
- ❌ Contradicts the ADR's explicit rejection of option "Skip logs in v1"
- ❌ Half of diagnosis is log context; v1 credibility suffers
- ❌ `test-strategy-convention` plan's E2E diagnosis loses the log half

### Spike Recommendation: **Option A** with `otelcol-k8s` for logs-only pipeline

Rationale:
- Dash0's recommendation (verified via their knowledge base: `otel/opentelemetry-collector-k8s` with OTLP receivers → batch → OTLP exporter) is the canonical pattern.
- We adapt: `otelcol-k8s`'s logs pipeline exports to a file/SQLite sink instead of `otlp/dash0`. Traces bypass otelcol-k8s entirely and go direct to Jaeger's OTLP receiver.
- ~50 MB extra per platform (k8s distribution size) brings total platform package to ~170 MB. Still under the "under ~150 MB per platform" brief success criterion — brief needs a small relaxation, OR we downscope to `core` otelcol (if core ships the SQLite/file exporters needed — needs one more spike check).
- Two-PID supervision is mechanically trivial: admin-UI already spawns Next + we can apply the same pattern for two children here.

**Alternatives**: if bundle weight becomes a real issue, option B (Pino transport) is a fallback. Option C is the fallback-of-last-resort — not recommended because the diagnosis story weakens materially.

## Spike Items 6–8: Deferred to Phase 2 implementation

Items 6 (npm platform-package publish+install), 7 (`require.resolve` + detached spawn), and 8 (MCP tool signature ergonomics) were originally to be validated in the spike. They're deferred to Phase 2 because:

- **Item 6 (platform-package install flow)**: the pattern is well-established — esbuild, swc, biome, turbo, tailwindcss-oxide all ship via platform-specific `optionalDependencies`. No novel risk to validate in isolation; Phase 2 builds the actual packages and tests them end-to-end.
- **Item 7 (`require.resolve` + detached spawn)**: admin-ui-hosting's daemon (Phase 3) already uses `createRequire(import.meta.url).resolve("next/package.json")` + `spawn(...)` + `detached: true` + `unref()`. The pattern is proven in the same codebase; Phase 2 applies it.
- **Item 8 (MCP tool signature ergonomics)**: defer until Phase 5 when the tools are actually written — signature refinements come from real usage, not stub-based conjecture. Initial signatures from the ADR are fine starting points; iterate in Phase 5.

## Interesting Surface: `jaeger_mcp` extension

Jaeger v2.17.0 bundles a **`jaeger_mcp` extension** (stability: Alpha) that appears to expose Jaeger's query API as an MCP server natively. Worth investigating in Phase 5:

- **If it's a full MCP server exposing `get_recent_spans` / `get_trace` / `get_services` equivalents**: we may not need to write our own MCP tools at all. Just enable the extension, point Claude at the Jaeger MCP endpoint, done.
- **If it's partial or too opinionated**: we still write our own thin wrappers over Jaeger's REST API as planned.

The spike did not validate this — `jaeger_mcp` inspection is a Phase 5 task (flagged here so Phase 5 doesn't forget to check it first before writing custom MCP tools).

## Binding Decisions for Phase 2+

1. **Two platform-package binaries** per platform: `jaeger` (v2.17.0, traces end-to-end) + `otelcol-k8s` (logs-only pipeline → SQLite sink). Locked via Option A decision.
2. **Storage**: `memory` with `max_traces: 100000`. Badger deferred.
3. **Config shape**: the minimal YAML under "Item 1" is the template for the shared config shipped with each platform package.
4. **Ports**: OTLP HTTP 4318, OTLP gRPC 4317, UI 16686, health 13133. Auto-bump on conflict per admin-UI precedent.
5. **Binary size per platform**: ~170 MB total (Jaeger ~120 MB + otelcol-k8s ~50 MB) per Option A. Brief's `<150 MB` target relaxed to `<180 MB`.
6. **Query budget**: 500ms p95 confirmed with 40x headroom. T12 is a safe target.
7. **Jaeger version pinned**: v2.17.0 for v1 ship. Bump procedure documented in Phase 2's `UPSTREAM.json`.

## Next Steps (non-spike)

- **Phase 2**: build platform packages containing both `jaeger` + `otelcol-k8s` binaries per platform. `scripts/build-telemetry-binaries.sh` fetches both from their respective upstream releases, verifies checksums, packs per-platform, optionally publishes. `UPSTREAM.json` pins both versions. `collector-config.yaml` scoped to logs-only pipeline (traces go direct to Jaeger's OTLP 4317; logs route otelcol-k8s → file/SQLite exporter).
- **Phase 3**: `daemon.ts` spawns Jaeger first, then otelcol-k8s (which needs Jaeger's OTLP port reachable), both detached. Two PIDs tracked in `~/.indusk/telemetry.json`. Two-PID supervision unit — stop kills both in reverse order.
- **Phase 5**: when writing MCP tools, first check `jaeger_mcp` extension to see if it subsumes our planned trace-query tool surface. `tail_logs` MCP wraps the SQLite file otelcol-k8s writes to.

## Appendix: What wasn't tested

- **Linux platforms**: spike ran on macOS darwin-arm64 only. Linux x64/arm64 binary download + checksum verify + launch is assumed to work (Jaeger ships official Linux binaries) but not independently verified. Phase 2's build script tests both platforms as it produces the platform packages.
- **Sustained load**: 100-span bursts. Didn't test 10k-span or 24-hour continuous emission. In-memory cap (100k traces) is the failure mode; Phase 2 integration tests should include retention-boundary behavior.
- **OTLP gRPC path**: only HTTP verified end-to-end. gRPC port listens but wasn't exercised with spans. Phase 2 should add a gRPC emit case.
- **`jaeger_mcp` extension**: flagged but not activated. Phase 5 first-look.
- **Badger storage mode**: binding decision for v1 is in-memory; Badger left untested. Phase 2 can validate if the override-to-Badger env-var path works with a 5-minute test.
