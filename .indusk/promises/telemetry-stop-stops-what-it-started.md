---
name: telemetry-stop-stops-what-it-started
kind: state
lifetime: holds
state: retired
domain: admin
owner: telemetry-stop-stops-what-it-started
sites:
  - apps/indusk-mcp/src/lib/telemetry/stop.ts
tests:
  - apps/indusk-mcp/src/lib/telemetry/stop.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts
incidents: []
---

`indusk telemetry stop` stops the Jaeger and otelcol it started, even when their ports are slow to answer; it never signals a process that is not its own, and never reports them stopped while they still run.

## History
- 2026-10-07 — declared (telemetry-stop-stops-what-it-started), from its planning conversation.
- 2026-10-07 — enforced, confirmed for telemetry-stop-stops-what-it-started: proven by row A1, row A2, row A3, row A4.
- 2026-10-08 — retired, confirmed for small-fixes: replaced by `indusk-stops-only-its-own-daemons`.
