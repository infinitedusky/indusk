---
name: a-break-reaches-the-editor
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/core/session.ts
tests:
  - apps/vscode-extension/src/core/session.test.ts
  - apps/vscode-extension/e2e/live.e2e.test.ts
  - apps/indusk-mcp/src/__tests__/promises-health-every.test.ts
  - apps/vscode-extension/src/core/reader.test.ts
  - apps/vscode-extension/src/core/hover.test.ts
incidents: []
---

A broken promise shows in the open editor within ten seconds of the break being readable from its source, at the line that keeps it, without a reload.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A8, row A9, row A10, row A11, row A17, row A18, row A19.
