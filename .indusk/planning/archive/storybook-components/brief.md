---
title: "Storybook components — the approved mockups as components, one implementation each, a story per state"
date: 2026-10-12
status: accepted
workflow: feature
---

# Storybook components — Brief

Plan 2 of 4 of the look series: after [ui-promises](../archive/ui-promises/)
(an app's look held by value to approved mockups), before
[mockup-matching](../mockup-matching/brief.md) (the validator) and
[demo-scenarios](../demo-scenarios/brief.md). Why, what exists today and what
Storybook can and cannot do on this stack are in [research.md](research.md).

## Expectations

1. **The cockpit looks like its approved mockups.**
   - Measure: Sandy opens each of the admin's screens beside its approved mockup at each reference device and judges that they match — a person's eye until mockup-matching checks it
   - Look: when this plan's build closes

2. **The next screen is built mostly from components that already exist.**
   - Measure: in the next plan that adds a screen to an app, most of the components its mockup uses already had an approved story before that plan began
   - Look: at the next plan that draws a mockup

3. **An agent reuses a component before it writes one.**
   - Measure: no component appears in a mockup or in the app without either an approved story or a declaration that it is new — counted at this plan's close and in the next UI plan
   - Look: at this plan's close, and at the next UI plan

## Promises

### This plan makes

1. **`a-component-has-one-implementation`** (structure). Each component the mockups name is implemented once in the app, and every screen renders that one implementation rather than its own copy.
2. **`every-component-state-has-a-story`** (state). Every component, in each state its mockups show, has a story that renders the real component in that state.
3. **`a-mockup-composes-approved-components`** (structure). A mockup shows a component only by naming it, so the approved component is what appears; a component a mockup draws itself is refused unless it is declared new.
4. **`a-changed-component-reopens-its-mockups`** (state). When an approved component changes, every mockup that uses it returns to proposed, naming the component, until a person looks at it again.
5. **`an-agent-can-find-every-component`** (state). Every component, with its properties and its states, is listed in a catalog an agent can read before it writes a component, with nothing running.

### Existing promises

**Must not break**

- **`tokens-are-held-exactly`**. Rebuilt components still render every value from the approved foundation.
- **`the-nav-fits-a-phone`**. The nav is rebuilt from components; it must still fit a phone.
- **`a-look-reports-like-any-promise`**. Looks keep reporting through the same telemetry as promises while the screens are rebuilt.
- **`every-promise-is-listed`**. The dashboard is rebuilt; every promise stays on it.
- **`broken-promises-come-first`**. The rebuilt dashboard still lists breaks first.
- **`everyday-tests-never-wait`**. A story test starts a browser, so it runs where browser tests already run, never in a suite that refuses waiting.
- **`everyday-suite-stays-fast`**. For the same reason.

**Changes**

- **`every-part-of-the-ui-is-covered`**. Every screen the app has, in each declared state, and every component it uses, in each state its mockups show, is covered by an approved mockup or an approved story; whatever is not is reported uncovered, never passed.
- **`a-mockup-is-approved-by-a-person`**. A mockup or a story, and the foundation it is drawn on, becomes the reference only when a person approves it in the cockpit, and stops being one when a person takes the approval back there; an agent can draw and propose one and never approve it or take it back.
- **`mockups-render-in-the-cockpit`**. Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens and, where it names components, with those components' own styles, with nothing to run beside the cockpit.

*Widened 2026-10-12: `a-mockup-is-approved-by-a-person` because Sandy approved a look by mistake and the record had no way back; `mockups-render-in-the-cockpit` because the eleven composed mockups drew their components unstyled, found when Build Phase 6 rewrote them (the ADR's decision 10).*

**Replaces**

None.

### Not promised

- Comparing a story or a screen with its mockup pixel for pixel, and the page showing the difference: [mockup-matching](../mockup-matching/brief.md), plan 3 of 4.
- How a component behaves — interactions, keyboard, timing — and the scenarios that prove promises in a running demo: [demo-scenarios](../demo-scenarios/brief.md).
- Stories running inside the app's own runtime with its real providers (an in-app gallery): not supported by Storybook, and the admin has no auth or wallet to fake; stories render in a static Storybook the cockpit serves (research, "Rendering stories inside the app").
- Storybook's MCP as something the loop depends on: it is in preview and answers only while a Storybook server runs; it is a convenience over the catalog, not the catalog.
- Components for seat-holds or any app besides the admin.
- A composed mockup passing data to a component: a story is one fixed rendering, so a mockup shows each component's story content (the nav's current link is the story's, a plan screen shows one tag). A component needing other content gets another story.
- A design system as a deliverable: it is what this approach leaves behind, not a separate piece of work.

## Depends On

- [ui-promises](../archive/ui-promises/) — the foundation, the approved mockups, approval in the cockpit and the value check. Closed 2026-10-11.

## Blocks

- [mockup-matching](../mockup-matching/brief.md) — holds each story to its mockup and each rebuilt screen to its whole mockup.
- [demo-scenarios](../demo-scenarios/brief.md) — the demo runs on the rebuilt cockpit.
