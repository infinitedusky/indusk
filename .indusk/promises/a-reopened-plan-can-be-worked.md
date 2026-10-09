---
name: a-reopened-plan-can-be-worked
kind: state
lifetime: holds
state: enforced
domain: planning
owner: incident-recording
sites:
  - apps/indusk-mcp/src/lib/worktree/plan-worktree-commands.ts
  - apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts
tests:
  - apps/indusk-mcp/src/__tests__/reopened-plan-worktree.test.ts
incidents: []
---

A plan reopened from the archive gets a worktree like any other: `indusk worktree create` and `assign` find it, and the admin and the plan tools read it from there.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A15, row A16.
