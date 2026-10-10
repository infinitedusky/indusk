---
name: a-prose-reply-is-asked-again
kind: state
lifetime: holds
state: enforced
domain: gates
owner: evaluator-waits-out-limits
sites:
  - apps/indusk-mcp/src/lib/eval/limits.ts
tests:
  - apps/indusk-mcp/src/lib/eval/evaluator-limits.test.ts
incidents: []
---

When the evaluator answers without a scorecard, it is asked once more for the scorecard alone, and the run fails only if the second answer has none either.

## History
- 2026-10-10 — declared (evaluator-waits-out-limits), from its planning conversation.
- 2026-10-10 — enforced, confirmed for evaluator-waits-out-limits: proven by row A3, row A4.
