---
title: "Workbench Trust Fixes — Test Plan"
date: 2026-09-10
status: accepted
---

# Workbench Trust Fixes — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
plan is working: every surface the brief names either works correctly in a
versioned workbench or refuses loudly, naming why. Each assertion names the
mechanism by which it will be tested. The assertions become the rows of the
impl's Test Trajectory.

Every finding here was re-verified against the plan branch on 2026-09-10
(`134b694d`): gate-reminder's four exit paths are all `exit(0)` with stderr
only; nothing under `src/lib/run/` imports the workbench readers;
`listOversizedChangedFiles` guards on "is a git repo" alone; `declaredReposAt`
has no consumer; `restoreOne` targets `join(siblingParent, repo.name)`.

Prior art for every refusal is `resolveVerifyRoots` (`src/lib/verify/roots.ts`):
a surface that cannot answer correctly in a workbench refuses and says why,
never guesses, never reports the happy case.

## Behavioral Assertions

### Phase A — blocking

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Editing an `impl.md` so that a build phase opens with trajectory rows still unauthored puts a nudge naming those rows into the session as additional context, and the hook exits 0. | vitest integration: spawn `hooks/gate-reminder.js` with a PostToolUse Edit payload against a fixture impl; assert the stdout JSON envelope carries `hookSpecificOutput.additionalContext` with the row IDs |
| A2 | Editing a file that is not an `impl.md` produces no output from the gate-reminder hook. | same harness (regression guard) |
| A3 | The phase-start nudge has exactly one implementation; a search for a second finds nothing. | vitest grep test, the repo's single-definition pin pattern |
| A4 | Running `indusk run <plan>` at a versioned workbench root exits non-zero before any tool call or commit, naming the declared repos and where to run instead. No commit lands in the workbench repo and no pending-eval record is written. | vitest integration: temp workbench fixture (git-initialized root, `worktree.repos[]` declared), invoke the run entry |
| A5 | Running `indusk run <plan>` in a flat repo is unaffected. | existing run tests (regression guard) |
| A6 | Running the cleanup ritual's changed-file scan at a versioned workbench root refuses with a message naming the workbench shape and its declared repos. It never reports "nothing to clean". | vitest unit: `listOversizedChangedFiles` against a git-initialized workbench fixture |
| A7 | A `git commit` made from a session whose cwd is a versioned workbench root is never scored against the workbench repo's HEAD. With one declared repo, evaluation resolves to that repo at its declared path (not by name at the root); with several, the hook refuses and names the candidates. | vitest integration: spawn `hooks/eval-trigger.js` with a PostToolUse `git commit` payload in a git-initialized workbench fixture (extends `eval-trigger-workbench-mode.test.ts` and `hook-paths.test.ts`, which today have no such fixture) |
| A8 | The eval hook's refusal is visible in the session, not only in `system.log`. | same harness; assert the message reaches the hook's user-visible channel |
| A9 | `workbench restore` on a workbench whose repo declares `path` and is already materialized there reports it present and creates nothing. On one not yet materialized it clones at the declared path, and the path it prints is the path it used. | vitest integration: temp workbench plus a local bare remote, real git, explicit 30s timeout |

### Phase B — trailing

IDs continue the A sequence (the trajectory parser accepts `T`/`A` prefixes only).

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A10 | `indusk worktree create <slug>` and `worktree refresh <slug>` succeed on a workbench whose repo declares `path`, resolving the trunk where `wt` does. | vitest integration spawning the bash scripts (extends `wt-trunk-routing.test.ts`) |
| A11 | `worktree refresh --all` and `worktree preflight` see worktrees living in a declared `worktrees/` dir, and preflight excludes a trunk at a declared `path`. | same harness |
| A12 | The stray-state audit inspects each repo at its declared path; a stray under a declared `path` is reported, not missed. | vitest unit against `stray-state-audit.ts` |
| A13 | verify's refusal on a nested or sibling layout names a directory that exists. | vitest unit for `resolveVerifyRoots` (its first tests) |
| A14 | A config declaring `repos[]` without `shape: "workbench"` is treated as workbench-shaped by verify's refusal; it never verifies the wrapper repo. | same |
| A15 | In a multi-repo workbench, `worktree create <repo> <slug>` applies that repo's config, not the first repo's. | vitest unit against the worktree command's config selection |
| A16 | A search for "not a git repo" across CLAUDE.md, the skills, and the docs returns only historical records (decisions, lessons, archives, changelog). | vitest grep test scoped like `scm-rip-out-grep.test.ts` |
| A17 | The docs guide index's hook count matches its own table, and the hook keep/shed record names `workbench-sync.js`. | vitest doc-parity test |
| A18 | `workbench-mode-rail-integrity` is archived, or re-scoped with a runnable acceptance criterion. | manual: that plan's documents, checked at this plan's close |

## Untestable Assertions

None. Every finding is reproducible with a temp-directory fixture and real git.

## Notes

- A4, A6 and A7 share one fixture: a git-initialized workbench root declaring
  one repo at a `path`, and a variant declaring two. Build it once under
  `src/__tests__/` and reuse it; the research names the absence of exactly
  this fixture as why the regression net could not see F2.
- A1 is the first item in the brief's Phase A on purpose: it makes every
  later plan cheaper to execute correctly, because the agent is told which
  rows to author when a phase opens. Fix trap recorded in the research:
  `console.info`, not `console.log`, or the linter deletes it again.
- A7's single-repo case is a resolution fix, not a refusal: the declared repo
  is the right answer and the hook should find it at `repoDir(repo)`. The
  refusal is for the multi-repo case and for the case where the only git
  root found is the workbench itself.
- A18 is the one manual row. The rest of Phase B is deliberately mechanical so
  it can trail alongside Midnight and Dawn 6.5 without attention.
