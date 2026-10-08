---
title: "Small fixes"
date: 2026-10-08
---

# Small fixes — Retrospective

## What We Set Out to Do

Eight fixes from `known-issues.md`, agreed one at a time with Sandy on 2026-10-08. The first changed how dusk updates itself: landing a plan installs the checkout's build on this machine (`pnpm install:local`, declared as `workflow.steps.land.install`), and publishing becomes a deliberate act that runs the slow tests first. The rest made rules that were only words into enforcement, or two copies of a rule into one: a plan builds only after `plans approve`; the admin's session panel says how a turn ended; a bare `git stash` is refused where worktrees share the stack; the installed hooks are pinned to the package's; both daemon stops judge a process by what it is, never by its port; the planner's Key Decisions line no longer trips approve; the update notice compares numbers.

## What Actually Happened

Everything shipped, across one test phase, four build phases, a falsification phase (Build Phase 5) and a cleanup phase (Build Phase 6). The diff against the merge base is 55 files, +1,967/−340; the code and tests (`apps/indusk-mcp/src`, `hooks/`, `apps/indusk-admin/src`) are 35 files, +1,471/−259, over 54 commits. Twenty-four trajectory rows, all passing: A1 and A18 are live checks recorded on this machine, the rest are unit tests.

Two sessions built it. The first (4551e898) ran Test Phase 1 and Build Phases 1–3 and stopped before the stash guard: a safety classifier stopped its write of `stash-guard.test.ts` partway through, and it was told not to produce that file again. So the stash guard became its own last phase, Build Phase 4, carried in the register for a fresh session. This session (491b983a) wrote the test in one pass with no interference, then built the hook, the falsification phase and the cleanup phase.

The falsification phase is where the plan earned its keep. Build Phase 3 had shipped `ui stop` judging the admin daemon by the `next` binary path and the `--port N` flag in its command line, and A12's fixture composed that command line the same way. Read on the machine, `ps -o command=` gave `next-server (v16.2.4)`: `next start` rewrites its process title. The real daemon (PID 44479) was a stranger to its own stop. `ui stop` would have deleted its record without signalling it; `ui status` would have swept the record and said "not running". The global `indusk` already linked to this branch's build, so the bug was live on this machine, not hypothetical. Its working directory was no better: `npm install -g` had renamed the old package folder aside (`.indusk-mcp-7GmG4Aiu`). The fact that held was the start time, `ps -o lstart=`, which matched the record's `startedAt` to the second. Falsification also found:

- Edit fragments that moved a draft's status without its key (A19).
- `git stash branch <name>`, which pops the top entry (A20).
- `plans land` deleting the worktree its own `indusk` ran from (A21), which this very plan would have hit at landing.
- A failed turn with no text showing only "Failed" (A22).

Cleanup then found the reads behind identity, liveness and `ps`, defined in four modules (A23), and the hook registration list kept separately by `init` and `update` (A24). Both are now single definitions.

## Getting to Done

- **The classifier stop.** The first session's handoff carried the stash test's body as prose in the register. It took one fresh pass; nothing about the test was unusual. The cost was a whole phase split off and a second session's catchup.
- **The live check needed a decision.** `indusk ui restart` first ends sessions the admin started, and one was still alive: a two-day-old seatbox planning session from the first session's live checks (PID 58777). Restarting ended it. Sandy approved before it ran.
- **A pre-existing type error.** The admin package's `tsc` had been red on `SessionPanel.result.test.tsx` since Build Phase 3: its result events lacked `sessionId`, and that phase typechecked only the mcp package. Found and fixed in Build Phase 5.
- **One hook bypass.** One impl edit went through a Python script, which the gate hooks never see (`lesson: edit-plan-documents-only-through-the-edit-tool-not-sed-or-heredoc`). It changed text only, no checkboxes, and is recorded here because the rule is what it is.
- **The everyday suite caught one missed record.** `hooks-record-parity.test.ts` (A17 of an earlier plan) requires the guide's hook table and the Dawn master's keep/shed record to name every hook on disk; neither named `stash-guard`. No phase ran it, because no phase touched those documents. The guide now lists eight hooks. The Dawn record classifies the stash guard as shed: the thin lane does not read the model's own shell commands, so a `git stash` there is unguarded, and the record says so rather than claiming parity. The suite then passed: admin 62 files, mcp 323 of 324 files (one skipped), seat-holds 1.
- **A test regex that read prose.** A23's first liveness pattern matched the words `kill(pid, 0)` in two doc comments. Narrowed to `process.kill(…, 0)` in code before the phase closed.

## What We Learned

- **A process's identity must be read from the process, not composed from how it was spawned.** `next start` renames itself; `npm install -g` moves a running process's working directory. The start time survives both, and a recycled PID cannot share it. Lesson `identify-a-process-by-what-it-cannot-rewrite`.
- **A fixture built the way the implementation reads its input cannot find the bug** (the existing lesson, again). A12's fixture was the author's model of `ps`; one real `ps` read overturned it. The falsification prompt "what does the attestation assume about the environment?" found it, by running `ps` against the live daemon rather than reading the code.
- **Installing the build from a plan worktree creates a dependency the landing destroys.** Linking the global CLI to a worktree is fine for a live check, and fatal for the command that removes that worktree. The refusal (A21) is the fix; the skill's landing step now says so.
- **Two lists of the same thing grow a rule telling you to edit both.** The hooks `CLAUDE.md` rule "a new hook also needs an `ensureHookRegistered` call from `update.ts`" existed because init and update each kept a list. One table made the rule unnecessary.

## What We'd Do Differently

- **Read the real process before writing any identity rule.** One `ps` command at Build Phase 3 would have saved a falsification phase's worth of work. The live check A1 ran `ui status`, but before Build Phase 3 changed the rule, so it never exercised it.
- **Run the live check after the phase that changes what it checks.** A1 was recorded in Build Phase 1; the identity rule changed in Build Phase 3; nothing re-ran it. A live check belongs to the last phase that touches its subject.
- **Typecheck every package a phase touches, not just the one named in its command.** The admin's `tsc` stayed red for two phases.

## Insights Worth Carrying Forward

- Falsification paid for itself on a plan of "small fixes": one of the eight fixes was itself wrong in production on this machine. Small plans are not exempt.
- When a session is stopped by something outside the plan (a classifier, a credential), splitting the stopped work into its own last phase kept the rest of the plan moving and gave the next session a self-contained target.

## Quality Ratchet

- No new Biome rule. The recurring lint findings were formatting (fixed by `biome check --write` per file) and a long-standing unused `noIndex` in `init.ts` and unused imports in `telemetry/daemon.ts` (the latter removed with this plan's change to that file). Neither class suggests a rule the config lacks: `noUnusedVariables`/`noUnusedImports` already fire.
- **Shape:** 3 findings raised across the build phases (Build Phase 3: `waitForExit` in `daemonStop`; Build Phase 4: `registerHook` in `update.ts`; Build Phase 5: one `applyEdit` in `check-gates.js`), 0 judged wrong by a person. Every other phase recorded a reviewed-nothing-found or left-as-is note.

## Metrics

- 24 trajectory rows: 22 unit, 2 live checks; all passing.
- Phases: Test Phase 1, Build Phases 1–6 (5 = falsification, 6 = cleanup).
- 55 files, +1,967/−340; 54 commits on `plan/small-fixes`.
- New lessons: `a-plan-builds-only-after-approval`, `a-stash-never-crosses-worktrees`, `identify-a-process-by-what-it-cannot-rewrite`.
