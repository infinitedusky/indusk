---
name: a-component-has-one-implementation
kind: structure
lifetime: holds
state: enforced
domain: gates
owner: main-suite-green
sites:
  - apps/indusk-mcp/src/lib/looks/components.ts
  - apps/indusk-mcp/src/lib/looks/lint-components.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
  - apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts
incidents: []
---

Each component the mockups of a landed plan name is implemented once in the app, and every screen renders that one implementation rather than its own copy.

## History
- 2026-10-12 — declared (storybook-components), from its planning conversation.
- 2026-10-12 — enforced, confirmed for storybook-components: proven by row A1, row A2, row A3, row A40.
- 2026-10-15 — changed by main-suite-green: approval merges a plan's looks to main before its code; until it lands its components cannot exist. It read: "Each component the mockups name is implemented once in the app, and every screen renders that one implementation rather than its own copy." Owned before by storybook-components; main-suite-green takes it over.
