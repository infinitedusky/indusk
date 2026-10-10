---
name: an-unclaimed-failure-opens-a-bugfix-plan
kind: state
lifetime: holds
state: enforced
domain: planning
owner: release-records-its-failures
sites:
  - apps/indusk-mcp/src/lib/release/bugfix-plan.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-bugfix-plan.test.ts
  - apps/indusk-mcp/src/__tests__/release-report.test.ts
incidents: []
---

A test still failing after its rerun that no row's promise claims opens one draft bugfix plan for its file, naming the commits since the last green run, and a later failure of the same file reuses that plan while it is open; a run where more than half the test files failed opens no plan.

## History
- 2026-10-10 — declared (release-records-its-failures), from its planning conversation.
- 2026-10-10 — enforced, confirmed for release-records-its-failures: proven by row A15, row A16, row A17, row A22, row A26, row A27, row A30.
