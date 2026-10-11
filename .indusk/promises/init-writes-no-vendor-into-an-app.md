---
name: init-writes-no-vendor-into-an-app
kind: structure
lifetime: holds
state: enforced
domain: scaffold
owner: browser-telemetry-leftovers
sites: []
tests:
  - apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts
incidents: []
---

Nothing `indusk init` writes into an application names or imports an observability vendor, and what it prints names the file and the SDK it actually wrote.

## History
- 2026-10-10 — declared (browser-telemetry-leftovers), from its planning conversation.
- 2026-10-11 — enforced, confirmed for browser-telemetry-leftovers: proven by row A5, row A6.
