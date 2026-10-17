---
name: an-audit-concern-gets-a-solution
kind: state
lifetime: holds
state: declared
domain: planning
owner: audit-concerns-are-answered
sites: []
tests: []
incidents: []
clauses:
  - name: the-audit-finds
    kind: split
    statement: "The auditor raises each concern and says what would show it breaking, and suggests no remedy."
  - name: the-plan-answers
    kind: split
    statement: "The plan's agent answers each concern with a fix, a signal (the invariant checked, where it is emitted, how often it would fire, which clause it upholds) or nothing with the reason."
  - name: a-dismissal-reaches-the-person
    kind: split
    statement: "Every concern answered \"nothing needed\" is shown to the person with its reason."
  - name: an-audit-teaches
    kind: split
    statement: "Each process gap behind an audit's findings — a way of planning or building that could let the same kind of finding through again — is named and flagged for a lesson; an audit with none says so."
---

Each concern an audit raises is answered by the plan's agent with a fix, a signal that would show it breaking, or the reason nothing is needed.

## History
- 2026-10-17 — declared (audit-concerns-are-answered), from its planning conversation.
