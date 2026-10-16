---
name: a-finished-ritual-stays-done
kind: state
lifetime: holds
state: enforced
domain: admin
owner: finished-rituals-stay-done
sites:
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
tests:
  - apps/indusk-mcp/src/lib/plans/steps.test.ts
  - apps/indusk-admin/src/lib/planning-reader.rituals.test.ts
  - apps/indusk-mcp/src/__tests__/cleanup-gate.test.ts
incidents: []
---

A plan's Falsify, Cleanup and Audit steps read done once their ritual is finished (its phase closed or its audit written; a ritual skipped with a reason reads skipped, with that reason, not done), and keep reading done when a later build phase reopens the plan to building.

## History
- 2026-10-16 — declared (finished-rituals-stay-done), from its planning conversation.
- 2026-10-16 — changed by finished-rituals-stay-done: The built and tested behaviour reads a skipped ritual as skipped with its reason; the sentence said done.. It read: "A plan's Falsify, Cleanup and Audit steps read done once their ritual is finished (its phase closed, its audit written, or a skip with a reason), and keep reading done when a later build phase reopens the plan to building."
- 2026-10-16 — enforced, confirmed for finished-rituals-stay-done: proven by row A1, row A2, row A3, row A6, row A7, row A10.
