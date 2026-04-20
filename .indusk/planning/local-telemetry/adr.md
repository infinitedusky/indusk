---
title: "Local Telemetry"
date: 2026-04-20
status: accepted
---

# Local Telemetry

## Goal

**InDusk projects gain a machine-global, agent-queryable local OTel telemetry daemon — so the diagnostic loop "I just ran X, why did it fail?" closes in seconds via a single MCP tool call, instead of requiring a Dash0 round-trip or a re-run with verbose logging.**

Today, every InDusk-scaffolded project emits OTel via `instrumentation.ts`, but dev telemetry either exports to Dash0 (burning production-tier quota on dev noise, slow to query, agent can't access directly) or nowhere (when `otel.role` is `library` / `tool` / `none`). The working agent can't diagnose from runtime state because runtime state isn't reachable. This ADR decides how we change that: a new extension + a machine-global daemon (Jaeger + OTel Collector + SQLite log sink) in the admin-UI 1.27.x pattern, with per-project routing that sends dev traces local while staging/prod continue to Dash0 unchanged.

## Y-Statement

**In the context of:**
developers and agents diagnosing why a just-run project action failed — failing tests, WebSocket errors, schema-mismatch responses, anything that produces runtime signal that isn't visible from source code alone.

**Facing:**
dev OTel today either exports to Dash0 (cloud round-trip, per-month quota burn on dev noise, no direct agent query path) or nowhere (`otel.role: library|tool|none` silences it); the working agent has no structural way to read recent runtime state during diagnosis, so the user has to re-run with verbose logging or open Dash0's UI and paste results back into chat — both of which break flow and neither of which scales toward the autonomous-dev target where the agent watches its own failures.

**We decided for:**
a new InDusk extension `local-telemetry` (alongside `dash0`, `otel`, etc.) plus a machine-global telemetry daemon packaged as a single container image containing Jaeger all-in-one + OTel Collector + SQLite log sink, managed by an `indusk telemetry start/stop/restart/status` CLI following the 1.27.x admin-UI pattern; per-project OTel endpoint env var points services at the Collector's OTLP receiver at `localhost:4318`, the Collector fans out to Jaeger (traces, 16686 UI, REST query API) and the SQLite sink (logs), and an MCP tool surface (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) gives the agent direct query access.

**And against:**
(a) bundling Jaeger+Collector into the existing `indusk-infra` container (couples telemetry lifecycle to FalkorDB+Graphiti — reindexing code graph bounces the trace buffer); (b) building a custom OTel Collector + SQLite backend without Jaeger (reinvents trace storage + query poorly, skips the free UI); (c) the full Grafana/Tempo/Loki/Prom stack (heavy, dashboards-first, wrong use case — we want "why did this just fail," not "show me p99 latency over 30 days"); (d) SigNoz or Honeycomb self-hosted (even heavier, license complexity, overkill); (e) per-service sidecar OTel exporters instead of a central Collector (duplicates batching/retry/filtering config across every service, blocks future downstream exporters); (f) skipping logs in v1 and surfacing only traces (cripples diagnosis — half of "why did this fail" is log context, not trace shape).

**To achieve:**
the dev diagnosis loop closes in seconds (single MCP call, <500 ms p95 per the spike-validated budget); dev Dash0 quota goes to zero after rollout; staging + prod Dash0 export unchanged; the eval agent's `agent`-dataset Dash0 telemetry untouched; the foundation substrate is in place for the downstream `telemetry-watcher-agent` plan (an async observer that tails the buffer and surfaces anomalies) and for `test-strategy-convention`'s E2E-diagnosis UX (integration-test failures produce instantly-inspectable server-side traces).

**Accepting:**
a second machine-global daemon on every InDusk user's dev machine (after admin-UI's daemon, this is now two; both auto-start on demand so the user notices only when upgrading); ~210 MB additional container weight (Jaeger ~60 + Collector ~150) that is either pulled once from a registry or built once locally (spike decides distribution); v1 ships the Collector config locked — consumers can't add custom processors until a v2 merge point exists; logs are short-term in a SQLite ring buffer, not long-term searchable (deliberate — long-term observability is Dash0's job).

**Because:**
the autonomous-dev arc we're heading toward requires agents that can see runtime state without a human intermediary, and "see runtime state" practically means "query spans and logs from just-now"; matching the admin-UI daemon precedent means the user already has a mental model for "long-lived local daemon with start/stop/restart/status" (no new pattern to teach); Jaeger and OTel Collector are off-the-shelf CNCF projects solving trace storage / query / receiver / fan-out correctly, and rebuilding them poorly is the most common failure mode in this category; decoupling from `indusk-infra` respects the different lifecycles of telemetry vs graph infrastructure; structural logs in v1 (vs punting to v2) is forced by the diagnosis-UX claim — an MCP tool called `tail_logs` that says "not yet implemented" undermines the plan's own justification; the `dash0` extension + env pattern already exists, so "another extension that sets `OTEL_EXPORTER_OTLP_ENDPOINT` based on profile" is zero-novelty scaffolding with maximum reuse.

## Context

- **Prior-art scan and backend comparison:** see [`research.md`](./research.md) for the full table evaluating Jaeger all-in-one, Grafana stack, custom Collector+SQLite, SigNoz, and Honeycomb self-hosted. Jaeger wins on fit for "traces-only short-term buffer with free UI + stable REST API."
- **Daemon pattern precedent:** admin-ui-hosting's 1.27.x ship (see `../admin-ui-hosting/adr.md`) established: machine-global daemon + registry of consumer projects + `start/stop/restart/status` CLI + auto-start on consumer enable + graceful stop when last consumer disables. Local-telemetry reuses the pattern wholesale.
- **Extension+env precedent:** `dash0` extension owns its `.env` template at `apps/indusk-mcp/extensions/dash0/` and optionally sources from `env/components/dash0.env` via composable.env. Local-telemetry mirrors this shape exactly — `apps/indusk-mcp/extensions/local-telemetry/` with manifest + skill + `.env` template, optional ce component.
- **OTel SDK env-driven config:** the SDK's `OTEL_EXPORTER_OTLP_ENDPOINT` + `OTEL_EXPORTER_OTLP_HEADERS` env vars let us swap exporter destination without changing `instrumentation.ts`. No new API layer.
- **Downstream plans that consume this:** `telemetry-watcher-agent` (not yet briefed — depends on this substrate existing and being queryable) and `test-strategy-convention` (not yet briefed — derived from `.indusk/research/test-strategy/induskbrief.md`; benefits from instant span visibility during integration + E2E tests).
- **Scope boundaries confirmed in the brief:** no dashboards, no metric alerts, no long-term retention, no PromQL — this is a diagnostic buffer, not an observability stack. If v2 consumers ask for Grafana, the answer is "use Dash0."

## Decision

1. **Create a new extension at `apps/indusk-mcp/extensions/local-telemetry/`** containing `manifest.json`, `skill.md`, and `.env` template. Manifest declares the skill, the MCP tools provided (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`), health checks (daemon-reachable, Collector-listening), and the daemon-lifecycle hook into `indusk telemetry start`.
2. **Ship a machine-global telemetry daemon** as a single container image containing Jaeger all-in-one + OTel Collector + SQLite log sink. Process management inside the container and container image distribution (supervisord-single-image vs compose-multi-image; pull-from-registry vs build-from-Dockerfile) are spike-decided in impl Phase 1 with findings captured in `spike-findings.md`.
3. **Add `indusk telemetry` CLI** parallel to `indusk ui`:
   - `indusk telemetry start` — ensure the daemon is running; auto-invoked when an extension first registers a project.
   - `indusk telemetry stop` — SIGTERM the daemon; auto-invoked when the last registered project disables the extension.
   - `indusk telemetry restart` — stop + start, the post-upgrade flow (parallel to `indusk ui restart`).
   - `indusk telemetry status` — running/not, listening ports (4318/16686), registered project count.
   - `indusk telemetry tail --service X` / `trace <id>` / `services` / `reset` — query surface parallel to the MCP tool surface, for when the human wants a terminal UX.
4. **Daemon metadata at `~/.indusk/telemetry.{pid,json,log}`** + **project registry at `~/.indusk/telemetry/projects.json`** following the admin-UI file layout (`~/.indusk/admin-ui.{pid,json,log}` + `~/.indusk/projects.json`).
5. **MCP tool surface** (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) wraps the daemon's query APIs — Jaeger's `/api/traces`, `/api/traces/{id}`, `/api/services` for traces; thin SQL layer over the SQLite log sink for logs. All reads, no writes. Response size budget ~100 spans / ~100 KB per call.
6. **OTel Collector config ships locked in v1.** Default pipeline: OTLP HTTP + gRPC receivers → Jaeger exporter (traces) + file/SQLite exporter (logs). Consumers can't add custom processors until v2 exposes a merge point. Rationale: shipping a working default beats shipping a configuration surface that most consumers won't need.
7. **SQLite log sink** with schema `(timestamp, service, level, trace_id, span_id, body, attributes_json)`, rolling retention (row count + time window, both configurable via env), queryable via MCP `tail_logs` with filters. Persistence survives daemon restart if storage mode is Badger-equivalent; spike chooses the default mode based on measured write cost.
8. **Dev vs staging/prod via extension enablement.** `local-telemetry` extension enabled → dev profile's `OTEL_EXPORTER_OTLP_ENDPOINT` points at `http://localhost:4318`. `dash0` extension enabled → staging/prod profile's endpoint points at Dash0. Consumers enable both extensions with per-profile `.env` files; composable.env (or plain env files) picks the active profile at runtime.
9. **Auto-start on first extension enable; graceful stop when last project disables.** Extension-enable path registers the project in `~/.indusk/telemetry/projects.json` and calls `telemetry start` if daemon isn't running. Extension-disable path deregisters; if registry becomes empty, calls `telemetry stop`.
10. **Impl Phase 1 = hands-on spike** producing `spike-findings.md` covering: measured query latency vs the 500 ms budget, Jaeger storage-mode choice (in-memory vs Badger), retention default, MCP tool signature ergonomics, container-packaging shape (supervisord vs compose), image distribution (registry vs local build). Spike findings also feed `telemetry-watcher-agent`'s brief.

## Alternatives Considered

### 1. Bundle Jaeger + Collector into `indusk-infra`

Fold telemetry services into the existing FalkorDB+Graphiti container. Consumers get everything with one `indusk infra start`.

**Rejected because:**
- Couples telemetry lifecycle to graph-infra lifecycle. Reindexing the code graph would bounce the trace buffer — surprise behavior users don't expect.
- Conflates two scopes that belong to different mental models (working-agent memory vs project runtime visibility).
- Makes `indusk-infra` heavier and harder to reason about as a single unit.

The admin-UI precedent (machine-global daemon, separate from indusk-infra) already established the right separation. Local-telemetry inherits it.

### 2. Custom OTel Collector + SQLite (no Jaeger)

Build a custom backend: Collector receives OTLP, writes traces to SQLite, serves a custom query API.

**Rejected because:**
- Reinvents trace storage, query, and indexing — all things Jaeger has solved for years and will continue to maintain without us.
- Loses the free Jaeger UI at `:16686`, meaning we'd have to build our own even for sanity checking.
- Custom OTLP trace ingestion is a significant implementation project on its own. The comparable implementations (Tempo, Jaeger, SigNoz) are each multi-year efforts.
- Maintenance debt compounds — OTel spec evolves, trace formats evolve, and a custom backend has to keep up.

### 3. Full Grafana stack (Tempo + Loki + Prometheus + Grafana)

Deploy the CNCF Grafana-centric observability stack locally.

**Rejected because:**
- Dashboard-first mental model — wrong fit for "why did this just fail" diagnosis. Consumers would get a rich interface they don't need and don't want.
- Bundle weight ~500 MB+; overkill for short-term buffer use case.
- PromQL / LogQL / TraceQL are three query dialects to learn for marginal value over Jaeger's native search.
- Metrics pipeline is out of scope — Grafana includes it whether we want it or not.

Grafana is the right choice for period-over-period SRE monitoring. That's Dash0's job in this architecture, not the dev-diagnosis daemon's.

### 4. SigNoz or Honeycomb self-hosted

Deploy a third-party full observability product locally.

**Rejected because:**
- Even heavier than the Grafana stack.
- Vendor-specific UX, query language, and data model — consumer lock-in to something we don't want to be the default.
- Honeycomb is cloud-only for all practical purposes; self-hosting is unsupported.
- SigNoz's ClickHouse dependency drags in a database consumers don't need.

### 5. Direct-to-Jaeger OTLP without an OTel Collector

Have services export directly to Jaeger's built-in OTLP receiver (supported since Jaeger 1.35). Skip the Collector.

**Rejected because:**
- Projects have multiple services (game-server, admin-server, UI, eval agent, etc.). Each would need its own batching / retry / filtering / backpressure config — the classic "sidecar on every service" anti-pattern.
- No fan-out. Jaeger handles traces, so logs would need a completely separate export path from every service. A central Collector fans out to both trace and log sinks from one receiver.
- Future downstream exporters (sample-fraction-forward-to-Dash0, OpenInference for LLM spans, custom processors) can't be added without touching every service. With the Collector, they're one config change.

The "one extra image in the daemon" cost is more than repaid by the architectural clarity.

### 6. Skip logs in v1 (traces only)

Ship v1 with only the Jaeger trace path; defer logs to v2 with `tail_logs` as a placeholder MCP tool.

**Rejected because:**
- Half of "why did this fail" diagnosis is log context, not trace shape. An error status in a trace tells you *where* it broke; the log at that span tells you *what went wrong*.
- An MCP tool named `tail_logs` that returns "not yet implemented" undermines the plan's own success claim. Better to ship with it structural than to ship a promise-placeholder.
- The Collector already solves log ingestion — once it's in the bundle, adding a SQLite file exporter for logs is incremental, not a separate project.

### 7. Bundle the daemon into indusk-mcp as a process (no container)

Run Jaeger + Collector as native processes managed by Node, like admin-UI's daemon.

**Rejected because:**
- Jaeger and OTel Collector are Go binaries — pulling them as Node dependencies isn't how either project distributes. Distribution becomes our problem (platform-specific binaries, update pipeline).
- The container-image path is already well-traveled and well-supported upstream.
- OrbStack/Docker is already a prerequisite for `indusk-infra`; adding a second container is zero new platform requirement.

## Consequences

### Positive

- **Dev diagnosis loop closes in seconds.** Single MCP call, local query, <500 ms p95 per the spike-validated budget. The user's stated "total agent visibility" target moves from aspirational to demonstrable.
- **Dev Dash0 quota → zero.** Staging + prod monitoring cost stabilizes; developers stop feeling bad about emitting verbose spans during tests.
- **Decoupled from `indusk-infra`.** Telemetry restart doesn't bounce the code graph; reindex doesn't bounce the trace buffer. Different concerns stay separate.
- **Matches admin-UI precedent.** Consumers already know the daemon pattern. One new CLI command set (`indusk telemetry *`) with the exact same shape they've used for `indusk ui *`.
- **Foundation for autonomy arc.** `telemetry-watcher-agent` can be briefed against a known substrate. `test-strategy-convention` gets the instant-diagnosis UX its Part 2 anti-drift discipline needs.
- **Extension pattern reuse.** Zero new architectural concepts — just another extension with a `.env` template and an MCP tool surface. Consumers learn nothing new.

### Negative

- **Two machine-global daemons now.** After admin-UI (1.27.x) and telemetry (this plan), consumers run two long-lived daemons. Both auto-start, but both are background processes consuming resources.
- **~210 MB container image.** Pulled once per machine (or built once from a bundled Dockerfile). Not trivial on slow connections.
- **Collector config locked in v1.** Consumers with custom filtering/sampling needs can't add processors without a v2 merge point. This will force a follow-up plan when enough consumers hit the wall.
- **SQLite log retention is short by design.** Not a drop-in replacement for long-term log search. Users migrating from Dash0 UI workflows will notice.
- **One more daemon to forget about.** `indusk telemetry status` exists but consumers won't routinely check it. Stale daemons after version upgrades are a class of friction we'll see.

### Risks

| Risk | Mitigation |
|------|------------|
| Jaeger query latency exceeds 500 ms for realistic loads (100+ spans across 5 s) | Spike measures early; if budget can't be met, either storage mode changes (in-memory over Badger) or budget renegotiates in the ADR addendum. A12 assertion captures the commitment explicitly. |
| SQLite log sink becomes a bottleneck under high log volume | Rolling retention by row-count or time-window caps size; Collector's file exporter can be swapped if SQLite proves too slow. Spike validates write cost. |
| Container image distribution (registry vs local-build) creates deployment friction | Spike measures both paths; registry wins if we have a publishing pipeline (we don't yet), local-build wins if tarball size stays reasonable. Either choice is reversible post-spike. |
| Auto-start of daemon at extension enable surprises consumers who don't expect background processes to spawn | Clear CLI output at enable ("Starting local telemetry daemon...") + `indusk telemetry status` shows it. Same pattern consumers already accepted for admin-UI. |
| Consumer has conflicting OTel export config (e.g., manually set OTEL_EXPORTER_OTLP_ENDPOINT that overrides the extension's) | Extension manifest flags this as a known interaction; docs call it out; error messaging at `indusk init` surfaces conflicts. |
| OrbStack/Docker unavailable on the user's machine | Same prerequisite as indusk-infra — already required, no regression. Error message at `indusk telemetry start` names the missing dependency. |
| Collector's internal routing is opaque to consumers debugging end-to-end pipelines | Sanity-check surface is Jaeger UI (`:16686`) + `indusk telemetry tail`. If pipeline debugging becomes common pain, the v2 merge point + per-pipeline status comes forward. |

## Documentation Plan

### Pages

- **New:** `apps/indusk-docs/src/reference/telemetry/overview.md` — daemon model, the extension, the MCP tool surface, `indusk telemetry` CLI lifecycle + query, environment routing (dev / staging / prod), migration from bare `dash0` setup.
- **New:** `apps/indusk-docs/src/reference/telemetry/cli.md` — full CLI reference parallel to `reference/admin-ui/cli.md`: `start/stop/restart/status` lifecycle + `tail/trace/services/reset` query + flags + exit codes + env vars (`INDUSK_HOME`) + port behavior.
- **New:** `apps/indusk-mcp/extensions/local-telemetry/skill.md` — when to use, how to query, patterns for the agent.
- **Update:** `apps/indusk-docs/src/changelog.md` — 1.28.0 entry naming the daemon, the MCP tools, the CLI, the `dash0`-adjacent env routing pattern.
- **Update:** `CLAUDE.md` Current State + Key Decisions (handled by context skill at plan close).

### Diagrams

- **Architecture Mermaid in `overview.md`:** sequence diagram showing `indusk telemetry start` → daemon container up → service emits OTLP to `localhost:4318` → Collector receives → fans to Jaeger (traces) + SQLite (logs) → agent calls MCP tool → daemon query → JSON response. Parallel to admin-UI's overview diagram.
- **Pipeline ascii diagram in `overview.md`:** services → Collector → Jaeger / SQLite. Same shape as research.md.
- **Routing tree in `cli.md`:** CLI → daemon lifecycle + query subcommands.

### Changelog

- **1.28.0:** `local-telemetry` extension + machine-global telemetry daemon. `indusk telemetry start/stop/restart/status` + `tail/trace/services/reset`. Dev OTel routes to local Jaeger + SQLite log sink; staging/prod unchanged (Dash0). MCP tools `get_recent_spans`, `get_trace`, `get_services`, `tail_logs` for direct agent-side query. Extension auto-starts the daemon on enable, stops it when the last registered project disables. Breaking change: none (purely additive). Migration note: existing projects using `dash0` for dev can opt into `local-telemetry` via `indusk extensions enable local-telemetry` and moving the dev `OTEL_EXPORTER_OTLP_ENDPOINT` per the extension's `.env` template.

### ADR in Docs

Yes — publish to `apps/indusk-docs/src/decisions/local-telemetry.md` at retrospective. The seven-clause Y-statement, the full alternatives-considered list (especially the Grafana-stack + custom-backend rejections), and the daemon-pattern reuse rationale are all worth preserving as an architectural record for consultants and future readers.

## References

- [research.md](./research.md) — prior-art scan, candidate backend comparison, OTel Collector pipeline decision, six open questions for the impl Phase 1 spike
- [brief.md](./brief.md) — problem framing, Proposed Direction, Success Criteria, Depends On / Blocks
- [test-plan.md](./test-plan.md) — 22 behavioral assertions + 3 untestable rows with mitigations
- [`../admin-ui-hosting/adr.md`](../admin-ui-hosting/adr.md) — machine-global daemon precedent (1.27.x)
- [`apps/indusk-mcp/extensions/dash0/`](../../../apps/indusk-mcp/extensions/dash0/) — extension + `.env` pattern precedent
- [`apps/indusk-mcp/templates/instrumentation.ts`](../../../apps/indusk-mcp/templates/instrumentation.ts) — current env-driven OTel exporter scaffold (no changes required)
- [`.indusk/research/test-strategy/induskbrief.md`](../../research/test-strategy/induskbrief.md) — downstream consumer plan's research doc (benefits from local span visibility for integration-test diagnosis)
- [`../telemetry-watcher-agent/`](../telemetry-watcher-agent/) (not yet created) — downstream plan that tails this buffer and surfaces anomalies
- [Jaeger Getting Started](https://www.jaegertracing.io/docs/latest/getting-started/)
- [OTel Collector Pipelines](https://opentelemetry.io/docs/collector/configuration/)
