---
title: "Local Telemetry"
date: 2026-04-20
status: accepted
---

# Local Telemetry — Brief

## Problem

Every InDusk-scaffolded project emits OTel traces + logs via `instrumentation.ts`, but dev telemetry today either goes to Dash0 (burning production-tier quota on dev noise, cloud round-trip to query, agent can't access directly) or nowhere (when `otel.role: library` silences it). Neither path supports the loop that matters most during development: **"I just ran X. Why did it fail?"** Today that means re-running with verbose logs, or clicking through Dash0's query UI and pasting results back into the chat. The agent can't diagnose from runtime state because runtime state isn't reachable.

The broader arc is autonomy. A working agent that can see what just happened is a working agent that can debug its own failures. A watcher agent that sees anomalies as they occur (a downstream plan) is only possible on top of a local, queryable telemetry substrate.

## Proposed Direction

Ship local-telemetry as **a new InDusk extension** (alongside `dash0`, `otel`, `graphiti`, etc. — same manifest + skill + `.env` shape the existing extension system already supports) PLUS **a machine-global daemon** managed by a new `indusk telemetry` CLI following the 1.27.x admin-UI pattern. Enabling the extension:

1. **Registers the project** with the machine-global telemetry daemon (writes the project entry to `~/.indusk/telemetry/projects.json`) and auto-starts the daemon if it isn't already running.
2. **Writes the extension's `.env`** template (dev profile) pointing the project's services at `http://localhost:4318` — the OTel Collector receiver inside the daemon. Developer writes this directly, or has ce populate it from an `env/components/local-telemetry.env` component. Same pattern as `dash0`. When the extension is enabled, the scaffolded `instrumentation.ts` (already env-driven) emits to the local daemon.
3. **Adds MCP tools** (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) that wrap the daemon's query surface — Jaeger's REST API for traces, the SQLite log sink for logs. Agent calls one tool when diagnosing, no cloud round-trip.

The daemon itself is one container image shipped in the indusk-mcp tarball (or pulled from a registry; spike decides). Contents: OTel Collector (receiver + fan-out) → Jaeger (trace storage + UI at `:16686` + REST query) + SQLite log sink (queryable via MCP). Lifecycle:

```
indusk telemetry start     # ensure the bundled container is up on 4318/16686
indusk telemetry stop      # SIGTERM, same shape as `indusk ui stop`
indusk telemetry restart   # post-upgrade, like `indusk ui restart`
indusk telemetry status    # running/not + listening ports + registered project count
indusk telemetry tail/trace/services/reset   # query CLI parallel to the MCP tool surface
```

Decoupling from `indusk-infra` is deliberate: `indusk-infra` is working-agent graph infrastructure (FalkorDB + Graphiti), and coupling telemetry to it means the trace buffer bounces whenever the code graph is reindexed. Independent daemon → independent lifecycle → simpler mental model.

**Dev vs staging/prod** falls out of the extension model for free: local-telemetry enabled → dev traces go to the local daemon. `dash0` extension enabled → staging/prod traces go to Dash0. A project running both environments from the same codebase enables both extensions; composable.env (or plain env files) picks which is active at runtime.

The OTel Collector is structural, not optional. One project typically runs multiple services (game-server, admin-server, UI, eval agent, etc.); per-service sidecar exporters mean per-service batching / retry / filtering config duplicated everywhere. The Collector centralizes that once. Future downstream exporters (sampling-fraction-forward-to-Dash0, OpenInference for LLM spans, anything) bolt onto the Collector without touching services.

The eval agent's existing OTel (routing to Dash0's `agent` dataset) is untouched — it's always production-grade telemetry about InDusk itself, unrelated to project runtime.

**Critical discipline, explicit:** this is not an observability stack. No dashboards (Jaeger's minimal built-in UI is the entire human-facing surface, and that's a sanity-check tool, not a monitoring tool), no metric alerts, no long-term retention, no PromQL. Short-term diagnostic buffer (minutes-to-hours of retention), agent-queryable, human-pokeable. If someone proposes Grafana next quarter, this brief says no.

## Context

- Detailed prior-art scan, candidate backend comparison, MCP tool shape, and the six open questions the impl-Phase-1 spike will resolve live in [`research.md`](./research.md).
- `instrumentation.ts` scaffolded by `indusk init` is already env-driven via OTel standard env vars; this plan adds defaults, not a new API.
- The `indusk-infra` container precedent (FalkorDB + Graphiti, bundled, one docker command) is the model — one more service alongside, not a new container per consumer.
- The three-tier agent model (working agent / eval agent / infrastructure — see CLAUDE.md Architecture) places local-telemetry in the infrastructure tier. The working agent consumes via MCP; the downstream `telemetry-watcher-agent` plan adds a second async-observer tier that tails the buffer and surfaces anomalies.
- Adjacent: `.indusk/research/test-strategy/induskbrief.md` — the to-be-planned test-strategy convention benefits from local spans (integration + E2E tests emit traces you can inspect instantly rather than re-running with `--verbose`), but doesn't strictly require this plan to ship first.

## Scope

### In Scope

- **New extension `apps/indusk-mcp/extensions/local-telemetry/`** with `manifest.json` + `skill.md` + `.env` template (same shape as `dash0`). Enabling the extension registers the project with the telemetry daemon, writes the project's OTel endpoint env var, and surfaces the MCP tools.
- **Machine-global telemetry daemon** packaged as one container image (Jaeger + OTel Collector + SQLite log sink) shipped in the indusk-mcp tarball or pulled from a registry (spike decides distribution). OTLP HTTP (4318), OTLP gRPC (4317), Jaeger UI (16686).
- **`indusk telemetry` CLI** parallel to `indusk ui` — `start/stop/restart/status` for lifecycle; `tail/trace/services/reset` for queries.
- **Daemon metadata at `~/.indusk/telemetry.{pid,json,log}`** + **registry at `~/.indusk/telemetry/projects.json`** listing which projects have enabled the extension.
- **Extension enable auto-starts the daemon** if it isn't running (same courtesy admin-UI gives); extension disable deregisters the project and stops the daemon if no projects remain.
- **Extension `.env` template** sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` + retention knobs. Developer can write it directly or populate from an `env/components/local-telemetry.env` ce component — standard extension-env pattern.
- **MCP tool surface** (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) wrapping the daemon's query surfaces.
- **OTel Collector pipeline** — receives from services at 4318, fans out to Jaeger (traces) and SQLite log sink (logs). Collector config ships as part of the bundled container; v1 is locked (no consumer customization), v2 may expose a merge point for custom processors.
- **`indusk init` integration** — adding `local-telemetry` to the enabled-extensions set during init wires everything via the existing extension activation path.
- **Docs:** new reference page `reference/telemetry/overview.md` describing the daemon, the extension, the MCP tool surface, and the CLI. Migration note in changelog for existing projects.
- **Impl Phase 1 = hands-on research spike.** Actual wiring + query-latency measurement + container-packaging shape + distribution mechanism, output captured in `spike-findings.md` which also feeds the `telemetry-watcher-agent` plan.

### Out of Scope

- **Dashboards.** No Grafana, no Jaeger-as-SRE-tool. `localhost:16686` is Jaeger's own minimal UI; that's it.
- **Metric alerts.** No threshold-based alerting, no PromQL, no Alertmanager.
- **Long-term retention.** Short buffer only. If you need 30-day history, that's Dash0.
- **Production observability.** Dash0 stays the prod/staging backend. This plan changes nothing in prod.
- **Metrics.** OTel metrics pipeline stays as-is. Local-telemetry is traces + (maybe) logs only.
- **The watcher agent itself.** `telemetry-watcher-agent` is a separate downstream plan. This plan delivers the substrate it consumes.
- **Eval agent OTel rerouting.** Eval agent keeps its Dash0 `agent` dataset.
- **Cross-machine / team sharing.** Local means the developer's machine. No remote access, no shared team telemetry view.
- **Retention tuning UI.** Config via env var / CLI flag is fine; no admin UI for this.

## Success Criteria

1. **The "why did this fail" loop closes in seconds.** After a dev run fails, the agent answers "why?" by calling one MCP tool and reading the result — no Dash0 access, no `docker logs` grep, no verbose re-run.
2. **Dev Dash0 quota goes to zero.** After rollout + migration, no project's dev profile exports to Dash0. Staging + prod unchanged.
3. **Test runs emit inspectable telemetry.** Integration + E2E test failures surface real server-side traces the agent can pull immediately. Enables the follow-up test-strategy plan's diagnosis use cases.
4. **`indusk-infra` stays pragmatic.** Bundle weight after adding Jaeger (+ optional Collector) stays under ~800 MB. If it exceeds, re-scope.
5. **Environment-aware routing survives `indusk init` on a fresh project.** A newly scaffolded project ships with the right env vars per profile and emits to Jaeger in dev without the developer editing anything.
6. **Jaeger's trace UI is reachable at `localhost:16686` when started.** Proves the bundled service is healthy and usable for human eyeballing.
7. **MCP tool calls return in under 500 ms** for realistic dev loads (spike validates; budget captured in success criteria so the "fast feedback" claim is concrete).
8. **Spike findings feed the watcher plan.** `spike-findings.md` contains enough concrete data (Jaeger query latency, log sink decision, storage choice, retention behavior) that `telemetry-watcher-agent`'s brief can be authored without re-doing the spike.

## Depends On

- None structurally. `indusk-infra` container exists; `instrumentation.ts` is already env-driven; composable.env is available for wiring defaults.

## Blocks

- [`telemetry-watcher-agent`](../telemetry-watcher-agent/) (not yet created) — the async-observer plan that tails the local telemetry stream and surfaces anomalies. Requires the buffer to exist and be queryable.
- [`test-strategy-convention`](../test-strategy-convention/) (not yet created) — formalizes the project-level test layer per `.indusk/research/test-strategy/induskbrief.md`. Benefits materially from local span visibility during integration + E2E tests, though doesn't strictly block on it.
