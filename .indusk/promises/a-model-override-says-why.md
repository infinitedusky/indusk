---
name: a-model-override-says-why
kind: state
lifetime: holds
state: enforced
domain: gates
owner: model-per-phase
sites:
  - apps/indusk-mcp/hooks/_phase-tier.js
  - apps/indusk-mcp/src/lib/models/tiers.ts
tests:
  - apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts
  - apps/indusk-mcp/src/__tests__/phase-tier-parity.test.ts
incidents: []
---

An impl that gives a phase a different tier from its step's default says why, or the impl is refused.

## History
- 2026-10-09 — declared (model-per-phase), from its planning conversation.
- 2026-10-09 — enforced, confirmed for model-per-phase: proven by row A6, row A7, row A13, row A17.
