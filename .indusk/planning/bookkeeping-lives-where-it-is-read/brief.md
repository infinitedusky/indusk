---
title: "Bookkeeping lives where it is read"
date: 2026-10-07
status: draft
workflow: feature
---

# Bookkeeping lives where it is read — Brief

*Opened 2026-10-06 at admin-plan-authoring's live check; rewritten
2026-10-07 after it blocked three more steps and the evaluator wrote each of
three lessons three times. Background, findings and decisions are in
[research](research.md).*

## Expectations

1. **No one has to decide whether InDusk's files are theirs.**
   - Measure: no `plans approve`, `plans land` or `pnpm release` refuses on, or has to commit, a file InDusk wrote.
   - Look: across the next three plans that land.
2. **No duplicate lessons.**
   - Measure: each highlight produces at most one lesson file.
   - Look: two weeks after this lands.

## Promises

### This plan makes

1. **`indusk-leaves-main-clean`** (state). Nothing InDusk writes is left uncommitted in any checkout: notes people read, `current.md` and lessons, are committed to `main` when written, and machine state lives in one place per project, outside every checkout.
2. **`a-highlight-becomes-a-lesson-once`** (state). A highlight is turned into a lesson at most once per project, whichever checkout the evaluator runs in.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. Landing still refuses uncommitted work that is not InDusk's.
- **`a-review-shows-its-evidence`**. The review still lists anything uncommitted on `main`.
- **`every-commit-evaluated`**. Every commit is still scored; its results live in the project's new home.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Sharing the machine state across machines.** A second machine starts its own queue.
- **The admin daemon's copy of the port-based stop check** — the bugfix bundle after release-checks-run-once.

## Depends On

- admin-plan-authoring (archived): `lib/plans/bookkeeping.ts` lists InDusk's bookkeeping; approve and land's commit stays as a safety net.

## Blocks

- None.
