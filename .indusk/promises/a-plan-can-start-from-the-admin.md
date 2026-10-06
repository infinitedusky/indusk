---
name: a-plan-can-start-from-the-admin
kind: state
lifetime: holds
state: enforced
domain: admin
owner: admin-plan-authoring
sites:
  - apps/indusk-admin/src/app/api/plans/route.ts
  - apps/indusk-admin/src/lib/__tests__/session-owner.test.ts
  - apps/indusk-mcp/src/lib/session/protocol.ts
tests:
  - apps/indusk-mcp/src/lib/session/protocol.test.ts
  - apps/indusk-mcp/src/lib/session/trust.test.ts
  - apps/indusk-admin/src/components/session/SessionPanel.test.tsx
  - apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts
incidents: []
---

A plan can be started from the admin as well as from the editor or a terminal: in the admin, the person has the planning conversation, answers its questions in the panel and accepts its promises, and either way it is the same plan in the same files.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A1, row A2, row A3, row A4, row A5.
