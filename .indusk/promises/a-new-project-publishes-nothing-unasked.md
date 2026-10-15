---
name: a-new-project-publishes-nothing-unasked
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/accept/route.ts'
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.tsx
  - apps/indusk-mcp/src/lib/new-project/create.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-admin/src/components/new-project/NewProjectProposal.test.tsx
  - apps/indusk-admin/src/__tests__/new-project-accept.test.ts
incidents: []
---

Creating a project sends nothing off the machine; a remote repository is created only after the person confirms it.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A13, row A14, row A37, row A38.
