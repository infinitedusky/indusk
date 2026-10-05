---
name: a-closed-plan-kept-its-promises
kind: state
lifetime: holds
state: enforced
domain: planning
owner: planner-promises
sites:
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
  - apps/indusk-mcp/src/lib/promises/confirm.ts
tests:
  - apps/indusk-mcp/src/__tests__/promises-confirm.test.ts
incidents: []
---

A plan cannot close while a promise it made has no passing test that names it. When it closes, its promises are enforced.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A8, row A9, row A10, row A11.
