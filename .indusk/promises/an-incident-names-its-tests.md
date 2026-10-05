---
name: an-incident-names-its-tests
kind: state
lifetime: holds
state: enforced
domain: planning
owner: planner-promises
sites:
  - apps/indusk-mcp/src/lib/promises/incidents.ts
  - apps/indusk-mcp/src/lib/promises/reopen.ts
tests:
  - apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts
  - apps/indusk-mcp/src/__tests__/reopen-row-complete.test.ts
incidents: []
---

When a promise breaks, its incident names the tests that were proving it, and the plan it reopens can still be edited.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A12, row A13.
