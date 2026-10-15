---
name: every-component-state-has-a-story
kind: state
lifetime: holds
state: enforced
domain: gates
owner: storybook-components
sites:
  - apps/indusk-mcp/src/lib/looks/lint-components.ts
  - apps/indusk-mcp/src/lib/looks/stories.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - apps/indusk-admin/src/__tests__/storybook.contract.test.ts
incidents: []
---

Every component, in each state its mockups show, has a story that renders the real component in that state.

## History
- 2026-10-12 — declared (storybook-components), from its planning conversation.
- 2026-10-12 — enforced, confirmed for storybook-components: proven by row A4, row A5, row A6.
