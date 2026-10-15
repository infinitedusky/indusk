---
name: a-prompt-shows-only-when-a-person-must-choose
kind: state
lifetime: holds
state: enforced
domain: admin
owner: decided-prompts-stay-closed
sites:
  - apps/indusk-admin/src/components/session/SessionPanel.tsx
  - apps/indusk-admin/src/lib/request-decisions.ts
tests:
  - apps/indusk-mcp/src/lib/build/build-session.test.ts
  - apps/indusk-admin/src/components/session/SessionPanel.test.tsx
  - apps/indusk-admin/src/lib/conversation-turns.test.ts
  - apps/indusk-admin/src/components/new-project/ConversationThread.test.tsx
  - apps/indusk-admin/src/components/session/use-answered-requests.test.tsx
incidents: []
---

The session panel offers Allow/Deny or a question's choices only for a request that is waiting on a person; a request the session decided on its own is never shown as one to answer.

## History
- 2026-10-14 — declared (decided-prompts-stay-closed), from its planning conversation.
- 2026-10-15 — enforced, confirmed for decided-prompts-stay-closed: proven by row A1, row A2, row A3, row A4, row A10, row A11.
