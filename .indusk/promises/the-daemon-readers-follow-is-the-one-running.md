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
