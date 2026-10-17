---
name: a-mockup-composes-approved-components
kind: structure
lifetime: holds
state: enforced
domain: gates
owner: storybook-components
sites:
  - apps/indusk-mcp/src/lib/looks/compose.test.ts
  - apps/indusk-mcp/src/lib/looks/compose.ts
  - apps/indusk-mcp/src/lib/looks/lint-components.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts'
  - apps/indusk-mcp/src/__tests__/looks-components-cli.test.ts
incidents:
  - i-2026-10-16-a-mockup-composes-approved-components
---

A mockup shows a component only by naming it, so the approved component is what appears; a component a mockup draws itself is refused unless it is declared new.

## History
- 2026-10-12 — declared (storybook-components), from its planning conversation.
- 2026-10-12 — enforced, confirmed for storybook-components: proven by row A7, row A8, row A9, row A10, row A32.
