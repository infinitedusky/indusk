---
name: an-unkept-project-conversation-leaves-nothing-on-disk
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/discard/route.ts'
  - apps/indusk-mcp/src/bin/commands/new-project.ts
  - apps/indusk-mcp/src/lib/new-project/prompt.ts
  - apps/indusk-mcp/src/lib/new-project/store.ts
  - apps/indusk-mcp/src/lib/session/permissions.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-mcp/src/lib/session/permissions.test.ts
incidents: []
---

A project conversation that is abandoned before acceptance creates no directory and registers no project.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A17, row A18, row A39.
