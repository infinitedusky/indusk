---
name: a-mockup-leaves-nothing-undefined
kind: structure
lifetime: holds
state: enforced
domain: gates
owner: ui-promises
sites:
  - apps/indusk-mcp/src/lib/looks/foundation.test.ts
  - apps/indusk-mcp/src/lib/looks/foundation.ts
  - apps/indusk-mcp/src/lib/looks/lint-classes.ts
  - apps/indusk-mcp/src/lib/looks/lint-values.ts
  - apps/indusk-mcp/src/lib/looks/lint.ts
  - apps/indusk-mcp/src/lib/looks/mockups.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-cli.test.ts
  - apps/indusk-mcp/src/__tests__/looks-admin-foundation.test.ts
  - apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts
incidents: []
---

Every colour, size, space, radius, shadow, font and motion value in a mockup or in the app comes from a defined token, so the first mockup defines the foundation and no later one can add a raw value.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A5, row A6, row A7, row A8, row A9, row A31, row A32, row A33, row A38.
