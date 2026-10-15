---
name: approval-waits-for-a-finished-plan
kind: state
lifetime: holds
state: enforced
domain: admin
owner: cockpit-audit-fixes
sites:
  - apps/indusk-mcp/src/lib/plans/waiting.ts
tests:
  - apps/indusk-mcp/src/lib/plans/waiting.test.ts
  - apps/indusk-mcp/src/lib/session/manager.test.ts
incidents: []
---

A plan is listed as waiting for approval only when its impl is written and no session is still writing it.

## History
- 2026-10-11 — declared (cockpit-audit-fixes), from its planning conversation.
- 2026-10-15 — enforced, confirmed for cockpit-audit-fixes: proven by row A8, row A12.
