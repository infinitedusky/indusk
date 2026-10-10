---
name: a-failure-is-read-from-the-report
kind: state
lifetime: holds
state: enforced
domain: gates
owner: release-records-its-failures
sites:
  - apps/indusk-mcp/src/lib/release/junit.ts
  - apps/indusk-mcp/src/lib/release/settle.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-report.test.ts
  - apps/indusk-mcp/src/__tests__/release-junit.contract.test.ts
incidents: []
---

Which tests failed is read from the test report the project declares, never from the runner's printed output, and a run with no readable report says the slow tests failed without naming a test.

## History
- 2026-10-09 — declared (release-records-its-failures), from its planning conversation.
- 2026-10-10 — enforced, confirmed for release-records-its-failures: proven by row A6, row A7, row A8, row A24.
