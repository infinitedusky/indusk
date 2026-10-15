---
title: "Sessions per plan — research"
date: 2026-10-14
status: draft
---

# Sessions per plan — Research

## Where one session is enforced

The admin is one daemon for the machine, and its `SessionManager`
(`apps/indusk-mcp/src/lib/session/manager.ts`) refuses any start while any session
runs: `start()` takes the first held session and throws `SessionBusy`. It was added
2026-10-06 in `08ad8a34` ("one session at a time, recorded, stoppable, reaped after a
crash", plan-cockpit / admin-plan-authoring). No plan document records why one; it
reads as the simplest safe start.

The admin repeats the rule through `sessionManager().current()`, which returns one
session:

- `apps/indusk-admin/src/lib/build-host.ts` (two starts), `app/api/plans/build/route.ts`
- `app/api/drafts/[id]/talk`, `accept`, `discard`
- `app/api/sessions/route.ts` (the one session the page reconnects to)
- `lib/decisions.ts`, `lib/decisions-reader.ts`

Session kinds are `planning` and `build` (`lib/session/protocol.ts`). The plan page and
the brief page both mount `PlanSession`, which reattaches to the plan's planning
session, so the two pages already share one agent.

## Why per plan is safe

Each plan works in its own worktree on its own branch (`indusk worktree create`), so
two plans' sessions never write the same checkout. The record file
(`~/.indusk/admin-sessions.json`) and crash reaping already key each record by id.

## Open questions for the ADR

- `current()` becomes `forPlan(project, plan, kind?)` and `running()`; every caller
  above names its plan.
- A draft's conversation (no plan yet) is keyed by its draft id.
- Whether the cap counts builds and planning sessions together (proposed: yes).
