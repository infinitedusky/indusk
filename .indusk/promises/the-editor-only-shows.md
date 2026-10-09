---
name: the-editor-only-shows
kind: state
lifetime: holds
state: enforced
domain: editor
owner: vscode-extension
sites:
  - apps/vscode-extension/src/extension.ts
tests:
  - apps/vscode-extension/src/core/only-shows.test.ts
  - apps/vscode-extension/src/core/hover.test.ts
incidents: []
---

The extension writes nothing to the project; recording and fixing happen through the CLI and the Claude it starts.

## History
- 2026-10-09 — declared (vscode-extension), from its planning conversation.
- 2026-10-09 — enforced, confirmed for vscode-extension: proven by row A15, row A21.
