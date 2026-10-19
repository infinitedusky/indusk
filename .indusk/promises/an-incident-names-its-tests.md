---
name: an-incident-names-its-tests
kind: state
lifetime: holds
state: enforced
domain: planning
owner: mark-first
sites:
  - apps/indusk-mcp/src/lib/promises/incidents.ts
  - apps/indusk-mcp/src/lib/promises/reopen.ts
tests:
  - apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts
  - apps/indusk-mcp/src/__tests__/reopen-row-complete.test.ts
incidents: []
---

When a clause breaks, its incident names the promise and the clause that broke, and the tests tied to that clause are reachable from it; the plan it reopens can still be edited.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A12, row A13.
- 2026-10-19 — changed by mark-first: the incident names its clause first. It read: "When a promise breaks, its incident names the tests that were proving it, and the plan it reopens can still be edited." Owned before by planner-promises; mark-first takes it over.
