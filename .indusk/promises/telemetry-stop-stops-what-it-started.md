---
name: telemetry-stop-stops-what-it-started
kind: state
lifetime: holds
state: declared
domain: admin
owner: telemetry-stop-stops-what-it-started
sites: []
tests: []
incidents: []
---

`indusk telemetry stop` stops the Jaeger and otelcol it started, even when their ports are slow to answer; it never signals a process that is not its own, and never reports them stopped while they still run.

## History
- 2026-10-07 — declared (telemetry-stop-stops-what-it-started), from its planning conversation.
