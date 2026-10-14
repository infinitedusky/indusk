---
name: the-core-is-always-kept
kind: state
lifetime: holds
state: enforced
domain: planning
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/proposal/route.ts'
  - apps/indusk-mcp/src/bin/commands/new-project.ts
  - apps/indusk-mcp/src/lib/config.test.ts
  - apps/indusk-mcp/src/lib/new-project/proposal.ts
  - apps/indusk-mcp/src/lib/required-documents.test.ts
  - apps/indusk-mcp/src/lib/workflow-types.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-mcp/src/__tests__/documents-off.test.ts
incidents: []
---

A project created this way always plans with a brief that makes promises and a test plan; the other planning documents can be turned off.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A11, row A12.
