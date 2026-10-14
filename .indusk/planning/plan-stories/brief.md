---
title: "Plan titles and stories"
description: "Every plan is shown by a short title a person would say, with its description beside it, instead of its folder name. A master plan's page tells its story: what it is for, then each of its plans in order, what each does and how far along it is."
date: 2026-10-14
status: draft
workflow: feature
---

# Plan titles and stories — Brief

## Expectations

1. **Sandy can tell what a master plan is doing from its page alone.**
   - Measure: Sandy reads the Day and Dawn master pages and says whether each one's purpose and progress were clear without opening a subplan
   - Look: at the build's review, and again a week after landing

2. **No plan in flight is shown by its handle.**
   - Measure: the number of plans that are not archived with no title written, read from their briefs and masters
   - Look: at landing, and after the next three plans start

## Promises

### This plan makes

1. **`a-master-plan-tells-its-story`** (state). A master plan's page says what the master is for, then lists each of its plans in the declared order by title, with its description and how far along it is.

### Existing promises

**Must not break**

- **`every-plan-is-one-click-away`**. The nav's rows change from handles to titles; every active plan stays one click away.
- **`paths-keep-their-order`**. Paths and their plans keep the project's order and nesting under their new titles.
- **`decisions-wait-in-one-place`**. A plan waiting only on an amendment is listed under Needs you, as its own page already says it waits.
- **`the-nav-fits-a-phone`**. Titles are longer than handles; the drawer still fits a phone.
- **`a-plan-page-shows-the-parts-of-its-brief`**. The plan page still opens with the description, now under the title.

**Changes**

- **`a-plan-reads-by-its-title`**. Wherever InDusk names a plan, in the admin and in the editor, it shows the plan's title, a short name written in its brief or master, and its description is a separate field; a plan with no title written reads as its handle turned into words.

**Replaces**

None.

### Not promised

- Titles for archived plans — left as they are for now (Sandy, 2026-10-14); they read as their handle turned into words.
- Closing, archiving or merging the plans the audit flagged (`release-preconditions`, `indusk-release`, `jev-decision-model`, the overlaps) — each is Sandy's call, outside this plan.

## Looks

### This plan makes

1. **`plan.master`**. A master plan's page: its title and what it is for, then each of its plans in order, each with its title, description and stage, the ones not yet started shown as queued.
2. **`story-row.released`**. A new component, one plan in a master's story: its number, mark, title, description and "Released", a link to the plan.
3. **`story-row.draft`**. The same row for a plan in draft or being built, a link to the plan.
4. **`story-row.queued`**. The same row, dimmed, for a plan not yet started: "Queued", no link.

### Existing looks

**Must not break**

- **`nav.collapsed`**. The folded nav shows marks, not names.

**Changes**

- **`nav.expanded`**. Every plan and Path reads by its title.
- **`nav.wide`**. The same, dragged wider.
- **`plan.parts`**. The page's heading is the plan's title.
- **`plan.working`**. The page's heading is the plan's title.
- **`plan.needs-you`**. The page's heading is the plan's title.
- **`plan.released`**. The page's heading is the plan's title.

**Replaces**

None.

## Depends On
- `.indusk/planning/archive/cockpit-redraw/` — landed 2026-10-14; the nav and plan pages this retitles.

## Blocks
- None.
