---
title: "Run the graph — Test Plan"
date: 2026-10-19
status: draft
---

# Run the graph — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean slice 1 is working: within one approved plan, every phase whose dependencies are done runs at once, each on its own branch, and joins the plan's branch only when green. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief they prove. The brief opts into `clauses: required`, so this is the clause plan: one section per clause, each with its signal, the ways it could fail and its table. The assertions become the source rows for the impl's `## Test Trajectory`.

**Rewritten for slice 1 (2026-10-19).** The six-promise version is in this file's history at commit `0842d3fdf`; everything about two plans sharing a file, plan order, the trunk cascade, pulled work, holds and fix-first went with the promises the brief withdrew.

## Behavioral Assertions

**Every assertion is observable from outside the system:** which phases of a plan are running at a moment, what a phase's worktree holds when it starts, what a merge into the plan's branch does, what a landing refuses and says, and what the build shows. A "phase" is a build phase of the plan (test phases included as nodes); "the driver" is the code inside the admin's build that starts phase sessions.

**How the levels were chosen (decision).** The scheduler decides from a graph, a list of running sessions and a cap, so each of its rules is a `unit` test over those inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`). Branches and merges are tested against real throwaway git repositories, still `unit` (a temp directory, no server). The driver is tested with the real session manager and a stand-in process that spends no model call. One `live check` runs a real plan through the admin's build host with a scripted agent; it runs in the system tier at landing and release, never in a phase's loop, and so proves no clause.

## `the-work-runs-as-a-graph`

Within an approved plan, every phase whose dependencies are done is running, up to the session cap, and no phase waits on one it does not depend on.

### `a-phase-names-what-it-needs` — each phase names the phases it depends on; one that names none depends on the phase before it

- Signal: a span on every graph read, from the graph reader's signal file, judging each node's dependencies against a plain scan of the impl's headings and dependency lines (outside fenced blocks), never through the reader's parser. Upheld when every phase's dependency list matches its line, or the phase before it when it has none; broken names the plan, the phase and both lists.
- Fails when:
  - the reader parses a line wrongly, or misses one beside a fence — the span's plain scan disagrees.
  - a phase with no line gets no dependency, or the first phase gets one — the span's expected list says otherwise.
  - a bad line (an unknown phase, itself, a loop) is saved — refused at save; one written past the save check (by a shell or another tool) shows in the span as a dependency on a phase the scan does not find, or a loop.
  - the build's phase line in the admin shows different dependencies — no signal: that line is written from the graph through one function, held by A26.
- Measure: phases, over the next twenty run by the graph, whose recorded dependencies differ from what their impl declared; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan with six build phases where Phases 1 and 3 name nothing, Phase 2 names 1 and Phase 5 names 2 and 3, shows exactly those dependencies. | unit |
| A2 | A plan written before this one, whose phases name nothing, shows each phase depending on the one before it; the first phase depends on nothing; in an impl with a Test Phase 1, every build phase also depends on it, even one marked `none`. | unit |
| A3 | A phase that names a phase which does not exist, names itself, or closes a loop is refused when the impl is saved, naming the phase and the problem; the hook's reader and the package's reader give the same answer for the same text. | unit |

### `ready-phases-start` — a phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room

- Signal: a span from the driver's signal file at each launch and on each 30-second tick. The ready time is read from git, not from the driver: the time the plan's branch first held the last dependency's work, from the plan branch's reflog (a fast-forward and a merge commit read alike), or, for a phase with no dependency, the later of the plan's approval reaching the trunk and its build run's start in the run record. The launch time is the phase branch's creation time from its own reflog. Whether the cap had room is read from the session manager's sessions file against `sessions.max` at each tick and kept in the signal's own log. Upheld when every phase was launched within sixty seconds of becoming ready whenever the cap had room; broken names the phase, the ready time and the launch time or none. A plan whose build is stopped or waits on a question is not judged.
- Fails when:
  - a ready phase with cap room is launched late — the launch span (gap over sixty seconds while the signal's own readings showed room).
  - a ready phase with cap room is never launched (a missed phase end, the scheduler judging it not ready, a refused launch) — the tick span: ready over a minute by git's time, room now, no phase branch.
  - the admin is not running, so no driver runs — its first tick after it starts reports every phase ready since before it started, with its gap.
  - a phase branch is cut but its session never starts (setting up its worktree failed silently, the session was refused) — the tick span: a phase branch older than fifteen minutes with no session in the sessions file and no stop for it in the run record.
  - the plan branch's reflog is missing (reflogs turned off) — the span reports unknown, never upheld.
- Measure: seconds from ready to launch for every phase in the next twenty run by the graph that had cap room; expect under sixty for all.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | Approving the six-phase plan starts Phases 1 and 3 at once; Phase 2 starts when 1 has joined the plan and not before; Phase 5 starts only once both 2 and 3 have joined. | unit |
| A5 | A ready phase is not started while the cap is full, and is started when a session ends. | unit |
| A6 | Run by the driver with the real session manager and a stand-in process, the plan's second ready phase gets its own session while the first runs, and a session beyond the cap is refused and started later. | unit |
| A7 | When a phase's session ends with its phase finished, the phase is merged into the plan's branch and the phases that were waiting only for it are launched, without anyone running a command. | unit |
| A8 | `indusk plans approve` run in a terminal launches no session: it asks the running admin to build the plan, and says plainly when the admin is not running. | unit |
| A9 | After the admin restarts, a phase whose session was ended by the restart is launched again in its own worktree on the first tick, and a phase whose worktree shows it finished goes straight to its merge. | unit |
| A10 | A real approved plan with two independent phases and a third depending on both, built from the admin with a scripted agent, runs the first two at once and ends with all three on the plan's branch. | live check |

### `no-needless-wait` — no phase is held back by a phase of its plan it does not depend on, except that two phases of one plan that touch the same file never run at the same time

- Signal: a span from the scheduler's signal file after each scheduling call (the driver calls it; the scheduler stays pure), re-deriving each waiting phase's reason from its own reads, not the call's inputs: dependencies by a plain scan of the impl at the plan branch's tip, running phases from the session manager's sessions file, overlap by expanding both phases' declared paths against the plan branch's files (`git ls-files`) and comparing concrete paths, never by the scheduler's overlap function. Upheld when every waiting phase's reason is one of: a dependency not done, a running phase of the plan sharing a file, the cap, or the plan waiting on a question; broken names the phase and its reason.
- Fails when:
  - a waiting phase has no reason, or a reason naming a phase it neither depends on nor shares a file with — the span.
  - a ready phase with none of the four reasons is not started — the span.
  - two declared file sets are judged overlapping when they are not, or not when they are — the span re-checks on concrete paths.
  - two running phases of one plan touch the same file — the span.
  - the build's phase line shows a different reason — no signal: one function writes it from the scheduler's result, held by A26.
- Measure: minutes a phase waited whose reason was none of the four; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A phase later in the document than a running phase, which does not depend on it and shares no file with it, starts without waiting for it. | unit |
| A12 | A ready phase that shares a file with a running phase of its plan waits, and its reason names that phase and that file. | unit |
| A13 | A phase that declares no files is treated as touching every file its plan's phases declare, waits for its plan's running phases, and says so. | unit |
| A14 | The plan's documents, the changelog and other bookkeeping every phase edits are never counted as shared files. | unit |
| A15 | With the cap at one and phases naming nothing, the order and the result are those of today's one-phase-at-a-time build. | unit |

### `graph-is-current` — when a phase ends or a plan is approved, the plan's graph is read again before its next phase starts

- Signal: a span from the driver's signal file at each launch, reading the impl at the plan branch's tip with git and a plain scan: the launched phase is still open there, every phase it depends on is finished there, and no session for that phase is already in the session manager's sessions file. Upheld when every launch holds all three; broken names the launch and which failed. A ready phase never launched after a phase end or an approval is the `ready-phases-start` tick span's to report.
- Fails when:
  - a stale graph launches a phase already merged into the plan — the span.
  - a phase is launched before a dependency has joined the plan — the span.
  - one phase is launched twice — the span.
  - a phase end or an approval is not followed by a read, so a ready phase waits — the `ready-phases-start` tick span.
- Measure: launches that failed any of the three checks; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | Each phase end is followed by a fresh read of the plan before the next launch, and the 30-second tick launches a ready phase whose end event was missed. | unit |
| A17 | Two phases ending at the same moment are merged one after the other, and the phase waiting for both starts once, with both in its worktree. | unit |

### `within-the-cap` — rests on `sessions-are-capped`

- Signal: the promise it rests on, `sessions-are-capped`, read where that promise is read; the clause is upheld while that promise is in force.
- Fails when:
  - a plan's phase sessions are exempted from the cap because its build was admitted once — no signal of its own: `sessions-are-capped` covers every session the manager starts, and A18 holds that each phase session after the first takes its own place.
  - a phase session is started outside the admin's session manager — no signal: the driver runs only in the admin (A8), and `indusk run` refuses a plan the graph is building (A20).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | With the cap at four and one admitted build, the build's first phase session takes the place its admission holds and each further phase session takes a place of its own, so a fifth session on the machine is refused. | unit |

### `reviews-are-phases` — the phases falsify, cleanup, the audit and an incident write are build phases of the graph like any other; the steps that write them are not phases

- Signal: two spans. On every graph read, from the graph reader's signal file: a plain scan of the impl's headings finds each Falsification, Cleanup, Audit and Maintenance phase, and each has a node with its declared dependencies and files; no node is a step. When the build starts a ritual step, from the driver's signal file: every phase of the impl at the plan branch's tip is finished, so no review phase was left for a step to skip. Broken names the plan and the missing node, the step shown as a node, or the open phase a step started over.
- Fails when:
  - a review phase in the impl is missing from the graph — the read span.
  - a step that writes a phase appears as a node or takes a session — the read span.
  - a Maintenance phase is written without its dependency and files lines — the writer's own test (A21) holds it; one that still lacks them runs as an undeclared phase, serialised, and the read span names it.
  - a ritual step starts while a review phase it or another step wrote is open — the step span.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | A Falsification, a Cleanup and an Audit phase are listed in the graph with the dependencies they name and start when those finish; the audit, falsify and cleanup steps themselves are not phases. | unit |
| A44 | Once every phase is finished the build runs its next ritual step, and a phase that step writes is run by the graph before the step after it starts. | unit |
| A21 | The writer of an incident's Maintenance phase gives it a dependency line naming no other phase and a files line listing the paths the broken promise declares. | unit |

## `a-phase-builds-on-its-own-branch`

Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified.

### `own-worktree` — every running phase has its own worktree and branch, cut from its plan's branch

- Signal: a span from the phase-branch signal file each time a phase starts or resumes, read with plain git (`git worktree list --porcelain`, `git merge-base`, the phase branch's reflog), not the layout code. Upheld when the phase's worktree and branch are held by no other running phase, its branch was cut from the plan's branch, and a resumed phase's branch tip is the one it had before; broken names the phase and the shared worktree, the wrong base, or the lost commits.
- Fails when:
  - two running phases share a worktree or a branch — the span.
  - a phase is cut from the trunk or another branch — the span checks the base.
  - a resumed or restarted phase is cut fresh and loses its work — the span compares the branch tip before and after, and reads a re-creation in the branch's reflog.
  - the worktree is not set up (its install fails) — no signal: the phase stops with the failing command named, and its check cannot pass, so it never merges (`green-before-merging`).
  - a merged phase's worktree is left behind — no signal: housekeeping that changes no running phase's work.
- Measure: running phases sharing a worktree, branched off something other than their plan's branch, or resumed without their earlier commits; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A22 | Two phases of one plan running together are in two worktrees on two branches named for the plan and the phase, both cut from the plan's branch, and one's work is not visible in the other's worktree. | unit |
| A23 | A phase started again (after a red check, a question or an admin restart) carries on in its own worktree and branch with its earlier commits; a branch whose worktree was removed gets its worktree back from the branch, never a fresh cut. | unit |
| A24 | A new phase worktree is set up as `indusk worktree create` sets one up — the same environment and install steps, through one function both call — and a failed setup stops the phase naming the command. | unit |

### `starts-from-its-dependencies` — a phase starts with every finished phase it depends on merged into its worktree

- Signal: a span from the phase-branch signal file each time a phase starts, read with git: each dependency's branch tip is an ancestor of the new worktree's head, and the worktree has no unmerged paths. Upheld when every dependency's work is present; broken names the phase and the dependency missing.
- Fails when:
  - a finished dependency's work is missing (the phase was started before the dependency joined the plan) — the span.
  - a start leaves half a merge — the span (`git ls-files -u`).
- Measure: phases started without a dependency's work in their worktree; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A25 | Phase 5, depending on 2 and 3, starts with both phases' files present in its worktree. | unit |

### `green-before-merging` — a phase merges into its plan's branch only when, with the merge made, its own tests and the tests of every clause the plan's branch has touched pass

- Signal: a span from the merge signal file after each merge and on each driver tick, reading every move of the plan's branch since the last judged one from its reflog. A move that brings a phase's work must have a test runner report in machine state, written by the check for exactly that commit, with every test passing and a test file for every touched clause — the touched clauses recomputed by a plain scan (the trajectory's `For` cells for rows of phases finished at that commit, and `clause:` and `promise:` tokens in files changed on the plan's branch since it left the trunk), not by the check's selector. A move that brings no phase's work while one of the plan's phase sessions is running is broken: something moved the branch outside the check. Broken names the commit and the red, missing or left-out tests, or the outside move.
- Fails when:
  - the branch moves with a red run, or to a different commit than the one checked — the span.
  - the run leaves out a clause touched through another phase — the span's own scan finds its test file absent from the report.
  - the merge claims a run it never made — the span finds no report for that commit.
  - the branch is moved during a run by something else (Dawn's `indusk run`, a person's commit, a session in the plan's worktree) — the tick span; `indusk run` also refuses such a plan (A20).
  - a phase whose check stays red is merged after its attempts run out — the span.
- Measure: moves of a plan's branch, during graph runs, with a red, absent or partial check; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A27 | A phase whose tests pass alone but fail once the plan's branch is merged into it is not merged; the first of two phases that break something only together stays merged, and the second is sent back with the failing tests named. | unit |
| A28 | A green phase is merged into the plan's branch and the plan's worktree shows its files. | unit |
| A29 | The merge check's real test selection, on a real plan's trajectory and changed files, picks the phase's own tests and the tests of every clause named by a finished phase's row or by a token in a changed file, and leaves out rows not yet written. | unit |
| A30 | A phase whose check is red, or whose merge conflicts outside the impl, goes back to its own session told why; after its third failed attempt it is stopped and listed with the reason, its dependents keep waiting, and phases that do not need it go on. | unit |
| A31 | Two phases that tick boxes and fill result cells on neighbouring lines of the impl merge without a conflict reaching a session. | unit |
| A20 | `indusk run` refuses a plan the admin is building with the graph, naming the build. | unit |

### `every-phase-is-checked` — a phase that runs no test never merges, and a phase that touches a clause carries that clause's signal

- Signal: a span from the merge signal file after each merge, reading the run's test count from the test runner's own report (not the record), and, for each clause the phase touches (its rows' `For` cells, tokens in the files it changed), looking for that clause's signal task in this phase's section or a finished phase's section with the rule the contract check uses. Upheld when every merged phase ran a test and each clause it touches has its signal task; broken names the phase and "no test ran" or the clause without its signal.
- Fails when:
  - a phase merges having run no test, or only skipped ones — the span.
  - a phase whose rows are all deferred merges — the same span (no test ran).
  - a phase touching a clause merges with no signal task for it anywhere in the finished plan — the span.
- Measure: phases merged with no test run, or touching a clause with no signal task, over the next twenty; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A32 | A phase whose check runs no test, or whose rows are all deferred, is not merged and is listed as unchecked. | unit |
| A33 | A phase touching a clause whose signal task is in no finished phase and not in its own is not merged, naming the clause; one carrying it, with a passing test, merges. | unit |

### `only-the-plan-lands` — nothing reaches the trunk from a phase's branch; only a plan's branch, once its promises are verified

- Signal: a span from the merge signal file after each landing and each approval merge, read with plain git: every phase branch (`git for-each-ref refs/heads/phase/`) whose tip is in the trunk's history belongs to a plan whose landing brought it, i.e. its tip is in the history of the landing merge's plan-side parent. It judges by history, never by commit subjects, so an approval merge (`plan(<name>): approved — …`), which brings only documents, reads upheld. Broken names the phase branch and the trunk commit that brought it.
- Fails when:
  - a phase branch is merged into the trunk by hand or by a tool — the span at the next landing or approval.
  - landing deletes a plan's phase branches before the span reads them — the landing calls the span before it deletes.
  - a plan lands with its promises not verified — no signal of its own: landing refuses it today by running the plan's clause tests (`land-clause-tests.test.ts`), unchanged here.
- Measure: phase branches that reached the trunk other than through their plan's landing; expect none, ever.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A34 | A phase's finished work is on the plan's branch and not on the trunk until the plan lands. | unit |
| A35 | Landing a phase's branch is refused, naming its plan; a plan with a phase running or stopped unmerged is refused landing, naming those phases. | unit |

## Not for a promise of this plan

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A36 | A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the one running; a plan can have a planning session and several phases building at once. | unit | The changed promise `a-session-belongs-to-its-plan`. |
| A37 | A run record keeps each running phase's process, reads running while any of them is alive, and a record written before this still reads. | unit | A regression guard on `a-run-is-read-from-its-record`, which one process per run would break once phases run together. |
| A38 | A plan whose impl is a draft has no phase in the graph; one whose impl is approved, in progress, or completed with an open phase has its open phases in it. | unit | Must-not-break: `a-plan-builds-only-after-approval`; and the work skill moves a plan's status on, which must not drop it from the graph. |
| A39 | Phases branch from the plan's branch, never the trunk. | unit | Must-not-break: `a-plan-is-written-on-its-own-branch`. |
| A40 | A phase boundary still names the command for what runs next. | unit | Must-not-break: `a-plan-boundary-names-the-next-session`. |
| A41 | A phase session that stops on a question that holds holds its whole plan: no new phase of it starts, its running phases finish and merge, the build stops on the question, and the answer resumes the asking phase in its own worktree. | unit | Must-not-break: `the-cost-sets-the-wait` — in this slice a held question holds its plan. |
| A42 | A held question still frees its plan's place under the cap and resumes on the answer. | unit | A regression guard on `decisions-as-questions`' slot rule. |
| A43 | The manual one-phase `/work` path works unchanged when no graph run is active. | unit | A regression guard: the driver is added beside the manual path. |
| A26 | The build shows each phase of the plan as running, waiting (naming what for) or stopped (saying why), from the run record through one function, and the check that the admin shows the phase a session works compares each running phase. | unit | A display guard (brief story 6): the one place a person sees the phases; a wrong line could hide a broken clause, and no signal reads the screen. |

## Expectations

| ID | Expectation | How it is read | When |
|----|-------------|----------------|------|
| E1 | A plan finishes in about the time of its longest chain of dependent phases, not the sum of its phases. | For the next plan with independent phases, approval to review against the sum of its phases' durations and its longest chain, from the phase launch and merge times in the graph record. | When that plan reaches review. |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A plan finishes in about the time of its longest chain. | Depends on real phases' durations over hours or days. | E1, read from the graph record when that plan reaches review. |

## Notes

- **Decision: a phase with no declared files touches every file its plan's phases declare** (A13). An unknown set cannot be shown free; treating it as empty lets two phases collide unseen. It costs parallelism only where a phase did not say what it touches.
- **Decision: a phase is ready when its dependencies' work is on the plan's branch**, read from the impl at the plan branch's tip (a merged phase's boxes are ticked there). A phase that finished in its worktree but is not merged is not done; its dependents wait for the merge.
- **Decision: a red check or a conflict sends the phase back to its own session, three attempts in all**, then stops it (A30). No question is raised for it in this slice; the build stops with `cannot-continue` naming the phase once nothing else can run.
- **Decision: a held question holds the whole plan** (A41), as the brief's Must-not-break entry for `the-cost-sets-the-wait` says; holding one phase is a later slice.
- **Decision: the one live check (A10) runs in the system tier** at landing and release, with a scripted agent, and proves no clause; each clause it touches is proved by unit rows.
- **Decision: each split and limit clause's signal is a promise span written beside the code that decides it**, in the build phase that writes that code, best-effort and never failing its caller, judged from a source the deciding code does not use (plain git, a plain scan of the impl, the session manager's sessions file, the test runner's own report).
