---
name: a-look-reports-like-any-promise
kind: state
lifetime: holds
state: enforced
domain: admin
owner: ui-promises
sites:
  - apps/indusk-admin/src/components/looks/LooksOnDashboard.tsx
  - apps/indusk-mcp/src/lib/looks/report.ts
  - apps/indusk-mcp/src/lib/promises/look-standing.ts
tests:
  - apps/indusk-mcp/src/lib/looks/report.test.ts
  - 'apps/indusk-admin/src/app/p/[project]/promises/dashboard-looks.test.tsx'
  - apps/vscode-extension/src/core/looks-health.test.ts
  - apps/indusk-mcp/src/lib/promises/look-standing.test.ts
  - apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts
incidents: []
---

Each check of the app's looks is recorded held or broken through the same telemetry promises use, and a broken one is counted and listed first with the rest.

## History
- 2026-10-11 — declared (ui-promises), from its planning conversation.
- 2026-10-12 — enforced, confirmed for ui-promises: proven by row A22, row A23, row A24, row A39.
