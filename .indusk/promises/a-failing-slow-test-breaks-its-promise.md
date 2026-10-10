---
name: a-failing-slow-test-breaks-its-promise
kind: state
lifetime: holds
state: declared
domain: planning
owner: release-records-its-failures
sites: []
tests: []
incidents: []
---

A test still failing after its rerun opens an incident on the promise its plan's row names, or adds to that promise's open incident, and the incident names the test, the release and the commits since the last green run; a run where more than half the test files failed opens nothing and is recorded as one failure of the environment.

## History
- 2026-10-10 — declared (release-records-its-failures), from its planning conversation.
