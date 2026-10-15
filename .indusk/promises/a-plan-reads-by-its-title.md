---
name: a-plan-reads-by-its-title
kind: state
lifetime: holds
state: enforced
domain: editor
owner: plan-stories
sites:
  - apps/indusk-mcp/src/lib/promises/display.ts
tests:
  - apps/vscode-extension/src/core/names.test.ts
  - apps/indusk-mcp/src/lib/promises/display.test.ts
  - apps/indusk-mcp/src/__tests__/promise-health-names.test.ts
incidents: []
---

Wherever InDusk names a plan, in the admin and in the editor, it shows the plan's title, a short name written in its brief or master, and its description is a separate field; a plan with no title written reads as its handle turned into words.

## History
- 2026-10-09 — declared (display-names), from its planning conversation.
- 2026-10-10 — enforced, confirmed for display-names: proven by row A5, row A6, row A7.
- 2026-10-15 — changed by plan-stories: titles are short names now, with the description its own field, and an unwritten title reads as words, not the handle. It read: "Wherever the editor names a plan, it shows the plan's title from its brief, the part before the dash, rather than its folder name." Owned before by display-names; plan-stories takes it over.
