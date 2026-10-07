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
| A6 | `indusk update` moves a project's tracked highlights into its home, unprocessed ones kept, and takes them out of git | Test Phase 1 | Build Phase 3 | written | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/__tests__/bookkeeping-migration.test.ts |
| A7 | A highlight processed for a commit in one checkout is not offered again in another | Build Phase 1 | Build Phase 2 | passing | unit | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A8 | A real evaluator run on a commit in a plan's worktree writes its lesson on `main` and marks the highlight processed in the project's home | Build Phase 3 | Build Phase 3 | planned | contract | promise: a-highlight-becomes-a-lesson-once | apps/indusk-mcp/src/__tests__/eval-bookkeeping-contract.test.ts |
| A9 | Landing still refuses a plan when `main` has uncommitted work that is not InDusk's, and the review still lists it | Test Phase 1 | Test Phase 1 | passing | unit | promise: nothing-ships-until-accepted, promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-land.test.ts |
| A10 | Every commit is still scored, its result readable where the admin and `indusk eval` look | Build Phase 1 | Build Phase 2 | passing | unit | promise: every-commit-evaluated | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A11 | A hook and the package resolve the same main checkout and project home from any checkout of a project | Build Phase 1 | Build Phase 1 | passing | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/lib/bookkeeping/home.test.ts |
| A12 | The evaluator only reads the checkout it grades: it runs without bypassing permissions, its git is read-only, and the git commands that change a checkout are denied; every place that starts it uses these permissions | Build Phase 2 | Build Phase 2 | passing | unit | found building this plan: the evaluator stashed, checked out and popped in its live worktree; a guard on the evaluator's launch, which no promise of this plan names | apps/indusk-mcp/src/lib/eval/permissions.test.ts |

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

- [ ] `indusk update`: move tracked `highlights*.jsonl` and `.indusk/eval/` into the project's home (merged by id), remove them from git, and ignore them and `current.md.lock` (A6)
- [ ] A8 written and passing in the system tier: a commit in a plan worktree, a real evaluation, its lesson committed on `main`, the highlight processed in the home
- [ ] Run the migration on this repository and commit the result
- [ ] `indusk promises confirm bookkeeping-lives-where-it-is-read`

#### Build Phase 3 Verification

- [ ] A6 and A8 pass, and the full `pnpm test` and `pnpm test:system` pass from a clean environment

#### Build Phase 3 Context

- [ ] current.md: the migration ran here; machine state is under `~/.indusk/projects/dusk/`

#### Build Phase 3 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: notes committed on `main`; machine state under `~/.indusk/projects/`; the migration

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/bookkeeping/` | new: `roots.ts`, `notes.ts` and their tests |
| `apps/indusk-mcp/hooks/_hook-paths.js`, `hooks/eval-trigger.js`, `hooks/_pending-drain.js` | the hooks' copy; eval state to the home |
| `apps/indusk-mcp/src/tools/agent-tools.ts`, `lesson-tools.ts`, `highlight-tools.ts`; `src/lib/highlights/`, `src/lib/eval/`, `src/lib/run/pending-evals.ts`, `src/lib/agents/` | writers through the resolver |
| `apps/indusk-mcp/src/bin/commands/update.ts`, `eval.ts` | migration; reading results from the home |

## Dependencies

- None.
