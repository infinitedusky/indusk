---
name: technical-detail-opens-on-request
kind: state
lifetime: holds
state: enforced
domain: admin
owner: story-first-phases
sites:
  - apps/indusk-admin/src/components/plan/PhaseItems.tsx
tests:
  - apps/indusk-admin/src/components/ui/PhaseRow.test.tsx
  - apps/indusk-admin/src/components/plan/PhaseItems.test.tsx
  - apps/indusk-mcp/src/lib/impl-parser.test.ts
  - apps/indusk-admin/src/components/plan/PlanParts.test.tsx
incidents: []
---

On a plan's page, a phase shows its paragraph and its tasks' plain sentences, and each task's technical detail stays hidden until a person opens it, then shows formatted, code included.

## History
- 2026-10-14 — declared (story-first-phases), from its planning conversation.
- 2026-10-15 — enforced, confirmed for story-first-phases: proven by row A5, row A6, row A7, row A27.
