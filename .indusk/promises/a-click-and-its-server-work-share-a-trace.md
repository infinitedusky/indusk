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

In a project `indusk init` instrumented, every `fetch` or XMLHttpRequest the browser makes in a click's call to the project's own services — on its own origin or on any origin or origin pattern the project names — carries the trace the click started, so the server's spans and its promise marks belong to the click that caused them. A request made after a native `await` in the handler is not promised.

## History
- 2026-10-10 — declared (browser-telemetry-leftovers), from its planning conversation.
- 2026-10-11 — enforced, confirmed for browser-telemetry-leftovers: proven by row A1, row A2, row A3.
- 2026-10-11 — changed by browser-telemetry-leftovers: the cold audit read the sentence against its rows: XHR was not instrumented and a request after a native await cannot follow the click (zone.js does not patch native async/await); the sentence now says what is proven. It read: "In a project `indusk init` instrumented, every request the browser makes to the project's own services, on its own origin or on any origin or origin pattern the project names, carries the trace it started in, so the server's spans and its promise marks belong to the click that caused them."
