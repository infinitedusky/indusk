---
name: trunk-cascades
kind: behaviour
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: branches-follow-the-trunk
    kind: split
    statement: "Within five minutes of a landing, every open plan's branch with no running phase has merged it."
  - name: phase-merges-at-its-end
    kind: limit
    statement: "A running phase merges the trunk when it ends, before it merges into its plan."
  - name: agent-resolves-first
    kind: limit
    statement: "A conflicting merge is resolved by an agent and kept only with the plan's tests passing; otherwise it becomes a question naming the files, and only that plan's affected phases go on hold. (Story 4.)"
---

When anything lands on the trunk (the branch the project's main checkout is on: `main` here, each repo's own in a workbench), every open plan's branch merges it, and a running phase's worktree merges it when that phase ends; a conflict is resolved by an agent with the plan's tests as the check, or becomes a question when it cannot be.

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
