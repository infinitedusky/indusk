---
name: provisioning-never-prints-a-secret
kind: state
lifetime: holds
state: declared
domain: server
owner: server-provisioning
sites: []
tests: []
incidents: []
---

The server's password and the Slack webhook never appear in either command's output, in the project's config, or in anything committed; the config names the variable, and the value lives in the machine's secrets.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
