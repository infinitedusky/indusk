---
name: a-click-and-its-server-work-share-a-trace
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: browser-telemetry-leftovers
sites: []
tests: []
incidents: []
---

In a project `indusk init` instrumented, every request the browser makes to the project's own services, on its own origin or on any origin or origin pattern the project names, carries the trace it started in, so the server's spans and its promise marks belong to the click that caused them.

## History
- 2026-10-10 — declared (browser-telemetry-leftovers), from its planning conversation.
