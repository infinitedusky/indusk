---
name: a-fix-opens-in-the-claude-code-tab
kind: state
lifetime: holds
state: enforced
domain: editor
owner: fix-opens-claude-tab
sites:
  - apps/vscode-extension/src/core/fix.ts
tests:
  - apps/vscode-extension/src/core/fix-tab.test.ts
incidents: []
---

In VS Code with the Claude Code extension installed, Fix with Claude opens a new Claude Code tab with the fix's prompt filled in; anywhere else it starts `claude` in a terminal as before.

## History
- 2026-10-11 — declared (fix-opens-claude-tab), from its planning conversation.
- 2026-10-11 — enforced, confirmed for fix-opens-claude-tab: proven by row A1, row A2.
