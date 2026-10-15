---
plan: plan-stories
audited: 2026-10-15
model: claude-opus-5-5
---

# Audit — plan-stories

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-admin/src/lib/promise-dashboard.ts:99` — Narrower for `a-plan-reads-by-its-title` (a plan is named by its title wherever the admin names it, and a plan with no title reads as its handle in words). A10 is the trajectory row asserting that the editor groups a promise whose plan cannot be read under the handle in words. It covers only the editor's health line. The admin's Promises page still falls back to the bare owner handle (`ctx.planTitles[owner] ?? s.entry.owner`), and so does the promise page header at `apps/indusk-admin/src/app/p/[project]/promises/[name]/page.tsx:82` (`?? entry.owner`). No row exercises either fallback.
- `apps/indusk-admin/src/lib/promise-dashboard.ts:184` — Narrower for `a-plan-reads-by-its-title`. When the Promises page is grouped by Path, each group heading is `r.path`, which is the master's folder handle (for example `indusk-v4-day`), not its title. A11 is the row asserting that nav Paths read by title. It checks the nav only.
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/header.test.tsx:97` — A12 is the row asserting that the plan page's and the brief page's heading and crumb read the title. The test only renders the plan page (`pageFor` imports `./page`). The brief page (`plan/[name]/brief/page.tsx`) shares `PlanFrame`, so it is right by construction, but no test renders it.
- `apps/indusk-mcp/src/lib/promises/display.test.ts:95` — A9 is the row asserting that a master is named by its `master.md` title and that its description is the one written there. The test asserts only `planTitles.day`. Nothing reads the description back, and `readPlanName`'s `description` has no direct test.
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx:106` — A1 is the row asserting that the master page's released count "is the one its Path shows in the nav". The test checks the literal "1 of 3 released" on the page and never reads the nav's `released/total` beside it. The two agree only because both call `buildGroups`, and no test asserts that they agree.
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/master.test.tsx:132` — A2 is the row asserting that every declared plan is shown with its title and description. Only row 0's description is checked. A3 is the row asserting that a queued row is dimmed and opens nothing. Nothing at `:149` checks dimming; it is held only by value through A6's `subplan-row.queued` story.
- `apps/indusk-admin/src/__tests__/helpers/cockpit-fixture.ts:891` — Narrower for `decisions-wait-in-one-place` (a plan waiting only on an amendment is listed under Needs you). A15 is the row asserting that such a plan is under Needs you on every page. It runs against `decisionsReaderMock`, which hands `planWaiting` a fixed `AMENDED` list. The admin's real discovery is never executed by any row: `amendmentsWaiting`'s hash short-circuit, and `amendmentCounts` joining `p.worktree?.path ?? projectPath` in `apps/indusk-admin/src/lib/decisions-reader.ts:59-72`.
- `apps/indusk-admin/src/__tests__/plan-stories.contract.test.ts:43` — A6 is the contract row that holds this plan's screens by value. Its `SCREENS` list omits `nav.collapsed`, which the brief lists under Looks as must-not-break and whose mockup this diff changes (`.indusk/mockups/admin/components/nav.collapsed.html`). `cockpit-redraw.contract.test.ts:35-40` omits it too. A6 also compares values, not words, so it never checks that any title or description is shown.
- `apps/indusk-admin/src/lib/master-story.ts:85` — Narrower for `a-master-plan-tells-its-story` ("how far along it is"). A plan that is archived but has no release found is given `state: "draft"` and is counted in "in draft". Its stage is the raw status string, because `statusToNavMark` returns `stage: status` for archived plans (`apps/indusk-admin/src/components/ui/badge-variant.ts:78-79`). On today's data every archived Day and Dawn subplan has a release (checked through `readHealthNames`), so this is not observed. Nothing prevents a landed but unreleased plan from reading as a draft. A3 has no archived-unreleased case.

## What does the diff change that no row touches?
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:59` — The master branch returns before `TrustNotice`, `WaitingAmendments`, `DecisionCard`, `PlanSession` ("Ask about this plan"), `BuildControls`, the parts and `HistoryPanel`, and it passes `waiting: false` at `:70`. On `main` these were drawn under `ParentPlanView`. If a master waits on a session question, Needs you links to a page that draws no decision for it. No row covers any of this.
- `apps/indusk-mcp/src/lib/plans/amendments.ts:153` — `amendmentsWaiting`, which returns none unless `briefStandingOf` is `changed` and treats `AmendmentsUnreadable` as none, has no test (grep finds no test importing it).
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:141` — The plan page now draws `PlanStatusCard` instead of `DecisionCard` for a wait `on: "amendment"`. No row asserts which card a plan waiting on an amendment draws.
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/doc/[doc]/page.tsx:28` — The new `/doc/master` route reads `master.md` from the worktree, else the project. Only `planDocuments` is tested (`plan-parts-view.test.ts:117`), not the route.
- `apps/indusk-mcp/src/lib/promises/display.ts:345` — The second loop names plans that exist only in a worktree, with no trunk folder. A22, the row asserting that a worktree plan is named by its worktree's title, covers a plan that has a trunk folder.
- `apps/indusk-admin/src/components/plan/MasterStory.tsx:56` — "The plans, in order" prints `counts.total`, which counts leaf plans, while a nested Path is drawn as one row. Nothing prevents the count beside the heading from differing from the number of rows under it. Day and Dawn declare no nested Path today.
- `apps/indusk-admin/src/components/plan/PlanFrame.tsx:49` — The new `master plan` tag has no assertion.

## What does the code do that the brief never promised?
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:62` — A master's page loses its history panel, the trust notice, "Ask about this plan" and any decision or amendment card. ADR decision 3 replaces only "the bar, the prose and the cards". The approved impl widens that to "the workflows rail, the status card and the parts". Neither the brief nor the ADR mentions history, trust or the session control.
- `apps/indusk-admin/src/components/plan/PlanFrame.tsx:49` — A `master plan` tag in the plan header. It is named in the impl, not in the brief's Looks.
- `apps/indusk-admin/src/lib/master-story.ts:71` — A Path nested in a master is drawn as one row with the stage "N of M released", released only when all its plans are. The brief's `plan.master` look describes plan rows only.
- `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx:29` — A heading for `amendment` that its own comment says is never drawn. It is dead text, added so the type is exhaustive.

## Which rejected ADR alternative does the code quietly take?
- `apps/indusk-admin/src/lib/plan-groups.ts:113` — In part, "Naming plans in each page" (rejected because the display module is the one place a handle becomes a name). A declared `subplans:` title is used as written (`written?.title ?? planTitle(...)`) instead of going through `planTitle`. So a declared title equal to its handle, or one containing " — ", skips the package rule that turns a handle-only title into words and cuts a title at its dash. Nothing prevents `{ name: x, title: x }` from showing the bare handle.

## Which skip reason would you not accept?
- nothing

## What else would have to change for each promise to hold?
- `apps/indusk-admin/src/lib/promise-dashboard.ts:99` — Not in `stat`. For `a-plan-reads-by-its-title` to hold, it needs the words fallback instead of `?? s.entry.owner`, and its Path heading at `:184` needs the master's title instead of its handle.
- `apps/indusk-admin/src/components/IncidentsTable.tsx:102` — Not in `stat`. An incident's owner plan is shown by its bare handle at `:102` and `:105` ("<handle> · Maintenance — …"), in the admin.
- `apps/indusk-admin/src/components/looks/LooksToolbar.tsx:68` — Not in `stat`. The Looks page's checkout picker names a plan worktree as `plan <handle>`.
- `apps/indusk-admin/src/app/p/[project]/promises/[name]/page.tsx:82` — Touched, but only to `await`. The plan link's text still falls back to the bare `entry.owner`.
