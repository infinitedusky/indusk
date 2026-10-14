---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: accepted
workflow: feature
description: "A plan's page shows its looks in two sections, the mockups it proposes and the stories it has built, and every one opens in place. A component the plan changes shows its current build only inside its mockup, labelled for comparison, and a mockup added after approval says so, with the phase that builds it."
---

# A plan's page shows all its looks — Brief

## Expectations

1. **Sandy looks at every look of a plan from its plan page, without opening the Looks page.**
   - Measure: Sandy's word at the next three plans that name looks; a trip to the Looks page only to see a look counts against it
   - Look: at each of the next three plan approvals that name looks

## Promises

### This plan makes

1. **`every-look-opens-on-its-plan-page`** (state). Every look a plan's brief names opens on the plan's own page, a story as well as a mockup, without going to the Looks page.
2. **`a-plan-shows-only-its-own-stories`** (state). A plan's page lists only the stories that plan built; a component the plan changes shows its current build only inside its mockup, labelled as the earlier plan's build for comparison, never as this plan's story or with an approval state.
3. **`a-look-added-after-approval-says-so`** (state). A mockup added to a plan's brief after the plan was approved is marked on the plan's page as added during the build, with the phase that builds it.

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

1. **`plan-looks.planning`**. The plan page's Looks part while a plan is written: a Mockups section, with a changed component's mockup carrying a closed "Compare with today's build" fold, and an empty Stories section.
2. **`plan-looks.compare-open`**. The same, with the fold opened: today's build drawn in place, labelled with the plan that built it, with no approval state.
3. **`plan-looks.building`**. The Looks part during the build: the Stories section holding the story this plan built, waiting for approval, and a mockup marked "Added during build" with the phase that builds it.

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
