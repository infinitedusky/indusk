---
title: "Component content"
date: 2026-10-13
status: complete
---

# Component content — Research

## Question

How does a mockup place an existing component with the words it needs — a
button reading "Create project" — when composition drops in the component's
approved snapshot whole?

## Background

The Storybook components decision (`/decisions/storybook-components`, the ADR
that made each admin component one file with a story per state rendered to a
snapshot) has mockups place a component by name and state:
`<indusk-component name="button" state="default"></indusk-component>`.
`compose` in `apps/indusk-mcp/src/lib/looks/compose.ts` replaces the element
with `components/button.default.html` byte for byte. Its only caller is
`readApp` in `apps/indusk-mcp/src/lib/looks/mockups.ts`; the lint, the Looks
page's frame, the approval hash and `looks check` all read what it returns.

Every existing snapshot carries fixed words: `button.default` reads "Not yet",
`button.yes` "Approve", `step.done` "Research done", `step.working` "Build
working", `box.default` "Where it lives Plan ui-promises · state",
`tag.default` "worktree plan/ui-promises". A screen placing any of them shows
the story's words, not its own.

## Findings

- **Found while drawing new-project-flow's looks** (2026-10-13): every
  button, creation step and card container on its five screens had to be drawn
  inline because no existing component could carry the screen's words. The
  rule that a screen is made only of components cannot be kept today.
- **Anything inside a placed reference is discarded.** `compose` replaces the
  whole element, children included; a reference nested in another is "gone
  with it" (the comment at the replacement loop).
- **The snapshot has no marked place for content.** A story renders its
  component with fixed children; the snapshot is static markup with those
  words inline. Content needs a place in the snapshot to go — a decision for
  the ADR.
- **The approval hash already covers the words.** A mockup's approval binds
  its own source (which would hold the words) plus the snapshot hashes of the
  components it uses, so a changed component still reopens the mockup
  whatever it holds.

## Decisions

- **A placed component takes its content** (Sandy, 2026-10-13), rather than a
  story state per label, which would multiply states with every screen.
- **Content is words and placed components only** — content cannot restyle a
  component or carry a drawing back in.
- **The live check stays on tokens and elements**, not text: the built app's
  words come from its code.

## Open Questions

- Where content goes in a snapshot: a slot marker the render step writes, or
  the story's children located by convention.
- A component with more than one place for content (a card's title and body).
