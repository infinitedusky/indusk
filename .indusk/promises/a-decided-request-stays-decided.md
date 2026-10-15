---
name: a-decided-request-stays-decided
kind: state
lifetime: holds
state: enforced
domain: admin
owner: decided-prompts-stay-closed
sites:
  - apps/indusk-admin/src/lib/request-decisions.ts
  - apps/indusk-mcp/src/lib/session/manager.ts
tests:
  - apps/indusk-mcp/src/lib/session/manager.test.ts
  - apps/indusk-admin/src/components/session/SessionPanel.test.tsx
  - apps/indusk-mcp/src/lib/build/build-session.test.ts
incidents: []
---

Every request appears in the panel's log; once it is decided, whether by a person or by the session's own rule, it shows as done with its outcome (allowed, or denied with the reason), as if its button had been pressed, and it stays done after the page reloads or the panel reconnects.

## History
- 2026-10-14 — declared (decided-prompts-stay-closed), from its planning conversation.
- 2026-10-15 — enforced, confirmed for decided-prompts-stay-closed: proven by row A5, row A6, row A7, row A9, row A12.
