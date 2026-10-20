---
title: "Run the graph"
date: 2026-10-19
status: proposed
---

# Run the graph

## Goal

**Within one approved plan, every phase whose dependencies are done runs at once, each on its own branch, and joins the plan's branch only when green — so a plan finishes in the time of its longest chain, not the sum of its phases.**

Today the admin's build (`lib/build/runner.ts`, `runBuild`) runs a plan's phases one after another, one session at a time, in the plan's worktree. Two phases that need nothing from each other wait in line anyway.

**Slice 1 (2026-10-19).** This decision covers one plan's phases only. Two plans sharing a file, plan order, the trunk cascade, pulled work, holds per phase and fix-first are later slices; the full design is in this file's history at commit `0842d3fdf`.

## Y-Statement

**In the context of:**
the admin's unattended build of one approved plan, on one machine, under the machine's session cap.

**Facing:**
the need to start every phase whose dependencies have joined the plan, each in a worktree of its own, to bring each finished phase back into the plan's branch only with its tests and the plan's touched clauses' tests green, and to survive a red check, a question and an admin restart without losing a phase's work.

**We decided for:**
dependencies and files declared as label lines on each phase; a pure scheduler over the plan's graph, its running sessions and the cap; the graph run as the build's `work` step inside the admin's existing build host; one `phase/<plan>/<n>` branch and worktree per phase, cut from the plan's branch, resumed rather than re-cut; a merge that brings the plan's branch into the phase, checks the result, and fast-forwards the plan's branch in its own worktree; phase state derived from the impl on the plan's branch, the session manager and one small record.

**And against:**
phases sharing the plan's worktree; a scheduler process or store of its own; inferring dependencies from code; a lock on the plan's branch; a second runner outside the admin.

**To achieve:**
a plan that takes the length of its longest chain, with every scheduling decision a unit test over plain inputs.

**Accepting:**
that phases must declare their files to run beside each other (an undeclared phase is serialised within its plan), that a red phase costs its dependents their wait, and that a question still holds the whole plan in this slice.

**Because:**
the brief's two promises are about what is running and what each branch holds at a moment; state read from files is what a person and the admin can read too, and a pure function over it is testable without a server or the wall clock (`lesson: code-that-decides-takes-its-clock-and-its-reads`).

## Context

The brief (accepted 2026-10-19, sliced the same day) makes two promises, `the-work-runs-as-a-graph` and `a-phase-builds-on-its-own-branch`, and changes `a-session-belongs-to-its-plan`. The test plan states a signal and the ways each clause could fail.

What exists: `lib/build/` (`runBuild` asks `nextBuildStep` for the next step and runs each as one session through `runStepSession`, which takes a worktree), the admin's build host (`apps/indusk-admin/src/lib/build-host.ts`, `startBuild`, which admits one place under the cap per build and calls `holdQuestion` when the run stops on a question), `lib/session/manager.ts` (one session per plan and kind; `sessions.max` cap; an admitted build's sessions are exempt), `lib/run-record/` (one record per plan and kind with one process), `lib/plans/test-set.ts` (the tests a phase or a landing runs), `lib/promises/reopen.ts` (writes an incident's Maintenance phase), `lib/models/tiers.ts` (a phase's `**Tier**:` line), and `indusk worktree create` (which sets up a worktree's environment and runs its `post_create` steps). Dawn's `indusk run` (`lib/run/driver.ts`) runs a plan's phases in sequence outside the admin.

## Decision

### D1. A phase names its dependencies and files in two label lines

`**Depends on**: Build Phase 1, Build Phase 3` (or `none`) and `**Files**: apps/x/src/a.ts, apps/x/src/lib/**` sit under the phase heading and are parsed exactly as `**Tier**:` is: outside fenced blocks, one per phase, a second is an error. Names are headings as written, test and build phases alike. A phase with no dependency line depends on the phase before it; the first depends on nothing; in an impl with a Test Phase 1 every build phase also depends on it, whatever its line says. So every plan written before this runs as a chain, as today. An unknown phase, a self-dependency and a loop are refused when the impl is saved, by `validate-impl-structure.js`, whose inline reader is held equal to the package's by a parity test.

A phase with no files line touches every file its plan's phases declare. The plan's own documents, the changelog and the `CLAUDE.md` files are bookkeeping every phase edits and are never counted as shared; a file a phase changes outside its declaration is never refused, only listed with its merge. The incident writer (`reopenOwner`) writes `**Depends on**: none` and `**Files**:` from the broken promise's declared paths; the falsify, cleanup and planner skills write both lines on the phases they author.

Rejected: a dependency table (a second place to keep equal to the headings); frontmatter (far from the phase); inferring dependencies from files (a phase can need another's type without sharing a file).

### D2. The graph is read from the plan's branch; a phase is done when it has joined it

`readGraph(planWorktree)` reads the impl on the plan's branch (the plan's worktree, which tracks it) and returns a node per open phase with its dependencies and files. A phase is **done** when it is closed in that impl: its boxes are ticked there because its merge brought them. A phase that finished in its own worktree but has not merged is not done, so its dependents wait for the merge. The graph admits a plan whose impl is `approved`, `in-progress`, or `completed` with an open phase — the work skill moves an approved impl to `in-progress` and the last phase to `completed`, and falsify reopens one — and never a draft. Falsification, Cleanup, Audit and Maintenance phases are nodes like any other; the steps that write them are not.

### D3. The scheduler is one pure function

`pickPhasesToStart({ graph, running, waitingOnQuestion, room })` returns the phases to launch and, for each ready phase it does not start, the reason: a dependency not done, a running phase of the plan sharing a file (named, with the file), the cap, or the plan waiting on a question. Ready means every dependency is done and the phase is not running or stopped. Starts are chosen one at a time within a call, each joining the running set, so two phases freed together never both take one file. It reads nothing, has no clock and no way to stop a running phase.

### D4. The graph run is the build's `work` step, inside the admin's build host

The admin's build stays the one runner. When `nextBuildStep` says `work`, `runBuild` no longer runs one phase's session: it hands the step to the graph driver (`lib/build/graph-run.ts`), which runs the plan's phases until none is open, ready or running, then returns to the step loop. So the ritual steps (audit, falsify, cleanup, retrospective) still run one at a time as today, and only when every phase is done; a phase a step writes is run by the graph at the next `work` step.

The driver, for one plan: reads the graph, calls the scheduler, and for each phase to start, starts its branch (D5) and its session through the admin's session manager (`runStepSession` with the phase's worktree and its tier's model). When a phase's session ends it merges the phase (D6), records the outcome, reads the graph again and launches what is now ready; a 30-second tick does the same, so a missed end strands nothing for long. It holds no state that is not also on disk: done comes from the plan's branch, running from the session manager, attempts and stops from the graph record (D8).

It runs only inside the admin: the session manager that counts sessions against the cap lives there, and a session a CLI process started would die with it. `indusk plans approve` in a terminal asks the running admin to build the plan (`askAdminToBuild`, built like `askAdminToPlan`) and says plainly when the admin is not running; approving in the admin already starts the build. Dawn's `indusk run` refuses a plan the admin is building, read from the plan's build run record (a live phase process, or the admin answering that it holds the build).

### D5. A phase works in `phase/<plan>/<n>`, in its own worktree, and resumes there

The branch is `phase/<plan>/<n>`, never `plan/<plan>/phase-<n>`: git cannot hold a ref `plan/<plan>` and refs below it. A phase starting for the first time is cut from the plan branch's tip, which holds every done dependency by D2, so it starts with its dependencies' work by construction. A phase started again — after a red check, a question, a stop or an admin restart — resumes: an existing branch with its worktree is reused as it is; an existing branch whose worktree was removed gets a worktree added from the branch; only a phase with no branch is cut. Its earlier commits are never dropped.

A new phase worktree is set up as `indusk worktree create` sets one up — the environment provisioning and the `post_create` steps, through one function (`provisionWorktree`) both call — and a project with no `post_create` runs the install its lockfile names. A failed setup stops the phase, naming the command.

### D6. A phase joins its plan by a checked fast-forward, one at a time

When a phase's session ends with its phase closed in its worktree, the driver, one phase at a time per plan:
1. sends the phase back to its session if its worktree has uncommitted changes;
2. merges the plan's branch into the phase's branch; a conflict confined to `impl.md` where each line was changed by one side only (ticks, result cells) is merged line by line; any other conflict is aborted and sends the phase back to its session, told the files;
3. runs the check on that commit in the phase's worktree: the phase's own tests and the tests of every clause the plan's branch has touched, chosen by a new `merge` scope of `planTestSet` — rows of this phase and of phases done on the plan's branch, plus the clauses whose `clause:` or `promise:` token appears in a file changed on the plan's branch since it left the trunk, plus the Must-not-break promises' tests — writing the test runner's JSON report to machine state, named by the commit. An empty set refuses the merge as unchecked; so does a clause the phase touches whose signal task is in neither this phase nor a done one;
4. in the plan's worktree, `git merge --ff-only phase/<plan>/<n>`. If the plan's branch moved meanwhile, it repeats from step 2; if the plan's worktree has local changes, the phase stops and the build stops naming them.

A red check, a conflict or a dirty worktree is a failed attempt: the phase's session is started again in its worktree, told why. After its third failed attempt the phase is stopped and listed with its reason; its dependents keep waiting, its plan's other phases go on, and once nothing more can run the build stops with `cannot-continue` naming it. Pressing Build again gives a stopped phase three fresh attempts. On success the phase's worktree is removed; its branch is kept until the plan lands.

Only a plan's branch reaches the trunk. `plans land` refuses a ref under `phase/`, naming its plan, and refuses a plan with a phase running or stopped unmerged, naming them; it deletes the plan's phase branches after it lands.

Rejected: moving the plan's branch with `update-ref` (leaves the plan's checked-out worktree stale; the fast-forward in the worktree moves both); a lock on the plan's branch (the driver merges one at a time anyway, and `--ff-only` refuses an outside move); merging with no re-check (misses two green phases that break each other).

### D7. A session is identified by plan, kind and phase; every phase session counts

`a-session-belongs-to-its-plan` changes: only a second session of the same kind on the same phase is refused, naming the one running. A build's admission holds one place, which covers one of its sessions; each further phase session takes a place of its own, so the cap counts sessions, never builds. The run record of a build keeps a `phases` list — each running phase's process and state (running, waiting on what, stopped why) — and reads running while any listed process is alive; a record written before this still reads. The admin shows each phase's line from that list through one function, in the place it shows the phase today, and the check that the admin shows the phase a session works compares each running phase.

A question that holds holds the whole plan in this slice: when a phase's session stops on one, the driver launches nothing more for the plan, lets its running phases finish and merge, and ends the run on the question, which the host holds as today (`holdQuestion(project, plan)`). The answer starts the build again and the asking phase resumes in its own worktree (D5).

### D8. One small record per plan in machine state

`graph/<plan>.jsonl` under the project's machine-state home (`indusk eval home`), appended by one never-raising writer: `launched`, `ended`, `merge` (outcome, commit, report path, files changed outside the declaration), `stopped`, and `run-started` (which resets attempts). It is what the driver counts attempts from, what the build's phase lines show, and what the first expectation is read from. A torn last line reads as absent.

### D9. Signals are judged from what the deciding code does not read

Each split and limit clause gets a promise span written beside the code that decides it, in the build phase that writes that code, best-effort and never failing its caller. Each judges from plain git (the plan branch's and the phase branches' reflogs, `merge-base`, `worktree list`, `for-each-ref`), a plain scan of the impl, the session manager's sessions file, or the test runner's own report — never the deciding function, its inputs, or the record entries it wrote. Ready times come from the plan branch's reflog, so a fast-forward and a merge commit read alike. "Only the plan lands" judges by history, not commit subjects, so the approval merge reads upheld.

### D10. One live check, in the system tier

A real plan with two independent phases and a dependent third is built from the admin's build host with a scripted agent; it runs in `test:system` at landing and release, never in a phase's loop, and proves no clause.

## Alternatives Considered

### Phases share the plan's worktree with file locks
Rejected against `own-worktree`: two sessions in one working tree see each other's half-written files, and one phase's tests cannot be run on its state alone.

### A scheduler daemon with its own state
Rejected against `graph-is-current`: stored state can disagree with the impl. The driver reads the plan's branch on every decision.

### A separate graph runner beside `runBuild`
Rejected: two runners for one plan would need a rule for which owns it, and the ritual steps would need re-wiring. Making the graph the `work` step leaves the step loop, admission, stop, restart and question handling where they are.

## Consequences

### Positive
- A plan with independent phases takes the length of its longest chain.
- A plan written before this runs as a chain with no edit, now with each phase checked before it joins.
- Every scheduling decision is a pure function under unit test.

### Negative
- Parallelism depends on the author's files lines; an undeclared phase is serialised within its plan.
- Each phase's merge runs the plan's touched clause tests, which grows with the plan.
- Each phase worktree runs an install, which costs time and disk per phase.
- A question anywhere in the plan holds the whole plan until answered.

### Risks
- **Two phases interfere without sharing a declared file.** The merge (D6) runs the joined result's tests and sends the second back; the cost is one phase's rework, not an unseen break.
- **A missed session end strands a ready phase.** The 30-second tick bounds it, and the `ready-phases-start` tick span reports it.
- **Something moves the plan's branch during a run.** `--ff-only` refuses to merge over it, `indusk run` refuses the plan, and the `green-before-merging` tick span reports the move.

## Open Decisions

- **A workbench plan is not run by the graph in this slice; it builds one phase at a time as today.** Its documents live at the workbench root, shared by every session, so parallel phases would edit one impl file at once. **This narrows `the-work-runs-as-a-graph` for workbench plans and needs Sandy's word** — an amendment if the promise must say so, or a decision that the next slice covers workbenches.
- **The tick is 30 seconds and a constant**, so a ready phase missed by an event is caught well inside the promised minute. Reversible by moving it beside `sessions.max`.
- **Three attempts, on the phase's own tier.** A stopped phase raises no question in this slice; per-phase questions come with the holds slice.
- **Effort in the tier** (`research.md`'s proposed shape) has no promise in the brief and stays out.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/phases-in-parallel.md` — what runs together, the two label lines, why a phase waits, what a stopped phase means.
- Update: `reference/skills/planner.md` (cutting phases and writing the two lines), `reference/skills/work.md` (a phase's own worktree and its merge), `reference/skills/falsify.md` and `cleanup.md` (they write the lines).

### Diagrams
- A Mermaid graph of the brief's six-phase plan, and a sequence of a phase's end (merge the plan in, check, fast-forward), in the guide page.

### Changelog
- "A plan's phases now run in parallel: each names what it depends on and what it touches, runs on its own branch up to the session cap, and joins the plan only when its tests and the plan's touched clauses' tests pass."

### ADR in Docs
- Yes: `decisions/run-the-graph.md`. The root `CLAUDE.md` Key Decisions line is written by the first build phase with the code.

## References
- [brief.md](brief.md), [research.md](research.md), [test-plan.md](test-plan.md)
- `../run-the-master/master.md` (the later slices)
- `.indusk/planning/archive/` ADRs for sessions-per-plan and the build runner; `a-run-can-be-trusted`, `decisions-as-questions`
