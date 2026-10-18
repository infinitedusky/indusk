---
name: a-plan-runs-its-tests-and-what-must-not-break
kind: state
lifetime: holds
state: enforced
domain: gates
owner: tests-never-make-us-wait
sites:
  - apps/indusk-mcp/src/bin/commands/plans.ts
  - apps/indusk-mcp/src/lib/plans/plan-tests.ts
  - apps/indusk-mcp/src/lib/plans/test-set-run.ts
  - apps/indusk-mcp/src/lib/plans/test-set.ts
  - apps/indusk-mcp/src/lib/tests/run-files.test.ts
  - apps/indusk-mcp/src/lib/tests/run-files.ts
tests:
  - apps/indusk-mcp/src/lib/plans/test-set.test.ts
  - apps/indusk-mcp/src/__tests__/vitest-related-report.contract.test.ts
  - apps/indusk-mcp/src/__tests__/skills-run-the-plan-test-set.test.ts
  - apps/indusk-mcp/src/lib/plans/test-set-run.test.ts
incidents: []
clauses:
  - name: its-own-tests
    kind: split
    statement: "Each phase runs the tests of the rows it writes or changes."
  - name: what-its-changes-reach
    kind: split
    statement: "Each phase runs the tests whose imports reach the files it changed."
  - name: what-must-not-break
    kind: split
    statement: "The tests of every promise the brief lists as Must not break run at landing."
  - name: nothing-else-runs
    kind: limit
    statement: "No other test runs while a plan is built or landed."
supersedes: everyday-suite-stays-fast
---

While a plan is built, it runs the tests it writes, the tests its changes reach and the tests of the promises its brief lists as Must not break, and no other test.

## History
- 2026-10-18 — declared (tests-never-make-us-wait), from its planning conversation.
- 2026-10-18 — recorded as replacing `everyday-suite-stays-fast`, which is retired when tests-never-make-us-wait closes.
- 2026-10-18 — enforced, confirmed for tests-never-make-us-wait: proven by row T1, row T2, row T3, row T4, row T5, row T6, row T7, row T15, row T16, row T19.
