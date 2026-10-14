---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: draft
workflow: feature
description: "Every look a plan names opens on the plan's own page, a story as well as a mockup. When a mockup and a story share a name, both are shown, each with its own state, so a mockup waiting for approval never reads as approved."
---

# A plan's page shows all its looks — Brief

## Expectations

1. **Sandy looks at every look of a plan from its plan page, without opening the Looks page.**
   - Measure: Sandy's word at the next three plans that name looks; a trip to the Looks page only to see a look counts against it
   - Look: at each of the next three plan approvals that name looks

## Promises

### This plan makes

1. **`every-look-opens-on-its-plan-page`** (state). Every look a plan's brief names opens on the plan's own page, a story as well as a mockup, without going to the Looks page.
2. **`a-mockup-and-its-story-show-apart`** (state). When a mockup and a story share a name, the plan's page shows both, each with its own state, so a mockup waiting for approval never reads as approved.

### Existing promises

**Must not break**

- **`a-look-has-the-plan-that-owns-it`**. The plan page's looks change; each approved look still records the plan that made it, and that plan's page still shows its looks beside its promises.
- **`a-plan-page-shows-the-parts-of-its-brief`**. The Looks part changes beside the promises and expectations it sits with.

**Changes**

None.

**Replaces**

None.

### Not promised

- Approving a look from the plan page. Approval stays on the Looks page, one click from the plan page, unless Sandy asks for it to move.

## Looks

### This plan makes

1. **`plan-look.pair`**. A mockup and its story with the same name, shown as two rows on the plan page, the mockup proposed and the story approved.
2. **`plan-look.story-open`**. A story opened in place on the plan page, drawn at the app's devices, with a link to the Looks page.

### Existing looks

**Must not break**

- **`plan.parts`**. The plan page's parts; the Looks part holds the rows above.
- **`look-row.mockup`**. The row a mockup is drawn with; unchanged.
- **`look-row.story`**. The row a story is drawn with; unchanged.

**Changes**

None.

**Replaces**

None.

## Depends On

- None.

## Blocks

- `.indusk/planning/story-first-phases/` — its look `phase-row.open` is approved more easily once its plan page shows the redrawn mockup.
