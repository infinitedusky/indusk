---
title: "Component content — a placed component takes its own words"
date: 2026-10-13
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "ce09d0d9b9bda6ff49a59e1bba93c4b528d33656eb74886eeb798089b19a4c5e"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T21:40:24.962Z"
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
