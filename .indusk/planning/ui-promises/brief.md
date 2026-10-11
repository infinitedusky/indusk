---
title: "UI promises — mockups as the promises for how an app looks"
date: 2026-10-10
status: accepted
workflow: feature
---

# UI promises — Brief

A second kind of promise, for how an app looks, beside the promises about what
it does: approved mockups built on a defined foundation, covering every part of
the UI, with every token held exactly in the running app. Plan 1 of 2; the
screenshot comparison is [mockup-matching](../mockup-matching/brief.md). Why,
the open-tool survey, reference devices, other platforms and animation are in
[research.md](research.md).

## Expectations

1. **The demo shows a design token broken in the app and caught, and the person watching sees the power.**
   - Measure: the demo-rehearsal take — a change to the app's colour or spacing outside its approved foundation shows broken in the admin, naming the element, the token, and the approved and actual values, with no terminal on screen
   - Look: at demo-rehearsal, the demo's next step

2. **The cockpit is held to its mockup, and a drift is caught without a person looking.**
   - Measure: the cockpit's mockup redrawn on its own tokens with no raw value and approved in the cockpit; the cockpit restyled to match; then one token changed in the app alone, and the dashboard shows it broken
   - Look: when this plan's build closes

3. **Each new mockup starts from the foundation the first one defined.**
   - Measure: the next mockup drawn after landing adds tokens or components only where it declares them new, and the token check passes on it
   - Look: at the next plan that draws a mockup

## Promises

### This plan makes

1. **`a-mockup-is-approved-by-a-person`** (state). A mockup, and the foundation it defines, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it.
2. **`a-mockup-leaves-nothing-undefined`** (structure). Every colour, size, space, radius, shadow, font and motion value in a mockup or in the app comes from a defined token, so the first mockup defines the foundation and no later one can add a raw value.
3. **`every-part-of-the-ui-is-covered`** (state). Every screen the app has, in each declared state, and every component it uses, is covered by an approved mockup; whatever is not is reported uncovered, never passed.
4. **`mockups-render-in-the-cockpit`** (state). Each mockup opens in the cockpit at each reference device, drawn with the foundation's tokens.
5. **`tokens-are-held-exactly`** (state). Every element in the running app that claims a token, including a duration or an easing, renders with the value the approved foundation gives it; a mismatch names the element, the token, and the approved and actual values.
6. **`a-look-reports-like-any-promise`** (state). Each check of the app's looks is recorded held or broken through the same telemetry promises use, and a broken one is counted and listed first with the rest.

### Existing promises

**Must not break**

- **`broken-promises-come-first`**. A broken look is counted and listed with every other break.
- **`every-promise-is-listed`**. Looks join the dashboard without hiding the promises already on it.
- **`the-editor-shows-the-same-health-as-the-admin`**. A look's state is read by the one reader the editor and the admin share.
- **`everyday-tests-never-wait`**. Checking the running app's tokens starts a browser, so it runs in the slow tier, never the everyday suite.
- **`everyday-suite-stays-fast`**. For the same reason.
- **`the-demo-break-is-caught-locally`**. The demo's existing break still shows; a broken look is added beside it, not instead.

**Changes**

None.

**Replaces**

None.

### Not promised

- Comparing a screen's pixels with its mockup, one pinned renderer, and the page showing the difference: [mockup-matching](../mockup-matching/brief.md), plan 2.
- How the app behaves: interactions, timing and reduced motion stay ordinary promises.
- Video, or recorded animation: end states, motion tokens and timing promises cover it (research, "Animation").
- Real Safari or real devices: emulated reference devices; a device farm is a hosted service.
- Native platforms: the format is designed for them; each runner is a later extension plan (research, "platform-neutral").
- Any hosted tool: open tools and open formats, held in git (research, "Tools, against lock-in").

## Depends On

- [plan-cockpit](../plan-cockpit/brief.md) — the dashboard and pages a look reports to, and the first app held to a mockup. Built; not yet landed.

## Blocks

- [mockup-matching](../mockup-matching/brief.md) — compares screens with the mockups this plan approves.
- [promise-devtools](../../research/promise-ui/plans/promise-devtools/brief.md) — its question of where a promise's coverage is declared follows this plan's format.
