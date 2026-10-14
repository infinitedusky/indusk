---
name: a-session-belongs-to-its-plan
kind: state
lifetime: holds
state: declared
domain: admin
owner: sessions-per-plan
sites: []
tests: []
incidents: []
---

A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same plan is refused, naming the session already running, so a plan can have a planning session and a build at the same time.

## History
- 2026-10-14 — declared (sessions-per-plan), from its planning conversation.
