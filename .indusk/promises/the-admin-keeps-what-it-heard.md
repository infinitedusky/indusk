---
name: the-admin-keeps-what-it-heard
kind: state
lifetime: holds
state: enforced
domain: admin
owner: incident-recording
sites:
  - apps/indusk-mcp/src/lib/promises/heard.ts
tests:
  - apps/indusk-mcp/src/lib/promises/heard.test.ts
  - apps/indusk-admin/src/components/Promises.heard.test.tsx
incidents: []
---

The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and the promise page shows them counted over time, whether or not a page was open when they happened.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A20, row A21, row A22.
