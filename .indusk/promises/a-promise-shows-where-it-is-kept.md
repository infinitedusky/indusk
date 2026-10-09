---
name: a-promise-shows-where-it-is-kept
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/core/markers.ts
tests:
  - apps/vscode-extension/src/core/markers.test.ts
  - apps/vscode-extension/e2e/live.e2e.test.ts
incidents: []
---

In a project with promises, every line that carries a promise's token shows the promise's name and its state.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A1, row A2, row A3, row A4, row A5, row A22.
