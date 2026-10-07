---
title: "Bookkeeping lives where it is read"
date: 2026-10-07
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Bookkeeping lives where it is read

## Goal

Every writer of InDusk's records goes through one resolver: notes people read (`current.md`, lessons) to the main checkout, committed on `main` as written; machine state (the highlights queue, the processed list, evaluation results) to `~/.indusk/projects/<project>/`. See the [ADR](adr.md), D1–D6.

## Scope

### In Scope
- `lib/bookkeeping/roots.ts` and `notes.ts` (D1, D2); the hooks' copy and its parity test (D4)
- The writers: `update_current_section` and the other `current.md` writers, `add_lesson`, the highlight tools, the evaluator's results and queue (D2, D3)
- The migration in `indusk update` (D5)

### Out of Scope
- Per-plan records (phase boundaries, the verify ledger), which stay with the plan (D6)
- Sharing machine state between machines

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `bookkeepingRoots`, `commitNote`; the hooks' `projectHome` | `markProjectId`, the `current.md` lock |
| Build Phase 2 | every writer through them | Build Phase 1 |
| Build Phase 3 | the migration in `indusk update`; the real evaluator's contract | Build Phases 1–2 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A session's note written from a plan's worktree lands in the main checkout's `current.md`, committed on `main`; neither checkout is left dirty | Build Phase 1 | Build Phase 2 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts |
| A2 | A lesson added from a plan's worktree is written to the main checkout's lessons and committed on `main` | Build Phase 1 | Build Phase 2 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts |
| A3 | A highlight, its processed mark and an evaluation's results are written under the project's home, the same from every checkout; none appears in `git status` | Build Phase 1 | Build Phase 2 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A4 | When the main checkout is off its trunk branch or mid-merge, a note is written there, left uncommitted, and the reason returned; nothing is committed onto another branch | Build Phase 1 | Build Phase 1 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts |
| A5 | Two notes written at the same moment are both committed | Build Phase 1 | Build Phase 2 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts |
| A6 | `indusk update` moves a project's tracked highlights into its home, unprocessed ones kept, and takes them out of git | Test Phase 1 | Build Phase 3 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts |
| A7 | A highlight processed for a commit in one checkout is not offered again in another | Build Phase 1 | Build Phase 2 | passing | unit | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A8 | A real evaluator run on a commit in a plan's worktree writes its lesson on `main` and marks the highlight processed in the project's home | Build Phase 3 | Build Phase 3 | passing | contract | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/e2e/eval-bookkeeping.e2e.test.ts |
| A9 | Landing still refuses a plan when `main` has uncommitted work that is not InDusk's, and the review still lists it | Test Phase 1 | Test Phase 1 | passing | unit | promise: nothing-ships-until-accepted, promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A10 | Every commit is still scored, its result readable where the admin and `indusk eval` look | Build Phase 1 | Build Phase 2 | passing | unit | promise: every-commit-evaluated | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A11 | A hook and the package resolve the same main checkout and project home from any checkout of a project | Build Phase 1 | Build Phase 1 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A12 | The evaluator only reads the checkout it grades: it runs without bypassing permissions, its git is read-only, and the git commands that change a checkout are denied; every place that starts it uses these permissions | Build Phase 2 | Build Phase 2 | passing | unit | found building this plan: the evaluator stashed, checked out and popped in its live worktree; a guard on the evaluator's launch, which no promise of this plan names | apps/indusk-mcp/src/lib/eval/permissions.test.ts |
| A13 | Two evaluators running at once (two commits seconds apart, each spawns its own) are not both offered the same unprocessed highlight: one asking while the other holds it gets nothing for it, until the hold lapses | Build Phase 4 | Build Phase 4 | written | unit | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A14 | Highlights written at the same moment from two checkouts, now one shared queue, all get distinct ids; none is shadowed by another's | Build Phase 4 | Build Phase 4 | written | unit | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A15 | `indusk update` also moves the queue of every plan worktree into the home, keeping a highlight whose id the main checkout's queue already uses for a different highlight | Build Phase 4 | Build Phase 4 | written | unit | promise: a-highlight-becomes-a-lesson-once, promise: indusk-leaves-main-clean | apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts |
| A16 | A plan whose branch still tracks a changed `.indusk/highlights.jsonl` lands after `main` stopped tracking it: no modify/delete conflict, and its highlights are in the home | Build Phase 4 | Build Phase 4 | written | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A17 | Evaluating a commit in a plan worktree does not discard the session the main checkout's evaluator resumes, nor resume a session made in another checkout | Build Phase 4 | Build Phase 4 | written | unit | found by falsification: one session file in the shared home, but Claude Code finds a session by its directory, so each switch of checkout fails the resume, clears the session and starts a full fresh run | apps/indusk-mcp/src/lib/eval/evaluator-session.test.ts |
| A18 | Two checkouts of different clones of one project (same `groupId`, or same folder name) have different homes; a highlight queued in one is never processed into the other's lessons | Build Phase 4 | Build Phase 4 | written | unit | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A19 | A lesson whose name is not one kebab-case segment (`../x`, `a/b`) is refused before anything is written or committed | Build Phase 4 | Build Phase 4 | written | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/notes.test.ts |

## Checklist

### Test Phase 1: Over the CLI, and the guard

**Goal**: author A6 red over the CLI and run A9's existing guard; record why the rest wait.

- [x] Confirm this plan's worktree (`indusk worktree create bookkeeping-lives-where-it-is-read` made it and recorded the assignment) — worktree-per-plan default
- [x] A6: `bookkeeping-migration.test.ts` runs `indusk update` on a project whose `.indusk/highlights.jsonl` and `highlights-processed.jsonl` are tracked, in a temporary `INDUSK_HOME`; expects them under `<home>/projects/<project>/`, unprocessed ones kept, gone from `git ls-files`, and ignored. RED today: update leaves them where they are
- [x] A9: run the existing landing and review tests (`plans-land.test.ts` A32 and the refusal cases) unchanged; they pass, and stay the guard

#### Deferred to Build Phase 1

- **A1, A2, A3, A4, A5, A7, A10, A11** — their subjects are `bookkeepingRoots` and `commitNote` (`lib/bookkeeping/`), and the hooks' `projectHome`, which Build Phase 1 creates; a test importing them today fails to load.

#### Deferred to Build Phase 3

- **A8** — it needs every writer moved (Build Phase 2) to mean anything, and a real evaluator run, so it is a system-tier contract written once the writers are in place.

#### Regression Guards

- **A9** — landing's refusal and the review's listing pass today and must keep passing.

#### Test Phase 1 Verification

- [x] (A6 red: "the queue is in <home>/projects/bk_project_…: expected false to be true"; `plans-land.test.ts` 8 of 8) A6 is authored and fails on its own assertion, and A9 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/bookkeeping-migration.test.ts src/__tests__/plans-land.test.ts`)

### Build Phase 1: One resolver, and a note committed on main

- [x] (the writers lifted unchanged out of the MCP tool handlers into `lib/bookkeeping/notes.ts` as `writeCurrentSection` and `addLesson`, so the tests reach the real write path; all nine cases red on their assertions) A1–A5, A7, A10, A11 written red against stubs of `bookkeepingRoots`, `commitNote` and `projectHome`
- [x] `lib/bookkeeping/roots.ts`: `bookkeepingRoots(anyCheckout): { trunk, home }` — `trunk` the folder holding the shared git directory (the workbench root in a workbench), `home` `<INDUSK_HOME>/projects/<markProjectId(trunk)>/`
- [x] (the lock is the callers': `commitNote` runs inside the writer's `current.md` lock, since the lock is not re-entrant) `lib/bookkeeping/notes.ts`: `commitNote(trunk, paths, message)` under `current.md.lock`; commits only when `trunk` is on its trunk branch with no merge, rebase or cherry-pick in progress, with `git commit --only -m "chore(indusk): …" -- <paths>`; else returns `{ committed: false, reason }`
- [x] `hooks/_hook-paths.js`: `projectHome(cwd)` and `mainCheckout(cwd)` with the same rule; A11 pins them equal to `bookkeepingRoots`

#### Build Phase 1 Verification

- [x] (A4's two cases, A10 and A11 pass; A5 moved to pass at Build Phase 2, since it needs the `current.md` writer to commit; A1, A2, A3, A5 and A7 red on their assertions; A10 passes already, its resolver being this phase's) A4, A5 and A11 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/bookkeeping`); A1, A2, A3, A7 and A10 are red on their assertions until the writers move
- [x] Shape — `roots.ts` is one rule in two functions; `commitNote` one decision, its refusals named in one table; the hooks' copy mirrors the rule line for line. `notes.ts` holds the writers lifted unchanged, which Build Phase 2 rewires. Nothing to change

#### Build Phase 1 Context

- [x] (delivered in `roots.ts`'s and `_hook-paths.js`'s headers rather than the package's `CLAUDE.md`, which is 2 bytes under its budget) mcp: InDusk's records are written through `lib/bookkeeping` — notes to the main checkout and committed, machine state to the project's home; never to the writer's own checkout

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/tools/highlights.md`: where the queue and the processed list live

### Build Phase 2: Every writer through it

- [x] (through `currentMdPath` and `commitCurrentMd` in `notes.ts`: `update_current_section`, the `agent` CLI's register, done, heartbeat and prune, and the sweep with its archive; `list_lessons` reads the main checkout's lessons too) `update_current_section`, the `agent` CLI and sweep write the main checkout's `current.md` and commit it (A1); `add_lesson` writes the main checkout's lessons and commits them (A2)
- [x] (`highlights.ts`'s three path helpers resolve the home; its older tests read the home too) The highlight tools and `markProcessed` read and write the project's home (A3, A7)
- [x] Discovered building this phase: the evaluator, grading a commit in this plan's worktree, ran `git stash -u`, checked out three files from an older commit, ran the tests three times and popped the stash, while this session was editing there; edits to `agent.ts` vanished and came back staged. It ran under `--permission-mode bypassPermissions`, which ignores its allowed-tools list, at all three launch sites. One definition now, `lib/eval/permissions.ts`: `dontAsk`, read-only git allowed, the git commands that change a checkout denied outright. A12, red first. Until this is released, the installed evaluator still runs with bypass
- [x] (`evalDir` in the package: `eval.ts`'s results and baseline worktree, `otel.ts`, `evaluator-runner.ts`, `findings.ts`, `persistent-evaluator.ts`, `pending-evals.ts`; `projectHome` in the hooks: `eval-trigger.js`'s system log, results and messages, `_pending-drain.js`; the admin through a new `./bookkeeping/roots` export, in `project-reader.ts` and `planning-reader.ts`. The older tests that read `.indusk/eval/` now read the home, each with an `INDUSK_HOME` of its own. Left as they are: the gitignore entries, the commit cadence's exclusion and approve's safety-net list, which still cover projects not yet migrated) The evaluator's results, findings, session file, pending queue and `system.log`, and the eval-trigger hook, use the project's home; `indusk eval` and the admin read them there (A3, A10)

#### Build Phase 2 Verification

- [x] (the bookkeeping, eval, highlights and pending-queue tests, 11 files, 109, A12 among them; the admin 61 files, 395; `tsc` clean in both) A1, A2, A3, A7 and A10 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/bookkeeping && pnpm exec vitest related <files this phase changed> --run`)

- [x] Shape — Build Phase 2 changed each writer at its one path helper, or its one call site; `permissions.ts` is one definition for three launches. The agent CLI's `writeAtomic` now writes and commits, one job for every caller. Nothing to change

#### Build Phase 2 Context

- [x] current.md: InDusk's own commits now appear on `main` as `chore(indusk): …` — this session's section, through `update_current_section` (the installed version, which still writes without committing)

#### Build Phase 2 Document

- [x] (`guide/multi-agent.md`: `/handoff`'s commit step, and a new section, "Where InDusk keeps its records") The operational-layer page (`apps/docs/src/guide/context-tiers.md` or the multi-agent decision page): `current.md` and lessons are committed on `main` when written

### Build Phase 3: Migration, and the real evaluator

- [x] (`lib/bookkeeping/migrate.ts`, called by `update` before the gitignore entries are written; `.indusk/eval/`'s logs appended, its other files copied only where the home has none) `indusk update`: move tracked `highlights*.jsonl` and `.indusk/eval/` into the project's home (merged by id), remove them from git, and ignore them and `current.md.lock` (A6)
- [x] (in the e2e tier, `e2e/eval-bookkeeping.e2e.test.ts`, not the system tier: it needs the `claude` CLI and costs an evaluator run, and `pnpm release` runs the system tier, so release would depend on a signed-in `claude`. Not red first: its subject was finished in Build Phase 2, as the deferral said. First run ended on an API "connection closed mid-response"; the rerun passed in 152 s) A8 written and passing in the system tier: a commit in a plan worktree, a real evaluation, its lesson committed on `main`, the highlight processed in the home
- [x] (this branch's `migrateBookkeeping` run on the main checkout: 333 highlights kept; the processed list 436 lines → 333, the rest repeat marks of one id; `.indusk/eval/` appended into the home. Untracked on `main` as bookkeeping, 480c36a9, which merges cleanly since the branch never changed those files; the repo's `.gitignore` gains the entries on the branch, aa3b00ea. Until the release, the installed version writes a new queue in the main checkout; `indusk update` after the release merges it by id) Run the migration on this repository and commit the result
- [x] (`a-highlight-becomes-a-lesson-once` enforced, 2 test files; `indusk-leaves-main-clean` enforced, 3 test files, 4 code sites) `indusk promises confirm bookkeeping-lives-where-it-is-read`

- [x] (30 s, 7f0a07f9) Discovered at the full run: `multi-agent-e2e.test.ts` timed out at 5 s under the whole suite's load (passes alone). It spawns the CLI nine times, and each `agent` write now also runs git to commit `current.md`; give it a timeout that fits nine process spawns
- [x] (7f0a07f9; the system tier then passed 164 of 164 with `~/.indusk/projects` untouched) Discovered at the full run: the system tier had no temporary home, so `build-session-gates`' real sessions and `monitor-mark`'s evaluators wrote six folders into `~/.indusk/projects/`, and `monitor-mark`'s A25 and A33, and the `day-monitor` e2e, still read results from `.indusk/eval/`. `vitest.system.config.ts` takes a temporary `INDUSK_HOME`; the two files read `evalDir`

#### Build Phase 3 Verification

- [x] (from `env -i`: everyday indusk-mcp 2027 passed, admin 395, seat-holds 3; system 164 of 164; A8 and the `day-monitor` e2e pass; no folder left in the real `~/.indusk/projects/` but `dusk`) A6 and A8 pass, and the full `pnpm test` and `pnpm test:system` pass from a clean environment
- [x] Shape — `migrate.ts` does one job, its merge-by-id, id read and untrack each a named helper; the rest of the phase is tests and test configuration. Nothing to change

#### Build Phase 3 Context

- [x] (this session's section, through the installed `update_current_section`) current.md: the migration ran here; machine state is under `~/.indusk/projects/dusk/`

#### Build Phase 3 Document

- [x] (with the evaluator's permissions under Fixed) `apps/docs/src/changelog.md` Unreleased: notes committed on `main`; machine state under `~/.indusk/projects/`; the migration

### Build Phase 4: Falsification — one shared home, read by many at once

**Goal**: verify whether the attested state holds now that every checkout, every session and every evaluator share one queue, one processed list and one session file, and clones share whatever their name or `groupId` makes equal. Each row is one hypothesis about what breaks; each item the fix it needs if the row goes red.

- [x] (`readUnprocessedHighlights(root, { holder, now })`, holds in the home's `highlight-holds.json` under `highlights.lock`; the tool's holder is its MCP server, one per `claude` session; a call without a holder holds nothing, so the evaluator's own count does not take them) `highlights_unprocessed` takes a hold on what it returns, kept in the home with the holder and a lapse time; a second caller is not offered held highlights; `highlight_mark_processed` releases the hold; a hold lapses after 30 minutes, so a crashed evaluator's highlights come back (A13)
- [x] (`highlights.lock`, the same lock as the holds; 100 writes from four processes, 100 ids) `writeHighlight` and `markProcessed` read and append under one lock in the home, so the day's sequence and the already-processed check see each other's writes (A14)
- [x] (a highlight already in the home is recognised by its time, tag, level and note, not its id, so a second run adds nothing; a colliding id becomes `<id>-m<n>` and that checkout's processed marks follow it; a worktree's files are left for its branch to land) `migrateBookkeeping` also reads every checkout `git worktree list` names: their queues and processed lists merged into the home, and a highlight whose id is already taken by a different highlight kept under a new id (A15)
- [x] (`releaseBranchBookkeeping` in `migrate.ts`, called by `plans land` after its dirty-worktree check and before the merge) Landing: when the trunk no longer tracks the machine-state files and the plan's branch still does, merge the branch's queue into the home and take the files out of the branch, as a `chore(indusk)` commit on it, before bringing the trunk in (A16)
- [x] (`<eval>/sessions/<folder>-<hash of its real path>.json`; the old single `evaluator-session.json` is no longer read, so each checkout starts one fresh session after the release) The evaluator's session is recorded per checkout it runs in (keyed by `gitRoot`), and a resume is only attempted from the checkout that made it (A17)
- [x] (`<id>-<first 8 hex of sha256 of the real path>`; `~/.indusk/projects/dusk` moved to `dusk-2f1b1d2f`; the `day-monitor` e2e reads `evalDir` instead of building the path) The home is keyed by the project id and a short hash of the main checkout's real path, in `bookkeepingRoots` and the hooks' `projectHome` alike (A11 keeps them equal); this repository's home moved to the new key (A18)
- [x] (`^[a-z0-9]+(-[a-z0-9]+)*$`, which every lesson in this repository already fits, `community-` ones included) `addLesson` refuses a name that is not one kebab-case segment, before writing (A19)

- [x] Discovered at the package run: the migration parsed `git worktree list` itself; `plan-worktrees-single-definition` (A26 of an earlier plan, one parser in `lib/git.ts`) refused it. It uses `parseWorktreeList`, skipping prunable entries
- [x] Discovered at the package run: `agent-roles-phase4.test.ts`'s T13 ran the eval hook with `--source handoff` in this repository, where evaluation is on, so every `pnpm test` started a real, paid evaluator of HEAD (one was found running in this worktree). It runs in a temporary project with evaluation off; the no-hang check is unchanged
- [x] (left as it is, reported to the person) Discovered at the package run: a `project-6bafd0c8` folder appeared in the real `~/.indusk/projects/` at 19:49, written by this branch's hook in a session that ran `ls`, `find` and `cat`, which the evaluator's new permissions deny; no everyday test starts `claude`, and the fixture was gone. Not traced

#### Build Phase 4 Verification

- [ ] A13–A19 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/highlights src/lib/bookkeeping src/lib/eval/evaluator-session.test.ts src/__tests__/bookkeeping-migration.test.ts src/__tests__/plans-land.test.ts`), and A8 still passes (`pnpm e2e -- eval-bookkeeping`)

#### Build Phase 4 Context

- [ ] current.md: the project home's new key, and that evaluators hold highlights while they process them

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/multi-agent.md`, "Where InDusk keeps its records": the home's key, the holds on highlights, and that worktrees are migrated too

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/bookkeeping/` | new: `roots.ts`, `notes.ts` and their tests |
| `apps/indusk-mcp/hooks/_hook-paths.js`, `hooks/eval-trigger.js`, `hooks/_pending-drain.js` | the hooks' copy; eval state to the home |
| `apps/indusk-mcp/src/tools/agent-tools.ts`, `lesson-tools.ts`, `highlight-tools.ts`; `src/lib/highlights/`, `src/lib/eval/`, `src/lib/run/pending-evals.ts`, `src/lib/agents/` | writers through the resolver |
| `apps/indusk-mcp/src/bin/commands/update.ts`, `eval.ts` | migration; reading results from the home |

## Dependencies

- None.
