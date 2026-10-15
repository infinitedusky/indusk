---
title: "Component content — a placed component takes its own words"
date: 2026-10-13
status: completed
cleanup: skipped
cleanup_reason: "reviewed the plan's changed source files — stories.ts (564 LOC, over the 400 cap), mockups.ts (417), compose.ts (235), lint-components.ts (207), markup.ts (98), components.ts, stories-catalog.ts. stories.ts: the +147 lines (markerPlaces, texts, contentPaths) sit inside a template string that is emitted as the browser-side Storybook setup, so they cannot import from compose.ts or move to a sibling module without inventing a template-embedding mechanism; the inline place type there duplicates compose.ts ContentPlace only because generated code cannot import it, and the one normalizer (placeOf) is shared by every reader. mockups.ts: +35 lines, readContentMaps is one reader with one caller, 417 vs cap is the pre-existing file, no cross-file duplication. compose.ts, lint-components.ts, markup.ts: under cap and cohesive (Build Phase 4 Shape step recorded the same). Nothing warrants extraction; no rule-of-three repeats across files."
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "ce09d0d9b9bda6ff49a59e1bba93c4b528d33656eb74886eeb798089b19a4c5e"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T21:40:24.962Z"
accepted: 2026-10-14T22:39:17.055Z
accepted_by: person
---

# Component content

## Goal

A mockup places an existing component with its own words — bare content for
`children`, `<indusk-content for="<property>">` for a named property — and
only words and placed components, so new-project-flow's screens can be made of
components alone (see [adr.md](adr.md)).

## Scope

### In Scope
- `compose` fills placed content at the paths each state records, composing nested references.
- The render step records, per state, where each fillable property lands.
- Two lint rules: content that is not words or components; content for a property the state does not take.
- The components guide and the decision page.

### Out of Scope
- Words in the live app check (`looks check` stays on tokens and elements).
- Rewriting new-project-flow's screens to use it — that plan's work.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `compose` filling content from a snapshot's content map; `SnapshotBytes.content` | the existing snapshots and `readApp` |
| Build Phase 2 | the marker render in `looks/stories.ts`; `content` per state in `components.json`; `snapshotBytes` carrying it | Build Phase 1's `SnapshotBytes.content` |
| Build Phase 3 | `content-not-words-or-components` and `component-takes-no-content` in `looks/lint-components.ts` | Build Phase 2's content maps |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A button placed with "Create project" shows the approved button reading "Create project", and none of the story's words | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/lib/looks/compose.test.ts |
| A2 | A step placed with content for its name shows that name where the story's name was, its look unchanged | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/lib/looks/compose.test.ts |
| A3 | A container placed with components inside shows them composed where the story's content was | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/lib/looks/compose.test.ts |
| A4 | A component placed with no content shows the story's words exactly as before | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/lib/looks/compose.test.ts |
| A5 | After the admin's stories render, each state says which properties a mockup may fill — button and tag words, step name, box title and body | Test Phase 1 | Build Phase 2 | passing | contract | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/__tests__/looks-component-content.contract.test.ts |
| A6 | The lint refuses any element inside a placed component other than a placed component or named content, naming file, line and element | Test Phase 1 | Build Phase 3 | passing | unit | promise: placed-content-is-only-words-and-components | apps/indusk-mcp/src/__tests__/looks-component-content-lint.test.ts |
| A7 | The lint refuses content for a property the state does not take, naming the component and the property | Test Phase 1 | Build Phase 3 | passing | unit | promise: placed-content-is-only-words-and-components | apps/indusk-mcp/src/__tests__/looks-component-content-lint.test.ts |
| A8 | The lint accepts text and placed components inside a placed component | Test Phase 1 | Build Phase 3 | passing | unit | promise: placed-content-is-only-words-and-components | apps/indusk-mcp/src/__tests__/looks-component-content-lint.test.ts |
| A9 | A mockup placing a component with its own words returns to proposed, naming the component, when that component's story changes | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-changed-component-reopens-its-mockups | apps/indusk-mcp/src/__tests__/looks-component-content-approval.test.ts |
| A10 | Changing only the words placed in a component returns an approved mockup to proposed | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-mockup-is-approved-by-a-person | apps/indusk-mcp/src/__tests__/looks-component-content-approval.test.ts |
| A11 | Every admin mockup approved before this change is still approved after it | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-mockup-composes-approved-components | apps/indusk-mcp/src/__tests__/looks-admin-approvals-hold.test.ts |
| A12 | A part-section placed with `<indusk-content for="summary">3 · none</indusk-content>` shows "· 3 · none": the story's static words that share a text node with a property stay, only the property's words are replaced | Phase 0 | Build Phase 4 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts |
| A13 | A decision-card placed with the words "Mine" shows none of the story's children — no "Approve" button from the story — and every property after its children still lands where it did | Phase 0 | Build Phase 4 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts |
| A14 | After the admin's stories render, part-section's `summary` place records the words "· " before it, and decision-card.ask's `children` place records that it spans the story's two nodes | Phase 0 | Build Phase 4 | passing | contract | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/__tests__/looks-component-content.contract.test.ts |
| A15 | An `<indusk-content>` with no `for`, or one inside another `<indusk-content>`, is refused by the lint naming file and line, and compose never puts an `<indusk-content>` element into a composed mockup | Phase 0 | Build Phase 4 | passing | unit | promise: placed-content-is-only-words-and-components | apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts |
| A16 | Content given twice for one property — two `<indusk-content for="name">`, or `for="children"` beside bare words — is refused by the lint naming the component and the property, instead of one silently dropped | Phase 0 | Build Phase 4 | passing | unit | promise: placed-content-is-only-words-and-components | apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts |
| A17 | A self-closing `<indusk-component name="button" />` followed by `<p>after</p>` composes to the button and then the paragraph, not the paragraph inside the button, and the lint reports no content finding for it | Phase 0 | Build Phase 4 | passing | unit | promise: a-placed-component-shows-its-content | apps/indusk-mcp/src/__tests__/looks-component-content-falsification.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

This phase writes every test the plan can honestly write before any of its code exists, so the build phases that follow have something to turn green. The tests cover how a placed component takes its own words, how the render step records where those words go, how the lint refuses anything that is not words or components, and whether the approvals made before this plan still hold. A test whose subject does not exist yet is recorded below with the reason it waits.

- [x] This plan has its own isolated working copy before any code is touched.
  <details><summary>Technical</summary>

  Create/confirm this plan's worktree (`indusk worktree create component-content`, or `indusk worktree assign component-content <path>` for the one `plans start` made) — worktree-per-plan default

  </details>
- [x] Four tests for how a placed component takes its own words are written; three fail because nothing fills the words yet, and the fourth already passes.
  <details><summary>Technical</summary>

  Author A1–A4 in `compose.test.ts`: snapshots handed in as `{ html, hash, content }` with a content map (`content: { children: [[0, 0]] }` for a button, `{ name: [[0, 1, 0]] }` for a step, `{ children: [[0, 1]] }` for a box); A1–A3 RED on their assertions (today's compose drops the content), A4 green

  </details>
- [x] A test that runs the real component render and reads what it records about each component is written, and it fails for the right reason.
  <details><summary>Technical</summary>

  Author A5 as a system-tier contract test (runs in the checkout over a backup of `.indusk/mockups/admin`, restored after: Vite will not serve the admin's sources through a symlinked or copied tree — decided over the plan's temp copy, red verified on its own assertion) that runs `indusk looks stories admin` into a temp copy and reads `components.json`; add it to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`; RED (no `content` on any state)

  </details>
- [x] Three tests for the new lint rules are written; the two that need a new rule fail, and the one for allowed content already passes.
  <details><summary>Technical</summary>

  Author A6–A8 against `componentFindings` over a fixture app (a `screens.json`, a `components.json` whose states carry content maps, three mockups); A6 and A7 RED (no such rules), A8 green

  </details>
- [x] Two tests for approvals are written, checking that a mockup placing a component with its own words reopens when those words or the component change.
  <details><summary>Technical</summary>

  Author A9–A10 against `readApp` and `readStoryApprovals` over a fixture app with an approved mockup that places a button with content; RED (content is dropped, so changing it does not change the hash)

  </details>
- [x] A test that every mockup approved before this plan is still approved is written, and it passes from the start by design.
  <details><summary>Technical</summary>

  Author A11 over the repository's own `.indusk/mockups/admin`: every entry in `approved.json` whose mockup still exists reads approved through `readApp`

  </details>

#### Regression Guards

- **A4** — the no-content composition is today's behaviour; the row exists so filling content cannot change a reference that has none.
- **A11** — every approval made before this plan must survive it; it has no red window by design.

#### Test Phase 1 Verification

- [x] Each new test that should fail does so on its own assertion rather than on a missing file, and the one that already passes is kept on purpose.
  <details><summary>Technical</summary>

  A1–A3, A5–A7, A10 authored and each fails on its own assertion, not on a missing import; **A9 is green today** — `compose` already lists a nested reference in `uses`, so a changed component already reopens a mockup that places it with words; it stays `written` as a guard whose red window is none (decision: keep it, it asserts the promise and costs nothing) (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-lint.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts`; A5 with `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`)

  </details>
- [x] The tests that are meant to pass from the start do pass.
  <details><summary>Technical</summary>

  A4, A8 and A11 pass

  </details>

### Build Phase 1: Compose fills content

**Tier**: med — the work step's default

This phase teaches the code that builds a mockup out of placed components to put a component's own words where the approved story had its words. Nothing yet records where those words sit, so the phase works from a map of positions handed in with each snapshot; the next phase makes the render step produce that map.

- [x] A component snapshot can carry, for each property, the positions where its words sit.
  <details><summary>Technical</summary>

  `SnapshotBytes` gains `content?: Readonly<Record<string, number[][]>>` — per property, the child-index paths from the snapshot's root

  </details>
- [x] Building a mockup fills a placed component's words at those positions, including components placed inside other components, and leaves a component with no words exactly as it was.
  <details><summary>Technical</summary>

  `compose` reads each reference's content: bare children → `children`; each `<indusk-content for="p">` → `p`. With none, the snapshot's bytes go in unchanged. With some, the content is composed first (nested references), the snapshot is parsed with `parse5`, the node at each path of a filled property is replaced by the content, and the result serialized
  ```typescript
  export interface SnapshotBytes { html: string; hash: string; content?: Readonly<Record<string, number[][]>> }
  ```

  </details>
- [x] Every placed component, nested ones included, is still counted when working out whether a mockup's approval holds.
  <details><summary>Technical</summary>

  `ComponentUse` keeps one entry per reference, nested ones included, so `componentsHashOf` still binds every snapshot a mockup composes

  </details>
- [x] The code written in this phase was reviewed for craft, and the one inline condition worth a name was given one.
  <details><summary>Technical</summary>

  Shape — reviewed `compose.ts`, `markup.ts`, `mockups.ts`: one finding, the inline "content belonging to this reference" predicate in `renderReference` deserved a name — extracted as `contentOf`, done in this phase. `readContentMaps` in `mockups.ts` reads `components.json` raw because `components.ts` imports `mockups.ts` (decision: the catalog's validating reader cannot be imported without a cycle)

  </details>

#### Build Phase 1 Verification

- [x] The tests for filling words and for approvals reopening pass, and the tests that must not change still pass.
  <details><summary>Technical</summary>

  A1–A3, A9 and A10 pass; A4 and A11 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts && pnpm exec vitest related src/lib/looks/compose.ts`) — green run alone; under the unattended build's `INDUSK_GATE_POLICY=auto` environment `plans-accept-stories`, `plans-approve-looks` and `release-incident` fail for the environment's reason (accept refused "from inside a build step"), not this change's

  </details>

#### Build Phase 1 Context

- [x] The comment at the top of the building code now explains how a placed component carries its own words.
  <details><summary>Technical</summary>

  mcp: the docblock of `looks/compose.ts` — a reference may carry content, bare for `children` or `<indusk-content for>` for a property, filled at the state's recorded paths — `promise: a-placed-component-shows-its-content`

  </details>

#### Build Phase 1 Document

- [x] The components guide shows how to place a component with its own words, with a button and a step as examples.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/components.md`: "Placing a component with its own words" — the two forms, with a button and a step as examples

  </details>

### Build Phase 2: The render step records where content goes

**Tier**: med — the work step's default

This phase makes the render step record where each component's words sit, so the map of positions that the previous phase consumed is produced instead of handed in. Each story is rendered a second time with recognisable markers in place of its words, the markers are found, and their positions are saved in the component catalog for the mockup builder to read.

- [x] Each story is rendered a second time with marked words, and the positions of the markers are saved next to the snapshot.
  <details><summary>Technical</summary>

  The generated `afterEach` in `looks/stories.ts` renders each story a second time with every string arg and `children` replaced by `⁣slot:<arg>⁣`, walks the canvas's text nodes for each marker, and writes the child-index paths beside the snapshot (`components/<name>.<state>.content.json`)

  </details>
- [x] The component catalog lists those positions for each state, and the mockup builder reads them.
  <details><summary>Technical</summary>

  `buildCatalog` in `looks/stories-catalog.ts` puts each state's paths in `components.json` as `content`; `snapshotBytes` in `looks/mockups.ts` hands them to `compose` (decision: `snapshotBytes` lives in `stories-catalog.ts` and only frames bytes; the hand-off is `readApp` reading `components.json` onto each `Story.content`, done in Build Phase 1 so A10 could pass there)

  </details>
- [x] The admin's component stories are rendered again, and the regenerated catalog and snapshots are saved.
  <details><summary>Technical</summary>

  Run `indusk looks stories admin` and commit the regenerated `components.json` and snapshots

  </details>
- [x] The code written in this phase was reviewed for craft and nothing needed extracting; its limits were written down.
  <details><summary>Technical</summary>

  Shape — reviewed `stories.ts`, `stories-catalog.ts`: nothing to extract. Decision: the marker render only replaces string args the first render shows as a text node plus `children`, so an enum arg (`variant`, `state`) is never overwritten; adjacent text nodes are merged by serialization, so two markers in one text node share one path (noted limitation). Left as is: the generated preview is one string template in `stories.ts` — it is the file's existing shape

  </details>

#### Build Phase 2 Verification

- [x] The test over the real render passes, and the approvals made before this plan still hold.
  <details><summary>Technical</summary>

  A5 passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`); A11 still passes; `pnpm exec vitest related src/lib/looks/stories.ts src/lib/looks/stories-catalog.ts src/lib/looks/mockups.ts`

  </details>

#### Build Phase 2 Context

- [x] The comment at the top of the story renderer explains the second render and the map it writes.
  <details><summary>Technical</summary>

  mcp: the docblock of `looks/stories.ts` — the second, marker render and the `content` map it writes per state — `promise: a-placed-component-shows-its-content`

  </details>

#### Build Phase 2 Document

- [x] The components guide says which properties a component state can take.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/components.md`: which properties a state can take, read from `content` in `components.json`

  </details>

### Build Phase 3: The lint holds content to words and components

**Tier**: med — the work step's default

This phase makes the mockup lint refuse content that is not words or placed components. It adds two rules: one for any other element placed inside a component, and one for words given to a property the component does not take. With the earlier phases, a mockup can now be written, filled and checked entirely from approved components.

- [x] The lint reports an element inside a placed component that is neither a component nor named content, and words given to a property the component does not take, each naming the file, line and value.
  <details><summary>Technical</summary>

  `contentFindings` in `looks/lint-components.ts`, joined into `componentFindings`: `content-not-words-or-components` for any element inside a reference other than `<indusk-component>` or `<indusk-content>`; `component-takes-no-content` for a filled property absent from the state's `content` — each naming file, line and value

  </details>
- [x] The code written in this phase was reviewed for craft and left as it is, with the reasoning kept.
  <details><summary>Technical</summary>

  Shape — reviewed `lint-components.ts`: `contentFindings` is one reason to change and sits beside the other component rules in the file whose docblock already lists them; no extraction. Left as is: the `mine`/`inside` offset predicates are inline closures because they close over the one reference — naming them would pass four arguments each

  </details>

#### Build Phase 3 Verification

- [x] The tests for the two lint rules pass, the earlier tests still pass, and the lint finds nothing new in the existing admin mockups.
  <details><summary>Technical</summary>

  A6–A8 pass; A1–A5, A9–A11 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-component-content-lint.test.ts && pnpm exec vitest related src/lib/looks/lint-components.ts`); `indusk looks lint admin` reports no new finding over the existing admin mockups

  </details>

#### Build Phase 3 Context

- [x] Both lint messages end with the name of the promise they protect.
  <details><summary>Technical</summary>

  guard: the two rules' messages name `promise: placed-content-is-only-words-and-components` (both messages end with it; `indusk looks lint admin` reports no new finding)

  </details>

#### Build Phase 3 Document

- [x] The components guide explains the two lint rules and what each message means.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/components.md`: the two lint rules and what each message means

  </details>
- [x] The decision page is published and the changelog records that a placed component takes its own words.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/component-content.md`: the ADR, published; changelog entry "Added — a placed component takes its own words"

  </details>

### Build Phase 4: Falsification — places recorded from one render, filled in another

**Tier**: med — the work step's default

This phase is the hunt for ways the finished work could still be wrong. A position is recorded from a second render but applied to the first render's snapshot, so it can land on the wrong words when the two renders disagree in shape, and a mockup's content can be malformed in ways the lint did not yet catch. The phase fixes each case it found: positions now record how many nodes they span and the static words around them, self-closing components and unnamed content are read safely, and giving one property words twice is refused. The reasoning behind the phase, each case and the decisions taken are kept in its Goal and decisions section below.

- [x] Each position is recorded against the shape of the first render, so words that share a text node with static words, or children that span several nodes, are located exactly.
  <details><summary>Technical</summary>

  `looks/stories.ts`, the generated `contentPaths`: record each place against the first render's shape. Normalize a clone of `canvasElement` (the snapshot's serialization merges adjacent text nodes) and align the marker render to it parent by parent: where the clone's parent has M children and the marker render's N, the marker's place spans `nodes: M − N + 1` and every later sibling's index shifts by `M − N`; two markers in one parent whose counts differ is ambiguous and records neither (the lint then refuses filling it). Where a marker's text node carries other text, record that text as `before` / `after` (A14)

  </details>
- [x] The position's new shape is carried through the catalog, the mockup reader and the builder, older catalogs are still read, and the admin's catalog is regenerated.
  <details><summary>Technical</summary>

  `looks/stories-catalog.ts` and `looks/components.ts` (`CatalogState.content`), `looks/mockups.ts` (`readContentMaps`, `Story.content`), `looks/compose.ts` (`SnapshotBytes.content`): the place type `{ at, nodes?, before?, after? }`, read through one normalizer that accepts a bare `number[]` as `{ at }`; regenerate `.indusk/mockups/admin/components.json` with `indusk looks stories admin` and commit it with the snapshots

  </details>
- [x] Filling a position replaces the right number of sibling nodes and keeps the static words around it.
  <details><summary>Technical</summary>

  `looks/compose.ts`, `fillAt`: replace `nodes` (default 1) siblings from the place, and wrap the content in the place's `before` / `after` text; sort places so a multi-node replacement cannot move a later place (A12, A13)

  </details>
- [x] A self-closing placed component is read as ending where it starts, so the content after it is no longer swallowed.
  <details><summary>Technical</summary>

  `looks/markup.ts`: a self-closing `<indusk-component … />` ends at its start tag — `end` and `innerEnd` are the start tag's end, so `compose` replaces only it and the lint sees its followers as siblings (A17)

  </details>
- [x] Content with no property name is never poured into a component.
  <details><summary>Technical</summary>

  `looks/compose.ts`: an `<indusk-content>` with no `for` is never bare content and never emitted — it contributes nothing to the composed bytes (A15)

  </details>
- [x] The lint refuses unnamed or nested content and refuses a property given words twice, naming the file and line.
  <details><summary>Technical</summary>

  `looks/lint-components.ts`, `contentFindings`: an `<indusk-content>` with no `for`, or inside another `<indusk-content>`, is `content-not-words-or-components` naming file and line (A15); a property filled twice is `content-given-twice` naming the component, the property and both lines (A16); add `content-given-twice` to `LintRule` in `lint-types.ts`

  </details>
- [x] The code written in this phase was reviewed for craft and nothing needed changing; the reasons it was left are kept.
  <details><summary>Technical</summary>

  Shape step for this phase over `compose.ts`, `stories.ts`, `markup.ts`, `lint-components.ts` — reviewed, nothing found; left as is: `contentFindings` in `lint-components.ts` is long but is one job (a mockup's placed content to findings, rule by rule) and splitting it would scatter the shared `mine`/`nested` ownership facts; `fillPlaces` in `compose.ts` was made to take every property's places together so a node-count change cannot move a place still to be filled (found while making A13 green)

  </details>

#### Build Phase 4 Verification

- [x] The new falsification tests were written failing on their own assertions and now pass.
  <details><summary>Technical</summary>

  A12, A13, A15, A16, A17 authored red at phase start, each on its own assertion, then green (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-component-content-falsification.test.ts`)

  </details>
- [x] The test over the real render was written failing, now passes after the catalog was regenerated, and its earlier case still passes.
  <details><summary>Technical</summary>

  A14 authored red, then green after the regenerated catalog (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`); A5 in the same file still green

  </details>
- [x] Every earlier test still passes, and the lint finds nothing new in the existing admin mockups.
  <details><summary>Technical</summary>

  A1–A11 still green (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-lint.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts && pnpm exec vitest related src/lib/looks/compose.ts src/lib/looks/markup.ts src/lib/looks/lint-components.ts`); `indusk looks lint admin` reports no new finding

  </details>

#### Build Phase 4 Context

- [x] The comment at the top of the building code now explains that a position holds only where the two renders agree, and carries the node count and surrounding words.
  <details><summary>Technical</summary>

  mcp: the docblock of `looks/compose.ts` — a place is recorded from a second render and holds only where the two renders agree; it carries the node count and the static words around it, so compose replaces exactly the property's words — `promise: a-placed-component-shows-its-content`

  </details>

#### Build Phase 4 Document

- [x] The components guide and the decision page describe the new position shape, the new lint rule and the two shapes this phase found.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/components.md`: a place's `nodes` / `before` / `after` in `components.json`, the `content-given-twice` rule, and that `<indusk-content>` always names `for`; the ADR's Risks in `apps/docs/src/decisions/component-content.md` gain the two shapes this phase found (words around a property; children of several nodes) and how the place records them

  </details>

#### Build Phase 4 Goal and decisions

**Goal**: verify whether the attested state holds where the marker render and the snapshot disagree in shape, and where a mockup's content is malformed. The ADR claims content is located "by structure, not by matching text, so it cannot land on the wrong word"; but a place is a path recorded from a *second* render and applied to the *first* render's snapshot, and a path names a whole node. Each trajectory row below captures one hypothesis; each checklist item the fix it needs. Every hypothesis was probed against the built `compose` and the admin's committed snapshots before it was written (the probes are scratch scripts, not tests; nothing was run from the suite):

- **Static words share a text node with a property** (A12, A14). `PartSection.tsx` renders `· {summary}`; the marker render's `host.normalize()` merges `"· "` with the marker, so `summary`'s place is the whole text node `[0,0,2,0]`. Probe: part-section.open placed with summary "3 · none" composes to `<span …>3 · none</span>` — the story's `· ` is gone. phase-row's `count` (`· 8 of 12`) is the same shape.
- **The story's `children` render as several nodes** (A13, A14). decision-card.ask's snapshot has its children as `<p>…</p><div>…buttons…</div>` at `[0,2]` and `[0,3]`; the marker render, with children one marker string, records only `[0,2]`. Probe: decision-card.ask placed with "Mine" shows "Mine" *and* the story's "Approve" button. nav (`children: [[0,1]]` over many plan rows) and shell (`[[0,0]]`, the nav, with the story's main after it) are the same shape; and any property recorded *after* such children in the same parent is off by the difference in node count.
- **`<indusk-content>` with no `for`** (A15). compose only reads `<indusk-content>` elements that carry `for`; one without is bare content, so it is poured into `children` as a raw element. Probe: `<indusk-content>Raw</indusk-content>` inside a button composes to `<button><indusk-content>Raw</indusk-content></button>`. The lint allows it (`el.tag === CONTENT_TAG` passes `content-not-words-or-components`, and `named` requires `for`). Nested `<indusk-content>` inside another leaks the inner tag into the outer property the same way.
- **Content given twice** (A16). `wanted` in `renderReference` is a `Map`: a second `<indusk-content for="name">` overwrites the first, and bare words beside `for="children"` are dropped (`!wanted.has("children")`); the lint's `filled` map collapses both the same way, so no finding is raised and words vanish silently.
- **A self-closing reference** (A17). HTML has no self-closing custom elements: parse5 nests every following sibling inside `<indusk-component … />`, and `innerEnd` falls back to the element's end. Probe: `<indusk-component name="button" state="default" /><p>after</p>` composes to `<button><p>after</p></button>`, and the lint reports `<p>` as content of the button — a message that names the wrong cause. No admin mockup is self-closing today (A11 holds either way); an agent writing one is the expected case.

Decisions recorded for this unattended build:
- **The place's shape changes rather than a property being dropped.** The conservative alternative — record no place for a property that shares its text node or whose children span several nodes, so the lint refuses filling it — would make part-section's `summary`, phase-row's `count`, decision-card's and nav's `children` unfillable, which new-project-flow's screens need. Decision: a place becomes `{ at: number[]; nodes?: number; before?: string; after?: string }`; a bare `number[]` (a catalog written before this phase) reads as `{ at }`, so nothing committed needs rewriting by hand and A1–A11's fixtures stay valid.
- **A self-closing reference is read as ending at its start tag**, not refused: the author's intent is unambiguous, and a rule would only tell them to type an end tag the reader could infer.
- **Content given twice is its own rule**, `content-given-twice`, not folded into `component-takes-no-content`: the state does take the property; the message must say "twice".

#### Build Phase 4 Notes

- Verification run in this unattended session: A12, A13, A15, A16, A17 and A1–A11 green; A14 and A5 green in the system tier. `vitest related` also ran `plans-accept-stories` (A25, A33) and an incident test; they fail only because this build step's environment refuses `plans accept` ("not accepted from inside a build step") — unrelated to this phase, not a regression of it.
- `indusk looks stories admin` regenerated `.indusk/mockups/admin/components.json` only; no snapshot changed, so every approval still holds (A11 green). 23 states now record `before`, `nodes` or both (part-section, phase-row, decision-card, nav, shell).

#### Build Phase 4 Hunt record

Searched and found no further attack: approval binding (a mockup's hash is its composed bytes, so any content-map change that changes composition reopens it; nested references are in `uses`, A9); `render`'s outermost-reference skip and the named-content skip spans in `compose`; `contentOf` vs the lint's `mine` (same ownership rule); the sort in `fillAt` for paths of different depth; the admin decorator (it returns `Story()` unwrapped, so the undecorated marker render and the canvas share a root); string args used only as attributes (not marked, not fillable, per the ADR's Risks).

Not pursued, with reasons: the marker render's `catch {}` recording `{}` for a story that throws standalone — the ADR decided that deliberately ("a component that takes no content is a fact, not a failure"), and every admin state with `{}` (device-choice, history-panel, timeline) takes only array or boolean args; an `<indusk-content>` outside any placed component — not content of a component, so outside this plan's promise; words in the live app check — out of scope by the plan's own Scope.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/looks/compose.ts` | fill content at recorded paths, compose nested references |
| `apps/indusk-mcp/src/lib/looks/stories.ts` | the marker render and its content paths |
| `apps/indusk-mcp/src/lib/looks/stories-catalog.ts` | `content` per state in the catalog |
| `apps/indusk-mcp/src/lib/looks/mockups.ts` | hand each snapshot's content map to `compose` |
| `apps/indusk-mcp/src/lib/looks/lint-components.ts` | the two content rules |
| `apps/indusk-mcp/vitest.tiers.ts` | A5 in the system tier |
| `.indusk/mockups/admin/components.json` | regenerated with content maps |
| `apps/docs/src/guide/components.md` | placing a component with its own words |
| `apps/docs/src/decisions/component-content.md` | the published ADR |

## Dependencies
- None.

## Notes
- The marker character is U+2063 (invisible separator), chosen so a marker can never be a story's real words.
