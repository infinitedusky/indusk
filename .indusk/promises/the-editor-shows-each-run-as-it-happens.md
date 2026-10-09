---
name: the-editor-shows-each-run-as-it-happens
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/core/activity.ts
tests:
  - apps/indusk-mcp/src/__tests__/promise-health-runs.test.ts
  - apps/vscode-extension/src/core/activity.test.ts
  - apps/vscode-extension/e2e/live.e2e.test.ts
incidents: []
---

The panel has an activity section that adds each recorded run of a promise as it arrives, newest first, saying whether it held or broke and in which source.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A26, row A27, row A28.
