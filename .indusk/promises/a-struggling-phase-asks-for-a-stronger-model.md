---
name: a-struggling-phase-asks-for-a-stronger-model
kind: state
lifetime: holds
state: enforced
domain: planning
owner: model-per-phase
sites:
  - apps/indusk-mcp/src/lib/models/tiers.ts
tests:
  - apps/indusk-mcp/src/lib/models/tiers.test.ts
  - apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts
incidents: []
---

A phase whose tests still fail after three attempts on a tier below strong stops and names the next tier up to run it on.

## History
- 2026-10-09 — declared (model-per-phase), from its planning conversation.
- 2026-10-09 — enforced, confirmed for model-per-phase: proven by row A8, row A9, row A14.
