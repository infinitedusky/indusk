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
| T1 | `indusk telemetry start` from any directory brings up the daemon in under 10s and prints listening ports (4318 OTel, 16686 Jaeger UI). | Phase 0 | Phase 3 | planned |
| T2 | After daemon is running, `http://localhost:16686` serves Jaeger's trace search UI. | Phase 0 | Phase 2 | written |
| T3 | `indusk telemetry status` after a successful start reports "running", both listening ports, and the registered-project count. | Phase 0 | Phase 3 | planned |
| T4 | `indusk telemetry stop` shuts the daemon down within 3s; `status` then reports "not running" and `:16686` returns connection-refused. | Phase 0 | Phase 3 | planned |
| T5 | `indusk telemetry restart` stops (if running) then starts a fresh instance — picks up new binaries after `npm i -g @infinitedusky/indusk-mcp@<newer>` (which npm re-resolves against the platform package's new version) without manual stop-then-start. | Phase 0 | Phase 3 | planned |
| T6 | A project with `local-telemetry` enabled emits OTel traces to the daemon in dev — spans appear in Jaeger's UI and REST API within 5s of emission. | Phase 0 | Phase 4 | planned |
| T7 | A project configured for staging/prod (`local-telemetry` NOT enabled, `dash0` IS enabled) continues to emit to Dash0 — no traffic lands in the local daemon. | Phase 0 | Phase 4 | planned |
| T8 | Running a dev workflow with `local-telemetry` enabled produces zero OTel traffic to Dash0 over the dev session. | Phase 0 | Phase 4 | planned |
| T9 | When the developer asks the agent "why did X just fail?", the agent calls `get_recent_spans` and surfaces the relevant error span(s) — no cloud round-trip, no verbose re-run. | Phase 0 | Phase 5 | planned |
| T10 | Given a trace ID, `get_trace(trace_id)` returns the complete span tree as JSON. | Phase 0 | Phase 5 | planned |
| T11 | `get_services()` returns the list of services the daemon knows about. | Phase 0 | Phase 5 | planned |
| T12 | For ~100 spans emitted across 5s, `get_recent_spans` returns matching spans in under 500 ms p95. | Phase 0 | Phase 5 | written |
| T13 | `tail_logs --service <name> --since 5m --level error` returns recent log records from the SQLite sink, filtered. | Phase 0 | Phase 5 | planned |
| T14 | `indusk telemetry tail --service <name>` streams recent spans to stdout as they arrive — same shape as the MCP tool. | Phase 0 | Phase 5 | planned |
| T15 | `indusk telemetry trace <trace-id>` prints the full span tree to stdout. | Phase 0 | Phase 5 | planned |
| T16 | `indusk telemetry services` prints the list of services the daemon has seen, one per line. | Phase 0 | Phase 5 | planned |
| T17 | `indusk telemetry reset` empties the buffer — subsequent queries return no traces until new spans arrive. | Phase 0 | Phase 5 | planned |
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
- [ ] Create `packages/telemetry-binaries-shared/collector-config.yaml` (or keep one copy per platform — spike decides): OTLP HTTP + gRPC receivers → batch processor → Jaeger exporter (traces) + file/SQLite log exporter (logs). Locked pipeline in v1.
- [ ] Create `scripts/build-telemetry-binaries.sh` at repo root: (1) reads pinned upstream Jaeger + otelcol versions from a manifest file; (2) for each of the 4 platforms, downloads the matching release archive from GitHub; (3) verifies upstream SHA256 checksums against the manifest; (4) unpacks into the matching platform package's `bin/`; (5) copies `collector-config.yaml` into each platform package; (6) optionally runs `npm publish` for each. Idempotent; resumable if one download fails.
- [ ] Create `packages/telemetry-binaries-shared/UPSTREAM.json` (or equivalent) pinning exact upstream versions + SHA256s. Example: `{ "jaeger": { "version": "2.5.0", "sha256_darwin_arm64": "...", ... }, "otelcol": { "variant": "{spike-chosen}", "version": "0.110.0", ... } }`. Updates to upstream are deliberate one-bump-per-file.
- [ ] Update `apps/indusk-mcp/package.json` `optionalDependencies`: add all four platform packages at the matched version. Each entry includes `os`/`cpu` fields via the package's own package.json — npm honors them at install time.
- [ ] Write per-platform `README.md` in each package folder: "Bundles upstream Jaeger vX.Y.Z + OTel Collector vA.B.C for {platform}. Apache 2.0. Redistribution under Apache 2.0 terms." Attribution, no more.
- [ ] Write `packages/telemetry-binaries-shared/README.md` at repo root explaining the pattern, how to bump upstream versions, how `build-telemetry-binaries.sh` works, and that the four platform packages are load-bearing for indusk-mcp's telemetry feature.

#### Phase 2 Verification
- [ ] T2 (write red): commit `apps/indusk-mcp/src/__tests__/telemetry-ui-reachable.test.ts` that spawns `jaeger` (resolved via `require.resolve` from the appropriate platform package) with OTLP HTTP + UI on auto-picked ports, `fetch`es `http://localhost:{uiPort}` and asserts 200 + "Jaeger" in title, then SIGTERMs. Red today; goes green after Phase 2.
- [ ] Manual smoke: emit a test span via `@opentelemetry/exporter-trace-otlp-http` to the spawned otelcol's 4318; verify in Jaeger UI within 5s.
- [ ] Manual smoke: emit a test log record via otelcol's OTLP log receiver; verify in the SQLite sink via `sqlite3`.
- [ ] Platform-package install check: `npm pack` each of the 4 platform packages. Confirm each tarball's `os`/`cpu` fields in `package.json` match target; confirm `bin/jaeger` + `bin/otelcol` + `collector-config.yaml` + `LICENSE` are present.
- [ ] `npm i` an indusk-mcp-local-build on macOS arm64; confirm `@infinitedusky/telemetry-binaries-darwin-arm64` lands in `node_modules/` and the other 3 platform packages are SKIPPED (no errors, no presence).

#### Phase 2 Context
- [ ] Append to CLAUDE.md "Architecture": "Telemetry binaries ship as platform-specific npm packages at `packages/telemetry-binaries-{platform}/`. indusk-mcp lists them as `optionalDependencies`; npm's `os`/`cpu` filters install exactly one per consumer. Build script `scripts/build-telemetry-binaries.sh` + `UPSTREAM.json` manifest manage the Jaeger + otelcol version pinning + checksum verification."
- [ ] Append to CLAUDE.md "Known Gotchas": "Platform-package distribution pattern (esbuild/swc/biome style) — `optionalDependencies` with `os`+`cpu` constraints in the platform package's `package.json`, not in indusk-mcp's. npm handles skip/install per consumer platform. Don't put install-time download scripts in postinstall — binaries are pre-bundled in the platform package tarballs, not fetched at install."

#### Phase 2 Document
- [ ] `packages/telemetry-binaries-shared/README.md` — dev-facing reference on the packaging pattern, upstream-bump procedure, + manual run-by-hand instructions for testing the binaries directly.

### Phase 3: `indusk telemetry` lifecycle CLI

**Goal**: `indusk telemetry start/stop/restart/status` parallel to `indusk ui *`. Spawns Jaeger + otelcol as detached child processes resolved from the platform package, records daemon metadata, supervises PIDs. No Docker.

- [ ] Create `apps/indusk-mcp/src/lib/telemetry/daemon.ts` — parallel to `apps/indusk-mcp/src/lib/admin/daemon.ts`. Functions: `daemonStart`, `daemonStop`, `daemonStatus`, `verifyIdentity(pid, port)`, `findFreePort`, `isPortListening`. Apply admin-UI Phase 7 lessons: verifyIdentity composes `isAlive` + `isPortListening` to avoid PID-reuse false-positives.
- [ ] Binary path resolution via `resolveBinary(name: "jaeger" | "otelcol"): string` that calls `require.resolve("@infinitedusky/telemetry-binaries-{detectedPlatform}/bin/${name}")`. Platform detection via `process.platform` + `process.arch`; unsupported combos throw a clear error naming the platform + pointing to docs.
- [ ] `daemonStart` spawns both children: first otelcol (OTLP receivers + exporters to Jaeger), then Jaeger (OTLP gRPC on 4317 — otelcol exports to it internally). Both `detached: true`, `stdio: ["ignore", logFd, logFd]`, `unref()`. Both PIDs written to `~/.indusk/telemetry.json`. The two processes are supervised as a unit — stop kills both.
- [ ] Create `apps/indusk-mcp/src/bin/commands/telemetry.ts` — `telemetryStart`, `telemetryStop`, `telemetryStatus`, `telemetryRestart`.
- [ ] Wire into `apps/indusk-mcp/src/bin/cli.ts` as `indusk telemetry start/stop/restart/status`. Apply commander@13 lesson: options on parent, subcommand actions use `optsWithGlobals()`.
- [ ] Daemon metadata: `~/.indusk/telemetry.pid` (bare otelcol PID, as the "primary" process — Jaeger PID also tracked), `~/.indusk/telemetry.json` (`{jaegerPid, otelcolPid, otlpPort, uiPort, startedAt, jaegerBinary, otelcolBinary, platform}`), `~/.indusk/telemetry.log` (redirected child stdout+stderr for both processes, interleaved).
- [ ] `start` auto-bumps ports if requested are taken; prints warnings. `restart` = `stop + start` (gracefully stops BOTH processes). `status` prints running state + both ports + both PIDs + started-at + registered-project count.

#### Phase 3 Verification
- [ ] T1 (write red): commit `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` running `indusk telemetry start --port 0`, asserting exit 0 + stdout contains port + daemon reachable via curl. Red today; goes green at Phase 3 close.
- [ ] T3 passes: same subprocess test asserts `indusk telemetry status` after successful start reports running + ports + project count.
- [ ] T4 passes: test asserts `indusk telemetry stop` exits 0 in <3s + subsequent `status` says "not running".
- [ ] T5 passes: second subprocess test for `indusk telemetry restart` captures otelcol + Jaeger PIDs before + after; asserts both differ (new processes spawned).

#### Phase 3 Context
- [ ] Append to CLAUDE.md "Conventions": "`indusk telemetry start/stop/restart/status` is the CLI lifecycle for the telemetry daemon — parallel to `indusk ui start/stop/restart/status`. Commander@13 pattern (options on parent, subcommands via `optsWithGlobals()`). Metadata at `~/.indusk/telemetry.{pid,json,log}`, never edited by hand."

#### Phase 3 Document
- [ ] Draft `apps/indusk-docs/src/reference/telemetry/cli.md` — `start/stop/restart/status` reference. Query subcommands added in Phase 5.

### Phase 4: Extension + registry + auto-start/stop hooks

**Goal**: enabling `local-telemetry` in a project actually works — writes env, registers project, auto-starts daemon, wires MCP tool entries.

- [ ] Create `apps/indusk-mcp/extensions/local-telemetry/` with `manifest.json` (skill, MCP tools, health checks, lifecycle hook) + `skill.md` (agent-facing) + `.env` template (exports `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` + retention knobs).
- [ ] Create `env/components/local-telemetry.env` composable.env component.
- [ ] Create `apps/indusk-mcp/src/lib/telemetry/registry.ts` parallel to `apps/indusk-mcp/src/lib/admin/registry.ts`. Functions: `addProject`, `removeProject`, `readRegistry`, `validateProject` over `~/.indusk/telemetry/projects.json`.
- [ ] Hook extension-enable in `apps/indusk-mcp/src/bin/commands/extensions.ts`: on successful enable, call `registry.addProject(projectRoot)` + `telemetryStart()` if daemon not running.
- [ ] Hook extension-disable: call `registry.removeProject(name)` + `telemetryStop()` iff `registry.readRegistry().projects.length === 0`.
- [ ] Document in `apps/indusk-mcp/extensions/local-telemetry/skill.md` — when to query, which MCP tool, how to sanity-check via Jaeger UI.

#### Phase 4 Verification
- [ ] T6 (write red): end-to-end script at `apps/indusk-mcp/src/__tests__/telemetry-extension-enable.test.ts` — tmp project + `indusk extensions enable local-telemetry` → `.env` correct, project in registry, daemon running, test span appears in Jaeger within 5s. Red before Phase 4; green after enable hook fires.
- [ ] T7 passes: manual smoke — project with `dash0` enabled + `local-telemetry` NOT → traces land in Dash0, local daemon sees zero.
- [ ] T8 passes: manual smoke — reverse configuration, zero Dash0 ingest during dev session.

#### Phase 4 Context
- [ ] Append to CLAUDE.md "Architecture": "`apps/indusk-mcp/extensions/local-telemetry/` — new extension following `dash0` pattern. Enabling registers the project in `~/.indusk/telemetry/projects.json` via `lib/telemetry/registry.ts`, writes the dev-profile OTel endpoint env, auto-starts the daemon. Disabling deregisters and stops the daemon iff registry becomes empty."

#### Phase 4 Document
- [ ] Extension `skill.md` is the agent-loaded skill — when to use telemetry tools, which for which case, when to escalate to Jaeger UI.

### Phase 5: MCP tool surface + query CLI

**Goal**: agent + human both get direct query access. MCP tools wrap Jaeger's REST API + SQLite sink. `indusk telemetry tail/trace/services/reset` mirror the same surface from a terminal.

- [ ] Create `apps/indusk-mcp/src/server/tools/telemetry/get-recent-spans.ts` — wraps `GET /api/traces` with filters. Signature per spike.
- [ ] Create `get-trace.ts` — wraps `GET /api/traces/{id}`.
- [ ] Create `get-services.ts` — wraps `GET /api/services`.
- [ ] Create `tail-logs.ts` — SQL layer over SQLite with filters (service, level, since, trace_id).
- [ ] Register all four tools in `apps/indusk-mcp/src/server/index.ts`. Gated by `local-telemetry` extension enabled in current project.
- [ ] Extend `apps/indusk-mcp/src/bin/commands/telemetry.ts` with `telemetryTail`, `telemetryTrace`, `telemetryServices`, `telemetryReset`.
- [ ] Wire `indusk telemetry tail/trace/services/reset` subcommands in `cli.ts`.
- [ ] `reset` clears Jaeger storage (admin API or stop+restart-with-fresh-Badger) + truncates SQLite log sink.

#### Phase 5 Verification
- [ ] T9 (write red): end-to-end script simulating agent diagnosis — failing test emits error span; `get_recent_spans(status="error")` returns the span; agent consumes via MCP call. Red before Phase 5; green after MCP tools land.
- [ ] T10 passes: integration test calling `get_trace(trace_id)` against a seeded trace, asserting full span tree.
- [ ] T11 passes: integration test calling `get_services()`, asserting seeded service present.
- [ ] T12 passes (timing, from Phase 1): integration test re-runs, p95 < 500 ms.
- [ ] T13 passes: integration test for `tail_logs(service, level, since)` with seeded log records.
- [ ] T14/T15/T16/T17 pass: subprocess tests for `indusk telemetry tail/trace/services/reset`.

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
- [ ] T21 passes: live deliberate-fail integration test on dusk, agent retrieves server-side spans via MCP within 5s.
- [ ] T22 passes: live `indusk telemetry restart` while a service emits; SDK reconnects automatically; no crash.
- [ ] All Phase 1–6 tests still green (regression).
- [ ] Bundle weight check: `npm pack` dry-run reports tarball under 60 MB.

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
