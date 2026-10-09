---
name: a-second-run-updates-not-duplicates
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/plan-deploy.ts
tests:
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
  - apps/indusk-mcp/src/lib/server/connect.test.ts
incidents: []
---

Running the Fly command again for a project that has a server updates it, and never creates a second app, volume or address; running connect again for a project replaces what it named before.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A11, row A12, row A22.
