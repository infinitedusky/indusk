---
name: the-cost-sets-the-wait
kind: state
lifetime: holds
state: declared
domain: planning
owner: decisions-as-questions
sites: []
tests: []
incidents: []
clauses:
  - name: cheap-and-moderate-go-ahead
    kind: split
    statement: "A cheap or moderate question unanswered past its time goes ahead with the recommendation, and says it did."
  - name: expensive-waits
    kind: split
    statement: "An expensive question stops its session, frees its slot, and the run resumes when the person answers."
---

An unanswered cheap question goes ahead with its recommendation after five minutes, a moderate one after an hour, and an expensive one stops its session and frees its slot until the person answers.

## History
- 2026-10-19 — declared (decisions-as-questions), from its planning conversation.
