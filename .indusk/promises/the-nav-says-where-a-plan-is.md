---
name: the-nav-says-where-a-plan-is
kind: state
lifetime: holds
state: enforced
domain: admin
owner: nav-stage-matches-plan-page
sites:
  - apps/indusk-admin/src/lib/plan-stage.ts
tests:
  - apps/indusk-admin/src/lib/plan-stage.test.ts
  - apps/indusk-admin/src/components/PlanList.test.tsx
  - apps/indusk-admin/src/components/PlanList.falsify.test.tsx
  - apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx'
  - apps/indusk-admin/src/lib/markdown-export.test.ts
incidents: []
---

A plan's row in the nav names the same step its page shows; it reads Released only once a release has shipped it, and Closed once the plan is archived without one.

## History
- 2026-10-16 — declared (nav-stage-matches-plan-page), from its planning conversation.
- 2026-10-16 — enforced, confirmed for nav-stage-matches-plan-page: proven by row A1, row A2, row A3, row A4, row A6, row A7, row A8.
