---
title: "Plans in worktrees show their progress — Test Plan"
date: 2026-09-18
status: accepted
---

# Plans in worktrees show their progress — Test Plan

## Purpose

These are the things that must be true for a plan worked in its worktree to
show its real progress, from wherever you look. Each names how it is tested.
They become the impl's Test Trajectory.

Fixtures are real: a temporary git repository with a real `git worktree add`,
because the bug is about which checkout gets read, and a fixture without a
second checkout cannot show it.

## Behavioral Assertions

### Seeing the live copy

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A1 | While a plan is assigned to a worktree, an item checked off in the worktree shows as done on the admin's plan page for the project, on the next refresh. | vitest HTTP (next-dev helper), temp repo with a real worktree |
| A2 | The plan page names the worktree it is reading from. | vitest HTTP |
| A3 | The sidebar row for an assigned plan names its worktree. | vitest HTTP |
| A4 | The active phase shown for an assigned plan is the phase opened in the worktree, not the trunk's. | vitest HTTP |
| A5 | Asked at the trunk, `list_plans`, `get_plan_status` and `advance_plan` report the worktree's state for an assigned plan. | vitest integration, the MCP tools against a temp repo |
| A6 | Asked from inside a worktree, the plan list and each plan's state are the same as asked from the trunk. | vitest integration |
| A7 | A plan with no assignment reads exactly as it does today. | vitest integration + HTTP (regression guard) |

### Making and ending an assignment

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A8 | `indusk worktree create <plan>` creates the worktree and the plan immediately reads from it. | vitest CLI (`runCli`), temp repo |
| A9 | `indusk worktree assign <plan> <worktree>` assigns a worktree made by hand, and the plan reads from it. | vitest CLI |
| A10 | Assigning a second live worktree to a plan that already has one is refused, naming both, and nothing changes. | vitest CLI |
| A11 | Assigning a path that is not a worktree of this repository, or a plan name with no plan folder, is refused by name. | vitest CLI |
| A12 | `indusk worktree release <plan>` ends the assignment and the plan reads from the trunk again. | vitest CLI |
| A13 | Making, reading or ending an assignment leaves `git status` clean in every checkout: the record is never part of the working tree. | vitest CLI |

### Nothing is guessed

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A14 | When an assigned worktree has been removed without a release, the plan page and `get_plan_status` say the assigned worktree no longer exists, and show the trunk copy. | vitest HTTP + integration |
| A15 | A worktree of the repository with no assignment is listed in the admin as unassigned. | vitest HTTP |
| A16 | A malformed assignment record shows as an error naming the file, in the admin and from the MCP tools; no plan is silently read from the wrong copy. | vitest HTTP + integration |
| A17 | If the record holds two live assignments for one plan (written by hand), the plan shows an error naming both rather than picking one. | vitest integration |

### The lifecycle

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A18 | The work skill's kickoff creates the plan's worktree with `indusk worktree create <plan>`, and the retrospective's landing step runs `indusk worktree release <plan>` after the merge and before the worktree is removed. | vitest text pin on the package-owned skills; each documented command run verbatim once |
| A19 | This plan's own progress is visible in the admin while it is worked in its worktree, and it reads from the trunk after its own landing. | manual smoke (dogfood), recorded in the retrospective |

## Untestable Assertions

None. The one behaviour only a person can judge, whether the worktree name
is noticeable enough on the page, is covered by A19's dogfood.

## Notes

- A1–A4, A14–A16 boot `next dev` through the admin's `next-dev.ts` helper,
  one at a time, as the existing HTTP tests do.
- A8 runs the worktree extension's real create script, so it needs `jq` and
  git on the machine, as its existing tests already do.
- A6 is the check that the resolver finds the project from any checkout, not
  only from the one the admin has registered.
