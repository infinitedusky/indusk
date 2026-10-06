---
name: a-build-runs-to-review-unasked
kind: state
lifetime: holds
state: enforced
domain: planning
owner: admin-plan-authoring
sites:
  - apps/indusk-mcp/src/lib/build/next-step.ts
  - apps/indusk-mcp/src/lib/build/runner.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-next.test.ts
  - apps/indusk-mcp/src/lib/build/next-step.test.ts
  - apps/indusk-mcp/src/__tests__/gate-policy-env.test.ts
  - apps/indusk-mcp/src/lib/session/protocol.test.ts
  - apps/indusk-mcp/src/__tests__/plans-review.test.ts
incidents: []
---

An approved plan's implementation runs through its phases, falsification and cleanup without asking for approval, and stops only when it is ready for review, for a judgement the plan declared, or when it cannot continue.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A11, row A12, row A13, row A14, row A30.
- 2026-10-06 — links updated, confirmed for admin-plan-authoring: tests apps/indusk-mcp/src/__tests__/plans-next.test.ts, apps/indusk-mcp/src/lib/build/next-step.test.ts, apps/indusk-mcp/src/__tests__/gate-policy-env.test.ts, apps/indusk-mcp/src/lib/session/protocol.test.ts, apps/indusk-mcp/src/__tests__/plans-review.test.ts; sites apps/indusk-mcp/src/lib/build/next-step.ts, apps/indusk-mcp/src/lib/build/runner.ts.
