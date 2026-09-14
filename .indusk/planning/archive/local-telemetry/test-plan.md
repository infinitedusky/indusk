---
title: "Local Telemetry — Test Plan"
date: 2026-04-20
status: accepted
---

# Local Telemetry — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean local-telemetry is working. Each assertion names the test mechanism — not the test code, but the test approach (vitest unit / vitest integration / end-to-end script / manual smoke / spike-validated). When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature has shipped.

These assertions become the source rows for the impl's `## Test Trajectory` — one trajectory row per assertion, with `Writable at` / `Passes at` columns added during impl authoring. The ADR that follows is constrained by "what makes all these assertions true?"

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| **A1** | `indusk telemetry start` from any directory brings up the telemetry daemon in under 10 s and prints its listening ports (4318 for OTel, 16686 for Jaeger UI). | end-to-end script |
| **A2** | After `indusk telemetry start`, a developer can open `http://localhost:16686` in their browser and see Jaeger's trace search UI. | manual smoke (curl + browser) |
| **A3** | `indusk telemetry status` after a successful start reports "running", both listening ports, and the count of registered projects. | end-to-end script |
| **A4** | `indusk telemetry stop` shuts the daemon down within 3 s; subsequent `status` reports "not running" and `:16686` returns connection-refused. | end-to-end script |
| **A5** | `indusk telemetry restart` stops (if running) then starts a fresh instance — picks up a new container image after an `npm i -g @infinitedusky/indusk-mcp@<newer>` without a manual stop-then-start sequence. | end-to-end script |
| **A6** | A project with local-telemetry enabled emits OTel traces to the telemetry daemon when running in dev — spans the code produces appear in Jaeger's UI and via query API within 5 seconds of emission. | vitest integration |
| **A7** | A project configured for staging or prod (local-telemetry NOT enabled, dash0 IS enabled) continues to emit OTel traces to Dash0 — no traffic lands in the local daemon, no Dash0 quota disruption. | manual smoke (two profiles) |
| **A8** | Running a project's dev workflow with local-telemetry enabled produces zero OTel traffic to Dash0 — measurable as zero ingest events in Dash0 over the dev session. | manual smoke (Dash0 ingest check) |
| **A9** | When a developer asks the agent "why did X just fail?", the agent calls `get_recent_spans` MCP tool and surfaces the relevant error span(s) from the last run — no cloud round-trip, no re-run with verbose logging. | end-to-end script (deliberate fail + agent query) |
| **A10** | Given a trace ID, the agent can call `get_trace(trace_id)` and receive the complete span tree as JSON. | vitest integration |
| **A11** | The agent can ask "which services have emitted telemetry in this project?" via `get_services()` and receive the list the daemon knows about. | vitest integration |
| **A12** | For a realistic dev workload (~100 spans emitted across 5 seconds), `get_recent_spans` returns matching spans in under 500 ms — fast enough that the agent calls it inline during diagnosis without a perceptible pause. | vitest integration (timing) — spike validates budget |
| **A13** | `tail_logs --service <name> --since 5m --level error` returns recent log records from the daemon's SQLite sink, matching filters. | vitest integration |
| **A14** | `indusk telemetry tail --service <name>` streams recent spans to stdout as they arrive, same shape the MCP tool returns. | end-to-end script |
| **A15** | `indusk telemetry trace <trace-id>` prints the full span tree to stdout, readable without opening a browser. | end-to-end script |
| **A16** | `indusk telemetry services` prints the list of services the daemon has seen, one per line. | end-to-end script |
| **A17** | `indusk telemetry reset` empties the buffer — subsequent `get_recent_spans` / `tail` / UI queries return no traces until new spans are emitted. | end-to-end script |
| **A18** | Running `indusk init --extensions local-telemetry` on a fresh project produces a working setup: the extension's `.env` is written, the project appears in `~/.indusk/telemetry/projects.json`, the MCP tools appear in the project's `.mcp.json`, the daemon auto-starts if not already running, and a test script can immediately emit + query spans — no further manual configuration. | end-to-end script (tmp project scaffold) |
| **A19** | Disabling the extension (`indusk extensions disable local-telemetry`) deregisters the project from the telemetry registry, removes the MCP tools from `.mcp.json`, and stops the daemon iff no registered projects remain. No orphan containers, no stale MCP entries. | end-to-end script |
| **A20** | An existing project (one that already uses `dash0` extension, already has `instrumentation.ts`) can opt into local-telemetry via `indusk extensions enable local-telemetry` without rewriting `instrumentation.ts` — the env file swap is the only behavioral change. | end-to-end script (existing project upgrade) |
| **A21** | An integration test that fails (cross-service assertion mismatch) emits server-side spans that the developer or agent can retrieve via MCP within 5 seconds of the failure — enabling the `test-strategy-convention` plan's diagnosis use cases. | manual smoke (deliberate-fail integration test) |
| **A22** | Restarting the telemetry daemon does not orphan client OTel exporters — reconnection happens automatically once the daemon is healthy again, and retention behavior matches the configured storage mode (in-memory → buffer empty; Badger → preserved). | manual smoke |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | "The loop from failure to diagnosis takes seconds, not minutes" — the subjective developer-experience quality claim. | UX claims resist programmatic measurement — the right test is "try it and see." A stopwatch test would test wall-clock time, not whether the experience felt fast. | Spike Phase 1 demonstrates the loop live in the working session. Subsequent `test-strategy-convention` plan's E2E test diagnosis is the recurring informal test. |
| U2 | "Agent has total visibility" — user's phrase for the autonomous-dev target state. | Aspirational. Visibility is incrementally proven by each downstream plan (watcher agent, test-strategy E2E smoke) rather than this plan alone. | Downstream plans (`telemetry-watcher-agent`, `test-strategy-convention`) consume this substrate; if they can't get what they need, the gap surfaces there. Retrospective asks whether the substrate met downstream needs. |
| U3 | Bundle weight of `indusk-infra` stays pragmatic (< ~800 MB) after adding Jaeger + optional Collector. | Measurement is concrete but "pragmatic" is judgment. | Spike Phase 1 measures and the ADR captures the decision. Retrospective revisits if the size causes real friction (install time, disk pressure). |

## Notes

- **A1–A5 are daemon-lifecycle assertions** parallel to the admin-UI daemon's test plan (1.27.x assertions T1–T5 in `admin-ui-hosting`). The parallel is deliberate — machine-global daemon + `start/stop/restart/status` CLI is now a two-daemon pattern (admin-UI + telemetry) and subsequent plans will inherit it. Shared shape means shared test discipline.
- **A13 (logs) is unconditional.** The OTel Collector + SQLite log sink is structural in the daemon image, not spike-decided. The spike validates query latency and retention, not whether logs exist.
- **A12's 500 ms budget is a commitment.** If the spike discovers the daemon's query latency can't hit it for realistic loads, the ADR will document the adjustment (either the budget moves, or the storage/query shape changes). Capturing the budget here makes that renegotiation explicit rather than silent.
- **A18 and A20 cover two install paths** — fresh project scaffold vs existing-project upgrade. Both must work; the second is the one that will bite most users.
- **A19's "stops the daemon iff no registered projects remain"** is the graceful-cleanup invariant. The opposite behavior (always leave the daemon running) would leak a long-lived background container after the user no longer wants it; the correct behavior (always stop on disable) would surprise users with multiple projects. `iff no projects remain` matches the admin-UI precedent.
- **A21 is the bridge to the test-strategy plan.** It's in scope here because local-telemetry's whole diagnosis-UX claim rests on integration-test failures being instantly inspectable. If A21 can't be made true, `test-strategy-convention`'s diagnosis story is also weaker.
- **No metric or alert assertions.** Deliberate — scope boundary from the brief. If someone reads this plan and asks "where's the assertion about alerting on p99 latency?" the answer is: not here, not now, not ever in this plan. That's Dash0's job.
