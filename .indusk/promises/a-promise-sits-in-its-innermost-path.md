---
name: a-promise-sits-in-its-innermost-path
kind: state
lifetime: holds
state: enforced
domain: admin
owner: cockpit-audit-fixes
sites:
  - apps/indusk-admin/src/lib/path-nesting.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx'
incidents: []
---

The dashboard groups a promise under the innermost Path that declares its plan, and the nav shows the plan there.

## History
- 2026-10-11 — declared (cockpit-audit-fixes), from its planning conversation.
- 2026-10-15 — enforced, confirmed for cockpit-audit-fixes: proven by row A9, row A13.
