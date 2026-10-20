---
name: the-work-runs-as-a-graph
kind: behaviour
lifetime: holds
state: declared
domain: planning
owner: run-the-graph
sites: []
tests: []
incidents: []
clauses:
  - name: a-phase-names-what-it-needs
    kind: split
    statement: "Each phase in a plan names the phases it depends on; one that names none depends on the phase before it, so a plan written before this runs as it does today."
  - name: ready-phases-start
    kind: split
    statement: "A phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room."
  - name: no-needless-wait
    kind: limit
    statement: "No phase is held back by a phase of its plan it does not depend on, except that two phases of one plan that touch the same file never run at the same time."
  - name: graph-is-current
    kind: limit
    statement: "When a phase ends or a plan is approved, the plan's graph is read again before its next phase starts."
  - name: within-the-cap
    kind: rests-on
    rests_on: sessions-are-capped
  - name: reviews-are-phases
    kind: limit
    statement: "The phases falsify, cleanup, the audit and an incident write are build phases of the graph like any other, with the same dependencies, files and order; the steps that write them are not phases (Sandy, 2026-10-16)."
---

Within an approved plan, every phase whose dependencies are done is running, up to the session cap, and no phase waits on one it does not depend on.

## History
- 2026-10-19 — declared (run-the-graph), from its planning conversation.
- 2026-10-20 — changed by run-the-graph: sliced to one plan's phases (Sandy, 2026-10-19). It read: "Every phase whose dependencies are done and whose files no running phase touches is running, up to the session cap, and no phase waits on one it does not depend on." with the clauses a-phase-names-what-it-needs (split), ready-phases-start (split), no-needless-wait (limit), graph-is-current (limit), within-the-cap (rests-on), reviews-are-phases (limit).
