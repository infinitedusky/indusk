---
name: the-admin-keeps-what-it-heard
kind: state
lifetime: holds
state: enforced
domain: admin
owner: plan-cockpit
sites:
  - apps/indusk-mcp/src/lib/promises/heard.ts
  - apps/indusk-mcp/src/lib/promises/proof.ts
tests:
  - apps/indusk-mcp/src/lib/promises/proof.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx'
  - apps/indusk-mcp/src/lib/promises/heard.test.ts
  - apps/indusk-admin/src/components/Promises.heard.test.tsx
incidents: []
---

The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and each promise's own page shows them counted per day over thirty days, whether or not a page was open when they happened.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A20, row A21, row A22.
- 2026-10-10 — changed by plan-cockpit: plan-cockpit gives each promise its own page. It read: "The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and the promise page shows them counted over time, whether or not a page was open when they happened." Owned before by incident-recording; plan-cockpit takes it over.
- 2026-10-11 — links updated, confirmed for plan-cockpit: tests apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx, apps/indusk-mcp/src/lib/promises/heard.test.ts, apps/indusk-admin/src/components/Promises.heard.test.tsx; sites apps/indusk-mcp/src/lib/promises/heard.ts, apps/indusk-mcp/src/lib/promises/proof.ts.
