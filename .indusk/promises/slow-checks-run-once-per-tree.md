---
name: slow-checks-run-once-per-tree
kind: state
lifetime: holds
state: enforced
domain: gates
owner: release-checks-run-once
sites:
  - apps/indusk-mcp/src/bin/commands/checks.ts
  - apps/indusk-mcp/src/lib/checks/key.ts
  - apps/indusk-mcp/src/lib/checks/record.ts
tests:
  - apps/indusk-mcp/src/__tests__/checks-slow.test.ts
  - apps/indusk-mcp/src/lib/checks/key.test.ts
incidents: []
---

The slow test tier runs at most once for the same code: release skips it when a fully green run already covered the code it would publish, and runs it when anything that ships or tests it has changed since; a version bump and a changelog entry are not a change.

## History
- 2026-10-08 — declared (release-checks-run-once), from its planning conversation.
- 2026-10-08 — enforced, confirmed for release-checks-run-once: proven by row A1, row A2, row A3, row A4, row A5.
- 2026-10-08 — links updated, confirmed for release-checks-run-once: tests apps/indusk-mcp/src/__tests__/checks-slow.test.ts, apps/indusk-mcp/src/lib/checks/key.test.ts; sites apps/indusk-mcp/src/bin/commands/checks.ts, apps/indusk-mcp/src/lib/checks/key.ts, apps/indusk-mcp/src/lib/checks/record.ts.
