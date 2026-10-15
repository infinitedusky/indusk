---
name: a-new-project-is-made-by-the-agent
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: new-project-flow
sites:
  - apps/indusk-admin/src/__tests__/new-project-accept-route.test.ts
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/accept/route.ts'
  - apps/indusk-admin/src/components/new-project/NewProjectCreating.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectCreatingPanel.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectStart.tsx
  - apps/indusk-admin/src/components/new-project/creation-stream.test.ts
  - apps/indusk-mcp/src/bin/commands/new-project.ts
  - apps/indusk-mcp/src/lib/new-project/create.ts
  - apps/indusk-mcp/src/lib/new-project/steps.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-admin/src/components/new-project/NewProjectCreating.test.tsx
  - apps/indusk-admin/src/components/new-project/NewProjectStart.test.tsx
incidents: []
---

Accepting the proposal creates the workbench, the project's repository inside it and its worktrees folder, and installs InDusk, with no command typed by the person.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A4, row A5, row A35.
