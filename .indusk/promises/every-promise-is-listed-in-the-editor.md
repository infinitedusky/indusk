---
name: every-promise-is-listed-in-the-editor
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/core/panel.ts
tests:
  - apps/vscode-extension/src/core/panel.test.ts
  - apps/vscode-extension/e2e/live.e2e.test.ts
  - apps/indusk-mcp/src/__tests__/promise-health-runs.test.ts
incidents: []
---

The editor has a panel listing every promise in the project with its state; broken ones come first as cards, the latest break first, and each opens to its tests and the places that keep it, any of which opens the file at that line.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A23, row A24, row A25, row A29, row A30.
