---
name: a-failing-slow-test-breaks-its-promise
kind: state
lifetime: holds
state: enforced
domain: planning
owner: release-records-its-failures
sites:
  - apps/indusk-mcp/src/lib/promises/test-incident.ts
  - apps/indusk-mcp/src/lib/release/route.ts
  - apps/indusk-mcp/src/lib/release/suspects.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-incident.test.ts
  - apps/indusk-mcp/src/__tests__/release-report.test.ts
incidents: []
---

A test still failing after its rerun opens an incident on the promise its plan's row names, or adds to that promise's open incident, and the incident names the test, the release and the commits since the last green run; a run where more than half the test files failed opens nothing and is recorded as one failure of the environment.

## History
- 2026-10-10 — declared (release-records-its-failures), from its planning conversation.
- 2026-10-10 — enforced, confirmed for release-records-its-failures: proven by row A11, row A12, row A13, row A14, row A22.
