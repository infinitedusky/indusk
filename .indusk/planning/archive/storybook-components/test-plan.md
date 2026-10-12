---
title: "Storybook components — Test Plan"
date: 2026-10-12
status: accepted
---

# Storybook components — Test Plan

## Purpose

The behavioural assertions that, taken together, mean the admin is built from
components defined once, each with a story per state, composed into mockups
and screens. Each names its level — the smallest that can prove it — and sits
under the promise it proves. They become the impl's Test Trajectory rows.

## Behavioral Assertions

### `a-component-has-one-implementation` — Each component the mockups name is implemented once in the app, and every screen renders that one implementation rather than its own copy.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A component name marked on two different implementations in the admin's source is refused, naming both files | unit |
| A2 | Every component the admin's approved mockups name has an implementation in the admin; one with none is reported by name | unit |
| A3 | A screen that writes out a component's markup itself — the component's marked element outside the component's own file — is refused, naming the file and line | unit |

### `every-component-state-has-a-story` — Every component, in each state its mockups show, has a story that renders the real component in that state.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A component state that a mockup shows with no story for it is reported, naming the component and the state | unit |
| A5 | Every story renders its component in a real browser without an error | contract |
| A6 | A story renders the component the app uses — changing the component changes the story's render, with no edit to the story | contract |

### `a-mockup-composes-approved-components` — A mockup shows a component only by naming it, so the approved component is what appears; a component a mockup draws itself is refused unless it is declared new.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A mockup that names a component and a state shows, in the cockpit, the approved story's render of that component in that state | contract |
| A8 | A mockup that draws a component's markup itself instead of naming it is refused by the lint, naming the file, the line and the component | unit |
| A9 | A mockup that draws a component it declares new passes the lint, and the new component is listed as needing a story | unit |
| A10 | A mockup that names a component, or a state of one, with no approved story is refused, naming it | unit |

### `a-changed-component-reopens-its-mockups` — When an approved component changes, every mockup that uses it returns to proposed, naming the component, until a person looks at it again.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | After an approved component's story changes, every approved mockup that uses it reads proposed with the reason naming that component; a mockup that does not use it stays approved | unit |
| A12 | Approving the reopened mockup again in the cockpit makes it read approved | unit |

### `an-agent-can-find-every-component` — Every component, with its properties and its states, is listed in a catalog an agent can read before it writes a component, with nothing running.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | After a build, a catalog file lists every component with its properties and each state that has a story, and it is read with no server running | contract |
| A14 | A component implemented in the admin but missing from the catalog is reported by name | unit |

### `every-part-of-the-ui-is-covered` (changes) — … and every component it uses, in each state its mockups show, is covered by an approved mockup or an approved story; whatever is not is reported uncovered, never passed.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | Coverage reports a component state with no approved story as uncovered, and passes once its story is approved | unit |

### `a-mockup-is-approved-by-a-person` (changes) — A mockup or a story … becomes the reference only when a person approves it in the cockpit, and stops being one when a person takes the approval back; an agent can draw and propose one and never approve it or take it back. *(Widened 2026-10-12.)*

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | A story reads proposed until a person approves it on the Looks page; an agent's write to the record of story approvals is refused, naming the cockpit's Approve | unit |
| A17 | A story changed after it was approved reads proposed again | unit |
| A27 | A person's Unapprove makes an approved mockup or story read proposed, as withdrawn by them, with the record keeping its history; the others stay approved, and approving it again makes it read approved | unit |
| A28 | An agent cannot take an approval back: the command line's `unapprove` is refused naming the cockpit's Unapprove | unit |
| A29 | The Looks page offers Unapprove on an approved mockup and on an approved story, and not on a proposed one; it sends the shown hash like Approve | unit |

### `mockups-render-in-the-cockpit` (changes) — Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens, with nothing to run beside the cockpit. *(Widened 2026-10-12: a mockup that names components is drawn with their styles.)*

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | Each story opens on the Looks page at each reference device's size, served by the admin itself, with no Storybook server running | contract |
| A30 | Every component a mockup places is drawn as its story draws it: in a real browser the composed mockup's computed padding, margin, border, background, font and size on the component's root and each descendant equal the story's, for every mockup and every component it names; a difference fails naming the mockup, the component, the element and the property | contract |
| A25 | A composed mockup opens in the cockpit drawn with its components' styles: the frame's document holds a rule for every class its snapshots use, and the value check finds no raw value in it | unit |
| A26 | After an approved component's style changes, every approved mockup that uses it reads proposed naming that component; a mockup that does not use it stays approved | unit |

### `tokens-are-held-exactly` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | Every story's render uses only the approved foundation's values; one changed token shows the story broken | contract |
| A20 | The rebuilt admin is held: `indusk looks check admin` reads every checked look held, and one token changed in the admin alone shows broken on the dashboard | live check |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A21 | Story tests run in the system tier or the admin's browser project, never in a suite that refuses waiting | unit | regression guard over `everyday-tests-never-wait` and `everyday-suite-stays-fast` |
| A22 | The nav still fits a phone after it is rebuilt from components (the existing phone test passes unchanged) | contract | regression guard over `the-nav-fits-a-phone` |
| A23 | The rebuilt dashboard still lists every promise, broken first (the existing dashboard tests pass unchanged) | unit | regression guard over `every-promise-is-listed` and `broken-promises-come-first` |
| A24 | `indusk looks lint admin` still finds no raw value after the rebuild | unit | regression guard over `a-mockup-leaves-nothing-undefined` |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The rebuilt cockpit looks like its approved mockups (expectation 1) | whether two screens match is a person's judgement until a pixel comparison exists | Sandy opens each screen beside its mockup at each device at build close; mockup-matching (plan 3 of 4) makes it a check |
| U2 | The components the mockups were cut into are the right components (boundaries a person would draw) | a design judgement | Sandy approves each component's story in the cockpit; a wrong boundary shows as a component that cannot be reused |

## Notes

- A5, A6, A7, A13, A18 and A19 start Storybook or a browser, so they are `contract` and run in the system tier at landing.
- A6 is what makes a story trustworthy as a reference: it renders the real component, not a copy. If it cannot be proven by a test, it becomes a structural check (each story imports its component from the component's one file).
- The value check reaching stories (A19) reuses ui-promises' `looks check` against the static Storybook build instead of a page.
