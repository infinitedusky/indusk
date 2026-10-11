---
title: "fix-opens-claude-tab"
date: 2026-10-10
status: accepted
workflow: bugfix
---

# fix-opens-claude-tab — Brief

"Fix with Claude" in the VS Code extension opens a terminal and runs `claude` with the break's facts as its first message (`apps/vscode-extension/src/extension.ts`, `fix`). Sandy wants it to open a new session in the Claude Code extension instead, inside the editor. Claude Code documents a link for that: `vscode://anthropic.claude-code/open?prompt=<url-encoded text>` opens a new Claude Code tab with the prompt filled in, not sent (code.claude.com/docs/en/vs-code, "Launch a VS Code tab from other tools"). Whether it works in Cursor is not documented, so the terminal stays the fallback.

## Expectations

None — a small change to where an existing action opens; its rows and one live check prove it.

## Promises

### This plan makes

1. **`a-fix-opens-in-the-claude-code-tab`** (state). In VS Code with the Claude Code extension installed, Fix with Claude opens a new Claude Code tab with the fix's prompt filled in; anywhere else it starts `claude` in a terminal as before.

### Existing promises

**Must not break**

- **`a-break-opens-a-fix-in-one-click`**. The prompt keeps the promise, its symptom, its trace link and its tests; only where it opens changes.
- **`the-editor-only-shows`**. Opening a tab writes nothing to the project.

**Changes**

None.

**Replaces**

None.

### Not promised

- Sending the prompt automatically: the documented link fills it in; the person presses Enter.
- The cockpit's fix action: a different surface, decided in its own plan.

## Depends On

- None.

## Blocks

- None.
