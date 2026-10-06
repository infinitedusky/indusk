---
name: a-plan-is-written-on-its-own-branch
kind: state
lifetime: holds
state: enforced
domain: planning
owner: admin-plan-authoring
sites:
  - apps/indusk-admin/src/lib/__tests__/planning-reader.own-branch.test.ts
  - apps/indusk-mcp/src/lib/plans/approve.ts
  - apps/indusk-mcp/src/lib/plans/start.ts
  - apps/indusk-mcp/src/lib/promises/trunk-commit.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-start.test.ts
  - apps/indusk-mcp/src/__tests__/plans-approve.test.ts
  - apps/indusk-mcp/src/__tests__/trunk-plan-commit-mark.test.ts
incidents: []
---

Starting a plan, with its type and name, creates its own branch and worktree; its documents and promises are written there and reach `main` when the plan is approved, and its build continues on the same branch.

## History
- 2026-10-06 — declared (admin-plan-authoring), from its planning conversation.
- 2026-10-06 — enforced, confirmed for admin-plan-authoring: proven by row A7, row A8, row A9, row A10, row A29.
