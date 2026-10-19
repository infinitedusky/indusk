---
title: "Mockups draw components as their stories do — Test Plan"
date: 2026-10-17
status: accepted
---

# Mockups draw components as their stories do — Test Plan

## Purpose

The assertions that, together, mean a component placed in a mockup draws as
its story does and every story fits its frame. They are grouped by the promise
they prove and become the impl's Test Trajectory rows.

## `mockups-render-in-the-cockpit`

Each mockup and each story opens in the cockpit at each reference device, drawn
with the foundation's tokens and, where it names components, with each
component drawn as its own story draws it, and each story fitted to its frame,
with nothing to run beside the cockpit.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A component built on a link draws in its own ink inside a mockup, as in its story, never in the browser's link colour. | unit |
| A2 | A component's text field draws in the app's text font and size inside a mockup, as in its story, never the browser's default. | unit |
| A3 | The resets a story draws under reach only the components inside a mockup; the mockup's own page around them draws as before. | unit |
| A4 | Every component every admin mockup places draws, on its root and each descendant, with its story's computed values. | contract |
| A5 | Every story of the admin is framed to its component and takes each reference device's width when chosen; a message with long unbroken text wraps inside its bubble. | contract |

## `a-mockup-composes-approved-components` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | A mockup still shows a component only by naming it, and one it draws itself is still refused unless declared new. | unit |

## Added after the audit (Build Phase 5)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T4 | A reset for a pseudo-element keeps the component scope before it, in a selector a browser accepts. | unit |
| T5 | The cockpit's own story page loads the resets between the tokens and the base and component sheets. | unit |
| T6 | A mockup's own style rule never reaches a component it places; a rule naming the component's marker still places it. | unit |
| T7 | Every placed component draws as its story at each reference device; a box holding the mockup's own words is the story's size given those words. | contract |
| T9 | An arbitrary wrapping class is refused with a message naming the standard utility. | unit |

## `a-mockup-is-approved-by-a-person` (changes)

A mockup or a story, and the foundation and the app's element rules it is drawn under, becomes the reference only when a person approves it in the cockpit, and stops being one when a person takes the approval back there; an agent can draw and propose one and never approve it or take it back.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T1 | A story or mockup approved before the app's element rules change reads proposed after they change; one recorded without the rules still reads approved. | unit |
| T3 | A look last approved under other element rules is held to nothing in the look check. | unit |
| T8 | Its status line says nothing is held and names the element rules. | unit |

## Notes

- A4 and A5 are the composition check and the story-frame check as fixed on
  `plan/storybook-components` (its Maintenance); this plan brings those fixes in
  and is measured by them.
- The project card's spacing in `home.default` is held by A4; its cause is
  confirmed in the build.
