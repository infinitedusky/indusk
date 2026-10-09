---
name: the-auditor-runs-on-its-tier
kind: state
lifetime: holds
state: enforced
domain: planning
owner: plan-review-subagent
sites:
  - apps/indusk-mcp/src/bin/commands/plans.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-model.test.ts
  - apps/indusk-mcp/src/__tests__/phase-tier-parity.test.ts
incidents: []
---

The auditor runs on the model workflow.steps.audit.tier names in the config, with no one switching models by hand; a project that names no tiers runs it on the session's model.

## History
- 2026-10-09 — declared (plan-review-subagent), from its planning conversation.
- 2026-10-09 — enforced, confirmed for plan-review-subagent: proven by row A8, row A21.
