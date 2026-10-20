---
name: decisions-wait-in-one-place
kind: state
lifetime: holds
state: enforced
domain: admin
owner: decisions-as-questions
sites:
  - 'apps/indusk-admin/src/app/api/plans/[name]/decision/route.ts'
  - 'apps/indusk-admin/src/app/p/[project]/plan/[name]/decision.test.tsx'
  - apps/indusk-admin/src/components/cockpit/DecisionCard.tsx
  - apps/indusk-admin/src/components/cockpit/NeedsYou.tsx
  - apps/indusk-admin/src/lib/decisions-reader.ts
  - apps/indusk-admin/src/lib/decisions.ts
  - apps/indusk-mcp/src/lib/plans/history.ts
  - apps/indusk-mcp/src/lib/plans/waiting.ts
tests:
  - apps/indusk-mcp/src/lib/plans/waiting.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx'
  - apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx
  - apps/indusk-admin/src/lib/decisions.test.ts
  - apps/indusk-mcp/src/lib/plans/history.test.ts
  - apps/indusk-admin/src/lib/build-host.release.test.ts
incidents: []
---

When a plan is waiting on the person it is listed under Needs you, and its page shows each open question with its recommendation, its options, its cost and a reply in words; the answer reaches the agent and is recorded in the plan's history.

## History
- 2026-10-10 — declared (plan-cockpit), from its planning conversation.
- 2026-10-11 — enforced, confirmed for plan-cockpit: proven by row A13, row A14, row A15, row A16, row A17, row A37, row A38.
- 2026-10-19 — changed by decisions-as-questions: The page now shows several questions, each with a cost.. It read: "When a plan is waiting on the person it is listed under Needs you, and its page shows the one decision with accept, the alternative and a reply in words; the answer reaches the agent and is recorded in the plan's history." Owned before by plan-cockpit; decisions-as-questions takes it over.
