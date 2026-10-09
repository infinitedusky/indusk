---
name: a-break-reaches-the-working-agent
kind: state
lifetime: holds
state: enforced
domain: planning
owner: incident-recording
sites:
  - apps/indusk-mcp/hooks/_inbox.js
  - apps/indusk-mcp/hooks/break-inbox.js
  - apps/indusk-mcp/src/lib/promises/inbox.ts
tests:
  - apps/indusk-mcp/src/lib/promises/inbox.test.ts
  - apps/indusk-mcp/src/__tests__/break-inbox-hook.test.ts
  - apps/indusk-mcp/e2e/break-inbox.e2e.test.ts
  - apps/indusk-mcp/src/lib/promises/record.test.ts
incidents: []
---

A promise broken in production reaches the agent in every running session on the project at its next turn, naming the promise, the incident and the reopened plan, without waiting for a catchup.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
- 2026-10-09 — enforced, confirmed for incident-recording: proven by row A17, row A18, row A19, row A28, row A30, row A31.
