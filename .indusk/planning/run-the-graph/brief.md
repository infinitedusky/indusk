---
title: "A plan's phases run in parallel"
date: 2026-10-16
status: accepted
workflow: feature
clauses: required
description: "Slice 1 of running the graph: within one approved plan, every phase whose dependencies are done runs at once, each on its own branch off the plan's branch, and merges into the plan only when its tests and the plan's touched clauses' tests pass — so a plan finishes in the time of its longest chain, not the sum of its phases."
accepted_at: "2026-10-19T20:53:29.524Z"
---

# A plan's phases run in parallel — Brief

The first child of [run-the-master](../run-the-master/master.md), settled with
Sandy on 2026-10-16 and gone through story by story on 2026-10-19.

**Sliced 2026-10-19 (Sandy).** The full design (six promises, about thirty
clauses, thirteen build phases) did not converge: two cold reads in a row found
twenty-odd problems each, some fatal. This plan is now slice 1 — the parallel
running of one plan's phases. The rest of the design is kept as stories and
becomes the next slices (see *Not promised* and
[run-the-master](../run-the-master/master.md)); the full brief as it stood is
in this file's history at commit `0842d3fdf`.

## The end state, in stories

**This slice:**

1. **You approve a plan, and every phase that can start, starts.** You approve
   a plan with six build phases. Each phase says which other phases it needs.
   Phases 1 and 3 need nothing, so both start the moment you approve. Phase 2
   needs 1, so it starts when 1 finishes. Phase 5 needs 2 and 3, so it starts
   once both are done. Nothing waits on a phase it does not need. Each phase
   works on its own branch and joins the plan only when its tests, and the
   tests of every clause the plan has touched so far, pass.

6. **You look at the admin.** Every phase shows what it is doing, what it is
   waiting on, or why it stopped (with `a-run-can-be-trusted`, built). Seeing
   the graph itself comes with `activity-and-graph`.

**Later slices** (each its own plan; written 2026-10-19, kept for them): two
plans want the same file (story 2); a fix for a broken promise goes first
(story 3); the trunk moves while work is in flight (story 4); a phase cannot
go on without you, and only what needs it waits (story 5); nothing stops and a
hold is cheap.

## Expectations

1. **A plan finishes in about the time of its longest chain of dependent phases, not the sum of its phases.**
   - Measure: for the next plan with independent phases, the time from its approval to its review, against the sum of its phases' own durations and its longest dependent chain, read from phase start and end times.
   - Look: when that plan reaches review.

## Promises

### This plan makes

1. **`the-work-runs-as-a-graph`** (behaviour). Within an approved plan, every phase whose dependencies are done is running, up to the session cap, and no phase waits on one it does not depend on.
   - **`a-phase-names-what-it-needs`** (split). Each phase in a plan names the phases it depends on; one that names none depends on the phase before it, so a plan written before this runs as it does today.
   - **`ready-phases-start`** (split). A phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room.
   - **`no-needless-wait`** (limit). No phase is held back by a phase of its plan it does not depend on, except that two phases of one plan that touch the same file never run at the same time.
   - **`graph-is-current`** (limit). When a phase ends or a plan is approved, the plan's graph is read again before its next phase starts.
   - **`within-the-cap`** (rests on `sessions-are-capped`).
   - **`reviews-are-phases`** (limit). The phases falsify, cleanup, the audit and an incident write are build phases of the graph like any other, with the same dependencies, files and order; the steps that write them are not phases (Sandy, 2026-10-16).
2. **`a-phase-builds-on-its-own-branch`** (state). Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified.
   - **`own-worktree`** (limit). Every running phase has its own worktree and branch, cut from its plan's branch.
   - **`starts-from-its-dependencies`** (limit). A phase starts with every finished phase it depends on merged into its worktree.
   - **`green-before-merging`** (limit). A phase merges into its plan's branch only when, with the merge made, its own tests and the tests of every clause the plan's branch has touched pass, so two phases that break something only together are caught at the merge that joins them.
   - **`every-phase-is-checked`** (limit). A phase that runs no test never merges, and a phase that touches a clause carries that clause's signal.
   - **`only-the-plan-lands`** (limit). Nothing reaches the trunk from a phase's branch; only a plan's branch, once its promises are verified.

### Existing promises

**Must not break**

- **`sessions-are-capped`**. The graph runs as many phases at once as the cap allows, never more; `the-work-runs-as-a-graph` rests on it.
- **`a-plan-builds-only-after-approval`**. Only an approved plan's phases enter the graph.
- **`a-plan-is-written-on-its-own-branch`**. The plan's branch stays where its build lands from; phases branch off it.
- **`a-plan-boundary-names-the-next-session`**. A phase boundary still names the command for what runs next; the runner runs it.
- **`the-cost-sets-the-wait`**. A question that holds still holds; in this slice it holds its whole plan.

**Changes**

- **`a-session-belongs-to-its-plan`**. A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the session already running, so a plan can have a planning session and several phases building at the same time.

**Replaces**

None.

### Not promised

- **Two plans sharing a file, and the earlier plan going first** — the next slice (story 2).
- **A fix for a broken promise going first** — a later slice (story 3).
- **Merging the trunk into every open plan as it moves** — a later slice (story 4); landing already merges the trunk.
- **A question holding only its own phase, and holds that free files** — a later slice (story 5); here a held question holds its plan.
- **Seeing the graph, and the activity feed** — `activity-and-graph`.
- **Re-cutting a plan's phases for speed** — phases are cut by judgment when the impl is written.
- **Running on the workbench server** — `workbench-server`; this runs on one machine.

## Looks

None — the runner changes no screen; the phases' states are shown by `a-run-can-be-trusted`'s run records, and seeing the graph is `activity-and-graph`'s.

## Depends On

- `.indusk/planning/a-run-can-be-trusted/` — landed: run records, truthful states.
- `.indusk/planning/decisions-as-questions/` — landed: questions that hold.

## Blocks

- The later slices of run-the-graph, and `activity-and-graph`.
