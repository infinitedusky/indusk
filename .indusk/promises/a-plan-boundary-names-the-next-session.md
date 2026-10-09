---
name: a-plan-boundary-names-the-next-session
kind: state
lifetime: holds
state: enforced
domain: planning
owner: model-per-phase
sites:
  - apps/indusk-mcp/src/lib/models/next-session.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-approve.test.ts
  - apps/indusk-mcp/src/lib/models/next-session.test.ts
incidents: []
---

Approving a plan, and closing each of its phases, ends by naming the command to run in a new session.

## History
- 2026-10-09 — declared (model-per-phase), from its planning conversation.
- 2026-10-09 — enforced, confirmed for model-per-phase: proven by row A10, row A11, row A18.
