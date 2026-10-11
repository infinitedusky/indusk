---
name: a-click-and-its-server-work-share-a-trace
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: browser-telemetry-leftovers
sites:
  - apps/indusk-mcp/templates/instrumentation.web.ts
tests:
  - apps/indusk-mcp/templates/instrumentation.web.test.ts
incidents: []
---

In a project `indusk init` instrumented, every request the browser makes to the project's own services, on its own origin or on any origin or origin pattern the project names, carries the trace it started in, so the server's spans and its promise marks belong to the click that caused them.

## History
- 2026-10-10 — declared (browser-telemetry-leftovers), from its planning conversation.
- 2026-10-11 — enforced, confirmed for browser-telemetry-leftovers: proven by row A1, row A2, row A3.
