---
name: a-closed-plan-kept-its-promises
kind: state
lifetime: holds
state: enforced
domain: planning
owner: mark-first
sites:
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
  - apps/indusk-mcp/src/lib/promises/confirm.ts
tests:
  - apps/indusk-mcp/src/__tests__/promises-confirm.test.ts
incidents: []
---

A plan cannot close while a clause of a promise it holds has a failing test or no signal that has reported it upheld; a plan written before clause plans closes, as before, on passing tests that name its promises. When it closes, its promise is enforced.

## History
- 2026-10-05 — declared (planner-promises, Test Phase 1), from the planning conversation of that day. Written by hand: the command that writes a promise is this plan's Build Phase 3.
- 2026-10-05 — enforced, confirmed for planner-promises: proven by row A8, row A9, row A10, row A11.
- 2026-10-19 — changed by mark-first: closing now runs the tests and reads the signal. It read: "A plan cannot close while a promise it made has no passing test that names it. When it closes, its promises are enforced." Owned before by planner-promises; mark-first takes it over.
