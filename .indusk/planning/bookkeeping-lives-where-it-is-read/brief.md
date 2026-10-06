---
title: "Bookkeeping lives where it is read"
date: 2026-10-06
status: draft
workflow: feature
---

# Bookkeeping lives where it is read — Brief

*Opened at admin-plan-authoring's live check (Sandy, 2026-10-06). The
unattended release met InDusk's own notes uncommitted on `main` and had to
decide what to do with them. Two rules collided: a session never commits work
that is not its own, and a plan does not land onto a dirty trunk. Sandy: "it
is crazy that we have conflicting rules like this that I need to think about
now." admin-plan-authoring's Build Phase 10 handles the symptom: `plans
approve` and `plans land` commit the bookkeeping, and the review shows
anything else. This plan removes the cause. A draft from that conversation,
to be reworked in the planner's conversation before it is accepted; nothing
is declared.*

## The problem

InDusk writes five kinds of record into the trunk's working tree, and nothing
commits them:

| Record | Written by | Read by |
|---|---|---|
| `.indusk/current.md` | each session's `update_current_section`, from any worktree | every session at catchup; the admin |
| `.indusk/highlights.jsonl` | the working agent's `highlight` | the evaluator |
| `.indusk/highlights-processed.jsonl` | the evaluator | the evaluator |
| `.indusk/eval/` | the evaluator, on each commit | the admin; `eval-review` |
| `.claude/lessons/` | the evaluator's `add_lesson` | every session, every hook that names a lesson |

So `main` is dirty most of the time. Every plan that lands, and every person
who commits on `main`, has to decide whether those files belong to them. A
worktree's session writes the trunk's copy of `current.md`, not its own, so a
plan's notes never travel with its branch.

## Expectations

1. **No one has to decide whether InDusk's files are theirs.**
   - Measure: `git status` on `main` after a session, an evaluation and a
     landing shows nothing InDusk wrote, across the next three plans that
     land.
   - Look: at each of those landings.
2. **A plan's notes travel with the plan.**
   - Measure: what a session wrote about a plan in flight is on that plan's
     branch, and reaches `main` in the plan's merge.
   - Look: the first plan built after this one.

## Direction, to be settled in research

Each record goes where it is read:

- **Shared and read by every session** (`current.md`'s Project region and
  lessons): written to `main` and **committed when written**, in a commit of
  its own, under the file lock `current.md` already uses. The trunk guard
  already allows `.indusk/**` and `.claude/lessons/**` there.
- **Scoped to one plan** (a session's section about a plan in flight, that
  plan's highlights): written in the plan's worktree and carried by its
  branch.
- **Machine state no person reads as a document** (`highlights-processed`,
  `eval/` results): perhaps not in git at all, kept under `~/.indusk/` per
  project. Research must weigh this against why they are versioned today
  (`merge=union` on `current.md`, lessons shared through git).

Strongest argument against: committing on every write creates a lot of
small commits on `main`, and two sessions committing at the same time can
race. Research measures how many writes a day a typical session makes, and
whether the existing lock is enough.

## Promises

### This plan makes

1. **`indusk-leaves-main-clean`** (state). After any InDusk write on `main`,
   nothing InDusk wrote is left uncommitted there.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. Landing still refuses uncommitted work
  that is not InDusk's.
- **`a-review-shows-its-evidence`**. The review still lists anything
  uncommitted on `main`.

**Changes**

None.

**Replaces**

None. When this lands, Build Phase 10's commit at approval and landing finds
nothing to commit; it stays, as a safety net.

### Not promised

- Moving records out of git when research does not show it is safe.

## Depends On

- admin-plan-authoring: `lib/plans/bookkeeping.ts` lists InDusk's bookkeeping
  paths once; this plan uses that list.

## Blocks

- None.
