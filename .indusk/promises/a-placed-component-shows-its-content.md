---
name: a-placed-component-shows-its-content
kind: state
lifetime: holds
state: enforced
domain: gates
owner: component-content
sites:
  - apps/indusk-mcp/src/lib/looks/compose.ts
  - apps/indusk-mcp/src/lib/looks/stories-catalog.test.ts
  - apps/indusk-mcp/src/lib/looks/stories.ts
tests:
  - apps/indusk-mcp/src/lib/looks/compose.test.ts
  - apps/indusk-mcp/src/__tests__/looks-component-content.contract.test.ts
  - apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts
incidents: []
---

A mockup places a component together with the words it needs, and shows the approved component with those words in place of the story's.

## History
- 2026-10-13 — declared (component-content), from its planning conversation.
- 2026-10-14 — enforced, confirmed for component-content: proven by row A1, row A2, row A3, row A4, row A5, row A12, row A13, row A14, row A17.
