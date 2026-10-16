---
title: "A finished ritual stays done"
description: "On a plan's page, Falsify, Cleanup and Audit read done once each has been finished, and keep reading done when a later build phase (an audit follow-up, say) sends the plan back to building."
date: 2026-10-16
status: accepted
workflow: bugfix
---

# A finished ritual stays done — Brief

## Expectations

None — a defect in what a step list says about work already done; whether it reads right is seen on a plan's page, not measured afterwards.

## Promises

### This plan makes

1. **`a-finished-ritual-stays-done`** (state). A plan's Falsify, Cleanup and Audit steps read done once their ritual is finished (its phase closed or its audit written; a ritual skipped with a reason reads skipped, with that reason, not done), and keep reading done when a later build phase reopens the plan to building.

### Existing promises

**Must not break**

- **`a-plan-shows-two-workflows`**. Every step's state is still read from the plan's documents and phases, never set by hand; a ritual's step is still current while that ritual is being worked and not-yet before it starts.
- **`the-nav-says-where-a-plan-is`**. The nav's stage still names the step the plan is at, which is Build while an audit follow-up is being built.

**Changes**

None.

**Replaces**

None.

### Not promised

- A ritual re-run after the plan was reopened (a second falsification phase added, say) reading current again: that is a new piece of work, and the step reads current while it is open.
- The Review and Release steps. Their order does not move when a build phase reopens, and nobody has seen them wrong.

## Looks

None — the plan page and the nav already draw a done step; this changes which steps read done, not how anything is drawn.

## Depends On

- None.

## Blocks

- None.
