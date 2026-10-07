---
name: the-demo-break-is-caught-locally
kind: state
lifetime: holds
state: enforced
domain: admin
owner: demo-app-template
sites:
  - apps/indusk-mcp/src/bin/commands/demo.ts
tests:
  - apps/indusk-mcp/src/__tests__/demo-command.test.ts
incidents: []
---

Turning on the seat-holds example's fault switch makes its promise show broken in the admin within seconds, with the span that broke it, and it stays broken after the switch is off, until the break is recorded and fixed.

## History
- 2026-10-07 — declared (demo-app-template), from its planning conversation.
- 2026-10-07 — enforced, confirmed for demo-app-template: proven by row A7.
