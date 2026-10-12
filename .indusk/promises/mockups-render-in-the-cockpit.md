---
name: mockups-render-in-the-cockpit
kind: state
lifetime: holds
state: enforced
domain: admin
owner: ui-promises
sites:
  - 'apps/indusk-admin/src/app/p/[project]/looks/page.tsx'
  - apps/indusk-admin/src/components/looks/Looks.tsx
  - apps/indusk-mcp/src/lib/looks/overview.ts
tests:
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks.test.tsx'
  - 'apps/indusk-admin/src/app/p/[project]/looks/looks-browser.contract.test.ts'
incidents: []
---

Each mockup opens in the cockpit at each reference device, drawn with the foundation's tokens.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A14, row A15, row A16.
