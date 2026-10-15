---
name: a-question-is-answered-in-full
kind: state
lifetime: holds
state: enforced
domain: admin
owner: cockpit-audit-fixes
sites:
  - apps/indusk-admin/src/lib/decisions.ts
tests:
  - apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx
  - apps/indusk-admin/src/lib/decisions.test.ts
incidents: []
---

When an agent asks several questions at once, the decision card shows each of them and an answer reaches the agent for each.

## History
- 2026-10-11 — declared (cockpit-audit-fixes), from its planning conversation.
- 2026-10-15 — enforced, confirmed for cockpit-audit-fixes: proven by row A7, row A14.
