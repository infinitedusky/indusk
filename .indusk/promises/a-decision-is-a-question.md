---
name: a-decision-is-a-question
kind: state
lifetime: holds
state: declared
domain: planning
owner: decisions-as-questions
sites: []
tests: []
incidents: []
clauses:
  - name: asked-with-a-recommendation
    kind: split
    statement: "Each question names its options, the one the agent recommends and why, and its cost: cheap, moderate or expensive."
  - name: never-decided-silently
    kind: limit
    statement: "A session never records a choice as decided unattended without asking it as a question."
---

When an unattended session meets a choice the plan does not settle, it puts it to the person as a question with its options, its recommendation and a cost, under Needs you and on the plan's page.

## History
- 2026-10-19 — declared (decisions-as-questions), from its planning conversation.
