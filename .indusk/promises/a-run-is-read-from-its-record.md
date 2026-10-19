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
  - name: says-what-is-true
    kind: split
    statement: "The plan page and its nav row state the plan's situation in words, read from its record and its files: planning and the step, building and the phase, waiting on the person and for what, build complete and waiting on a list of what must still happen for it to close, each ticked as it happens, or stopped and why."
  - name: always-a-next-step
    kind: split
    statement: "Every plan that is not closed shows its next step and who takes it: what the system is doing now, or what it waits on and whether the person or an event completes it, so no open plan reads as stuck."
  - name: never-in-progress-when-idle
    kind: limit
    statement: "Nothing reads as in progress while no process is running for it."
---

Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again.

## History
- 2026-10-19 — declared (a-run-can-be-trusted), from its planning conversation.
- 2026-10-19 — changed by a-run-can-be-trusted: the page says what is true of the plan (Sandy, 2026-10-19). It read: "Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again." with the clauses kept-on-disk (split), dead-reads-stopped (split), shows-where-it-is (split), released-only-when-landed (split).
- 2026-10-19 — changed by a-run-can-be-trusted: every open plan shows its next step and who takes it (Sandy, 2026-10-19). It read: "Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again." with the clauses kept-on-disk (split), dead-reads-stopped (split), shows-where-it-is (split), released-only-when-landed (split), says-what-is-true (split), never-in-progress-when-idle (limit).
- 2026-10-19 — changed by a-run-can-be-trusted: a finished build reads build complete, waiting on a ticked list (Sandy, 2026-10-19). It read: "Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again." with the clauses kept-on-disk (split), dead-reads-stopped (split), shows-where-it-is (split), released-only-when-landed (split), says-what-is-true (split), always-a-next-step (split), never-in-progress-when-idle (limit).
