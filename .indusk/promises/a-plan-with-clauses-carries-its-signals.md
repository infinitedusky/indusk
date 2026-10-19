---
name: a-plan-with-clauses-carries-its-signals
kind: state
lifetime: holds
state: declared
domain: planning
owner: a-run-can-be-trusted
sites: []
tests: []
incidents: []
clauses:
  - name: refused-without-signals
    kind: split
    statement: "Saving such an impl with no task naming a clause's signal is refused, naming each clause without one."
  - name: a-live-check-proves-no-clause
    kind: split
    statement: "Saving an impl whose row runs only after landing and names a clause is refused, since a skipped row blocks the clause at close."
  - name: the-two-landed-plans-report
    kind: split
    statement: "The three clauses of a-brief-is-accepted-on-current-main report their signals from the code that keeps them, so that plan can close."
---

An impl for a brief that states clauses is refused unless a phase reports each split and limit clause's signal, and no live check that can only run after landing is a clause's proof.

## History
- 2026-10-19 — declared (a-run-can-be-trusted), from its planning conversation.
