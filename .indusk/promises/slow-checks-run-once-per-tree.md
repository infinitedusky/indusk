---
name: slow-checks-run-once-per-tree
kind: state
lifetime: holds
state: declared
domain: gates
owner: release-checks-run-once
sites: []
tests: []
incidents: []
---

The slow test tier runs at most once for the same code: release skips it when a fully green run already covered the code it would publish, and runs it when anything that ships or tests it has changed since; a version bump and a changelog entry are not a change.

## History
- 2026-10-08 — declared (release-checks-run-once), from its planning conversation.
