---
name: a-plan-knows-its-code
kind: state
lifetime: holds
state: enforced
domain: planning
owner: workbench-plan-authoring
sites:
  - apps/indusk-mcp/src/lib/plans/start.ts
  - apps/indusk-mcp/src/lib/plans/workbench-plan.ts
  - apps/indusk-mcp/src/lib/worktree/roots.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-workbench.test.ts
incidents: []
---

A plan in a workbench records which repo holds its code and which worktree it is built in. Every step reads them from that record: build, review, accept and land.

## History
- 2026-10-06 — declared (workbench-plan-authoring), from its planning conversation.
- 2026-10-07 — enforced, confirmed for workbench-plan-authoring: proven by row A1, row A2, row A3.
