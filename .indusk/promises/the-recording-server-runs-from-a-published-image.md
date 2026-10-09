---
name: the-recording-server-runs-from-a-published-image
kind: state
lifetime: holds
state: enforced
domain: server
owner: server-provisioning
sites:
  - apps/indusk-mcp/scripts/release-image.sh
  - apps/indusk-mcp/src/lib/server/deploy.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-script.test.ts
  - apps/indusk-mcp/src/__tests__/always-on-image.test.ts
  - apps/indusk-mcp/src/lib/server/deploy.test.ts
incidents: []
---

Every release publishes the recording server's image to a public registry, and that image runs with a volume, two ports and its secrets, with no InDusk checkout and no build on the person's side.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
- 2026-10-09 — enforced, confirmed for server-provisioning: proven by row A18, row A19, row A20.
