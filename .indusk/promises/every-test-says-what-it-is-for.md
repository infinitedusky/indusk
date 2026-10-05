---
name: every-test-says-what-it-is-for
kind: state
lifetime: holds
state: enforced
domain: planning
owner: planner-promises
sites:
  - apps/indusk-mcp/hooks/validate-impl-structure.js
  - apps/indusk-mcp/src/lib/promises/contract.ts
  - apps/indusk-mcp/src/lib/trajectory/validator.ts
tests:
  - apps/indusk-mcp/src/__tests__/row-purpose.test.ts
  - apps/indusk-mcp/src/__tests__/promises-contract.test.ts
  - apps/indusk-admin/src/components/phases/TrajectoryRowsTable.test.tsx
incidents: []
---

Every test row in a plan says what it is for: the promise it proves, the lesson it guards, or why it needs neither. A plan with a row that says none of these is refused.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A5, row A6, row A7.
