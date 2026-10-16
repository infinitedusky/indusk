---
title: "A nav row reads at a glance"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "9f72b46fd2e1a0cc95e09275ad587bd4e5bc495d6ac89b815b8aeac5e95593ed"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T15:18:16.077Z"
---

# A nav row reads at a glance

## Goal

A plan's row in the admin nav stays two lines: the title, then the stage with
the worktree as a small textless ⎇ mark 8 px after it. Hovering or clicking the
mark widens it in place to the worktree's name, truncated inside the row, and
never opens the plan. Today `PlanItem` (`apps/indusk-admin/src/components/PlanList.tsx`)
puts `WorktreeChip` — a `Tag` reading "⎇ name" — inside `PlanRow`'s `stage`
slot, with no gap, inside the row's one link. The mark must be a control of
its own, outside the link: a button inside an `<a>` is invalid HTML and its
click would follow the link. See [brief.md](brief.md) and the approved mockups
`.indusk/mockups/admin/screens/{plan-row.worktree,worktree-mark.closed,worktree-mark.open}.html`.

## Scope

### In Scope
- A new presentational component `worktree-mark` (`components/ui/WorktreeMark.tsx`), closed and open, with a story per state.
- `PlanRow` takes a `worktree` slot rendered beside the stage and outside the link; a row with no worktree renders exactly as today.
- `PlanItem` passes the mark through the slot instead of the chip in the stage; `Worktrees.tsx`'s chip becomes the nav's mark wrapper.
- A `Worktree` story for `plan-row`; `indusk looks stories admin`, `indusk looks lint admin` and `indusk looks coverage admin`.

### Out of Scope
- What the stage says — `nav-stage-matches-plan-page`.
- The plan page header's worktree tag (`PlanFrame.tsx`), which is not in the nav.
- The worktree on a line of its own, or a reserved third line (declined in the brief).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `PlanList.worktree.test.tsx` (every row of this plan but the served-page guard), the register | `PlanList`, `Nav`, `globals.css`, `PlanList.test.tsx`'s mocks; `http-plan-worktrees.test.ts` as it stands |
| Build Phase 1 | `WorktreeMark` (`components/ui/WorktreeMark.tsx`); `PlanRow`'s `worktree` slot and its container form; `PlanItem` and `Worktrees.tsx` wired to them | the approved mockups' sizes and tokens; `ButtonOrLink`; `nav-hide` / `nav-mark` in `globals.css` |
| Build Phase 2 | `WorktreeMark.stories.tsx` (`Closed`, `Open`), `PlanRow.stories.tsx` `Worktree`; regenerated `components.json` and `components/{worktree-mark,plan-row}.css`; docs | Build Phase 1's components |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan with a worktree shows its title on line one and its stage on line two, with a textless mark on the stage's line 8 px after the stage; the row is no taller than a row without a worktree | Test Phase 1 | Build Phase 1 | written | unit | promise: a-nav-row-keeps-its-parts-apart | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A2 | Clicking the mark does not open the plan; a click on the row's title, badge or stage lands on the plan's link | Test Phase 1 | Build Phase 1 | written | unit | promise: a-nav-row-keeps-its-parts-apart, promise: every-plan-is-one-click-away | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A3 | Hovering the mark widens it in place on the stage's line to show the worktree's name; leaving closes it | Test Phase 1 | Build Phase 1 | written | unit | promise: a-nav-row-keeps-its-parts-apart | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A4 | Clicking the mark, or Enter or Space on it, opens it to the name with aria-expanded true; again closes it with aria-expanded false | Test Phase 1 | Build Phase 1 | written | unit | promise: a-nav-row-keeps-its-parts-apart | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A5 | An open mark with a long worktree name ends in an ellipsis inside the row; the row keeps its width and two lines, and the nav does not scroll sideways | Test Phase 1 | Build Phase 1 | written | unit | promise: a-nav-row-keeps-its-parts-apart, promise: the-nav-fits-a-phone | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A6 | In a collapsed nav, a row with a worktree shows only its badge, no mark, as tall as any other row, and a click on the badge lands on the plan's link | Test Phase 1 | Test Phase 1 | written | unit | promise: every-plan-is-one-click-away, promise: the-nav-fits-a-phone | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A7 | A plan without a worktree is drawn as today: no mark, and the whole row is one link to the plan | Test Phase 1 | Test Phase 1 | written | unit | promise: every-plan-is-one-click-away | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A8 | Served by the admin, an assigned plan's nav row still names its worktree in the page with the mark closed | Test Phase 1 | Test Phase 1 | written | contract | a regression guard over admin-plan-worktrees' served-sidebar test, which the closed, textless mark must keep passing through its label | apps/indusk-admin/src/__tests__/http-plan-worktrees.test.ts |
| A9 | In a plan row with a worktree, hovering the plan's title shows the full name on hover as a tooltip: the element under the pointer, or the link it belongs to, carries the name as its title | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-nav-row-keeps-its-parts-apart | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A10 | Focusing the plan's link by keyboard in a row with a worktree draws a focus indicator around the whole row, as the row without a worktree does, not only around the title | Build Phase 3 | Build Phase 3 | passing | unit | promise: every-plan-is-one-click-away | apps/indusk-admin/src/components/PlanList.worktree.test.tsx |
| A11 | A plan row given `worktree={null}` or `worktree={false}` is drawn exactly as a row given none: one link, no container | Build Phase 3 | Build Phase 3 | passing | unit | promise: every-plan-is-one-click-away | apps/indusk-admin/src/components/ui/PlanRow.worktree.test.tsx |

### Deferred Verification

- **Whether the row reads at a glance**
  - reason: a judgement of the look, not a measurement; the brief sets no expectation for it
  - would require: nothing a test can give — a person looking at the drawn row
  - mitigation: a person approves the `worktree-mark.closed`, `worktree-mark.open` and `plan-row.worktree` stories against their approved mockups in the cockpit before `plans accept`, which holds the plan until each new component has an approved story

## Checklist

### Test Phase 1: Write the nav row's tests first, failing where the worktree is crowded in today

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before any component changes, this phase writes one browser test file that draws the real nav with the real stylesheet and measures a plan's row: where the title, stage and worktree mark sit, what a click at the centre of each part lands on, what hovering and clicking the mark does, how a long worktree name fits, and what a collapsed nav shows. The tests about the mark fail today, because the worktree is a tag with its name, crowded into the stage's text inside the plan's link. Two tests pass today and must keep passing: a collapsed nav still shows only the badge and the badge still opens the plan, and a plan without a worktree is still one link. An existing test that boots the admin and finds the worktree's name in the served sidebar also passes today, and must keep passing once the closed mark shows no text. The next phase builds the mark and the row's new form.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree create nav-row-legible`, or `indusk worktree assign nav-row-legible /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible` for the one `plans start` made — worktree-per-plan default.

  </details>
- [x] Write the browser tests that a plan's row keeps its title, stage and worktree mark apart, and that the mark opens to its name without opening the plan, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/components/PlanList.worktree.test.tsx`, opening with `// promise: a-nav-row-keeps-its-parts-apart`, `// promise: every-plan-is-one-click-away`, `// promise: the-nav-fits-a-phone`. `import "@/app/globals.css"` (as `LookRow.test.tsx` does) so the foundation and `nav-hide` / `nav-mark` rules apply; the `next/link` and `promises/display` mocks of `PlanList.test.tsx`, plus `next/navigation`'s `usePathname` if `NavPlanRow` needs it. Render `<Nav project="p">` (and `collapsed` for the collapsed case) around `<PlanList>` with `mockPlan`s, one carrying `worktree: { name: "nav-stage-matches-plan-page", path: "/wt/nav-stage-matches-plan-page", branch: "plan/nav-stage-matches-plan-page" }`, one without; `page.viewport(1280, 900)`. The mark is found as `[data-testid="plan-worktree"] button` (the wrapper is the page's, the button the component's). Positions come from `getBoundingClientRect`; "a click lands on" is `document.elementFromPoint(centre)?.closest(...)`.

  - A1: the title's box is above the stage's; the mark's vertical centre is within the stage line's box; `mark.left - stageText.right` is 8 (± 0.5); the mark's text, trimmed, is `⎇`; the row's height equals the worktree-less row's. Red today: no button, the tag reads "⎇ nav-stage-matches-plan-page".
  - A2: `elementFromPoint` at the mark's centre has no `a` ancestor; with a click listener on the plan's link that calls `preventDefault` and counts, `userEvent.click(mark)` counts 0, and `elementFromPoint` at the title's, the badge's and the stage text's centres each resolve `closest('a[data-plan-name="…"]')` to the plan's link. Red today: no button (and the tag is inside the link).
  - A3: `userEvent.hover(mark)` → the name is visible on the stage's line (its box's vertical centre within the stage line) and the row's height is unchanged; `userEvent.unhover(mark)` → the name is gone. Red today: no button.
  - A4: `userEvent.click(mark)` → `aria-expanded="true"` and the name visible; again → `"false"` and gone; with focus on the mark, `userEvent.keyboard("{Enter}")` and `"{ }"` each toggle it. Red today: no button.
  - A5: a worktree named with 80 characters, opened by click, in a nav 280 px wide: the name's `scrollWidth > clientWidth` and its computed `text-overflow` is `ellipsis`; the mark's right edge is within the row's; the row's width and height are as before opening; `document.documentElement.scrollWidth <= innerWidth`. Red today: no button.
  - A6 (collapsed): no element of the mark is visible (`checkVisibility()` false, or no box); the row's height equals the worktree-less row's; `elementFromPoint` at the badge's centre resolves `closest('a[data-plan-name]')` to the plan's link. Passes today.
  - A7: the worktree-less row's `[data-component="plan-row"]` is itself `a[data-plan-name]` with the plan's `href`, and holds no `[data-testid="plan-worktree"]`. Passes today.

  </details>
- [x] Confirm the test of the served sidebar still finds the worktree's name, and mark it as guarding this plan's row.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/__tests__/http-plan-worktrees.test.ts` A3 ("the sidebar row for an assigned plan names its worktree") reads `wt-alpha` within 600 characters after `data-testid="plan-worktree"` in the served HTML. Add a comment beside it naming this plan: the closed mark shows no text, so the name rides in the mark's label (`aria-label` / `title`). No assertion changes. A8.

  </details>
- [x] Confirm no new test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  The test imports only `PlanList`, `Nav` and `globals.css`, which exist; the red rows fail on finding no button, an assertion.

  </details>

#### Regression Guards

- **A6** — the collapsed nav already shows only the badge and the badge is inside the plan's link today; the row guards that taking the link off the badge's element, if the build does, never makes a collapsed row dead or taller.
- **A7** — a row with no worktree is one link today and must stay exactly that, so the seven approved plan-row stories and the nav looks that compose them are untouched.
- **A8** — the served sidebar names the worktree today, in the tag's text; the row guards that the textless mark keeps the name where the page can be read for it.

#### Test Phase 1 Verification

- [x] The new tests exist, the ones about the mark fail because there is no mark yet, and the two guards pass.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible/apps/indusk-admin && pnpm exec vitest run src/components/PlanList.worktree.test.tsx` — A1–A5 red, each on its own assertion (no `[data-testid="plan-worktree"] button`); A6 and A7 green.

  </details>
- [x] The test of the served sidebar still passes.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible/apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/http-plan-worktrees.test.ts` — A8 green (it boots `next dev`; no other dev server on the app dir).

  Note: A8 (that file's A3) passes. Five other tests in the file (A1, A4, A7, A14, A22 — the active-phase bar reads null/undefined) fail with this phase's edit being a comment only, so they predate this plan; not this plan's to fix.

  </details>

### Build Phase 1: The worktree becomes a mark beside the stage, outside the plan's link

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase builds the small worktree mark as a component of its own: a bordered ⎇ with no text that, while hovered or after a click, widens on the same line to show the worktree's name, cut short with an ellipsis when the row is narrow, and says to a screen reader whether it is open. The plan row learns to hold that mark beside its stage without putting it inside the link to the plan: a row with a worktree is drawn as a container whose title is the link, stretched over the whole row so the badge, the number and the stage still open the plan, with the mark lifted above it as its own button. A row with no worktree is drawn exactly as before. The nav's plan list then hands each plan's worktree to the row as a mark, keeping the worktree's name in the mark's label so the served page still names it. A collapsed nav still shows only the badge, and the badge still opens the plan. The next phase gives the mark and the new row their stories so a person can approve them against the mockups.

- [x] Add the worktree mark as a component of its own: a small bordered glyph that widens in place to the worktree's name while hovered or after a click, and back.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/components/ui/WorktreeMark.tsx`, `"use client"`, root `<button type="button" data-component="worktree-mark" data-state={open ? "open" : "closed"} aria-expanded={open} aria-label={`Worktree ${name}`} title={…}>`:

  ```typescript
  export interface WorktreeMarkProps {
    /** The worktree's name, shown when open and always in the label. */
    name: string;
    /** Where it is, for the title: "Read from the worktree at <path> (<branch>)". */
    title?: string;
    /** Opened by a click from the start: for a story. */
    open?: boolean;
  }
  ```

  Open is `pinned || hovered`: a click toggles `pinned`; `onPointerEnter` / `onPointerLeave` set `hovered`. Enter and Space toggle through the native button. Classes from the mockups' `.wm` / `.wm-name` on the foundation: `inline-flex min-w-0 shrink items-center gap-1 h-…(leading-2) px-1 rounded-md border border-line bg-surface text-2xs leading-1 text-ink-soft`, and when open `border-dusk text-dusk`; the name `truncate font-mono text-2xs leading-1`, rendered only when open. No raw values (`indusk looks lint admin`).

  </details>
- [x] Let a plan row hold a worktree mark beside its stage, outside the link to the plan, with the row still opening the plan from its title, badge, number and stage, and a row with no worktree unchanged.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/ui/PlanRow.tsx`: new optional `worktree?: ReactNode` — "Beside the stage, outside the row's link: the worktree mark." When it is `undefined`, render exactly today's `ButtonOrLink` root (same attributes, same order — the seven existing stories' snapshots must not move). When given, the root is a `div` carrying `data-component="plan-row"`, `data-state`-free, the same grid/border/current classes plus `relative`; the title is the `ButtonOrLink` (`href`, `aria-current`, `title`, and `...rest` so `data-plan-name` lands on the link) with an `after:absolute after:inset-0 after:rounded-lg` overlay covering the row; the stage line becomes `flex min-w-0 items-center gap-2` holding the stage's truncating span and then `<span className="nav-hide relative z-[1] flex min-w-0">{worktree}</span>` (a z-index token if the foundation names one; otherwise the lint decides). The link must not sit inside an element a collapsed nav hides, or the collapsed row's badge goes dead: keep `nav-hide` on the title's text and on the stage line, not on the link's box, and add a collapsed-nav rule in `globals.css` beside the existing `nav-hide` / `nav-mark` rules if the row grows a hidden grid track. Tests decide: A1, A2, A6, A7.

  </details>
- [x] Make the nav's plan list pass each plan's worktree to its row as a mark, keeping the worktree's name and location in the mark's label.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/Worktrees.tsx`: replace `WorktreeChip` with `PlanWorktreeMark({ plan })`, returning `null` without `plan.worktree`, else `<span data-testid="plan-worktree"><WorktreeMark name={name} title={`Read from the worktree at ${path} (${branch})`} /></span>` — the test id in the page's wrapper, never in the component's markup (admin rule: a piece a test must find goes in a wrapper or a slot). Update the file's docblock. `PlanList.tsx` `PlanItem`: drop `<WorktreeChip plan={plan} />` from `stage`; pass `worktree={plan.worktree ? <PlanWorktreeMark plan={plan} /> : undefined}` to `NavPlanRow` (whose props type is `PlanRowProps` minus `current`/`href`, so it passes through). `grep -rn WorktreeChip apps/indusk-admin/src` is empty after.

  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.
  - Reviewed, nothing found: `WorktreeMark`, `PlanRow`'s two forms and `PlanWorktreeMark` each have one job. Left as is: `PlanRow`'s container form repeats the badge and stage markup of the link form — a row with no worktree must stay byte-identical, so the two forms stay separate.
  - Note: `http-plan-worktrees.test.ts` A1, A4, A7, A14, A22 fail identically on `main`, before this change; A3 (this plan's A8) passes.

#### Build Phase 1 Verification

- [x] The tests of the nav row now pass: the mark sits apart from the stage, opens on hover and click without opening the plan, fits the row, hides in a collapsed nav, and a row without a worktree is unchanged.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible/apps/indusk-admin && pnpm exec vitest run src/components/PlanList.worktree.test.tsx && pnpm exec vitest related src/components/ui/PlanRow.tsx src/components/ui/WorktreeMark.tsx src/components/Worktrees.tsx src/components/PlanList.tsx --run` — A1–A5 green, A6 and A7 still green; `PlanList.test.tsx`, `cockpit-nav.test.tsx` and `cockpit-phone.test.tsx` among the related, green.

  </details>
- [x] The served sidebar still names the worktree, and the admin type-checks.
  <details><summary>Technical</summary>

  `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/http-plan-worktrees.test.ts` — A8 green. `pnpm exec vitest run src/__tests__/typecheck.test.ts` (or `pnpm exec tsc --noEmit`) clean; `pnpm check` clean on the changed files.

  </details>

#### Build Phase 1 Context

- [x] The admin's own context file says the nav's worktree is a mark outside the row's link.
  <details><summary>Technical</summary>

  admin (`apps/indusk-admin/CLAUDE.md`): in the entry that reads "`components/Worktrees.tsx` renders the worktree chip, …", say it renders the nav's worktree mark (`PlanWorktreeMark` → `WorktreeMark`) and the plan header keeps its tag; and in the nav entry: "a control in a row is a sibling of the row's link, never inside it — `PlanRow`'s `worktree` slot draws the row as a container with its title's link stretched over it. Guarded by `PlanList.worktree.test.tsx` — `promise: a-nav-row-keeps-its-parts-apart`."

  </details>

#### Build Phase 1 Document

- [x] The admin's reference says a plan's worktree shows as a mark beside its stage that opens to its name.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, where the nav's rows are described: the worktree is a ⎇ mark beside the stage; hover or click shows its name; it does not open the plan.

  </details>

### Build Phase 2: The mark and the new row get their stories, for a person to approve

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

A new component, and a new state of an existing one, are approved by a person from their stories, rendered from the real components. This phase writes a story for the closed mark, the open mark and a plan row with a worktree, renders every story into the snapshots and the component catalog the looks tools read, and runs the checks that no raw value crept in and that each new state has its story. The existing plan-row stories must render unchanged; the plan-row's stylesheet does change, so the nav looks that compose plan rows read proposed again until a person re-approves them. The approvals are the person's, in the cockpit, and the plan is not accepted until they are given.

- [x] Write a story for the closed mark, the open mark, and a plan row with a worktree.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/components/ui/WorktreeMark.stories.tsx` (`title: "ui/WorktreeMark"`): `Closed` (`name: "looks-check-speed"`) and `Open` (`name: "looks-check-speed"`, `open: true`) — the names the mockups show, so the story ids give states `closed` and `open`. `PlanRow.stories.tsx`: `Worktree` — `initials: "NS"`, `state: "needs"`, `name: "The nav says where a plan is"`, `stage: "Approve the brief"`, `worktree: <WorktreeMark name="nav-stage-matches-plan-page" />` (the mockup's second row); a comment line above it as the others have.

  </details>
- [x] Render the stories into the snapshots and catalog, and confirm the existing plan-row stories render unchanged.
  <details><summary>Technical</summary>

  From the worktree root: `indusk looks stories admin`. `git diff .indusk/mockups/admin/components.json` shows `worktree-mark` added (file, properties, states closed/open) and `plan-row` gaining state `worktree` and the `worktree` property; the `snapshotHash` of `plan-row`'s needs, working, released, current, numbered, idle and queued states unchanged. If one moved, the no-worktree form's markup changed — fix `PlanRow` until it does not.

  </details>
- [x] Confirm the looks checks find no raw value and list the new states as stories awaiting approval, and that the mockups still pass the lint now the mark has a story.
  <details><summary>Technical</summary>

  `indusk looks lint admin` — no finding (no `duplicate component`, no `component markup outside its file`). If the lint now asks the `plan-row.worktree` mockup to compose `worktree-mark` by `<indusk-component name="worktree-mark" state="…">` instead of drawing it under its `indusk-new-components` declaration, rewrite that mockup to compose it; it then reads proposed for the person. `indusk looks coverage admin` — `worktree-mark.closed`, `worktree-mark.open`, `plan-row.worktree` listed as stories awaiting approval, nothing else new; `screens.json` `uncatalogued` does not grow.

  </details>
- [x] Ask the person to approve the three new stories, and re-approve any nav look the changed row reopened, in the cockpit.
  <details><summary>Technical</summary>

  The person approves `worktree-mark.closed`, `worktree-mark.open` and `plan-row.worktree` on the Looks page against their approved mockups; `nav.expanded`, `nav.collapsed` and `nav.wide` read proposed if `components/plan-row.css` changed, and are the person's to re-approve. The agent approves nothing. `plans accept` waits on these.

  </details>
- [x] Shape — review the stories against the enabled extensions' craft rules.

#### Build Phase 2 Verification

- [x] (no tests flip at this phase — reason: stories and generated looks files; the rows passed in the phase before)
- [x] The story tests render every story, the new ones included, without an error, and the nav row's tests still pass.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible/apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts --project storybook` green; `pnpm exec vitest run src/components/PlanList.worktree.test.tsx` — A1–A7 still green.

  </details>
- [x] The brief and the promise registry still agree.
  <details><summary>Technical</summary>

  `indusk promises contract nav-row-legible` exits 0; `indusk promises check` exits 0.

  </details>

#### Build Phase 2 Context

- [x] The admin's context file counts the new component among those in the components folder.
  <details><summary>Technical</summary>

  admin (`apps/indusk-admin/CLAUDE.md`): the entry "A component a mockup names is one file, with a story per state…" says "Nineteen in `components/ui/`" — bring the count up to date with `worktree-mark` (count the `data-component` roots under `components/ui/` rather than adding one to a number that may already be stale).

  </details>

#### Build Phase 2 Document

- [x] The component list in the admin's reference names the worktree mark and the plan row's new state, and the changelog records the change.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/component-conventions.md`: a `worktree-mark` row (`src/components/ui/WorktreeMark.tsx`, closed, open) and `worktree` added to `plan-row`'s states; the count in the prose brought up to date. `apps/docs/src/changelog.md` (Unreleased): "The admin nav keeps each plan's row to two lines: a plan's worktree is a small ⎇ mark beside its stage that shows the worktree's name on hover or click, without opening the plan."

  </details>

### Build Phase 3: Falsification — what the stretched link takes from the row

**Tier**: med — the work step's default

The finished row hands its whole click area to a link stretched over the row by an overlay. This phase tests three things that move with that overlay: whether a name cut short in the row can still be read in full by hovering it, whether keyboard focus still marks the whole row, and whether a caller who passes an empty value for the worktree still gets today's row. Each that fails today is fixed here; once it closes, the worktree row loses nothing a row without a worktree has.

- [x] A plan's title in a row with a worktree shows its full name when hovered, as it does in a row without one.
  <details><summary>Technical</summary>

  A9. In the container form of `PlanRow` (`apps/indusk-admin/src/components/ui/PlanRow.tsx`) the `title={name}` sits on the inner span, but the link's `after:absolute after:inset-0` overlay is the element under the pointer and the link itself has no `title`, so the tooltip never shows. Put `title={name}` on the link in the container form (the span's can stay).

  </details>
- [x] Focusing the plan's link by keyboard in a row with a worktree marks the whole row.
  <details><summary>Technical</summary>

  A10. The focus outline is drawn on the link's own box, the title; the no-worktree row outlines its whole root anchor. Give the container form's link a `focus-visible:after:outline` (foundation tokens, no raw values) on its overlay, and `focus-visible:outline-none` on the link, so the ring follows the overlay.

  </details>
- [x] A plan row given an empty worktree is drawn as a row without one.
  <details><summary>Technical</summary>

  A11. `PlanRow` tests `worktree !== undefined`; `null` or `false` (what `cond && <Mark/>` yields) is a valid `ReactNode` and switches to the container form with an empty slot. Test `worktree != null && worktree !== false`.

  </details>

#### Build Phase 3 Verification

- [x] The three tests failed before the fixes and pass after, and the earlier nav-row tests still pass.
  <details><summary>Technical</summary>

  A9, A10 authored in `PlanList.worktree.test.tsx`, A11 in a new `ui/PlanRow.worktree.test.tsx`, red at the phase's start. `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-row-legible/apps/indusk-admin && pnpm exec vitest run src/components/PlanList.worktree.test.tsx src/components/ui/PlanRow.worktree.test.tsx` — A1–A11 green. `INDUSK_ADMIN_SYSTEM_TIER=1 pnpm exec vitest run --project storybook` green and `indusk looks stories admin` leaves the existing plan-row snapshot hashes unchanged (the new focus rule is on the container form only; if `plan-row.worktree`'s hash moves, it is re-approved by the person).

  </details>

#### Build Phase 3 Context

- [x] The admin's context file records that a stretched link carries its own title and focus ring.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, in the nav entry already naming the `worktree` slot: "the stretched link carries the title and the focus ring, since the overlay is what the pointer and focus meet."

  </details>

#### Build Phase 3 Document

- [x] (none needed — asked: "Build Phase 3 is internal fixes with no change to what the docs say. Can I skip the document gate?" — user: "yes skip it")
  <details><summary>Technical</summary>

  Gate policy is `ask`: ask the person before checking this off with proof.

  </details>

**Looked at, no hypothesis formed:** the collapsed nav (the link becomes the overlay and the slot stays hidden), hover/click state races in `WorktreeMark` (touch, mouse and keyboard orders all end in the same state), the phone drawer's tap handling (the mark is not an anchor), consumers of `data-plan-name` (all tests; none in source read the badge inside the link), the served sidebar's name (`aria-label`), and the open mark squeezing the stage text (the approved mockup shrinks the stage the same way).

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-admin/src/components/ui/WorktreeMark.tsx` | new: the `worktree-mark` component |
| `apps/indusk-admin/src/components/ui/WorktreeMark.stories.tsx` | new: `Closed`, `Open` |
| `apps/indusk-admin/src/components/ui/PlanRow.tsx` | `worktree` slot; container form with the title's link stretched over the row |
| `apps/indusk-admin/src/components/ui/PlanRow.stories.tsx` | `Worktree` story |
| `apps/indusk-admin/src/components/Worktrees.tsx` | `WorktreeChip` → `PlanWorktreeMark` |
| `apps/indusk-admin/src/components/PlanList.tsx` | `PlanItem` passes the mark through the slot |
| `apps/indusk-admin/src/app/globals.css` | a collapsed-nav rule for the container row, if needed |
| `apps/indusk-admin/src/components/PlanList.worktree.test.tsx` | new: the trajectory |
| `apps/indusk-admin/src/__tests__/http-plan-worktrees.test.ts` | a comment naming this plan beside the sidebar test |
| `.indusk/mockups/admin/components.json`, `.indusk/mockups/admin/components/{worktree-mark,plan-row}.css` | regenerated by `indusk looks stories admin` |
| `.indusk/mockups/admin/screens/plan-row.worktree.html` | composes `worktree-mark` by name, only if the lint asks |
| `apps/indusk-admin/CLAUDE.md` | the worktree mark entry; the component count |
| `apps/docs/src/reference/admin-ui/overview.md`, `component-conventions.md`, `apps/docs/src/changelog.md` | docs |

## Dependencies

- The three looks the brief names, `plan-row.worktree`, `worktree-mark.closed` and `worktree-mark.open`, approved as mockups (done, 2026-10-16).
- Their stories approved by a person in the cockpit before `plans accept`.
- `nav-stage-matches-plan-page` touches the same row (`PlanItem`'s stage); whichever lands second merges over the other.

## Notes

- Why the mark is outside the link: a `<button>` inside an `<a>` is invalid HTML (interactive content inside interactive content), and a click on it would also follow the link unless every handler stops it. A container row whose title's link is stretched over it by an overlay keeps every part of the row but the mark one click to the plan, and is the shape the approved `plan-row.worktree` mockup draws (a `div` row, the link on the name).
- A row with a worktree has the badge and number outside the link's element, though inside its click area; `cockpit-nav.test.tsx` reads the badge and number inside `a[data-plan-name]`, which holds only because its fixture plans have no worktree. A2 and A6 check the click area itself.
- Open on hover sets `aria-expanded` as a click does, because the approved open mockup styles the open mark by that attribute; a pointer leaving closes a hover-opened mark but not a clicked one.
