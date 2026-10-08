---
name: the-recording-server-runs-from-a-published-image
kind: state
lifetime: holds
state: declared
domain: server
owner: server-provisioning
sites: []
tests: []
incidents: []
---

Every release publishes the recording server's image to a public registry, and that image runs with a volume, two ports and its secrets, with no InDusk checkout and no build on the person's side.

## History
- 2026-10-08 — declared (server-provisioning), from its planning conversation.
