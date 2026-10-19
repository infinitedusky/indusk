---
name: a-plan-runs-its-tests-and-what-must-not-break
kind: state
lifetime: holds
state: enforced
domain: gates
owner: a-plan-runs-what-must-not-break
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
    statement: "Each phase runs the tests of the rows it writes or makes pass."
  - name: what-must-not-break
    kind: split
    statement: "Each phase and the landing run the tests of the promises the brief lists as Must not break."
  - name: nothing-else-runs
    kind: limit
    statement: "No other test runs while a plan is built or landed."
supersedes: everyday-suite-stays-fast
---

While a plan is built, each phase runs the tests of the rows it writes or makes pass and the tests of the promises its brief lists as Must not break, a landing runs every row's tests and those same tests, and no other test runs.

## History
- 2026-10-18 — declared (tests-never-make-us-wait), from its planning conversation.
- 2026-10-18 — recorded as replacing `everyday-suite-stays-fast`, which is retired when tests-never-make-us-wait closes.
- 2026-10-18 — enforced, confirmed for tests-never-make-us-wait: proven by row T1, row T2, row T3, row T4, row T5, row T6, row T7, row T15, row T16, row T19.
- 2026-10-19 — changed by a-plan-runs-what-must-not-break: phases ran about 100 reached tests that overloaded the machine; the Must-not-break tests are the certain set (Sandy, 2026-10-18). It read: "While a plan is built, it runs the tests it writes, the tests its changes reach and the tests of the promises its brief lists as Must not break, and no other test." with the clauses its-own-tests (split), what-its-changes-reach (split), what-must-not-break (split), nothing-else-runs (limit) Owned before by tests-never-make-us-wait; a-plan-runs-what-must-not-break takes it over.
