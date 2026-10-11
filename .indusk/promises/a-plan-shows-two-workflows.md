---
name: a-plan-shows-two-workflows
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/header.test.tsx'
  - apps/indusk-admin/src/components/PlanWorkflows.tsx
  - apps/indusk-mcp/src/lib/plans/steps.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx'
  - apps/indusk-mcp/src/lib/plans/steps.test.ts
incidents: []
---

A plan's page shows Planning and Release as two lists, each with its own progress, every step's state read from the plan's documents and phases, never set by hand.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A9, row A10, row A11, row A12.
