---
title: "Cockpit audit fixes — what plan-cockpit's cold audit found"
date: 2026-10-11
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Cockpit audit fixes — what plan-cockpit's cold audit found

## Goal

Make the four claims plan-cockpit's audit found too narrow true as worded: thirty days that say only what was seen, every question answered, approval only for a finished plan, a promise under its innermost Path — and add the rows the audit found missing.

## Scope

### In Scope
- `promises/standing` and `promises/proof`: one thirty-day window and one counting rule, read by the dashboard and the page.
- The decision card and `plans/waiting`: several questions at once; approval not offered while a session writes the impl.
- The dashboard's Path grouping and the nav's: the innermost Path.
- Rows: the three-surface health comparison, and the history commit when `main` cannot take it.

### Out of Scope
- Restoring the old table's groupings, retired toggle or "as of" marker.
- Declaring marks, or running a promise's checks against live data.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | red tests for A1, A2, A4–A10; guards A3, A11 | the fixture project in `cockpit-fixture.ts`; today's standing, proof, waiting, dashboard |
| Build Phase 1 | one window and one counting rule in `promises/standing`; the page's days from the same module | `promises/heard`, `promises/store` |
| Build Phase 2 | `plans/waiting` carrying every question and a writing flag; the card answering each | the session manager's `pendingQuestion` |
| Build Phase 3 | the innermost Path in the dashboard and the nav; the three-surface row | `readPlanDeclarations` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A promise seen upheld on three days and broken on one shows "held 3 · broke 1" on the dashboard | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A2 | A promise that was never seen shows no held days, not thirty | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A3 | Five violations heard on one day count as one broken day | Test Phase 1 | Test Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A4 | A violation heard under a promise's earlier name is counted on its day, on the dashboard and on the promise page alike | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A5 | For one promise, the dashboard row and the promise page give the same number of held days and broken days | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/proof.test.ts |
| A6 | The dashboard and the promise page count the same thirty days: a violation on the first of the page's thirty days appears on both, and one on the day before appears on neither | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen | apps/indusk-mcp/src/lib/promises/proof.test.ts |
| A7 | An agent that asks two questions at once has both shown on the plan's card, and answering them gives the agent an answer to each | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-question-is-answered-in-full | apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx, apps/indusk-admin/src/lib/decisions.test.ts |
| A8 | A plan whose impl is a draft while a session is still writing it is not under Needs you for approval; once the session ends, it is | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A9 | A plan declared by an outer Path and by a Path inside it is grouped under the inner Path on the dashboard, and the nav lists it there | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-promise-sits-in-its-innermost-path | apps/indusk-admin/src/app/p/[project]/promises/dashboard.test.tsx, apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |
| A10 | For one project, `indusk promises status`, the dashboard and a promise's page report the same state for each promise and source | Test Phase 1 | Build Phase 3 | passing | unit | promise: the-editor-shows-the-same-health-as-the-admin | apps/indusk-mcp/src/__tests__/same-health-three-surfaces.test.ts |
| A11 | When `main` cannot take the history commit, an answered decision says it was sent and that the history was left uncommitted, with the reason, and nothing else on `main` is touched | Test Phase 1 | Test Phase 1 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/plans/history.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Tier**: med — the work step's default

**Goal**: author each row against today's code and read each failure; two rows are guards that pass at once.

- [x] Create/confirm this plan's worktree — confirmed: this session runs in `dusk-worktrees/cockpit-audit-fixes` on `plan/cockpit-audit-fixes`
- [x] A1, A2, A4 in `standing.test.ts`; A5, A6 in `proof.test.ts`: the same fixture promise read through `standingOf` and `proofOf`, with heard rows and store days handed in. RED today: held is `30 − brokenDays`, the page's window is calendar days and the dashboard's rolling
- [x] A7 in `DecisionCard.test.tsx` and `decisions.test.ts`; A8 in `waiting.test.ts`. RED today: only the first question is carried; a draft impl is offered whatever a session is doing
- [x] A9 in `dashboard.test.tsx` and `cockpit-nav.test.tsx`. RED today: `pathOf` returns the first declaring Path
- [x] A10 in `same-health-three-surfaces.test.ts`: `indusk promises status --json`'s function, `readStanding` and `proofOf` over one fixture project, each source's state per promise compared
- [x] A3 (`standing.test.ts`) and A11 (`history.test.ts`): written to pass; they pin behaviour that has no row at its edge
- [x] Confirm each red test fails on its own assertion rather than on a missing import — confirmed by running each; A10 was green on arrival (decision: kept as a guard, state `passing`; `reportRows`, `readStanding` and `proofOf` already agree over one fixture)

#### Regression Guards

- **A3** — plan-cockpit's A40 made violations count as days; this row pins the edge (five on one day) so the new window cannot lose it.
- **A11** — the history commit already leaves the line uncommitted with a reason when `main` cannot take it; the audit found no row saying so.

#### Test Phase 1 Verification

- [x] A1, A2, A4–A10 authored and each fails on its own assertion; A3 and A11 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/standing.test.ts src/lib/promises/proof.test.ts src/lib/plans/waiting.test.ts src/lib/plans/history.test.ts src/__tests__/same-health-three-surfaces.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/cockpit/DecisionCard.test.tsx src/lib/decisions.test.ts "src/app/p/[project]/promises/dashboard.test.tsx" "src/app/p/[project]/cockpit-nav.test.tsx"`)

### Build Phase 1: Thirty days that say only what was seen

**Tier**: med — the work step's default

**Goal**: one window and one counting rule for the dashboard's days and the page's, read from the same module.

- [x] `promises/standing`: the thirty days are the page's — thirty UTC days ending today — and held is days with an upheld run and no break; a day nobody watched is neither; a promise never seen has none (A1, A2, A6)
- [x] `promises/proof`: its days come from the same function as the dashboard's, so the two cannot count differently (A4, A5)
- [x] Shape — reviewed `standing.ts` and `proof.ts` by hand: nothing found (the day counter is one named, pure, tested function; `proof.daysOf` lost its private bucket maths). Left as is: `standing.ts` now also reads the store for upheld runs — one reason to change (what the thirty days hold), kept beside the counter so the two cannot drift

#### Build Phase 1 Verification

- [x] A1–A6 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/standing.test.ts src/lib/promises/proof.test.ts && pnpm exec vitest related src/lib/promises/standing.ts src/lib/promises/proof.ts --run`); admin dashboard and promise page tests still pass; tsc and biome clean on changed files

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: the dashboard's days and the page's are one function's, never two — guarded by A5

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/admin-ui/promise-page.md`: what a held day, a broken day and an unwatched day are

### Build Phase 2: Every question, and approval for a finished plan

**Tier**: med — the work step's default

**Goal**: the card carries all of an ask, and approval waits for the writing to stop.

- [x] `plans/waiting`: a waiting question carries every question the agent asked; a plan with a session still writing its impl is not waiting on approval (A7, A8)
- [x] `lib/decisions` and `DecisionCard`: each question is shown and answered, and the answers go to the agent under each question's text (A7)
- [x] Shape — reviewed `waiting.ts`, `decisions.ts`, `DecisionCard.tsx`: nothing found. Left as is: the card's multi-question branch lives in `DecisionCard` beside the single-question one (one component, one card; extracting it would split state the two share)

#### Build Phase 2 Verification

- [x] A7, A8 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/waiting.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/cockpit/DecisionCard.test.tsx src/lib/decisions.test.ts && pnpm exec vitest related src/lib/decisions.ts --run`); tsc and biome clean on changed files

#### Build Phase 2 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a decision's card shows everything the agent asked, never the first of it — guarded by A7

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: several questions on one card; when approval is offered

### Build Phase 3: The innermost Path, and the three surfaces

**Tier**: med — the work step's default

**Goal**: a promise under the Path closest to its plan, and one test that holds the three surfaces to one state.

- [x] `promise-dashboard.ts` `pathOf` and the nav's grouping: the innermost declaring Path (A9)
- [x] A10 passes — it was already green on arrival (see Test Phase 1): kept as the guard it is; `reportRows`, `readStanding` and `proofOf` agree over one fixture, re-run green after Build Phases 1 and 2
- [x] Shape — reviewed `path-nesting.ts`, `promise-dashboard.ts`, `PlanList.tsx`: nothing found. The nesting question is one module (`pathsInside`/`declaredWithin`/`innermostPath`) read by both surfaces

#### Build Phase 3 Verification

- [x] A9, A10 pass (`cd apps/indusk-admin && pnpm exec vitest run "src/app/p/[project]/promises/dashboard.test.tsx" "src/app/p/[project]/cockpit-nav.test.tsx"; cd ../indusk-mcp && pnpm exec vitest run src/__tests__/same-health-three-surfaces.test.ts`); tsc and biome clean on changed files

#### Build Phase 3 Context

- [x] (none needed — no convention changed: the Path rule follows the planning rule that hierarchy is declared top-down in `master.md`, already written there)

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: a promise and a plan sit under the innermost Path that declares them

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/{standing,proof}.ts` | one window, one counting rule |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | every question; a writing flag |
| `apps/indusk-admin/src/lib/decisions.ts`, `components/cockpit/DecisionCard.tsx` | each question answered |
| `apps/indusk-admin/src/lib/promise-dashboard.ts`, `components/PlanList.tsx` | the innermost Path |
| tests named in the trajectory | new rows |

## Dependencies

- plan-cockpit (closed 2026-10-10): the modules and pages this plan corrects

## Notes

- Decision (unattended build): a session "still writing" is any session the admin runs for the plan that has no question pending — `readWaiting` hands in only the one current session, so this is the running session, never a stale record. A multi-question ask refuses `accept`/`alternative`/`reply` (they would answer the first only) and takes `choice: "answers"`, an answer under each question's text.

- Decision (unattended build): a promise seen only by a sighting with no upheld day on record shows `held 0`, never thirty — the days say only what was seen. `readStanding` now reads the store's window itself (and honours `home`), the same read the page's days use.

- Parked on purpose (Sandy, 2026-10-11): approved so it is ready, and built when the cockpit's own use shows which of these matter. The brief's *Settled by default* names the two readings to revisit first.
