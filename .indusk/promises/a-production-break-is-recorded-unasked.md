---
name: a-production-break-is-recorded-unasked
kind: behaviour
lifetime: holds
state: declared
domain: planning
owner: incident-recording
sites: []
tests: []
incidents: []
---

While the admin is running, a promise broken in production becomes an incident, committed on the trunk, and reopens the plan that owns it with a Maintenance phase, within a minute and with nobody running a command; a recording pass that cannot read the server or cannot write the incident marks itself broken in the local telemetry.

## History
- 2026-10-08 — declared (incident-recording), from its planning conversation.
