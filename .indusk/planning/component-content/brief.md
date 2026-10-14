---
title: "Component content"
date: 2026-10-13
status: accepted
workflow: feature
description: "A mockup places an existing component with the words it needs — a button reading \"Create project\" — instead of showing the story's fixed text, so a screen can be made of components alone."
---

# Component content — Brief

Background and findings are in [research.md](research.md).

## Expectations

1. **new-project-flow's screens draw nothing but their declared new components.**
   - Measure: `indusk looks lint admin` on new-project-flow's five screen mockups, with buttons, steps and containers placed by name, reports no component drawn in a mockup.
   - Look: when this plan lands, after new-project-flow is built (Sandy, 2026-10-13: new-project-flow goes first; this plan then converts its screens).

## Promises

### This plan makes

1. **`a-placed-component-shows-its-content`** (state). A mockup places a component together with the words it needs, and shows the approved component with those words in place of the story's.

2. **`placed-content-is-only-words-and-components`** (state). What a mockup puts inside a placed component is text or other components placed by name; anything else is refused, so content never restyles a component or carries a drawing back in.

### Existing promises

**Must not break**

- **`a-mockup-composes-approved-components`**. Components still appear only by name; content adds words, not drawing.
- **`a-changed-component-reopens-its-mockups`**. A changed component still reopens every mockup that uses it, whatever words it holds.
- **`a-mockup-is-approved-by-a-person`**. The words are part of the mockup, so approving the mockup approves them.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Content in the live app check.** The built app's words come from its code; `looks check` keeps comparing tokens and elements, not text.

## Looks

None — this changes how mockups are composed, not any screen of the admin; no file under the admin's interface sources changes.

## Depends On

None.

## Blocks

None. new-project-flow is built first with its buttons, steps and containers drawn inline; this plan then converts them.
