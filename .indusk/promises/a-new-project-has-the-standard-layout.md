---
name: a-new-project-has-the-standard-layout
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: new-project-flow
sites:
  - apps/indusk-mcp/src/lib/new-project/create.ts
  - apps/indusk-mcp/src/lib/new-project/install.ts
tests:
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-mcp/src/lib/new-project/proposal.test.ts
incidents: []
---

Every project created this way has the same layout — the workbench at the root, the repository inside it, a worktrees folder beside it, all declared in the project's config — and the project's own checks report it healthy.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A6, row A32, row A33, row A40.
