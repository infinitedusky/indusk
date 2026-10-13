---
name: a-change-to-what-was-agreed-needs-the-person
kind: state
lifetime: holds
state: enforced
domain: gates
owner: brief-as-the-contract
sites:
  - 'apps/indusk-admin/src/app/api/plans/[name]/reapprove/route.ts'
  - apps/indusk-mcp/hooks/check-gates.js
  - apps/indusk-mcp/src/lib/plans/amendments.ts
  - apps/indusk-mcp/src/lib/plans/reapprove.ts
tests:
  - apps/indusk-mcp/src/__tests__/amendments.test.ts
  - apps/indusk-admin/src/__tests__/amendment-approval.test.ts
  - apps/indusk-mcp/src/__tests__/check-gates-amendments.test.ts
incidents: []
---

A change during the build to a promise's statement, an expectation or a look updates the brief and waits for a person's approval before the build goes on.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A11, row A12, row A13, row A14, row A35.
