---
title: "The watcher proves it is watching — Research"
date: 2026-10-03
status: complete
workflow: feature
---

# The watcher proves it is watching — Research

## Question

What would have to exist for the promise readers to tell "Jaeger answered,
and nothing broke" from "Jaeger answered, and nothing is arriving"? Where can
a heartbeat come from, locally and on the always-on server, and which readers
would have to check it?

## Findings

### The local daemon is two binaries and nothing else

`daemonStart` (`src/lib/telemetry/daemon.ts:376-502`) spawns `jaeger` and
`otelcol` from the platform binaries package, both `detached` and `unref`'d,
and exits. No Node process stays running. `telemetry.json` records both PIDs
and the ports: Jaeger OTLP HTTP (default 4318), query/UI (16686), and
picked-free ports for gRPC, health, `jaeger_mcp`, and otelcol's logs-only
OTLP intake. `daemonStop` (`:504-571`) stops exactly the two PIDs it finds in
`telemetry.json`, after `verifyIdentity` confirms each is alive and on its
port.

Neither rendered config emits anything on a timer (`daemon.ts:188-310`): only
`otlp` receivers, `service.telemetry` with metrics off and no traces block.
`batch` and `memory_limiter` run on timers but create no data.

### Readers check reachability, never freshness

- **`readPromiseMarks` / `markedSpans`** (`src/lib/promises/telemetry.ts`):
  `JaegerUnreachable` on a connection error, timeout, non-2xx, or a body that
  is not Jaeger's. When Jaeger answers with no spans, every promise reads
  `{violations: [], lastUpheld: null}`.
- **`promise_health`** (`src/tools/plan-tools.ts:134-167`, `lib/promises/health.ts`):
  on a throw, `isError` and no counts; otherwise 0 violations and
  `lastSeen: null` — nothing marked stale, nothing needing attention.
- **The admin** (`apps/indusk-admin/src/lib/promise-health.ts`): unreachable
  reads "health unknown since …"; an answering Jaeger with no marks reads
  **unverified** — the same chip as an unreadable one, for a different fact.
- **`/catchup`** (`skills/catchup.md:133-152`): says unreachable out loud and
  never reports zero for it; says nothing about a reachable Jaeger that
  receives nothing.

The 2026-10-01 incident is exactly the gap: a test's leaked Jaeger answered on
the default ports, so every reader saw a healthy backend with seven silent
days.

### The always-on server already has a clock

`serve()` (`src/lib/telemetry/server.ts:238-262`) is a long-running Node
process — the container's process 1 — that runs Jaeger in the foreground and
calls `startPass` (`src/lib/always-on/schedule.ts:23-49`), a `setInterval`
every `INDUSK_SERVER_PASS_INTERVAL_MS` (default 60 s). Each pass queries the
server's own Jaeger for violated marks and announces new ones to Slack
(`pass.ts`). It emits no spans of its own.

### How a mark reaches Jaeger today

The only production emitter is the evaluator: `markEvaluation`
(`src/lib/eval/otel.ts:258-275`), service `indusk-eval-agent`, through a
`NodeTracerProvider` → `BatchSpanProcessor` → `OTLPTraceExporter` to
`OTEL_EXPORTER_OTLP_ENDPOINT` or the live daemon's `otlpPort`
(`liveOtlpEndpointSync`, `status.ts:106`). A heartbeat sent the same way
travels the same path a promise mark does.

### Nothing in the tree measures data freshness

The only "heartbeat" in `src` is the agent registry's (`lib/agents/`), a
different concept. `lastSeen` on a promise row is reported but never compared
against anything. Process liveness (`verifyIdentity`) is checked; whether the
backend received anything recently is not.

### Where a heartbeat could come from

- **Locally — a third detached process.** `daemonStart` also spawns a small
  Node emitter that sends one span to the daemon's own OTLP port every
  60 s, recorded in `telemetry.json` and stopped by `daemonStop` beside the
  other two. Travels the real path; adds a process the stop/identity logic
  must learn.
- **Locally — a probe at read time.** The reader sends one span through OTLP
  and reads it back before reading any promise. Proves the path *now*, with
  no extra process; cannot say *since when* it has been blind, and a process
  that answers OTLP but is not this project's Jaeger would fail the read-back,
  which is the point.
- **The collector's own traces.** `service.telemetry.traces` would make Jaeger
  trace itself, but only for work it does — silence produces no self-traces,
  so it cannot distinguish idle from deaf.
- **From the existing emitters.** The evaluator marks every commit; that is a
  promise's own signal, irregular by nature, not a heartbeat.
- **On the server — in process.** `serve()` already runs a 60 s interval; it
  can send a span into its own OTLP intake and the pass can read its age.

## Open Questions

- The staleness threshold: the brief says "about three minutes" against a
  60 s beat.
- Whether a read-time probe and a periodic beat are both wanted — one answers
  "can it hear right now", the other "since when has it been deaf".
- How the server alerts on its own stale heartbeat when the thing that went
  deaf is the Jaeger it posts from — the alert must not depend on the path it
  is reporting broken.

## Sources

- `apps/indusk-mcp/src/lib/telemetry/daemon.ts`, `status.ts`, `server.ts`
- `apps/indusk-mcp/src/lib/promises/telemetry.ts`, `health.ts`, `vocabulary.ts`
- `apps/indusk-mcp/src/lib/always-on/pass.ts`, `schedule.ts`
- `apps/indusk-mcp/src/lib/eval/otel.ts`
- `apps/indusk-admin/src/lib/promise-health.ts`
- `apps/indusk-mcp/skills/catchup.md`
