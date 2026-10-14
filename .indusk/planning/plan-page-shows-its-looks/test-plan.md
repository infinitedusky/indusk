---
title: "A plan's page shows all its looks — Test Plan"
date: 2026-10-14
status: accepted
---

# A plan's page shows all its looks — Test Plan

## Purpose

The behavioural assertions that, taken together, mean a plan's page shows its
looks in two sections, the mockups it proposes and the stories it built, each
opening in place; that an earlier plan's build of a component appears only as
a labelled comparison inside the mockup that changes it; and that a mockup
added after approval says so. Grouped by the promise in the brief each proves;
each becomes a row of the impl's Test Trajectory.

## Behavioral Assertions

### `every-look-opens-on-its-plan-page` — Every look a plan's brief names opens on the plan's own page, a story as well as a mockup, without going to the Looks page.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Opening a story in a plan's Stories section draws it in place, at each of the app's devices, with no message sending the person to the Looks page. | unit |
| A2 | Every mockup and every story the plan's page lists comes with a page it can draw. | unit |
| A3 | A look the brief names that is drawn nowhere still reads "not drawn yet" when opened. | unit |

### `a-plan-shows-only-its-own-stories` — A plan's page lists only the stories that plan built; a component the plan changes shows its current build only inside its mockup, labelled as the earlier plan's build for comparison, never as this plan's story or with an approval state.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | For a plan that changes an existing component, the plan's Stories section is empty while the component's story is still the earlier plan's approved build. | unit |
| A5 | Once the plan's build changes that component, its new story appears in the plan's Stories section, waiting for approval. | unit |
| A6 | The changed component's mockup carries a "Compare with today's build" fold; opened, it draws the current build labelled with the plan that built it, and shows no approval state or approve link. | unit |
| A7 | The Mockups count reads the plan's mockups only: a waiting mockup for a changed component reads waiting, whatever the old story's state. | unit |
| A8 | story-first-phases' plan page, on its own branch, shows its redrawn phase row as a waiting mockup with today's build in the comparison fold, and an empty Stories section. | live check |

### `a-look-added-after-approval-says-so` — A mockup added to a plan's brief after the plan was approved is marked on the plan's page as added during the build, with its date.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | A mockup named in the brief at approval carries no "added" mark. | unit |
| A10 | A mockup added to the brief after approval carries "Added during build" and the date of the commit that added it. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A11 | The three states of the Looks part drawn from the real component match the mockups Sandy approved. | live check | the looks this plan makes, held by their approval in the cockpit |

## Notes

- The brief page draws a plan's looks with the same component as the plan page (`PlanParts`), so it needs no assertion of its own.
- Approving stays on the Looks page; each waiting row keeps its link there.
