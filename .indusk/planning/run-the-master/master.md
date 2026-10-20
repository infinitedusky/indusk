---
title: "Run the master"
description: "A master plan runs itself: its phases run in parallel as a graph, decisions arrive as questions with a cost, and a person sees the work as an activity feed and a graph."
date: 2026-10-16
status: living
subplans:
  - run-the-graph
  - decisions-as-questions
  - plans-share-files
  - fixes-go-first
  - the-trunk-cascades
  - holds-free-phases
  - activity-and-graph
---

# Run the master

A child of [promise-core](../promise-core/master.md), second after `mark-first`
in its order; what a plan is and how its phases branch are in that master's
"Settled 2026-10-14/15" section (revised 2026-10-16). Split into three plans on
2026-10-16 (Sandy) by the rule that promises sharing code share a plan: the
runner, the questions and the views touch different code. Its first master to
run is Homework Gate's milestones.

## Children, in order

1. **`run-the-graph`** — sliced 2026-10-19 (Sandy) after two cold reads of the
   full design found twenty-odd problems each. **Slice 1, `run-the-graph`:** a
   plan's own phases run in parallel by declared dependencies, each on its own
   branch off the plan's, merged in only when green. The later slices, one plan
   each, from the stories in run-the-graph's brief (full design at commit
   `0842d3fdf`): **`plans-share-files`** (two plans' phases take turns on a
   file, the earlier plan first, and the later lands after the work it pulled);
   **`fixes-go-first`** (a fix for a broken promise gets the next session, and
   phases touching its files wait for it); **`the-trunk-cascades`** (every open
   plan merges the trunk as it moves, conflicts resolved by an agent or asked);
   **`holds-free-phases`** (a question or a conflict holds one phase, frees its
   files, and the held phase catches up). No screen.
2. **`decisions-as-questions`** — every decision a question in one thread,
   carrying the agent's recommendation and a cost: cheap proceeds after five
   minutes, moderate after an hour, expensive waits, red. An unanswered
   question blocks only the phases downstream of it.
3. **`activity-and-graph`** — two top-level pages for now: Activity (a
   scrolling feed beside broken promises, open decisions and phases in run
   order) and Graph (plans and phases as nodes, a broken clause red, what rests
   on it dimmed); where they sit is a later conversation. Looks:
   its mockups are drawn at its brief, briefed right after `run-the-graph`'s so
   they are drawn while the runner builds (Sandy, 2026-10-16).

Built after `mark-first` (Signal first); briefed now (Sandy, 2026-10-16).
