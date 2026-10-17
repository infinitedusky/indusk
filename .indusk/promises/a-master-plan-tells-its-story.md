---
name: a-master-plan-tells-its-story
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-stories
sites:
  - apps/indusk-admin/src/lib/master-story.test.ts
  - apps/indusk-admin/src/lib/plan-stage.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx'
  - apps/indusk-mcp/src/lib/__tests__/plan-declarations.test.ts
  - apps/indusk-admin/src/lib/look-state.test.ts
  - apps/indusk-admin/src/__tests__/plan-stories.contract.test.ts
  - apps/indusk-admin/src/lib/plan-stage.test.ts
incidents:
  - i-2026-10-16-a-master-plan-tells-its-story
---

A master plan's page says what the master is for, then lists each of its plans in the declared order by title, with its description and how far along it is.

## History
- 2026-10-14 — declared (plan-stories), from its planning conversation.
- 2026-10-15 — enforced, confirmed for plan-stories: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A23, row A25.
