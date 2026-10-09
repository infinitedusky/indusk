---
name: a-fly-deploy-is-one-command
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/deploy.ts
tests:
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
  - apps/indusk-mcp/e2e/server-live.e2e.test.ts
incidents: []
---

One command creates a project's recording server in the person's own Fly account, reachable at a public address, and connects the project to it, with nothing to do between the command and the first production read.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A5, row A6, row A7, row A8, row A23.
