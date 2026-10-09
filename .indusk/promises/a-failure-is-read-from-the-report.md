---
name: a-failure-is-read-from-the-report
kind: state
lifetime: holds
state: declared
domain: gates
owner: release-records-its-failures
sites: []
tests: []
incidents: []
---

Which tests failed is read from the test report the project declares, never from the runner's printed output, and a run with no readable report says the slow tests failed without naming a test.

## History
- 2026-10-09 — declared (release-records-its-failures), from its planning conversation.
