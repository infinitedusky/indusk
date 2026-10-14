---
name: a-new-version-of-the-founding-brief-shows-what-changed
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/add/route.ts'
  - apps/indusk-mcp/src/lib/new-project/documents.test.ts
  - apps/indusk-mcp/src/lib/new-project/documents.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
incidents: []
---

When the person gives a newer version of their document during the conversation, the agent shows what changed and works from the new one.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A9.
