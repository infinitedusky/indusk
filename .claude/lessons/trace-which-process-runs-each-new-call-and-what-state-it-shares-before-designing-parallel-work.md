# Before designing parallel work, trace which process runs each new call and what in-memory state it shares or keys

Why: run-the-graph's first impl assumed one plan equals one session. It did not trace that the CLI and the admin each hold their own SessionManager, that the run record and the question hold were keyed by plan and kind, and that the cap exempted a build session whose plan already had one. Parallel phases of one plan then collided with state keyed too coarsely, and a driver that two processes could start would have double-launched phases.

What to do: when a plan changes how many of something run at once, list each new call and write down (1) the process it runs in (CLI, admin daemon, session child), (2) the in-memory or on-disk state it reads and writes, and (3) the key that state uses. Re-key anything keyed on the old unit (plan, kind) to the new one (plan, kind, phase), and name the one process that hosts any timer or driver. Put the list in the ADR so the impl phases cite it.

Pointer: .indusk/planning/run-the-graph/plan-review.md (findings on the session manager, the admin build host and the driver host); highlight h-20261020-007.
