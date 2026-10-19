---
name: a-release-waits-for-a-known-wrong
kind: state
lifetime: holds
state: declared
domain: gates
owner: decisions-as-questions
sites: []
tests: []
incidents: []
clauses:
  - name: release-refuses
    kind: split
    statement: "The release step refuses, naming each open follow-on, until each is closed."
  - name: landing-never-waits
    kind: limit
    statement: "Landing a plan is never refused because a follow-on is open."
---

A release refuses while a follow-on plan opened by a disagreeing answer is open, naming it; landing on main never waits for one.

## History
- 2026-10-19 — declared (decisions-as-questions), from its planning conversation.
