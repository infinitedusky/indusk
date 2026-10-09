---
name: a-production-break-is-recorded-unasked
kind: behaviour
lifetime: holds
state: enforced
domain: planning
owner: incident-recording
sites:
  - apps/indusk-admin/src/instrumentation.ts
  - apps/indusk-mcp/src/lib/admin/recorder-loop.ts
  - apps/indusk-mcp/src/lib/promises/record-commit.ts
  - apps/indusk-mcp/src/lib/promises/record.ts
tests:
  - apps/indusk-mcp/src/lib/promises/record.test.ts
  - apps/indusk-mcp/src/__tests__/admin-recorder.test.ts
incidents: []
---

While the admin is running, a promise broken in production becomes an incident, committed on the trunk, and reopens the plan that owns it with a Maintenance phase, within a minute and with nobody running a command; a recording pass that cannot read the server or cannot write the incident marks itself broken in the local telemetry.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A1, row A2, row A3, row A4, row A5, row A27, row A29.
