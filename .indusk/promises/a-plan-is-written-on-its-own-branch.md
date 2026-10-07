---
name: a-plan-is-written-on-its-own-branch
kind: state
lifetime: holds
state: enforced
domain: planning
owner: workbench-plan-authoring
sites:
  - apps/indusk-admin/src/lib/__tests__/planning-reader.own-branch.test.ts
  - apps/indusk-mcp/src/lib/plans/approve.ts
  - apps/indusk-mcp/src/lib/plans/start.ts
  - apps/indusk-mcp/src/lib/promises/trunk-commit.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-workbench.test.ts
  - apps/indusk-mcp/src/__tests__/plans-start.test.ts
  - apps/indusk-mcp/src/__tests__/plans-approve.test.ts
  - apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts
incidents: []
---

Starting a plan, with its type and name, creates its own branch and worktree for its code, and its build continues on that branch. In a normal-mode project its documents and promises are written there too and reach main when the plan is approved; in a workbench they are written at the workbench root, where the workbench is versioned.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A7, row A8, row A9, row A10, row A29.
- 2026-10-07 — changed by workbench-plan-authoring: in a workbench the documents live at the root, where the workbench is versioned; only the code has a plan branch. It read: "Starting a plan, with its type and name, creates its own branch and worktree; its documents and promises are written there and reach `main` when the plan is approved, and its build continues on the same branch." Owned before by admin-plan-authoring; workbench-plan-authoring takes it over.
- 2026-10-07 — links updated, confirmed for workbench-plan-authoring: tests apps/indusk-mcp/src/__tests__/plans-workbench.test.ts, apps/indusk-mcp/src/__tests__/plans-start.test.ts, apps/indusk-mcp/src/__tests__/plans-approve.test.ts, apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts; sites apps/indusk-admin/src/lib/__tests__/planning-reader.own-branch.test.ts, apps/indusk-mcp/src/lib/plans/approve.ts, apps/indusk-mcp/src/lib/plans/start.ts, apps/indusk-mcp/src/lib/promises/trunk-commit.ts.
