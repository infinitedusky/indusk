---
name: a-briefs-promises-are-in-the-registry
kind: state
lifetime: holds
state: enforced
domain: planning
owner: planner-promises
sites:
  - apps/indusk-mcp/src/lib/promises/contract.ts
  - apps/indusk-mcp/src/lib/promises/write.ts
tests:
  - apps/indusk-mcp/src/__tests__/promises-declare.test.ts
  - apps/indusk-mcp/src/__tests__/promises-contract.test.ts
incidents: []
---

Every promise a plan's brief names is in the registry and owned by that plan. A plan cannot start building while its brief names one the registry does not hold.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A1, row A2, row A3, row A4, row A23.
