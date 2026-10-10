---
name: a-promise-reads-as-words
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
incidents: []
---

Wherever the editor names a promise in prose — its card, its row in the panel, the activity and the hover — it reads as words with its product names capitalised, and its full sentence is one click away.

## History
- 2026-10-09 — declared (display-names), from its planning conversation.
- 2026-10-10 — enforced, confirmed for display-names: proven by row A1, row A2, row A3, row A4.
