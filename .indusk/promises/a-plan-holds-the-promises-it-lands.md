---
name: a-plan-holds-the-promises-it-lands
kind: state
lifetime: holds
state: enforced
domain: planning
owner: plans-are-promises
sites:
  - apps/indusk-mcp/src/lib/promises/clause-rules.ts
tests:
  - apps/indusk-mcp/src/__tests__/promises-confirm.test.ts
  - apps/indusk-mcp/src/__tests__/cleanup-gate.test.ts
  - apps/indusk-mcp/src/__tests__/promise-clauses.test.ts
  - apps/indusk-mcp/src/__tests__/promises-check.test.ts
incidents: []
clauses:
  - name: brief-holds-clauses
    kind: split
    statement: A promise is made of clauses — splits, each a point reached within its budget on the way to the promise's goal, and limits, each a bound that always holds — each clause named and with its own signal and the tests tied to it.
  - name: clause-plan-checked
    kind: split
    statement: Each promise has its clause plan, in place of a test plan, written before the ADR so done is fixed before how to build is decided, naming each clause's signal and the tests tied to that clause.
  - name: closing-per-clause
    kind: split
    statement: A plan is done when every clause of every promise it holds is proved, a clause resting on another promise being proved by that promise.
  - name: planner-teaches-it
    kind: split
    statement: Promises that land together share a plan; promises whose work shares code are one plan, promises that share none are separate plans under a master, and the planner suggests the split and the person decides.
  - name: older-plans-stand
    kind: limit
    statement: A plan written before clauses keeps its promises and closes as it did.
---

A plan makes one or more promises, each stated as clauses, and is done when every clause of every promise it holds is proved.

## History
- 2026-10-16 — declared (plans-are-promises), from its planning conversation.
- 2026-10-16 — enforced, confirmed for plans-are-promises: proven by row A17, row A18, row A19.
