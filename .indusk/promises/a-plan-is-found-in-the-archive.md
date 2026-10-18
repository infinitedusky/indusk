---
name: a-plan-is-found-in-the-archive
kind: state
lifetime: holds
state: declared
domain: planning
owner: archived-plans-are-found
sites: []
tests: []
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
