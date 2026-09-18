---
name: phase-boundary-record-never-malformed
kind: state
lifetime: holds
state: enforced
domain: planning
owner: lifecycle-rebalance
sites:
  - apps/indusk-mcp/src/lib/shape/boundary.ts
tests:
  - apps/indusk-mcp/src/lib/shape/boundary.test.ts
  - apps/indusk-mcp/src/lib/shape/boundary-writer.test.ts
incidents: []
---

The phase-boundary record (`.indusk/phase-boundary.jsonl`) never holds a malformed line: the writer refuses an append with the same predicate every reader applies, naming the field.

## Why it holds

One bad line blinds every reader of the whole file — Shape, `verify` and the admin's active-phase derivation all read it — and a lost phase start widens a review scope to earlier phases' code, which looks exactly like the check working. So `recordPhaseStart` validates with `boundaryRecordProblem` before writing, and `readBoundaries` throws on a malformed line rather than skipping it.

## History
- 2026-08-10 — established by lifecycle-rebalance.
- 2026-09-18 — registered as a promise (day-promises).
