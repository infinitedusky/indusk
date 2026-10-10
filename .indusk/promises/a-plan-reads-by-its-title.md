---
name: a-plan-reads-by-its-title
kind: state
lifetime: holds
state: enforced
domain: editor
owner: display-names
sites:
  - apps/indusk-mcp/src/lib/promises/display.ts
tests:
  - apps/vscode-extension/src/core/names.test.ts
  - apps/indusk-mcp/src/lib/promises/display.test.ts
  - apps/indusk-mcp/src/__tests__/promise-health-names.test.ts
incidents: []
---

Wherever the editor names a plan, it shows the plan's title from its brief, the part before the dash, rather than its folder name.

## History
- 2026-10-09 — declared (display-names), from its planning conversation.
- 2026-10-10 — enforced, confirmed for display-names: proven by row A5, row A6, row A7.
