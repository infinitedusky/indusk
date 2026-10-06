---
name: a-review-shows-its-evidence
kind: state
lifetime: holds
state: enforced
domain: admin
owner: admin-plan-authoring
sites:
  - apps/indusk-admin/src/components/PlanDetail.skipped-rituals.test.tsx
  - apps/indusk-mcp/src/lib/build/review.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-review.test.ts
  - apps/indusk-admin/src/components/session/ReviewPanel.test.tsx
incidents: []
---

When a build stops for review, the panel shows what was built and the evidence: each promise with the passing tests that prove it, what falsification found and fixed, and the files changed.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A15, row A16, row A17.
- 2026-10-06 — links updated, confirmed for admin-plan-authoring: tests apps/indusk-mcp/src/__tests__/plans-review.test.ts, apps/indusk-admin/src/components/session/ReviewPanel.test.tsx; sites apps/indusk-admin/src/components/PlanDetail.skipped-rituals.test.tsx, apps/indusk-mcp/src/lib/build/review.ts.
