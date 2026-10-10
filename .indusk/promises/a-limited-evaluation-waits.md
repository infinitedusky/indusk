---
name: a-limited-evaluation-waits
kind: state
lifetime: holds
state: declared
domain: gates
owner: evaluator-waits-out-limits
sites: []
tests: []
incidents: []
---

An evaluation the model refuses for a rate or usage limit is not counted as a broken promise: its commit waits and is evaluated by a later commit's trigger once the limit allows.

## History
- 2026-10-10 — declared (evaluator-waits-out-limits), from its planning conversation.
