---
name: a-phase-builds-on-its-own-branch
kind: state
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: own-worktree
    kind: limit
    statement: "Every running phase has its own worktree and branch, cut from its plan's branch."
  - name: starts-from-its-dependencies
    kind: limit
    statement: "A phase starts with every finished phase it depends on merged into its worktree."
  - name: green-before-merging
    kind: limit
    statement: "A phase merges into its plan's branch only when, with the merge made, its own tests and the tests of every clause the plan's branch has touched pass, so two phases that break something only together are caught at the merge that joins them."
  - name: every-phase-is-checked
    kind: limit
    statement: "A phase that runs no test never merges, and the plan carries a signal for every clause it touches."
  - name: only-the-plan-lands
    kind: limit
    statement: "Nothing reaches the trunk from a phase's branch; only a plan's branch, once its promises are verified."
---

Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified.

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
- 2026-10-20 — changed by run-the-graph: sliced to one plan's phases (Sandy, 2026-10-19). It read: "Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified." with the clauses own-worktree (limit), starts-from-its-dependencies (limit), starts-from-the-work-it-waited-for (limit), green-before-merging (limit), every-phase-is-checked (limit), only-the-plan-lands (limit).
- 2026-10-20 — changed by run-the-graph: Signals are held for the plan as a whole, not per phase (Sandy, 2026-10-20: the per-phase rule deadlocked Test Phase 1).. It read: "Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified." with the clauses own-worktree (limit), starts-from-its-dependencies (limit), green-before-merging (limit), every-phase-is-checked (limit), only-the-plan-lands (limit).
