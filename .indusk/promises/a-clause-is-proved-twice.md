---
name: a-clause-is-proved-twice
kind: state
lifetime: holds
state: enforced
domain: planning
owner: mark-first
sites:
  - apps/indusk-mcp/src/lib/promises/clause-proof.ts
  - apps/indusk-mcp/src/lib/promises/clause-standing.ts
  - apps/indusk-mcp/src/lib/promises/closing-signal.test.ts
  - apps/indusk-mcp/src/lib/promises/closing-signal.ts
  - apps/indusk-mcp/src/lib/promises/incident-signal.ts
  - apps/indusk-mcp/src/lib/promises/status-signal.ts
tests:
  - apps/indusk-mcp/src/lib/promises/clause-tests-run.test.ts
  - apps/indusk-mcp/src/lib/plans/land-clause-tests.test.ts
  - apps/indusk-mcp/src/lib/promises/clause-standing.test.ts
  - apps/indusk-mcp/src/lib/promises/signal-test-run.test.ts
  - apps/indusk-mcp/src/lib/promises/clause-break.test.ts
  - apps/indusk-mcp/src/lib/promises/confirm-signal.test.ts
  - apps/indusk-mcp/src/__tests__/clause-signal.live.test.ts
  - apps/indusk-mcp/src/lib/promises/clause-break-event.test.ts
  - apps/indusk-mcp/src/lib/promises/incident-names-clause.test.ts
  - apps/indusk-mcp/src/lib/promises/incident-per-clause.test.ts
  - apps/indusk-mcp/src/lib/promises/clause-measured.test.ts
  - apps/indusk-mcp/src/lib/promises/clause-test-runner.test.ts
  - apps/indusk-admin/src/lib/promise-dashboard.test.ts
  - apps/indusk-mcp/src/lib/promises/status-signal.test.ts
incidents: []
clauses:
  - name: verified-before-release
    kind: split
    statement: "A clause's tests must pass before anything ships, and a change that makes one fail is stopped before release."
  - name: upheld-by-its-signal
    kind: split
    statement: "A clause is upheld only when its signal has reported it upheld in a run of the real system, and a passing test never stands in for its signal."
  - name: no-signal-is-not-holding
    kind: limit
    statement: "A clause whose signal has never reported, or whose watcher is blind, reads no signal and never reads as holding."
  - name: a-break-names-its-clause
    kind: split
    statement: "When a clause's signal reports broken, the signal's event and the incident it opens name the promise and the clause, and point to the plan and phase that added the signal; its tests are reachable from the clause."
---

A clause is verified by its tests before release and upheld by its signal in use, and is upheld only when both say so.

## History
- 2026-10-16 — declared (mark-first), from its planning conversation.
- 2026-10-19 — enforced, confirmed for mark-first: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A7, row A8, row A9, row A10, row A11, row A12, row A13, row A14, row A15, row A16, row A17, row A18, row A32, row A33, row A34, row A35, row A36, row A38, row A39.
