---
name: a-new-project-is-written-only-under-its-parent
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - apps/indusk-admin/src/__tests__/new-project-parent.test.ts
  - apps/indusk-admin/src/app/api/new-projects/parent/route.ts
  - apps/indusk-admin/src/components/new-project/NewProjectParent.tsx
  - apps/indusk-mcp/src/lib/new-project/create.ts
  - apps/indusk-mcp/src/lib/new-project/parent.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-mcp/src/lib/new-project/prompt.test.ts
incidents: []
---

The admin creates a project only inside the parent directory the person configured.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A15, row A16, row A31, row A36.
