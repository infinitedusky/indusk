---
name: broken-promises-come-first
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - apps/indusk-admin/src/lib/promise-dashboard.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx'
incidents: []
---

A broken promise is counted in the nav and listed first on the dashboard.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A22, row A23.
