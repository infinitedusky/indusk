---
title: "Bookkeeping lives where it is read — Retrospective"
date: 2026-10-08
---

# Bookkeeping lives where it is read — Retrospective

## What We Set Out to Do

InDusk wrote its own records into whichever checkout its writer happened to run in. A session in a plan worktree wrote `current.md` and lessons into that worktree; the evaluator, which runs in the commit's checkout, wrote its processed list there too. So the main checkout kept going dirty with InDusk's files, landing had to commit "bookkeeping" before it could merge, and, because each checkout kept its own processed list, one highlight could be turned into a lesson once per checkout. The brief promised two things: InDusk never leaves a checkout dirty with its own records (`indusk-leaves-main-clean`), and a highlight becomes a lesson once per project (`a-highlight-becomes-a-lesson-once`). The ADR split the records by who reads them: notes people read (`current.md`, lessons) go to the main checkout and are committed on `main` as written; machine state (the highlights queue, the processed list, evaluation results) goes to one home per project outside every checkout, under `~/.indusk/projects/`; `indusk update` moves existing projects.

## What Actually Happened

The plan ran as written for three build phases: one resolver (`bookkeepingRoots`, with a copy in the hooks pinned equal by a test), one commit-on-write function that refuses off the trunk branch or mid-merge, every writer moved onto them, the migration, and a real-evaluator e2e test (A8) proving the evaluator still reaches InDusk's tools and commits its lesson on `main`. It then grew by two phases: falsification found seven ways the shared home broke, and cleanup removed four copies the plan had made of itself.

64 commits; 59 files changed, +2018/−283 (42 of them in the package's source and hooks, +1634/−218). New modules: `lib/bookkeeping/` (`roots`, `notes`, `migrate`, `jsonl`, `git`) and `lib/eval/permissions.ts`.

## Getting to Done

- **The evaluator stashed in the live worktree.** While Build Phase 2 was being written, the evaluator grading one of its commits ran `git stash -u`, checked out three older files, ran tests and popped the stash, in the worktree this session was editing. Edits to `agent.ts` vanished and came back staged. It ran under `--permission-mode bypassPermissions`, which ignores the allowed-tools list. Fixed in scope (A12): `dontAsk`, read-only git allowed, every git command that changes a checkout denied. Until 1.66.0 is installed the old evaluator still runs with bypass.
- **The tests wrote the developer's home.** Once machine state moved to `~/.indusk/projects/`, every test that forgot its own `INDUSK_HOME` wrote a folder there: over two hundred in one afternoon. The everyday suite got a temporary home; the system tier, which has its own config, did not, and its real `claude` sessions wrote six more before the full run caught it.
- **A test was spending money.** An older test ran the eval hook with `--source handoff` in this repository only to prove it does not hang; evaluation is on here, so every `pnpm test` started a real, paid evaluator of HEAD. One was found running. It now runs in a temporary project with evaluation off.
- **Falsification: one shared home, read by many at once.** Seven hypotheses, all red before their fix: two evaluators (two commits seconds apart each start one) offered the same highlight (A13, fixed with holds); highlight ids colliding under concurrent writes, 25 ids for 100 highlights (A14, a lock); worktree queues the migration did not read, whose ids collide with the main checkout's (A15); a modify/delete conflict landing a branch that still tracked the queue (A16); the evaluator resuming a session made in another checkout, which Claude Code cannot find from there (A17); two clones sharing one home because the key was only the project's name (A18); and lesson names that could leave the lessons folder, now that a lesson is committed on `main` as written (A19).
- **Cleanup**: one `pathKey`, the home as an argument instead of an environment variable in tests, one JSONL reader, one synchronous git runner.
- **The docs audit found the old paths everywhere the plan had not looked.** Two shipped skills (`rail-check`, `eval-review`), a hook message and eleven docs pages still told people and agents to read `.indusk/eval/` and `.indusk/highlights*.jsonl`. With a hash in the home's name nobody can type the new path, so the retrospective added `indusk eval home`, which prints it, and pointed every one of them at it. The plan's Document items had named the two pages that describe where records live, not every page that reads one.

## What We Learned

- **Moving per-checkout state to one shared place turns every per-checkout assumption into a concurrency question.** Each checkout's private file had silently provided isolation: its own id counter, its own processed list, its own evaluator session. Sharing them is the point of the plan, and every one of those needed a lock, a hold or a key. None were in the ADR; falsification found all of them.
- **`bypassPermissions` ignores `--allowed-tools`.** An agent given a narrow tool list under bypass has every tool. The evaluator's list said read-only git; it stashed and checked out anyway.
- **Isolating a test suite means isolating every process it starts, in every tier.** The everyday suite's temporary home did not reach the system tier, and a hook run against the real repository reached a real, paid evaluator. The leak shows up as files in the developer's home or a bill, not as a failing test.

## What We'd Do Differently

- **Ask "who else reads this at the same moment?" in the ADR** for any state that moves from many places to one. All seven falsification findings were answers to that question; they cost a fifth phase instead of a paragraph.
- **Give the suite a temporary home before the first test that writes to it**, in every tier, rather than after two hundred folders appeared.
- **When a plan moves a path, grep for it everywhere at research**, skills, hooks' messages and docs included, and make each hit an item. The code readers were found by the compiler and the tests; the prose readers only by the retrospective.

## Shape

Shape raised one finding across five build phases (`migrate.ts`'s loop doing two jobs → `moveEvalDir`, Build Phase 4); a human judged none wrong. Phases 1, 2, 3 and 5 reviewed and found nothing.

## Quality

No recurring lint or type error suggested a Biome rule. Biome's `--write` reformatted unrelated files more than once (reverted each time); the habit that held was passing it explicit paths.

## Release

Packaged paths changed (the package's source and hooks); the plan adds a capability (holds, per-checkout sessions, the migration, `plans land` releasing a branch's queue), so it is a minor: 1.66.0.

## Insights Worth Carrying Forward

- A guard that names its subject's permissions (`evaluatorPermissionArgs`) and a test that pins every launch site to it is cheaper than finding out from a vanished edit.
- A real-model e2e test (A8, about $0.50) was worth its cost twice: it proved the evaluator's tools still worked under `dontAsk`, and again after the session and home-key changes.
