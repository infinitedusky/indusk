---
name: the-daemon-readers-follow-is-the-one-running
kind: behaviour
lifetime: holds
state: enforced
domain: server
owner: daemon-found-not-guessed
sites:
  - apps/indusk-mcp/src/__tests__/telemetry-mcp-port-sync.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-restart-port-pin.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-self-tracing-lines.test.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-address.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-find.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-process.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-reports.ts
  - apps/indusk-mcp/src/lib/telemetry/daemon-state.ts
  - apps/indusk-mcp/src/lib/telemetry/reap-plan.ts
  - apps/indusk-mcp/src/lib/telemetry/register.ts
  - apps/indusk-mcp/src/lib/telemetry/start-plan.ts
tests:
  - apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts
  - apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-address.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-daemon-state.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-slow-not-gone.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-daemon-found.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-daemon-found-live.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-register.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-mcp-entries.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-reap-plan.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-reap-strays.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-self-tracing.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-own-only.test.ts
incidents: []
clauses:
  - name: one-daemon-on-its-own-ports
    kind: limit
    statement: "At most one InDusk daemon runs on a machine, on one address chosen once and kept until a person chooses it again with `indusk telemetry address --reset`: InDusk's own port block (24318 for traces, 24319 for logs, 24316 for its interface, 24317 for its MCP server), or, when one of those is held at first setup, free ports picked once and recorded, which InDusk never changes on its own; every reader, every InDusk command and what `init` hands an application read that stored address and never assume one."
  - name: a-read-never-loses-the-daemon
    kind: limit
    statement: "No status read, health check or promise reader deletes the daemon's record; a port slow to answer reads as slow, never as gone."
  - name: a-lost-daemon-is-found
    kind: split
    statement: "When the record is missing, a running InDusk daemon is found from the process list, its record is written again, and `telemetry start` takes it over instead of starting another."
  - name: nothing-starts-a-second
    kind: limit
    statement: "Enabling the telemetry extension, `init` and `update` never start a daemon beside a running one and never point another project's MCP entry somewhere else."
  - name: strays-are-cleared
    kind: split
    statement: "`telemetry status` lists every InDusk daemon process the record does not name, and `telemetry reap` stops them."
  - name: the-log-is-readable
    kind: split
    statement: "The daemon's log carries no lines of Jaeger failing to send its own traces."
---

Every reader of promises, every InDusk command and every application on a machine reaches the same one local telemetry daemon.

## History
- 2026-10-17 — declared (daemon-found-not-guessed), from its planning conversation.
- 2026-10-17 — enforced, confirmed for daemon-found-not-guessed: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A29, row A30, row A7, row A8, row A9, row A10, row A11, row A12, row A13, row A14, row A15, row A16, row A17, row A18, row A19, row A20, row A21, row A22, row A23, row A24, row A32, row A33, row A35, row A36, row A37, row A38, row A39, row A40, row A41, row A42, row A43.
