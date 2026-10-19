---
name: a-hold-is-cheap
kind: state
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: running-phases-finish
    kind: limit
    statement: "A running phase is never stopped to let another in."
  - name: a-hold-frees-its-files
    kind: split
    statement: "A phase put on hold gives up its turn on its files at once, so phases waiting only for those files go ahead; phases that need its output still wait for it."
  - name: the-held-phase-catches-up
    kind: split
    statement: "When a held phase is ready again it waits for any active phase it now depends on, merges what finished meanwhile that touches its files, and carries on from where it stopped."
---

Nothing stops: a running phase always finishes, and a phase put on hold (a question that holds, an amendment, a conflict it cannot resolve) is set aside so the rest of the graph goes on without it; it does its own catching up when it is ready again. (Stories 3, 4, 5.)

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
