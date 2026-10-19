---
name: landing-tests-hold-under-load
kind: state
lifetime: holds
state: declared
domain: planning
owner: a-run-can-be-trusted
sites: []
tests: []
incidents: []
clauses:
  - name: recorder-waits-for-its-break
    kind: split
    statement: "The admin-recorder landing test waits for the incident it expects rather than a fixed minute, and passes with other builds running."
---

The tests landing runs pass or fail for what they test, not for how busy the machine is.

## History
- 2026-10-19 — declared (a-run-can-be-trusted), from its planning conversation.
