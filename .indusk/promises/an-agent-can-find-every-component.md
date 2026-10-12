---
name: an-agent-can-find-every-component
kind: state
lifetime: holds
state: enforced
domain: planning
owner: storybook-components
sites:
  - apps/indusk-mcp/src/lib/looks/components.ts
  - apps/indusk-mcp/src/lib/looks/lint-components.ts
  - apps/indusk-mcp/src/lib/looks/stories-catalog.ts
  - apps/indusk-mcp/src/lib/looks/stories.ts
tests:
  - apps/indusk-admin/src/__tests__/storybook.contract.test.ts
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
incidents: []
---

Every component, with its properties and its states, is listed in a catalog an agent can read before it writes a component, with nothing running.

## History
- 2026-10-12 — declared (storybook-components), from its planning conversation.
- 2026-10-12 — enforced, confirmed for storybook-components: proven by row A13, row A14.
