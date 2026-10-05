---
name: a-changed-promise-keeps-its-history
kind: state
lifetime: holds
state: enforced
domain: planning
owner: planner-promises
sites:
  - apps/indusk-mcp/src/lib/promises/confirm.ts
  - apps/indusk-mcp/src/lib/promises/write.ts
tests:
  - apps/indusk-mcp/src/__tests__/promises-contract.test.ts
  - apps/indusk-mcp/src/__tests__/promises-change.test.ts
  - apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts
incidents: []
---

A plan that changes or replaces an existing promise says so in its brief. A changed promise keeps its name, and its file records the old sentence, the reason and the plan that owned it before. A replaced one is retired, and the new one records which it replaced.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A24, row A25, row A26, row A27.
