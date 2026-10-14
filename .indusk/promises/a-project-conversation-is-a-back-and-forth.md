---
name: a-project-conversation-is-a-back-and-forth
kind: state
lifetime: holds
state: enforced
domain: admin
owner: new-project-flow
sites:
  - 'apps/indusk-admin/src/app/api/new-projects/[id]/fold/route.ts'
  - apps/indusk-admin/src/components/new-project/ConversationThread.tsx
  - apps/indusk-mcp/src/lib/new-project/transcript.test.ts
  - apps/indusk-mcp/src/lib/new-project/transcript.ts
tests:
  - apps/indusk-admin/src/lib/conversation-turns.test.ts
  - apps/indusk-admin/src/components/new-project/ConversationThread.test.tsx
  - apps/indusk-mcp/src/__tests__/new-project-cli.test.ts
  - apps/indusk-mcp/src/lib/new-project/prompt.test.ts
  - apps/indusk-admin/src/components/session/use-session-events.test.tsx
incidents: []
---

A project conversation reads as a back-and-forth: the person's messages and the agent's replies alternate as "you" and "agent" bubbles, each reply formatted as Markdown, and the person answers in the same thread. Everything the agent did between replies is folded inside its bubble behind "See more", one click from view.

## History
- 2026-10-14 — declared (new-project-flow), from its planning conversation.
- 2026-10-14 — enforced, confirmed for new-project-flow: proven by row A23, row A24, row A25, row A26, row A27, row A29, row A34.
