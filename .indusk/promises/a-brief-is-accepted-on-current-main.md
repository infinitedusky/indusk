---
name: a-brief-is-accepted-on-current-main
kind: state
lifetime: holds
state: declared
domain: planning
owner: a-brief-is-accepted-on-current-main
sites: []
tests: []
incidents: []
clauses:
  - name: main-is-merged-first
    kind: split
    statement: "Accepting a brief merges main into the plan's branch before the brief is marked accepted, in the admin and from the command line alike."
  - name: a-conflict-refuses
    kind: split
    statement: "A merge that conflicts is undone and the acceptance refused, naming each conflicting file, with the brief still a draft."
  - name: the-person-never-merges
    kind: limit
    statement: "Accepting never asks the person to merge main by hand."
---

Accepting a brief first brings main into its plan's branch, so the plan is written against current code; when that merge conflicts, the acceptance is refused, naming the conflicting files, and nothing is changed.

## History
- 2026-10-19 — declared (a-brief-is-accepted-on-current-main), from its planning conversation.
- 2026-10-19 — changed by a-brief-is-accepted-on-current-main: the limit clause narrowed: other honest refusals may ask the person to act (Sandy, 2026-10-19). It read: "Accepting a brief first brings main into its plan's branch, so the plan is written against current code; when that merge conflicts, the acceptance is refused, naming the conflicting files, and nothing is changed." with the clauses main-is-merged-first (split), a-conflict-refuses (split), the-person-never-merges (limit).
