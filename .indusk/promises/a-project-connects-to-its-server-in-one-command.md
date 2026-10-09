---
name: a-project-connects-to-its-server-in-one-command
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/connect.ts
tests:
  - apps/indusk-mcp/src/lib/server/connect.test.ts
  - apps/indusk-mcp/e2e/server-live.e2e.test.ts
incidents: []
---

One command points a project at a recording server the person runs, wherever it runs: the project's config names it as the production source, the credential is stored on the machine and never in the project, and the admin shows the server's promises on the next read.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A1, row A2, row A3, row A4, row A25.
