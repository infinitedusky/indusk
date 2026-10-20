---
title: "Run the graph"
date: 2026-10-19
status: proposed
---

# Run the graph

## Goal

**Within one approved plan, every phase whose dependencies are done runs at once, each in its own worktree on its own branch, and joins the plan's branch only when green — so a plan finishes in the time of its longest chain, not the sum of its phases.**

Today the admin's build (`lib/build/runner.ts`, `runBuild`) runs a plan's phases one after another, one session at a time, in the plan's worktree. Two phases that need nothing from each other wait in line anyway.

**Rebuilt around the inventory (Sandy, 2026-10-19).** [research.md](research.md), section "Inventory: where the code assumes one phase at a time", lists every place the code assumes one phase at a time and ends with a seven-item smallest change set. This decision is exactly that set, plus what the brief's promises and clauses strictly require beyond it, plus `indusk run` refusing a plan the graph is running. Every entry the inventory marks as blocking is either changed by a named task or out of scope with a reason (the table under *Inventory, entry by entry*). Earlier versions are in this file's history (the full design at commit `0842d3fdf`, the first slice at `0a4d7a091`).

## Y-Statement

**In the context of:**
the admin's unattended build of one approved plan that is not a workbench plan, on one machine, under the machine's session cap.

**Facing:**
the need to start every phase whose dependencies have joined the plan, each in a worktree of its own, to bring each finished phase back into the plan's branch only with its tests and the plan's touched clauses' tests green, and to do it with the fewest changes to code that today assumes one phase at a time.

**We decided for:**
two label lines per phase (what it depends on, what files it touches) with a default chain; a pure scheduler; the graph as the build's `work` step inside the admin's existing build host, with one launcher; a session identified by its phase, told its one phase and held to it by the gate hook, which judges a phase by its dependencies; a `phase/<plan>/<kind>-<n>` branch and worktree per phase, cut from the plan's branch, set up like `indusk worktree create`'s, never assigned as the plan's, resumed rather than re-cut; a join that merges the plan's branch into the phase, combines the impl's lines, checks the result and fast-forwards the plan's branch; a run record that lists its phases.

**And against:**
phases sharing the plan's worktree; a scheduler process or store of its own; a second runner beside `runBuild`; a git merge driver for the impl; rewriting the admin's pages, the rituals, Dawn's loop or the workbench path in this slice.

**To achieve:**
a plan that takes the length of its longest chain, with every scheduling decision a unit test over plain inputs, and the rest of the system unchanged where it can stay so.

**Accepting:**
that a phase must declare its files to run beside another (an undeclared phase runs alone within its plan); that the graph runs only while the admin builds the plan, so an admin restart leaves the build stopped until Build is pressed again, and a terminal approval names the next session as today; that a question holds the whole plan; that the admin still shows one phase per build, and some existing signals and labels read one phase, until the later slices.

**Because:**
the brief's two promises are about what is running and what each branch holds at a moment; state read from files is what a person and the admin can read too, and a pure function over it is testable without a server or the wall clock (`lesson: code-that-decides-takes-its-clock-and-its-reads`). The inventory shows that only these places stop two phases from running and joining; everything else is a wrong label, a page, or a separate path.

## Context

The brief (accepted 2026-10-19, sliced the same day) makes two promises, `the-work-runs-as-a-graph` and `a-phase-builds-on-its-own-branch`, and changes `a-session-belongs-to-its-plan`. The test plan states each clause's signal and the ways it could fail.

What exists: `lib/build/` (`runBuild` asks `nextBuildStep` for the next step and runs each as one session through `runStepSession`, which takes a worktree), the admin's build host (`apps/indusk-admin/src/lib/build-host.ts`, `startBuild`, which admits one place under the cap per build and calls `holdQuestion` when the run stops on a question), `lib/session/manager.ts` (one session per plan and kind; `sessions.max`; an admitted build's sessions are exempt), `lib/run-record/` (one record per plan and kind with one process), `lib/plans/test-set.ts` (the tests a phase or a landing runs), `hooks/check-gates.js` (judges a tick against every phase earlier in the document), `lib/worktree/plan-worktree-commands.ts` (`createPlanWorktree`, assigned as the plan's live copy). Dawn's `indusk run` (`lib/run/`) runs a plan's phases in sequence outside the admin.

## Decision

### D1. A phase names its dependencies and files in two label lines

`**Depends on**: Build Phase 1, Build Phase 3` (or `none`) and `**Files**: apps/x/src/a.ts, apps/x/src/lib/**` sit under the phase heading and are parsed as `**Tier**:` is: outside fenced blocks, one per phase. A phase is named by its kind and number only — `Test Phase N` or `Build Phase N`, with `Phase N` meaning `Build Phase N` as a `### Phase N:` heading already does; the words after the colon are never part of the key, so the falsify skill's `### Phase 7: Falsification —` is `Build Phase 7`. A phase with no dependency line depends on the phase before it; the first depends on nothing; in an impl with a Test Phase 1 every build phase also depends on it. So every plan written before this runs as a chain, as today, and the review phases the rituals and the incident writer append (with no line) wait for the phase before them — the right order with no change to their writers.

A phase with no files line shares a file with every other phase of its plan. Only the plan's own `impl.md` is exempt from overlap: its ticks and result cells are joined line by line (D6). The changelog, `CLAUDE.md` files and docs pages are files like any other.

A line naming a phase that does not exist, the phase itself, or a loop is found when the graph is read (D2): the build stops naming it and launches nothing. Refusing it when the impl is saved is a later convenience.

The package reads the lines in one module (`lib/graph/declarations.ts`); the hooks, which cannot import TypeScript, read them through one shared hook module (`hooks/_phase-depends.js`), held equal by a parity test. The planner skill and the planning rules teach the two lines.

Rejected: a dependency table (a second place to keep equal to the headings); frontmatter (far from the phase); inferring dependencies from files (a phase can need another's type without sharing a file).

### D2. The graph is read from the plan's branch; a phase is done when it has joined it

`readGraph(planWorktree, plan)` reads the impl in the plan's worktree (on its branch) and returns a node per open phase with its dependencies, files, and any blocker or item a person must judge. A phase is **done** when it is closed there: its boxes are ticked there because its join brought them. A phase finished in its own worktree but not joined is not done. The graph admits a plan whose impl is `approved`, `in-progress`, or `completed` with an open phase, and never a draft. Falsification, Cleanup, Audit and Maintenance phases are nodes like any other; the steps that write them are not.

### D3. The scheduler is one pure function

`pickPhasesToStart({ graph, running, stopped, waitingOn, room })` returns the phases to launch and, for each phase it does not start, the reason: a dependency not done, a running phase of the plan sharing a file (named, with the file, or "undeclared"), the cap, the plan waiting on a question or an amendment, or a judgement or blocker the phase itself declares. Starts are chosen one at a time within a call, each joining the running set, so two phases freed together never both take one file. It reads nothing, has no clock and cannot stop a running phase.

### D4. The graph is the build's `work` step, inside the admin's build host

The admin's build stays the one runner, one run per plan. When `nextBuildStep` says `work` for a plan that is not a workbench plan, `runBuild` hands the step to the graph step (`lib/build/graph-run.ts`), which runs the plan's phases until none is open, ready, running or joining, then returns to the step loop. So the ritual steps (audit, falsify, cleanup, retrospective) still run one at a time as today, only once every phase has joined; a phase a step writes runs at the next `work` step. `startBuild`, its admission, `assertNoBuildSession` and the approve route stay as they are: there is still one build per plan.

**One launcher.** Every launch happens in one pass, single-flight per plan: a phase end, a join's result and a 30-second tick only ask for a pass; a request made while a pass runs becomes one more pass after it. Each pass reads the graph again before it launches. Joins run in their own queue, one at a time per plan, off the launch path, so a long check holds up no launch.

**A session works one phase.** The `work` prompt names the phase and tells the session to work only it and end when it is closed; the session's environment carries `INDUSK_BUILD_PHASE`, which the gate hook enforces (D9). A session started again after a failed join is told why. The work skill gains a short section for a session started for one phase: stay in your own worktree, read and tick the impl there, never create or assign a worktree, never update the plan's status; end by naming the next session as always — the build, not the session, starts what is next. The manual one-phase path and a workbench plan's build keep today's prompt.

**A person's stop still stops.** A ready phase with a declared judgement or blocker is not launched; the plan's other phases go on; when nothing more can run, the step returns the judgement (or `cannot-continue` naming the blocker) and the build stops on it as today. While an amendment waits, the pass launches nothing, running phases finish, and the step returns the amendment stop `nextBuildStep` gives today.

**A question holds the whole plan.** When a phase's session stops on a question that holds, the step launches nothing more, lets its running phases finish and join, and ends on the question, which the host holds as today. Before ending it reads whether the question has been answered meanwhile; if so it resumes the asking phase in the same run. `resumeAfterQuestion`, finding the plan's build running, releases the question and returns the running build instead of calling `startBuild`. A later answer starts the build again and the graph resumes the asking phase from its branch (D5). A question names the phase that asked it, its id is taken under the history lock, and only that phase's next session is told its answer.

**Where it runs.** Only inside the admin: the session manager that counts sessions against the cap lives there. Approving in the admin already starts the build; a terminal approval names the next session as today, and the person presses Build. A build the admin's restart ended reads stopped with its reason (`a-run-can-be-trusted`); pressing Build restarts it at its work step, and the graph resumes every launched phase from its branch. Resuming unasked is the later slice the brief calls "nothing stops". Dawn's `indusk run` refuses a plan whose build run record lists a live phase process.

**A workbench plan is not run by the graph.** The brief makes the promise for plans that are not workbench plans (Sandy, 2026-10-19): every phase session would edit the one impl at the workbench root. A workbench plan's `work` step runs one session as today.

### D5. A phase works in `phase/<plan>/<kind>-<n>`, in its own worktree, and resumes there

The branch is `phase/<plan>/test-<n>` or `phase/<plan>/build-<n>` — the two sequences number independently — and never `plan/<plan>/…` (git cannot hold a ref `plan/<plan>` and refs below it; `release-guard.sh`'s `plan/*` rule stays untouched). The worktree sits beside the plan's (`<project>-worktrees/<plan>--<kind>-<n>`). A phase starting for the first time is cut from the plan branch's tip, which holds every done dependency by D2. A phase started again resumes: an existing branch with its worktree is reused; an existing branch whose worktree was removed gets a worktree added from the branch; only a phase with no branch is cut. A phase worktree is never assigned as the plan's worktree, so every reader of the plan still reads the plan's own worktree and nothing reads as doubled.

A new phase worktree is set up by `provisionWorktree` — `.mcp.json`, the environment provisioning, and the install (the project's `post_create` steps when it declares them, else the install command its lockfile names) — and `createPlanWorktree` calls the same function, so the two are set up alike (measured 2026-10-19: create 0.8 s, install 7 s). A failed setup stops the phase, naming the command. After a phase joins, its worktree is removed in the background (measured 4.8 s) and its branch is kept until the plan lands.

### D6. A phase joins its plan by a checked fast-forward, one at a time

When a phase's session ends with its phase closed in its worktree, the join, one phase at a time per plan:
1. sends the phase back to its session if its worktree has uncommitted changes;
2. merges the plan's branch into the phase's branch; if `impl.md` is the only conflicted file, it is joined line by line: `git merge-file --diff3` over the three versions, and each conflict block whose base and both sides have the same number of lines takes, line by line, whichever side changed that line (both changing it the same way is fine). Ticks and result cells are in-place edits, so they always join. Any other conflict is aborted and sends the phase back, told the files;
3. runs the check on that commit in the phase's worktree, through a new `merge` scope of `planTestSet`: rows of this phase and of phases done on the plan's branch whose Passes-at phase is this one or a done one, the tests of every clause such a row names or whose `clause:` or `promise:` token appears in a file changed on the plan's branch since it left the trunk, and the Must-not-break promises' tests. The test runner's JSON report is written to machine state, named by the commit. A row whose Passes-at phase has not joined is red by design and is never in the must-pass set. **A test phase is judged by the test-phase rule:** its rows that pass at it must pass, and each row it writes for a later phase must run and fail on an assertion — a file that fails to load, or a row that already passes, refuses the join naming it. So Test Phase 1's red rows never block its join. A check that runs no test refuses the join as unchecked, and so does a clause the phase touches whose signal task is in neither this phase nor a done one;
4. in the plan's worktree, `git merge --ff-only phase/<plan>/<kind>-<n>`. If the plan's branch moved meanwhile, it repeats from step 2; if the plan's worktree has local changes, the phase stops, naming them.

A red check, a conflict or a dirty worktree is a failed attempt: the phase's session is started again in its worktree, told why. After the third the phase is stopped with its reason; its dependents wait, its plan's other phases go on, and once nothing more can run the build stops with `cannot-continue` naming it. Pressing Build again gives a stopped phase three fresh attempts.

Rejected: a git merge driver for `impl.md` (it needs git config in every clone and every project, and only the join merges a phase, so the join is the one place it is needed); moving the plan's branch with `update-ref` (leaves the plan's checked-out worktree stale); merging with no re-check (misses two green phases that break each other).

### D7. A session is identified by plan, kind and phase; every phase session counts; the run record lists phases

`a-session-belongs-to-its-plan` changes: only a second session of the same kind on the same phase is refused, naming the one running. A build's admission holds one place, which covers one of its sessions; each further phase session takes a place of its own, so the cap counts sessions, never builds. The build's run record keeps a `phases` list — each running phase and its process — and reads running while any listed process is alive; a record written before this still reads. The check that a held question freed its place judges the asking session alone.

### D8. One small record per plan in machine state

`graph/<plan>.jsonl` under the project's machine-state home (`indusk eval home`), appended by one never-raising writer: `run-started` (which resets attempts), `launched`, `ended`, `join` (outcome, commit, report path), `stopped`. The graph step counts attempts from it, and the first expectation is read from its launch and join times. A torn last line reads as absent.

### D9. The gate hook judges a phase by its dependencies, and holds a phase session to its phase

`check-gates.js` judges ticking a phase's items, and Gates A and B (rows due), against the phases it depends on, directly or through them — not every phase earlier in the document. With no dependency lines that set is every earlier phase (the default chain), so the hook refuses exactly as today, Dawn's probe included. `phaseOrdinal` stays the display order. When `INDUSK_BUILD_PHASE` names the session's phase, the hook also refuses ticking any item of another phase, naming the session's phase.

### D10. Signals are judged from what the deciding code does not read

Each split and limit clause gets a promise span written beside the code that decides it, in the build phase that writes that code, best-effort and never failing its caller. Each judges from plain git (the plan branch's and the phase branches' reflogs, `merge-base`, `worktree list`, `for-each-ref`), a plain scan of the impl, the session manager's sessions file, or the test runner's own report — never the deciding function, its inputs, or the record entries it wrote.

### D11. One live check, in the system tier

A real plan with two independent phases and a dependent third is built from the admin's build host with a scripted agent; it runs in `test:system` at landing and release, never in a phase's loop, and proves no clause. It is the real run the clause signals report from before the plan closes.

## Inventory, entry by entry

Every entry the inventory marks as blocking (it counts 38; its list holds 37 marked entries), with the task that changes it or the reason it is left. Tasks are named by their impl phase and their task line. Paths are under `apps/indusk-mcp/src/` unless they start with `apps/`, `hooks/`, `skills/` or `templates/`, which are under `apps/indusk-mcp/`.

| Inventory entry (blocking) | What it assumes | Changed by, or why not |
|---|---|---|
| `lib/build/next-step.ts:77-84` | the first open phase is the one to work; its judgement stops the build | Build Phase 1, "choose which ready phases start"; Build Phase 5, "keep a person's stop stopping the build". `nextBuildStep` still picks the step. |
| `lib/build/runner.ts:73-113` | one step's session runs to its end before the plan is read again | Build Phase 5, "run the work step as a graph" and "hand the build's work step to the graph". |
| `lib/build/runner.ts:97-104` with `build-session.ts:289-298` | a step is one session in the plan's worktree, with no phase | Build Phase 5, "run the work step as a graph" (a session per phase in its own worktree) and "tell each phase session its one phase". |
| `lib/build/build-session.ts:65` | the work prompt says to work the open phases in order | Build Phase 5, "tell each phase session its one phase". |
| `hooks/check-gates.js:533-588` | every earlier phase must be closed before a tick | Build Phase 1, "make the gate hook judge a phase against the phases it depends on". |
| `hooks/check-gates.js:495-529` (Gate B) | rows passing at any earlier phase must pass | Build Phase 1, same task. |
| `hooks/check-gates.js:444-493` (Gate A) | rows writable at any earlier phase must be written | Build Phase 1, same task. |
| `lib/impl-headings.ts:317-329`, `hooks/_impl-headings.js:175-185` | document order is the order work happens in | Build Phase 1, "read each phase's dependency and files lines" and the gate-hook task: the dependency relation is added and judged; `phaseOrdinal` stays the display order. |
| `lib/session/manager.ts:227-236` | a second session of one kind on one plan is refused | Build Phase 2, "identify a session by plan, kind and phase". |
| `lib/session/manager.ts:41-51, 305-309` | a session record has no phase | Build Phase 2, same task. |
| `apps/indusk-admin/src/lib/build-host.ts:70-80, 556-578` | one build state per plan; a second start is refused | Out of scope, no change needed: there is still one build run per plan, whose work step runs many phases (D4). |
| `build-host.ts:535-542` (`assertNoBuildSession`) | any build session refuses a start | Out of scope, no change needed: it guards a start, and while the graph runs the plan's build is already running, so the start is refused before it; phase sessions never go through a start. |
| `build-host.ts:101-126, 170-181` | the run record has one step, phase and process | Build Phase 2, "keep each running phase's process in the build's run record"; Build Phase 5, "host the graph step in the admin's build". |
| `build-host.ts:477-504` with `session-host.ts:99-117` | every step session runs in the plan's one worktree | Build Phase 5, "run the work step as a graph": the graph is read in the plan's worktree, each phase session runs in its own. |
| `build-host.ts:623` | one runner per plan | Out of scope, no change needed: one runner per plan is the design (D4). |
| `build-host.ts:632-634, 974-989` | a question's resume restarts the build, refused while it runs | Build Phase 5, "hold the whole plan on a question and resume the asking phase". |
| `apps/indusk-admin/src/app/api/sessions/route.ts:67-72, 97-102`, `app/api/plans/build/route.ts:35-38` | the page starts or attaches to one session per plan and kind; Build has no phase | Out of scope: Build stays one press per plan (D4); attaching the page to one phase's session among several is seeing the work, which the brief puts with `activity-and-graph`. Meanwhile the page attaches to one of them. |
| `apps/indusk-admin/src/app/api/plans/approve/route.ts:18-28, 65` | approval starts one sequential build | Out of scope, no change needed: approval starts the build, whose work step is now the graph. |
| `app/api/plans/[name]/question/route.ts:54`, `lib/question-answer.ts:61-95`, `decision/route.ts:85-90`, `lib/decisions.ts:120-137, 180-184` | an answer resumes "the plan's run" by name; a question has no phase | Out of scope beyond the resume: the whole plan is held in this slice, so resuming the plan's build is right; the asking phase is found from the question's phase (Build Phase 2, "give a question the phase that asked it"; Build Phase 5, the question task). |
| `lib/run-record/record.ts:26-41, 61-63` | one record per plan and kind with one process | Build Phase 2, "keep each running phase's process in the build's run record". |
| `.gitattributes` | `impl.md` has no merge driver, so two phases' ticks conflict | Build Phase 4, "merge the plan's branch into a finished phase": the join combines `impl.md` line by line in code (D6), with no driver. |
| `lib/worktree/plan-worktree-commands.ts:139-193`, `bin/commands/worktree.ts:160-190, 423-438` | the only way to make a worktree is the plan's own, from the trunk | Build Phase 3, "set up every new worktree through one function" and "cut a phase's branch and worktree from its plan's branch". |
| `plan-worktree-commands.ts:94-118`, `lib/worktree/plan-worktrees.ts:166-198` | a second live worktree for a plan is refused or reads doubled | Build Phase 3, "cut a phase's branch and worktree": a phase worktree is never assigned (D5), and the own-worktree signal checks the assignment. |
| `skills/work.md:34-35, 43` | work the checklist in order from the first unchecked item | Build Phase 5, "tell a session started for one phase how to work". |
| `skills/work.md:64, 107, 114` | closing tied to the next-numbered phase | Build Phase 5, same task. |
| `skills/work.md:76, 298`, `templates/planning/CLAUDE.md:177-184` | one boundary, one next session | Build Phase 5, same task: the session still names the next session (`a-plan-boundary-names-the-next-session`); the build starts what is ready. The template's sentence stays true. |
| `skills/work.md:98-99, 110`, `templates/planning/CLAUDE.md:154-156` | ticks and State cells in one table, one edit | Out of scope, no change needed in the text: Build Phase 4's join combines the table line by line, so the instruction stays right. |
| `skills/work.md:378, 385, 389` | "it does not run phases in parallel" | Build Phase 5, "tell a session started for one phase how to work". |
| `skills/work.md:395, 424-435` | one plan, one branch, one worktree | Build Phase 5, same task. |
| `skills/planner.md:208`, `templates/planning/CLAUDE.md:83-89` | phases are ordered by position | Build Phase 1, "teach the planner skill and the planning rules the two lines". |
| `apps/indusk-mcp/CLAUDE.md:89-93, 113-121, 178-183, 324` | the package rules state one live copy, one next step, one record, a total order, one session per owner | Build Phase 5, Context gate: the "Run the graph" section. |
| `lib/run/loop.ts:218-226` | Dawn walks phases in document order | Out of scope: Dawn's `indusk run` stays a one-phase-at-a-time runner and refuses a plan the graph is building (Build Phase 2, "make Dawn's run command refuse"); the graph never runs through it. |
| `lib/run/loop.ts:163-181, 248-250`, `bin/commands/run.ts:88, 109-112` | one Dawn run, one worktree | Out of scope, same reason. |
| `lib/run/loop.ts:269-275`, `lib/run/probe.ts:51-62, 89-108` | Dawn's probe needs every earlier phase closed | Out of scope, same reason; with no dependency lines the hook it asks is unchanged (D9). |
| `lib/run/loop.ts:323` | Dawn merges nothing | Out of scope, same reason. |
| `lib/run/gate.ts:91-106, 236-263, 279-302` | Dawn's edits go through the gate hook in one worktree | Out of scope, same reason. |
| `lib/run/cadences.ts:68-80` | Dawn's workbench cadence commits in one checkout | Out of scope, same reason; workbench plans are out of the slice too. |

**Count: 24 changed by a named task, 13 out of scope with a reason** (7 that need no change under one build run per plan, 6 that are Dawn's separate loop).

### Wrong and cosmetic entries handled here

Only those that would make a promise of this brief read false:

| Inventory entry | Promise it would make read false | Changed by |
|---|---|---|
| `lib/build/build-session.ts:42-47` (no phase in the environment) | `ready-phases-start` (a session works its launched phase) | Build Phase 5, "tell each phase session its one phase". |
| `build-session.ts:271-274` (the first session takes every answer) | `the-cost-sets-the-wait` (the answer resumes the asking phase) | Build Phase 2, "give a question the phase that asked it"; Build Phase 5, "tell each phase session its one phase". |
| `build-session.ts:276` (question id read outside the lock) | `the-cost-sets-the-wait` (two questions get one id; one is lost) | Build Phase 2, same task. |
| `build-session.ts:400-413` (freed-slot check sees a sibling's session) | `the-cost-sets-the-wait`, clause `a-hold-frees-the-slot` | Build Phase 5, "tell each phase session its one phase". |
| `lib/build/runner.ts:105-109` (a question ends the run while siblings run) | `the-cost-sets-the-wait`, `green-before-merging` (sibling ends unseen) | Build Phase 5, the question task. |
| `lib/session/manager.ts:109-117, 243-268` (an admitted build's sessions are exempt) | `sessions-are-capped`, `within-the-cap` | Build Phase 2, "count every phase session under the cap". |
| `lib/run-record/liveness.ts:29-41` (running iff the one process lives) | `ready-phases-start` (the admin offers Build again mid-run) | Build Phase 2, "keep each running phase's process in the build's run record". |
| `lib/run-record/restart.ts:36-42`, `build-host.ts:183-184, 231-238, 271-289, 579-598` (a dead build restarts at the first open phase) | `own-worktree` (a restarted phase re-cut) | No code change: a dead build restarts at its work step, and the graph resumes every launched phase from its branch (Build Phase 3, "cut a phase's branch and worktree … or resume"). |
| `lib/audit/inputs.ts`, `lib/build/review.ts`, `lib/cleanup/oversized.ts` (diff the plan's branch) | `reviews-are-phases` | No code change: ritual steps start only after the graph step returns with every phase joined (Build Phase 5, "hand the build's work step to the graph"), and the step signal checks it. |

### Wrong and cosmetic entries left for later

Each changes no promise of this brief; each is named so the later slices pick it up.

- **The admin's pages and labels show one phase per build** — `build-host.ts` `BuildState`/`buildView`/`runOfPlan`/`onStep`, `lib/active-phase.ts`, `ProgressLines`, `PhasesBar`, `PlanBar`, `PlanStatusCard`, `PlanParts`, `plan-parts-view.ts`, `planning-reader.ts`, `project-reader.ts`, `plan-situation.ts`, `decisions-reader.ts`, `decisions.ts`, `BuildControls`, `session-owner.ts`, `Worktrees.tsx`, `plan-actions.ts`, `phases.ts`, `apps/indusk-admin/CLAUDE.md`, and the package's `run-record/shown-phase.ts`, `situation.ts`, `plans/waiting.ts`, `tools/plan-tools.ts` (`advance_plan`). With `activity-and-graph`. Until then the `shows-where-it-is` and `dead-reads-stopped` signals of `a-run-is-read-from-its-record` (`run-record/situation-signals.ts`, `signals.ts`, `build-host.ts` 245-265, 338-344, 398-427) judge one phase and may read broken while two phases run.
- **Reads from the plan's one live copy** — `lib/build/read-plan.ts` (a tier escalation written in a phase worktree is seen only after its join), `lib/timing/view.ts` (overlapping phases; E1 is read from the graph record instead), `lib/timing/phase-close.ts`, `log.ts`, `test-run.ts`.
- **Wording that names one next phase** — `lib/models/next-session.ts`, `bin/commands/plans.ts` (`plans next`): a command is still named, as `a-plan-boundary-names-the-next-session` needs.
- **Rules that stay stricter than the graph** — `hooks/validate-impl-structure.js:898-935`, `lib/trajectory/validator.ts:262-298` (Writable ≤ Passes by position), `lib/plans/test-set.ts:57-84` (a row passing at a phase that does not depend on where it was written: that join is red and the phase stops naming the test — loud, never silent), `hooks/gate-reminder.js`, `hooks/validate-impl-structure.js:195-237`.
- **Amendments read in the phase's checkout** — `lib/plans/amendments.ts`, `check-gates.js:359-417`: the graph launches nothing while an amendment waits and the build stops once running phases finish (Build Phase 5); refusing ticks inside a running phase session needs the hook to read the plan's branch.
- **Already right under this design** — `lib/session/question-wait.ts` and `manager.ts:281-297` (the hold is taken after the run ends, when no phase session runs), `build-host.ts:599-607, 641-646` (one admission, released when the run ends after every phase), `build-host.ts:454-467` (release is refused while the build runs), `lib/shape/changed.ts` (a phase merges its plan in only at its join, after its Shape step), `lib/session/start.ts` (one trust write per worktree).
- **Landing housekeeping** — `lib/plans/land.ts` (refusing a plan with an unjoined phase, deleting phase branches), `lib/plans/plan-branch.ts`, `lib/worktree/plan-worktrees.ts:273-276` (phase worktrees listed as unassigned). Acceptance comes after review, which comes after every phase has joined.
- **The evaluator's one session** — `hooks/eval-trigger.js:404-412`, `lib/eval/persistent-evaluator.ts`.
- **Other skills and templates** — `skills/falsify.md`, `cleanup.md`, `audit.md`, `retrospective.md`, `verify.md`, `planner.md` (beyond the two lines), `catchup.md`, `claude-md.md`, `document.md`, `git.md`, `toolbelt.md`, `templates/workflows/refactor.md`, `templates/planning/CLAUDE.md` (beyond the two lines), `apps/indusk-mcp/CLAUDE.md` 160-168, 194-196, 234-235, 271-282, 317-321, 304-306, `hooks/CLAUDE.md:81-86`; `lib/promises/reopen.ts` (its Maintenance phase gets the default chain), `clause-signal.ts`, `mark.ts`; `lib/trajectory/state-ops.ts`, `audit.ts`, `lib/cleanup/gate.ts`, `lib/impl-parser-core.ts`.
- **Dawn and `indusk verify`** — `lib/run/loop.ts`, `probe.ts`, `pending-evals.ts`, `commit-cadence.ts`, `gate-question.ts`, `lib/verify/*`, `bin/commands/verify.ts`, and the two unrelated `bin/commands/run.ts` bugs the inventory found. `indusk run` refuses a plan the graph is building; the rest is Dawn's own path.
- **Workbench** — `lib/plans/plan-tests.ts:72-74, 94-95`: workbench plans are out of the slice.

## Alternatives Considered

### Phases share the plan's worktree with file locks
Rejected against `own-worktree`: two sessions in one working tree see each other's half-written files, and one phase's tests cannot be run on its state alone.

### A scheduler daemon with its own state
Rejected against `graph-is-current`: stored state can disagree with the impl. The graph step reads the plan's branch before every launch.

### A separate graph runner beside `runBuild`
Rejected: two runners for one plan would need a rule for which owns it, and the admission, stop, restart and question handling would need re-wiring. Making the graph the `work` step leaves them where they are — which is why seven of the blocking entries need no change.

## Consequences

### Positive
- A plan with independent phases takes the length of its longest chain.
- A plan written before this runs as a chain with no edit, now with each phase checked before it joins.
- Every scheduling decision is a pure function under unit test.

### Negative
- Parallelism depends on the author's files lines; an undeclared phase runs alone within its plan.
- Each join runs the plan's touched clause tests, which grows with the plan.
- Each phase worktree runs an install (about 7 s) and is removed after (about 5 s, in the background).
- A question anywhere in the plan holds the whole plan until answered.
- The admin still shows one phase per build until `activity-and-graph`, and two existing signals may read broken while two phases run.

### Risks
- **Two phases interfere without sharing a declared file.** The join runs the joined result's tests and sends the second back; the cost is one phase's rework, not an unseen break.
- **A missed session end strands a ready phase.** The 30-second tick bounds it, and the `ready-phases-start` tick span reports it.
- **Something moves the plan's branch during a run.** `--ff-only` refuses to join over it, `indusk run` refuses the plan, and the `green-before-merging` tick span reports the move.

## Open Decisions

- **The tick is 30 seconds and a constant**, well inside the promised minute. Reversible by moving it beside `sessions.max`.
- **Three attempts, on the phase's own tier.** A stopped phase raises no question in this slice; per-phase questions come with the holds slice.
- **Effort in the tier** (`research.md`'s proposed shape) has no promise in the brief and stays out.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/phases-in-parallel.md` — what runs together, the two lines, why a phase waits, a phase's branch, what a join does, what a stopped phase means.
- Update: `reference/skills/planner.md` (the two lines), `decisions/sessions-per-plan.md` (one session per plan, kind and phase), `reference/cli/worktree.md` (phase worktrees), `reference/skills/work.md` (a session started for one phase).

### Diagrams
- A Mermaid graph of the brief's six-phase plan, and a sequence of a join (merge the plan in, check, fast-forward, or back to the session), in the guide page.

### Changelog
- "A plan's phases now run in parallel: each names what it depends on and what it touches, runs on its own branch up to the session cap, and joins the plan only when its tests and the plan's touched clauses' tests pass."

### Who writes what
- Build Phases 1, 2 and 3 run side by side, so each writes only its own reference page. Build Phase 4 starts the guide page with the join. Build Phase 5, which depends on every other phase, finishes the guide, publishes this decision, writes the changelog entry, the package's `CLAUDE.md` "Run the graph" section and the root Key Decisions line.

### ADR in Docs
- Yes: `decisions/run-the-graph.md`, written by Build Phase 5.

## References
- [brief.md](brief.md), [research.md](research.md) (the inventory), [test-plan.md](test-plan.md)
- `../run-the-master/master.md` (the later slices)
- `.indusk/planning/archive/` ADRs for sessions-per-plan and the build runner; `a-run-can-be-trusted`, `decisions-as-questions`
