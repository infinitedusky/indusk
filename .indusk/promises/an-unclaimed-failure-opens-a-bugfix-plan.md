---
name: an-unclaimed-failure-opens-a-bugfix-plan
kind: state
lifetime: holds
state: declared
domain: planning
owner: release-records-its-failures
sites: []
tests: []
incidents: []
---

A test still failing after its rerun that no row's promise claims opens one draft bugfix plan for its file, naming the commits since the last green run, and a later failure of the same file reuses that plan while it is open; a run where more than half the test files failed opens no plan.

## History
- 2026-10-10 — declared (release-records-its-failures), from its planning conversation.
