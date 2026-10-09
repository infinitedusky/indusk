---
name: the-editor-shows-the-same-health-as-the-admin
kind: structure
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites: []
tests:
  - apps/indusk-mcp/src/__tests__/promise-health-windows.test.ts
  - apps/vscode-extension/src/core/same-health.test.ts
  - apps/indusk-mcp/src/__tests__/promise-health-single-definition.test.ts
incidents: []
---

A promise's state in the editor is the one the admin and `indusk promises status` report, for each source, from one reader, never computed separately.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A6, row A7.
