---
name: an-open-incident-stays-loud
kind: state
lifetime: holds
state: enforced
domain: planning
owner: incident-recording
sites:
  - apps/indusk-mcp/src/lib/promises/health.ts
  - apps/indusk-mcp/src/lib/promises/reminders.ts
tests:
  - apps/indusk-mcp/src/__tests__/open-incidents-loud.test.ts
  - apps/indusk-admin/src/components/Promises.incidents.test.tsx
  - apps/indusk-mcp/src/__tests__/catchup-records.test.ts
  - apps/indusk-mcp/src/lib/promises/reminders.test.ts
incidents: []
---

Every reader — catchup, `promise_health`, `promises status`, the admin — shows each open incident with its age and its owner's Maintenance phase, ahead of the roadmap; one open longer than a day is announced again, once a day, until it is fixed.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A10, row A11, row A12, row A13, row A14.
