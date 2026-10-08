---
name: a-plan-builds-only-after-approval
kind: state
lifetime: holds
state: enforced
domain: planning
owner: small-fixes
sites:
  - apps/indusk-mcp/hooks/check-gates.js
tests:
  - apps/indusk-mcp/src/__tests__/approval-gate.test.ts
  - apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts
incidents: []
---

A plan leaves `draft` only through `indusk plans approve`, and no build item is checked off on a plan that is not approved.

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A4, row A5, row A6, row A19.
