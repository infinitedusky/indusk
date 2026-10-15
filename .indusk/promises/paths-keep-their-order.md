---
name: paths-keep-their-order
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - apps/indusk-admin/src/lib/plan-groups.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx'
incidents: []
---

The nav shows Paths and their plans in the order the project declares them, nested as deep as they are declared, each Path with how many of its plans are released.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A2, row A3, row A4, row A5.
