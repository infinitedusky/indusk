---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_story: required
gate_policy: ask
---

# A plan's page shows all its looks

## Goal

Every look a plan names can be looked at on the plan's own page, a story
drawn in place as a mockup is, and a mockup that shares its name with a story
shows beside it with its own state, so a mockup waiting for approval never
reads as approved.

## Scope

### In Scope
- The list of looks the plan page is built from (`readPlanParts` in `apps/indusk-mcp/src/lib/plans/parts.ts`): one entry per kind drawn under a name; stories carry their page.
- The plan page's look (`PlanLook.tsx`) drawing either kind in place.
- `plan-look` as a catalog component with its two stories.

### Out of Scope
- Approving a look from the plan page; approval stays on the Looks page.
- The checks `plans approve` and `plans accept` run on looks; they read mockups their own way and were never fooled.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the tests, failing where the fault is | the test plan |
| Build Phase 1 | `PartLook.kind`; one entry per kind; a story's `document` | `looks/overview.ts`'s `StoryView.document` |
| Build Phase 2 | `PlanLook` drawing stories; keys by kind; `plan-look` in the catalog with stories | Build Phase 1's list |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Opening a story on a plan's page draws it in place at each of the app's devices, with no "open it on the Looks page" message | Test Phase 1 | Build Phase 2 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-admin/src/components/plan/PlanLook.test.tsx |
| A2 | Every drawn look in a plan's list of looks, story or mockup, comes with a page the plan page can draw | Test Phase 1 | Build Phase 1 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A3 | A look the brief names that is drawn nowhere still reads not drawn yet | Test Phase 1 | Test Phase 1 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A4 | A look that is both a mockup and a story is listed twice, one of each kind with its own approval; a proposed mockup beside an approved story reads proposed | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-mockup-and-its-story-show-apart | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A5 | The Looks part's count reads one proposed mockup and one approved story as 1 of 2 approved | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-mockup-and-its-story-show-apart | apps/indusk-admin/src/lib/plan-parts-view.test.ts |
| A6 | story-first-phases' plan page, on its own branch, shows its redrawn phase row's mockup as proposed and its story as approved, as two rows | Build Phase 2 | Build Phase 2 | planned | live check | seen on the plan where the fault was found | |
| A7 | The two plan-look states drawn from the real component match the mockups Sandy approved | Build Phase 2 | Build Phase 2 | planned | live check | the looks this plan makes, held by their approval in the cockpit | |

## Checklist

### Test Phase 1: Write every test first, failing

**Tier**: med — the work step's default

Before any code changes, this phase writes the tests that describe the fix. They check that the plan's list of looks gives a story a page to draw and keeps a mockup and its same-named story apart, and that the plan page draws a story in place. These fail today, because the story overwrites the mockup and carries no page. Two tests pass from the start and guard what must not change: a look drawn nowhere still says so, and the count on the plan page counts every entry.

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [ ] This plan has its own worktree
  <details><summary>Technical</summary>

  `indusk worktree create plan-page-shows-its-looks`, or `indusk worktree assign plan-page-shows-its-looks <path>` for the one `plans start` made — worktree-per-plan default.

  </details>
- [ ] Tests that the plan's list of looks keeps a mockup and its story apart and gives each a page to draw, failing for now
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/parts-looks.test.ts`, over a fixture project with one app whose `screens/` holds `chip.open.html` (a mockup, approved, then edited so it reads proposed) and whose story record holds an approved story `chip.open` with a snapshot; a brief naming `chip.open` under Changes and `never.drawn` under Must not break. A2: every entry with `approval !== "undrawn"` has a non-null `document` (red: the story's is null). A3: `never.drawn` reads `undrawn` (green). A4: two entries named `chip.open`, `kind: "mockup"` proposed and `kind: "story"` approved (red: one entry, the story's). Build the fixture as `looks-component-content-approval.test.ts` does.

  </details>
- [ ] A test that a story opened on the plan page is drawn in place, failing for now
  <details><summary>Technical</summary>

  A1 in `apps/indusk-admin/src/components/plan/PlanLook.test.tsx` (browser test, as `PhaseRow.test.tsx`): render `PlanLook` with a `PartLook` of `kind: "story"`, a `document` of `<p>the story</p>` and two devices; click Open; assert an iframe (the `LookFrame`) whose `srcdoc` contains "the story", device choices for both devices, no text "open it on the Looks page", and `data-kind="story"` on the wrapper with the row labelled Story. Red today: `PlanLook` reads no `kind` and labels any look with a document as a mockup, and sets no `data-kind`.

  </details>
- [ ] A test that the plan page's count counts a waiting mockup and its approved story as two entries, one approved
  <details><summary>Technical</summary>

  A5 in `apps/indusk-admin/src/lib/plan-parts-view.test.ts`: `looksSummary` over parts with a proposed mockup and an approved story of the same name → `"1 of 2 approved"`. Green today; it guards the count once two entries per name arrive.

  </details>

#### Deferred to Build Phase 2

- **A6** — a person reads story-first-phases' plan page once this plan's page changes are running; nothing to author before them.
- **A7** — the stories of `plan-look` are rendered from the component Build Phase 2 adds to the catalog.

#### Regression Guards

- **A3** — an undrawn look reads undrawn today; the row holds that as the list changes shape.
- **A5** — the count already counts entries; the row holds it once a name can give two entries.

#### Test Phase 1 Verification

- [ ] The new tests fail on their own assertions, and the two guards pass (A1, A2, A3, A4, A5)
  <details><summary>Technical</summary>

  Red: A1, A2, A4. Green: A3, A5. `cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/parts-looks.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanLook.test.tsx src/lib/plan-parts-view.test.ts`.

  </details>

### Build Phase 1: The plan's list of looks keeps mockups and stories apart

**Tier**: med — the work step's default

The plan page is built from one list of the looks a plan's brief names. Today that list is keyed by name, so when a mockup and a story share a name the story overwrites the mockup, and a story is given no page to draw. This phase fixes the list: a name drawn as both a mockup and a story gives two entries, each saying which kind it is and carrying its own approval, and a story's entry carries the page the Looks page already draws for it. The plan page does not change yet; Build Phase 2 draws from the fixed list.

- [ ] Each look in the plan's list says whether it is a mockup or a story
  <details><summary>Technical</summary>

  `PartLook` in `apps/indusk-mcp/src/lib/plans/parts.ts` gains `kind: "mockup" | "story" | null` (null when undrawn).

  </details>
- [ ] A name drawn as both a mockup and a story gives two entries, mockup first, and a story's entry carries its page
  <details><summary>Technical</summary>

  Replace the `drawn: Map<string, Drawn>` with `Map<string, Drawn[]>`, pushing a mockup's entry then a story's; the story's `document` is `s.document` (`StoryView.document` from `looks/overview.ts`). `looks` becomes `listedLooks(brief).flatMap(...)`: each drawn entry with `{ name, relation, kind, ... }`, or one undrawn entry with `kind: null`.

  </details>
- [ ] Shape review of the changed list
  <details><summary>Technical</summary>

  Per `/work`, over `parts.ts`.

  </details>

#### Build Phase 1 Verification

- [ ] The list keeps the mockup and its story apart and gives each a page, and an undrawn look still reads undrawn (A2, A3, A4)
  <details><summary>Technical</summary>

  Green: A2, A4; still green: A3. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/plans/parts-looks.test.ts && pnpm exec vitest related src/lib/plans/parts.ts`.

  </details>

#### Build Phase 1 Context

- [ ] The list's own description says a name can give one entry per kind
  <details><summary>Technical</summary>

  mcp: the docblock of `readPlanParts` and of `PartLook.kind` — "a look drawn as both a mockup and a story is listed once per kind; a story carries its page" — `promise: a-mockup-and-its-story-show-apart`.

  </details>

#### Build Phase 1 Document

- [ ] The changelog records the fix
  <details><summary>Technical</summary>

  Changelog: "A plan's page shows a mockup and its same-named story as two rows with their own states; a mockup waiting for approval no longer reads approved."

  </details>

### Build Phase 2: The plan page opens every look in place

**Tier**: med — the work step's default

This is the part Sandy sees. The plan page's row for a look now draws a story in place, at each of the app's devices, the same way it draws a mockup, and shows a mockup and its same-named story as two rows. The row becomes a named component in the admin's catalog, with a story for each of the two states Sandy approves as mockups. After this phase, every look a plan names can be looked at from its plan page, and story-first-phases' page shows its redrawn phase row as waiting.

- [ ] Opening a story on the plan page draws it in place, as a mockup is drawn
  <details><summary>Technical</summary>

  `components/plan/PlanLook.tsx`: draw `look.document` in `LookFrame` for either kind; choose `LookRow`'s `kind` from `look.kind ?? "mockup"`; set `data-kind` on the wrapper; drop "This look is a story; open it on the Looks page."; keep the Looks-page link for approving.

  </details>
- [ ] The plan page and the brief page keep a mockup and its story as separate rows
  <details><summary>Technical</summary>

  `components/plan/PlanParts.tsx`: key each `PlanLook` by `${l.kind}-${l.relation}-${l.name}`; the Looks-page link carries `story=` for a story and `mockup=` for a mockup.

  </details>
- [ ] The plan page's look row joins the admin's component catalog, with a story for each state
  <details><summary>Technical</summary>

  `PlanLook.stories.tsx` with `pair` (a proposed mockup and an approved story named `phase-row.open`) and `story-open` (a story opened at three devices); `data-component="plan-look"` on the wrapper; render with `indusk looks stories admin` and confirm `components.json` lists `plan-look`. The two screens mockups stop declaring `plan-look` new once its story exists.

  </details>
- [ ] Pause for a person: Sandy approves the two plan-look stories against their mockups
  <details><summary>Technical</summary>

  `plan-look.pair` and `plan-look.story-open` on the Looks page, read from this plan's branch (`?checkout=plan-page-shows-its-looks`); the agent proposes, only a person approves. A7 records it.

  </details>
- [ ] Sandy checks story-first-phases' plan page shows its waiting phase row
  <details><summary>Technical</summary>

  With this branch's admin running, open `/p/dusk/plan/story-first-phases`: `phase-row.open` reads as a proposed mockup and an approved story, and the story opens in place. A6 records it.

  </details>
- [ ] Shape review of the changed plan-page components
  <details><summary>Technical</summary>

  Per `/work`, over `PlanLook.tsx`, `PlanParts.tsx`, `PlanLook.stories.tsx`.

  </details>

#### Build Phase 2 Verification

- [ ] A story opens in place on the plan page, the count still reads right, and Sandy has seen both on a real plan (A1, A5, A6, A7)
  <details><summary>Technical</summary>

  Green: A1; still green: A5; A6 and A7 recorded. `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanLook.test.tsx src/lib/plan-parts-view.test.ts && pnpm exec vitest related src/components/plan/PlanLook.tsx src/components/plan/PlanParts.tsx`; `indusk looks lint admin` reports no raw value.

  </details>

#### Build Phase 2 Context

- [ ] The admin's own rules say every look opens on its plan page
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: "a plan's page draws every look it names in place, story or mockup; a name drawn as both shows as two rows" — `promise: every-look-opens-on-its-plan-page`.

  </details>

#### Build Phase 2 Document

- [ ] The admin reference page for the plan page describes the Looks part
  <details><summary>Technical</summary>

  Update the plan page section under `apps/docs/src/reference/admin-ui/`: stories open in place; a mockup and its story show apart; approval is one click away on the Looks page.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/parts.ts` | `PartLook.kind`; one entry per kind; a story's page |
| `apps/indusk-mcp/src/lib/plans/parts-looks.test.ts` | new |
| `apps/indusk-admin/src/components/plan/PlanLook.tsx` | draws stories in place; `data-kind` |
| `apps/indusk-admin/src/components/plan/PlanLook.test.tsx` | new |
| `apps/indusk-admin/src/components/plan/PlanLook.stories.tsx` | new: `pair`, `story-open` |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | keys by kind; link by kind |
| `apps/indusk-admin/src/lib/plan-parts-view.test.ts` | the count guard |
| `.indusk/mockups/admin/screens/plan-look.pair.html`, `plan-look.story-open.html`, `screens.json` | the looks this plan makes |
| `apps/indusk-admin/CLAUDE.md`, `apps/docs/src/reference/admin-ui/…` | rule and reference |

## Dependencies

- None. story-first-phases is easier to approve once this lands, and is not needed by it.

## Notes

- This impl is written in story-first-phases' shape. Until that plan changes the save check, each Verification task carries its row labels in a trailing bracket on its line.
