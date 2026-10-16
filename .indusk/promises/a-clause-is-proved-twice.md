---
name: a-clause-is-proved-twice
kind: state
lifetime: holds
state: declared
domain: planning
owner: mark-first
sites: []
tests: []
incidents: []
clauses:
  - name: verified-before-release
    kind: split
    statement: "A clause's tests must pass before anything ships, and a change that makes one fail is stopped before release."
  - name: upheld-by-its-signal
    kind: split
    statement: "A clause is upheld only when its signal has reported it upheld in a run of the real system, and a passing test never stands in for its signal."
  - name: no-signal-is-not-holding
    kind: limit
    statement: "A clause whose signal has never reported, or whose watcher is blind, reads no signal and never reads as holding."
---

A clause is verified by its tests before release and upheld by its signal in use, and is upheld only when both say so.

## History
- 2026-10-16 — declared (mark-first), from its planning conversation.
