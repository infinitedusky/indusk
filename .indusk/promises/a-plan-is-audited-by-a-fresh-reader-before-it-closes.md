---
name: a-plan-is-audited-by-a-fresh-reader-before-it-closes
kind: state
lifetime: holds
state: enforced
domain: planning
owner: plan-review-subagent
sites:
  - apps/indusk-mcp/src/lib/build/next-step.ts
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
tests:
  - apps/indusk-mcp/src/__tests__/audit-gate.test.ts
  - apps/indusk-mcp/src/lib/models/next-session.test.ts
  - apps/indusk-mcp/src/lib/build/runner.test.ts
  - apps/indusk-mcp/src/__tests__/plans-workbench.test.ts
  - apps/indusk-mcp/src/lib/lifecycle-review.test.ts
incidents: []
---

Before a plan's retrospective, a reader that has not seen the building session reads the plan and writes what it finds to audit.md in the plan folder, and the retrospective refuses to start until that document exists or the impl says why the audit was skipped.

## History
- 2026-10-09 — declared (plan-review-subagent), from its planning conversation.
- 2026-10-09 — enforced, confirmed for plan-review-subagent: proven by row A1, row A2, row A3, row A4, row A18, row A22.
