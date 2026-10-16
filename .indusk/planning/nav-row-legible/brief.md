---
title: "A nav row reads at a glance"
description: "A plan's row in the admin nav puts its title, its stage and its worktree on lines of their own, so the stage and the worktree chip no longer run into each other."
date: 2026-10-16
status: draft
workflow: bugfix
---

# A nav row reads at a glance — Brief

## Expectations

None — a layout fix; whether it reads better is judged when the look is approved, not measured after.

## Promises

### This plan makes

1. **`a-nav-row-keeps-its-parts-apart`** (state). A plan's row in the nav shows its title, its stage and its worktree each on a line of its own, and a plan with no worktree takes no line for one.

### Existing promises

**Must not break**

- **`the-nav-fits-a-phone`**. The collapsed nav still shows only each plan's mark; the extra line hides with the rest.
- **`paths-keep-their-order`**. Rows keep their order and nesting; only their inside changes.
- **`every-plan-is-one-click-away`**. Every row is still one link.

**Changes**

None.

**Replaces**

None.

### Not promised

- A reserved third line on every row for status that does not exist yet (drawn as `plan-row.three-lines` for comparison): a line is added when there is something to put on it.
- What the stage says: that is the `nav-stage-matches-plan-page` plan's promise.

## Looks

### This plan makes

1. **`plan-row.worktree`**. A plan row with a worktree: title, then stage, then the worktree chip on its own line; rows without one stay two lines.

### Existing looks

**Must not break**

- **`nav.expanded`**. The nav composes the row; it should read the same apart from the worktree rows.
- **`nav.collapsed`**. Only the mark shows; the worktree line hides.

**Changes**

None.

**Replaces**

None.

## Depends On

- None.

## Blocks

- None. `nav-stage-matches-plan-page` touches the same nav row; whichever lands second merges over the other.
