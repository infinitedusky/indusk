---
name: approval-is-of-the-brief
kind: state
lifetime: holds
state: enforced
domain: gates
owner: brief-as-the-contract
sites:
  - apps/indusk-mcp/src/lib/plans/approved-brief.test.ts
  - apps/indusk-mcp/src/lib/plans/approved-brief.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts
  - apps/indusk-mcp/src/__tests__/review-evidence.test.ts
incidents: []
---

A person's approval covers the brief — its expectations, promises and looks — while the test plan, the ADR and the impl are shown at review as evidence, not signed off.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A9, row A10.
