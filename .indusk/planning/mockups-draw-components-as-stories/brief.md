---
title: "Mockups draw components as their stories do"
date: 2026-10-17
status: accepted
workflow: bugfix
description: "A component placed in a mockup is drawn exactly as its story draws it — the same colours, fonts and spacing — and every story fits its frame. Fixes the two open incidents the release's slow tests raised on 2026-10-16."
---

# Mockups draw components as their stories do — Brief

The background and findings are in [research.md](research.md). This plan
closes `i-2026-10-16-mockups-render-in-the-cockpit` and
`i-2026-10-16-a-mockup-composes-approved-components`; both stay open until it
lands.

## Expectations

1. **A person approving a mockup sees the components as they will be built.**
   - Measure: the composition check (`composition.contract.test.ts`) reports no component drawn differently in a mockup than in its story, at each release's slow tests
   - Look: at the next three releases

## Promises

### This plan makes

None — the promise this plan keeps already exists; its sentence changes to say more.

### Existing promises

**Must not break**

- **`a-mockup-composes-approved-components`**. The fix changes the styles a composed mockup loads; a mockup still shows a component only by naming it.

**Changes**

- **`mockups-render-in-the-cockpit`**. Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens and, where it names components, with each component drawn as its own story draws it, and each story fitted to its frame, with nothing to run beside the cockpit.

**Replaces**

None.

### Not promised

- Approving looks again. The approved mockups do not change; they start drawing their components as approved. Re-approval is a person's call if one now looks different from what they approved.

## Looks

### This plan makes

None.

### Existing looks

**Must not break**

- **`home.default`**. Its project cards draw in the card's ink, not link blue, with the card's own spacing.
- **`new-project.start`**. Its prompt box's text area draws in the foundation's text font.
- **`new-project.no-parent`**. The same prompt box.

**Changes**

- **`message.you`**. Long unbroken text wraps inside the bubble instead of widening it; the approved story stays held until a person approves the new one.

**Replaces**

None.

## Depends On

- `plan/storybook-components` landed: its Maintenance holds the composition check's and the story-frame check's test fixes this plan is measured by.

## Blocks

- Closing `i-2026-10-16-mockups-render-in-the-cockpit` and `i-2026-10-16-a-mockup-composes-approved-components`.
