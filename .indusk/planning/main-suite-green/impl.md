---
title: "main-suite-green"
date: 2026-10-14
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "3b84f6334d3634638784dcf661cef398ce3aef63924fb110a1e830da13e62db8"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-15T02:24:53.058Z"
---

# main-suite-green

## Goal

`pnpm test` passes from the root of a clean main: the contract check reads a large impl reliably, four stale tests guard the behaviour as decided, the component check holds only landed plans' looks, and two admin tests stop timing out when every package runs at once. Causes and their commits are in `research.md`.

## Scope

### In Scope
- `src/bin/commands/promises.ts:257` reads `--impl-stdin` asynchronously.
- `impl-corpus.test.ts`: `archive/browser-template-claims` and `archive/untrack-mcp-json` recorded as known failures; `cockpit-audit-fixes`' brief gains `## Looks`.
- `always-on-cleanup.test.ts`, `plan-worktree-fixture.ts`, `registry-leak-scan.test.ts`, `inbox.test.ts` brought up to the behaviour they guard.
- `looks-admin-components.test.ts` holds only mockups whose plan has landed; `a-component-has-one-implementation`'s sentence changed to say so.
- `new-project-accept.test.ts` A30 and `new-project-accept-route.test.ts` A5 diagnosed and fixed under a root run.

### Out of Scope
- Repairing the two archived impls; re-approving cockpit-audit-fixes (the person's, in the cockpit).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1 authored; the existing failing tests confirmed red as rows A2–A8 | today's main |
| Build Phase 1 | async stdin read; corpus known failures; cockpit-audit-fixes `## Looks` | A1, A2 |
| Build Phase 2 | the four stale tests fixed; the landed-plans rule in the component check; the changed promise | A3–A6, A8 |
| Build Phase 3 | the two admin timeouts' cause and fix; the root-run live check | A7, A9 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A 200 KB impl given to the contract check on stdin in two parts with a pause gets the same answer on five runs, the answer it gives reading the file | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-large-impl-gets-the-same-contract-answer | apps/indusk-mcp/src/__tests__/contract-stdin.test.ts |
| A2 | Every impl that validated still validates; the two archived impls citing rows they lack are the only new known failures | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/impl-corpus.test.ts |
| A3 | The Jaeger URL is normalized in one place; a file path's trailing-slash trim is not counted | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/always-on-cleanup.test.ts |
| A4 | Create, assign, read and release of a plan worktree leave git status clean, with its `.mcp.json` written | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/plan-worktrees-cli.test.ts |
| A5 | The registry scan names a direct CLI spawn without `INDUSK_HOME` and not a spawn through the helper that sets it | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts |
| A6 | A break for a new incident adds one inbox entry whatever today's date; an incident over a day old still gets its reminder | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-everyday-suite-passes-on-main, promise: a-break-reaches-the-working-agent | apps/indusk-mcp/src/lib/promises/inbox.test.ts |
| A7 | Accepting a new project ends its agent and streams each step in a run where every package's tests run at once | Test Phase 1 | Build Phase 3 | passing | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-admin/src/__tests__/new-project-accept.test.ts, apps/indusk-admin/src/__tests__/new-project-accept-route.test.ts |
| A8 | A component named only by an unlanded plan's approved mockups is not reported unimplemented; one named by a landed plan's and missing is | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-component-has-one-implementation, promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts |
| A9 | `pnpm test` from the root of the branch, merged with main, passes | Build Phase 3 | Build Phase 3 | passing | live check | the live proof of the suite promise; rows A2–A8 name its files | (recorded in the impl with its result) |
| A10 | A mockup held under a landed plan and then re-approved under an unlanded one still has the components its landed approval bound held: delete one of those components' implementations and the check reports it unimplemented, while a component only the unlanded re-approval adds is not reported | Build Phase 4 | Build Phase 4 | written | unit | promise: a-component-has-one-implementation | apps/indusk-mcp/src/lib/looks/landed.test.ts |

## Checklist

### Test Phase 1: Author A1, confirm the failing tests red

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree create main-suite-green`, which records the assignment; a worktree made another way needs `indusk worktree assign main-suite-green <path>`) — worktree-per-plan default
- [x] Author A1 in `apps/indusk-mcp/src/__tests__/contract-stdin.test.ts` (`// promise: a-large-impl-gets-the-same-contract-answer`): build a plan folder in a temp project (as `promises-contract.test.ts` does) whose impl is padded past 200 KB; spawn the repo's built CLI (`dist/bin/cli.js`, through `helpers/cli.ts` if it can feed stdin, else `spawn` with `INDUSK_HOME` set to a temp dir) with `promises contract <plan> --impl-stdin`, write the impl in two halves with a 100 ms pause, five times; assert each exit code and output equal the run that reads the impl from its file. RED today: `readFileSync(0)` throws `EAGAIN` on the empty pipe
- [x] Add a second case to A8's file: a fixture app whose approved mockup names `ghost-row`, approved under a plan folder that is active (not archived) — not reported; the same approval under an archived plan — reported. RED today on the first half
- [x] Add A6's second case in `inbox.test.ts`: `now` two days after the violation — a `reminder` entry follows the `break`. Passes today (regression guard)
- [x] Add the token `// promise: the-everyday-suite-passes-on-main` to each file A2–A8 name; run A2–A8 and confirm each fails on its own assertion (the messages in `research.md`), or for A7 note that it passes alone and fails only in the root run
- [x] Shape (`apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts`) — reviewed, left as-is: appWithGhost builds one fixture (a mockup, its approval, its plan folder) for two cases that differ only in the folder; splitting it would name steps used once
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Regression Guards

- **A6** — its second case (an old incident is reminded) passes the moment it is written: it guards the incident-recording decision D7 while the first case's clock is pinned.

#### Test Phase 1 Verification

- [x] A1–A6 and A8 are authored and red on their own assertions (`pnpm exec vitest run` on each file from `apps/indusk-mcp`); A7's root-run failure is reproduced once (`pnpm test` from the root) and its output kept in the item's note
  - Note, run 2026-10-14 in this worktree. Red on own assertion: A1 `run 1: ... EAGAIN ... expected 1 to be +0` (file read gave 0); A2 corpus `expected [ …(20) ] to deeply equal [ Array(13) ]`; A3 `normalized in: lib/promises/interface-files.ts×2, lib/promises/telemetry.ts×1: expected 3 to be 1`; A4 `git status in …/proj-worktrees/demo: expected '?? .mcp.json' to be ''`; A5 `these tests spawn a registry-writing command without INDUSK_HOME: expected [ …(2) ] to deeply equal []`; A6 `expected [ {…7}, {…7} ] to deeply equal [ ObjectContaining{…} ]` (a reminder follows the break on the real clock) and `to have a length of 2 but got 3`, its added reminder case passes (regression guard); A8 `expected 'uncovered screen: detail…unimplemented component: ghost-row…' not to contain 'unimplemented component: ghost-row'` (active-plan half; the archived half passes) and the existing A2 `expected [ 'plan-looks', 'subplan-row' ] to deeply equal []`.
  - A7 passes alone (new-project-accept 2/2, new-project-accept-route 3/3). Root `pnpm test` reproduced one: `indusk-admin: FAIL node src/__tests__/new-project-accept.test.ts > A30 — creating a project ends its conversation's agent > A30 stops the draft's running session before creation, leaving the slot free — Error: Test timed out in 5000ms.` (admin 1 failed / 684 passed). The route file's A5 did not fail in this run; turbo then stopped, so the mcp package's root-run result was not collected.

#### Test Phase 1 Context

- [x] guard: every file A2–A8 name carries `promise: the-everyday-suite-passes-on-main`

### Build Phase 1: One contract answer, and the corpus

**Tier**: med — the work step's default

- [x] `src/bin/commands/promises.ts:257`: read `--impl-stdin` with `await text(process.stdin)` (`node:stream/consumers`), not `readFileSync(0)`; the command's handler is async if it is not already
- [x] `impl-corpus.test.ts`: add `archive/browser-template-claims` and `archive/untrack-mcp-json` to `PRE_EXISTING_FAILURES`, each with its reason in the block comment above (cites rows another plan's file holds; cites T4, which has no row) — archived history, recorded not repaired
- [x] `.indusk/planning/cockpit-audit-fixes/brief.md`: add `## Looks` — read its impl's Files Affected against `.indusk/mockups/admin/screens.json` `sources` to decide between `None — <reason>` and the looks it changes; the amendment waits for the person's re-approval in the cockpit
  - Note, 2026-10-14: the section lists `decision-card.ask`, `dashboard.default` and `nav.expanded` as Changes (impl Files Affected: DecisionCard.tsx, promise-dashboard.ts, PlanList.tsx) and four others as Must-not-break. Inserted before `## Depends On`; the branch `plan/cockpit-audit-fixes` (bc94a4d59) edits only the title and description lines of the brief, and `git merge-file` of this copy against that branch's has no conflict. The amendment waits for the person's re-approval in the cockpit.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] A1 and A2 go green (`pnpm exec vitest run src/__tests__/contract-stdin.test.ts src/__tests__/impl-corpus.test.ts`, from `apps/indusk-mcp`, after `pnpm build`), A2 on two runs in a row; `pnpm exec vitest related src/bin/commands/promises.ts --run`
  - Note, 2026-10-14: after `pnpm build`, contract-stdin + impl-corpus 3/3 passed; impl-corpus alone again 2/2 (two runs); `vitest related src/bin/commands/promises.ts` 5/5; `tsc --noEmit` and `biome check` on the changed files clean.

#### Build Phase 1 Context

- [x] guard: the stdin read's comment names `promise: a-large-impl-gets-the-same-contract-answer` and why a sync read fails on a pipe

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/promises.md` (the `contract` entry): `--impl-stdin` reads an impl of any size

### Build Phase 2: Four stale tests, and the landed-plans rule

**Tier**: med — the work step's default

- [x] `always-on-cleanup.test.ts:96`: count the URL form `.trim().replace(/\/+$/, "")` only
- [x] `helpers/plan-worktree-fixture.ts`: write `.gitignore` with `.mcp.json` before the `git add -A` (line 89), as `init` does for a real project
- [x] `registry-leak-scan.test.ts:25`: stop counting `runCli(` / `runCliAsync(` as a spawn without `INDUSK_HOME` (the helper sets it, since `f67cf9bc0`); keep scanning direct `CLI_BIN` / `cli.js` spawns
- [x] `inbox.test.ts:43,61-63`: pass `now: new Date("2026-10-08T21:00:00Z")` to each `recordBreaks` call
- [x] `looks-admin-components.test.ts` `mockupComponents`: skip a mockup whose approval (`.indusk/mockups/admin/approved.json`, the record's `plan`) names a plan folder that is active under `.indusk/planning/` and not archived; put the rule in `lib/looks/` beside the other approval readers if one fits, so the test does not own it
  - Note, 2026-10-14: rule in `lib/looks/landed.ts` (`planHasLanded`, `mockupsOfLandedPlans`), used by `coverage.ts` `unimplementedComponents` and the test. A mockup is held only when its latest approval names no plan (made in the project's own checkout or before ownership) or a plan that has landed (folder under `.indusk/planning/archive/`). Only a folder that is active and not archived reads unlanded. An approval naming a plan with no folder at all reads landed: nothing says it is in flight, so legacy records stay strictly checked.
- [x] `indusk promises change a-component-has-one-implementation --plan main-suite-green --statement "Each component the mockups of a landed plan name is implemented once in the app, and every screen renders that one implementation rather than its own copy." --reason "approval merges a plan's looks to main before its code; until it lands its components cannot exist"`

#### Build Phase 2 Verification

- [x] A3–A6 and A8 go green (`pnpm exec vitest run src/__tests__/always-on-cleanup.test.ts src/__tests__/plan-worktrees-cli.test.ts src/__tests__/registry-leak-scan.test.ts src/lib/promises/inbox.test.ts src/__tests__/looks-admin-components.test.ts`, from `apps/indusk-mcp`); `indusk promises contract main-suite-green` passes
  - Note, 2026-10-14: the five files 22/22 green; `vitest related` (landed.ts, coverage.ts, plan-worktree-fixture.ts) 30 files / 179 tests; `tsc --noEmit` and `biome check` clean; `indusk promises change` output: "a-component-has-one-implementation changed by main-suite-green; its History keeps the sentence it replaced"; `promises check` 146 promises, 0 known-violated; `promises contract main-suite-green` exit 0.
- [x] Shape — reviewed the files this phase changed (`lib/looks/landed.ts` and its test, `coverage.ts`, the four stale tests, the fixture) against the enabled extensions' craft rules, `rules.unreadable` empty; nothing to change: `landed.ts` is two named functions with one reason to change and a seam the test reaches.

#### Build Phase 2 Context

- [x] guard: `inbox.test.ts`'s pinned `now` carries `lesson: code-that-decides-takes-its-clock-and-its-reads`

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/component-conventions.md` (or the page that states the component check): it holds the looks of landed plans

### Build Phase 3: The root run

**Tier**: med — the work step's default

- [x] Diagnose A7: run `pnpm test` from the root and the two files alone; read what each waits on (a fixed 5 s timeout, a port, a lock, a spawned `claude` stub) and write the cause in this item's note before changing anything
  - Note, 2026-10-14. Neither file waits on a port, lock, spawned process or real clock: `session-host` is mocked and `createProject` is a stub. The only slow thing inside the 5 s test is its first `await import(...)` of the route and `@infinitedusky/indusk-mcp/new-project` (the package's built `dist`, a large module graph). Alone, that first test takes 137-211 ms (vitest import 126-198 ms); with 30 busy loops on the machine it takes 380-520 ms (2-3x), so CPU load alone does not reach 5 s. In a root run (`pnpm test`, 2 min 6 s) the admin's 109 files report import 504 s and transform 313 s in total, with the mcp package's suite running beside it, and three first-import tests timed out at 5000 ms: A30 and A38 in `new-project-accept.test.ts` (A38 is its second test, so the import was still in flight or re-evaluated) and `new-project-routes.test.ts` A2, which does the same `await import` of a route. A5 passed that run, so which tests fail varies. Cause: the module graph is loaded lazily inside each test, so the test's 5 s budget pays for the cold import, which under a root run is contended disk and transform work, not the behaviour under test.
- [x] Fix A7 at its cause (a seam for its clock or process, a shared resource made per-test, or a timeout raised only with the measured reason); never a retry
  - Note: the route and the package's `new-project` are imported at the top of `new-project-accept.test.ts`, `new-project-accept-route.test.ts` and `new-project-routes.test.ts` (A2 there timed out in the same root run, same cause), so the cold import falls in the file's import, which has no per-test timeout, not in a test's 5 s. `vi.mock` is hoisted above the imports, so the stubs still apply. No timeout raised, no retry.
- [x] `apps/indusk-mcp/vitest.config.ts`: `testTimeout: 15_000` for the everyday suite, with the measured reason in its comment — its git/CLI-spawning tests take 1.2–3.3 s with four files running together and cross 5 s only beside the admin's suite in a root run; which ones fail varies run to run, so one package-wide budget, not per-file raises (Sandy, 2026-10-14: option 1)
- [x] `apps/indusk-mcp/vitest.templates.config.ts`: add `@opentelemetry/instrumentation-xml-http-request` to `optimizeDeps.include` — the template imports it and the list lacked it, so Vite re-optimized mid-run and reloaded the page ("Vite unexpectedly reloaded a test"), failing `instrumentation.web` A1 with `Failed to fetch dynamically imported module` in root run 1 of 2 after the timeout change
- [x] A9: `git merge main` into the branch, then `pnpm test` from the root; record the result in this item's note
  - Note, 2026-10-14 (merge done, A9 not passing, item left unchecked): `git merge main` merged cleanly (a09731cc0, four lesson files). Root runs after the merge: run 2 admin 683/685, `new-project-parent` timed out on its lazy route import (fixed the same way). Runs 3 and 4: admin 109 files / 685 passed both times (A7 green twice), seat-holds 3/3, indusk 48/48; but `indusk-mcp` failed 4 then 3 tests, each `Test timed out in 5000ms` (run 3: plans-accept-stories A25 and A33, plans-workbench A18, release-report A6; run 4: amendments A12, plans-accept-stories A25 and A33). They are real git/CLI-spawning tests that pass alone (1.2-3.3 s each with four such files running together, 43/43) and cross 5 s only under the root run's contention. The mcp suite's root-run result was not seen before (turbo stopped on the admin failure). Needs a decision: a measured `testTimeout` for those tests, or less concurrency between packages in `pnpm test`.
  - Note, 2026-10-15: decided (Sandy) — one package-wide `testTimeout`, and the template pre-bundle fix, both above. Root runs 3 and 4 after them: every package green both times (admin 109 files / 685, indusk-mcp 431 files / 2837 passed + templates 12 passed, indusk 48, seat-holds 3), but `pnpm test` exits 1 at its trailing daemon guard (`check-test-daemons`): four telemetry processes from other sessions' scratchpad homes, started 2026-10-13 20:55 and 2026-10-14 16:39, before these runs — not this suite's. A9 waits on those being stopped and one more root run.
  - Note, 2026-10-15: the four stopped (Sandy: "go ahead and kill"). Root run 5: `pnpm test` exit 0 — admin 109 files / 685, indusk-mcp 431 files / 2837 passed + templates 12 passed, indusk 48, seat-holds 3; `promises check` 146 promises, 0 known-violated; `check-test-daemons: no telemetry daemon left running from a temporary home`. A9 passing.

- [x] Shape — reviewed the files this phase changed (the four admin route tests, the two vitest configs; the merged lesson files are main's) against the enabled extensions' craft rules, `rules.unreadable` empty; nothing to change: each test diff only moves an `await import` to a top-of-file import, and each config change is one value with its measured reason.

#### Build Phase 3 Verification

- [x] A7 goes green in a root run, twice; A9 recorded passing
  - Note, 2026-10-15: A7's files green in root runs 3, 4 and 5 (admin 109 files / 685 each); A9 passing in run 5 (exit 0).

#### Build Phase 3 Context

- [x] admin (`apps/indusk-admin/CLAUDE.md`): one line naming A7's cause and the rule that prevents it, where the file's test rules are

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/admin-ui/component-conventions.md` or the testing guide page that covers the admin's tests: the rule from A7, if it is one a test author must follow; otherwise the retrospective records why none


### Build Phase 4: Falsification — a re-approval in flight blinds the check to components that already landed

**Tier**: med — the work step's default

**Goal**: verify that the landed-plans rule exempts only what an unlanded plan adds. Today `mockupsOfLandedPlans` (`lib/looks/landed.ts`) reads only a mockup's *latest* approval: when an in-flight plan re-approves a mockup that a landed plan's approval already held, the whole mockup drops out of the unimplemented-component check. On main now, `plan.needs-you`, `plan.released`, `plan.working`, `plan.parts` (latest approval: plan-stories) and `phase-row.open` (latest: story-first-phases) were held under cockpit-redraw and brief-as-the-contract and are exempt, so a component they name could be deleted from the admin and the check, the promise `a-component-has-one-implementation`, would stay green. Hypothesis: with a fixture mockup approved under an archived plan binding `plan-row`, then re-approved under an active plan that adds `ghost-row`, removing `plan-row`'s implementation is not reported.

- [x] Author A10 in `apps/indusk-mcp/src/lib/looks/landed.test.ts` (red today: the re-approved mockup is exempt whole, so the removed `plan-row` is not held)
- [ ] `lib/looks/landed.ts`: replace `mockupsOfLandedPlans` with a reader of the component names held — every component a held mockup's markup names (latest approval naming no plan or a landed one), plus, for a mockup whose latest approval is an unlanded plan's, the components its most recent held approval bound (`ApprovalEntry.components` keys, `badge.ok` → `badge`; an entry without `components` binds none); `coverage.ts` `unimplementedComponents` and `looks-admin-components.test.ts` read it

#### Build Phase 4 Verification

- [ ] A10 green and A8 still green (`pnpm exec vitest run src/lib/looks/landed.test.ts src/__tests__/looks-admin-components.test.ts`, from `apps/indusk-mcp`); `pnpm exec vitest related src/lib/looks/landed.ts src/lib/looks/coverage.ts --run`; `tsc --noEmit` and `biome check` on the changed files

#### Build Phase 4 Context

- [ ] guard: `landed.ts`'s doc comment says the exemption is per component, not per mockup — only what an unlanded plan's re-approval adds — and names `promise: a-component-has-one-implementation`

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: the component check's landed-plans sentence says a re-approval in flight keeps holding the components the landed approval bound

#### Falsification summary

- Searched without a hypothesis: the async stdin read (`promises.ts`, its awaited caller in `cli.ts`, the hook's `spawnSync` with `input`, which closes stdin, so `text()` cannot hang); `planHasLanded`'s archive-before-land order (the retrospective archives at Step 9 before `plans land` runs its checks at Step 10, so a plan's own unimplemented component is caught at landing); the registry scan (no test overrides `INDUSK_HOME` to undefined through `runCli`); the URL-trim scan (the only `.trim().replace(/\/+$/, "")` is `telemetry.ts:101`; other trims are paths or `/v1/*` endpoint joins); the 15 s timeout and the pre-bundle entry (configuration, each with its measured reason).
- Not authored: the admin browser tests that still `await import` a page inside an `it` — the same cold-import class as A7, but no timeout from them in root runs 3–5, so a row would be a guess rather than an observed failure.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/bin/commands/promises.ts` | async stdin read |
| `apps/indusk-mcp/src/__tests__/contract-stdin.test.ts` | new (A1) |
| `apps/indusk-mcp/src/__tests__/impl-corpus.test.ts` | two known failures |
| `apps/indusk-mcp/src/__tests__/always-on-cleanup.test.ts` | URL-form pattern |
| `apps/indusk-mcp/src/__tests__/helpers/plan-worktree-fixture.ts` | `.gitignore` |
| `apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts` | helper spawns not counted |
| `apps/indusk-mcp/src/lib/promises/inbox.test.ts` | pinned clock, reminder case |
| `apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts` (+ `lib/looks/` reader) | landed plans only |
| `apps/indusk-admin/src/__tests__/new-project-accept*.test.ts` | A7's fix |
| `.indusk/planning/cockpit-audit-fixes/brief.md` | `## Looks` |
| `.indusk/promises/a-component-has-one-implementation.md` | changed sentence (via the CLI) |
| `apps/indusk-mcp/src/lib/looks/landed.ts` (+ `coverage.ts`, `landed.test.ts`) | Build Phase 4: held components per approval, not per mockup |

## Dependencies
- None.

## Notes
- The write hook runs the installed `indusk`, so until this lands and is installed a large impl may still be refused at random while this plan is written; this impl is under the pipe size.
