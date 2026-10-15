---
name: a-session-belongs-to-its-plan
kind: state
lifetime: holds
state: enforced
domain: admin
owner: sessions-per-plan
sites:
  - apps/indusk-mcp/src/lib/session/manager.ts
tests:
  - apps/indusk-mcp/src/lib/session/manager.test.ts
  - apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts
incidents: []
---

A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same plan is refused, naming the session already running, so a plan can have a planning session and a build at the same time.

## History
- 2026-10-14 — declared (sessions-per-plan), from its planning conversation.
- 2026-10-14 — enforced, confirmed for sessions-per-plan: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A13, row A12.
