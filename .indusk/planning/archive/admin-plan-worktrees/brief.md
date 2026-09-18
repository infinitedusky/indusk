---
title: "Plans in worktrees show their progress"
date: 2026-09-18
status: accepted
---

# Plans in worktrees show their progress — Brief

## Problem

Every plan is worked in its own worktree, on its own branch. The admin UI
and the MCP plan tools read plans only from the project's trunk checkout, on
`main`. So the plan being worked is the one plan whose progress never shows:
its checkoffs, trajectory states and active phase all live in the worktree
until it merges. Observed on day-promises: the admin said "impl approved,
awaiting /work" while Build Phase 1 was executing, and `advance_plan` reported
the trunk copy's unchecked items.

Registering the worktree as a second project was tried and rejected. The
project is dusk. A worktree is where one of its plans is being worked.

## Proposed Direction

**A plan is assigned to a worktree by a written record, made by the InDusk
command that creates the worktree.** Not by matching names. There can be many
copies of a plan, one per checkout, and the record says which one is live.

- **Who writes it.** `indusk worktree create <plan>` records the assignment
  when it creates the worktree: plan, worktree path, branch, time. A new
  `indusk worktree assign <plan> <worktree>` covers a worktree made any other
  way, and `release` ends an assignment. Nothing else writes it.
- **When it ends.** At the retrospective's landing step: merge the branch
  into trunk, then `indusk worktree release <plan>`, then remove the worktree
  and delete the branch. After release the plan reads from trunk, which now
  holds the merged work. A worktree removed without a release is the "worktree
  gone" case below: it is shown, not silently absorbed.
- **Where it lives.** In the repository's shared git directory
  (`git rev-parse --git-common-dir`), beside the worktree extension's existing
  `indusk-overlay-state.json`. That directory is common to the trunk and every
  worktree of this clone, so every checkout reads the same record. It is
  per-machine, like the worktrees it describes, and never committed, so a
  path that exists only on one machine never reaches another.
- **How it is read.** One resolver in the MCP package answers "where is plan
  X's live copy." It checks each assignment against git's own worktree list
  at read time. The admin and the MCP plan tools both read through it. For an
  assigned plan, its documents and the phase-boundary record come from the
  worktree.
- **Nothing fails quietly.** Each case the resolver can meet is shown, never
  guessed:

  | Case | What you see |
  |---|---|
  | Assigned, worktree exists | Read from the worktree; the worktree is named |
  | Assigned, worktree gone | Read from trunk, with "assigned worktree `x` no longer exists" |
  | Two live assignments for one plan | Refused when written; an error block if found |
  | A worktree with no assignment | Listed as unassigned, so it is visible |
  | No assignment | Read from trunk, as today |

The UI names the worktree on the plan page header and in the sidebar, so it
is always clear which copy you are looking at.

## The alternatives, and why not

- **Match the worktree or branch name to the plan name.** Rejected
  (Sandy, 2026-09-18: "a bug waiting to happen"). There are already two
  conventions: `indusk worktree create` names the branch after the bare slug,
  while every plan worktree so far was made by hand as `plan/<name>`. When a
  name does not match, the plan silently shows its trunk copy and nothing says
  a live copy exists.
- **Declare it in the plan's impl frontmatter.** The frontmatter is itself one
  of the copies. The trunk's would have to be edited while the work happens in
  the worktree, and a committed path is wrong on every other machine.

## Context

- The admin reads plans with its own reader (`apps/indusk-admin/src/lib/planning-reader.ts`);
  the MCP tools read with `parseAllPlans` / `parsePlan`
  (`apps/indusk-mcp/src/lib/plan-parser.ts`). Both are rooted at the trunk.
- `git worktree list --porcelain` is already parsed in
  `apps/indusk-mcp/src/lib/worktree/decision.ts` (main-tree detection), and
  `lib/worktree/layout.ts` already asks git for `--git-common-dir`.
- `indusk worktree create <slug>` runs the worktree extension's
  `setup-worktree.sh`, which names the branch `<slug>`. Every plan worktree so
  far was made by hand as `plan/<name>`, which is why merges read
  `Merge plan/<name>`.
- `dusk-worktrees/` holds three leftover folders git no longer knows about
  (`day-promises`, `hook-cwd-independence`, `writing-skill`). Scanning folders
  would show them as live; git's list does not.

## Scope

### In Scope
- The assignment record, written by `indusk worktree create <plan>`, `assign`
  and `release`, stored in the shared git directory.
- One resolver: plan name → live copy, checking the record against git's
  worktree list, reachable from any checkout of the project.
- The admin's plan list, plan page and live refresh read through it,
  including the phase-boundary record.
- `list_plans`, `get_plan_status` and `advance_plan` read through it.
- The admin shows the worktree name on the plan page and in the sidebar.
- Every case in the table above is shown, never guessed.
- The retrospective skill's landing step releases the assignment between the
  merge and the worktree removal; the work skill's kickoff creates the
  worktree through `indusk worktree create <plan>` so the assignment is made.

### Out of Scope
- Plans that exist only in a worktree and never on trunk. Planning happens
  on trunk (plan documents are allowed there) and the worktree opens at the
  kickoff, so today every plan has a trunk folder. Revisit if that changes.
- The promise registry and incidents: they are project-level, read from the
  trunk.
- Cleaning up the leftover worktree folders (noted, not fixed here).
- Other repositories' worktrees in a multi-repo workbench.

## Success Criteria
- While a plan is worked in its worktree, the admin's bars move with each
  checkoff, within one refresh.
- The plan page says which worktree it is reading from.
- `advance_plan` and `get_plan_status` on trunk report the worktree's state.
- After merge and worktree removal, the plan reads from trunk again with no
  change needed.
- Asking from inside a worktree shows the same plans as asking from trunk.
- A plan whose assigned worktree was removed says so rather than silently
  showing trunk.

## Depends On
- None. day-promises is closed and landed.

## Blocks
- Every plan after it, in that its progress is invisible until this lands.
