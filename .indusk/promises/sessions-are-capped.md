---
name: sessions-are-capped
kind: state
lifetime: holds
state: declared
domain: admin
owner: sessions-per-plan
sites: []
tests: []
incidents: []
---

The number of sessions running together on a machine is capped by sessions.max in .indusk/config.json, 4 by default; a start beyond the cap is refused, naming the sessions running and how to stop one.

## History
- 2026-10-14 — declared (sessions-per-plan), from its planning conversation.
