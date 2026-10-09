---
name: catchup-records-what-it-finds
kind: state
lifetime: holds
state: enforced
domain: planning
owner: incident-recording
sites:
  - apps/indusk-mcp/src/tools/promise-tools.ts
tests:
  - apps/indusk-mcp/src/__tests__/record-breaks-tool.test.ts
  - apps/indusk-mcp/src/__tests__/catchup-records.test.ts
incidents: []
---

When catchup finds a production violation no incident records, it records it itself and reports what it opened, instead of telling the person to run `watch`.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A8, row A9.
