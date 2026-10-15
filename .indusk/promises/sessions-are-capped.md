---
name: sessions-are-capped
kind: state
lifetime: holds
state: enforced
domain: admin
owner: sessions-per-plan
sites:
  - apps/indusk-mcp/src/lib/session/limits.ts
tests:
  - apps/indusk-mcp/src/lib/session/manager.test.ts
incidents: []
---

The number of sessions running together on a machine is capped by sessions.max in the InDusk home's config.json (~/.indusk/config.json), 4 by default; a start beyond the cap is refused, naming the sessions running and how to stop one.

## History
- 2026-10-14 — declared (sessions-per-plan), from its planning conversation.
- 2026-10-14 — enforced, confirmed for sessions-per-plan: proven by row A8, row A9, row A14, row A15.
