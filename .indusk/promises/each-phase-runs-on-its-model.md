---
name: each-phase-runs-on-its-model
kind: state
lifetime: holds
state: enforced
domain: planning
owner: model-per-phase
sites:
  - apps/indusk-mcp/src/lib/models/tier-config.test.ts
  - apps/indusk-mcp/src/lib/models/tiers.ts
tests:
  - apps/indusk-mcp/src/lib/models/tiers.test.ts
  - apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts
  - apps/indusk-mcp/src/__tests__/plans-model.test.ts
incidents: []
---

Every phase /work builds runs on the model the project's config gives its tier — strong, med, weak or baby — where the tier is the one its plan names, or its step's default tier when the plan names none, without anyone switching models by hand.

## History
- 2026-10-09 — declared (model-per-phase), from its planning conversation.
- 2026-10-09 — enforced, confirmed for model-per-phase: proven by row A1, row A2, row A3, row A4, row A15, row A16.
