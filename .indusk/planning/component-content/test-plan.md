---
title: "Component content — Test Plan"
date: 2026-10-13
status: accepted
---

# Component content — Test Plan

## Purpose

The behavioural assertions that, together, mean a mockup can place an existing
component with its own words, and only words and components. Each names the
smallest level that proves it and is grouped by the brief's promise it proves.
They become the impl's Test Trajectory rows.

## Behavioral Assertions

### `a-placed-component-shows-its-content` — A mockup places a component together with the words it needs, and shows the approved component with those words in place of the story's.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A button placed with the words "Create project" shows the approved button reading "Create project", and none of the story's words. | unit |
| A2 | A step placed with content for its name shows that name where the story's name was, with the step's look unchanged. | unit |
| A3 | A container placed with components inside it shows the container with those components composed where the story's content was. | unit |
| A4 | A component placed with no content shows the story's words, exactly as before this change. | unit |
| A5 | After the admin's stories are rendered, each component state says which of its properties a mockup may fill — the button's and tag's words, the step's name, the box's title and body. | contract |

### `placed-content-is-only-words-and-components` — What a mockup puts inside a placed component is text or other components placed by name; anything else is refused, so content never restyles a component or carries a drawing back in.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | The lint refuses any element inside a placed component other than a placed component or a named piece of content, naming the file, the line and the element. | unit |
| A7 | The lint refuses content for a property the component's state does not take, naming the component and the property. | unit |
| A8 | The lint accepts text and placed components inside a placed component. | unit |

### `a-changed-component-reopens-its-mockups` — When an approved component changes, every mockup that uses it returns to proposed, naming the component, until a person looks at it again.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | A mockup that places a component with its own words returns to proposed, naming the component, when that component's story changes. | unit |

### `a-mockup-is-approved-by-a-person` — A mockup or a story, and the foundation it is drawn on, becomes the reference only when a person approves it in the cockpit…

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | Changing only the words placed in a component returns an approved mockup to proposed. | unit |

### `a-mockup-composes-approved-components` — A mockup shows a component only by naming it, so the approved component is what appears; a component a mockup draws itself is refused unless it is declared new.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | Every admin mockup approved before this change is still approved after it. | unit |

## Notes

- A11 is a regression guard over the real admin mockups: it passes the moment
  it is written and must keep passing.
- A5 renders the admin's stories in Chromium, so it is a `contract` test in the
  system tier — it is about Storybook, which this project does not own.
