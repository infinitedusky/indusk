---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_story: required
gate_policy: ask
approved_brief: "786345f57fd6c2f12d98a26898242bad05c8184b35956aafdd0269c8d3626d9d"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T23:52:54.548Z"
---

# A plan's page shows all its looks

## Goal

A plan's page shows its looks in two sections, the mockups it proposes and the
stories it has built, each opening in place. A component the plan changes
shows its current build only inside its mockup, labelled as the earlier
plan's build for comparison. A mockup added after approval says so, with the
phase that builds it.

## Scope

### In Scope
- The list of looks the plan page is built from (`readPlanParts` in `apps/indusk-mcp/src/lib/plans/parts.ts`): mockups and this plan's stories apart; the comparison; the added mark.
- Story approvals recording the plan they were made in.
- The plan page's Looks part as a `plan-looks` component with its three stories.

### Out of Scope
- Approving a look from the plan page; approval stays on the Looks page.
- The checks `plans approve` and `plans accept` run on looks; they read mockups their own way and were never fooled.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the tests, failing where the fault is | the test plan |
| Build Phase 1 | `PlanParts.looks` with `today` and `added`; `PlanParts.stories`; story approvals with `plan` | `looks/overview.ts`, `looks/approvals.ts`, `plans/amendments.ts` |
| Build Phase 2 | `PlanLooks` component and stories; `PlanParts.tsx` drawing it | Build Phase 1's lists |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Opening a story in a plan's Stories section draws it in place at each of the app's devices, with no message sending the person to the Looks page | Test Phase 1 | Build Phase 2 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-admin/src/components/plan/PlanParts.test.tsx |
| A2 | Every mockup and every story the plan's page lists comes with a page it can draw | Test Phase 1 | Build Phase 1 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A3 | A look the brief names that is drawn nowhere still reads not drawn yet | Test Phase 1 | Test Phase 1 | planned | unit | promise: every-look-opens-on-its-plan-page | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A4 | For a plan that changes an existing component, its Stories section is empty while that component's story is still the earlier plan's approved build | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-shows-only-its-own-stories | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A5 | Once the plan's build changes that component, its new story appears in the plan's Stories section, waiting for approval | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-shows-only-its-own-stories | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A6 | The changed component's mockup carries a Compare with today's build fold; opened, it draws the current build labelled with the plan that built it, with no approval state or approve link | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-plan-shows-only-its-own-stories | apps/indusk-admin/src/components/plan/PlanParts.test.tsx |
| A7 | A waiting mockup for a changed component reads waiting, whatever the earlier story's state | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-shows-only-its-own-stories | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A8 | story-first-phases' plan page, on its own branch, shows its redrawn phase row as a waiting mockup with today's build in the comparison fold, and an empty Stories section | Build Phase 2 | Build Phase 2 | planned | live check | seen on the plan where the fault was found | |
| A9 | A mockup named in the brief at approval carries no added mark | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-look-added-after-approval-says-so | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A10 | A mockup added to the brief after approval carries Added during build and the phase whose tasks build it | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-look-added-after-approval-says-so | apps/indusk-mcp/src/lib/plans/parts-looks.test.ts |
| A11 | The three states of the Looks part drawn from the real component match the mockups Sandy approved | Build Phase 2 | Build Phase 2 | planned | live check | the looks this plan makes, held by their approval in the cockpit | |

## Checklist

### Test Phase 1: Write every test first, failing

**Tier**: med — the work step's default

Before any code changes, this phase writes the tests that describe the new Looks part. They check that the list behind the plan page keeps the plan's mockups apart from the stories the plan built, that an earlier plan's build of a component is attached to the mockup that changes it as a comparison, and that a mockup added after approval is marked with the phase that builds it. On the page side, they check that a story opens in place and that the comparison fold is labelled and asks for nothing. Most fail today, because the story overwrites the mockup and carries no page. Two pass from the start and guard what must not change: a look drawn nowhere still says so, and a mockup that was in the brief at approval carries no mark.

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [ ] This plan has its own worktree
  <details><summary>Technical</summary>

  `indusk worktree create plan-page-shows-its-looks`, or `indusk worktree assign plan-page-shows-its-looks <path>` for the one `plans start` made — worktree-per-plan default.

  </details>
- [ ] Tests that the list behind the plan page keeps the plan's mockups and its own stories apart, with the earlier build as a comparison, failing for now
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/parts-looks.test.ts`, over a fixture git project (as `check-gates-amendments.test.ts` builds one through `briefAppProject`): one app with mockup `chip.open` approved under `plan: "earlier"` and then edited (reads proposed), story `chip.open` approved with no `plan`; a brief naming `chip.open` under Changes and `never.drawn` under Must not break. A2: every drawn entry in `looks` and `stories` has a non-null `document`, and `chip.open`'s `today.document` is non-null. A3: `never.drawn` reads `undrawn` (green today). A4: `stories` is empty; `chip.open`'s `today.plan` is `"earlier"`. A5: change the story's snapshot in the fixture → `stories` holds `chip.open`, proposed. A7: `looks`' `chip.open` reads proposed (red today: approved, the story's). Red today on A2, A4, A5, A7: there is no `stories`, no `today`, and the story overwrites the mockup.

  </details>
- [ ] Tests that a mockup added to the brief after approval is marked with the phase that builds it, and one named at approval is not
  <details><summary>Technical</summary>

  Same file: approve the fixture plan (`indusk plans approve`), then commit a brief naming `chip.added` under This plan makes with a drawn mockup, and an impl whose `### Build Phase 2: Chips` has a task whose detail names `chip.added`. A9: `chip.open` has `added` falsy (green today: no such field). A10: `chip.added` has `added.phase` equal to `"Build Phase 2: Chips"`; with that task removed, `added.phase` is null (red today).

  </details>
- [ ] Tests that the plan page opens a story in place and shows today's build only as a labelled comparison, failing for now
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/plan/PlanParts.test.tsx` (browser test, as `PhaseRow.test.tsx`), rendering `BriefParts` with fixed `PlanParts` data: `looks` holding `chip.open` proposed with `today: { document: "<p>today's chip</p>", plan: "earlier" }`, and `stories` holding `chip.open` proposed with a document `<p>the new chip</p>`. A1: the Stories section's row opens to an iframe whose `srcdoc` contains "the new chip", with device choices and no text "open it on the Looks page". A6: the mockup row has a closed fold "Compare with today's build"; opened, it shows "Built by earlier", an iframe containing "today's chip", and no "approved"/"proposed" chip or Looks-page link inside it. Red today: `PlanParts` reads neither `stories` nor `today`.

  </details>

#### Regression Guards

- **A3** — an undrawn look reads undrawn today; the row holds that as the list changes shape.
- **A9** — a mockup in the brief at approval has nothing marking it today; the row holds that once the mark exists.

#### Deferred to Build Phase 2

- **A8** — a person reads story-first-phases' plan page once this plan's page changes are running.
- **A11** — the stories of `plan-looks` are rendered from the component Build Phase 2 adds to the catalog.

#### Test Phase 1 Verification

- [ ] The new tests fail on their own assertions, and the two guards pass (A1, A2, A3, A4, A5, A6, A7, A9, A10)
  <details><summary>Technical</summary>

  Red: A1, A2, A4, A5, A6, A7, A10. Green: A3, A9. `cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/parts-looks.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanParts.test.tsx`.

  </details>

### Build Phase 1: The list behind the plan page tells the plan's work from earlier work

**Tier**: med — the work step's default

The plan page is built from one list of the looks a plan's brief names. Today that list is keyed by name, so a component's old story, which carries the same name as the mockup being redrawn, overwrites the mockup, and no story gets a page to draw. This phase rebuilds the list in two parts. The first holds the plan's mockups, each with a page; a mockup that changes an existing component carries that component's current build as a comparison, named with the plan that built it; a mockup added after approval carries the phase that builds it. The second holds only the stories this plan built, each with a page. Approving a story in the cockpit starts recording which plan it was approved in, so a story built and approved by this plan stays listed as this plan's. The plan page itself changes in Build Phase 2.

- [ ] Each mockup in the list carries its page, today's build of its component when there is one, and when it was added if after approval
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/parts.ts`: `PartLook` gains `today: { document: string; plan: string | null } | null` and `added: { phase: string | null } | null`; mockups only (and undrawn names). Build the drawn map per kind (`mockups: Map`, `stories: Map`) instead of one map. A story under a listed name that is not this plan's (below) becomes the mockup's `today`; `today.plan` is the mockup's previous approval's `plan` from `approved.json`, or null.

  </details>
- [ ] The list holds, apart, only the stories this plan built
  <details><summary>Technical</summary>

  `PlanParts.stories: PartStory[]`, `PartStory = { name, approval, document, devices, app }`, from `StoryView` (`looks/overview.ts`, `document` included): a story under a name the brief lists whose approval reads `proposed` in this checkout, or whose approval record's `plan` is this plan.

  </details>
- [ ] A mockup added to the brief after approval gets the phase that builds it
  <details><summary>Technical</summary>

  From `amendments` (already read in `readPlanParts`): each `{ part: "look", was: null, now }`; its phase is the first impl phase whose column-zero task or folded detail names the mockup, read with `parseImplString` (`ImplPhase` heading name), or null while none does.

  </details>
- [ ] A story approved in the cockpit records the plan it was approved in, as a mockup's approval does
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts` and `looks/approve.ts`: when the request is for a story and the checkout is a plan's, write `plan` on the story's approval entry (`StoryApprovalEntry.plan`, already accepted by `looks/approvals.ts`). Add a case to `looks/approvals.test.ts`.

  </details>
- [ ] Shape review of the changed list and approval code
  <details><summary>Technical</summary>

  Per `/work`, over `parts.ts`, `approve.ts`.

  </details>

#### Build Phase 1 Verification

- [ ] The list keeps the plan's mockups and its own stories apart, carries the comparison and the added mark, and still reads an undrawn look as undrawn (A2, A3, A4, A5, A7, A9, A10)
  <details><summary>Technical</summary>

  Green: A2, A4, A5, A7, A10; still green: A3, A9. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/plans/parts-looks.test.ts src/lib/looks/approvals.test.ts && pnpm exec vitest related src/lib/plans/parts.ts src/lib/looks/approve.ts`.

  </details>

#### Build Phase 1 Context

- [ ] The list's own description says how it tells this plan's stories from earlier ones
  <details><summary>Technical</summary>

  mcp: the docblock of `readPlanParts`, `PartLook.today` and `PlanParts.stories` — "a story is this plan's when it reads proposed on the plan's checkout or its approval records this plan; any other story under a listed name is that mockup's `today`" — `promise: a-plan-shows-only-its-own-stories`.

  </details>

#### Build Phase 1 Document

- [ ] The changelog records the change
  <details><summary>Technical</summary>

  Changelog: "A plan's page shows its mockups and the stories it built in two sections, each opening in place; a changed component's current build shows only inside its mockup, for comparison; a mockup added after approval says so."

  </details>

### Build Phase 2: The plan page shows mockups and stories in two sections

**Tier**: med — the work step's default

This is the part Sandy sees. The plan page's Looks part becomes two sections. Mockups lists what the plan proposes, each opening in place; a mockup that changes an existing component has a closed "Compare with today's build" fold that shows the current build, labelled with the plan that built it and asking for nothing; and a mockup added after approval says "Added during build" with the phase that builds it. Stories lists only what this plan has built, each opening in place, and says "none built yet" until there is one. The Looks part becomes a named component in the admin's catalog, with a story for each of the three states Sandy approves as mockups. After this phase, every look of a plan can be looked at from its page, and story-first-phases' page shows its redrawn phase row as waiting.

- [ ] The Looks part draws a Mockups section and a Stories section, every row opening in place
  <details><summary>Technical</summary>

  New `components/plan/PlanLooks.tsx`, `data-component="plan-looks"`: section heads with counts (Mockups: approved of total; Stories: approved of total, or "none built yet" with the empty line from the mockup); each row a `PlanLook` (now taking `kind` and drawing any `document` in `LookFrame`); `PlanParts.tsx` renders it inside the Looks `PartSection`, keyed `${kind}-${relation}-${name}`; the Looks-page link carries `story=` or `mockup=` by kind. Drop "This look is a story; open it on the Looks page."

  </details>
- [ ] A changed component's mockup shows today's build in a labelled comparison fold, asking for nothing
  <details><summary>Technical</summary>

  In `PlanLook`, when `look.today`: a closed `<details>` "Compare with today's build"; opened, "Built by {plan} — today's version, for comparison. Not this plan's to approve." (without "by {plan}" when null) and a `LookFrame` of `today.document`; no approval chip, no link.

  </details>
- [ ] A mockup added after approval says so, with the phase that builds it
  <details><summary>Technical</summary>

  In `PlanLook`, when `look.added`: the "Added during build · for {phase}" label under the name ("Added during build" alone when `phase` is null), styled as the mockup's `.added`.

  </details>
- [ ] The Looks part joins the admin's component catalog, with a story for each state
  <details><summary>Technical</summary>

  `PlanLooks.stories.tsx` with `planning`, `compare-open` and `building`, matching the three mockups; render with `indusk looks stories admin` and confirm `components.json` lists `plan-looks`. Once its story exists the three screens mockups stop declaring `plan-looks` new.

  </details>
- [ ] Pause for a person: Sandy approves the three plan-looks stories against their mockups
  <details><summary>Technical</summary>

  On the Looks page read from this plan's branch (`?checkout=plan-page-shows-its-looks`); the agent proposes, only a person approves. A11 records it.

  </details>
- [ ] Sandy checks story-first-phases' plan page shows its redrawn phase row as waiting
  <details><summary>Technical</summary>

  With this branch's admin running, `/p/dusk/plan/story-first-phases`: `phase-row.open` under Mockups, proposed, with today's build in the comparison fold; Stories empty. A8 records it.

  </details>
- [ ] Shape review of the changed plan-page components
  <details><summary>Technical</summary>

  Per `/work`, over `PlanLooks.tsx`, `PlanLook.tsx`, `PlanParts.tsx`, `PlanLooks.stories.tsx`.

  </details>

#### Build Phase 2 Verification

- [ ] A story opens in place, the comparison fold is labelled and asks for nothing, and Sandy has seen both the looks and a real plan (A1, A6, A8, A11)
  <details><summary>Technical</summary>

  Green: A1, A6; A8 and A11 recorded. `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanParts.test.tsx && pnpm exec vitest related src/components/plan/PlanLooks.tsx src/components/plan/PlanLook.tsx src/components/plan/PlanParts.tsx`; `indusk looks lint admin` reports no raw value.

  </details>

#### Build Phase 2 Context

- [ ] The admin's own rules say how a plan's page shows its looks
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: "a plan's page shows its mockups and the stories it built in two sections, every look opening in place; an earlier plan's build appears only inside the mockup that changes it, labelled for comparison" — `promise: every-look-opens-on-its-plan-page`, `promise: a-plan-shows-only-its-own-stories`.

  </details>

#### Build Phase 2 Document

- [ ] The admin reference page for the plan page describes the Looks part
  <details><summary>Technical</summary>

  Update the plan page section under `apps/docs/src/reference/admin-ui/`: the two sections, the comparison fold, the added mark; approval one click away on the Looks page.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/parts.ts` | mockups with `today` and `added`; `stories` apart |
| `apps/indusk-mcp/src/lib/plans/parts-looks.test.ts` | new |
| `apps/indusk-mcp/src/lib/looks/approve.ts`, `apps/indusk-admin/src/app/api/looks/[app]/approve/route.ts` | a story's approval records its plan |
| `apps/indusk-admin/src/components/plan/PlanLooks.tsx` | new: the two sections |
| `apps/indusk-admin/src/components/plan/PlanLooks.stories.tsx` | new: three states |
| `apps/indusk-admin/src/components/plan/PlanLook.tsx` | any kind in place; comparison fold; added mark |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | uses `PlanLooks` |
| `apps/indusk-admin/src/components/plan/PlanParts.test.tsx` | new |
| `.indusk/mockups/admin/screens/plan-looks.*.html`, `screens.json` | the looks this plan makes |
| `apps/indusk-admin/CLAUDE.md`, `apps/docs/src/reference/admin-ui/…` | rule and reference |

## Dependencies

- None. story-first-phases is easier to approve once this lands, and is not needed by it.

## Notes

- This impl is written in story-first-phases' shape. Until that plan changes the save check, each Verification task carries its row labels in a trailing bracket on its line.
