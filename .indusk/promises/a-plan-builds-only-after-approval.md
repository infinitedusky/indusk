---
name: a-plan-builds-only-after-approval
kind: state
lifetime: holds
state: enforced
domain: planning
owner: brief-as-the-contract
sites:
  - apps/indusk-mcp/hooks/check-gates.js
tests:
  - apps/indusk-mcp/src/__tests__/approval-gate.test.ts
  - apps/indusk-mcp/src/__tests__/planner-stops-at-the-plan.test.ts
incidents: []
---

A plan leaves `draft` only through `indusk plans approve`, and no build item is checked off on a plan that is not approved or that has an amendment waiting.

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A4, row A5, row A6, row A19.
- 2026-10-13 — changed by brief-as-the-contract: an amendment waits for the person. It read: "A plan leaves `draft` only through `indusk plans approve`, and no build item is checked off on a plan that is not approved." Owned before by small-fixes; brief-as-the-contract takes it over.
- 2026-10-13 — changed by brief-as-the-contract: the sentence as the brief states it; the earlier change ran through a shell that stripped its backquoted words. It read: "A plan leaves draft only through indusk plans approve, and no build item is checked off on a plan that is not approved or that has an amendment waiting."
