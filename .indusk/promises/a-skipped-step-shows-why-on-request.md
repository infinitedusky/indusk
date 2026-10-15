---
name: a-skipped-step-shows-why-on-request
kind: state
lifetime: holds
state: enforced
domain: admin
owner: skip-reason-why
sites:
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx'
  - apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts
incidents: []
---

A step skipped with a reason reads "Skipped" on the plan's page, and its reason appears only when a person opens the "why?" beside it, whatever the reason's length.

## History
- 2026-10-14 — declared (skip-reason-why), from its planning conversation.
- 2026-10-15 — enforced, confirmed for skip-reason-why: proven by row A1, row A2, row A3, row A10, row A13.
