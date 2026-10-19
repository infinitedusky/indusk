---
name: landing-follows-what-it-pulled
kind: state
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: lands-after
    kind: limit
    statement: "A plan holding another plan's unlanded work is refused landing, naming that plan, until it has landed."
  - name: merges-again-before-landing
    kind: limit
    statement: "Before it lands, such a plan merges the trunk with the other plan's landed work in it."
---

A plan whose phase pulled another plan's unlanded work cannot land before that plan, and merges that work again before it lands.

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
