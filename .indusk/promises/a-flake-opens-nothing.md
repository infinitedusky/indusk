---
name: a-flake-opens-nothing
kind: state
lifetime: holds
state: enforced
domain: gates
owner: release-records-its-failures
sites:
  - apps/indusk-mcp/src/lib/release/settle.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-report.test.ts
incidents: []
---

A test that fails and then passes when its file is run once more is listed as a flake on the release's record and opens no incident and no plan.

## History
- 2026-10-09 — declared (release-records-its-failures), from its planning conversation.
- 2026-10-10 — enforced, confirmed for release-records-its-failures: proven by row A9, row A10, row A28, row A29.
