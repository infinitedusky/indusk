---
name: a-look-has-the-plan-that-owns-it
kind: state
lifetime: holds
state: enforced
domain: planning
owner: brief-as-the-contract
sites:
  - apps/indusk-admin/src/components/plan/PlanParts.tsx
  - apps/indusk-mcp/src/lib/plans/parts.ts
tests:
  - apps/indusk-mcp/src/__tests__/look-ownership.test.ts
  - apps/indusk-admin/src/__tests__/plan-parts.test.tsx
incidents: []
---

Every approved look records the plan that made or last changed it, and that plan's page shows its looks beside its promises.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A4, row A5.
