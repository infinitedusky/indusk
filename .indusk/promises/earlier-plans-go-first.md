---
name: earlier-plans-go-first
kind: state
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: earliest-next
    kind: limit
    statement: "Of ready phases that want a file a running phase holds, the earliest plan's runs next when that file is free."
  - name: a-broken-promise-jumps-the-line
    kind: limit
    statement: "A phase that fixes a broken promise — a Maintenance phase for an open incident — gets the next free session ahead of every phase that is not a fix, whatever its plan's place; every phase not yet started that touches its files depends on it, and a running phase that touches them merges the fix before it merges into its plan (Sandy, 2026-10-16 and 2026-10-19; story 3)."
  - name: never-interrupted
    kind: rests-on
    rests_on: a-hold-is-cheap
---

When phases of different plans are ready and want the same file, the phase of the plan that comes first runs next: earlier in the plan tree, read top-down from the root master through each parent's ordered children; a plan with no place in the tree comes after every plan that has one, and among those the one approved earlier — to go ahead, a plan is given a place (Sandy, 2026-10-16).

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
