# Component content — a placed component takes its own words

**Decided 2026-10-14.** Full ADR: `.indusk/planning/component-content/adr.md`.

## Goal

**A mockup places an existing component with its own words, so a screen can be made of components alone.**

Today a placed component is its story's snapshot byte for byte: a button
placed on new-project-flow's proposal screen reads "Not yet", and a creation
step reads "Research done". So every button, step and card on those five
screens had to be drawn inline, against the rule that a mockup shows a
component only by naming it.

## Y-Statement

**In the context of:**
mockups that place admin components by name and state, composed from each story's static snapshot before they are linted, shown, hashed and checked.

**Facing:**
snapshots that carry the story's fixed words, components whose words arrive through different properties (`children` for a button, `name` for a step, `title` plus element children for a box), and no marked place in a snapshot where other words could go.

**We decided for:**
content inside the reference — bare content fills `children`, `<indusk-content for="name">` fills a named property — limited to text and placed components; the render step finding where each fillable property lands by rendering each story a second time with every string property and `children` replaced by a unique marker, and recording each marker's node path per state in `components.json`; and `compose` putting the placed content at those paths, composing nested references inside it.

**And against:**
a story state per label (states multiply with every screen); replacing the first occurrence of the story's words in the snapshot (a first match is the wrong match when a word repeats — `lesson: anchor-a-document-insert-on-a-whole-line-never-the-first-match-of-a-heading-string`); a `data-slot` marker inside each component (puts a mockup's concern into the app's markup); and properties as attributes on `<indusk-component>` (an attribute cannot hold a component, so containers would need a second syntax).

**To achieve:**
screens composed only of components, each showing the screen's own words, with the component's look still the approved one.

**Accepting:**
a second render per story, and a components.json that grows a content map; a property no story fills with a string or children cannot be filled.

**Because:**
the marker render locates content by structure, not by matching text, so it cannot land on the wrong word; and the approval hash already covers it — a mockup's hash is its composed bytes (the placed words) and its components hash is the snapshots it uses, so changed words reopen the mockup and a changed component reopens every mockup that places it.

## Context

See [research.md](research.md) and [brief.md](brief.md). `compose` is
`apps/indusk-mcp/src/lib/looks/compose.ts`, read only by `readApp` in
`looks/mockups.ts`; the render step is `looks/stories.ts`, which writes each
story's `canvasElement.innerHTML` from a generated Storybook `afterEach`.

## Decision

1. **Syntax.** Inside `<indusk-component name state>`: text and placed
   components fill `children`; `<indusk-content for="<property>">…</indusk-content>`
   fills a named property. Nothing else.
2. **Where content goes.** `indusk looks stories <app>` renders each story
   twice: as today, for the snapshot; and with every string property and
   `children` replaced by a marker `⁣slot:<property>⁣`, recording the node
   path of every place each marker appears, relative to the canvas. Each
   state in `components.json` gains
   `content: { "<property>": [[<child indices>], …] }`.
3. **Composition.** `compose` takes each snapshot's content map; for a
   reference with content, it parses the snapshot, replaces the node at each
   filled property's path with that content (itself composed first, so nested
   references resolve), and serializes. A reference with no content composes
   to the snapshot's bytes exactly, as today.
4. **Lint.** Two rules in `looks/lint-components.ts`:
   `content-not-words-or-components` (an element inside a reference other than
   `<indusk-component>` or `<indusk-content>`) and `component-takes-no-content`
   (a property the state's content map does not list), each naming the file,
   line and value.

## Alternatives Considered

### A story state per label
`button.create-project`, `step.workbench-created`. No tooling change. Rejected:
every screen adds states to shared components, and a component's look is
approved again for every new word.

### Replace the story's words by text match
Find "Not yet" in the snapshot and swap it. Rejected: the first match is wrong
whenever the words repeat in the component, which this codebase has a lesson
about.

### A `data-slot` marker in each component
Rejected: every component's markup carries a mark that only mockups need.

### Properties as attributes
`<indusk-component name="step" label="Workbench created">`. Rejected: an
attribute cannot hold a component, so containers would need a second syntax.

## Consequences

### Positive
- Screens are composed of components only; their own words show.
- No component or story changes.

### Negative
- The render step runs twice per story.

### Risks
- A component that renders a string property in more than one place (a
  label and its `aria-label`): only text nodes are paths, so an attribute
  copy keeps the story's words. Mitigation: A5 lists each fillable property
  per state; a property seen only in attributes is not listed, so a mockup
  cannot fill it and the lint says so.
