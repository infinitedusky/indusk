---
title: "Local Telemetry — Impl"
date: 2026-04-20
status: approved
trajectory: required
rationale: required
gate_policy: ask
---

# Local Telemetry — Impl

## Goal

Ship a new InDusk extension `local-telemetry` plus a machine-global telemetry daemon (Jaeger + OTel Collector + SQLite log sink) managed by `indusk telemetry start/stop/restart/status`, with an MCP tool surface that lets the agent call `get_recent_spans` / `get_trace` / `get_services` / `tail_logs` for fast local diagnosis. Ships as indusk-mcp 1.28.0.

## Scope

### In Scope

- New extension at `apps/indusk-mcp/extensions/local-telemetry/` (`manifest.json`, `skill.md`, `.env` template)
- Optional ce component at `env/components/local-telemetry.env`
- Container image bundling Jaeger all-in-one + OTel Collector + SQLite log sink + process manager — packaging shape decided by spike
- `indusk telemetry` CLI with lifecycle (`start/stop/restart/status`) + query (`tail/trace/services/reset`) subcommands
- Daemon metadata at `~/.indusk/telemetry.{pid,json,log}` + registry at `~/.indusk/telemetry/projects.json`
- MCP tools (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`)
- Extension-enable auto-start + extension-disable graceful-stop-iff-registry-empty
- `indusk init --extensions local-telemetry` scaffolding
- Docs: `reference/telemetry/overview.md`, `reference/telemetry/cli.md`, extension `skill.md`, changelog 1.28.0 entry
- Spike Phase 1 producing `spike-findings.md`

### Out of Scope

- Dashboards, metric alerts, PromQL, long-term retention
- Production observability (Dash0 stays)
- Eval agent OTel rerouting (stays on Dash0 `agent` dataset)
- Watcher agent (`telemetry-watcher-agent` is a downstream plan)
- Custom Collector processor config (v1 locked)
- Cross-machine / team sharing
- Windows support

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Spike findings: Jaeger query latency vs 500 ms budget, storage-mode choice, retention default, container-packaging shape, image distribution, MCP signature ergonomics. Output in `spike-findings.md`. | No prior phases — hands-on investigation. |
| Phase 2 | Telemetry daemon container image + Dockerfile/Compose + Collector config + Jaeger launch args + SQLite schema. Consumer can `docker run` it and see Jaeger UI at `:16686`. | Phase 1's packaging + distribution decisions. |
| Phase 3 | `indusk telemetry start/stop/restart/status` CLI + daemon lifecycle library + `~/.indusk/telemetry.{pid,json,log}`. | Phase 2's container image. |
| Phase 4 | Extension scaffolding (`apps/indusk-mcp/extensions/local-telemetry/`) + ce component + registry library for `~/.indusk/telemetry/projects.json` + auto-start/deregister hooks wired to `indusk extensions enable/disable`. | Phase 3's CLI lifecycle. |
| Phase 5 | MCP tools (`get_recent_spans`, `get_trace`, `get_services`, `tail_logs`) + `indusk telemetry tail/trace/services/reset` query CLI + SQL layer over SQLite log sink. | Phase 2's Jaeger REST API + SQLite sink; Phase 4's extension manifest declares the tools. |
| Phase 6 | `indusk init --extensions local-telemetry` wiring + existing-project upgrade path from `dash0`-only. | Phase 4's extension + Phase 3's CLI. |
| Phase 7 | Ship: 1.28.0 version bump, changelog, `reference/telemetry/overview.md` + `cli.md`, extension skill docs, publish, global upgrade + live smoke on dusk + Numero. | All prior phases. |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `indusk telemetry start` from any directory brings up the daemon in under 10s and prints listening ports (4318 OTel, 16686 Jaeger UI). | Phase 0 | Phase 3 | planned |
| T2 | After daemon is running, `http://localhost:16686` serves Jaeger's trace search UI. | Phase 0 | Phase 2 | planned |
| T3 | `indusk telemetry status` after a successful start reports "running", both listening ports, and the registered-project count. | Phase 0 | Phase 3 | planned |
| T4 | `indusk telemetry stop` shuts the daemon down within 3s; `status` then reports "not running" and `:16686` returns connection-refused. | Phase 0 | Phase 3 | planned |
| T5 | `indusk telemetry restart` stops (if running) then starts a fresh instance — picks up a new container image after `npm i -g @infinitedusky/indusk-mcp@<newer>` without manual stop-then-start. | Phase 0 | Phase 3 | planned |
| T6 | A project with `local-telemetry` enabled emits OTel traces to the daemon in dev — spans appear in Jaeger's UI and REST API within 5s of emission. | Phase 0 | Phase 4 | planned |
| T7 | A project configured for staging/prod (`local-telemetry` NOT enabled, `dash0` IS enabled) continues to emit to Dash0 — no traffic lands in the local daemon. | Phase 0 | Phase 4 | planned |
| T8 | Running a dev workflow with `local-telemetry` enabled produces zero OTel traffic to Dash0 over the dev session. | Phase 0 | Phase 4 | planned |
| T9 | When the developer asks the agent "why did X just fail?", the agent calls `get_recent_spans` and surfaces the relevant error span(s) — no cloud round-trip, no verbose re-run. | Phase 0 | Phase 5 | planned |
| T10 | Given a trace ID, `get_trace(trace_id)` returns the complete span tree as JSON. | Phase 0 | Phase 5 | planned |
| T11 | `get_services()` returns the list of services the daemon knows about. | Phase 0 | Phase 5 | planned |
| T12 | For ~100 spans emitted across 5s, `get_recent_spans` returns matching spans in under 500 ms p95. | Phase 0 | Phase 5 | planned |
| T13 | `tail_logs --service <name> --since 5m --level error` returns recent log records from the SQLite sink, filtered. | Phase 0 | Phase 5 | planned |
| T14 | `indusk telemetry tail --service <name>` streams recent spans to stdout as they arrive — same shape as the MCP tool. | Phase 0 | Phase 5 | planned |
| T15 | `indusk telemetry trace <trace-id>` prints the full span tree to stdout. | Phase 0 | Phase 5 | planned |
| T16 | `indusk telemetry services` prints the list of services the daemon has seen, one per line. | Phase 0 | Phase 5 | planned |
| T17 | `indusk telemetry reset` empties the buffer — subsequent queries return no traces until new spans arrive. | Phase 0 | Phase 5 | planned |
| T18 | `indusk init --extensions local-telemetry` on a fresh project produces a working setup: `.env` written, project registered, MCP tools in `.mcp.json`, daemon auto-starts, a test script can emit + query spans — zero further manual config. | Phase 0 | Phase 6 | planned |
| T19 | `indusk extensions disable local-telemetry` deregisters the project, removes MCP tools from `.mcp.json`, and stops the daemon iff the registry becomes empty. No orphan containers, no stale MCP entries. | Phase 0 | Phase 6 | planned |
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

- [ ] Stand up a Jaeger all-in-one container (`jaegertracing/all-in-one:latest`) locally. Expose 4318 + 16686. Emit test spans via a small Node script using `@opentelemetry/sdk-trace-node` + OTLP HTTP exporter at `localhost:4318`. Verify spans land via Jaeger UI search.
- [ ] Add an OTel Collector container (`otel/opentelemetry-collector-contrib:latest`) in front of Jaeger. Configure Collector to receive OTLP at 4318, forward to Jaeger internally. Emit spans to Collector; verify they land in Jaeger.
- [ ] Add a log pipeline: Collector's file exporter writing to SQLite-compatible format OR a small consumer process tailing Collector output into SQLite. Emit structured log records; verify via `sqlite3` CLI.
- [ ] Measure Jaeger query latency for `/api/traces?service=X&limit=100` against ~100 spans across 5s. Run 10 times. Capture p50/p95/p99. Compare to T12's 500 ms budget.
- [ ] Try Jaeger in-memory vs Badger storage. Measure: write cost per span, survive-restart behavior, memory footprint for 1-hour buffer.
- [ ] Package prototype: build a single container with supervisord managing Jaeger + Collector (+ log sink consumer if separate). Separately: prototype a docker-compose.yaml with the same services as separate containers. Compare image pull/build time, RAM at idle, failure containment.
- [ ] Distribution prototype: produce a pullable public image (push to ghcr.io test tag) OR build locally from bundled Dockerfile. Measure first-`start` latency, ongoing-start latency, tarball-size impact.
- [ ] Have the agent call a stub MCP tool wrapper during a real diagnosis scenario. Capture ergonomic friction on signature choices.
- [ ] Write `spike-findings.md` in this plan folder with every measurement, decision, and surprise. Binding on Phase 2+.

#### Phase 1 Verification
- [ ] T2 (write red): commit `apps/indusk-admin/src/__tests__/telemetry-ui-reachable.test.ts` (or equivalent location — likely `apps/indusk-mcp/src/__tests__/telemetry-ui-reachable.test.ts`) that `fetch`es `http://localhost:16686` and asserts 200 + "Jaeger" in the title. Red today (no daemon); writable at Phase 0 via HTTP; goes green at Phase 2 when a standalone container run serves the UI.
- [ ] T12 (write red): commit a timing harness at `apps/indusk-mcp/src/__tests__/telemetry-query-latency.test.ts` that POSTs ~100 spans across 5s to `http://localhost:4318/v1/traces`, then measures `GET /api/traces?limit=100` latency over 10 runs and asserts p95 < 500ms. Red today (no daemon); goes green at Phase 5 after MCP tool wraps the API and storage mode from spike is live.
- [ ] Spike outputs captured in `.indusk/planning/local-telemetry/spike-findings.md` with measured numbers (not prose) for every open question.

#### Phase 1 Context
- [ ] Append to CLAUDE.md "Current State": "local-telemetry Phase 1 spike complete — measured Jaeger query latency at {p50/p95} for {N}-span workload; chose {storage mode}, {packaging shape}, {distribution path}; findings in `.indusk/planning/local-telemetry/spike-findings.md`."

#### Phase 1 Document
- [ ] `spike-findings.md` in this plan folder (internal design artifact, not published to docs site). Seeds `telemetry-watcher-agent` brief.

### Phase 2: Daemon container image

**Goal**: produce the runnable artifact Phase 3's CLI wraps. `docker run` (or `docker compose up`) the bundled image → Jaeger UI + Collector receiver + log sink all reachable.

- [ ] Create `apps/indusk-mcp/telemetry/Dockerfile` (or `docker-compose.yaml`, per spike) assembling Jaeger all-in-one + OTel Collector + SQLite log sink. Process-manager choice per spike.
- [ ] Add `apps/indusk-mcp/telemetry/collector-config.yaml` — OTLP HTTP + gRPC receivers → Jaeger exporter (traces) + file/SQLite exporter (logs). Locked pipeline in v1.
- [ ] Add SQLite log sink: schema `(timestamp, service, level, trace_id, span_id, body, attributes_json)`. May use Collector's native file exporter if spike confirms structured-enough.
- [ ] Configure Jaeger storage mode per spike; retention defaults per spike. Baseline: 1h OR 10 MB ring buffer, whichever hits first.
- [ ] Local run instructions in `apps/indusk-mcp/telemetry/README.md` — exact `docker run` / `docker compose up`, expected ports, expected log output.
- [ ] Distribution: if pull-from-registry, publish to ghcr.io under versioned tag; if local-build, ensure Dockerfile ships in tarball via `package.json` `files`.

#### Phase 2 Verification
- [ ] T2 passes: `curl http://localhost:16686` returns 200 with Jaeger UI HTML after hand-run of the bundled image.
- [ ] Manual smoke: emit a test span via `@opentelemetry/exporter-trace-otlp-http`; verify in Jaeger UI within 5s.
- [ ] Manual smoke: emit a test log record via Collector's OTLP log receiver; verify in SQLite sink via `sqlite3` CLI.

#### Phase 2 Context
- [ ] Append to CLAUDE.md "Architecture": "Telemetry daemon container image at `apps/indusk-mcp/telemetry/` — Jaeger + OTel Collector + SQLite log sink. Distribution: {pull-from-ghcr | local-build}; packaging: {supervisord-single | compose-multi}."

#### Phase 2 Document
- [ ] `apps/indusk-mcp/telemetry/README.md` — dev-facing manual run instructions + config files + ports + storage-mode choice.

### Phase 3: `indusk telemetry` lifecycle CLI

**Goal**: `indusk telemetry start/stop/restart/status` parallel to `indusk ui *`. Manages the Phase 2 container image via Docker CLI, records daemon metadata.

- [ ] Create `apps/indusk-mcp/src/lib/telemetry/daemon.ts` — parallel to `apps/indusk-mcp/src/lib/admin/daemon.ts`. Functions: `daemonStart`, `daemonStop`, `daemonStatus`, `findFreePort`, `isPortListening`. Container orchestration via `docker run -d`/`docker stop`/`docker rm`.
- [ ] Create `apps/indusk-mcp/src/bin/commands/telemetry.ts` — `telemetryStart`, `telemetryStop`, `telemetryStatus`, `telemetryRestart`.
- [ ] Wire into `apps/indusk-mcp/src/bin/cli.ts` as `indusk telemetry start/stop/restart/status`. Apply commander@13 lesson: options on parent, subcommand actions use `optsWithGlobals()`.
- [ ] Daemon metadata: `~/.indusk/telemetry.pid`, `~/.indusk/telemetry.json` (`{containerId, port, startedAt, imageRef}`), `~/.indusk/telemetry.log` (redirected container logs).
- [ ] `start` auto-bumps port if requested is taken; prints warning. `restart` = `stop + start`. `status` prints running state + port + container ID + started-at + registered-project count.

#### Phase 3 Verification
- [ ] T1 (write red): commit `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` running `indusk telemetry start --port 0`, asserting exit 0 + stdout contains port + daemon reachable via curl. Red today; goes green at Phase 3 close.
- [ ] T3 passes: same subprocess test asserts `indusk telemetry status` after successful start reports running + ports + project count.
- [ ] T4 passes: test asserts `indusk telemetry stop` exits 0 in <3s + subsequent `status` says "not running".
- [ ] T5 passes: second subprocess test for `indusk telemetry restart` captures container ID before + after; asserts different.

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

### Phase 6: init integration + existing-project upgrade

**Goal**: both install paths work — `indusk init --extensions local-telemetry` scaffolds cleanly; existing `dash0`-only projects opt in without rewriting `instrumentation.ts`.

- [ ] Extend `apps/indusk-mcp/src/bin/commands/init.ts` to recognize `--extensions local-telemetry` and trigger Phase 4 enable path during init.
- [ ] Write migration guidance in `overview.md`: existing projects run `indusk extensions enable local-telemetry` + rely on existing `instrumentation.ts` (no code change); extension swaps the endpoint. Describe exact file changes.
- [ ] Handle `dash0` + `local-telemetry` coexistence: both enabled simultaneously; active profile (via ce or env files) determines runtime endpoint. Document.
- [ ] Validate both install paths: fresh-project scaffold from `indusk init` + existing-project upgrade from `indusk extensions enable`. Both must produce a working setup.

#### Phase 6 Verification
- [ ] T18 (write red): end-to-end `apps/indusk-mcp/src/__tests__/telemetry-init-fresh.test.ts` — `mkdtemp` project + `indusk init --extensions local-telemetry` → `.env` written, registry updated, MCP tools in `.mcp.json`, daemon running, test script emits + queries spans. Goes green at Phase 6.
- [ ] T19 (write red): end-to-end `telemetry-extension-disable.test.ts` — enable in two tmp projects, disable first (daemon stays), disable second (daemon stops), registry empty. Goes green at Phase 6.
- [ ] T20 (write red): end-to-end `telemetry-existing-project-upgrade.test.ts` — fresh project with `dash0` only → `indusk extensions enable local-telemetry` → `instrumentation.ts` unchanged, `.env` contains new endpoint, project registered, daemon running.

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
| `apps/indusk-mcp/package.json` | Version bump 1.27.x → 1.28.0; `files` gains `telemetry/`; Docker is consumer prerequisite, not package dep |
| `apps/indusk-mcp/telemetry/Dockerfile` (or `docker-compose.yaml`) | NEW — container assembly per spike decision |
| `apps/indusk-mcp/telemetry/collector-config.yaml` | NEW — OTel Collector pipeline (locked in v1) |
| `apps/indusk-mcp/telemetry/README.md` | NEW — dev-facing run-by-hand instructions |
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

- **OrbStack / Docker** already a prerequisite (same as `indusk-infra`); no regression.
- **Node 22** (already required).
- Image distribution path (registry vs local-build) per spike Phase 1.

## Notes

- **Phase ordering is strict**: Phase 1 must complete before Phase 2 (packaging + distribution decisions gate Phase 2's Dockerfile/Compose).
- **No OTel gate sections in this impl**: dusk has `otel.role: library`; Phase N OTel sections are omitted per the role-aware gate.
- **The spike is load-bearing**: if Phase 1 discovers the 500 ms budget can't be met for realistic loads, T12 has to be renegotiated in an ADR addendum before Phase 5 closes. Spike findings are binding, not advisory.
- **The extension does not modify `instrumentation.ts`** — only env values. Keeps migration-from-Dash0-only trivial.
- **Auto-start on enable + auto-stop when last disables** is the cleanup discipline — matches admin-UI. A dangling daemon after uninstall is friction we're actively preventing.
- **Cross-project substrate**: one daemon serves every registered project. `service.name` attribute distinguishes. Tested on dusk + Numero at Phase 7 (T21 / T22).
