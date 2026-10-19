---
name: a-run-is-read-from-its-record
kind: state
lifetime: holds
state: declared
domain: admin
owner: a-run-can-be-trusted
sites: []
tests: []
incidents: []
clauses:
  - name: kept-on-disk
    kind: split
    statement: "A run's step, phase, process and stop are written to disk as they change, and read back after the admin restarts."
  - name: dead-reads-stopped
    kind: split
    statement: "A run whose process is gone without a stop reads as stopped, saying so, and Build starts it again from where the plan stands."
  - name: shows-where-it-is
    kind: split
    statement: "The build controls name the phase the plan is on, read from the plan, not the step the session started with."
  - name: released-only-when-landed
    kind: split
    statement: "A release reads released only when the plan has landed on main; otherwise it reads stopped with the reason."
---

Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again.

## History
- 2026-10-19 — declared (a-run-can-be-trusted), from its planning conversation.
