---
name: a-plan-says-how-long-it-took
kind: state
lifetime: holds
state: enforced
domain: planning
owner: a-plan-says-how-long-it-took
sites:
  - apps/indusk-mcp/src/bin/commands/plans.ts
  - apps/indusk-mcp/src/lib/timing/log.ts
  - apps/indusk-mcp/src/lib/timing/phase-close.ts
  - apps/indusk-mcp/src/lib/timing/safe.ts
  - apps/indusk-mcp/src/lib/timing/test-run.ts
  - apps/indusk-mcp/src/lib/timing/timed-step.ts
  - apps/indusk-mcp/src/lib/timing/view.ts
tests:
  - apps/indusk-mcp/src/lib/timing/phase-close.test.ts
  - apps/indusk-mcp/src/lib/timing/timed-step.test.ts
  - apps/indusk-mcp/src/lib/timing/view.test.ts
  - apps/indusk-mcp/src/lib/timing/test-run.test.ts
  - apps/indusk-mcp/src/lib/timing/log.test.ts
incidents: []
clauses:
  - name: phases-are-timed
    kind: split
    statement: "Each phase records when it opened and when it closed."
  - name: steps-are-timed
    kind: split
    statement: "Each unattended planning or build step records when it started, when it ended and how it ended."
  - name: test-runs-are-recorded
    kind: split
    statement: "Each run of a plan's tests records the plan, the phase or the landing, how many files it ran for each reason, how long it took and whether it passed."
  - name: one-view
    kind: split
    statement: "One command prints a plan's phases, steps and test runs with their durations, and a plan's total from its brief's acceptance to its landing."
  - name: a-record-never-blocks
    kind: limit
    statement: "A record that cannot be written never stops the phase, the step or the test run it records."
---

Every phase, every unattended step and every run of a plan's tests records when it started and ended, and one command shows a plan's time by phase, by step and by test run.

## History
- 2026-10-19 — declared (a-plan-says-how-long-it-took), from its planning conversation.
- 2026-10-19 — enforced, confirmed for a-plan-says-how-long-it-took: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A7, row A8, row A9, row A10, row A11, row A12, row A14, row A15, row A16, row A17, row A20, row A21, row A22, row A23, row A24.
