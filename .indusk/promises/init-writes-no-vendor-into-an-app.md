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

Nothing `indusk init` writes into an application's source names or imports an observability vendor (a destination telemetry is sent to), and what it prints names the file it created and the OpenTelemetry SDK in it, for every scaffold it writes: browser, Node and Python. An OpenTelemetry distribution such as `@vercel/otel` is not a vendor in this sense.

## History
- 2026-10-10 — declared (browser-telemetry-leftovers), from its planning conversation.
- 2026-10-11 — enforced, confirmed for browser-telemetry-leftovers: proven by row A5, row A6.
- 2026-10-11 — changed by browser-telemetry-leftovers: the cold audit: A5 exempted the Node scaffold's printed lines and never ran Python (now A14), and skills installed into .claude name a vendor but are not application source. It read: "Nothing `indusk init` writes into an application names or imports an observability vendor, and what it prints names the file and the SDK it actually wrote."
