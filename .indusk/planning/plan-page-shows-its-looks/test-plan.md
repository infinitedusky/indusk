---
title: "A plan's page shows all its looks — Test Plan"
date: 2026-10-14
status: accepted
---

# A plan's page shows all its looks — Test Plan

## Purpose

The behavioural assertions that, taken together, mean a person can look at
every look a plan names from the plan's own page, and that a mockup waiting
for approval never reads as approved there because a story shares its name.
Grouped by the promise in the brief each proves; each becomes a row of the
impl's Test Trajectory.

## Behavioral Assertions

### `every-look-opens-on-its-plan-page` — Every look a plan's brief names opens on the plan's own page, a story as well as a mockup, without going to the Looks page.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Opening a story on a plan's page draws the story in place, at each of the app's devices, and no longer says to open it on the Looks page. | unit |
| A2 | Every drawn look in a plan's list of looks, story or mockup, comes with a page the plan page can draw. | unit |
| A3 | A look the brief names that is drawn nowhere still reads "not drawn yet" when opened. | unit |

### `a-mockup-and-its-story-show-apart` — When a mockup and a story share a name, the plan's page shows both, each with its own state, so a mockup waiting for approval never reads as approved.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A brief naming a look that is both a mockup and a story lists two looks under that name, one of each kind, each with its own approval; a proposed mockup beside an approved story reads proposed. | unit |
| A5 | The Looks part's count on the plan page counts the waiting mockup as waiting: one proposed mockup and one approved story read "1 of 2 approved". | unit |
| A6 | story-first-phases' plan page, on its own branch, shows its redrawn phase row's mockup as proposed and its story as approved, as two rows. | live check |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A7 | The two plan-look states drawn from the real component match the mockups Sandy approved. | live check | the looks this plan makes, held by their approval in the cockpit |

## Notes

- The brief page draws a plan's looks with the same component as the plan page (`PlanParts`), so it needs no assertion of its own.
- Approving from the plan page is not promised; the plan page keeps its link to the Looks page for that.
