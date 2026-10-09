---
name: the-auditor-sees-the-plan-not-the-session
kind: state
lifetime: holds
state: enforced
domain: planning
owner: plan-review-subagent
sites:
  - apps/indusk-mcp/src/lib/audit/inputs.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts
incidents: []
---

The auditor is handed the plan's brief, test plan and ADR, the impl as it was approved with the trajectory table as it stands, and the diff of the plan's branch against the trunk, and nothing from the session's conversation or from the builder's own findings.

## History
- 2026-10-09 — declared (plan-review-subagent), from its planning conversation.
- 2026-10-09 — enforced, confirmed for plan-review-subagent: proven by row A5, row A6, row A7, row A15, row A16, row A17.
