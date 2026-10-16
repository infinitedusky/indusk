---
name: a-nav-row-keeps-its-parts-apart
kind: state
lifetime: holds
state: enforced
domain: admin
owner: nav-row-legible
sites:
  - apps/indusk-admin/src/components/ui/PlanRow.tsx
  - apps/indusk-admin/src/components/ui/WorktreeMark.tsx
tests:
  - apps/indusk-admin/src/components/PlanList.worktree.test.tsx
incidents: []
---

A plan's row in the nav shows its title on one line and its stage on the next, with its worktree as a mark beside the stage and apart from it; hovering or clicking the mark widens it in place to show the worktree's name, without opening the plan.

## History
- 2026-10-16 — declared (nav-row-legible), from its planning conversation.
- 2026-10-16 — enforced, confirmed for nav-row-legible: proven by row A1, row A2, row A3, row A4, row A5, row A9.
