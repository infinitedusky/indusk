---
title: "Run the graph"
date: 2026-10-16
status: draft
workflow: feature
clauses: required
description: "An approved plan's phases run in parallel as a graph: each phase on its own branch off its plan's branch, started as soon as what it depends on is done and no running phase touches its files, earlier plans first, so a master finishes in the time of its longest chain rather than the sum of its phases."
---

# Run the graph — Brief

The first child of [run-the-master](../run-the-master/master.md), settled with
Sandy on 2026-10-16 (`promise-core`'s master, "Phases are units of work",
"Earlier plans go first", "Phases branch off the plan"). Today a plan's phases
run one after another in one worktree, one session at a time, and the person
starts each with the command the last one named.

Written in the shape `plans-are-promises` defines (Sandy, 2026-10-16): each
promise stated as clauses. It stays a draft until that plan is built, since its
promises are declared with their clauses (`indusk promises declare --clause`),
which does not exist before then.

## The end state, in stories

Gone through with Sandy one by one (2026-10-19); each promise below comes from
one of these.

1. **You approve a plan, and every phase that can start, starts.** You approve
   a plan with six build phases. Each phase says which other phases it needs.
   Phases 1 and 3 need nothing, so both start the moment you approve. Phase 2
   needs 1, so it starts when 1 finishes. Phase 5 needs 2 and 3, so it starts
   once both are done. Nothing waits on a phase it does not need.

2. **Two plans want the same file.** A phase in `homework-gate-login` and a
   phase in `homework-gate-reports` both need `auth.ts`. The earlier plan's
   phase goes first. The other phase waits until that phase is finished, then
   starts with that phase's work merged in, and its plan lands after the first
   one. Every other phase in both plans keeps running. If two phases interfere
   without sharing a file, the check when each merges into its plan catches it.

## Expectations

1. **A master finishes in about the time of its longest chain of dependent phases, not the sum of its phases.**
   - Measure: for Homework Gate's first milestone, the time from its first plan's approval to its last plan's landing, against the sum of its phases' own durations and against its longest dependent chain, read from phase start and end times.
   - Look: when that milestone's last plan lands.
2. **Merging at phase boundaries rarely needs a person.**
   - Measure: of the merges the runner makes (phase start, phase into plan, main cascade, before landing), the share that conflicts, and of those the share an agent resolved with the plan's tests passing, read from the runner's record.
   - Look: after the first twenty phases run in parallel.

## Promises

### This plan makes

1. **`the-work-runs-as-a-graph`** (behaviour). Every phase whose dependencies are done and whose files no running phase touches is running, up to the session cap, and no phase waits on one it does not depend on.
   - **`ready-phases-start`** (split). A phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room; setting up its worktree is the phase's own time.
   - **`no-needless-wait`** (limit). No phase is held back by a phase it neither depends on nor shares a file with.
   - **`graph-is-current`** (limit). When a phase ends, a plan is approved or a plan lands, the graph is read again before any next phase starts.
   - **`within-the-cap`** (rests on `sessions-are-capped`).
   - **`reviews-are-phases`** (limit). The phases falsify, cleanup, the audit and an incident write are build phases of the graph like any other, with the same dependencies, files and order; the steps that write them are not phases (Sandy, 2026-10-16).
2. **`a-phase-builds-on-its-own-branch`** (state). Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches main, once its promises are verified.
   - **`own-worktree`** (limit). Every running phase has its own worktree and branch, cut from its plan's branch.
   - **`starts-from-its-dependencies`** (limit). A phase starts with every finished phase it depends on merged into its worktree.
   - **`starts-from-the-work-it-waited-for`** (limit). A phase that waited on another plan's phase for a file starts with that phase's finished work merged into its worktree, landed or not.
   - **`green-before-merging`** (limit). A phase merges into its plan's branch only when the check it ends with is green.
   - **`only-the-plan-lands`** (limit). Nothing reaches main from a phase's branch; only a plan's branch, once its promises are verified.
3. **`earlier-plans-go-first`** (state). When phases of different plans are ready and want the same file, the phase of the plan that comes first runs next: earlier in the plan tree, read top-down from the root master through each parent's ordered children; a plan with no place in the tree comes after every plan that has one, and among those the one approved earlier — to go ahead, a plan is given a place (Sandy, 2026-10-16).
   - **`earliest-next`** (limit). Of ready phases that want a file a running phase holds, the earliest plan's runs next when that file is free.
   - **`a-broken-promise-jumps-the-line`** (limit). A phase that fixes a broken promise — a Maintenance phase for an open incident — runs before every other ready phase that wants its files, whatever its plan's place (Sandy, 2026-10-16).
   - **`never-interrupted`** (limit). A running phase is never stopped to let an earlier plan's phase in; the earlier one goes next.
4. **`main-cascades`** (behaviour). When anything lands on main, every open plan's branch merges it, and a running phase's worktree merges it when that phase ends; a conflict is resolved by an agent with the plan's tests as the check, or becomes a question when it cannot be.
   - **`branches-follow-main`** (split). Within five minutes of a landing, every open plan's branch with no running phase has merged it.
   - **`phase-merges-at-its-end`** (limit). A running phase merges main when it ends, before its plan's next phase starts.
   - **`agent-resolves-first`** (limit). A conflicting merge is resolved by an agent and kept only with the plan's tests passing; otherwise it becomes a question naming the files.
5. **`landing-follows-what-it-pulled`** (state). A plan whose phase pulled another plan's unlanded work cannot land before that plan, and merges that work again before it lands.
   - **`lands-after`** (limit). A plan holding another plan's unlanded work is refused landing, naming that plan, until it has landed.
   - **`merges-again-before-landing`** (limit). Before it lands, such a plan merges main with the other plan's landed work in it.

### Existing promises

**Must not break**

- **`sessions-are-capped`**. The graph runs as many phases at once as the cap allows, never more; `the-work-runs-as-a-graph` rests on it.
- **`a-plan-builds-only-after-approval`**. Only an approved plan's phases enter the graph.
- **`a-plan-is-written-on-its-own-branch`**. The plan's branch stays where its build lands from; phases branch off it.
- **`a-plan-boundary-names-the-next-session`**. A phase boundary still names the command for what runs next; the runner runs it.

**Changes**

- **`a-session-belongs-to-its-plan`**. A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the session already running, so a plan can have a planning session and several phases building at the same time.

**Replaces**

None.

### Not promised

- **Decisions as questions with a cost, and blocking only what is downstream of one** — `decisions-as-questions`.
- **Seeing the graph, and the activity feed** — `activity-and-graph`.
- **Re-cutting a plan's phases for speed** — phases are cut by judgment when the impl is written; the runner runs the graph it is given and re-reads it as phases finish.
- **Running on the workbench server** — `workbench-server`; this runs on one machine.

## Looks

None — the runner changes no screen; seeing the graph is `activity-and-graph`'s, briefed next.

## Depends On

- `.indusk/planning/plans-are-promises/` — promises stated as clauses, declared with them, and test rows that name the clause they prove.
- `.indusk/planning/mark-first/` — built after it (Sandy, 2026-10-15).

## Blocks

- `.indusk/planning/decisions-as-questions/` — a question blocks phases of this graph.
- `.indusk/planning/activity-and-graph/` — it draws this graph.
