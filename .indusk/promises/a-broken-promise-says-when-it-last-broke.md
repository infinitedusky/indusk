---
name: a-broken-promise-says-when-it-last-broke
kind: state
lifetime: holds
state: enforced
domain: editor
owner: panel-last-broke-time
sites:
  - apps/indusk-mcp/src/lib/promises/health-line.ts
tests:
  - apps/vscode-extension/src/core/last-broke.test.ts
  - apps/indusk-mcp/src/__tests__/promise-health-names.test.ts
incidents: []
---

Wherever the editor says a promise last broke, it shows the time of its newest violation, in the person's own time zone, never the time it was last seen.

## History
- 2026-10-10 — declared (panel-last-broke-time), from its planning conversation.
- 2026-10-10 — enforced, confirmed for panel-last-broke-time: proven by row A1, row A2, row A3.
