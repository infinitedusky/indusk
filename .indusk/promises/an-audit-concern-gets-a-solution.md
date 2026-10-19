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
  - name: a-significant-concern-goes-to-the-person
    kind: split
    statement: "A concern whose answer would change what the person approved — a promise, an expectation, a look or the plan's scope — is written as an amendment to the brief, which stops the build until the person re-approves; the plan's agent answers every other concern without asking."
---

Each concern an audit raises is answered by the plan's agent with a fix, a signal that would show it breaking, or the reason nothing is needed.

## History
- 2026-10-17 — declared (audit-concerns-are-answered), from its planning conversation.
- 2026-10-19 — changed by audit-concerns-are-answered: a concern whose answer would change what the person approved goes to the person (Sandy, 2026-10-19). It read: "Each concern an audit raises is answered by the plan's agent with a fix, a signal that would show it breaking, or the reason nothing is needed." with the clauses the-audit-finds (split), the-plan-answers (split), a-dismissal-reaches-the-person (split), an-audit-teaches (split).
