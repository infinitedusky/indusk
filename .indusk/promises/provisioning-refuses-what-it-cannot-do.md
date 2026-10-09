---
name: provisioning-refuses-what-it-cannot-do
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/plan-deploy.ts
tests:
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
incidents: []
---

Without the Fly CLI signed in, or when the server's name is taken by something that is not this project's server, the Fly command refuses by name before creating anything.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A13, row A14.
