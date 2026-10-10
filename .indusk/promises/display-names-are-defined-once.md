---
name: display-names-are-defined-once
kind: structure
lifetime: holds
state: enforced
domain: editor
owner: display-names
sites:
  - apps/indusk-mcp/src/lib/promises/display.ts
tests:
  - apps/indusk-mcp/src/__tests__/display-names-single-definition.test.ts
incidents: []
---

How a promise or a plan is named for a person, and a plan's dates, are worked out in one place in the package, which the editor reads and the admin can.

## History
- 2026-10-09 — declared (display-names), from its planning conversation.
- 2026-10-09 — changed by display-names: Sandy added plan dates (2026-10-09); they are worked out in the same module. It read: "How a promise or a plan is named for a person is worked out in one place in the package, which the editor reads and the admin can."
- 2026-10-10 — enforced, confirmed for display-names: proven by row A8, row A17.
