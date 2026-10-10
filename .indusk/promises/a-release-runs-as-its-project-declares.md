---
name: a-release-runs-as-its-project-declares
kind: state
lifetime: holds
state: enforced
domain: gates
owner: release-records-its-failures
sites:
  - apps/indusk-mcp/src/bin/commands/release.ts
  - apps/indusk-mcp/src/lib/release/record.ts
  - apps/indusk-mcp/src/lib/release/run.ts
tests:
  - apps/indusk-mcp/src/__tests__/release-run.test.ts
  - apps/indusk-mcp/src/__tests__/release-incident.test.ts
incidents: []
---

`indusk release` runs a project's declared release with its slow tests before or after the publish as the config says, and reports the release done when the config's completion condition holds, for any project that declares one.

## History
- 2026-10-09 — declared (release-records-its-failures), from its planning conversation.
- 2026-10-10 — enforced, confirmed for release-records-its-failures: proven by row A1, row A2, row A3, row A4, row A5, row A25.
