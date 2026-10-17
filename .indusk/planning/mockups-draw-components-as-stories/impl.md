---
title: "Mockups draw components as their stories do"
date: 2026-10-17
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "78484b2bc83005ef1e5131a986078b2f0812bf72db3823fed2f4aee6a1507981"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T02:59:49.970Z"
---

# Mockups draw components as their stories do

## Goal

A component placed in a mockup draws exactly as its story draws it, and every
story fits its frame, so a person approving a mockup sees the components as they
will be built. Closes the two storybook-components incidents the 1.71.0
release raised.

## Scope

### In Scope

- The component stylesheet generator writes the element resets a story draws
  under, reaching only components; the cockpit loads them under every mockup
  and every story.
- The project card's spacing in `home.default`, once its cause is confirmed.
- Message wraps long unbroken text inside its bubble.
- The promise `mockups-render-in-the-cockpit` says the stronger sentence.

### Out of Scope

- Re-approving the approved mockups; a person's call if one now looks different.
- The test-side refinements to the composition and story-frame checks: they are
  storybook-components' Maintenance, brought in here, not re-done.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the generator's reset tests, red; the two browser checks brought in from `plan/storybook-components`, red on the real defects | the brief, the test plan |
| Build Phase 1 | `componentReset` in `component-styles.ts`; `_reset.css` written by `indusk looks stories`; `mockupDocument` and `storyDocument` loading it | the app's compiled CSS |
| Build Phase 2 | the project card's spacing fix; Message's wrapping; regenerated snapshots; the changed promise | Build Phase 1's reset |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A component built on a link draws in its own ink inside a mockup, as in its story | Test Phase 1 | Build Phase 1 | passing | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/component-styles.test.ts |
| A2 | A component's text field draws in the app's text font and size inside a mockup, as in its story | Test Phase 1 | Build Phase 1 | passing | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/component-styles.test.ts |
| A3 | The resets reach only the components inside a mockup; the page around them draws as before | Test Phase 1 | Build Phase 1 | passing | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/component-styles.test.ts |
| A4 | Every component every admin mockup places draws with its story's computed values | Test Phase 1 | Build Phase 2 | passing | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/__tests__/composition.contract.test.ts |
| A5 | Every story of the admin fits its frame at each device; a long unbroken message wraps in its bubble | Test Phase 1 | Build Phase 2 | passing | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts |
| A6 | A mockup still shows a component only by naming it; one it draws itself is refused unless declared new | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-mockup-composes-approved-components | apps/indusk-mcp/src/lib/looks/compose.test.ts |
| T1 | A story or mockup approved before the app's element rules change reads proposed after they change; an approval recorded without the rules' hash still reads approved | Build Phase 3 | Build Phase 3 | written | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/approvals.test.ts |
| T2 | A story whose component is centred by auto margins is fitted to its component's width, not the frame's | Build Phase 3 | Build Phase 3 | written | contract | promise: mockups-render-in-the-cockpit | apps/indusk-admin/src/app/p/[project]/looks/looks-components.contract.test.ts |

## Checklist

### Test Phase 1: Every test written first, red on the defects

**Tier**: med — the work step's default

This phase brings in the fixed browser checks and writes the generator's tests,
so that every later change is measured from a red start. The composition check
and the story-frame check were repaired on the storybook-components branch and
now fail only on the real drawing defects; merging that branch here makes them
this plan's yardstick. The new tests for the stylesheet generator fail because
it writes no resets yet. Build Phase 1 then makes the generator tests pass.

- [x] This plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree create mockups-draw-components-as-stories` — created by `indusk plans start`; confirm with `indusk worktree list`.

  </details>
- [x] The repaired composition and story-frame checks are on this branch.
  <details><summary>Technical</summary>

  `git merge plan/storybook-components` (commits cc1e18618, 742861018, 04a75ed0a). Landing storybook-components later merges nothing new for them.

  </details>
- [x] Tests that a link component and a text field draw as their stories do inside a mockup, and that the resets touch nothing outside a component, fail for now.
  <details><summary>Technical</summary>

  A1–A3 in `component-styles.test.ts`, against `componentReset(appCss, foundation)`: from compiled CSS holding `a { color: inherit }` and `textarea { font: inherit; font-size: 100% }`, the sheet holds both, each selector scoped `:where([data-component], [data-component] *)` with zero added specificity; a rule naming a class or a component marker is not in it. Red: the export is absent, so these assert on an import that resolves to `undefined` — written with `import * as styles` and `expect(styles.componentReset)` first, so the file loads.

  </details>
- [x] Shape — reviewed a file this phase changed and left it as it is
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/__tests__/composition.contract.test.ts, looks-components.contract.test.ts`: brought in by merging plan/storybook-components, written and shaped in that plan, not this phase

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Regression Guards

- **A6** — the existing composition rule's tests; they pass now and must stay passing, so they have no red window.

#### Test Phase 1 Verification

- [x] The generator's new tests fail on their own assertions, and the two browser checks fail only on the drawing defects.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/component-styles.test.ts` — A1–A3 red on assertions, not on load. A4: `composition.contract.test.ts` reports only the project card and prompt box findings. A5: `looks-components.contract.test.ts` fails on `message.you` not fitted. A6: `vitest run src/lib/looks/compose.test.ts` passes.

  </details>
  Note: 2026-10-17 — A18 (A5) passed, 113 stories, 1390 s; A7 passed; A6 7/7; `vitest related` on the phase's admin files 111/111. A30 (A4) failed once on the card's stretched rows, fixed (`content-start`), then passed in 61 s; A18 not re-run for that change — a card alone in its frame has no extra height to place; the landing's slow tier runs it.

#### Test Phase 1 Context

- [x] Nothing about how the project works changes in this phase; the record says so.
  <details><summary>Technical</summary>

  current.md: this session's section notes the plan is at Test Phase 1 with A1–A5 red.

  </details>

#### Test Phase 1 Document

- [x] The research file records which findings the checks now report.
  <details><summary>Technical</summary>

  `research.md` Findings: the A4 and A5 reports as of this phase.

  </details>

### Build Phase 1: The generator writes the resets a story draws under

**Tier**: med — the work step's default

This phase fixes the cause shared by the project card's colour and the prompt
box's font: a mockup draws components without the browser resets their stories
have. The generator writes those resets into one stylesheet that reaches only
components, and the cockpit loads it under every mockup and every story. The
project card's spacing and Message's wrapping are left for Build Phase 2.

- [x] The stylesheet generator writes the app's element resets as a sheet that reaches only components.
  <details><summary>Technical</summary>

  `componentReset(appCss, foundation)` in `apps/indusk-mcp/src/lib/looks/component-styles.ts`: the rules `elementRulesOf` keeps (no class, no marker), `html`/`:root`/`body` excluded (`_base.css` holds `body`), each selector rewritten under `:where([data-component], [data-component] *)`, resolved through `sheetOf`.

  </details>
- [x] Rendering the stories writes the reset sheet beside the base sheet.
  <details><summary>Technical</summary>

  `stories.ts` writes `components/_reset.css` (constant beside `BASE_STYLESHEET` in `mockups.ts`); `readApp` reads it as `reset` ("" when absent).

  </details>
- [x] The cockpit draws every mockup and every story with the reset sheet loaded.
  <details><summary>Technical</summary>

  `overview.ts`: `mockupDocument` and `storyDocument` put `{ component: "_reset", css: app.reset }` after the tokens and before component sheets. Check whether a mockup's `componentsHash` must cover it; if approval reuse would miss a reset change, add it to the hash.

  </details>
  Decision: `componentsHash` does not cover the reset. `_reset.css` is the app's element rules, as `_base.css` is, and neither is a component's look; a change to the app's element rules was thought to reopen every story through `baseRulesHash`. Corrected in Build Phase 3: `baseRulesHash` governed only a story's look-check reuse (`reuse.ts`), not its approval; approvals now record it themselves, on the story's and the mockup's entry, so a change to the element rules reopens both without `componentsHash` covering `_reset.css`. Folding it into `componentsHash` would send every approved mockup back to proposed at once, which is the re-approval this plan puts out of scope.
- [x] The admin's stylesheets are regenerated with the reset.
  <details><summary>Technical</summary>

  `indusk looks stories admin` in the worktree; commit `.indusk/mockups/admin/components/_reset.css` and any catalog change.

  </details>
  Note: regenerated with `tsx src/bin/cli.ts looks stories admin`; only `_reset.css` is committed. The same run also rewrote `components.json`, dropping `history-panel`'s `entries`/`open`/`className` properties (prop extraction from the Storybook build came back empty for it, twice) and moving `renderedFrom`; that change is outside this plan and was left uncommitted, to be looked at on its own.
- [x] Shape review of the changed generator and cockpit code.
  <details><summary>Technical</summary>

  Against the enabled extensions' rules; findings as unchecked items here.

  </details>
  Reviewed `component-styles.ts`, `mockups.ts`, `overview.ts`, `stories.ts` against the rules: one finding, fixed in place — the "names no class and no marker" predicate was written twice (`elementRulesOf` and `componentReset`) though `componentReset` is defined as `elementRulesOf`'s rules, so they could drift; it is now one named `isElementSelector`. Left as is: the trailing positional `base`/`reset` parameters of `storyDocument` (settled shape of the call, two optionals with defaults; an options object is a cross-file call-site change for `/cleanup`).

#### Build Phase 1 Verification

- [x] The generator's tests pass, and the composition check no longer reports the link colour or the text field's font.
  <details><summary>Technical</summary>

  A1–A3 pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/component-styles.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/looks/component-styles.ts src/lib/looks/overview.ts src/lib/looks/stories.ts`. A4 run: no `color` or `font-*` finding remains.

  </details>
  Result: A1-A3 pass; `vitest related` 35 files, 267 tests pass; typecheck clean; biome clean on `src/lib/looks/` (repo-wide `pnpm check` has errors in files this phase did not touch). A4 (after `pnpm --filter @infinitedusky/indusk-mcp build`, since the admin test reads the package's `dist`) reports no `color` or `font-*` finding; what remains is the project card's `gap` (4px vs 16px) and ~3 px `content-width`, Build Phase 2's.

#### Build Phase 1 Context

- [x] The package's rules say where the resets a story draws under come from.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Promises and telemetry, the looks entries): a mockup and a story frame load `_reset.css`, the app's element rules scoped to components; a component never relies on a reset the generator does not carry.

  </details>

#### Build Phase 1 Document

- [x] The looks reference describes the reset sheet.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`: `_reset.css` beside `_base.css` — what it holds, why, and that it reaches only components.

  </details>

### Build Phase 2: The project card's spacing, Message's wrapping, and the promise

**Tier**: med — the work step's default

This phase clears what the composition and story-frame checks still report and
makes the promise say what is now true. The project card's spacing in the home
mockup is traced to its cause and fixed where it lives; Message wraps long
unbroken text with a class the looks lint accepts; the promise's sentence is
changed; and Sandy approves the changed `message.you` story.

- [x] The project card draws with its own spacing in the home mockup.
  <details><summary>Technical</summary>

  Confirm the cause of `gap: 16px` against the story's `4px` (likely `home.default.html`'s own CSS beating the card's `.gap-1`); fix the mockup's own rule if so, or the component's if not. The ~3 px narrower text boxes go with it or are explained.

  </details>
  Confirmed cause: the card's root carries the utility class `grid` (`grid gap-1 ...`), and the home mockup's own page rule `.grid { display: grid; grid-template-columns: ...; gap: var(--space-4) }`, meant for the container of the cards, matches the card root too and, unlayered and later in the document, beats the component's `.gap-1` (probe in Chromium: matching `gap` rules were `.gap-1 => space-1` and `.grid => space-4`, computed 16px). The same rule gave the card its own `grid-template-columns`, which is the ~3 px narrower text boxes (h2 and p 300 px against 296.656 px). Fixed where it lives: the mockup's container class renamed `.grid` to `.cards` in `.indusk/mockups/admin/screens/home.default.html`; the card now computes gap 4 px and h2 width 296.656 px, as its story. Note: this changes `home.default`'s mockup hash, so its approval reopens for a person.
- [x] A message with long unbroken text wraps inside its bubble.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/ui/Message.tsx`: a standard Tailwind wrapping utility (`wrap-anywhere`) on the bubble, not the arbitrary class e5915cbc4 removed; `pnpm --filter @infinitedusky/indusk-mcp exec indusk looks lint admin` accepts it. Re-render: `indusk looks stories admin`.

  </details>
  Note: `wrap-anywhere` added to the bubble's class list; `looks lint admin` reports no Message finding (only three unrelated `plan-looks` needs-a-story lines, which pre-date this plan). Re-rendered: only Message's six snapshots, `message.css` (gains `.wrap-anywhere`) and their hashes in `components.json` changed; this run did not drop `history-panel`'s props, so `components.json` is committed whole.
- [x] The promise's sentence says each component is drawn as its story draws it, and each story fits its frame.
  <details><summary>Technical</summary>

  `indusk promises change mockups-render-in-the-cockpit --plan mockups-draw-components-as-stories --statement "Each mockup and each story opens in the cockpit at each reference device, drawn with the foundation's tokens and, where it names components, with each component drawn as its own story draws it, and each story fitted to its frame, with nothing to run beside the cockpit." --reason "components drew without the resets their stories have, and a story overflowed its frame"`

  </details>
  Note: ran as written; output: `mockups-render-in-the-cockpit changed by mockups-draw-components-as-stories; its History keeps the sentence it replaced.` Only `.indusk/promises/mockups-render-in-the-cockpit.md` changed.
- [x] A story aligned to its frame's end is fitted to its own size.
  <details><summary>Technical</summary>

  Discovered at this phase: A18 still failed on `message.you` after the wrap — `frame 2380x126, component 4259`. Its root is `justify-self-end`, so it sits at the frame's right edge, and `useFittedFrame`'s `r.right + r.left` grew the frame by the frame's width. `measure` now takes the width as the component's width plus, on both sides, the space a start-aligned component would have before it (the container's content edge and the component's left margin) — the same as before for every start-aligned story. Height is unchanged (`bottom + top`): changing it too made `view-link.default` 4px tall, a collapsed margin counted twice.

  </details>
- [x] The story-frame check has the time every story of the admin takes.
  <details><summary>Technical</summary>

  Discovered at this phase: A18's 580 s limit cannot hold the admin's 113 stories at ~11 s each (1 192 s measured, all fitted); it had only ever stopped early, on `message.you`. Limit raised to 1 800 s in `looks-components.contract.test.ts` — a timeout, no assertion changed. Asked Sandy whether to raise it here or leave it to storybook-components' Maintenance — Sandy: "Raise it here".

  </details>
- [x] The project card draws its shape, in-progress badge and last-seen line itself, so its story and the home mockup show what the home page shows.
  <details><summary>Technical</summary>

  Discovered at this phase: Sandy compared `home.default` with the real home page — the cards differed and the look check held anyway (`looks check admin --only home.default --all`: 6 held), because the page's badges and last-seen line came through `ui/ProjectCard`'s `extra` slot, "not part of the look". `ui/ProjectCard` takes `shape`, `inProgress` and `lastSeen` and draws them; `extra` goes; `components/ProjectCard` passes them. Stories `default`, `in-progress`, `workbench`, each a different project; `home.default` places the three. Sandy: "Do it in this plan."

  </details>
- [x] The home mockup's New project button has the real button's colours.
  <details><summary>Technical</summary>

  `home.default.html`'s `.btn.primary` drew in `--color-dusk` (orange); the page's `NewProjectLink` is `buttonClasses("primary")` — `bg-ink`, `border-ink`, `text-surface`.

  </details>
- [x] Pause for a person: Sandy approves the changed message story.
  Note: approved in the cockpit 2026-10-17 17:11Z — the six message stories, the three project-card stories and `home.default` (`indusk looks status admin`).
  <details><summary>Technical</summary>

  `message.you` in the cockpit's Looks page, now wrapping; approval is Sandy's.

  </details>
- [x] Shape review of the changed component and mockup.
  <details><summary>Technical</summary>

  Against the enabled extensions' rules; findings as unchecked items here.

  </details>
  Note: reviewed `useFittedFrame.ts`, `ui/ProjectCard.tsx`, `ProjectCard.tsx`, `ProjectCard.stories.tsx`, `Message.tsx`, `looks-components.contract.test.ts` (`prepareShapeReview`: no unreadable rules) — nothing to change: `measure` and `leadingSpace` each one job and named for it; the card draws, its wrapper maps registry facts; Message and the test are one-line changes.

- [x] A project card shorter than its row keeps its lines together at the top.
  <details><summary>Technical</summary>

  Discovered at verification: A30 reported `project-card.default … span[3] content-height: story 24px, mockup 30px` — in a grid row a card stretches to the tallest card, and its own grid spread the extra height between its rows (the home page did the same). `content-start` on the card's root; A30 passes. The three card stories need re-approval.

  </details>

#### Build Phase 2 Verification

- [x] Both browser checks pass, and the composition rule still holds.
  <details><summary>Technical</summary>

  A4: `cd apps/indusk-admin && node ../indusk-mcp/scripts/with-daemon-guard.js npx vitest run --config vitest.system.config.ts src/__tests__/composition.contract.test.ts` passes. A5: the same for `src/app/p/[project]/looks/looks-components.contract.test.ts`. A6: `vitest run src/lib/looks/compose.test.ts` passes.

  </details>

#### Build Phase 2 Context

- [x] The admin's rules say a component wraps long text with the standard utility.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md` is over its 16 KB budget: instead, guard: the A5 row's test carries `promise: mockups-render-in-the-cockpit`, so a regression names the promise.

  </details>
  Note: guard confirmed — `looks-components.contract.test.ts` carries `promise: mockups-render-in-the-cockpit`, so an A18 failure names the promise.

#### Build Phase 2 Document

- [x] The changelog records the fix.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`: mockups draw components with their stories' resets; Message wraps long text.

  </details>

### Build Phase 3: Falsification — approvals blind to the resets, centred stories never fitted

**Tier**: med — the work step's default

This phase tests two things the finished plan claims but nothing checks. First, the cockpit now draws every story and mockup under the app's element resets, but an approval is tied only to the component's own markup and stylesheet. A change to the app's element rules changes what every approved look shows without reopening any of them. Second, the frame-fitting reads a component's left margin as space around it, and a component centred by automatic margins has a margin that grows with the frame. Its frame never shrinks, and the story-frame check, which measures the same way, passes anyway. Once this phase closes, an approval reopens when what it was drawn under changes, and a centred story fits its frame.

- [x] An approval of a story or a mockup records the app's element rules it was drawn under, and reads proposed once they change.
  <details><summary>Technical</summary>

  Hypothesis: change `a { color: inherit }` in the app's compiled CSS → `_reset.css` changes and every snapshot draws differently in the cockpit, yet `storyApprovalOf` (keyed on `snapshotHash` + `stylesheetHash` + `boundToNow`'s foundation and declarations) and the mockup's `approvalOf` (`componentsHash`) still read approved. Build Phase 1's note on `componentsHash` rested on a false premise: `baseRulesHash` reopens a story's *look-check reuse* (`reuse.ts`), not its approval. Fix: `approve` records the catalog's `baseRulesHash` on story and mockup entries; `storyApprovalOf` and `approvalOf` compare it when the entry carries one — an entry without it is read as before (absence is a rule, not a migration; the brief does not ask for re-approval).

  </details>
  Note: `LooksApp.baseRulesHash` is read from `components.json` in `readApp`; `approve` (story and mockup) records it as `baseRulesHash` on the entry; `approvalOf` and `storyApprovalOf` compare it when the entry has one (`drawnUnderNow`); an entry without it reads as before. The cockpit's Approve route sends no rules hash of its own and needs no change: it calls `approve`, which reads the checkout's catalog itself under the record's lock, as it does the foundation and declarations. T1 passes (18/18 in `approvals.test.ts`).
- [x] Build Phase 1's note on the reset and approvals says what is true.
  <details><summary>Technical</summary>

  Correct the note under Build Phase 1's cockpit item: the reset is bound into approvals through `baseRulesHash` on the entry, not through look-check reuse.

  </details>
  Note: the Decision under Build Phase 1's cockpit item now says `baseRulesHash` governed look-check reuse only, and that approvals record it from Build Phase 3.
- [x] A component centred by automatic margins counts no margin as space before it when its frame is fitted.
  <details><summary>Technical</summary>

  Hypothesis: a story whose root is `mx-auto max-w-md` — `getComputedStyle(el).marginLeft` returns the *used* value, half the frame's spare width, so `leadingSpace` returns it and the fitted width is the frame's own; the frame stays at the widest device. A18 cannot see it: it computes `left + width + left`, which also equals the frame. Fix in `useFittedFrame.ts`'s `leadingSpace`: a margin whose computed value is `auto` (`el.computedStyleMap().get("margin-left")` is the keyword `auto`) counts as 0.

  </details>
  Note: `leadingSpace` in `useFittedFrame.ts` takes the left margin through `leftMargin`, which reads `computedStyleMap().get("margin-left")` and counts the keyword `auto` as 0, falling back to the computed pixels where `computedStyleMap` is absent. T2 green (red before: `frame 390, component 344 + 2 x 8 = 360`).
- [x] The components fixture has a story centred by automatic margins, and the story-frame test reads it.
  <details><summary>Technical</summary>

  Add a component to `apps/indusk-mcp/src/__tests__/fixtures/components-app` whose root is centred with `mx-auto` and a max width, with a story and a rendered snapshot; T2 opens it on the Looks page and asserts the frame's width is the component's width plus twice the container's content inset — not `left + width + left`.

  </details>
  Note: done test-first at the phase start: `banner.default.html` (root `max-width: 20rem; margin: 0 auto`) in the components fixture, a snapshot only like `card.default` (no source file or catalog entry — it has no stylesheet or content); T2 opens it in the Looks page.

#### Build Phase 3 Verification

- [ ] An approval reopens when the element rules it was drawn under change, and a centred story fits its frame — both failing before the fixes.
  <details><summary>Technical</summary>

  T1: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/approvals.test.ts`. T2: `cd apps/indusk-admin && node ../indusk-mcp/scripts/with-daemon-guard.js npx vitest run --config vitest.system.config.ts -t T2 "src/app/p/[project]/looks/looks-components.contract.test.ts"`.

  </details>

#### Build Phase 3 Context

- [ ] The package's rules say an approval is bound to the element rules its look is drawn under.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the looks entries beside Build Phase 1's `_reset.css` line: a story or mockup approval records `baseRulesHash`; a change to the app's element rules reopens it.

  </details>

#### Build Phase 3 Document

- [ ] The looks reference says a change to the app's element rules reopens approvals.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`, beside the `_reset.css` paragraph.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/looks/component-styles.ts` | `componentReset` |
| `apps/indusk-mcp/src/lib/looks/component-styles.test.ts` | A1–A3 |
| `apps/indusk-mcp/src/lib/looks/stories.ts` | writes `_reset.css` |
| `apps/indusk-mcp/src/lib/looks/mockups.ts` | reads `_reset.css` |
| `apps/indusk-mcp/src/lib/looks/overview.ts` | mockup and story documents load it |
| `apps/indusk-admin/src/components/ui/Message.tsx` | wraps long text |
| `.indusk/mockups/admin/` | regenerated sheets and snapshots; the home mockup's spacing |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/reference/cli/looks.md`, `apps/docs/src/changelog.md` | context and docs |

## Dependencies

- `plan/storybook-components`'s three test commits, merged in Test Phase 1.

## Notes

- After this lands, storybook-components' two Maintenance phases verify A30 and
  A18 green and close the two incidents.
