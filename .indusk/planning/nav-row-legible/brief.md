---
title: "A nav row reads at a glance"
description: "A plan's row in the admin nav stays two lines: the worktree becomes a small mark without text beside the stage, set apart from it, and hovering or clicking it widens it in place to show the worktree's name."
date: 2026-10-16
status: draft
workflow: bugfix
---

# A nav row reads at a glance — Brief

## Expectations

None — a layout fix; whether it reads better is judged when the look is approved, not measured after.

## Promises

### This plan makes

1. **`a-nav-row-keeps-its-parts-apart`** (state). A plan's row in the nav shows its title on one line and its stage on the next, with its worktree as a mark beside the stage and apart from it; hovering or clicking the mark widens it in place to show the worktree's name, without opening the plan.

### Existing promises

**Must not break**

- **`the-nav-fits-a-phone`**. The collapsed nav still shows only each plan's mark; the worktree mark hides with the rest.
- **`paths-keep-their-order`**. Rows keep their order and nesting; only their inside changes.
- **`every-plan-is-one-click-away`**. The plan's title is still one click to its page; the worktree mark is a separate control beside the link, not inside it.

**Changes**

None.

**Replaces**

None.

### Not promised

- The worktree on a line of its own, or a reserved third line on every row (both drawn and declined by Sandy, 2026-10-16): the row stays two lines.
- What the stage says: that is the `nav-stage-matches-plan-page` plan's promise.

## Looks

### This plan makes

1. **`plan-row.worktree`**. Plan rows in the nav: the title, then the stage with a worktree mark beside it on rows that have one, 8 px apart; otherwise identical to the nav today. The second row shows a mark widened to its name.
2. **`worktree-mark.closed`**. The worktree mark on its own: a small bordered glyph, no text.
3. **`worktree-mark.open`**. The worktree mark hovered or clicked: widened in place to show the worktree's name, on the same line.

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
