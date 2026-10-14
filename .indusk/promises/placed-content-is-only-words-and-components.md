---
name: placed-content-is-only-words-and-components
kind: state
lifetime: holds
state: enforced
domain: gates
owner: component-content
sites:
  - apps/indusk-mcp/src/lib/looks/lint-components.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-component-content-lint.test.ts
  - apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts
incidents: []
---

What a mockup puts inside a placed component is text or other components placed by name; anything else is refused, so content never restyles a component or carries a drawing back in.

## History
- 2026-10-13 — declared (component-content), from its planning conversation.
- 2026-10-14 — enforced, confirmed for component-content: proven by row A6, row A7, row A8, row A15, row A16.
