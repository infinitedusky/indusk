---
title: "The nav says where a plan is"
description: "A plan's row in the admin nav names the same step its page shows; it reads Released only once a release has shipped it, and Closed once the plan is archived without one. Today a plan whose build is done but which has not been falsified or released reads 'completed' in the nav while its page says it is at Falsify."
date: 2026-10-16
status: accepted
workflow: bugfix
---

# The nav says where a plan is — Brief

## Expectations

1. **No plan's row in the nav disagrees with its page.**
   - Measure: Sandy reads the nav against the page of each plan between its build and its release; any row that reads differently is reported.
   - Look: the next plan that finishes its build and reaches `/falsify`.

## Promises

### This plan makes

1. **`the-nav-says-where-a-plan-is`** (state). A plan's row in the nav names the same step its page shows; it reads Released only once a release has shipped it, and Closed once the plan is archived without one.

### Existing promises

**Must not break**

- **`a-master-plan-tells-its-story`**. A master plan's page shows how far along each of its plans is, through the same stage the nav row shows, so it changes with it.
- **`decisions-wait-in-one-place`**. A plan waiting on the person still reads as needing them, ahead of whatever step it is at.
- **`paths-keep-their-order`**. A Path's count of released plans is unchanged; only the words under each plan change.

**Changes**

None.

**Replaces**

None.

### Not promised

- The row's layout (the stage and the worktree chip on separate lines): that is the `nav-row-legible` plan's look.
- Keeping the impl's `status:` field itself accurate. The field stays what `/work` writes; the nav stops reading "finished" from it.

## Looks

None — the row's words change, never its layout or styling; the layout is the `nav-row-legible` plan's.

## Depends On

- None.

## Blocks

- None. `nav-row-legible` touches the same nav row; whichever lands second merges over the other.
