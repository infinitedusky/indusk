---
name: every-promise-is-listed
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - apps/indusk-admin/src/lib/promise-dashboard.ts
  - apps/indusk-mcp/src/lib/promises/standing.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx'
  - apps/indusk-mcp/src/lib/promises/standing.test.ts
incidents: []
---

The promise dashboard lists every promise in the project in words, and can be grouped by state, plan or Path, sorted, and filtered by text.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A18, row A19, row A20, row A21, row A40.
