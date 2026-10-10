---
title: "Plan cockpit — the promise dashboard, the promise page and the plan page"
date: 2026-10-10
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Plan cockpit — the promise dashboard, the promise page and the plan page

## Goal

The admin becomes the mockup in `research/promise-ui/mockups/plan-cockpit.html`: a nav of every plan by Path, a promise dashboard with broken promises first, a page per promise with its proof and a fix, and a plan page as its two workflows with the one decision it waits on — every derived fact computed by a package module the admin reads (ADR decisions 1–7).

## Scope

### In Scope
- Package modules and subpaths: `promises/rows` (export), `promises/standing`, `promises/proof`, `promises/fix` (moved from the extension), `plans/steps`, `plans/waiting`, `plans/history`.
- The admin's nav (Promises with its broken count, Needs you, Paths nested to any depth with released counts, phone drawer, collapsible strip).
- The promises dashboard, rebuilt; the promise page, new, at `/p/[project]/promises/[name]`.
- The plan page as Planning and Release with the decision card; today's documents, phases and rows kept as collapsible detail.
- Decisions recorded in `.indusk/plan-history/<plan>.md` on `main`.

### Out of Scope
- The home view as the premises → promises → phases hierarchy (contract-ui).
- Editing plan documents in the admin.
- Declaring a promise's marks; checks that run against live data (promise-devtools).
- "Needs you" for sessions the admin did not start.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | red tests for the nav, the phone widths, the plan page's two lists, the dashboard and the single-definition pin; the rest registered with bodies | today's layout, `PlanList`, plan page and `Promises` |
| Build Phase 1 | `promises/rows` export; `promises/standing`, `promises/proof`, `promises/fix` with tests; the extension importing `promises/fix` | `promises/health`, `promises/heard`, `promises/store`, `promises/telemetry`, `promises/incidents`, `promises/display`, the extension's `core/fix.ts` |
| Build Phase 2 | the dashboard on `promises/standing`; the nav's Promises entry with its broken count | Build Phase 1's `standing` |
| Build Phase 3 | the promise page, its banner and *Start a fix plan*; `the-admin-keeps-what-it-heard` changed; the demo live check | Build Phase 1's `proof` and `fix`; the admin's session host |
| Build Phase 4 | the nav: Paths nested to any depth with released counts, unassigned plans, drawer below 760 px, collapsible strip | `readPlanDeclarations`, `promises/display`'s `planDates` |
| Build Phase 5 | `plans/steps`; the plan page as Planning and Release, today's detail collapsible beneath | `workflow-types`, `lifecycle`'s `derivePlanPosition`, the skipped-ritual readers |
| Build Phase 6 | `plans/waiting`, `plans/history`; Needs you; the decision card; replies that start a session; answers committed on `main` | the session manager, `plans approve`, `acceptPlan`, `bookkeepingRoots` and the notes writer |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | On a plan page, the promise dashboard and a promise page, the nav lists every active plan in the project, and clicking one opens its page with it marked current | Test Phase 1 | Build Phase 4 | written | unit | promise: every-plan-is-one-click-away | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A2 | Paths and the plans in them appear in the order the project's master files declare, numbered | Test Phase 1 | Build Phase 4 | written | unit | promise: paths-keep-their-order | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A3 | A Path declared inside a Path inside a Path shows three levels deep, and a master file that names its own ancestor stops at the repeat | Test Phase 1 | Build Phase 4 | written | unit | promise: paths-keep-their-order | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A4 | Each Path shows how many of its plans are released, counting only plans a release has shipped | Test Phase 1 | Build Phase 4 | written | unit | promise: paths-keep-their-order | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A5 | A plan that no Path declares still appears in the nav | Test Phase 1 | Test Phase 1 | passing | unit | promise: paths-keep-their-order | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A6 | At 400 px wide the nav is closed, and the menu button opens and closes it | Test Phase 1 | Build Phase 4 | written | unit | promise: the-nav-fits-a-phone | apps/indusk-admin/src/app/p/[project]/cockpit-phone.test.tsx |
| A7 | At 400 px wide, with forty plans, none of the plan page, the dashboard or a promise page scrolls sideways | Test Phase 1 | Build Phase 4 | written | unit | promise: the-nav-fits-a-phone | apps/indusk-admin/src/app/p/[project]/cockpit-phone.test.tsx |
| A8 | On a desktop width, a collapsed nav is still collapsed after a reload | Test Phase 1 | Build Phase 4 | written | unit | promise: the-nav-fits-a-phone | apps/indusk-admin/src/app/p/[project]/cockpit-phone.test.tsx |
| A9 | A plan's page shows Planning and Release as two separate lists, each with its own count of steps done | Test Phase 1 | Build Phase 5 | written | unit | promise: a-plan-shows-two-workflows | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A10 | A plan's steps follow its type: a bugfix shows no Research or Decision step, and a ritual skipped with a reason shows as skipped, not missing | Test Phase 1 | Build Phase 5 | written | unit | promise: a-plan-shows-two-workflows | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx, apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A11 | A plan mid-build shows Planning complete and Release in progress at Build; one at review shows Build, Falsify, Cleanup and Audit done and Review current | Test Phase 1 | Build Phase 5 | written | unit | promise: a-plan-shows-two-workflows | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx, apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A12 | Changing a plan document's status on disk changes its step on the next render, and nothing on the page sets a step's state | Test Phase 1 | Build Phase 5 | written | unit | promise: a-plan-shows-two-workflows | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A13 | A plan whose agent has asked a question, a plan waiting for approval, and a plan stopped for review each appear under Needs you, naming the step they wait at; a plan waiting on nothing does not | Build Phase 6 | Build Phase 6 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts, apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A14 | A waiting plan's page shows exactly one decision, with accept, the alternative and a reply in words | Build Phase 6 | Build Phase 6 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx |
| A15 | Choosing an answer on the card gives the running agent that answer, and it carries on | Build Phase 6 | Build Phase 6 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A16 | A reply in words reaches the plan's agent whether or not a session is running for it | Build Phase 6 | Build Phase 6 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A17 | After the admin is restarted, the plan's history still shows each decision, the answer and when | Build Phase 6 | Build Phase 6 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/history.test.ts |
| A18 | The dashboard lists every promise in the registry, each as its sentence in words with its name and its plan's title | Test Phase 1 | Build Phase 2 | written | unit | promise: every-promise-is-listed | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A19 | Grouping by state, by plan and by Path each puts every promise in exactly one group; sorting by latest activity puts the most recently seen first | Test Phase 1 | Build Phase 2 | written | unit | promise: every-promise-is-listed | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A20 | Filtering by text matches a promise's sentence, its name and its plan | Test Phase 1 | Build Phase 2 | written | unit | promise: every-promise-is-listed | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A21 | A declared promise with tests written but not all passing shows as being proven | Build Phase 1 | Build Phase 2 | planned | unit | promise: every-promise-is-listed | apps/indusk-mcp/src/lib/promises/standing.test.ts, apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A22 | A broken promise is counted in the nav on every page | Test Phase 1 | Build Phase 2 | written | unit | promise: broken-promises-come-first | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A23 | Broken promises are listed first on the dashboard, the latest break first | Test Phase 1 | Build Phase 2 | written | unit | promise: broken-promises-come-first | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx |
| A24 | Every promise on the dashboard opens its own page, which has its own address | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A25 | The page lists every test row, in any plan active or archived, that names the promise, with its state and its test files | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A26 | The page lists each place the promise was marked in the running system and when each was last seen holding or broken; a promise never seen says so | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A27 | The page shows each of the last thirty days held and broken, per source, with broken days marked | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A28 | The page's history lists, dated, when the promise was declared, confirmed and changed, and each incident | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A29 | A broken promise whose every test passes says the tests miss the case that breaks it | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-promise-page-shows-its-proof | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A30 | A violation recorded while no admin page was open appears on that promise's page, on the day it happened | Build Phase 1 | Build Phase 3 | planned | unit | promise: the-admin-keeps-what-it-heard | apps/indusk-mcp/src/lib/promises/proof.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A31 | *Start a fix plan* on a broken promise's page starts the developer's own `claude` in the project with the promise, its symptom, its trace link and its tests given | Build Phase 1 | Build Phase 3 | planned | unit | promise: a-break-opens-a-fix-in-one-click | apps/indusk-mcp/src/lib/promises/fix.test.ts, apps/indusk-admin/src/app/p/[project]/promises/[name]/page.test.tsx |
| A32 | With the seat-holds demo running, turning its fault switch on shows the promise broken on the dashboard and counted in the nav; its page says why; *Start a fix plan* starts the fix; no terminal is used | Build Phase 3 | Build Phase 3 | planned | live check | the demo's story once, against the real admin and the seat-holds demo; also holds `the-demo-break-is-caught-locally` on the new pages | manual: recorded in Build Phase 3 |
| A33 | For the same project, the dashboard, a promise's page and `indusk promises status` report the same state for each promise and source | Build Phase 1 | Build Phase 3 | planned | unit | promise: the-editor-shows-the-same-health-as-the-admin | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A34 | The cockpit's promise words, plan titles, release dates, standing, proof, fix prompt, steps, waiting and history are each defined once in the package; the admin and the extension define none of them | Test Phase 1 | Build Phase 6 | planned | unit | promise: display-names-are-defined-once | apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts |
| A35 | A plan stopped for review shows, with its decision, each promise with the passing tests that prove it, what falsification found and fixed, and the files changed; accepting it there accepts the plan | Build Phase 6 | Build Phase 6 | planned | unit | promise: a-review-shows-its-evidence | apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx |
| A36 | A new plan can still be started from the admin under the new nav | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-can-start-from-the-admin | apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |

### Deferred Verification

- **The recording reads as the mockup does (test plan U1)**
  - reason: whether a newcomer watching follows it is a viewer's judgment, not a fact a test reads
  - would require: viewers, which the rehearsal provides
  - mitigation: Sandy reviews the demo-rehearsal take before it is recorded; findings go into demo-rehearsal's brief

## Checklist

### Test Phase 1: Author every assertion today's admin can be tested against, RED

**Tier**: med — the work step's default

**Goal**: author every row whose subject is reachable through today's layout, nav, plan page and promises page, and register the rest with their bodies.

- [ ] Create/confirm this plan's worktree (`indusk worktree create plan-cockpit`; made by `indusk plans start` on 2026-10-10 at `dusk-worktrees/plan-cockpit`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [ ] A fixture project for the admin's browser tests, `apps/indusk-admin/src/__tests__/helpers/cockpit-fixture.ts`: forty plans; a root `master.md` with three Paths, one holding a Path holding a Path; one plan declared nowhere; a bugfix plan; plans at review, mid-build and with a skipped ritual; a registry of promises in each state, one broken with every row passing; release dates for some plans. Readers are mocked from it, the way `plan/[name]/page.test.tsx` mocks them today
- [ ] A1, A2, A3, A4, A5, A22, A36 in `cockpit-nav.test.tsx`: render the project layout with each page as its child. RED today on their own assertions (no numbers, two levels, no released count, no broken count in the nav); A5 and A36 pass (Regression Guards)
- [ ] A6, A7, A8 in `cockpit-phone.test.tsx`: the layout at 400 px and 1280 px, with the plan page and the dashboard as children (the promise page joins A7 in Build Phase 3). RED today: no drawer, no collapse
- [ ] A9, A10, A11, A12 in `plan/[name]/workflows.test.tsx`: the plan page for the bugfix, the mid-build, the at-review and the skipped-ritual fixtures; A12 renders twice across a status change. RED today: no Planning or Release list
- [ ] A18, A19, A20, A23 in `promises/dashboard.test.tsx`: the promises page from the fixture. RED today: rows read as names, no grouping, no filter, broken not first
- [ ] A34 in `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts`: reads sources as files; the package exports `promises/rows`, `promises/standing`, `promises/proof`, `promises/fix`, `plans/steps`, `plans/waiting` and `plans/history`, each defining its function; no file under `apps/indusk-admin/src` or `apps/vscode-extension/src` defines `standingOf`, `proofOf`, `fixPrompt`, `planSteps`, `planWaiting` or `appendDecision`, or a fix prompt of its own. RED today: none exist
- [ ] Confirm each red test fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 1

- **A21, A25, A26, A27, A28, A29, A30, A31, A33** — their package halves test `promises/standing`, `promises/proof` and `promises/fix`, which Build Phase 1 introduces; a file importing them would fail to load. Bodies:

  ```typescript
  // standing.test.ts — promise: every-promise-is-listed, the-editor-shows-the-same-health-as-the-admin
  // standingOf(registry, health, rows): declared + rows [passing, written] → "being proven"        (A21)
  // declared + no rows → "declared"; enforced + health red from the alarm source → "broken"         (A21)
  // for the fixture registry and reads, standingOf's health per source equals
  //   healthRows(...) as `indusk promises status --json` prints it, promise by promise               (A33)

  // proof.test.ts — promise: a-promise-page-shows-its-proof, the-admin-keeps-what-it-heard
  // proofOf(root, name, deps): rows from an active and an archived impl naming it, with state + files (A25)
  // marks grouped by service+operation, each { lastHeld, lastBroken }; none → { marks: [], seen: false } (A26)
  // days: 30 entries per source; heard rows on day 3 → broken 2 on day 3; store upheld → held      (A27)
  // a heard row appended with no reader running is counted on its day                               (A30)
  // history: declared, enforced, changed from the file's ## History, incidents with dates, in order (A28)
  // broken + every naming row passing → banner.testsMissTheCase === true                             (A29)

  // fix.test.ts — promise: a-break-opens-a-fix-in-one-click
  // fixPrompt(broken) names the promise, its symptom, its trace link and its tests                  (A31)
  // the extension's fixFor(...) returns the same prompt through the package                          (A31)
  ```

#### Deferred to Build Phase 3

- **A24** — its subject is the route `/p/[project]/promises/[name]`, which Build Phase 3 creates; the test imports that page module, which would fail to load. The admin halves of A25–A31 are added to the same file then. Body:

  ```typescript
  // promises/[name]/page.test.tsx — promise: a-promise-page-shows-its-proof
  // render PromisePage({ params: { project, name: "seat-holds-never-double-book" } }) from the fixture:
  //   heading is the sentence in words; "Tests that back it" lists the rows; "Where it is watched";
  //   30 bars; History; the dashboard row's link href is `/p/${project}/promises/${name}`         (A24)
  ```

- **A32** — a live check against the real admin and the seat-holds demo, run once the promise page exists; recorded in Build Phase 3.

#### Deferred to Build Phase 6

- **A13, A14, A15, A16, A17, A35** — their subjects are `plans/waiting`, `plans/history`, the admin's `lib/decisions.ts` and `components/cockpit/DecisionCard.tsx`, all introduced in Build Phase 6. Bodies:

  ```typescript
  // waiting.test.ts — promise: decisions-wait-in-one-place
  // planWaiting({ sessions, plans, builds }): a session with a pending AskUserQuestion → { plan, on: "question", step }
  //   impl draft with brief + test plan accepted → { on: "approval", step: "Impl" }
  //   build stopped at review → { on: "review", step: "Review" }; nothing pending → absent           (A13)

  // DecisionCard.test.tsx — promise: decisions-wait-in-one-place, a-review-shows-its-evidence
  // one card, three controls: accept, the alternative, a reply box                                 (A14)
  // on "review": each promise with its passing tests, falsification's findings, files changed;
  //   accept → POST /api/plans/accept (as BuildControls does)                                        (A35)

  // decisions.test.ts — promise: decisions-wait-in-one-place
  // answer(question) with a fake session → session.answer called with the chosen option            (A15)
  // reply("words") with a running session → say(); with none → a session started for the plan
  //   in its worktree with the decision and the words as its prompt                                 (A16)

  // history.test.ts — promise: decisions-wait-in-one-place
  // appendDecision(root, plan, {decision, answer, by, at}) then a fresh readHistory(root, plan)
  //   returns it; the file is .indusk/plan-history/<plan>.md in the main checkout                  (A17)
  ```

#### Regression Guards

- **A5** — today's sidebar already lists plans no Path declares; the row pins that the rebuilt nav keeps doing so (the inventory comes from disk and is never subtracted).
- **A36** — today's admin starts a plan; the row pins that the new nav keeps the way in (`a-plan-can-start-from-the-admin`).

#### Test Phase 1 Verification

- [ ] A1–A4, A6–A12, A18–A20, A22, A23, A34 authored and each fails on its own assertion; A5 and A36 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/cockpit-nav.test.tsx src/app/p/\[project\]/cockpit-phone.test.tsx src/app/p/\[project\]/plan/\[name\]/workflows.test.tsx src/app/p/\[project\]/promises/dashboard.test.tsx; cd ../indusk-mcp && pnpm exec vitest run src/__tests__/cockpit-single-definition.test.ts`)
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

### Build Phase 1: The promise facts, in the package

**Tier**: med — the work step's default

**Goal**: everything the dashboard and the promise page show about a promise, computed once in the package; the extension's fix prompt moved in.

- [ ] Export `rowsNaming` as `./promises/rows` in `apps/indusk-mcp/package.json`
- [ ] `apps/indusk-mcp/src/lib/promises/standing.ts`, exported as `./promises/standing`:
  ```typescript
  type Standing = "broken" | "being-proven" | "declared" | "enforced" | "retired";
  function standingOf(entry: PromiseEntry, health: HealthRow[], rows: PlanRow[]): {
    standing: Standing; health: Record<SourceName, Health>; tests: { passing: number; total: number };
    lastActivity: string | null;
  }
  function readStanding(projectRoot: string, deps?: StandingDeps): Promise<StandingRow[]>
  ```
  health from `promises/health` (`readHealth`, `healthRows`, `alarmRead`) — never recomputed; broken is red from the alarm source
- [ ] `apps/indusk-mcp/src/lib/promises/proof.ts`, exported as `./promises/proof`: `proofOf(projectRoot, name, deps)` → `{ rows, marks, days, history, banner }`; marks grouped by `service` + `operation` from `promises/telemetry`'s `MarkedSpan`s; days from `countHeard` (broken, per source) and the store's `readWindow` (held), thirty one-day buckets; history from the promise file's `## History` and `promises/incidents`
- [ ] `apps/indusk-mcp/src/lib/promises/fix.ts`, exported as `./promises/fix`: `fixPrompt(broken)` and the `BrokenPromise` shape, moved from `apps/vscode-extension/src/core/fix.ts`; the extension's `fixFor`/`fixAction` import it
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 1 Verification

- [ ] A21, A25–A31, A33's package halves pass, each red first (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/standing.test.ts src/lib/promises/proof.test.ts src/lib/promises/fix.test.ts && pnpm exec vitest related src/lib/promises/health.ts src/lib/promises/heard.ts --run`); the extension's fix tests still pass (`cd apps/vscode-extension && pnpm exec vitest run src/core`); tsc and biome clean on changed files

#### Build Phase 1 Context

- [ ] root (Key Decisions): "Plan cockpit: the admin is the cockpit — nav by Path, plan page as Planning and Release with its decision, dashboard broken first, a page per promise with its proof; every derived fact from a package module (`promises/standing`, `proof`, `fix`, `plans/steps`, `waiting`, `history`) — see `/decisions/plan-cockpit`" — always-on because stage 2 and the editor must reuse these modules rather than write their own
- [ ] `apps/indusk-admin/CLAUDE.md`: a fact the cockpit shows is read from a package module; the admin's `lib/` holds only fs-to-props glue — guarded by `cockpit-single-definition.test.ts`

#### Build Phase 1 Document

- [ ] The package's subpath reference: `promises/rows`, `promises/standing`, `promises/proof`, `promises/fix`

### Build Phase 2: The dashboard, broken first

**Tier**: med — the work step's default

**Goal**: the promises page as the mockup's dashboard, and the nav's Promises entry with its broken count.

- [ ] Rebuild `app/p/[project]/promises/page.tsx` and `components/Promises.tsx` on `readStanding`: the stacked bar of standings with counts; group by state, plan or Path; sort (latest activity, name, plan); filter by sentence, name or plan; broken first, latest break first; each row its sentence in words (`promiseWords`), name, plan title (`planTitle`), tests passing/total, thirty-day held and broke, last activity. Group, sort and filter in the URL's query. Incidents and the per-source timeline kept below
- [ ] The nav's Promises entry with the broken count on every page (`app/p/[project]/layout.tsx`)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 2 Verification

- [ ] A18–A23 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/promises/dashboard.test.tsx src/app/p/\[project\]/cockpit-nav.test.tsx -t "A22" && pnpm exec vitest related src/components/Promises.tsx --run`); `Promises.heard.test.tsx` and `Promises.incidents.test.tsx` still pass; tsc and biome clean on changed files

#### Build Phase 2 Context

- [ ] (no rule this phase — the dashboard follows the admin's existing conventions)

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the dashboard — standings, grouping, sort, filter, broken first

### Build Phase 3: The promise page and its fix

**Tier**: med — the work step's default

**Goal**: a page per promise with its proof, its banner and *Start a fix plan* — the demo's story complete.

- [ ] `app/p/[project]/promises/[name]/page.tsx` on `proofOf`: the banner (state, latest break, "the tests miss the case" when they do, *Start a fix plan*); four tiles; Tests that back it; Where it is watched ("not seen yet" when empty); thirty days per source, broken days marked; Same plan; Where it lives; History. Dashboard rows link to it
- [ ] *Start a fix plan*: `POST /api/promises/[name]/fix` starts an admin session in the project with `fixPrompt(broken)`, shown in the session panel
- [ ] A24 authored, and the admin halves of A25–A31 added to `promises/[name]/page.test.tsx`; the promise page joins A7's widths in `cockpit-phone.test.tsx`
- [ ] `indusk promises change the-admin-keeps-what-it-heard --plan plan-cockpit --statement "The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and each promise's own page shows them counted per day over thirty days, whether or not a page was open when they happened." --reason "plan-cockpit gives each promise its own page"`
- [ ] A32, the live check: start the seat-holds demo and the admin from this worktree's build; turn the fault switch on; record here the time to broken on the dashboard and in the nav, what the page says, and that *Start a fix plan* started a session — no terminal used
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A24–A31 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/promises/\[name\]/page.test.tsx && pnpm exec vitest related src/app/p/\[project\]/promises/\[name\]/page.tsx --run`); A32 recorded above; tsc and biome clean on changed files

#### Build Phase 3 Context

- [ ] (no rule this phase beyond Build Phase 1's — the page reads `promises/proof`)

#### Build Phase 3 Document

- [ ] New `apps/docs/src/reference/admin-ui/promise-page.md`: each section, where it comes from, and a Mermaid diagram of the page's sections and the package module each reads

### Build Phase 4: The nav — Paths, released counts, the phone

**Tier**: med — the work step's default

**Goal**: the mockup's nav on every page.

- [ ] `components/PlanList.tsx` `buildGroups` walks `readPlanDeclarations` recursively: a subplan that is itself a parent opens as a group, to any depth, numbered in declared order; a repeat stops the walk; plans no Path declares listed after the Paths
- [ ] Each Path's `released/total` from `planDates(...).released` (via `readHealthNames` or `planDates` per plan)
- [ ] `components/ui/Sidebar.tsx`: below 760 px a drawer, closed by default, opened by a menu button; above, a collapsible strip whose state is kept in `localStorage` (read and written in `try`/`catch`); no page wider than the viewport at 400 px
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 4 Verification

- [ ] A1–A8 and A36 pass (`cd apps/indusk-admin && pnpm exec vitest run src/app/p/\[project\]/cockpit-nav.test.tsx src/app/p/\[project\]/cockpit-phone.test.tsx && pnpm exec vitest related src/components/PlanList.tsx src/components/ui/Sidebar.tsx --run`); `PlanList.grouping.test.tsx` updated where it pinned two levels; tsc and biome clean on changed files

#### Build Phase 4 Context

- [ ] (no rule this phase — nesting follows the planning rule that hierarchy is declared top-down in `master.md`)

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the nav — Promises, Needs you, Paths nested as declared with released counts, the phone drawer

### Build Phase 5: The plan page — Planning and Release

**Tier**: med — the work step's default

**Goal**: a plan's page as its two workflows, every step derived.

- [ ] `apps/indusk-mcp/src/lib/plans/steps.ts`, exported as `./plans/steps`:
  ```typescript
  type StepState = "done" | "current" | "needs-you" | "not-yet" | "skipped";
  function planSteps(plan: PlanSnapshot): {
    planning: { name: "Research" | "Brief" | "Test plan" | "Decision" | "Impl"; state: StepState }[];
    release: { name: "Build" | "Falsify" | "Cleanup" | "Audit" | "Review" | "Release"; state: StepState }[];
  }
  ```
  Planning from `WORKFLOW_DEFINITIONS[type].requires` and each document's status; Release from `derivePlanPosition`'s segments and the skipped-ritual readers; with `steps.test.ts`
- [ ] `app/p/[project]/plan/[name]/page.tsx` and `components/PlanDetail.tsx`: header (title, dates, Path, promise chips with test counts), Planning and Release lists with their counts; today's documents, phases and rows under a collapsible *Details*
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 5 Verification

- [ ] A9–A12 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/steps.test.ts; cd ../indusk-admin && pnpm exec vitest run src/app/p/\[project\]/plan/\[name\]/workflows.test.tsx && pnpm exec vitest related src/components/PlanDetail.tsx --run`); existing `PlanDetail.*.test.tsx` still pass or are updated where they pinned the old layout; tsc and biome clean on changed files

#### Build Phase 5 Context

- [ ] (no rule this phase — the step names are defined once in `plans/steps`, guarded by A34)

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the plan page — Planning and Release, what each step reads, Details

### Build Phase 6: Decisions wait in one place

**Tier**: strong — commits on `main` and drives running agents; a wrong answer routed to the wrong session or a commit of someone's staged work costs more than the tier

**Goal**: Needs you, the decision card, answers that reach the agent, and a history that outlasts the admin.

- [ ] `apps/indusk-mcp/src/lib/plans/waiting.ts`, exported as `./plans/waiting`: `planWaiting({ sessions, plans, builds })` → per plan at most one `{ on: "question" | "approval" | "review", step, decision, alternative }`; with `waiting.test.ts`
- [ ] `apps/indusk-mcp/src/lib/plans/history.ts`, exported as `./plans/history`: `appendDecision(root, plan, entry)` appends a dated line to `.indusk/plan-history/<plan>.md` in the main checkout (via `bookkeepingRoots`) and commits it on `main` as `chore(indusk): <plan> — <answer>` through the notes writer `current.md` and lessons use (only that file; left uncommitted with the reason when `main` is not clean to commit on); `readHistory(root, plan)`; with `history.test.ts`
- [ ] `apps/indusk-admin/src/lib/decisions.ts` and `POST /api/plans/[name]/decision`: accept → the question's answer, `plans approve`, or `acceptPlan`; the alternative → the other option; a reply → `say` on the plan's running session, or a new session for the plan in its worktree with the decision and the words as its prompt; every answer through `appendDecision`
- [ ] `components/cockpit/DecisionCard.tsx` on the plan page (the review's evidence shown with it, as the session panel shows it today); Needs you in the nav from `planWaiting`; the plan page's *What happened* from `readHistory`
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 6 Verification

- [ ] A13–A17, A34, A35 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/waiting.test.ts src/lib/plans/history.test.ts src/__tests__/cockpit-single-definition.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/cockpit/DecisionCard.test.tsx src/lib/decisions.test.ts src/app/p/\[project\]/cockpit-nav.test.tsx && pnpm exec vitest related src/lib/decisions.ts --run`); tsc and biome clean on changed files

#### Build Phase 6 Context

- [ ] planning (`templates/planning/CLAUDE.md`): `.indusk/plan-history/<plan>.md` is the record of a plan's decisions, written by `plans/history` and committed on `main`, never by hand — see `/decisions/plan-cockpit`

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/admin-ui/sessions.md`: Needs you, the decision card, where a reply goes, the recorded history
- [ ] `apps/docs/src/decisions/plan-cockpit.md`: the ADR published; changelog: Added — "The admin is the cockpit: plans by Path, each plan's two workflows and the decision it waits on, the promise dashboard with broken promises first, and a page per promise with its proof and a fix."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/{standing,proof,fix}.ts` | new — the promise facts |
| `apps/indusk-mcp/src/lib/plans/{steps,waiting,history}.ts` | new — the plan facts |
| `apps/indusk-mcp/package.json` | seven new subpath exports |
| `apps/vscode-extension/src/core/fix.ts` | imports `promises/fix` |
| `apps/indusk-admin/src/app/p/[project]/layout.tsx` | the nav |
| `apps/indusk-admin/src/components/PlanList.tsx`, `components/ui/Sidebar.tsx` | nested Paths, released counts, drawer, strip |
| `apps/indusk-admin/src/app/p/[project]/promises/page.tsx`, `components/Promises.tsx` | the dashboard |
| `apps/indusk-admin/src/app/p/[project]/promises/[name]/page.tsx` | new — the promise page |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx`, `components/PlanDetail.tsx` | Planning and Release, Details |
| `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx`, `src/lib/decisions.ts`, API routes | new — decisions |
| `apps/docs/src/reference/admin-ui/*`, `apps/docs/src/decisions/plan-cockpit.md` | docs |

## Dependencies

- display-names (closed 2026-10-10): `promises/display`
- incident-recording (closed 2026-10-08): the heard store, incidents
- admin-plan-authoring: the session host, `plans approve`, `acceptPlan`

## Notes

- The build order puts the demo's story first (Build Phases 1–3). If time runs short, Build Phase 6 is the cut: `decisions-wait-in-one-place` would be withdrawn from this plan and carried to a follow-on, and A34's list loses `plans/waiting` and `plans/history`.
- A7 covers three pages; the promise page joins it in Build Phase 3, and the row passes in Build Phase 4 with the drawer.
