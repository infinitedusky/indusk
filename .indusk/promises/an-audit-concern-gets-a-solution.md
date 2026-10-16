---
name: an-audit-concern-gets-a-solution
kind: state
lifetime: holds
state: declared
domain: planning
owner: mark-first
sites: []
tests: []
incidents: []
clauses:
  - name: every-concern-is-answered
    kind: split
    statement: "The audit asks, for each concern it raised, what signal would show it breaking, and the answer is a fix, a signal (the invariant checked, where it is emitted, how often it would fire and what happens if its first break reaches a user) or nothing with the reason."
  - name: a-signal-answer-names-its-clause
    kind: split
    statement: "A signal an audit proposes names the clause it would uphold, and a concern no clause covers says so."
---

Each concern an audit raises is answered with a fix, a signal that would show it breaking, or the reason nothing is needed.

## History
- 2026-10-16 — declared (mark-first), from its planning conversation.
