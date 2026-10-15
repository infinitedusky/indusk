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
| A1 | A 200 KB impl given to the contract check on stdin in two parts with a pause gets the same answer on five runs, the answer it gives reading the file | Test Phase 1 | Build Phase 1 | written | unit | promise: a-large-impl-gets-the-same-contract-answer | apps/indusk-mcp/src/__tests__/contract-stdin.test.ts |
| A2 | Every impl that validated still validates; the two archived impls citing rows they lack are the only new known failures | Test Phase 1 | Build Phase 1 | written | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/impl-corpus.test.ts |
| A3 | The Jaeger URL is normalized in one place; a file path's trailing-slash trim is not counted | Test Phase 1 | Build Phase 2 | written | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/always-on-cleanup.test.ts |
| A4 | Create, assign, read and release of a plan worktree leave git status clean, with its `.mcp.json` written | Test Phase 1 | Build Phase 2 | written | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/plan-worktrees-cli.test.ts |
| A5 | The registry scan names a direct CLI spawn without `INDUSK_HOME` and not a spawn through the helper that sets it | Test Phase 1 | Build Phase 2 | written | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts |
| A6 | A break for a new incident adds one inbox entry whatever today's date; an incident over a day old still gets its reminder | Test Phase 1 | Build Phase 2 | written | unit | promise: the-everyday-suite-passes-on-main, promise: a-break-reaches-the-working-agent | apps/indusk-mcp/src/lib/promises/inbox.test.ts |
| A7 | Accepting a new project ends its agent and streams each step in a run where every package's tests run at once | Test Phase 1 | Build Phase 3 | written | unit | promise: the-everyday-suite-passes-on-main | apps/indusk-admin/src/__tests__/new-project-accept.test.ts, apps/indusk-admin/src/__tests__/new-project-accept-route.test.ts |
| A8 | A component named only by an unlanded plan's approved mockups is not reported unimplemented; one named by a landed plan's and missing is | Test Phase 1 | Build Phase 2 | written | unit | promise: a-component-has-one-implementation, promise: the-everyday-suite-passes-on-main | apps/indusk-mcp/src/__tests__/looks-admin-components.test.ts |
| A9 | `pnpm test` from the root of the branch, merged with main, passes | Build Phase 3 | Build Phase 3 | planned | live check | the live proof of the suite promise; rows A2–A8 name its files | (recorded in the impl with its result) |

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
- [ ] `.indusk/planning/cockpit-audit-fixes/brief.md`: add `## Looks` — read its impl's Files Affected against `.indusk/mockups/admin/screens.json` `sources` to decide between `None — <reason>` and the looks it changes; the amendment waits for the person's re-approval in the cockpit

#### Build Phase 1 Verification

- [ ] A1 and A2 go green (`pnpm exec vitest run src/__tests__/contract-stdin.test.ts src/__tests__/impl-corpus.test.ts`, from `apps/indusk-mcp`, after `pnpm build`), A2 on two runs in a row; `pnpm exec vitest related src/bin/commands/promises.ts --run`

#### Build Phase 1 Context

- [ ] guard: the stdin read's comment names `promise: a-large-impl-gets-the-same-contract-answer` and why a sync read fails on a pipe

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/promises.md` (the `contract` entry): `--impl-stdin` reads an impl of any size

### Build Phase 2: Four stale tests, and the landed-plans rule

**Tier**: med — the work step's default

- [ ] `always-on-cleanup.test.ts:96`: count the URL form `.trim().replace(/\/+$/, "")` only
- [ ] `helpers/plan-worktree-fixture.ts`: write `.gitignore` with `.mcp.json` before the `git add -A` (line 89), as `init` does for a real project
- [ ] `registry-leak-scan.test.ts:25`: stop counting `runCli(` / `runCliAsync(` as a spawn without `INDUSK_HOME` (the helper sets it, since `f67cf9bc0`); keep scanning direct `CLI_BIN` / `cli.js` spawns
- [ ] `inbox.test.ts:43,61-63`: pass `now: new Date("2026-10-08T21:00:00Z")` to each `recordBreaks` call
- [ ] `looks-admin-components.test.ts` `mockupComponents`: skip a mockup whose approval (`.indusk/mockups/admin/approved.json`, the record's `plan`) names a plan folder that is active under `.indusk/planning/` and not archived; put the rule in `lib/looks/` beside the other approval readers if one fits, so the test does not own it
- [ ] `indusk promises change a-component-has-one-implementation --plan main-suite-green --statement "Each component the mockups of a landed plan name is implemented once in the app, and every screen renders that one implementation rather than its own copy." --reason "approval merges a plan's looks to main before its code; until it lands its components cannot exist"`

#### Build Phase 2 Verification

- [ ] A3–A6 and A8 go green (`pnpm exec vitest run src/__tests__/always-on-cleanup.test.ts src/__tests__/plan-worktrees-cli.test.ts src/__tests__/registry-leak-scan.test.ts src/lib/promises/inbox.test.ts src/__tests__/looks-admin-components.test.ts`, from `apps/indusk-mcp`); `indusk promises contract main-suite-green` passes

#### Build Phase 2 Context

- [ ] guard: `inbox.test.ts`'s pinned `now` carries `lesson: code-that-decides-takes-its-clock-and-its-reads`

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md` (or the page that states the component check): it holds the looks of landed plans

### Build Phase 3: The root run

**Tier**: med — the work step's default

- [ ] Diagnose A7: run `pnpm test` from the root and the two files alone; read what each waits on (a fixed 5 s timeout, a port, a lock, a spawned `claude` stub) and write the cause in this item's note before changing anything
- [ ] Fix A7 at its cause (a seam for its clock or process, a shared resource made per-test, or a timeout raised only with the measured reason); never a retry
- [ ] A9: `git merge main` into the branch, then `pnpm test` from the root; record the result in this item's note

#### Build Phase 3 Verification

- [ ] A7 goes green in a root run, twice; A9 recorded passing

#### Build Phase 3 Context

- [ ] admin (`apps/indusk-admin/CLAUDE.md`): one line naming A7's cause and the rule that prevents it, where the file's test rules are

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md` or the testing guide page that covers the admin's tests: the rule from A7, if it is one a test author must follow; otherwise the retrospective records why none

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

## Dependencies
- None.

## Notes
- The write hook runs the installed `indusk`, so until this lands and is installed a large impl may still be refused at random while this plan is written; this impl is under the pipe size.
