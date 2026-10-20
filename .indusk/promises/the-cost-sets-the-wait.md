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
  - name: holds-by-default
    kind: split
    statement: "With no setting for its cost, a question holds until the person answers (Sandy, 2026-10-19: answer everything first, then decide what to automate)."
  - name: the-setting-decides
    kind: split
    statement: "A question goes ahead with its recommendation only as its cost's setting says, after the set time or at once, and says it did."
  - name: a-hold-frees-the-slot
    kind: split
    statement: "A held question stops its session, frees its slot, and the run resumes when the person answers."
---

What an unanswered question does is its cost's setting: hold until the person answers, go ahead with its recommendation after a set time, or go ahead at once; with nothing set, every cost holds, and a held question stops its session and frees its slot until the person answers.

## History
- 2026-10-19 — declared (decisions-as-questions), from its planning conversation.
- 2026-10-19 — changed by decisions-as-questions: every cost holds by default; waits are settings (Sandy, 2026-10-19). It read: "An unanswered cheap question goes ahead with its recommendation after five minutes, a moderate one after an hour, and an expensive one stops its session and frees its slot until the person answers." with the clauses cheap-and-moderate-go-ahead (split), expensive-waits (split).
