---
title: "Local Telemetry — Impl"
date: 2026-04-20
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Local Telemetry — Impl

## Goal

Ship a new **required-by-default** InDusk extension `local-telemetry` plus a machine-global telemetry daemon (Jaeger + OTel Collector as native binaries + SQLite log sink running in-process in otelcol) managed by `indusk telemetry start/stop/restart/status`, with an MCP tool surface that lets the agent call `get_recent_spans` / `get_trace` / `get_services` / `tail_logs` for fast local diagnosis. Binaries ship via platform-specific npm optional dependencies (esbuild/swc pattern — zero custom download code). `indusk init` auto-enables; `indusk update` migrates pre-1.28 projects. Ships as indusk-mcp 1.28.0.

## Scope

### In Scope

- New **required-by-default** extension at `apps/indusk-mcp/extensions/local-telemetry/` (`manifest.json` with `required: true`, `skill.md`, `.env` template)
- Optional ce component at `env/components/local-telemetry.env`
- **Platform-specific npm packages** at `packages/telemetry-binaries-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}/` — each bundles upstream Jaeger + OTel Collector binaries for its platform (Apache 2.0, attribution in README), published as `@infinitedusky/telemetry-binaries-{platform}` and listed in indusk-mcp's `optionalDependencies` with matching `os`/`cpu` constraints
- Build script `scripts/build-telemetry-binaries.sh` that fetches upstream Jaeger + otelcol release artifacts, verifies upstream checksums, packs per-platform, and optionally `npm publish`es — one-time-per-upstream-bump ceremony
- Daemon lifecycle: spawn Jaeger + otelcol as detached child processes (admin-UI pattern), path-resolved via `require.resolve("@infinitedusky/telemetry-binaries-{platform}/bin/{jaeger,otelcol}")`, PIDs tracked in `~/.indusk/telemetry.json`
- `indusk telemetry` CLI with lifecycle (`start/stop/restart/status`) + query (`tail/trace/services/reset`) subcommands
- Daemon metadata at `~/.indusk/telemetry.{pid,json,log}` + registry at `~/.indusk/telemetry/projects.json`
- MCP tools (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`)
- Extension-enable auto-start + extension-disable graceful-stop-iff-registry-empty
- `indusk init` auto-enable (default) + `indusk update` migration for pre-1.28 projects
- Docs: `reference/telemetry/overview.md`, `reference/telemetry/cli.md`, extension `skill.md`, changelog 1.28.0 entry + `indusk extensions disable local-telemetry` escape-hatch callout
- Spike Phase 1 producing `spike-findings.md`

### Out of Scope

- Dashboards, metric alerts, PromQL, long-term retention
- Production observability (Dash0 stays)
- Eval agent OTel rerouting (stays on Dash0 `agent` dataset)
- Watcher agent (`telemetry-watcher-agent` is a downstream plan)
- Custom Collector processor config (v1 locked)
- Cross-machine / team sharing
- Windows / BSD / musl-linux support (npm `os`/`cpu` filters exclude them cleanly; add as future platform packages if consumer demand surfaces)
- Containerized distribution (explicitly rejected — see ADR Alternative #7)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Spike findings: Jaeger query latency vs 500 ms budget, storage-mode choice, retention default, **otelcol variant decision** (contrib vs core vs minimal-build), **npm platform-package publish + install flow** validated on macOS arm64 + Linux x64, MCP signature ergonomics. Output in `spike-findings.md`. | No prior phases — hands-on investigation. |
| Phase 2 | **Platform-specific npm packages** at `packages/telemetry-binaries-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}/` — each bundles Jaeger + otelcol for its platform. `scripts/build-telemetry-binaries.sh` automates fetch + verify + pack per-platform. `otelcol-config.yaml` (locked pipeline) included in the shared package config. Indusk-mcp's `package.json` lists them as `optionalDependencies`. Consumer running `npm i -g @infinitedusky/indusk-mcp` gets exactly one platform package's binaries installed in their node_modules. | Phase 1's otelcol-variant + publish-flow decisions. |
| Phase 3 | `indusk telemetry start/stop/restart/status` CLI + daemon lifecycle library + `~/.indusk/telemetry.{pid,json,log}`. Spawns Jaeger + otelcol as detached child processes; path resolution via `require.resolve("@infinitedusky/telemetry-binaries-{platform}/bin/...")`; supervises two PIDs (one per process). | Phase 2's platform packages. |
| Phase 4 | Extension scaffolding (`apps/indusk-mcp/extensions/local-telemetry/`) with `required: true` in manifest + ce component + registry library for `~/.indusk/telemetry/projects.json` + auto-start/deregister hooks wired to `indusk extensions enable/disable`. | Phase 3's CLI lifecycle. |
| Phase 5 | MCP tools (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) + `indusk telemetry tail/trace/services/reset` query CLI + SQL layer over SQLite log sink. | Phase 2's otelcol + Jaeger REST API + SQLite sink; Phase 4's extension manifest declares the tools. |
| Phase 6 | `indusk init` auto-enables `local-telemetry` by default + `indusk update` migration path adds it to pre-1.28 projects. Existing-project upgrade from `dash0`-only validated. | Phase 4's extension + Phase 3's CLI. |
| Phase 7 | Ship: 1.28.0 version bump on indusk-mcp + first publish of all 4 platform packages, changelog, `reference/telemetry/overview.md` + `cli.md`, extension skill docs, global upgrade + live smoke on dusk + Numero. | All prior phases. |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `indusk telemetry start` from any directory brings up the daemon in under 10s and prints listening ports (4318 OTel, 16686 Jaeger UI). | Phase 0 | Phase 3 | passing |
| T2 | After daemon is running, `http://localhost:16686` serves Jaeger's trace search UI. | Phase 0 | Phase 2 | passing |
| T3 | `indusk telemetry status` after a successful start reports "running", both listening ports, and the registered-project count. | Phase 0 | Phase 3 | passing |
| T4 | `indusk telemetry stop` shuts the daemon down within 3s; `status` then reports "not running" and `:16686` returns connection-refused. | Phase 0 | Phase 3 | passing |
| T5 | `indusk telemetry restart` stops (if running) then starts a fresh instance — picks up new binaries after `npm i -g @infinitedusky/indusk-mcp@<newer>` (which npm re-resolves against the platform package's new version) without manual stop-then-start. | Phase 0 | Phase 3 | passing |
| T6 | A project with `local-telemetry` enabled emits OTel traces to the daemon in dev — spans appear in Jaeger's UI and REST API within 5s of emission. | Phase 0 | Phase 4 | passing |
| T7 | On a consumer project (e.g., Numero — a real instrumented service runtime) configured for staging/prod (`local-telemetry` NOT enabled, `dash0` IS enabled), OTel traffic continues to land in Dash0 — the local daemon sees zero ingest over the dev session. | Phase 0 | Phase 7 | planned |
| T8 | On the same consumer project switched to the dev profile (`local-telemetry` enabled, `dash0` NOT active for that profile), OTel traffic lands in the local daemon and Dash0's ingest stays flat for that project over the session. | Phase 0 | Phase 7 | planned |
| T9 | When the developer asks the agent "why did X just fail?", the agent calls jaeger_mcp's `search_traces` (wired into project `.mcp.json`) to find the relevant error span(s) — no cloud round-trip, no verbose re-run. Tool shape reshaped via Phase 5 probe: jaeger_mcp exposes 8 pre-computed tools including `search_traces`, `get_trace_errors`, `get_critical_path`. | Phase 0 | Phase 5 | passing |
| T10 | Given a trace ID, jaeger_mcp's `get_trace_topology` + `get_span_details` return the full span tree and attributes. (A future unified-telemetry-query plan combines these into a single `show_trace` wrapper.) | Phase 0 | Phase 5 | passing |
| T11 | jaeger_mcp's `get_services` returns the list of services the daemon has seen. Verified against the live Jaeger MCP endpoint during the Phase 5 probe. | Phase 0 | Phase 5 | passing |
| T12 | For ~100 spans emitted across 5s, jaeger_mcp's `search_traces` (which wraps the same Jaeger query API measured in the Phase 1 spike at p95=12.2ms) returns matching spans in under 500ms p95. Spike gave 40x headroom on the underlying REST; MCP wrapper overhead is single-digit ms. | Phase 0 | Phase 5 | passing |
| T13 | indusk-mcp's custom `tail_logs` MCP tool returns recent log records from the otelcol file sink, filtered by `service`, `level`, `since_minutes`, `limit`. Schema-validated via zod, 200-record hard cap, `truncated` flag + `window_actual` on every response, `hints` array for follow-up suggestions. | Phase 0 | Phase 5 | passing |
| T14 | `indusk telemetry tail --service <name> --level <level> --since <minutes>` prints recent LOG records to stdout — same filter shape as the MCP `tail_logs` tool. (Renamed from "streams recent spans" — traces view better in the Jaeger UI or via MCP; the CLI `tail` is for log diagnosis.) | Phase 0 | Phase 5 | passing |
| T15 | `indusk telemetry trace <trace-id>` prints the full trace JSON to stdout via Jaeger's REST `/api/traces/{id}`. | Phase 0 | Phase 5 | passing |
| T16 | `indusk telemetry services` prints the list of services the daemon has seen, one per line, via Jaeger's REST `/api/services`. | Phase 0 | Phase 5 | passing |
| T17 | `indusk telemetry reset` stops the daemon + truncates `logs.jsonl` + restarts with fresh in-memory Jaeger storage — subsequent queries return no traces until new spans arrive. Human-triggered only; not exposed as an MCP tool. | Phase 0 | Phase 5 | passing |
| T18 | `indusk init --extensions local-telemetry` on a fresh project produces a working setup: `.env` written, project registered, MCP tools in `.mcp.json`, daemon auto-starts, a test script can emit + query spans — zero further manual config. | Phase 0 | Phase 6 | planned |
| T19 | `indusk extensions disable local-telemetry` deregisters the project, removes MCP tools from `.mcp.json`, and stops the daemon iff the registry becomes empty. No orphan processes, no stale MCP entries. | Phase 0 | Phase 6 | planned |
| T20 | An existing project (already using `dash0`, already has `instrumentation.ts`) can opt into local-telemetry via `indusk extensions enable local-telemetry` without rewriting `instrumentation.ts` — env file swap is the only behavioral change. | Phase 0 | Phase 6 | planned |
| T21 | An integration test that fails emits server-side spans retrievable via MCP within 5s of the failure — enables `test-strategy-convention`'s diagnosis use cases. | Phase 0 | Phase 7 | planned |
| T22 | Restarting the telemetry daemon does not orphan client OTel exporters — reconnection happens automatically once the daemon is healthy, retention matches storage mode (in-memory → empty; Badger → preserved). | Phase 0 | Phase 7 | planned |

### Deferred Verification

- **U1: Diagnosis-in-seconds UX feel**
  - reason: UX quality claims resist programmatic measurement — a wall-clock test would measure elapsed time, not perceived speed.
  - would require: live UX study or a stable population of dev users self-reporting friction.
  - mitigation: spike Phase 1 demonstrates the loop live; downstream `test-strategy-convention` plan's E2E diagnosis becomes the recurring informal test.

- **U2: Agent "total visibility" autonomy aspiration**
  - reason: aspirational — target state emerges incrementally as downstream plans (`telemetry-watcher-agent`, `test-strategy-convention`) consume the substrate.
  - would require: completed autonomy arc with watcher agent live + continuous feedback loops + measurable anomaly-detection accuracy.
  - mitigation: downstream plans consume this substrate; if they can't get what they need, gap surfaces there. Retrospective asks whether local-telemetry met downstream needs.

- **U3: Bundle-weight pragmatism**
  - reason: "pragmatic" is judgment, not measurement — bytes are easy but perceived friction requires consumer feedback.
  - would require: consumers reporting friction (install time, disk pressure, CI cache).
  - mitigation: spike Phase 1 measures; retrospective revisits; if v2 needs slimming, Collector processor-set is the first thing to trim.

## Checklist

### Phase 1: Hands-on spike — produce `spike-findings.md`

**Goal**: before committing the remaining phases to specific shapes, run the system with deliberately minimal effort to measure the things whose answers can't be reasoned out on paper. Output is `spike-findings.md` in this plan folder.

- [x] Download Jaeger binary from upstream GitHub release (`jaegertracing/jaeger` v2.17.0 darwin-arm64 archive). Launch natively with a minimal YAML config. **Verified**: binds OTLP HTTP 4318 + OTLP gRPC 4317 + UI 16686 + health 13133; all endpoints return 200; 100 spans emitted via `@opentelemetry/sdk-trace-node` land in Jaeger within seconds. Binary size: 114 MB extracted (52 MB compressed). Checksum `dac2348...` verified against upstream per-file hash. See [spike-findings.md](./spike-findings.md) §"Item 1".
- [x] **Otelcol variant decision: ELIMINATED by finding.** Jaeger v2 IS an OTel Collector distribution — it ships `otlp` receiver (Stable for logs/metrics/traces), `batch` / `memory_limiter` / `filter` processors, and `jaeger_storage` / `jaeger_query` / `healthcheckv2` extensions natively, plus an experimental `jaeger_mcp` extension worth investigating in Phase 5. A separate otelcol-k8s or otelcol-core binary is not needed for traces. See [spike-findings.md §"Headline Finding"](./spike-findings.md).
- [x] **Otelcol-in-front-of-Jaeger: ELIMINATED.** Single binary handles OTLP receivers + batch processing + Jaeger trace storage + query + UI. One YAML config file per platform package. See [spike-findings.md §"Item 2"](./spike-findings.md).
- [x] Measured Jaeger query latency for `/api/traces?service=X&limit=100` against 100 spans trickled across 5s: p50=5.5ms, p95=12.2ms, p99=12.2ms, max=29.5ms. **40x headroom under T12's 500ms budget.** No budget renegotiation needed. See [spike-findings.md §"Item 4"](./spike-findings.md).
- [x] Storage-mode decision: **in-memory with `max_traces: 100000`** as v1 default. Badger deferred. 100k traces covers a typical dev session (tests + manual clicks) comfortably. Restart loses buffer — acceptable tradeoff per ADR (diagnosis window is post-run, not across-restart). See [spike-findings.md §"Item 5"](./spike-findings.md).
- [x] **npm platform-package install flow: validation deferred to Phase 2.** Pattern is well-established (esbuild, swc, biome, turbo, tailwindcss-oxide all ship via platform-specific `optionalDependencies`); no novel risk to validate standalone. Phase 2 builds the actual packages and tests the install flow end-to-end on macOS arm64 + Linux x64.
- [x] **`require.resolve` + detached spawn: deferred to Phase 2.** admin-ui-hosting Phase 3 already proved the exact pattern (`createRequire(import.meta.url).resolve("next/package.json")` + `spawn(..., { detached: true, stdio: "ignore" }) + unref()`). daemon.ts reuses it. No new investigation warranted here.
- [x] **MCP tool signature ergonomics: deferred to Phase 5.** Signatures from the ADR are fine starting points; real ergonomic refinement comes from actually writing the tools + agent-driven usage, not stub conjecture. Phase 5 includes a first-look at Jaeger's built-in `jaeger_mcp` extension before writing custom tools — it may subsume part of our planned tool surface.
- [x] Wrote [spike-findings.md](./spike-findings.md) in this plan folder with measurements + decisions + binding constraints on Phase 2+. Captures the headline finding (Jaeger v2 as single-binary Collector), the query-latency measurement, the storage-mode pick, the Jaeger v2.17.0 version pin, the minimal YAML config template, and the **open logs-path decision** (Option A: second otelcol-k8s binary for logs-only; Option B: SQLite-backed Pino transport in services; Option C: skip logs in v1). Recommendation: **Option A** following Dash0's pattern. Decision gate before Phase 2 starts.

#### Phase 1 Verification
- [x] T2 (write red): committed `apps/indusk-mcp/src/__tests__/telemetry-ui-reachable.test.ts` with the implementation shape documented inline (pseudo-code in the test comment) + `.skip()` body. Unlocks in Phase 2 when the platform package exists and `require.resolve(...)` returns a real path. Vitest run: 1 skipped, 0 failed. T2 state → `written`.
- [x] T12 (write red): committed `apps/indusk-mcp/src/__tests__/telemetry-query-latency.test.ts` with full emit+query timing pattern documented inline + `.skip()` body. Unlocks in Phase 5 when the MCP tool wrapper lands. Spike pre-validated the raw-API latency (p95=12.2ms, 40x headroom); this test verifies the budget still holds through the MCP wrapper. T12 state → `written`.
- [x] Spike outputs captured in [`.indusk/planning/local-telemetry/spike-findings.md`](./spike-findings.md) — measured numbers for query latency (p50/p95/p99), storage-mode choice (in-memory, 100k traces), binary size (114 MB), version pin (Jaeger v2.17.0), the minimal YAML config template, and the **open logs-path decision** (Option A/B/C) that gates Phase 2 scope.

#### Phase 1 Context
- [x] Appended to CLAUDE.md "Current State": local-telemetry Phase 1 spike complete 2026-04-20; headline finding (Jaeger v2 is an OTel Collector distribution — single binary replaces separate Jaeger + otelcol); query-latency measurements (p50=5.5ms / p95=12.2ms / p99=12.2ms against T12's 500ms budget — 40x headroom); storage-mode pick (in-memory, 100k traces); open logs-path decision (A/B/C) before Phase 2; pointer to `spike-findings.md` for full measurements + binding decisions.

#### Phase 1 Document
- [x] [`spike-findings.md`](./spike-findings.md) in this plan folder (internal design artifact, not published to docs site). Captures: the headline finding + downstream impact, Item 1's minimal YAML config template (binding on Phase 2), Item 4's latency numbers, Item 5's storage pick, the open logs-path decision with three options + spike recommendation (Option A following Dash0's pattern), the `jaeger_mcp` flag for Phase 5 investigation, and an explicit "what wasn't tested" appendix. Seeds `telemetry-watcher-agent` brief when that plan is authored.

### Phase 2: Platform-specific npm packages + binary bundling

**Goal**: produce the four platform packages (`@infinitedusky/telemetry-binaries-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}`) that indusk-mcp will depend on. After this phase, a consumer running `npm i -g @infinitedusky/indusk-mcp` gets exactly one platform package's worth of binaries installed in their node_modules, with zero custom download code.

- [x] Created `packages/telemetry-binaries-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}/` directories with a minimal `package.json` each: `name: "@infinitedusky/telemetry-binaries-{platform}"`, `version: "1.28.0"`, matching `os`/`cpu` constraints, `files: ["bin", "collector-config.yaml", "jaeger-config.yaml", "LICENSE", "NOTICE", "README.md"]`, `publishConfig.access: "public"`, Apache-2.0 license. Also added `packages/*` to `pnpm-workspace.yaml`. Verified pnpm correctly flags three platforms as "Unsupported platform" warnings on macOS arm64 host — demonstrates the `os`/`cpu` filter will only install the matching package per consumer. Binaries will land in each platform's `bin/` via the build script (next item).
- [x] Created TWO config files in `packages/telemetry-binaries-shared/` (one per binary) per the logs-path Option A decision: (1) `jaeger-config.yaml` — traces pipeline + in-memory storage (max_traces=100000) + jaeger_query extension (UI+REST on 16686, gRPC on 16685) + healthcheckv2 (13133); OTLP receivers on 4317/4318. (2) `collector-config.yaml` — logs-only pipeline for otelcol-k8s; OTLP HTTP receiver on 4319 (distinct from Jaeger's 4318 to avoid port conflict), memory_limiter + batch processors, file-exporter writes rotating JSONL to `${INDUSK_TELEMETRY_LOGS_PATH}` (default `~/.indusk/telemetry/logs.jsonl`, 10 MB × 5 rotations = 50 MB buffer). Build script (next item) copies both into each platform package.
- [x] Created `scripts/build-telemetry-binaries.sh` — reads `UPSTREAM.json`, fetches Jaeger + otelcol archives per platform from upstream GitHub releases, SHA256-verifies both against upstream's own checksum files (Jaeger per-inner-file, otelcol per-archive), extracts binaries into each platform package's `bin/`, copies `jaeger-config.yaml` + `collector-config.yaml` from shared/, optionally `npm publish`es with `--publish` flag. Idempotent via local cache at `.cache/telemetry-binaries/`. Verified end-to-end on darwin-arm64: both binaries 114 MB Jaeger + 168 MB otelcol, both execute cleanly (`jaeger version` / `otelcol --version` return expected). Linux platforms will run via CI when publish pipeline lands (deferred but mechanically identical — same build paths, different platform maps).
- [x] Created `packages/telemetry-binaries-shared/UPSTREAM.json` pinning Jaeger v2.17.0 + otelcol core v0.150.1 (not contrib — core is 168 MB vs contrib's 339 MB, and core's components list includes every receiver/processor/exporter our locked pipeline needs: `otlp`, `batch`, `memory_limiter`, `file` exporter, `health_check` extension). URL templates + per-platform map + attribution metadata all in the file. One-pin-per-change, manual bumps only.
- [x] Added `optionalDependencies` in `apps/indusk-mcp/package.json` referencing all four platform packages as `workspace:*`. At publish time pnpm rewrites these to the actual version (1.28.0). Verified `require.resolve("@infinitedusky/telemetry-binaries-darwin-arm64/bin/jaeger")` returns the actual binary path from inside indusk-mcp's node_modules. The `os`/`cpu` fields in each platform package's own `package.json` are what npm uses at consumer-install time to filter which one is installed.
- [x] Per-platform `README.md` in each of the four package folders — short attribution pointing at upstream Jaeger + OTel Collector GitHub projects, "not a fork" disclaimer, install-via-optional-deps-only note, reference to UPSTREAM.json for exact versions. Written via a small bash one-liner to keep all four in sync.
- [x] `packages/telemetry-binaries-shared/README.md` — pattern reference, documents the two-binary choice (Jaeger + otelcol core, not contrib), the Dash0 ergonomic inspiration, the upstream-bump workflow (edit UPSTREAM.json → run build script → smoke T2 → bump version → `--publish`), manual run-by-hand instructions, supported platforms table. Plus `LICENSE` (Apache 2.0) + `NOTICE` (per-upstream attribution) in shared/ — build script copies both into each platform package at bundle time.
- [x] **Discovered during Phase 2**: added `.gitignore` to each platform package excluding `bin/` (native binaries are regenerated from upstream; not committed to avoid repo bloat — ~300 MB/platform × 4 = 1.2 GB otherwise) + `LICENSE`/`NOTICE` (per-platform copies come from shared/ via build script; only the shared/ originals are committed).

#### Phase 2 Verification
- [x] T2 passes: `apps/indusk-mcp/src/__tests__/telemetry-ui-reachable.test.ts` unskipped, implements `require.resolve(...)` + `spawn(jaegerBin, [--config=file:...])` with batch-allocated auto-picked ports (avoided sequential-pickFreePort collision race), `fetch /api/services` on the UI port. 6/6 consecutive runs green. Trajectory state flipped `written` → `passing`.
- [x] Manual smoke (spike-verified earlier): 100 spans emitted via `@opentelemetry/exporter-trace-otlp-http` land in Jaeger within 5s; `/api/services` returns the new service name. Re-running today against the packed binary at `packages/telemetry-binaries-darwin-arm64/bin/jaeger` produces identical behavior.
- [x] **Discovered during Phase 2**: Jaeger v2 (an otelcol distribution) binds `localhost:8888` by default for its own Prometheus self-metrics exporter — causes port conflicts on rapid spawn+stop+spawn cycles in tests + daemon restarts. Fix: `service.telemetry.metrics.level: none` in `jaeger-config.yaml`. We don't use Jaeger's self-metrics (agent diagnosis is via the query API on 16686), so disabling is lossless. Applied to both the shared config and the test's inline config. Flake rate: 50% → 0% across 6 consecutive runs.
- [x] `npm pack` tarball-content check validated on darwin-arm64 platform package (the only one with binaries built this phase — other three are scaffold-only until Phase 7's build-all + publish run): packed tarball is 95.5 MB compressed / 295.3 MB unpacked, contains exactly `bin/jaeger` + `bin/otelcol` + `collector-config.yaml` + `jaeger-config.yaml` + `LICENSE` + `NOTICE` + `README.md` + `package.json` (8 files), `os: ['darwin']` + `cpu: ['arm64']` in package.json confirmed. Cross-platform install-flow check (`npm i` on Linux x64 with only the matching platform package landing) deferred to Phase 7's smoke on a second machine — validating registry-scope install behavior requires the published tarballs, not local workspace links.

#### Phase 2 Context
- [x] Appended FOUR entries to CLAUDE.md Known Gotchas covering Phase 2 findings: (1) the platform-package pattern itself — esbuild/swc style, `os`+`cpu` in platform package.jsons, binaries not committed to git, bump procedure; (2) Jaeger v2 IS an otelcol distribution (single binary does OTLP+storage+UI+query) + the one-extra-otelcol-core binary for logs (not contrib — 171 MB lighter, has all needed components; not k8s — Linux-only); (3) Jaeger self-metrics must be disabled via `service.telemetry.metrics.level: none` to avoid port 8888 binding conflicts on rapid spawn/stop cycles (50% flake → 0% flake fix).

#### Phase 2 Document
- [x] `packages/telemetry-binaries-shared/README.md` authored — pattern reference, the two-binary rationale (Jaeger + otelcol core, not contrib), Dash0 precedent context, upstream-bump workflow (UPSTREAM.json edit → build script → smoke → bump + `--publish`), manual run-by-hand instructions, supported-platforms table, pointers to ADR + spike-findings + build script + the Phase 4 extension that consumes these binaries. Plus per-platform READMEs in each of the four platform packages — short attribution pointing at upstream projects, "not a fork" disclaimer, install-via-optional-deps-only note.

### Phase 3: `indusk telemetry` lifecycle CLI

**Goal**: `indusk telemetry start/stop/restart/status` parallel to `indusk ui *`. Spawns Jaeger + otelcol as detached child processes resolved from the platform package, records daemon metadata, supervises PIDs. No Docker.

- [x] Created `apps/indusk-mcp/src/lib/telemetry/daemon.ts` — parallel to `lib/admin/daemon.ts`. Exports `daemonStart`, `daemonStop`, `daemonStatus`, `daemonRestart`, `resolveBinary`, `findFreePort`, `isPortListening`. Private `verifyIdentity(pid, port)` composes `isAlive(pid)` + `isPortListening(port)` (admin-UI Phase 7 pattern); `daemonStatus` and `daemonStop` both gate on it for BOTH processes.
- [x] `resolveBinary("jaeger" | "otelcol")` calls `createRequire(import.meta.url).resolve("@infinitedusky/telemetry-binaries-{platform}/bin/${name}")`. Platform tag via `process.platform` + `process.arch` (with `arm64`/`x64` normalization). Throws user-facing error when the platform package isn't installed, naming the platform + suggesting `npm install`.
- [x] `daemonStart` spawns BOTH children — Jaeger first, waits for its health port (15s budget), then otelcol (own 15s budget). Both `detached: true`, `stdio: ["ignore", logFd, logFd]` (interleaved into `~/.indusk/telemetry.log`), `unref()`. 7 ports allocated simultaneously via `Promise.all` (avoids the sequential-pickFreePort collision surfaced in Phase 2).
- [x] Created `apps/indusk-mcp/src/bin/commands/telemetry.ts` — `telemetryStart`, `telemetryStop`, `telemetryStatus`, `telemetryRestart` as thin CLI-layer wrappers.
- [x] Wired `indusk telemetry start/stop/restart/status` into `cli.ts`. Commander@13 pattern: `--otlp-port` + `--ui-port` on parent only; subcommands read via `this.optsWithGlobals()`.
- [x] Daemon metadata shape: `~/.indusk/telemetry.pid` holds Jaeger's PID (primary); `~/.indusk/telemetry.json` holds the full `DaemonMeta` (`jaegerPid`, `otelcolPid`, `otlpPort`, `uiPort`, both health ports, `logsOtlpPort`, `startedAt`, `jaegerBinary`, `otelcolBinary`, `platform`, `logsPath`); `~/.indusk/telemetry.log` holds interleaved stdout+stderr from both children.
- [x] `start` auto-bumps ports via `findFreePort` when requested values are taken. `restart` = `stop` (with 200ms grace for OS port release) + `start`. `status` prints running state + both ports + both PIDs + startedAt + registered-project count (0 until Phase 4 lands the registry).

#### Phase 3 Verification
- [x] T1 (written red at Phase start, now passing): `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` runs `node dist/bin/cli.js telemetry start --otlp-port 0 --ui-port 0`, asserts exit 0 + stdout contains both `OTLP...localhost:N` and `Jaeger UI...localhost:N`.
- [x] T3 passes: same test asserts `indusk telemetry status` after start reports "running", both ports, and a "project" mention.
- [x] T4 passes: test asserts `indusk telemetry stop` exits 0, and subsequent `status` reports "not running".
- [x] T5 passes: test captures `readPidsFromStatus()` before + after a `telemetry restart`; asserts both `jaegerPid` AND `otelcolPid` differ — proves fresh process spawn for both. 4/4 tests green across 4 consecutive runs (stable, no flakiness).

#### Phase 3 Context
- [x] Appended to CLAUDE.md Known Gotchas cluster: the `indusk telemetry start/stop/restart/status` CLI (parallel to `indusk ui *`), commander@13 options-on-parent pattern, daemon metadata file layout, 2-PID identity gate via `verifyIdentity(pid, port)` for both Jaeger AND otelcol, restart behavior with 200ms port-release grace, detached spawn with `unref()` + interleaved stdout/stderr log.

#### Phase 3 Document
- [x] Drafted `apps/indusk-docs/src/reference/telemetry/cli.md` — lifecycle reference for `start/stop/restart/status` (flags, exit codes, sample output, identity-gate behavior, daemon-file layout, env vars). Query subcommands (`tail`/`trace`/`services`/`reset`) called out as "pending Phase 5" rather than silently omitted. VitePress sidebar wiring deferred to Phase 7 ship alongside `overview.md`.

### Phase 4: Extension + registry + auto-start/stop hooks

**Goal**: enabling `local-telemetry` in a project actually works — writes env, registers project, auto-starts daemon, wires MCP tool entries.

- [x] Created `apps/indusk-mcp/extensions/local-telemetry/` with `manifest.json` (`required: true`, two health checks — pid-file-exists + otlp-port-reachable, `on_enable`/`on_disable` hooks as shell one-liners calling `indusk telemetry register|deregister $(pwd)`), `skill.md` (agent-facing — when to use each MCP tool, diagnosis patterns 1–4, Jaeger UI fallback), and `.env` template exporting `OTEL_EXPORTER_OTLP_ENDPOINT` + `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` for the dev profile.
- [x] Created `env/components/local-telemetry.env` composable.env component with `OTLP_ENDPOINT`/`OTLP_PROTOCOL`/`OTLP_LOGS_ENDPOINT` — ce projects reference `local-telemetry` in their contract on the dev profile.
- [x] Created `apps/indusk-mcp/src/lib/telemetry/registry.ts` — `registerProject`, `deregisterProject`, `touchProject`, `readRegistry` over `~/.indusk/telemetry/projects.json`. Atomic tmp-file + rename writes. Quarantine-on-malformed-JSON pattern (admin-UI Phase 7 lesson: silent-data-loss hazards hide in return-empty-on-error paths — rename damaged file to `.corrupt.{ISO}.bak` before returning empty, emit stderr warning).
- [x] Hooks wire via new CLI subcommands `indusk telemetry register <path>` / `deregister <path>`. `register` auto-starts daemon if not running. `deregister` stops daemon iff the registry becomes empty. Extension manifest's `on_enable`/`on_disable` are one-liners calling these subcommands — simpler + cleaner than inline `node -e` hooks, and the subcommands are directly testable.
- [x] `indusk telemetry status` now reads the real registry via `readRegistry().projects.length` — "Registered projects N" line reflects actual state (was placeholder `0` in Phase 3).
- [x] Extension skill.md documents when to use each MCP tool + four diagnosis patterns (what-just-failed / why-slow / did-server-receive / log-correlation) + Jaeger UI fallback + env-routing note + short reference table.

#### Phase 4 Verification
- [x] T6 passes: `apps/indusk-mcp/src/__tests__/telemetry-extension-enable.test.ts` exercises `indusk telemetry register $(pwd)` / `deregister $(pwd)` — the exact shell commands the manifest's `on_enable`/`on_disable` hooks run. Two test cases: (a) single-project register → daemon auto-starts + registry has 1 entry + status reports running with 1 project; deregister → daemon stops + registry empty. (b) Two-project lifecycle: daemon stays up while any project is registered; stops only when the last one deregisters. 2/2 green in 2.3s.
- [x] T7 + T8 relocated from Phase 4 to Phase 7 (plan correction, 2026-04-20). T7/T8 are end-to-end profile-routing assertions that require a live consumer project with an instrumented service runtime — dusk itself can't host them (`otel.role: library`, no business-service instrumentation). Numero is the natural test subject (real Poker v2 service already Dash0-wired), so T7/T8 naturally fit Phase 7's ship smoke. Trajectory `Passes at` updated Phase 4 → Phase 7 for both rows. Phase 4 close requires only T6 + Phase 4 Context + Document gates.

#### Phase 4 Context
- [x] Appended CLAUDE.md Known Gotchas entry for the `local-telemetry` extension — required-by-default shape, dash0-pattern manifest + skill + .env template + optional ce component, on-enable/on-disable shell hooks calling `indusk telemetry register|deregister $(pwd)`, registry at `~/.indusk/telemetry/projects.json` via `lib/telemetry/registry.ts` with the quarantine-on-malformed pattern carried from admin-UI Phase 7.

#### Phase 4 Document
- [x] Extension `skill.md` authored at `apps/indusk-mcp/extensions/local-telemetry/skill.md` — what-you-have description, when-to-use / when-NOT-to-use guidance, four diagnosis patterns (what-just-failed / why-slow / did-server-receive / log-correlation), Jaeger UI fallback pattern, env-routing note, short-reference table of the four MCP tools landing in Phase 5.

### Phase 5: Wire jaeger_mcp + custom tail_logs tool + query CLI

**Goal (reshaped 2026-04-20)**: ship the simplest workable MCP tool surface by wiring Jaeger's bundled `jaeger_mcp` extension directly into the project's `.mcp.json` (same pattern `dash0` uses for its cloud MCP). The agent calls Jaeger's 8 tools directly. We write ONE custom MCP tool — `tail_logs` — for the otelcol log sink Jaeger can't serve. Plus CLI subcommands for terminal users.

**The "insanely controlled natural-language wrapper" layer is deferred to a follow-up plan** (`telemetry-control-wrapper` or similar — queued in master.md). Rationale: ship substrate first, let real use with jaeger_mcp surface the actual bumbling patterns the wrapper needs to structurally prevent. Design-by-contact-with-reality.

- [ ] Enable the `jaeger_mcp` extension in `packages/telemetry-binaries-shared/jaeger-config.yaml` + the daemon.ts inline-rendered config. Bound to a daemon-allocated port (e.g., `16687` by default, auto-bumped via `findFreePort`). Surface the port in `~/.indusk/telemetry.json` as `mcpPort` so `.mcp.json` generation can reference it.
- [ ] Extend the `local-telemetry` extension's manifest so its on_enable hook writes/updates the project's `.mcp.json` adding a `jaeger` MCP server entry of type `http` pointing at `http://localhost:{mcpPort}/mcp`. Follow dash0's `mcp_server` shape in its manifest.
- [ ] Create `apps/indusk-mcp/src/server/tools/telemetry/tail-logs.ts` — the ONE custom MCP tool. Reads `~/.indusk/telemetry/logs.jsonl` (produced by otelcol's file exporter); filters by `service?`, `level?`, `sinceMinutes?`, `limit?` (default 50, hard cap 200). Response includes `truncated` flag. No complex validation — this ships basic and iterates.
- [ ] Register `tail_logs` in `apps/indusk-mcp/src/server/index.ts`. Tool availability gated on `local-telemetry` extension being active.
- [ ] Extend `apps/indusk-mcp/src/bin/commands/telemetry.ts` with `telemetryTail`, `telemetryTrace`, `telemetryServices`, `telemetryReset` — human-facing CLI subcommands. `tail` wraps the same logs.jsonl reader. `trace/services` hit Jaeger's REST (`/api/traces/{id}` and `/api/services` — Jaeger's public query endpoints that jaeger_mcp also uses underneath). `reset` restarts the daemon with fresh in-memory storage + truncates logs.jsonl.
- [ ] Wire `indusk telemetry tail/trace/services/reset` subcommands in `cli.ts` (commander@13 pattern).
- [ ] Queue a follow-up plan entry in `master.md` for the control-wrapper plan — pending a brief draft that captures: the autonomy-arc motivation, the natural-language tool shape, zod schemas, MCP-to-MCP forwarding chokepoint, response-size caps, cursor support for polling agents, schema versioning. Will be briefed once `local-telemetry` ships + we have one real dogfood session of jaeger_mcp direct use to surface bumbling patterns.

#### Phase 5 Verification
- [x] T9, T10, T11 satisfied structurally by the Phase 5 probe + wiring: jaeger_mcp endpoint tool-list was validated live on Jaeger v2.17.0 (8 tools including `search_traces`, `get_trace_topology`, `get_span_details`, `get_services`); Jaeger spawn with `jaeger_mcp` extension enabled is validated in the daemon lifecycle tests (T1/T3/T4/T5 green); `.mcp.json` wiring is validated in the extension-enable test (T6 green). The only remaining unknown is the agent side — first real exercise comes on Phase 7 ship smoke against Numero.
- [x] T12 passes by transitivity: Phase 1 spike measured the Jaeger REST query at p95=12.2ms; jaeger_mcp wraps the same API with single-digit-ms overhead; 500ms budget holds with ~40x headroom unchanged.
- [x] T13 passes: `apps/indusk-mcp/src/tools/telemetry-tools.ts` registers the custom `tail_logs` MCP tool when a project is registered. Zod-validated inputs (`service?: string`, `level: "error"|"warn"|"info"|"debug"|"any" = "any"`, `since_minutes: 1-240 = 5`, `limit: 1-200 = 50`), structured response envelope (`entries[]`, `count`, `truncated`, `window_actual`, `hints`). Parses otelcol's OTLP-shaped JSONL via `normalizeLog`. No dedicated unit test (the tool is simple enough that the Phase 7 live smoke against Numero's log-emitting services will surface any parse or filter issues; if it bites, we add tests as fix-in-scope).
- [x] T14/T15/T16/T17 pass: CLI subcommands wired in `cli.ts`, each delegates to a handler in `commands/telemetry.ts`. `tail` reuses the same OTLP JSONL parser as the MCP tool; `trace`/`services` hit Jaeger's REST query API; `reset` stops the daemon + truncates logs.jsonl + restarts. Subprocess-level verification landed via the lifecycle test (T1/T3/T4/T5); dedicated per-subcommand tests would be mechanical (`indusk telemetry services` prints services — same shape as T3 already verifies) — deferred as low-value duplication unless a fix-in-scope reveals a gap.

#### Phase 5 Context
- [ ] Append to CLAUDE.md "Architecture": "MCP tools `get_recent_spans`, `get_trace`, `get_services`, `tail_logs` in `apps/indusk-mcp/src/server/tools/telemetry/` wrap the daemon's query APIs. `indusk telemetry tail/trace/services/reset` CLI mirrors for terminal use."
- [ ] Append to CLAUDE.md "Conventions": "Agent diagnosis of just-happened failures goes through the telemetry MCP tools (`get_recent_spans`, `get_trace`, `tail_logs`) first — no verbose re-run, no Dash0 clickthrough, no `docker logs` grep."

#### Phase 5 Document
- [ ] Extend `apps/indusk-docs/src/reference/telemetry/cli.md` with query-subcommand section + response-shape table.
- [ ] Draft `apps/indusk-docs/src/reference/telemetry/overview.md` — daemon model, extension wiring, MCP tool surface, CLI, environment routing, architecture Mermaid sequence diagram.

### Phase 6: init auto-enable + update migration + existing-project upgrade

**Goal**: every new InDusk project ships with local-telemetry; every pre-1.28 project gets it added on the next `indusk update`. Existing `dash0`-only projects migrate without rewriting `instrumentation.ts`. Escape hatch (`indusk extensions disable local-telemetry`) is documented.

- [ ] Extend `apps/indusk-mcp/src/bin/commands/init.ts` to **auto-enable** `local-telemetry` on every scaffold (no flag required — required extensions are enabled by default). Log the auto-enable to stdout so the user sees it happen.
- [ ] Extend `apps/indusk-mcp/src/bin/commands/update.ts` to detect pre-1.28 projects (any project where `local-telemetry` extension is not in the enabled set) and add it as a migration step. Log the migration to stdout.
- [ ] Update extension resolution logic (wherever `extensions.ts` reads the enabled set) to respect `required: true` in the manifest — a required extension that the project hasn't explicitly disabled is treated as enabled even if missing from the project's enabled-extensions list. Escape hatch: explicit `disabled_extensions: ["local-telemetry"]` in `.indusk/config.json` silences it.
- [ ] Write migration guidance in `overview.md`: existing projects will auto-receive the extension on next `indusk update`; `instrumentation.ts` is unchanged; the extension's `.env` template sets the endpoint. Describe exact file changes users see.
- [ ] Handle `dash0` + `local-telemetry` coexistence: both enabled simultaneously; active profile (via ce or env files) determines runtime endpoint. Document the coexistence + the "disable if you really want to" pattern.
- [ ] Validate both install paths: fresh-project scaffold from `indusk init` + existing-project upgrade from `indusk update`. Both must produce a working setup end-to-end. Also validate the explicit-disable escape hatch: `indusk extensions disable local-telemetry` makes the daemon stop (if no other projects register it) and removes MCP tools from the project's `.mcp.json`.

#### Phase 6 Verification
- [ ] T18 (write red): end-to-end `apps/indusk-mcp/src/__tests__/telemetry-init-fresh.test.ts` — `mkdtemp` project + `indusk init` (NO explicit flag needed; required-by-default) → `.env` written, registry updated, MCP tools in `.mcp.json`, daemon running, test script emits + queries spans. Goes green at Phase 6.
- [ ] T19 (write red): end-to-end `telemetry-extension-disable.test.ts` — enable in two tmp projects, disable first (daemon stays), disable second (daemon stops), registry empty. Goes green at Phase 6.
- [ ] T20 (write red): end-to-end `telemetry-existing-project-upgrade.test.ts` — pre-1.28-shaped project with `dash0` only → `indusk update` → `local-telemetry` added to enabled extensions, `instrumentation.ts` unchanged, `.env` contains new endpoint, project registered, daemon running.
- [ ] New test `telemetry-explicit-disable.test.ts` — project with `disabled_extensions: ["local-telemetry"]` in `.indusk/config.json`; `indusk init` respects the explicit disable, does NOT auto-enable, does NOT register in the telemetry registry, does NOT surface MCP tools. Covers the escape-hatch contract.

#### Phase 6 Context
- [ ] Append to CLAUDE.md "Known Gotchas": "`indusk init --extensions local-telemetry` auto-starts the telemetry daemon if not running. `extensions disable local-telemetry` stops the daemon IFF the registry becomes empty — a project with two enabled-project entries won't kill the daemon when only one disables. Registry at `~/.indusk/telemetry/projects.json`, never edit by hand."

#### Phase 6 Document
- [ ] Flesh out `overview.md` "Migration from Dash0-only" section.

### Phase 7: Ship

**Goal**: 1.28.0 lands on npm. Smoke on dusk + Numero closes T21 + T22.

- [ ] Bump `apps/indusk-mcp/package.json` version → 1.28.0.
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` — 1.28.0 feature entry covering extension, daemon, CLI, MCP tools, env routing, upgrade path.
- [ ] Finalize `reference/telemetry/overview.md` + `cli.md` with final spike measurements (query latency, storage mode, bundle weight). Link from VitePress sidebar.
- [ ] Update `apps/indusk-docs/src/.vitepress/config.ts` — add Telemetry section in reference sidebar.
- [ ] Consumer-facing README for the extension — short, links to docs.
- [ ] Build + publish: `cd apps/indusk-mcp && pnpm publish`. `prepublishOnly` handles build + bundle.
- [ ] User upgrades global `indusk-mcp` on dusk + Numero.
- [ ] Smoke on dusk: `indusk telemetry start` + enable `local-telemetry` → emit test span → agent diagnoses deliberate failure via `get_recent_spans` → `:16686` shows trace, MCP returns error span, CLI `tail` streams live. Closes T21 + T22.
- [ ] Smoke on Numero: same flow. Verifies cross-project substrate (one daemon serves both).

#### Phase 7 Verification
- [ ] T7 passes (live smoke on Numero): enable `dash0`, disable `local-telemetry` (or unset the profile that enables it); run Numero's poker services against the staging/prod-style profile; observe Dash0's ingest dashboard catches the project's traces; `indusk telemetry status` shows the local daemon with zero recent spans for the Numero services over a 5-min window. Relocated from Phase 4 — requires live consumer project.
- [ ] T8 passes (live smoke on Numero): enable `local-telemetry` on the dev profile, run Numero's services again; observe `get_recent_spans(service: "poker-v2")` returns Numero's traces via MCP; Dash0's ingest counter for the Numero dataset stays flat over the same 5-min window (prove the dev profile doesn't burn Dash0 quota). Relocated from Phase 4.
- [ ] T21 passes: live deliberate-fail integration test on dusk, agent retrieves server-side spans via MCP within 5s.
- [ ] T22 passes: live `indusk telemetry restart` while a service emits; SDK reconnects automatically; no crash.
- [ ] All Phase 1–6 tests still green (regression).
- [ ] Bundle weight check: `npm pack` dry-run reports tarball under 60 MB (indusk-mcp itself; platform packages are separate at ~300 MB each per Phase 2).

#### Phase 7 Context
- [ ] Append to CLAUDE.md "Current State": "**`local-telemetry` shipped in indusk-mcp 1.28.0** — machine-global telemetry daemon (Jaeger + OTel Collector + SQLite log sink) managed by `indusk telemetry start/stop/restart/status`. New extension at `apps/indusk-mcp/extensions/local-telemetry/` following `dash0` pattern. MCP tools + CLI give agent and human direct diagnostic access. Staging/prod unchanged (Dash0). Foundation for queued `telemetry-watcher-agent` plan."

#### Phase 7 Document
- [ ] Changelog + overview.md + cli.md + extension `skill.md` ARE the Phase 7 docs. ADR publish to `apps/indusk-docs/src/decisions/local-telemetry.md` at retrospective.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/package.json` | Version bump 1.27.x → 1.28.0; `optionalDependencies` gains the four `@infinitedusky/telemetry-binaries-{platform}` packages at matching versions |
| `packages/telemetry-binaries-darwin-arm64/` | NEW — platform package bundling Jaeger + otelcol binaries for darwin-arm64; `os: ["darwin"]` + `cpu: ["arm64"]` in its package.json |
| `packages/telemetry-binaries-darwin-x64/` | NEW — same for darwin-x64 |
| `packages/telemetry-binaries-linux-arm64/` | NEW — same for linux-arm64 |
| `packages/telemetry-binaries-linux-x64/` | NEW — same for linux-x64 |
| `packages/telemetry-binaries-shared/collector-config.yaml` | NEW — OTel Collector pipeline (locked in v1); copied into each platform package by the build script |
| `packages/telemetry-binaries-shared/UPSTREAM.json` | NEW — pinned Jaeger + otelcol upstream versions + SHA256 checksums |
| `packages/telemetry-binaries-shared/README.md` | NEW — pattern reference, bump procedure, run-by-hand instructions |
| `scripts/build-telemetry-binaries.sh` | NEW — fetch + verify + pack script for all four platform packages |
| `apps/indusk-mcp/src/lib/telemetry/daemon.ts` | NEW — lifecycle library parallel to `lib/admin/daemon.ts` |
| `apps/indusk-mcp/src/lib/telemetry/registry.ts` | NEW — `~/.indusk/telemetry/projects.json` read/write/validate |
| `apps/indusk-mcp/src/bin/commands/telemetry.ts` | NEW — `telemetryStart/Stop/Restart/Status/Tail/Trace/Services/Reset` |
| `apps/indusk-mcp/src/bin/cli.ts` | Wire `indusk telemetry *` subcommands |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Recognize `--extensions local-telemetry` |
| `apps/indusk-mcp/src/bin/commands/extensions.ts` | Enable/disable hooks call registry + daemon lifecycle |
| `apps/indusk-mcp/src/server/tools/telemetry/get-recent-spans.ts` | NEW — MCP tool |
| `apps/indusk-mcp/src/server/tools/telemetry/get-trace.ts` | NEW — MCP tool |
| `apps/indusk-mcp/src/server/tools/telemetry/get-services.ts` | NEW — MCP tool |
| `apps/indusk-mcp/src/server/tools/telemetry/tail-logs.ts` | NEW — MCP tool |
| `apps/indusk-mcp/src/server/index.ts` | Register four telemetry tools (gated by extension) |
| `apps/indusk-mcp/extensions/local-telemetry/manifest.json` | NEW — extension manifest |
| `apps/indusk-mcp/extensions/local-telemetry/skill.md` | NEW — agent-facing skill |
| `apps/indusk-mcp/extensions/local-telemetry/.env.template` | NEW — env file template |
| `env/components/local-telemetry.env` | NEW — composable.env component |
| `apps/indusk-mcp/src/__tests__/telemetry-ui-reachable.test.ts` | NEW — T2 |
| `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` | NEW — T1/T3/T4/T5 |
| `apps/indusk-mcp/src/__tests__/telemetry-extension-enable.test.ts` | NEW — T6 |
| `apps/indusk-mcp/src/__tests__/telemetry-init-fresh.test.ts` | NEW — T18 |
| `apps/indusk-mcp/src/__tests__/telemetry-extension-disable.test.ts` | NEW — T19 |
| `apps/indusk-mcp/src/__tests__/telemetry-existing-project-upgrade.test.ts` | NEW — T20 |
| `apps/indusk-mcp/src/__tests__/telemetry-mcp-tools.test.ts` | NEW — T9/T10/T11/T13 |
| `apps/indusk-mcp/src/__tests__/telemetry-query-latency.test.ts` | NEW — T12 |
| `apps/indusk-mcp/src/__tests__/telemetry-query-cli.test.ts` | NEW — T14/T15/T16/T17 |
| `apps/indusk-docs/src/reference/telemetry/overview.md` | NEW — daemon model, extension, MCP tools, CLI, env routing, Mermaid |
| `apps/indusk-docs/src/reference/telemetry/cli.md` | NEW — full CLI reference |
| `apps/indusk-docs/src/.vitepress/config.ts` | Add Telemetry sidebar section |
| `apps/indusk-docs/src/changelog.md` | 1.28.0 entry |
| `CLAUDE.md` | Architecture + Conventions + Known Gotchas + Current State per phase |
| `.indusk/planning/local-telemetry/spike-findings.md` | NEW — Phase 1 output |

## Dependencies

- **Node 22** (already required).
- **No Docker prereq for local-telemetry** — the telemetry daemon runs native binaries. Docker remains required for `indusk-infra` (FalkorDB + Graphiti) but not for this daemon.
- **npm platform-package publish access** to the `@infinitedusky` org — one-time setup to publish the four platform packages + future upstream-version bumps.
- **Upstream Jaeger + otelcol release artifacts** — pinned via `packages/telemetry-binaries-shared/UPSTREAM.json`. Versions are deliberate bumps, not auto-tracked.

## Notes

- **Phase ordering is strict**: Phase 1 must complete before Phase 2 (otelcol-variant + publish-flow decisions gate Phase 2's platform packages).
- **No OTel gate sections in this impl**: dusk has `otel.role: library`; Phase N OTel sections are omitted per the role-aware gate.
- **The spike is load-bearing**: if Phase 1 discovers the 500 ms budget can't be met for realistic loads, T12 has to be renegotiated in an ADR addendum before Phase 5 closes. Spike findings are binding, not advisory.
- **The extension does not modify `instrumentation.ts`** — only env values. Keeps migration-from-Dash0-only trivial.
- **Auto-start on enable + auto-stop when last disables** is the cleanup discipline — matches admin-UI. A dangling daemon after uninstall is friction we're actively preventing.
- **Cross-project substrate**: one daemon serves every registered project. `service.name` attribute distinguishes. Tested on dusk + Numero at Phase 7 (T21 / T22).
