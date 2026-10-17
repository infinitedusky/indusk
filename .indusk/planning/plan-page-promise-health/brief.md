---
title: "A promise reads the same on its plan's page"
date: 2026-10-17
status: accepted
workflow: bugfix
clauses: required
description: "A plan's page and its brief page colour each promise by its health, from the same rule the Promises page and the nav use, so a promise that broke never shows as healthy on the page of the plan that owns it."
---

# A promise reads the same on its plan's page — Brief

## Expectations

1. **A promise that reads broken on the Promises page or the nav never looks healthy on its plan's page.**
   - Measure: the next time a behaviour promise breaks, its dot on the owning plan's page and brief page is the broken colour, as it is on the Promises page.
   - Look: at the next break of any behaviour promise.

## Promises

### This plan makes

1. **`a-promise-reads-the-same-on-its-plan-page`** (state). A plan's page and its brief page colour each of the plan's promises by the same health the Promises page shows for it, read from the same rule.
   - **`broken-reads-broken`** (split). A behaviour promise with a break that is still live has the broken colour on its plan's page and its brief page.
   - **`each-health-alike`** (split). A promise that broke and was fixed, one seen holding, one with no signal and one known broken each have on those pages the colour the Promises page gives them, and a promise with no signal is never green.
   - **`no-rule-of-its-own`** (limit). The plan's page and its brief page decide no health themselves; they read it from the package's health rule, from the source the nav's red dot reads.

### Existing promises

**Must not break**

- **`a-plan-page-shows-the-parts-of-its-brief`**. The promises part is the one this plan recolours; its description, expectations and looks are untouched.
- **`a-promise-is-upheld-or-broken`**. The plan page's dots take the same words and colours the Promises page uses: broken, broke and fixed, holding, no signal.

**Changes**

None.

**Replaces**

None.

### Not promised

- Showing the health's word beside each dot on the plan page: the dot's colour is enough, and a word would change the approved look.
- A state or structure promise's dot: telemetry says nothing about them, so they keep the colour of their registry state, as on the Promises page.

## Looks

### This plan makes

None.

### Existing looks

**Must not break**

- **`brief.approved`**. The promise chips keep their markup; only which foundation colour a dot takes changes.
- **`brief.writing`**. Same chips, same markup.
- **`plan.master`**. Same chips, same markup.

**Changes**

None.

**Replaces**

None.

## Depends On

- None.

## Blocks

- None.
