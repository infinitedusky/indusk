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

- [x] Create/confirm this plan's worktree (`indusk worktree create component-content`, or `indusk worktree assign component-content <path>` for the one `plans start` made) — worktree-per-plan default
- [x] Author A1–A4 in `compose.test.ts`: snapshots handed in as `{ html, hash, content }` with a content map (`content: { children: [[0, 0]] }` for a button, `{ name: [[0, 1, 0]] }` for a step, `{ children: [[0, 1]] }` for a box); A1–A3 RED on their assertions (today's compose drops the content), A4 green
- [x] Author A5 as a system-tier contract test (runs in the checkout over a backup of `.indusk/mockups/admin`, restored after: Vite will not serve the admin's sources through a symlinked or copied tree — decided over the plan's temp copy, red verified on its own assertion) that runs `indusk looks stories admin` into a temp copy and reads `components.json`; add it to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`; RED (no `content` on any state)
- [x] Author A6–A8 against `componentFindings` over a fixture app (a `screens.json`, a `components.json` whose states carry content maps, three mockups); A6 and A7 RED (no such rules), A8 green
- [x] Author A9–A10 against `readApp` and `readStoryApprovals` over a fixture app with an approved mockup that places a button with content; RED (content is dropped, so changing it does not change the hash)
- [x] Author A11 over the repository's own `.indusk/mockups/admin`: every entry in `approved.json` whose mockup still exists reads approved through `readApp`

#### Regression Guards

- **A4** — the no-content composition is today's behaviour; the row exists so filling content cannot change a reference that has none.
- **A11** — every approval made before this plan must survive it; it has no red window by design.

#### Test Phase 1 Verification

- [x] A1–A3, A5–A7, A10 authored and each fails on its own assertion, not on a missing import; **A9 is green today** — `compose` already lists a nested reference in `uses`, so a changed component already reopens a mockup that places it with words; it stays `written` as a guard whose red window is none (decision: keep it, it asserts the promise and costs nothing) (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-lint.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts`; A5 with `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`)
- [x] A4, A8 and A11 pass

### Build Phase 1: Compose fills content

**Tier**: med — the work step's default

- [x] `SnapshotBytes` gains `content?: Readonly<Record<string, number[][]>>` — per property, the child-index paths from the snapshot's root
- [x] `compose` reads each reference's content: bare children → `children`; each `<indusk-content for="p">` → `p`. With none, the snapshot's bytes go in unchanged. With some, the content is composed first (nested references), the snapshot is parsed with `parse5`, the node at each path of a filled property is replaced by the content, and the result serialized
  ```typescript
  export interface SnapshotBytes { html: string; hash: string; content?: Readonly<Record<string, number[][]>> }
  ```
- [x] `ComponentUse` keeps one entry per reference, nested ones included, so `componentsHashOf` still binds every snapshot a mockup composes
- [x] Shape — reviewed `compose.ts`, `markup.ts`, `mockups.ts`: one finding, the inline "content belonging to this reference" predicate in `renderReference` deserved a name — extracted as `contentOf`, done in this phase. `readContentMaps` in `mockups.ts` reads `components.json` raw because `components.ts` imports `mockups.ts` (decision: the catalog's validating reader cannot be imported without a cycle)

#### Build Phase 1 Verification

- [x] A1–A3, A9 and A10 pass; A4 and A11 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts && pnpm exec vitest related src/lib/looks/compose.ts`) — green run alone; under the unattended build's `INDUSK_GATE_POLICY=auto` environment `plans-accept-stories`, `plans-approve-looks` and `release-incident` fail for the environment's reason (accept refused "from inside a build step"), not this change's

#### Build Phase 1 Context

- [x] mcp: the docblock of `looks/compose.ts` — a reference may carry content, bare for `children` or `<indusk-content for>` for a property, filled at the state's recorded paths — `promise: a-placed-component-shows-its-content`

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/components.md`: "Placing a component with its own words" — the two forms, with a button and a step as examples

### Build Phase 2: The render step records where content goes

**Tier**: med — the work step's default

- [x] The generated `afterEach` in `looks/stories.ts` renders each story a second time with every string arg and `children` replaced by `⁣slot:<arg>⁣`, walks the canvas's text nodes for each marker, and writes the child-index paths beside the snapshot (`components/<name>.<state>.content.json`)
- [x] `buildCatalog` in `looks/stories-catalog.ts` puts each state's paths in `components.json` as `content`; `snapshotBytes` in `looks/mockups.ts` hands them to `compose` (decision: `snapshotBytes` lives in `stories-catalog.ts` and only frames bytes; the hand-off is `readApp` reading `components.json` onto each `Story.content`, done in Build Phase 1 so A10 could pass there)
- [x] Run `indusk looks stories admin` and commit the regenerated `components.json` and snapshots
- [x] Shape — reviewed `stories.ts`, `stories-catalog.ts`: nothing to extract. Decision: the marker render only replaces string args the first render shows as a text node plus `children`, so an enum arg (`variant`, `state`) is never overwritten; adjacent text nodes are merged by serialization, so two markers in one text node share one path (noted limitation). Left as is: the generated preview is one string template in `stories.ts` — it is the file's existing shape

#### Build Phase 2 Verification

- [x] A5 passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`); A11 still passes; `pnpm exec vitest related src/lib/looks/stories.ts src/lib/looks/stories-catalog.ts src/lib/looks/mockups.ts`

#### Build Phase 2 Context

- [x] mcp: the docblock of `looks/stories.ts` — the second, marker render and the `content` map it writes per state — `promise: a-placed-component-shows-its-content`

#### Build Phase 2 Document

- [x] `apps/docs/src/guide/components.md`: which properties a state can take, read from `content` in `components.json`

### Build Phase 3: The lint holds content to words and components

**Tier**: med — the work step's default

- [x] `contentFindings` in `looks/lint-components.ts`, joined into `componentFindings`: `content-not-words-or-components` for any element inside a reference other than `<indusk-component>` or `<indusk-content>`; `component-takes-no-content` for a filled property absent from the state's `content` — each naming file, line and value
- [x] Shape — reviewed `lint-components.ts`: `contentFindings` is one reason to change and sits beside the other component rules in the file whose docblock already lists them; no extraction. Left as is: the `mine`/`inside` offset predicates are inline closures because they close over the one reference — naming them would pass four arguments each

#### Build Phase 3 Verification

- [x] A6–A8 pass; A1–A5, A9–A11 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-component-content-lint.test.ts && pnpm exec vitest related src/lib/looks/lint-components.ts`); `indusk looks lint admin` reports no new finding over the existing admin mockups

#### Build Phase 3 Context

- [x] guard: the two rules' messages name `promise: placed-content-is-only-words-and-components` (both messages end with it; `indusk looks lint admin` reports no new finding)

#### Build Phase 3 Document

- [x] `apps/docs/src/guide/components.md`: the two lint rules and what each message means
- [x] `apps/docs/src/decisions/component-content.md`: the ADR, published; changelog entry "Added — a placed component takes its own words"

### Build Phase 4: Falsification — places recorded from one render, filled in another

**Tier**: med — the work step's default

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

- [x] `looks/stories.ts`, the generated `contentPaths`: record each place against the first render's shape. Normalize a clone of `canvasElement` (the snapshot's serialization merges adjacent text nodes) and align the marker render to it parent by parent: where the clone's parent has M children and the marker render's N, the marker's place spans `nodes: M − N + 1` and every later sibling's index shifts by `M − N`; two markers in one parent whose counts differ is ambiguous and records neither (the lint then refuses filling it). Where a marker's text node carries other text, record that text as `before` / `after` (A14)
- [x] `looks/stories-catalog.ts` and `looks/components.ts` (`CatalogState.content`), `looks/mockups.ts` (`readContentMaps`, `Story.content`), `looks/compose.ts` (`SnapshotBytes.content`): the place type `{ at, nodes?, before?, after? }`, read through one normalizer that accepts a bare `number[]` as `{ at }`; regenerate `.indusk/mockups/admin/components.json` with `indusk looks stories admin` and commit it with the snapshots
- [x] `looks/compose.ts`, `fillAt`: replace `nodes` (default 1) siblings from the place, and wrap the content in the place's `before` / `after` text; sort places so a multi-node replacement cannot move a later place (A12, A13)
- [x] `looks/markup.ts`: a self-closing `<indusk-component … />` ends at its start tag — `end` and `innerEnd` are the start tag's end, so `compose` replaces only it and the lint sees its followers as siblings (A17)
- [x] `looks/compose.ts`: an `<indusk-content>` with no `for` is never bare content and never emitted — it contributes nothing to the composed bytes (A15)
- [x] `looks/lint-components.ts`, `contentFindings`: an `<indusk-content>` with no `for`, or inside another `<indusk-content>`, is `content-not-words-or-components` naming file and line (A15); a property filled twice is `content-given-twice` naming the component, the property and both lines (A16); add `content-given-twice` to `LintRule` in `lint-types.ts`
- [x] Shape step for this phase over `compose.ts`, `stories.ts`, `markup.ts`, `lint-components.ts` — reviewed, nothing found; left as is: `contentFindings` in `lint-components.ts` is long but is one job (a mockup's placed content to findings, rule by rule) and splitting it would scatter the shared `mine`/`nested` ownership facts; `fillPlaces` in `compose.ts` was made to take every property's places together so a node-count change cannot move a place still to be filled (found while making A13 green)

#### Build Phase 4 Verification

- [x] A12, A13, A15, A16, A17 authored red at phase start, each on its own assertion, then green (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/looks-component-content-falsification.test.ts`)
- [x] A14 authored red, then green after the regenerated catalog (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-component-content.contract.test.ts`); A5 in the same file still green
- [x] A1–A11 still green (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/looks/compose.test.ts src/__tests__/looks-component-content-lint.test.ts src/__tests__/looks-component-content-approval.test.ts src/__tests__/looks-admin-approvals-hold.test.ts && pnpm exec vitest related src/lib/looks/compose.ts src/lib/looks/markup.ts src/lib/looks/lint-components.ts`); `indusk looks lint admin` reports no new finding

#### Build Phase 4 Context

- [x] mcp: the docblock of `looks/compose.ts` — a place is recorded from a second render and holds only where the two renders agree; it carries the node count and the static words around it, so compose replaces exactly the property's words — `promise: a-placed-component-shows-its-content`

#### Build Phase 4 Document

- [x] `apps/docs/src/guide/components.md`: a place's `nodes` / `before` / `after` in `components.json`, the `content-given-twice` rule, and that `<indusk-content>` always names `for`; the ADR's Risks in `apps/docs/src/decisions/component-content.md` gain the two shapes this phase found (words around a property; children of several nodes) and how the place records them

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
