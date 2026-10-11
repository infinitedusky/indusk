---
title: "fix-opens-claude-tab — Test Plan"
date: 2026-10-10
status: accepted
---

# fix-opens-claude-tab — Test Plan

## Behavioral Assertions

### `a-fix-opens-in-the-claude-code-tab` — in VS Code with the Claude Code extension installed, Fix with Claude opens a new Claude Code tab with the fix's prompt filled in; anywhere else it starts `claude` in a terminal as before.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | In VS Code with Claude Code installed, the fix opens `vscode://anthropic.claude-code/open?prompt=…` whose decoded prompt is exactly the prompt the terminal would have sent — the promise, symptom, trace link and tests — even when `claude` is not on the PATH | unit |
| A2 | In Cursor, or without the Claude Code extension, the fix starts `claude` in a terminal exactly as before, and with neither the extension nor `claude` on the PATH it says how to install Claude Code | unit |
| A3 | Clicking Fix with Claude on a broken promise in VS Code opens a Claude Code tab with the prompt filled in | live check |
