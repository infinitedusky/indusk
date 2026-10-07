---
name: the-demo-app-starts-with-its-promise-holding
kind: state
lifetime: holds
state: enforced
domain: admin
owner: demo-app-template
sites:
  - apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts
  - apps/indusk-mcp/src/bin/commands/demo.ts
  - apps/indusk-mcp/src/lib/promises/citations.test.ts
tests:
  - apps/indusk-mcp/src/__tests__/demo-example.test.ts
  - apps/indusk-mcp/src/__tests__/demo-command.test.ts
incidents: []
---

Copying the seat-holds example and running its start command gives a project that runs locally: a page for holding and booking seats, one promise already marked and tested, and that promise shown holding in the admin.

## History
- 2026-10-07 — declared (demo-app-template), from its planning conversation.
- 2026-10-07 — enforced, confirmed for demo-app-template: proven by row A3, row A4.
