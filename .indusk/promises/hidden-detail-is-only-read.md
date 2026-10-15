---
name: hidden-detail-is-only-read
kind: state
lifetime: holds
state: enforced
domain: gates
owner: story-first-phases
sites:
  - apps/indusk-mcp/hooks/check-gates.js
  - apps/indusk-mcp/hooks/validate-impl-structure.js
  - apps/indusk-mcp/src/lib/trajectory/validator.ts
tests:
  - apps/indusk-mcp/src/__tests__/detail-is-only-read.test.ts
  - apps/indusk-mcp/src/lib/run/commit-cadence.test.ts
incidents: []
---

What is written in a task's hidden detail is only read: it never ticks a box, skips a check or adds a task.

## History
- 2026-10-14 — declared (story-first-phases), from its planning conversation.
- 2026-10-15 — enforced, confirmed for story-first-phases: proven by row A9, row A10, row A11, row A17, row A23, row A24, row A25.
