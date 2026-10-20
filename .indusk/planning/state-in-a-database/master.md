---
title: "State in a database"
description: "Records move out of files into Postgres — plan progress first, then scorecards, runs, decisions, highlights, measurements, promise state and look approvals — while agreements stay files in git."
date: 2026-10-20
status: living
subplans:
  - plan-state-is-a-database
  - scorecards-in-the-database
  - runs-and-sessions-in-the-database
  - decisions-in-the-database
  - highlights-in-the-database
  - measurements-in-the-database
  - promise-state-in-the-database
  - look-approvals-in-the-database
  - state-on-the-server
---

# State in a database

Sandy, 2026-10-20: the hoops of the last weeks — impls merged between parallel
phases, workbench plans unable to run phases in parallel, plan reviews going
stale on every tick, shell edits policed by a guard — come from files doing a
database's job. The background is in
[plan-state-is-a-database's research](../plan-state-is-a-database/research.md)
(on its branch until approved).

## The rule

- **A record goes in the database**: written by programs, added to often, read
  by queries, never reviewed by a person as text in a diff.
- **An agreement stays a file in git**: a person reads or approves it, it is
  reviewed in git, or an agent reads it as instructions.
- **Only `indusk` commands and tools write the database**, and each runs the
  checks that guard what it writes.
- **What lands in git still lands**: a plan's final state is written into its
  folder when it lands.

## The database

Postgres. On the person's own server when the project has one (the machine
`indusk server deploy` sets up); otherwise an embedded Postgres (PGlite) inside
the admin on this machine, with the same schema. Choosing between them is a
connection setting, never a rewrite. Each plan below adds its own tables.

## What stays files

Plan documents (brief, test plan, ADR, impl tasks without checkmarks), promise
sentences and clauses, mockups and stories, lessons, every `CLAUDE.md`,
`.indusk/current.md`, config.

## Plans, in order

1. **`plan-state-is-a-database`** — started 2026-10-20, brief in conversation.
   The database itself, and a plan's progress in it: which tasks are done, each
   test row's state, each phase's state, blockers. Stable IDs for tasks; the
   gates run on every write; open plans copied in once; the final state copied
   into the plan folder at landing. Goes first in Stabilize; `run-the-graph`
   slice 1 is rewritten on top of it.
2. **`scorecards-in-the-database`** — not started. Eval results and findings
   (`eval/results.log`, `findings.json`, session scores). The scorecards page,
   the slowest in the admin (6.8 s measured 2026-10-20), reads them by query.
3. **`runs-and-sessions-in-the-database`** — not started. Build, planning and
   release run records, the admin's sessions file, and which worktree each plan
   uses. Ends "last writer wins" on the run record and the sessions file.
4. **`decisions-in-the-database`** — not started. Questions, answers and
   decisions (today lines in `.indusk/plan-history/<plan>.md` under the
   `current.md` lock), approvals and acceptances (today impl and brief
   frontmatter). A plan's decisions are still copied into git when it lands.
5. **`highlights-in-the-database`** — not started. The highlights queue
   (`highlights.jsonl`, the processed list, its lock and holds); the eval agent
   takes and marks highlights in the database.
6. **`measurements-in-the-database`** — not started. Plan timing, test-run
   times, slow runs, releases, suite durations, page timings.
7. **`promise-state-in-the-database`** — not started. Each promise's state
   (declared, enforced, known-broken, retired), its incidents, signal readings
   (`inbox`, `heard`) and clause verdicts. The promise file keeps its sentence
   and clauses. Read by confirm, the watcher, the admin and the editor
   extension, so it moves together.
8. **`look-approvals-in-the-database`** — not started. Which mockups and
   stories a person has approved, and when; the drawings stay files.
9. **`state-on-the-server`** — not started. The project's Postgres on the
   person's own server: `server deploy` adds it, `server connect` names it, a
   project's state moves from the embedded copy to the server, and a phase on
   another machine reads and writes the same state. Before any phase runs off
   this machine.
