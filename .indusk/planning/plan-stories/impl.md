---
title: "Plan titles and stories"
date: 2026-10-14
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "6969084f4c82f8d416fb0f82af9106c575e0516bbbde08591ca6492816721ef8"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-15T00:14:23.699Z"
---

# Plan titles and stories

## Goal

Every plan is named by its title in the admin and the editor, the handle kept for links; a master plan's page tells its story from a new `subplan-row` component; Needs you lists a plan waiting on an amendment by the same rule as its page; and every live plan gets its title written where the admin reads it (ADR decisions 1–7).

## Scope

### In Scope
- One title rule in the package (`planTitle`, `readPlanName`), read from the brief or the master, carried on the admin's `Plan`, and used by the health line.
- `subplans:` entries that carry a title and description for a plan not yet started.
- The master plan page (`plan.master`) and `SubplanRow` (`subplan-row.released|draft|queued`).
- `planWaiting` knowing amendments; the decision route refusing one.
- Titles in the nav, Needs you, Paths, the plan and brief pages' heading and crumb; the nav story retitled and its mockups re-approved.
- Titles and descriptions written into every plan that is not archived, where the admin reads it.
- `indusk promises change a-plan-reads-by-its-title`.

### Out of Scope
- Retitling archived plans (brief: Not promised).
- Closing, archiving or merging the plans research flagged (Sandy's call).
- The root master's own heading in the nav (`root.title`), which names the project's master, not a plan.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `planTitle` (words fallback), `readPlanName`, `readHealthNames` over `master.md`, the health line's fallback, `PlanDeclarations.declaredTitles`, `Plan.title` / `Plan.description` | `display.ts`, `plan-parser.ts`, `planning-reader.ts` |
| Build Phase 2 | `planWaiting`'s `amendments` input and `on: "amendment"`, `amendmentsWaiting`, an async `readWaiting`, the decision route's refusal | `waiting.ts`, `amendments.ts`, `approved-brief.ts`, `decisions-reader.ts` |
| Build Phase 3 | the nav, Needs you, Paths and `PlanFrame` named by `plan.title`; the retitled `Nav` story and re-approved nav mockups | `Plan.title` (Build Phase 1) |
| Build Phase 4 | `SubplanRow` and its stories, `lib/master-story.ts`, `MasterStory`, `plan.master` look state, `/doc/master`, recomposed `plan.master`, the changed promise | `declaredTitles`, `Plan.title` (Build Phase 1), `buildGroups` |
| Build Phase 5 | titles and descriptions in every live plan's brief or master | the rule (Build Phase 1), the pages (Build Phases 3–4) |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A master plan's page opens with the master's title as its heading and what the master is for beneath it, then how many of its plans are released, in draft and queued; the released count is the one its Path shows in the nav | Build Phase 1 | Build Phase 4 | planned | unit | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx |
| A2 | The page lists every plan the master declares, in the declared order, numbered from 1, each by its title with its description | Build Phase 1 | Build Phase 4 | planned | unit | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx |
| A3 | A released plan's row says "Released" and opens that plan; a plan in draft or being built says its stage as the nav says it and opens that plan; a declared plan with no folder says "Queued", is dimmed, opens nothing, and shows the title and description its master wrote | Build Phase 1 | Build Phase 4 | planned | unit | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx |
| A4 | A master keeps its plans in declared order whether each is written as a name alone or as a name with a title and description; a plan declared by name alone with no folder reads as its handle in words with no description | Test Phase 1 | Build Phase 1 | written | unit | promise: a-master-plan-tells-its-story | apps/indusk-mcp/src/lib/__tests__/plan-declarations.test.ts |
| A5 | A master plan's page tells the look check it draws `plan.master`, whatever state the master's own documents are in | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/lib/look-state.test.ts |
| A6 | `plan.master`, the retitled plan and nav screens and the three `subplan-row` stories read approved, and the running admin holds each by value at every reference device in a real browser, against a fixture master with a plan in each stage | Test Phase 1 | Build Phase 4 | planned | contract | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/__tests__/plan-stories.contract.test.ts |
| A7 | Live: on the running admin, Day's and Dawn's master pages each say what the master is for and list every plan in order with its title, description and stage | Build Phase 5 | Build Phase 5 | planned | live check | a live check of a-master-plan-tells-its-story and the brief's first expectation, recorded in Build Phase 5; the promise is proven by A1, A2, A3 and A6 | manual: recorded in Build Phase 5's Verification |
| A8 | A plan whose brief has a short title is named by it; one with no title, or a title that is only its handle, reads as its handle in words ("cockpit-redraw" reads "Cockpit redraw", product words spelled their way) | Test Phase 1 | Build Phase 1 | written | unit | promise: a-plan-reads-by-its-title | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A9 | A master plan is named by the title written in its `master.md`, and its description is the one written there | Test Phase 1 | Build Phase 1 | written | unit | promise: a-plan-reads-by-its-title | apps/indusk-mcp/src/lib/promises/display.test.ts |
| A10 | In the editor, a promise whose plan the checkout cannot read is grouped under that plan's handle in words, never the bare handle | Test Phase 1 | Build Phase 1 | written | unit | promise: a-plan-reads-by-its-title | apps/indusk-mcp/src/__tests__/promise-health-names.test.ts |
| A11 | Every plan row and Path in the nav, and every plan under Needs you, reads by its title with initials from that title; each still links to `/p/<project>/plan/<handle>` | Test Phase 1 | Build Phase 3 | written | unit | promise: a-plan-reads-by-its-title | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A12 | The plan page's and the brief page's heading and crumb read the plan's title; the address keeps the handle | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-plan-reads-by-its-title | apps/indusk-admin/src/app/p/[project]/plan/[name]/header.test.tsx |
| A13 | A plan worked in its own worktree is named by the title written in that worktree's brief, not the trunk's | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-plan-reads-by-its-title | apps/indusk-admin/src/lib/planning-reader.title.test.ts |
| A14 | A plan waiting only on an amendment is reported as waiting on the person, at its Brief step; an approved plan with no amendment and nothing else waiting is not | Test Phase 1 | Build Phase 2 | written | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A15 | That plan is listed under Needs you on every page, as its own page already says it waits | Test Phase 1 | Build Phase 2 | written | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A16 | An answer sent to an amendment's wait through the plan's decision is refused, pointing at the amendment card, and the plan is neither approved nor released | Build Phase 2 | Build Phase 2 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A17 | Every active plan is still one click away from the plan page, the dashboard and a promise page, now under its title | Test Phase 1 | Test Phase 1 | planned | unit | promise: every-plan-is-one-click-away | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A18 | Paths and their plans keep the declared order, nesting and released counts under their titles | Test Phase 1 | Test Phase 1 | planned | unit | promise: paths-keep-their-order | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx, apps/indusk-admin/src/lib/plan-groups.test.ts |
| A19 | With a plan whose title is as long as the longest written, the drawer at 400 px still leaves no page scrolling sideways | Test Phase 1 | Test Phase 1 | planned | unit | promise: the-nav-fits-a-phone | apps/indusk-admin/src/app/p/[project]/cockpit-phone.test.tsx |
| A20 | The plan page still opens with the description, now under the title, and whether the brief is finished, one click from the brief | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/components/plan/PlanSummary.test.tsx, apps/indusk-admin/src/__tests__/plan-page-layout.test.tsx |
| A21 | The admin and the editor name a plan by the package's one title rule; neither holds a second | Test Phase 1 | Test Phase 1 | planned | unit | regression: display-names' single definition, which the title changes in the package, the admin and the editor touch | apps/indusk-mcp/src/__tests__/display-names-single-definition.test.ts |

### Deferred Verification

- **The retitled names say what each plan is (test plan U1)**
  - reason: a judgement of wording, not an observable rule
  - would require: a person reading them
  - mitigation: Sandy reads the retitle commits at review; the second expectation's count (Build Phase 5 Verification) lists every live plan still read by its handle

## Checklist

### Test Phase 1: Author the assertions, RED

**Tier**: med — the work step's default

**Goal**: author every row that can honestly be authored now, and record the ones that cannot.

- [x] Author A8, A9 in `display.test.ts`: `planTitle(undefined, "cockpit-redraw")` and `planTitle("cockpit-redraw", "cockpit-redraw")` read "Cockpit redraw", `planTitle(undefined, "vscode-extension")` reads "VS Code extension"; `readHealthNames` over a temp project with `.indusk/planning/day/master.md` (`title: "InDusk v4: Day"`, `description: "…"`) names `day` "InDusk v4: Day". RED: today the folder name comes back and `master.md` is not read. Replace the two existing `toBe("my-plan")` expectations with the words, since they assert the old rule
- [x] Author A10 in `promise-health-names.test.ts`: a promise owned by `gone-plan`, with no `planTitles` entry, carries `planTitle` "Gone plan". RED: `?? p.owner` gives the handle
- [x] Author A4 in `plan-declarations.test.ts`: a temp `parent/master.md` with `subplans: [one, { name: two, title: "Second", description: "The second." }, three]` declares `["one", "two", "three"]`, and `declaredTitles.parent.two` is `{ title: "Second", description: "The second." }`; a names-only master declares as before with no titles. RED: the mapping entry is dropped today (`stringArray`)
- [x] Author A14 in `waiting.test.ts`: an approved plan snapshot with `amendments: [{ plan: "p", count: 1 }]` and no session or build is reported `on: "amendment"`, step "Brief"; the same plan with no amendment is not reported; a question still outranks the amendment. RED: `planWaiting` ignores `amendments`. (indusk-mcp's tsconfig excludes tests, so the new input compiles in vitest and fails on its assertion)
- [x] Author A11 in `cockpit-nav.test.tsx`: each fixture plan in `TITLES` (alpha-one, beta-one, beta-two, gamma-one, undeclared-plan) has a nav row whose visible name is its title and whose link is `/p/cockpit-proj/plan/<handle>`; a Path row reads its parent's title; the row's initials are `initialsOf(title)`. RED: rows show the handle
- [x] Author A15 in `cockpit-nav.test.tsx`: add an `AMENDED` set to `cockpit-fixture.ts` naming one approved fixture plan that waits on nothing else (the mock ignores it until Build Phase 2); the test expects `a[data-needs-you="<that plan>"]` on the plan page, the dashboard and a promise page. RED: the nav does not list it
- [ ] Author A12 in `header.test.tsx`: the plan page's `h1` and crumb read `titleOf(plan)` for a fixture plan with a title, and the brief page's the same; the page's `data-plan-name` keeps the handle. RED: both show the handle
- [ ] Author A6 in `plan-stories.contract.test.ts`, listed in `vitest.tiers.ts` `SYSTEM`. Move `cockpit-redraw.contract.test.ts`'s throwaway-project builder (`plan`, `doc`, `brief`, `impl`, the `looks-fixture-*` plans, the `dusk` registration) into `src/__tests__/helpers/looks-fixtures.ts`, with A10's assertions unchanged, and add a fixture master named `indusk-v4-day` (the path `screens.json` already declares for `plan.master` and `subplan-row`) with a `description:` and `subplans:` naming `looks-fixture-sub-released` (archived, its retrospective saying `Landed on main at abc1234, 2026-10-01.` and the fixture config's `workflow.steps.release.changelog` naming it in a dated release), `looks-fixture-sub-draft` (a draft brief) and `{ name: looks-fixture-sub-queued, title, description }`. Screens: `plan.master`, `plan.parts`, `plan.working`, `plan.needs-you`, `plan.released`, `nav.expanded`, `nav.wide`; stories: `subplan-row.released`, `subplan-row.draft`, `subplan-row.queued`; the same three checks as A10 (approved, held, never-checked fails), with A10's `nav.wide` carve-out below 760 px. RED: `plan.master` is not reported and the `subplan-row` stories do not exist
- [ ] A19: give one fixture plan in `cockpit-fixture.ts` a title as long as the longest written (`Contract UI — the admin organised around premises, promises and phases`, 72 characters), and add `promise: the-nav-fits-a-phone` beside `cockpit-phone.test.tsx`'s A7, which passes today and must keep passing once the nav draws titles
- [ ] Add the row tokens to the regression guards: `promise: every-plan-is-one-click-away` (already in `cockpit-nav.test.tsx`, A17), `promise: paths-keep-their-order` to `plan-groups.test.ts` (A18), `promise: a-plan-page-shows-the-parts-of-its-brief` (already in `PlanSummary.test.tsx` and `plan-page-layout.test.tsx`, A20); A21 is `display-names-single-definition.test.ts` as it stands
- [ ] Confirm each red row fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 1

- **A1, A2, A3**: the fixture they render needs `Plan.title`, `Plan.description` and `PlanDeclarations.declaredTitles`, which Build Phase 1 introduces, and the admin's tests are type-checked (`typecheck.test.ts`), so the file would fail `tsc` today. Written red at the end of Build Phase 1, passing at Build Phase 4. Body reviewed:

  ```tsx
  // master.test.tsx — the cockpit fixture's path-beta as the master: beta-one
  // released, beta-two being built, and beta-three declared with a title and
  // description but no folder (added to DECLARATIONS.subplans and declaredTitles).
  const open = async (name: string) =>
    render((await PlanPage({ params: Promise.resolve({ project: PROJECT, name }) })) as React.ReactElement);

  it("A1 opens with the master's title, what it is for, and its counts", async () => {
    const screen = await open("path-beta");
    await expect.element(screen.getByRole("heading", { level: 1 })).toHaveTextContent(titleOf("path-beta"));
    await expect.element(screen.getByTestId("master-purpose")).toHaveTextContent(DESCRIPTIONS["path-beta"]);
    await expect.element(screen.getByTestId("master-counts")).toHaveTextContent("1 of 3 released");
    await expect.element(screen.getByTestId("master-counts")).toHaveTextContent("1 drafts");
    await expect.element(screen.getByTestId("master-counts")).toHaveTextContent("1 queued");
  });

  it("A2 lists every declared plan in order, numbered, by title with its description", async () => {
    const screen = await open("path-beta");
    const rows = [...screen.container.querySelectorAll('[data-component="subplan-row"]')];
    expect(rows.map((r) => r.querySelector("[data-testid=subplan-number]")?.textContent)).toEqual(["1", "2", "3"]);
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual([
      titleOf("beta-one"), titleOf("beta-two"), "Beta three, queued",
    ]);
    expect(rows[0]?.textContent).toContain(DESCRIPTIONS["beta-one"]);
  });

  it("A3 a released row opens its plan, a draft says its stage, a queued one opens nothing", async () => {
    const screen = await open("path-beta");
    const row = (s: string) => screen.container.querySelector(`[data-component="subplan-row"][data-state="${s}"]`);
    expect(row("released")?.getAttribute("href")).toBe(`/p/${PROJECT}/plan/beta-one`);
    expect(row("released")?.textContent).toContain("Released");
    expect(row("draft")?.getAttribute("href")).toBe(`/p/${PROJECT}/plan/beta-two`);
    expect(row("draft")?.textContent).toContain("Building");
    expect(row("queued")?.tagName).not.toBe("A");
    expect(row("queued")?.textContent).toContain("Queued");
    expect(row("queued")?.textContent).toContain("The third, not started.");
  });
  ```
- **A13**: its subject is `Plan.title`, a field Build Phase 1 adds; `tsc` refuses it today. Written and passing in Build Phase 1. Body reviewed:

  ```ts
  // planning-reader.title.test.ts — a temp project whose plan `p` is assigned to
  // a worktree (the assignment record the reader reads, set up as
  // planning-reader.workflow.test.ts sets up its plans), the trunk's brief
  // saying `title: "Trunk name"`, the worktree's `title: "Worktree name"` and
  // `description: "From the worktree."`.
  it("A13 names a worktree plan by its worktree's brief", async () => {
    const [p] = await readActivePlans(root);
    expect(p?.title).toBe("Worktree name");
    expect(p?.description).toBe("From the worktree.");
  });
  ```

#### Deferred to Build Phase 2

- **A16**: it builds a `Waiting` with `on: "amendment"`, a member `WaitingOn` gains in Build Phase 2; the admin's `tsc` refuses it today. Body reviewed:

  ```ts
  it("A16 an answer to an amendment's wait is refused and neither approves nor releases", async () => {
    const approve = vi.fn(async () => {});
    const release = vi.fn(async () => {});
    const waiting: Waiting = {
      plan: "p", on: "amendment", step: "Brief", decision: AMENDMENT_DECISION,
      accept: "Approve", alternative: "Not yet",
    };
    // `deps` is the file's own DecisionDeps builder, with approve and release replaced.
    await expect(
      answerDecision({ ...deps(), approve, release }, "proj", waiting, { choice: "accept" }),
    ).rejects.toThrow(/amendment card/);
    expect(approve).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
  ```

#### Deferred to Build Phase 4

- **A5**: `planLookState` gains its `master` input in Build Phase 4, and `"plan.master"` joins `PlanLookState` there; `tsc` refuses both today. Body reviewed:

  ```ts
  it("A5 a master plan's page draws plan.master whatever its own documents say", () => {
    for (const briefStatus of [null, "draft", "accepted"])
      for (const waiting of [false, true])
        expect(planLookState({ archived: false, waiting, briefStatus, master: true })).toBe("plan.master");
  });
  ```

#### Deferred to Build Phase 5

- **A7**: a live check, no body.

#### Regression Guards

- **A17**: `cockpit-nav.test.tsx`'s "lists all forty plans … each linking to its page" already proves it; the row holds it while rows change from handles to titles.
- **A18**: `cockpit-nav.test.tsx`'s A2–A4 and `plan-groups.test.ts` already prove order, nesting and counts; the row holds them through the retitle.
- **A19**: `cockpit-phone.test.tsx`'s A7 already proves the 400 px fit; the long fixture title makes it measure a long name once the nav draws titles in Build Phase 3.
- **A20**: `PlanSummary.test.tsx` and `plan-page-layout.test.tsx` already prove the description and the brief link; the row holds them while the heading above changes.
- **A21**: `display-names-single-definition.test.ts` already refuses a second `planTitle`; the row holds it while three apps start naming plans by title.

#### Test Phase 1 Verification

- [ ] A4, A8, A9, A10, A14 red on their own assertions (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts src/lib/__tests__/plan-declarations.test.ts src/lib/plans/waiting.test.ts`); A11, A12, A15 red on theirs and A17–A20 passing (`cd apps/indusk-admin && pnpm exec vitest run 'src/app/p/[project]/cockpit-nav.test.tsx' 'src/app/p/[project]/plan/[name]/header.test.tsx' 'src/app/p/[project]/cockpit-phone.test.tsx' src/lib/plan-groups.test.ts src/components/plan/PlanSummary.test.tsx src/__tests__/plan-page-layout.test.tsx`); A21 passing (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/display-names-single-definition.test.ts`)
- [ ] A6 red on its own assertion in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/plan-stories.contract.test.ts`: `plan.master was never checked`), and cockpit-redraw's A10 still passes from the moved fixture builder (`… src/__tests__/cockpit-redraw.contract.test.ts`); the admin type-checks (`pnpm exec tsc --noEmit -p .`)
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

#### Test Phase 1 Context

- [ ] `current.md` (Project, shared): plan-stories in flight; plans are being retitled, and worktree plans get their titles on their own branches in Build Phase 5

#### Test Phase 1 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (The nav): a note that plan rows are moving from handles to titles in plan-stories, so the page and the docs agree until it lands

### Build Phase 1: A plan's title, defined once

**Tier**: med — the work step's default

- [ ] Confirm this plan's worktree: `/Users/the_dusky/code/sandbox/dusk-worktrees/plan-stories` on `plan/plan-stories`, assigned (`indusk worktree list` names it; if not, `indusk worktree assign plan-stories <path>`) — worktree-per-plan default
- [ ] `display.ts`: `planTitle(title, handle, words = {})` answers the title up to " — "; when that is empty or equal to `handle`, `promiseWords(handle, words)`. New `readPlanName(planDir, handle, words)` returns `{ title, description }` from `brief.md`, else `master.md` (`description` null when neither writes one). `readHealthNames` uses it, so a master's title is read. Grep `planTitle(` for callers first (display, `readHealthNames`, the admin's `displayMock`)
  ```typescript
  export function planTitle(title: string | undefined, handle: string, words: Record<string, string> = {}): string;
  export function readPlanName(planDir: string, handle: string, words?: Record<string, string>): { title: string; description: string | null };
  ```
- [ ] `health-line.ts`: a promise whose owner has no `planTitles` entry carries `planTitle(undefined, owner, names.words)` instead of the bare owner (A10)
- [ ] `plan-parser.ts`: a `subplans:` entry is a name or a mapping `{ name, title?, description? }`; both keep declared order through the same segment guard; `PlanDeclarations` gains `declaredTitles: Record<string, Record<string, { title?: string; description?: string }>>`. Grep `PlanDeclarations` importers (`plan-groups.ts`, `PlanList.tsx`, `cockpit-fixture.ts`, `new-project-cli.test.ts`) and give each the field
- [ ] `planning-reader.ts`: `Plan` gains `title: string` and `description: string | null`, set from the copy the plan is read from (its worktree first) by `readPlanName`; every test fixture that builds a `Plan` (grep `: Plan = {` and `Plan[]` fixtures, `cockpit-fixture.ts` first) sets them, `cockpit-fixture.ts` from `TITLES` through `titleOf`
- [ ] Rebuild indusk-mcp's dist (`pnpm --filter @infinitedusky/indusk-mcp build`) so the admin reads the new exports
- [ ] Author A13 (`planning-reader.title.test.ts`) and A1–A3 (`master.test.tsx`, with `path-beta`'s `beta-three` declared with a title and description in the fixture's `DECLARATIONS`) from their reviewed bodies; A1–A3 red on their own assertions
- [ ] Shape: review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 1 Verification

- [ ] A4, A8, A9, A10 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/display.test.ts src/__tests__/promise-health-names.test.ts src/lib/__tests__/plan-declarations.test.ts`), A21 still passes, and the related tests pass (`pnpm exec vitest related src/lib/promises/display.ts src/lib/promises/health-line.ts src/lib/plan-parser.ts`)
- [ ] A13 passes and A1–A3 are written red (`cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.title.test.ts 'src/app/p/[project]/plan/[name]/master.test.tsx'`); `pnpm exec tsc --noEmit -p .` clean in both packages; biome clean on changed files

#### Build Phase 1 Context

- [ ] root (Key Decisions): "Plan titles and stories: a plan is named by its title (brief or master, else its handle in words) through one rule in the package; a master's page tells its story from `subplan-row`; Needs you counts amendments — see `/decisions/plan-stories`" — always-on because it is design intent every page and the editor name plans under
- [ ] `apps/indusk-mcp/CLAUDE.md`: a plan's name comes from `readPlanName` / `planTitle` in `promises/display`; nothing else turns a handle into words (guarded by `display-names-single-definition.test.ts`)

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/briefs.md`: `title:` is a short name a person would say, `description:` a separate field; a plan with no title written reads as its handle in words
- [ ] `apps/docs/src/reference/cli/plans.md`: a `subplans:` entry may be `{ name, title, description }` for a plan not started yet; its own brief wins once it exists

### Build Phase 2: Needs you counts an amendment

**Tier**: med — the work step's default

- [ ] Author A16 in `decisions.test.ts` from its reviewed body, RED
- [ ] `waiting.ts`: `WaitingInput` gains `amendments?: ReadonlyArray<{ plan: string; count: number }>`; `WaitingOn` gains `"amendment"`; a plan with a count above 0 waits `on: "amendment"`, step "Brief", `decision: AMENDMENT_DECISION` ("The brief changed after it was approved. Review the change on the plan's page."), after a question and before review and approval
- [ ] `amendments.ts`: `amendmentsWaiting(planDir)` answers `[]` unless `briefStandingOf(planDir)` is `changed`, else `amendmentsOf(planDir)`; `AmendmentsUnreadable` reads as none, as `readPlanParts` reads it for the plan page. Rebuild the dist
- [ ] `decisions-reader.ts`: `readWaiting(project, projectPath, plans)` is async and passes each active plan's waiting amendments (its folder in its worktree, else the project) to `planWaiting`; its three callers (`layout.tsx`, the plan page, `api/plans/[name]/decision/route.ts`) await it; `decisionsReaderMock` in `cockpit-fixture.ts` passes `AMENDED`
- [ ] The plan page: its look state's `waiting` is `waiting !== undefined`, and `planPageWaiting` is deleted from `look-state.ts` (grep importers); a wait `on: "amendment"` draws the amendment card alone, no `DecisionCard`
- [ ] `decisions.ts`: `answerDecision` refuses a wait `on: "amendment"` before anything is delivered ("answered on the amendment card"), so its accept can never reach `release`; the route answers 409 with that message
- [ ] Shape: review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 2 Verification

- [ ] A14 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/waiting.test.ts`); A15, A16 pass and cockpit-redraw's A16 (an amendment-only plan reports `plan.needs-you`) still passes (`cd apps/indusk-admin && pnpm exec vitest run 'src/app/p/[project]/cockpit-nav.test.tsx' src/lib/decisions.test.ts src/lib/look-state.test.ts src/components/cockpit/DecisionCard.test.tsx`); `vitest related` over the changed files passes; tsc and biome clean

#### Build Phase 2 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: what a plan waits on is `planWaiting`'s answer alone, amendments included; the nav and the plan page never add a wait of their own

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (Needs you): a plan waiting on an amendment is listed, and is answered on its amendment card

### Build Phase 3: Titles in the admin

**Tier**: med — the work step's default

- [ ] `PlanList.tsx`: `PlanItem` names a plan `plan.title` with `initialsOf(plan.title)`; `PlanGroupSection` passes the parent's title to `NavPath` (`name`), keeping the handle in `data-parent`, `data-plan-name` and `href`; `PlaceholderRow` names a declared plan by its `declaredTitles` title, else `planTitle(undefined, name)`
- [ ] `layout.tsx`: Needs you's `titles` come from the plans as read (`plan.title` over active and archived), not `readHealthNames`, so a worktree plan reads its own title
- [ ] `PlanFrame.tsx`: the `h1` and the crumb's last part read `plan.title`; `data-plan-name` keeps the handle. The brief page shares it
- [ ] `Nav.stories.tsx`: every plan and Path named by title (the research table's: "InDusk v2: Dawn", "InDusk v4: Day", "Workbench trust fixes", "Hooks from any folder", "Workbench execution", "Live phase progress", "Clean release build", "Context in every session", "Faster look checks", the Needs-you row "Cockpit redraw"), initials from the titles; `indusk looks stories admin` re-renders; `indusk looks status admin` lists `nav.*` and every mockup placing the nav as proposed; ask Sandy to approve them on the Looks page
  - list here what reopened and what Sandy approved
- [ ] Shape: review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A11, A12 pass and A17–A20 still pass (`cd apps/indusk-admin && pnpm exec vitest run 'src/app/p/[project]/cockpit-nav.test.tsx' 'src/app/p/[project]/plan/[name]/header.test.tsx' 'src/app/p/[project]/cockpit-phone.test.tsx' src/lib/plan-groups.test.ts src/components/plan/PlanSummary.test.tsx src/__tests__/plan-page-layout.test.tsx`); `indusk looks lint admin` clean apart from the proposed mockups awaiting Sandy; tsc and biome clean
- [ ] Once Sandy has approved the reopened mockups, cockpit-redraw's A10 passes again in the system tier (`pnpm exec vitest run --config vitest.system.config.ts src/__tests__/cockpit-redraw.contract.test.ts`)

#### Build Phase 3 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a plan is named by `plan.title` and its initials come from it; the handle is for links, addresses and data attributes only

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (The nav, The plan page): plans and Paths read by their titles; the note from Test Phase 1 removed

### Build Phase 4: The master plan tells its story

**Tier**: med — the work step's default

- [ ] Author A5 in `look-state.test.ts` from its reviewed body, RED
- [ ] `SubplanRow` (`components/ui/SubplanRow.tsx`, `data-component="subplan-row"`, `data-state`): number, badge with initials, title, description, stage; a link when it has an `href`, a `div` when queued. Stories `Released`, `Draft`, `Queued` (`SubplanRow.stories.tsx`, `title: "ui/SubplanRow"`); `indusk looks stories admin`; ask Sandy to approve `subplan-row.released`, `subplan-row.draft`, `subplan-row.queued` against their mockups
  - record here when Sandy approved them
- [ ] `lib/master-story.ts`: `masterStory(group, declaredTitles, isReleased)` turns the parent's `PlanGroup` from `buildGroups` into rows `{ number, handle, title, description, state: "released" | "draft" | "queued", stage, href? }` and counts `{ released, drafts, queued, total }`: released when a release shipped the plan (the Path count's rule), queued when it has no folder, else draft with the nav row's stage words; a Path inside reads as a draft or released row linking to its own master page. Unit-tested beside it
- [ ] `components/plan/MasterStory.tsx`: the purpose (`data-testid="master-purpose"`), the count line (`data-testid="master-counts"`) with "Read the master plan" to `/doc/master`, "The plans, in order" and its count, then a `SubplanRow` per row, drawn as `plan.master` draws them
- [ ] The plan page: a plan with declared subplans draws `PlanFrame` with the `master plan` tag and `MasterStory`, in place of `ParentPlanView`, the workflows rail, the status card and the parts; `ParentPlanView` and `MasterBar` deleted once grep shows no other importer (their tests with them)
- [ ] `planDocuments` serves a master's `master.md` as the document `master` ("Master plan"), so `/doc/master` opens it
- [ ] `look-state.ts`: `planLookState` takes `master` and answers `plan.master` first; the plan page passes it
- [ ] `plan.master` recomposed to place `subplan-row` by name (`<indusk-component name="subplan-row" state="…">`), its inline row CSS and its `indusk-new-components` meta removed; `indusk looks lint admin` reports no component drawn in it; ask Sandy to approve `plan.master` again
  - record here when Sandy approved it
- [ ] `indusk promises change a-plan-reads-by-its-title --plan plan-stories --statement "Wherever InDusk names a plan, in the admin and in the editor, it shows the plan's title, a short name written in its brief or master, and its description is a separate field; a plan with no title written reads as its handle turned into words." --reason "titles are short names now, with the description its own field, and an unwritten title reads as words, not the handle"`, in double quotes because the sentence holds apostrophes; then `indusk promises check` clean
- [ ] Shape: review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 4 Verification

- [ ] A1, A2, A3, A5 pass (`cd apps/indusk-admin && pnpm exec vitest run 'src/app/p/[project]/plan/[name]/master.test.tsx' src/lib/look-state.test.ts`) with `master-story`'s own tests; `vitest related` over the changed files passes; tsc and biome clean
- [ ] A6 passes in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/plan-stories.contract.test.ts`) once Sandy has approved the stories and the recomposed `plan.master`; `indusk promises contract plan-stories` passes

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a master plan's page is `plan.master`, its rows `SubplanRow`, its counts the Path group's (`lib/master-story.ts`), so the page and the nav agree

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (The master plan page) as drawn; `apps/docs/src/decisions/plan-stories.md` published from the ADR with its sidebar entry; changelog: Changed: "Plans read by their titles in the admin and the editor; a master plan's page tells its story, plan by plan; Needs you lists a plan waiting on an amendment."

### Build Phase 5: Every live plan gets its title

**Tier**: med — the work step's default

Titles and descriptions come from research.md's tables. A description already written is kept; where research gives none and the old title has a description after its dash, that text becomes the description. Each plan is retitled where the admin reads it.

- [ ] On this branch, the plans with no worktree: `indusk-v2-dawn` ("InDusk v2: Dawn"), `indusk-v4-day` ("InDusk v4: Day", its description the approved `plan.master` mockup's two sentences), `indusk-demo` ("InDusk demo"), `promise-core` ("Promise core") in their `master.md`; `context-reaches-every-session` ("Context in every session"), `contract-ui` ("Contract UI"), `indusk-release` ("Release names its plans"), `looks-check-speed` ("Faster look checks"), `plan-premises` ("Project premises"), `workbench-watch-provisioning` ("Watched from day one") in their `brief.md`; and `subplans:` titles and descriptions in Day's and Dawn's `master.md` for each declared plan with no folder (research and the approved `plan.master` mockup: "Check at change time", "Claims proved honestly", "Test binding", "Uncovered changes", "Any executor", "Probe", "The review"). One commit, `plan(plan-stories): titles for the plans read from the trunk`
- [ ] In each plan's own worktree, on its own branch, frontmatter only, one commit per plan (`plan(<plan>): title and description (plan-stories)`): `clean-release-build` ("Clean release build"), `cockpit-audit-fixes` ("Cockpit audit fixes"), `story-first-phases` ("Story-first phases"), `mockup-matching` ("Mockup matching"), `instance-ports` ("Instance ports"), `owned-changes` ("Owned changes"), `stories-replace-mockups` ("Stories replace mockups"), `telemetry-destinations` ("Telemetry destinations"), `demo-scenarios` ("Demo scenarios"). First check each: `git -C <worktree> status --porcelain -- .indusk/planning/<plan>` empty, and no `indusk agent` session listed on it; skip any that is not, and list it in this item with why
  - record each commit or skip here
- [ ] Each approved plan retitled above (`clean-release-build`, `cockpit-audit-fixes`, `story-first-phases`) reports no amendment (`indusk plans amendments <plan> --dir <its plan folder>` prints none)
- [ ] `.indusk/current.md` (Project, shared): the plans skipped above and `approve-then-improve` (untracked on `main`, the person's), each to get its title from its next session; `release-preconditions` (nothing written, title unknown), `user-zero` and `jev-decision-model` (research only, read as their handles in words) left as research flagged them

#### Build Phase 5 Verification

- [ ] The second expectation's count: no plan that is not archived reads by its bare handle (`node -e` over `readActivePlans` from each project copy, printing every plan whose `title` equals its handle; expected none) and the plans whose title is their handle in words are exactly those listed in `current.md` above
- [ ] A7, live check: on the running admin, open Day's and Dawn's master pages and read each top to bottom: what the master is for, every plan in order with its title, description and stage, the counts matching the nav. Recorded here with the date and what was seen

#### Build Phase 5 Context

- [ ] `current.md` (Project, shared): plan-stories in flight entry replaced by what is left: the skipped plans and Sandy's calls from research's flags

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/cli/plans.md` (`plans start`): a new plan's title is its handle, which reads as words until a person writes a short title

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/display.ts` | `planTitle` words fallback, `readPlanName`, `readHealthNames` reads `master.md` |
| `apps/indusk-mcp/src/lib/promises/health-line.ts` | owner with no title reads as words |
| `apps/indusk-mcp/src/lib/plan-parser.ts` | `subplans:` mapping entries, `declaredTitles` |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | `amendments` input, `on: "amendment"` |
| `apps/indusk-mcp/src/lib/plans/amendments.ts` | `amendmentsWaiting` |
| `apps/indusk-admin/src/lib/planning-reader.ts` | `Plan.title`, `Plan.description` |
| `apps/indusk-admin/src/lib/decisions-reader.ts` | async `readWaiting` with amendments |
| `apps/indusk-admin/src/lib/decisions.ts`, `src/app/api/plans/[name]/decision/route.ts` | refuse an amendment's answer |
| `apps/indusk-admin/src/lib/look-state.ts` | `plan.master`; `planPageWaiting` removed |
| `apps/indusk-admin/src/lib/master-story.ts` | new: rows and counts from the Path group |
| `apps/indusk-admin/src/lib/plan-parts-view.ts` | `master` document |
| `apps/indusk-admin/src/components/PlanList.tsx`, `src/app/p/[project]/layout.tsx` | names and initials by title |
| `apps/indusk-admin/src/components/plan/PlanFrame.tsx` | heading and crumb by title |
| `apps/indusk-admin/src/components/plan/MasterStory.tsx` | new: the master page body |
| `apps/indusk-admin/src/components/ui/SubplanRow.tsx`, `SubplanRow.stories.tsx` | new component and stories |
| `apps/indusk-admin/src/components/ui/Nav.stories.tsx` | plan names as titles |
| `apps/indusk-admin/src/components/ParentPlanView.tsx`, `src/components/bars/MasterBar.tsx` | removed if nothing else imports them |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx` | master branch, one waiting rule |
| `apps/indusk-admin/src/__tests__/helpers/looks-fixtures.ts`, `cockpit-fixture.ts` | shared look fixtures; titles, `AMENDED` |
| `apps/indusk-admin/vitest.tiers.ts` | `plan-stories.contract.test.ts` in `SYSTEM` |
| `.indusk/mockups/admin/screens/plan.master.html` | recomposed from `subplan-row` |
| `.indusk/planning/*/brief.md`, `*/master.md` (live plans) | titles and descriptions |
| `CLAUDE.md`, `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md` | Context items |
| `apps/docs/src/…` | the pages in each Document gate |

## Dependencies

- `cockpit-redraw` (archived, landed 2026-10-14): the nav, plan pages and the contract test fixture this builds on.
- Sandy's approval of the reopened nav mockups (Build Phase 3) and of `subplan-row` and `plan.master` (Build Phase 4).

## Notes

- `screens.json` already declares `plan.master` and `subplan-row` at `/p/dusk/plan/indusk-v4-day`; the contract test's fixture master takes that name so the approved declaration stays unchanged and `indusk looks check admin` checks the real Day page too.
- The approved `plan.master` mockup names Day's archived plans by new titles ("Hooks from any folder"). Archived plans are not retitled, so the real Day page reads those rows by the part of their title before the dash, or their handle in words. The look check compares values, not words, so this does not break the look.
- `user-zero` and `jev-decision-model` have no brief or master, so they read as their handles in words ("User zero", "Jev decision model").
