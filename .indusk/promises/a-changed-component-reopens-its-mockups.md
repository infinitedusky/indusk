---
name: a-changed-component-reopens-its-mockups
kind: state
lifetime: holds
state: enforced
domain: admin
owner: storybook-components
sites:
  - apps/indusk-mcp/src/lib/looks/approvals.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - apps/indusk-mcp/src/lib/looks/approvals.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx'
incidents: []
---

When an approved component changes, every mockup that uses it returns to proposed, naming the component, until a person looks at it again.

## History
- 2026-10-12 — declared (storybook-components), from its planning conversation.
- 2026-10-12 — enforced, confirmed for storybook-components: proven by row A11, row A12, row A26, row A33.
