---
title: "Bookkeeping lives where it is read — Test Plan"
date: 2026-10-07
status: accepted
---

# Bookkeeping lives where it is read — Test Plan

## Purpose

What must be true for InDusk's records to leave every checkout clean and be
processed once. Grouped by the promise each proves.

## Behavioral Assertions

### `indusk-leaves-main-clean` — Nothing InDusk writes is left uncommitted in any checkout: notes people read, `current.md` and lessons, are committed to `main` when written, and machine state lives in one place per project, outside every checkout.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A session's note written from a plan's worktree lands in the main checkout's `current.md` and is committed on `main`; neither checkout is left with an uncommitted change. | unit |
| A2 | A lesson added from a plan's worktree is written to the main checkout's lessons and committed on `main`. | unit |
| A3 | A highlight, its processed mark and an evaluation's results are written under the project's home outside the repository, the same home from every checkout of the project; none appears in `git status`. | unit |
| A4 | When the main checkout is not on its trunk branch, or is mid-merge, a note is still written there, left uncommitted, and the writer says why; nothing is committed onto another branch. | unit |
| A5 | Two notes written at the same moment are both committed, neither lost. | unit |
| A6 | Upgrading a project moves its tracked highlights into the project's home, unprocessed ones kept, and takes them out of git. | unit |

### `a-highlight-becomes-a-lesson-once` — A highlight is turned into a lesson at most once per project, whichever checkout the evaluator runs in.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A highlight processed by an evaluation of a commit in one plan's worktree is not offered again to an evaluation in the main checkout or another worktree. | unit |
| A8 | A real evaluator run on a commit in a plan's worktree writes its lesson on `main` and marks the highlight processed in the project's home. | contract |

### Existing promises — kept

| ID | Assertion (user-visible behavior) | Level | For |
|----|-----------------------------------|-------|-----|
| A9 | Landing still refuses a plan when `main` has uncommitted work that is not InDusk's, and the review still lists it. | unit | nothing-ships-until-accepted, a-review-shows-its-evidence |
| A10 | Every commit is still scored, its result readable where the admin and `indusk eval` look. | unit | every-commit-evaluated |
