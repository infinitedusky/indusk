---
name: a-plan-shows-when-it-shipped
kind: state
lifetime: holds
state: enforced
domain: editor
owner: display-names
sites:
  - apps/indusk-mcp/src/lib/promises/display.ts
tests:
  - apps/indusk-mcp/src/__tests__/promise-health-names.test.ts
  - apps/indusk-mcp/src/lib/promises/display.test.ts
incidents: []
---

Wherever the editor names a plan, it shows when the plan started, when it landed, and the release version and date that shipped it, or that it is not released yet.

## History
- 2026-10-09 — declared (display-names), from its planning conversation.
- 2026-10-10 — enforced, confirmed for display-names: proven by row A7, row A11, row A12, row A13, row A14, row A15, row A16.
