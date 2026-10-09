---
name: provisioning-never-prints-a-secret
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/src/lib/server/redact.ts
tests:
  - apps/indusk-mcp/src/lib/server/redact.test.ts
  - apps/indusk-mcp/src/lib/server/connect.test.ts
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
incidents: []
---

The server's password and the Slack webhook never appear in either command's output, in the project's config, or in anything committed; the config names the variable, and the value lives in the machine's secrets.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A9, row A10.
