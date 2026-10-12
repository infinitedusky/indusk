---
name: a-mockup-is-approved-by-a-person
kind: state
lifetime: holds
state: enforced
domain: admin
owner: ui-promises
sites:
  - 'apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts'
  - apps/indusk-admin/src/components/looks/ApproveMockup.tsx
  - apps/indusk-admin/src/components/looks/ApproveSelected.tsx
  - apps/indusk-mcp/hooks/looks-approval-guard.js
  - apps/indusk-mcp/src/bin/commands/looks.ts
  - apps/indusk-mcp/src/lib/looks/approvals.ts
tests:
  - apps/indusk-mcp/src/__tests__/looks-cli.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx'
  - apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-approve-binding.test.tsx'
  - apps/indusk-mcp/src/lib/looks/approvals.test.ts
  - apps/indusk-mcp/src/__tests__/looks-lint-rules.test.ts
incidents: []
---

A mockup, and the foundation it defines, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A1, row A2, row A3, row A4, row A28, row A29, row A30, row A33, row A35.
