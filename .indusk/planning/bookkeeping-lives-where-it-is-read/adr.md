---
title: "Bookkeeping lives where it is read"
date: 2026-10-07
status: accepted
---

# Bookkeeping lives where it is read

## Goal

**InDusk never leaves a checkout dirty with its own records, and never processes a highlight twice.**

Today every session, hook and evaluator writes InDusk's records into whichever checkout it started in, and nothing commits them. On 2026-10-07 that blocked an approve, two landings and a release, and the evaluator wrote each of three lessons three times. After this, notes people read go to `main` and are committed as they are written, and InDusk's machine state lives once per project, outside git.

## Y-Statement

**In the context of:**
InDusk writing five kinds of record at runtime (`current.md`, lessons, the highlights queue, the processed list, evaluation results) from sessions, hooks and an evaluator that run in the main checkout or in any plan's worktree.

**Facing:**
a root chosen by wherever each process started, so records scatter across checkouts and nothing commits them; two rules that collide over them (a session never commits work that is not its own, a plan never lands onto a dirty trunk); and a processed list per checkout, so the same highlight is materialised again in each.

**We decided for:**
one resolver that gives every writer two places, the main checkout for notes people read and a per-project home under `~/.indusk/projects/<project>/` for machine state; notes committed on `main` in a commit of their own, under one lock, only when `main`'s checkout is on its trunk branch with no merge in progress; and a migration in `indusk update` that moves the tracked highlights into the home and out of git.

**And against:**
committing InDusk's notes in batches (main dirty in between), keeping machine state in git (a commit per evaluation, still a copy per checkout until merged), a separate bookkeeping branch (another thing to merge and reason about), and leaving writers where they are with only approve and land committing (the symptom fix already in place).

**To achieve:**
`indusk-leaves-main-clean` and `a-highlight-becomes-a-lesson-once`, while landing still refuses work that is not InDusk's and every commit is still scored.

**Accepting:**
small `chore(indusk):` commits on `main` (a few a day), machine state that does not travel between machines, and the hooks' own copy of the resolver, pinned to the package's by a test because hooks cannot import the package.

**Because:**
each record then has one home, chosen by who reads it, not by where its writer happened to start; and "is this mine to commit?" stops being a question anyone has to answer.

## Context

[research](research.md) maps every writer and why it lands where it does; the [brief](brief.md) holds the two promises; the [test plan](test-plan.md) holds A1–A10.

## Decision

**D1 — One resolver, two places.** `lib/bookkeeping/roots.ts`: `bookkeepingRoots(anyCheckout)` returns `{ trunk, home }`. `trunk` is the main checkout, the folder holding the repository's shared git directory (in a workbench, the workbench root); `home` is `<INDUSK_HOME>/projects/<project>/`, with `<project>` the id `markProjectId` already gives, so every worktree of a project agrees. Every writer of the five records goes through it.

**D2 — Notes are committed on `main` when written.** `commitNote(trunk, paths, message)` takes `current.md.lock`, then commits only the given paths (`git commit --only -- <paths>`, leaving anything else staged as it was) with a `chore(indusk): …` message, which the trunk guard already allows. It commits only when the main checkout is on its trunk branch and no merge, rebase or cherry-pick is in progress; otherwise it leaves the note written and uncommitted and returns why, which the tool reports. Writers: `update_current_section` and the other `current.md` writers, and `add_lesson`.

**D3 — Machine state lives in the project's home.** `highlights.jsonl`, `highlights-processed.jsonl` and `eval/` move under `home`. One queue and one processed list per project, so an evaluation in any checkout sees every mark. Nothing of it is in git.

**D4 — The hooks' copy.** Hooks are standalone scripts installed into projects and cannot import the package, so `hooks/_hook-paths.js` gains `projectHome(cwd)` with the same rule (git common directory, `INDUSK_HOME`, the project id), pinned equal to `bookkeepingRoots` by a parity test, the way `PACKAGED_PATHS` is pinned to the release guard.

**D5 — Migration.** `indusk update` moves a project's tracked `highlights*.jsonl` into its home (merged by id, unprocessed ones kept) and its `.indusk/eval/` with them, removes them from git, and adds the paths and `current.md.lock` to the project's `.gitignore`.

**D6 — Per-plan records stay with the plan.** `phase-boundary.jsonl` and the verify ledger describe the plan's own branch and travel with it, as today. Approve and land's bookkeeping commit stays as a safety net.

## Alternatives Considered

### Batch the commits
Fewer commits, but `main` is dirty between the batches, which is today's problem in a smaller window.

### Keep machine state in git, committed on write
Shared across machines, but a commit per evaluation on `main`, and a worktree still reads its own stale copy until it merges.

### A bookkeeping branch
Notes on their own branch, merged into `main` periodically: another branch to merge, and readers on `main` see stale notes.

## Consequences

### Positive
- No checkout is dirtied by InDusk; landings and releases never meet its notes.
- The evaluator processes each highlight once, from any checkout.

### Negative
- `chore(indusk):` commits on `main`.
- Machine state is per machine.

### Risks
- **A commit on `main` racing a person's own commit.** Mitigation: `--only` with explicit paths never touches their staged work; the lock serialises InDusk's own writers; a failed commit leaves the note written and says so.
- **The hooks' copy drifting from the package's.** Mitigation: the parity test.

## Documentation Plan

### Pages
- Update: `apps/docs/src/guide/context-tiers.md` or the operational-layer page — where `current.md`, lessons and InDusk's state live.
- Update: `apps/docs/src/reference/tools/highlights.md` — the queue's new home.

### Changelog
- Changed: InDusk's notes are committed on `main` as they are written; its machine state lives under `~/.indusk/projects/`.

### ADR in Docs
- Yes: `decisions/bookkeeping-lives-where-it-is-read.md` at close.

## References
- [research](research.md), [brief](brief.md), [test plan](test-plan.md)
- admin-plan-authoring's Build Phase 10 (`lib/plans/bookkeeping.ts`)
