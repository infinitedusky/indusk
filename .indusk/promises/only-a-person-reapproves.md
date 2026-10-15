---
name: only-a-person-reapproves
kind: state
lifetime: holds
state: enforced
domain: planning
owner: cockpit-redraw
sites:
  - apps/indusk-mcp/hooks/looks-approval-guard.js
tests:
  - apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts
  - apps/indusk-admin/src/__tests__/amendment-approval.test.ts
incidents: []
---

Re-approving a changed brief is done only by a person: `indusk plans reapprove` run from an agent's tool call is refused, as approving a look already is.

## History
- 2026-10-13 — declared (cockpit-redraw), from its planning conversation.
- 2026-10-14 — enforced, confirmed for cockpit-redraw: proven by row A5, row A6, row A7, row A13, row A14.
