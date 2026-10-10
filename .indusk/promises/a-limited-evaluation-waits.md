---
name: a-limited-evaluation-waits
kind: state
lifetime: holds
state: enforced
domain: gates
owner: evaluator-waits-out-limits
sites:
  - apps/indusk-mcp/src/lib/eval/limits.ts
tests:
  - apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts
  - apps/indusk-mcp/src/__tests__/eval-trigger-waiting.test.ts
incidents: []
---

An evaluation the model refuses for a rate or usage limit is not counted as a broken promise: its commit waits and is evaluated by a later commit's trigger once the limit allows.

## History
- 2026-10-10 — declared (evaluator-waits-out-limits), from its planning conversation.
- 2026-10-10 — enforced, confirmed for evaluator-waits-out-limits: proven by row A1, row A2.
