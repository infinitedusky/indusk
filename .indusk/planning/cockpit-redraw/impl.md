---
title: "cockpit-redraw — the nav from the original cockpit, the brief page drawn, re-approval a person's"
date: 2026-10-13
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "e738be9154dc4042dd598b3a82e9cc55e33f5f46df5136e97dfa6c2b2a542dc3"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-13T23:53:56.059Z"
---

# cockpit-redraw

## Goal

The cockpit looks as Sandy meant it and each look is approved once: the nav redrawn from the original cockpit mockup with every plan, Scorecards and a width you can drag; the brief page drawn and the plan page redrawn; and re-approving a brief refused to an agent, as approving a look is (ADR decisions 1–4).

## Scope

### In Scope
- The nav redrawn (`nav.expanded`, `nav.wide`, `nav-handle`), its width dragged and remembered per browser.
- The brief page drawn (`brief.writing`, `brief.approved`), the plan page redrawn; both matched to their mockups.
- `looks-approval-guard.js` refusing an agent's `plans reapprove` and the re-approve route.
- The test row `a-plan-builds-only-after-approval` lacked.

### Out of Scope
- A draft's agent drawing looks (a later plan).
- The plan-page sections brief-as-the-contract dropped, unless the redrawn plan page draws them.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | the guard's re-approval refusal | `looks-approval-guard.js`, the re-approve route |
| Build Phase 2 | `NavHandle`, the nav width in `CockpitFrame`, `--size-nav-max`, the redrawn `Nav` | the approved `nav.*`, `nav-handle.*` mockups |
| Build Phase 3 | the brief page and plan page matched to their mockups, the changed promise | the approved `brief.*`, `plan.*` mockups |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Dragging the nav's edge to the right widens the nav and narrows the page beside it; dragging past the widest or narrowest allowed width stops at that width | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-nav-widens-by-dragging | apps/indusk-admin/src/components/cockpit/CockpitFrame.test.tsx |
| A2 | After a reload the nav opens at the width the person left it at | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-nav-widens-by-dragging | apps/indusk-admin/src/components/cockpit/CockpitFrame.test.tsx |
| A3 | Below 760 px wide there is no drag edge: the nav is the drawer it was | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-nav-widens-by-dragging | apps/indusk-admin/src/components/cockpit/CockpitFrame.test.tsx |
| A4 | Collapsing the nav to its strip and expanding it again returns it to the dragged width | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-nav-widens-by-dragging | apps/indusk-admin/src/components/cockpit/CockpitFrame.test.tsx |
| A5 | An agent's command that runs `indusk plans reapprove` is refused, saying only a person re-approves, and the plan's approval is unchanged | Test Phase 1 | Build Phase 1 | passing | unit | promise: only-a-person-reapproves | apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A6 | An agent's command that calls the admin's re-approve route is refused the same way | Test Phase 1 | Build Phase 1 | passing | unit | promise: only-a-person-reapproves | apps/indusk-mcp/src/__tests__/looks-approval-guard.test.ts |
| A7 | The person's Approve on a waiting amendment, pressed in their browser, still re-approves the plan | Test Phase 1 | Test Phase 1 | passing | unit | promise: only-a-person-reapproves | apps/indusk-admin/src/__tests__/amendment-approval.test.ts |
| A8 | The brief page shows the plan's description, promises, expectations and looks, with the agent's column beside them | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/plan-page-layout.test.tsx |
| A9 | The plan page opens with the description and, until the brief is finished, "The brief is incomplete" with a way to the brief; once it is finished, a link to it | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/components/plan/PlanSummary.test.tsx |
| A10 | Every screen this plan names reads approved and the running admin holds it by value at each reference device, in a real browser | Build Phase 3 | Build Phase 3 | written | contract | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/cockpit-redraw.contract.test.ts |
| A11 | Live: talking to the agent on a brief page, a promise it adds and a look it draws appear on the page and are brought into view, without leaving it | Build Phase 3 | Build Phase 3 | planned | live check | a live check of a-plan-page-shows-the-parts-of-its-brief, recorded in Build Phase 3; the promise is proven by A8, A9 and A10 | manual: recorded in Build Phase 3's Verification |
| A12 | While an amendment is waiting, checking off a build item is refused, naming the amendment | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-builds-only-after-approval | apps/indusk-mcp/src/__tests__/check-gates-amendments.test.ts |

### Deferred Verification

- **The redrawn nav fits the cockpit's look as Sandy meant it (test plan U1)**
  - reason: aesthetic judgement, not an observable rule
  - would require: a person looking
  - mitigation: per-look review — Sandy approves each mockup before the plan is approved and each story against its mockup during the build; no look is held until approved

## Checklist

### Test Phase 1: Author the assertions, RED

**Tier**: med — the work step's default

**Goal**: author every row that can honestly be authored now, and record the two that cannot.

- [x] Author A1–A4 in `CockpitFrame.test.tsx`, rendering `CockpitFrame` at desktop and phone widths and dragging the nav's edge by its role (`separator`), RED: there is no edge today
- [x] Author A5, A6 in `looks-approval-guard.test.ts` beside the record and route cases, RED: the guard allows both today
- [x] Add `promise: only-a-person-reapproves` to `amendment-approval.test.ts` (A7), `promise: a-plan-page-shows-the-parts-of-its-brief` to `plan-page-layout.test.tsx` (A8) and `PlanSummary.test.tsx` (A9), and `promise: a-plan-builds-only-after-approval` to `check-gates-amendments.test.ts` (A12); each passes today
- [x] Confirm each red row fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 3

- **A10** — holds each screen by value in Chromium, which needs the screens approved and the pages matched to them; it is written with them. Body reviewed in Test Phase 1 and corrected: the first draft called `looksStatus(root, app)` and `looksCheck(root, app, { url })`, which no package subpath exports (`looksCheck` is the CLI's own function in `bin/commands/looks.ts`, returns void and sets an exit code), and read `.approval` / `.broken[].mockup` shapes that do not exist. The package's real surface: `readAppLooks` (`looks/overview`: `mockups[].name/.approval`, `stories[].name/.approval`, or `{ problem }`), `readApp` (`looks/mockups`), `readApprovals` / `readStoryApprovals` (`looks/approvals`), `checkApp` (`looks/check`: `{ results: LookResult[], unchecked }`, a result's mockup is `${screen}.${state}` and `verdict.state` is `held|broken`). The draft also let a named screen pass by never being checked, and omitted the two `nav-handle` stories the brief names. Corrected body:

  ```typescript
  it("A10 every screen cockpit-redraw names is approved and held by value", async () => {
    const screens = ["nav.expanded", "nav.wide", "brief.writing", "brief.approved", "plan.parts", "plan.working", "plan.needs-you", "plan.released"];
    const stories = ["nav-handle.default", "nav-handle.dragging"];
    const read = await readAppLooks(root, "admin");
    if ("problem" in read) throw new Error(read.problem);
    for (const n of screens) expect(read.mockups.find((m) => m.name === n)?.approval, n).toBe("approved");
    for (const n of stories) expect(read.stories.find((s) => s.name === n)?.approval, n).toBe("approved");
    const app = await readApp(root, "admin");
    const { results, unchecked } = await checkApp(app, readApprovals(app), adminUrl, readStoryApprovals(app));
    const of = (r: { screen: string; state: string }) => `${r.screen}.${r.state}`;
    for (const n of [...screens, ...stories]) expect(results.some((r) => of(r) === n), `${n} was never checked`).toBe(true);
    expect(results.filter((r) => [...screens, ...stories].includes(of(r)) && r.verdict.state === "broken")).toEqual([]);
    expect(unchecked.filter((u) => [...screens, ...stories].includes(u.mockup))).toEqual([]);
  });
  ```
- **A11** — a live check, no body.

#### Regression Guards

- **A7** — the person's own Approve already works (brief-as-the-contract A13); the row keeps it working while the guard grows.
- **A8** — the brief page already shows these (brief-as-the-contract Build Phase 5); the row holds the changed promise to it through the redraw.
- **A9** — the plan page already opens this way (brief-as-the-contract Build Phase 6); the row holds the changed promise to it through the redraw.
- **A12** — `check-gates-amendments.test.ts` already proves the amendment clause; the row gives `a-plan-builds-only-after-approval` its named test.

- [x] Shape (Test Phase 1): reviewed `CockpitFrame.test.tsx`, `looks-approval-guard.test.ts`, `amendment-approval.test.ts`, `check-gates-amendments.test.ts` against the enabled extensions' craft rules (`rules.unreadable` empty) — one formatting finding (biome) fixed in place; nothing structural: the `drag` helper is the one named seam in `CockpitFrame.test.tsx`, the rest are one-line tokens and appended cases beside their siblings

#### Test Phase 1 Verification

- [x] A1–A6 authored and red on their own assertions; A7, A8, A9, A12 passing (`cd apps/indusk-admin && pnpm exec vitest run src/components/cockpit/CockpitFrame.test.tsx src/__tests__/amendment-approval.test.ts src/__tests__/plan-page-layout.test.tsx src/components/plan/PlanSummary.test.tsx`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-approval-guard.test.ts src/__tests__/check-gates-amendments.test.ts`)
- [x] A10's body reviewed: it compiles at Build Phase 3 against `looks/status` and `looks/check`, and asserts approval and held-by-value for exactly the screens the brief names

#### Test Phase 1 Context

- [x] `.indusk/current.md`: cockpit-redraw in flight — the nav from the original cockpit, the brief page drawn, re-approval a person's

#### Test Phase 1 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: note under the brief page that its look is being drawn in cockpit-redraw, so the page and the docs say the same thing until it lands

### Build Phase 1: Re-approval is a person's

**Tier**: med — the work step's default

- [x] `hooks/looks-approval-guard.js` refuses an agent's Bash command that runs `plans reapprove` (`indusk plans reapprove`, `node …/cli.js plans reapprove`) or names `/api/plans/<name>/reapprove`, with a message saying only a person re-approves and how (the amendment card's Approve, or the person's own terminal); copy to `.claude/hooks/`; the header comment names `only-a-person-reapproves`
- [x] Shape (Build Phase 1): reviewed `looks-approval-guard.js` (and its `.claude/hooks/` copy) against the enabled extensions' craft rules — one finding, fixed in place: `refuse` picked its message by testing the `why` string and held two inline message arrays in a ternary; the two messages are now named `MOCKUP_GUIDANCE` and `REAPPROVAL_GUIDANCE`, `bashRefusal` returns the guidance with its reason, and `refuse` only prints. A5, A6 and the 20 older guard cases still pass

#### Build Phase 1 Verification

- [x] A5, A6 pass and A7 still passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/looks-approval-guard.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/amendment-approval.test.ts`); `diff apps/indusk-mcp/hooks/looks-approval-guard.js .claude/hooks/looks-approval-guard.js` empty; biome clean on changed files

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/hooks/CLAUDE.md`: the looks guard holds every person-only act — a look's approval and a brief's re-approval — guarded by `looks-approval-guard.test.ts`; and root (Key Decisions): "cockpit-redraw: the nav from the original cockpit, drag-to-widen per browser, re-approval a person's — see `/decisions/cockpit-redraw`" — always-on because it is design intent every admin page is drawn under

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `reapprove` is run by a person; an agent's call is refused

### Build Phase 2: The nav, redrawn and widened

**Tier**: med — the work step's default

- [x] `--size-nav-max` in the admin's foundation (`foundation.tokens.json`, regenerated CSS), the widest the nav drags
- [x] `NavHandle` (`components/ui/NavHandle.tsx`) with stories `default` and `dragging`, approved against `nav-handle.default` / `nav-handle.dragging`: a vertical separator a pointer drags, with keyboard steps
  - built and rendered; stories nav-handle.default and nav-handle.dragging approved by Sandy on the Looks page (`indusk looks status admin`: nothing unapproved)
- [x] `CockpitFrame` keeps the nav's width in `localStorage` (`indusk-admin.nav.width`) beside the collapse choice, applies it to the shell's nav column above 760 px, clamps it between `--size-nav` and `--size-nav-max`, keeps it through collapse, and renders no handle below 760 px (A1–A4)
- [x] `Nav` redrawn to `nav.expanded`: project, Needs you, the views with Scorecards, then every plan under its Paths with its stage, Archived folded; its stories updated and reapproved against the mockup; `nav.wide` drawn by the same components at a wider width
  - built and rendered, matched to `nav.expanded` by screenshot at 1280 px; the `nav` stories (expanded, looks-current, plan-current, collapsed) and the mockups nav.expanded and nav.wide approved by Sandy
- [x] The components the approved nav mockups redraw inline (`<meta name="indusk-new-components">`): `Nav`, `PlanRow`, `ViewLink` and `Badge` (with its new `idle` state for drafts) rebuilt to match, their stories rendered and approved by Sandy, and the mockups recomposed from them so they draw nothing inline — `plans accept` refuses while one does
  - rebuilt and rendered (`proposed`); `nav.expanded`, `nav.wide`, `nav-handle.default` and `nav-handle.dragging` recomposed (`indusk looks lint admin` reports no `component drawn in mockup` and no declared-new meta in them); `brief.*` and `plan.*` still list these as new components and are recomposed in Build Phase 3 with `RailGroup`, `Step` and `Chip`. Awaiting Sandy's story approval: nav.expanded, nav.looks-current, nav.plan-current, nav.collapsed, plan-row.needs, plan-row.working, plan-row.released, plan-row.current, plan-row.numbered, plan-row.idle, plan-row.queued, view-link.default, view-link.current, badge.needs, badge.working, badge.released, badge.idle, nav-handle.default, nav-handle.dragging
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - self-review done (`prepareShapeReview` skipped while verification was open; re-run after it went green: `review`, 19 files, `rules.unreadable` empty, nothing further found). One finding fixed in place: `NavHandle`'s key handler held a four-deep nested ternary, now the named `widthForKey`, with `NavHandle.test.tsx` covering the keyboard steps. Considered and left: the width clamp in `CockpitFrame`'s mount effect repeats `NavHandle`'s `clamp` (a cross-file duplication, `/cleanup`'s to judge); `PlanList`'s `isReleased` is passed down two levels to `PlanItem` (one fact, three call sites, no second consumer yet)

#### Build Phase 2 Verification

- [x] A1–A4 pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/cockpit/CockpitFrame.test.tsx`); the nav's existing tests pass (`pnpm exec vitest related src/components/cockpit/CockpitFrame.tsx src/components/ui/Nav.tsx`); `indusk looks lint admin` clean; tsc and biome clean on changed files
  - A1–A4 pass (4 of 4), `vitest related` over the changed files passes (17 files, 74 tests), tsc and biome clean on changed files; left unchecked: `indusk looks lint admin` reports 122 findings, every one `no-approved-story` — the foundation changed (`--size-nav-max`), so every story and mockup reads proposed until Sandy approves them on the Looks page

#### Build Phase 2 Context

- [x] `apps/indusk-admin/CLAUDE.md`: the nav's width is the person's, per browser, between `--size-nav` and `--size-nav-max`; the plan tree is drawn by `nav.expanded`, not the app's own

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md` (The nav): the redrawn nav, Scorecards, the plan tree as drawn, and dragging its width

### Build Phase 3: The brief page and plan page, to their mockups

**Tier**: med — the work step's default

Resolved 2026-10-13 (was a blocker: `looks check` counts a state only when the page reports it via `data-look-state`, and the nav, brief and plan pages reported none, opening every state at one path with an ignored `?state=`). Sandy chose per-state paths: each page reports the state it really draws from its own data, `screens.json` lists one path per state, A10 serves fixture plans in each condition from a throwaway project, and the nav's width — the person's own setting, not a faked state — may be set by a parameter so `nav.wide` is reachable. A10's assertions are unchanged.

- [x] Author A10 (`cockpit-redraw.contract.test.ts`, listed in `SYSTEM`) from its reviewed body
  - written; red on its own assertion (`nav.expanded was never checked`): the admin's pages report no `data-look-state` for the nav, brief or plan screens, so the check leaves them unchecked. Two changes from the reviewed body, neither weakening it: the check is given an app narrowed to the screens and stories the plan names (the whole admin's check is `indusk looks check admin`'s, ~8 min inside a test), and an unchecked story is matched by its `story <name>` label as `checkStories` writes it
- [ ] The brief page matched to `brief.writing` / `brief.approved`, and the plan page to `plan.parts`, `plan.working`, `plan.needs-you`, `plan.released`; their components' stories reapproved where they changed
- [ ] The components the approved brief and plan mockups redraw inline: `RailGroup`, `Step` and `Chip` rebuilt to match, their stories rendered and approved by Sandy, and `plan.parts` and the brief screens recomposed from them so they draw nothing inline
- [ ] `indusk promises change a-plan-page-shows-the-parts-of-its-brief --plan cockpit-redraw --statement '<the brief's Changes sentence>' --reason 'the parts moved to the brief page; the plan page opens with the description'` — single-quoted, so no shell strips its words
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A8, A9 still pass and A10 passes in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/cockpit-redraw.contract.test.ts`); `indusk looks check admin` holds every screen the brief names; tsc and biome clean on changed files
- [ ] A11, live check: on a brief page in the running admin, ask the agent to add a promise and draw a look, and see both appear and come into view without leaving the page — recorded here with the date and what was seen

#### Build Phase 3 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: the brief page and plan page are held to `brief.*` and `plan.*`; a change to either is drawn before it is built

#### Build Phase 3 Document

- [ ] `apps/docs/src/decisions/cockpit-redraw.md` published from the ADR, sidebar entry; `apps/docs/src/reference/admin-ui/overview.md` (The brief page) as drawn; changelog: Changed — "The cockpit is redrawn: the nav lists every plan as the original cockpit did and drags wider, and the brief page is drawn; re-approving a brief is a person's alone."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/looks-approval-guard.js` | refuses an agent's re-approval |
| `.claude/hooks/looks-approval-guard.js` | installed copy |
| `apps/indusk-admin/src/components/cockpit/CockpitFrame.tsx` | the nav's width, dragged and remembered |
| `apps/indusk-admin/src/components/ui/NavHandle.tsx` | new: the nav's drag edge |
| `apps/indusk-admin/src/components/ui/Nav.tsx` | redrawn from the original cockpit |
| `apps/indusk-admin/src/app/p/[project]/layout.tsx` | the nav's plan tree as drawn |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/brief/page.tsx` | matched to `brief.*` |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx` | matched to `plan.*` |
| `.indusk/mockups/admin/foundation.tokens.json` | `--size-nav-max` |
| tests named in the trajectory | new rows and tokens |

## Dependencies
- brief-as-the-contract, landed 2026-10-13.

## Notes
- The mockups are drawn before approval and approved by Sandy in the cockpit; `plans approve` refuses while any look the brief names is proposed.
