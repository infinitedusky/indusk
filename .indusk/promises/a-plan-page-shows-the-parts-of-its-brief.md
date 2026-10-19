---
name: a-plan-page-shows-the-parts-of-its-brief
kind: state
lifetime: holds
state: enforced
domain: admin
owner: cockpit-redraw
sites:
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/brief/page.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/doc/[doc]/page.tsx'
  - apps/indusk-admin/src/components/drafts/DraftParts.tsx
  - apps/indusk-admin/src/components/plan/PlanParts.test.tsx
  - apps/indusk-admin/src/components/plan/PlanParts.tsx
  - apps/indusk-mcp/src/lib/plans/parts.ts
tests:
  - apps/indusk-admin/src/__tests__/plan-page-layout.test.tsx
  - apps/indusk-admin/src/components/plan/PlanSummary.test.tsx
  - apps/indusk-admin/src/__tests__/cockpit-redraw.contract.test.ts
  - apps/indusk-admin/src/lib/look-state.test.ts
  - apps/indusk-admin/src/__tests__/plan-parts.test.tsx
  - apps/indusk-admin/src/__tests__/plan-parts.contract.test.ts
  - apps/indusk-mcp/src/__tests__/plan-parts-description.test.ts
incidents:
  - i-2026-10-16-a-plan-page-shows-the-parts-of-its-brief
---

A plan's brief page shows its description, promises, expectations and looks beside the agent writing them, each updated as it writes; the plan page opens with the description and whether the brief is finished, one click from the brief.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A15, row A16, row A27, row A28.
- 2026-10-14 — changed by cockpit-redraw: the parts moved to the brief page; the plan page opens with the description. It read: "A plan's page shows its promises, its expectations and its looks, each updated as the agent writes them while a person works with it there, with the brief itself one click below." Owned before by brief-as-the-contract; cockpit-redraw takes it over.
- 2026-10-14 — links updated, confirmed for cockpit-redraw: tests apps/indusk-admin/src/__tests__/plan-page-layout.test.tsx, apps/indusk-admin/src/components/plan/PlanSummary.test.tsx, apps/indusk-admin/src/__tests__/cockpit-redraw.contract.test.ts, apps/indusk-admin/src/lib/look-state.test.ts, apps/indusk-admin/src/__tests__/plan-parts.test.tsx, apps/indusk-admin/src/__tests__/plan-parts.contract.test.ts, apps/indusk-mcp/src/__tests__/plan-parts-description.test.ts; sites apps/indusk-admin/src/app/p/[project]/plan/[name]/brief/page.tsx, apps/indusk-admin/src/app/p/[project]/plan/[name]/doc/[doc]/page.tsx, apps/indusk-admin/src/components/drafts/DraftParts.tsx, apps/indusk-admin/src/components/plan/PlanParts.test.tsx, apps/indusk-admin/src/components/plan/PlanParts.tsx, apps/indusk-mcp/src/lib/plans/parts.ts.
