---
title: "A brief is accepted on current main"
date: 2026-10-19
---

# A brief is accepted on current main — Retrospective

## What We Set Out to Do

Accepting a brief, or starting its planning run, first merges main into the
plan's branch (and a workbench plan's code branch into its repo's trunk); a
conflict, main changing the plan's own documents, or a brief that fails its
check once main is in refuses with plain words and changes nothing; the person
never merges by hand. Item 3 of [Stabilize](../../stabilize/master.md).

## What Actually Happened

Planned unattended; the planning run stopped at the plan review (the
background-reader bug), so the review was run by hand: 19 findings, 16 fixed in
the plan, one brief clause narrowed with Sandy's yes, two dismissed. The main
catch: the first plan covered only the command-line accept; the admin's
planning start now merges main through the same function (`bringTrunkIntoPlan`).
Built unattended through falsification; cleanup skipped; audit written and
answered.

## Getting to Done

- The release session stopped at the retrospective's gate and the run still
  read "released" (the bug `a-run-can-be-trusted` fixes).
- Two refusals at close, fixed by hand: the after-landing live check (A12)
  named a clause, and five test files lacked their promise token.
- **Not closed:** `indusk promises confirm` refuses the three clauses because no
  phase reports their signals (planned before that rule reached the planner).
  Landed with the promise declared; the signals and the close go with
  `a-run-can-be-trusted`, which also makes an impl without a signals phase
  unsaveable.

## What We Learned

- A live-check row that names a clause blocks the close whenever it is
  skipped; the planner keeps writing them. Name the clause on the rows that
  run, and give a live check a reason instead.

## Quality Ratchet

Nothing recurring for Biome. Shape: nothing raised that a person judged wrong.

Landed on main at eca91fd2, 2026-10-19, by hand (one merge conflict in apps/indusk-mcp/CLAUDE.md, both entries kept). Installed and the admin restarted; nothing published. Open until its clauses report signals (with `a-run-can-be-trusted`).
