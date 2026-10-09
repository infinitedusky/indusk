---
name: a-break-opens-a-fix-in-one-click
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/core/fix.ts
tests:
  - apps/vscode-extension/src/core/fix.test.ts
  - apps/vscode-extension/e2e/live.e2e.test.ts
incidents: []
---

From a broken promise, one action starts the developer's own `claude` in the project with the promise, its symptom, its trace link and its tests already given.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A12, row A13, row A14, row A20.
