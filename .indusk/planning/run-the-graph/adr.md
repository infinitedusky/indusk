---
title: "Run the graph"
date: 2026-10-19
status: proposed
---

# Run the graph

## Goal

**An approved plan's phases run as a graph: each phase starts the moment what it needs is finished and no running phase holds its files, so a master takes the time of its longest chain, not the sum of its phases.**

Today the build runner (`lib/build/runner.ts`) runs a plan's phases one after another in one worktree, and the person starts each with the command the last one named. Two phases that need nothing from each other wait in line anyway, and two plans that never meet are still run by hand, one at a time.

## Y-Statement

**In the context of:**
turning an approved plan's phases, and the phases of several plans at once, into a set of parallel sessions on one machine, each on its own branch, up to the machine's session cap.

**Facing:**
the need to decide, from a graph of phases, a list of running sessions and a clock, which phase starts next, to merge phase branches into plan branches and plan branches onto a moving trunk without a person, and to keep a held or failed phase from stopping anything it does not block.

**We decided for:**
a pure scheduler function that takes the graph, the running sessions, the cap and the clock and returns the phases to start; dependencies and files declared as label lines on each phase in the impl (`**Depends on**:`, `**Files**:`); one worktree and one `phase/<plan>/<n>` branch per running phase cut from the plan's branch; a merge into the plan's branch made only by compare-and-swap after the merged result's tests pass; scheduler state derived on every read from the impl files and an append-only runner record in machine state, never kept in memory.

**And against:**
a scheduler with its own stored state or database; phases sharing one plan worktree; a global lock per plan instead of per-file holds; a dependency graph inferred from code rather than declared; interrupting a running phase to make room; branches named `plan/<name>/phase-N`.

**To achieve:**
a master that finishes in about the time of its longest dependent chain, merges that rarely need a person, and a runner whose every decision is a unit test over plain inputs.

**Accepting:**
that phases must declare their files to be parallel (an undeclared phase is serialised against its plan), that the scheduler is only as good as the impl's cut into phases, that a stopped phase costs its dependents their wait, and that a conflict an agent cannot resolve costs a person's attention.

**Because:**
the brief's promises are all about what is running and what each branch holds at a moment; state derived from files and a record is the same thing a person and the admin can read, and a pure function over that state is testable without a server, a daemon or the wall clock (`lesson: code-that-decides-takes-its-clock-and-its-reads`).

## Context

The brief (`brief.md`, accepted 2026-10-19) makes six promises: `the-work-runs-as-a-graph`, `a-phase-builds-on-its-own-branch`, `earlier-plans-go-first`, `trunk-cascades`, `landing-follows-what-it-pulled` and `a-hold-is-cheap`. The test plan (`test-plan.md`, the clause plan, rows A1 to A113) states a signal and a table of assertions for every clause, written against behaviour and leaving three things to this document: the spelling of the dependency line, what a failed merge check leads to, and how "touching a clause" is read. Two further choices the test plan made on its own (a phase with no declared files, where live checks run) are confirmed or changed here.

What exists: `lib/build/` (the per-plan runner and `next-step.ts`, which decides one next step), `lib/session/` (the session manager; `limits.ts` reads the machine cap `sessions.max`, default 4, the `sessions-are-capped` promise), `lib/worktree/` (plan worktree layout and records), `lib/plans/` (`land.ts`, `bring-trunk.ts`, `test-set.ts`, `plan-tests.ts`, amendments), `lib/models/tiers.ts` (a phase's `**Tier**:` line, parsed outside fenced blocks), and the `order_plans` tool that reads the plan tree.

## Decision

### D1. Dependencies are a label line on the phase: `**Depends on**: Build Phase 1, Build Phase 3`

A phase's dependencies are written as a `**Depends on**:` line under its heading, parsed exactly as `**Tier**:` is (outside fenced blocks, one line per phase, a second line is an error). The value is a comma-separated list of phase headings as the impl writes them, or `none` for a phase that starts at once. A phase with no line depends on the phase before it in the impl, so every plan written before this one runs as a chain, as it does today (rows for `a-phase-names-what-it-needs`, and A101, the regression guard that a cap of one gives today's order). An unknown phase name, a dependency on itself and a cycle are refused when the impl is written, naming the phases.

Test Phase 1 stays first: in an impl that has one, every build phase depends on Test Phase 1 whatever its line says, so `none` means "no other build phase", never "before the register" (the test-phase-structure decision: Test Phase 1 is mandatory and first). The reader adds the edge; the author never writes it.

Rejected: a table in the impl (a second place to keep equal to the headings); a front-matter map (far from the phase it describes, and it drifts when phases are renamed); a naming convention such as `Phase 2a` (cannot say "needs 2 and 3"); inferring dependencies from the files phases touch (a phase may need another's output without sharing a file, such as a type or a schema).

### D2. Files are a label line: `**Files**:`, repo-qualified in a workbench

A phase lists the files and directories it writes as `**Files**: apps/indusk-mcp/src/lib/run/**, apps/docs/guide/x.md`, globs allowed. In a workbench the path is prefixed `repo:`. Two phases *conflict* when their sets overlap. The impl author writes the line when the phase is cut, listing the sources it edits and the test files it writes. A changed file outside the declared set is never refused: no promise names such a refusal, and the manual `/work` path must stay as it is (A102). The phase's `merge` entry lists the changed files outside its declaration so the line can be widened, and the merge check (D6) is the backstop for what a declaration missed.

Shared gate files are not declared and never overlap: the plan's own documents under `.indusk/planning/<plan>/`, the changelog, the `CLAUDE.md` rules files and the docs pages a phase's Context and Document gates edit. Parallel phases editing one of them meet at the merge into the plan: `impl.md` checkboxes and State cells are merged by the scripted tick-union (D6); any other conflict there goes to the resolver like any conflict (D9).

A phase with no `**Files**:` line is treated as touching every file its own plan's phases declare, so it is serialised against all of its plan's other phases and conflicts across plans only on declared files. This confirms the test plan's note (A13): an unknown set cannot be shown free, and treating it as empty lets collisions pass unseen; it costs parallelism only where a phase did not say what it touches. Rejected: empty-set (silent collisions); touching every file in the repo (would serialise unrelated plans on a missing line).

### D3. The scheduler is one pure function

`lib/run/graph/schedule.ts` exports `pickPhasesToStart({ graph, running, held, cap, now })` returning the phases to launch, in order. It reads nothing and starts nothing. `running` and `held` name a phase by plan and phase (`{ plan, phase }`), never by phase name alone, since two plans each have a `Build Phase 1`; `readGraph` derives `held` from the record's `held` and `released` entries, and that path is tested end to end. The graph is built by `lib/run/graph/read-graph.ts` from the approved plans' impls, every open Maintenance phase of an archived plan (D4), `order_plans` for the plan order, the runner record for what is done and held, and the sessions registry for what runs. A phase is *ready* when every dependency is done (D4 adds edges), its plan is approved, it is not held and not running; a ready phase *starts* if its files do not overlap a running phase's, the cap has room, and no earlier-ranked ready phase wants an overlapping file. Rank is: fix phases first (D7), then plan order (D8), then position in the impl. The same function serves `ready-phases-start`, `no-needless-wait`, `within-the-cap` and `earliest-next`, so each is one place under test.

The graph is read again, never cached, when a phase ends, a plan is approved, a plan lands (`graph-is-current`), and on a 60-second tick as the fallback that guarantees the "launched within one minute" clause even if an event is missed. Starting the session is a thin driver in `lib/build/` (beside `build-session.ts`) that calls the function and the session manager; setting up the phase's worktree is part of the phase's own time.

**The driver runs only inside the admin.** The session manager keeps its running sessions and admitted places in memory, so only the one admin-hosted manager can count them against the cap, and a session launched by a CLI process would die with it. The admin's build host hosts the driver and both ticks (60 seconds for readiness, five minutes for the trunk, D8). `indusk plans approve` and `indusk plans land` never launch a session: each asks the running admin to read the graph, as `plans accept-brief` asks it to plan (`lib/plans/ask-admin.ts`), and says plainly when the admin is not running or the project is not registered. When the admin starts, its first tick reports every phase ready since before it started, with its gap, through the `ready-phases-start` signal, so time with no driver is seen, not silent.

**The ritual steps are not started by the driver.** Once a plan's phases are all done, the existing step loop (`next-step.ts`, `runBuild`) runs the audit, falsify, cleanup and retrospective steps one at a time as today; it starts a step only while none of the plan's phases is ready, running or held, so a retrospective never lands a plan while a phase a ritual just authored is unscheduled. The phases those steps write are graph nodes (D4).

Rejected: a long-lived scheduler process holding the graph in memory (state that must be rebuilt after a crash and can disagree with the files); event-only triggering (one missed event strands a ready phase until the next, and the clause promises a minute); a tick-only loop with a short interval (needless reads; events make the common case immediate).

### D4. Reviews are phases; a fix gets virtual edges; nothing is written into the impl for either

The phases `/falsify` and `/cleanup` author, a phase the audit's answers add to the impl (an Audit phase), and an incident's Maintenance phase are ordinary phases and carry explicit `**Depends on**:` and `**Files**:` lines (`reviews-are-phases`); the falsify, cleanup and audit steps and the incident writer write phases and are not phases themselves. The ritual skills are updated to write both lines.

The Maintenance-phase writer is `lib/promises/reopen.ts`. It writes `**Depends on**: none` (a fix waits on no unrelated unfinished phase of its owner; Test Phase 1 is done in any approved owner) and `**Files**:` from the paths the broken promise's `sites:` declare. An owner under `.indusk/planning/archive/` has no plan branch, since landing deleted it: its open Maintenance phase still enters the graph, and at its start a branch `plan/<owner>` is cut from the trunk for that fix, so it is worked and lands as any plan's branch does (the planning rules already work a reopened plan with `indusk worktree create <plan>`).

A fix phase (a Maintenance phase for an open incident) adds a *virtual* edge, computed when the graph is read, from itself to every not-yet-started phase of any plan whose files overlap the fix's. The edge is not written to any impl, so it disappears with the incident. A running phase that overlaps is not delayed: it merges the fix's branch before it merges into its plan (D6).

Rejected: writing the edges into the impls (edits plans the author did not touch, and leaves residue when the incident closes); a global "stop the world" flag for fixes (violates "nothing stops").

### D5. A phase works in `phase/<plan>/<n>`, in its own worktree, cut from the plan's branch

The branch is `phase/<plan>/<n>`, not `plan/<plan>/phase-<n>`: git cannot hold both a ref `plan/<plan>` and refs below it, since a ref is a file and the second needs it to be a directory. The worktree sits in the plan's worktree layout (`lib/worktree/layout.ts`), one per running phase. On start the worktree is cut from the plan's branch tip and every finished dependency's branch is merged in; a phase that waited on another plan's phase for a file also merges that phase's finished branch, landed or not (`starts-from-the-work-it-waited-for`). Merging at start is fast-forward when the plan's branch already holds the dependency, which is the normal case after D6. When the plan's branch is behind the trunk (the cascade skipped it because a phase was running, D8), the start also merges the trunk into the new worktree, so a phase started after a landing always starts with the landed work (A17). Every start merge goes through the resolver (D9).

### D6. A phase merges into the plan by compare-and-swap, after its merged result is green

At its end a phase (1) merges the trunk (D9), (2) merges the plan branch tip, plus any open fix branch overlapping its files, into its own branch, (3) runs the check on that result, and (4) moves the plan branch to the phase's head with `git update-ref <ref> <new> <old>`, which fails if the plan branch moved meanwhile. A failed swap repeats from step 2. No lock is needed: two phases finishing together serialise at the swap, and the second one's check runs on a result that already holds the first. This is what catches two phases that break something only together (`green-before-merging`).

The check is the phase's own tests plus the tests of every clause the plan's branch has touched, with *touched* read two ways and unioned: a clause named in the `For` cell of any trajectory row of a phase already merged into the plan or of this phase, and a clause whose `promise:` token appears in a file changed on the plan branch since it left the trunk. Reading both fails towards more tests rather than fewer, and uses the existing selection in `lib/plans/test-set.ts`, which gains two scopes (touched clauses; built so far, only rows whose State is written) and a `For` field on `TestSetRow`; the real selection is tested against a real fixture plan, not injected. A conflict confined to `impl.md` checkboxes and State cells is resolved by a scripted union of ticks, kept only when step 3's check is green, and recorded as a conflict resolved by script, counted apart from agent resolutions so the second expectation reads both. A phase whose check ran no test never merges, and a phase touching a clause must carry that clause's signal row (`every-phase-is-checked`), enforced by the same check by refusing an empty test set.

A red check is a failed attempt under the existing struggling-phase rule (`a-struggling-phase-asks-for-a-stronger-model`): the phase is kept, listed as stopped with the failing tests, and retried by the agent on the next tier after three attempts; it does not start a repair of its own and does not stop phases that do not need it. This is the test plan's open decision (A37), decided here. Only a phase on its third failed attempt becomes a question, which is a hold (D11).

Only a plan's branch reaches the trunk, through `indusk plans land` once its promises are verified; no code path pushes `phase/*` to the trunk, and the landing refuses a ref under `phase/` (`only-the-plan-lands`).

Rejected: a merge lock per plan (serialises the check, which is the slow part, and blocks on a crashed holder); merging phase branches into the plan with no re-check (misses interference between two green phases); the merge check running only the changed files' tests (misses the clause tests the brief names).

### D7. Plan order is `order_plans`; a fix phase is its own priority class

The rank of a plan is whatever `order_plans` returns (the root master through each parent's ordered children; unplaced plans after, earlier approval first), called once per read of the graph. A phase of an open-incident Maintenance plan ranks above every non-fix phase whatever its plan's place, and takes the next free session (`a-broken-promise-jumps-the-line`). No new ordering rule is written.

### D8. The trunk cascades from landing, with a five-minute fallback

`indusk plans land` ends by calling the cascade for every other open plan, using `bring-trunk.ts` (the existing merge of the trunk into a plan branch). A plan branch with a running phase is skipped, since that phase merges the trunk itself when it ends (D6 step 1). A 5-minute tick finds any plan branch behind the trunk with no running phase and merges it, so a missed event still meets `branches-follow-the-trunk`; the tick is the driver's, hosted by the admin (D3), and a test pins that the host starts it. A phase started while its plan's branch was skipped merges the trunk at its start (D5). The trunk is the branch the project's main checkout is on, per repo in a workbench.

Landing (`landPlan`, `landWorkbenchPlan`) refuses a plan with a running or held phase, naming them, since it deletes the plan's branch and worktree; and its own merge of the trunk into the plan's branch always goes through the resolver (D9), whether or not the plan pulled work.

### D9. A conflict goes to an agent first, then becomes a question

A conflicting merge (phase start, phase end, trunk cascade, pre-landing) is handed to an agent in the merging worktree. The result is kept only if the plan's tests pass; otherwise the merge is aborted, and a question naming the conflicting files is raised, and only the plan's phases not yet running whose declared files overlap those files, and the phases that depend on them, go on hold (`agent-resolves-first`). A running phase among them is never stopped (`running-phases-finish`): it finishes and is held at its merge, its merge into the plan waiting until the question is answered. Every merge appends to the runner record whether it conflicted and whether an agent resolved it with tests passing, which is how the second expectation (merges rarely need a person) is read.

### D10. A plan that pulled unlanded work records it and lands after it

When D5 merges another plan's unlanded phase branch into a phase, the runner record stores `pulled: {plan, branch, sha}` for the pulling plan. `indusk plans land` refuses a plan with a `pulled` entry whose source plan has not landed, naming that plan; once it has, the plan merges the trunk again before landing (`lands-after`, `merges-again-before-landing`). The entry is cleared when that plan lands.

### D11. A hold is a state in the record, and it frees files at once

`held: {plan, phase, reason, since}` is appended to the runner record. A held phase is excluded from `running` when file holds are computed (`a-hold-frees-its-files`), so phases waiting only for its files start; phases that depend on it stay unready. Its worktree and branch are kept. When the hold is lifted the phase catches up itself: it waits for any active phase it now depends on, merges what finished meanwhile that touches its files, and continues (`the-held-phase-catches-up`). A running phase is never stopped to make room: the scheduler has no stop operation (`running-phases-finish`, `never-interrupted`).

Three triggers put a phase on hold, all built: a question that holds (`decisions-as-questions`, landed), an amendment stop (`brief-as-the-contract`), and a conflict an agent cannot resolve (D9, only for phases not yet running). A question that holds holds its own phase, not its whole plan: this plan changes `SessionManager.holdQuestion` and `releaseQuestion`, and build admission (`buildKey`), to key by project, plan and phase, so one phase's question frees only that phase's place and files and the plan's other phases keep theirs. Answering the question releases that phase (`releasePhase`), which then catches up. `decisions-as-questions`' own slot rule (`the-cost-sets-the-wait`, a held question frees its slot) keeps holding, per phase; its tests are a regression guard here.

A running phase is held only by its own session's stop: its question that holds, or an amendment stop. A `held` entry for a phase whose session the runner ended for any other reason is a broken `running-phases-finish`.

### D12. State lives where it is read: files plus one append-only record

There is no scheduler store. The graph comes from impl files and `order_plans`; what is running comes from the sessions registry; what is done, held, pulled and merged comes from `runner.jsonl` in machine state (`indusk eval home` directory), written by one never-raising appender modelled on the plan-timing writer. Every reader (the scheduler, landing, the admin's later graph view in `activity-and-graph`) reads the same record. A missing or torn last line reads as absent, never as an error.

The admin's run record (`lib/run-record/record.ts`, today one file per plan and kind with one phase and one process) becomes one record per running phase: a build run's path is keyed by plan, kind and phase, so two phase sessions of one plan never overwrite each other, and the admin's liveness, status and Restart read each phase's own record (`a-run-is-read-from-its-record` keeps its sentence: every run the admin starts keeps a record).

### D13. The session rule is relaxed, not removed

`a-session-belongs-to-its-plan` changes: a session is identified by plan, kind and phase. A plan's second session of a different kind or on a different phase starts; only a second session of the same kind on the same phase is refused, naming the one running. The cap is unchanged and is checked by the scheduler before it asks the session manager, which still enforces it. Admission (`admitBuild`, `buildKey`) and question holds are keyed by project, plan and phase, so every phase session takes its own place under the cap and none is exempted by its plan's admitted build.

### D14. Live checks run in the system tier

Seven of the eight live checks of the test plan (A9, A30, A39, A58, A64, A84, A95) run in `test:system` at landing and by `indusk release`, never in a phase's loop (`lesson: feedback-slow-at-release-fast-per-phase`). Everything else is a unit test over the pure function with an injected clock and real throwaway git repositories, with no server or daemon. A live check proves no clause, since it cannot run before the plan closes; each clause is proved by its unit rows, and its signal is a promise span written beside the code that decides it, in the phase that builds that code (one `writeClauseSignals` call per decision, best-effort, judged from a source the deciding code does not read: not its function, not its inputs, not the record entries it wrote itself — plain git, the session manager's sessions file, the test runner's own report, the incident files, a plain scan of the impl). `within-the-cap` gets a signal too: at each launch the driver reads the session manager's own held sessions against `sessions.max`.

The live checks use a scripted agent, except the conflict check (A74), which needs a real agent to mean anything: it runs in `pnpm e2e` (which already needs `claude`), with a real resolver session started through the session manager.

## Alternatives Considered

### One shared plan worktree with file locks between phases
Rejected against `own-worktree` and `starts-from-its-dependencies`: two sessions editing one working tree see each other's half-written files, and the plan's tests cannot be run on one phase's state alone.

### A scheduler daemon with its own state
Rejected against `graph-is-current`: stored state can disagree with the impl on disk. The design reads the files on each decision (D3, D12) and has nothing to reconcile.

### Phases declare only dependencies; files are discovered at run time
Rejected against `no-needless-wait`: a running phase's files are known only after it has written them, too late to avoid starting a colliding phase. The cost of declaring is one line per phase; the merge check (D6) is the backstop for what a declaration misses.

### Stop or pause a running phase for a fix, an earlier plan or another merge's conflict
Rejected against `running-phases-finish`: the brief's rule is that nothing stops; a conflict elsewhere holds a running phase only at its merge (D9). A fix takes the next free session and edges to unstarted phases (D4), and running phases merge it before they merge into their plan.

### A lock on the plan branch while a phase's check runs
Rejected against `green-before-merging`: it serialises the slowest step and leaves a stale lock when a runner dies. Compare-and-swap (D6) gives the same safety with a retry.

### Putting model and effort in the tier now
The research proposes that a tier name a model and a reasoning level so a runner-started session never inherits whatever effort its launcher had. Not taken here; see Open Decisions.

## Consequences

### Positive
- A master takes the length of its longest chain, and an idle session slot is used by any ready phase of any plan.
- Every decision of the runner is a pure function over plain inputs, tested without a server.
- A plan written before this runs as a chain with no edit.
- The admin's later graph view reads the same record and files the runner does.

### Negative
- Parallelism depends on the author's `**Files**:` lines; an undeclared phase is serialised with its plan.
- A merge check that runs the clause tests of everything the plan has touched grows with the plan; the slow tier does not absorb it.
- A stopped phase delays its dependents until it is retried or answered.

### Risks
- **Two phases interfere without sharing a file and a declaration misses it.** The merge at the plan's branch (D6) runs both phases' results together and catches it there; the cost is one phase's rework, not an unseen break.
- **A missed event leaves a ready phase unstarted.** The 60-second tick (D3) bounds it to a minute; the tick's first run on a stranded graph is a unit test.
- **The agent's conflict resolution is wrong though tests pass.** Tests are the keep-rule the brief names; the record of every conflict is reviewed at the retrospective and read as the second expectation.
- **`git update-ref` compare-and-swap is skipped by a future caller.** One function does the swap and a single-definition test pins that nothing else moves a plan branch from a phase.

## Open Decisions

Each is decided for now and recorded with its reason; the person reviewing the build can overturn any.

- **Effort in the tier is not part of this plan.** `research.md`'s proposed shape (a tier names a model and a level) has no promise in the accepted brief and no row in the test plan, so building it would add behaviour no promise names. Reason: the brief is the contract, and adding to it is an amendment. It stays recorded in research for a later brief change. Until then the runner starts each session on the tier's model as `plans model` prints it, and the effort is the launcher's, as today.
- **A phase's own effort in its `**Tier**:` line, workflow agents reading the tier, effort in the build record** (the three open questions in `research.md`): all three belong to the item above and wait with it.
- **The tick intervals (60 seconds for readiness, 5 minutes for the trunk) are constants, not config.** Reason: they are the numbers the brief states; making them settings invites an untested range. Reversible by moving them to `~/.indusk/config.json` beside `sessions.max`.
- **A red merge check retries by the existing three-attempt rule rather than raising a question at once** (D6). Reason: reuses `a-struggling-phase-asks-for-a-stronger-model` instead of a second failure policy. If three attempts proves slow in practice, lower it there, for all phases.

## Documentation Plan

### Pages
- New: `reference/cli/run-the-graph.md` (what the runner starts and in what order, the `**Depends on**:` and `**Files**:` lines, the runner record).
- Update: `reference/skills/planner.md` (the two label lines when cutting phases small around shared types and schemas), `reference/skills/work.md` (the phase's worktree and merge-at-end), `reference/skills/falsify.md` and `cleanup.md` (they write `**Depends on**:`).
- Update: `guide/parallel-plans.md`, a short page for a person: what runs together and why a phase waits.

### Diagrams
- A Mermaid dependency graph of a six-phase plan (stories 1 and 2 of the brief) in `reference/cli/run-the-graph.md`, showing ready, running and waiting phases.
- A sequence diagram of a phase's end: merge trunk, merge plan tip, check, compare-and-swap, in the same page.

### Changelog
- "Plans' phases now run as a graph: phases declare what they depend on and what they touch, run in parallel on their own branches up to the session cap, earlier plans first."

### ADR in Docs
- Yes: publish as `decisions/run-the-graph.md`. The root `CLAUDE.md` Key Decisions line (`- Run the graph: … — see /decisions/run-the-graph`) is written by the impl's first build phase with the code, since `plans approve` refuses a branch that changed anything outside `.indusk/` before its build.

## References
- [brief.md](brief.md), [research.md](research.md), [test-plan.md](test-plan.md)
- `../run-the-master/master.md` and `../promise-core/master.md` ("Phases are units of work", "Earlier plans go first", "Phases branch off the plan")
- `.indusk/planning/archive/` ADRs for sessions-per-plan, plan-timing and the build runner
- Depends on `../plans-are-promises/`, `../mark-first/`; blocks `../decisions-as-questions/`, `../activity-and-graph/`
