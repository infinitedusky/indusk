---
name: a-session-can-be-stopped
kind: state
lifetime: holds
state: enforced
domain: admin
owner: admin-plan-authoring
sites:
  - apps/indusk-mcp/src/lib/session/manager.ts
tests:
  - apps/indusk-mcp/src/lib/session/manager.test.ts
  - apps/indusk-admin/src/components/session/SessionPanel.test.tsx
  - apps/indusk-mcp/src/__tests__/admin-session-lifecycle.test.ts
incidents: []
---

A session started from the admin can be stopped from the panel, and none is left running when the admin stops.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A21, row A22.
