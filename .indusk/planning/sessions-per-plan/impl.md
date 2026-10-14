---
title: "Sessions per plan"
date: 2026-10-14
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "041a7060639eb7f83fa4cecc337cd9478ca47dd0c8aa32c70f3d771d21404fc1"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T21:39:31.605Z"
---

# Sessions per plan

## Goal

Several plans can each have an agent at once: the session manager refuses only a second session of the same kind on the same plan, or a start beyond the machine's cap (`sessions.max` in the InDusk home's `config.json`, 4 by default), and every admin caller asks for its own plan's session (ADR decisions 1–4).

## Scope

### In Scope
- `SessionManager`: the owner rule, the cap, `forPlan` and `running` in place of `current`.
- `readSessionsMax()` reading `~/.indusk/config.json` (honouring `INDUSK_HOME`).
- Every admin caller of `current()`: the build host and build route, the draft routes, the decision delivery and `readWaiting`, the sessions route and its client, the promise fix route.

### Out of Scope
- A view of every running session across plans (Sandy, 2026-10-14: stays out).
- The agent docked beside every page of a plan (the next plan).
- Warning when two plans touch the same files.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | red tests for the owner rule, the cap and the admin callers; the register | today's `SessionManager` and admin routes |
| Build Phase 1 | the owner rule, the cap, `forPlan`, `running`, `readSessionsMax`; `current` removed | `manager.ts`, `version-check.ts`'s `induskHome` |
| Build Phase 2 | every admin caller on `forPlan`/`running`; the sessions route keyed by plan | Build Phase 1's `forPlan`, `running` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | With a planning session running for one plan, a planning session for another plan starts | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A2 | A second planning session on the same plan is refused, naming the session already running | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A3 | A plan can have a planning session and a build running at the same time | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-session-belongs-to-its-plan | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A4 | A draft's conversation starts while a plan's session is running | Test Phase 1 | Build Phase 2 | written | unit | promise: a-session-belongs-to-its-plan | apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts |
| A5 | Starting a build of one plan from the admin is not refused because another plan has a session | Test Phase 1 | Build Phase 2 | written | unit | promise: a-session-belongs-to-its-plan | apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts |
| A6 | With sessions running on two plans, each plan's waiting entry shows its own session and question, never the other's | Test Phase 1 | Build Phase 2 | written | unit | promise: a-session-belongs-to-its-plan | apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts |
| A7 | In the running admin, a person starts planning on two plans and talks to both without stopping either | Build Phase 2 | Build Phase 2 | planned | live check | promise: a-session-belongs-to-its-plan | manual: recorded in Build Phase 2's Verification |
| A8 | With as many sessions running as the cap allows, another start is refused, naming each running session and how to stop one | Test Phase 1 | Build Phase 1 | passing | unit | promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A9 | With no sessions.max set a fifth session is refused and a fourth is not; with sessions.max 2 in the InDusk home's config a third is refused | Test Phase 1 | Build Phase 1 | passing | unit | promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A10 | With two sessions running, stopping one leaves the other running and recorded | Test Phase 1 | Build Phase 1 | passing | unit | a regression guard over a-session-can-be-stopped, which the brief must not break; it needs two sessions, which only this plan allows | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A11 | A session that ends records its end for its own plan, and the others' records stay | Test Phase 1 | Build Phase 1 | passing | unit | a regression guard over a-session-says-how-it-ended; it needs two sessions, which only this plan allows | apps/indusk-mcp/src/lib/session/manager.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree create sessions-per-plan`, which records the assignment; this plan was started with `indusk plans start`, which made it) — worktree-per-plan default
- [x] A1, A2, A3, A8, A9, A10, A11 in `apps/indusk-mcp/src/lib/session/manager.test.ts`, against the real `SessionManager` with its fake launcher (the file's `manager()` helper). A8 passes the cap through the constructor (`new SessionManager({ ..., max: 2 })`); A9 points `INDUSK_HOME` at a temp folder with and without `config.json` holding `{ "sessions": { "max": 2 } }`. Today's "a second session is refused while one runs" test states the rule this plan removes: replace it with A2's same-plan refusal (test-plan Notes). Each fails today on its own assertion: the second start throws `SessionBusy`
- [x] A4, A5, A6 in `apps/indusk-admin/src/__tests__/sessions-per-plan.test.ts`: install a real `SessionManager` with a fake launcher on `globalThis[Symbol.for("indusk.admin.sessionManager")]` (what `session-host.ts` reads), start a session for plan `one`, then: A4 POSTs the draft talk route for a draft and expects 201; A5 calls the build host's start for plan `two` and expects no refusal; A6 starts a second session on `two` with a pending question and expects `readWaiting` to hold an entry for each plan with its own question. Each fails today on its own assertion (409, a refusal, one entry)
- [x] Confirm each fails on its own assertion rather than on a missing import

#### Regression Guards

- None. A10 and A11 are guards over existing promises, and they go red today because they need a second session on another plan, which today's rule refuses.

#### Test Phase 1 Verification

- [x] A1–A6 and A8–A11 are authored, and each fails on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/sessions-per-plan.test.ts`)
  - Result: `manager.test.ts` 8 failed | 10 passed (the 10 are the existing tests; A1, A2, A3, A8, A9 twice, A10, A11 red), and `sessions-per-plan.test.ts` 3 failed | 0 passed (A4, A5, A6). Every red is its own assertion, none a load error: A2 expects the refusal text `a planning session is already running for seats: <id>` and gets today's `a session is already running: …`; A1, A3, A8, A10, A11 expect the second start (other plan, or build) to be undefined and get `SessionBusy`; A9 expects four starts without a refusal and gets `SessionBusy` on the second; A4 expects 201 and gets 409; A5 expects `startBuild` to resolve and it rejects with `a session is already running`; A6 expects the second start not to throw and it throws. Nothing deferred.

### Build Phase 1: A session belongs to its plan, and the machine has a cap

**Tier**: med — the work step's default

- [x] `apps/indusk-mcp/src/lib/session/manager.ts`: `start` refuses only a held session with the same `project`, `plan` and `kind` (`SessionBusy`: `a <kind> session is already running for <plan>: <id> — stop it first`), and refuses at the cap (`<max> sessions are running (sessions.max): <kind> for <plan>, … — stop one from its plan's page in the admin`)
  ```typescript
  constructor(opts: { recordPath?: string; start?: (opts: SessionOptions) => Session; max?: number } = {})
  forPlan(project: string, plan: string, kind?: SessionKind): SessionRecord | undefined
  running(): SessionRecord[]
  ```
- [x] `readSessionsMax(home = induskHome()): number` in `apps/indusk-mcp/src/lib/session/limits.ts`: `sessions.max` from `<home>/config.json`, a positive integer, else 4; an absent or malformed file is 4, never a throw. The manager reads it when no `max` is given
- [x] Remove `current()`; export `forPlan`, `running` and `readSessionsMax` through `./session`
  - Note: `current()` was removed in the manager commit (`b7159a35`); `forPlan`/`running` are methods of the already-exported `SessionManager`, and `readSessionsMax` and `DEFAULT_SESSIONS_MAX` are exported here. Callers of `.current()` found by grep, all left for Build Phase 2 and breaking the admin's typecheck until then: `app/api/plans/build/route.ts`, `app/api/drafts/[id]/{talk,discard,accept}/route.ts`, `app/api/sessions/route.ts`, `lib/decisions-reader.ts`, `lib/decisions.ts`, `lib/build-host.ts` (two), and `lib/decisions.test.ts` (two). No caller outside the admin.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/session/manager.ts`) — the owner-rule and cap refusals sit inline in the already long start(); extract a private refusalFor(opts) that returns the SessionBusy or undefined, so the two refusals have one named seam and start() only launches. Rule: Should this inline block have been a named function or module? (one reason to change per unit)

#### Build Phase 1 Verification

- [x] A1, A2, A3, A8, A9, A10, A11 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/session/manager.test.ts && pnpm exec vitest related src/lib/session/manager.ts src/lib/session/limits.ts --run`); tsc and biome clean on changed files
  - Result: `pnpm build` clean; `manager.test.ts` 18 passed (A1, A2, A3, A8, A9 twice, A10, A11 green, plus the 10 existing); `vitest related` on `manager.ts` and `limits.ts` 5 files, 40 tests passed; `tsc --noEmit` in `apps/indusk-mcp` clean; `biome check src/lib/session` clean. The admin's typecheck is red until Build Phase 2, by design.

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: a session is owned by its project, plan and kind; the machine's cap is `sessions.max` in the InDusk home's `config.json` — guarded by `manager.test.ts` (A2, A9)
- [x] root (Key Decisions): "Sessions per plan: a session is owned by its plan and kind; the machine runs at most `sessions.max` — see `/decisions/sessions-per-plan`" — always-on because every admin feature that starts an agent is written under it

#### Build Phase 1 Document

- [x] `apps/docs/src/decisions/sessions-per-plan.md` published from the ADR, with its sidebar entry

### Build Phase 2: Every admin caller asks for its own plan's session

**Tier**: med — the work step's default

- [x] `apps/indusk-admin/src/lib/build-host.ts` and `app/api/plans/build/route.ts`: the start checks and the build's session use `forPlan(project, plan, "build")`
- [x] `app/api/drafts/[id]/talk`, `accept`, `discard`: each asks for the draft's own session (`forPlan(project, <the draft's key>)`), not any session
- [x] `lib/decisions.ts` (`deliver`) and `lib/decisions-reader.ts` (`readWaiting`): the plan's own session, and one waiting entry per running session of the project
- [x] `app/api/sessions/route.ts`: `GET ?project&plan&kind` returns that plan's session; its client in `components/session/PlanSession.tsx` passes them; `app/api/promises/[name]/fix/route.ts` asks for its plan's
  - Note: the fix route never called `current()`; it only starts a session, which the manager's owner rule now judges, so only its comment changed. Other `/api/sessions` clients found by grep: `DraftConversation.tsx` and `StartFix.tsx` (both moved to the new URL via `sessionUrl` in `lib/session-owner.ts`) and `LiveRefresh.tsx` (a reachability probe with no plan: the route answers `{ session: null }` with 200).
- [x] The mocks that stub `current` (`build-host.release.test.ts`, `promise-fix-route.test.ts`) stub `forPlan`/`running` instead
  - Note: `build-host.release.test.ts` now stubs `forPlan` (committed with the build host); `promise-fix-route.test.ts` stubs only `start`, never `current`, so it needed nothing; `decisions.test.ts` reads `manager.forPlan(PROJECT, PLAN)` where it read `manager.current()` (committed with the decisions), same assertions; `DraftConversation.test.tsx`'s fetch stub matches the new sessions URL. No assertion encoded "one session".
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 2 Verification

- [ ] A4, A5, A6 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/sessions-per-plan.test.ts && pnpm exec vitest related <the files this phase changed> --run`); tsc and biome clean on changed files; the admin's everyday suite passes
- [ ] A7, live check: with the admin running from this worktree, start planning on two plans, send each a message, and see both answer without either being stopped — recorded here with the date and what was seen

#### Build Phase 2 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a route asks for its own plan's session (`forPlan`), never "the" session — guarded by `sessions-per-plan.test.ts` (A6)

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md` (sessions: one per plan and kind, the cap and where it is set) and `apps/docs/src/guide/multi-agent.md` (several plans' agents at once); changelog: Changed — "Several plans can each have an agent at once; a machine runs at most `sessions.max` (4) sessions, set in `~/.indusk/config.json`."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/session/manager.ts` | owner rule, cap, `forPlan`, `running`; `current` removed |
| `apps/indusk-mcp/src/lib/session/limits.ts` | new: `readSessionsMax` |
| `apps/indusk-mcp/src/lib/session/index.ts` | exports |
| `apps/indusk-admin/src/lib/build-host.ts`, `lib/decisions.ts`, `lib/decisions-reader.ts` | per-plan session |
| `apps/indusk-admin/src/app/api/{sessions,plans/build,drafts/[id]/*,promises/[name]/fix}/route.ts` | per-plan session |
| `apps/indusk-admin/src/components/session/PlanSession.tsx` | asks for its plan's session |

## Dependencies
- None.

## Notes
- A draft's key is whatever the talk route passes as `plan` today (`convo.plan`); Build Phase 2 reads it rather than inventing one.
