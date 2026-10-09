---
name: a-server-is-read-back-before-the-command-ends
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/connect.ts
tests:
  - apps/indusk-mcp/src/lib/server/connect.test.ts
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
incidents: []
---

Either command ends only after it has sent a mark through the server's intake and read it back through the address the project will use, and otherwise says what is missing.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A15, row A16, row A17, row A24.
