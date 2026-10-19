---
name: a-plan-is-found-in-the-archive
kind: state
lifetime: holds
state: enforced
domain: planning
owner: archived-plans-are-found
sites:
  - apps/indusk-mcp/src/lib/impl-parser.ts
  - apps/indusk-mcp/src/lib/papers/publish.ts
  - apps/indusk-mcp/src/lib/plans/amendments.ts
  - apps/indusk-mcp/src/lib/promises/plan-folder.ts
  - apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts
  - apps/indusk-mcp/src/lib/worktree/roots.ts
tests:
  - apps/indusk-mcp/src/lib/promises/plan-folder.test.ts
  - apps/indusk-mcp/src/lib/impl-parser-archive.test.ts
  - apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts
  - apps/indusk-mcp/src/__tests__/plan-folder-single-definition.test.ts
  - apps/indusk-mcp/src/lib/worktree/roots.test.ts
  - apps/indusk-mcp/src/lib/plans/amendments.test.ts
incidents: []
clauses:
  - name: one-lookup
    kind: split
    statement: "One function says where a plan's folder is, and the impl, the brief and the worktree record all ask it."
  - name: active-first
    kind: limit
    statement: "A plan in both places is read from .indusk/planning/<plan>, never the archived copy."
  - name: the-brief-at-approval
    kind: split
    statement: "Re-approval reads the brief at the approval commit from the path it had then, archived or not."
---

Every command that acts on a plan finds it in .indusk/planning/<plan> or, when not there, in .indusk/planning/archive/<plan>.

## History
- 2026-10-18 — declared (archived-plans-are-found), from its planning conversation.
- 2026-10-18 — enforced, confirmed for archived-plans-are-found: proven by row T1, row T2, row T3, row T4, row T5, row T6, row T7, row T8, row T9, row T10, row T11.
