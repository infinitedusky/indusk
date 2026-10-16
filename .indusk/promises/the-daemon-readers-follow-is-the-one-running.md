---
name: the-daemon-readers-follow-is-the-one-running
kind: behaviour
lifetime: holds
state: declared
domain: server
owner: daemon-found-not-guessed
sites: []
tests: []
incidents: []
clauses:
  - name: one-daemon-on-fixed-ports
    kind: limit
    statement: "At most one InDusk daemon runs on a machine, on fixed ports: 4318 for traces, 4319 for logs, 16686 for its interface and one fixed port for its MCP server; a start that finds one of them held by something else refuses and names what holds it."
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
- 2026-10-16 — declared (daemon-found-not-guessed), from its planning conversation.
