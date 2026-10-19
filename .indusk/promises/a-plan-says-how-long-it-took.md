---
name: a-plan-says-how-long-it-took
kind: state
lifetime: holds
state: declared
domain: planning
owner: a-plan-says-how-long-it-took
sites: []
tests: []
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
