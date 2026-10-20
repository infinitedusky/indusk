---
title: "Run the graph — Research"
date: 2026-10-16
status: in-progress
workflow: feature
---

# Run the graph — Research

A start, not the whole background: this plan had no research document until a
conversation on 2026-10-16 produced one decision that belongs to its runner.
The brief's own background is in [brief.md](brief.md) and `promise-core`'s
master ("Phases are units of work", "Earlier plans go first", "Phases branch
off the plan"). More is written here as the planning conversation continues.

## Question

When the runner starts a phase's session, what decides how that session
thinks — its model and how hard it reasons — and where is that decided?

## Background

Today a phase is built by an agent on the model its tier names. The tier comes
from the phase's own `**Tier**:` line in the impl, else the step's default
tier in `.indusk/config.json`; the tier's model comes from `workflow.tiers`
(for this project: `strong` is opus, `med` is sonnet, `weak` and `baby` are
haiku; steps `plan` and `falsify` default to `strong`, `work` and `cleanup` to
`med`, `retrospective` to `weak`). `indusk plans model <plan> --phase "Build
Phase N"` prints `<tier> <model>` (`apps/indusk-mcp/src/lib/models/phase-model.ts`,
`lib/models/tiers.ts`), the `/work` skill hands the phase to an agent on that
model, and a phase that fails three times names the next tier up
(`nextTier`; promises `each-phase-runs-on-its-model`, `a-model-override-says-why`
and `a-struggling-phase-asks-for-a-stronger-model`).

Nothing in that chain mentions how hard the session reasons. A model's
reasoning effort is a separate setting (the agent tool and the workflow script
both accept an `effort` of low, medium, high, xhigh or max; left out, it is the
spawning session's), so a phase on `strong` runs at whatever effort the session
that launched it happened to be at. Seen on 2026-10-16: three batches of
background agents in one day ran on three different models and, by the same
rule, whatever effort each launch inherited, with nobody having chosen either.

## Findings

### Model and effort are one decision, not two

A tier is one word a person can read. A strong model at low effort and a weak
model at high effort are both defensible and pull in different directions, so
exposing both as free settings doubles the ways two runs can differ. The
alternative is to make effort part of the tier: a tier names a model and a
level, for example `strong` is opus at extra high, `med` is sonnet at high,
`weak` is haiku at medium — the pair printed by `indusk plans model` and
passed together when a session is started. Which tier gets which level is
Sandy's to set.

### The runner is where it is applied

`run-the-graph` is the part that starts each phase's session once its
dependencies are done and its files are free (the brief's
`ready-phases-start`). A phase already declares what it depends on and what it
touches; the tier is the third thing it declares for the same decision — how
to run it — and the runner reads all three when it launches the session. A
phase that fails and moves up a tier moves up in effort too, through the same
`nextTier`. Everything that starts a phase's session through the runner
passes the tier's model and effort; the manual `/work` path reads the same
answer from `plans model`.

### What changes in the package

The pair is carried by `lib/models/tiers.ts` and `phase-model.ts`, the config
schema (`workflow.tiers` entries become a model and a level), the `/work`
skill's "Running a Phase on Its Model" section, and the build runner's step
model (`lib/build/step-model.ts`). A single-definition test pins it, as for
the other single-definition rules in `apps/indusk-mcp/CLAUDE.md`. The agent
tool's own rule is to set an effort only when instructions ask for one; a
config that declares a level per tier is such an instruction.

## Proposed shape (not decided)

A promise beside `the-work-runs-as-a-graph`: every phase's session starts on
the model and effort its tier names, with two clauses — a split that the
session is launched with both (`ready-phases-start` extended by one argument),
and a limit that no path starts a phase's session without them, so a run's
model and effort never depend on who launched it. It shares code with the
runner (`lib/build/`, `lib/models/`), so it belongs in this plan, not its own.
It would cost one config change for existing projects: a tier given as a bare
model keeps working and means the session's own effort, as today.

## Decisions

- **Settled (Sandy, 2026-10-16):** the decision about how a phase's session
  thinks belongs with the run-the-master analysis of every phase, "where we're
  already doing analysis to figure out order of operations for every phase" —
  here, not a plan of its own.
- **Not yet decided:** that effort is part of the tier (the shape above) rather
  than its own axis; which level each tier gets.

## Open Questions

- Whether a phase may name its own effort in its `**Tier**:` line with a
  reason, as it may name its own tier, or only a tier.
- Whether a workflow's agents read the tier too, so that a script never picks
  an effort by hand.
- Whether the effort belongs in the phase's record (`indusk plans model`'s
  output and the build record) so a review can see what a phase ran on.

## Sources

- `apps/indusk-mcp/src/lib/models/{tiers,phase-model,tier-names}.ts`,
  `lib/build/step-model.ts`; `.indusk/config.json` `workflow.tiers` and
  `workflow.steps`
- `apps/indusk-mcp/skills/work.md`, "Running a Phase on Its Model"
- `.indusk/promises/each-phase-runs-on-its-model.md`,
  `a-model-override-says-why.md`, `a-struggling-phase-asks-for-a-stronger-model.md`
- `../run-the-master/master.md` and `../promise-core/master.md` ("Phases are
  units of work")

## Inventory: where the code assumes one phase at a time (2026-10-19)

Four rounds of planning kept running into places where the system quietly
assumes a plan's phases run one after another, in one session, in one
worktree, in document order. This is the list of those places, read from the
code (not from the design), so the next impl can name what it changes and what
it leaves. Each entry says where (absolute path from the repo root, line
numbers as of commit `0a4d7a091`), what it assumes in one sentence, what breaks
when two phases of one plan run at once in two worktrees on two branches, what
it would need to become (one sentence, no design), the tests that pin today's
behaviour, and a severity:

- **BLOCKS** — two phases cannot run at once, or running them corrupts the plan.
- **WRONG** — they run, but a record, a decision, a signal or a page is wrong.
- **COSMETIC** — wording, a label, or a guess that only misleads.

**Counts:** 38 BLOCKS, 58 WRONG, 14 COSMETIC — 110 entries. An entry bundles
the places that share one assumption (an admin page and the function it draws
from, a skill line and the template line that repeats it), so the count of
places is higher; every place is named by file and line inside its entry.

Three facts shape the whole list:

1. **`impl.md` is one file per checkout with no merge driver** (`.gitattributes`
   declares `merge=union` for `current.md`, `phase-boundary.jsonl`, the verify
   ledger and the highlights files, and nothing for `impl.md`). Every phase
   ticks boxes and rewrites State cells in it, so two phase branches touching
   adjacent lines conflict when they join the plan's branch. Most of the
   "two sessions edit the same document" entries below reduce to this one.
2. **What lives in the trunk or in machine state is already shared and locked:**
   `current.md` and `.indusk/plan-history/<plan>.md` are written to the main
   checkout under one lock (`apps/indusk-mcp/src/lib/bookkeeping/notes.ts:67`,
   `lib/plans/history.ts:75-88`); run records, the timing log, the eval queue
   and the slow-run record are under `indusk eval home`. Phase worktrees do not
   fragment these.
3. **Every reader of "the plan" reads one copy** — `livePlanCopy` resolves the
   plan's single assigned worktree (`lib/worktree/plan-worktrees.ts:280-290`).
   A phase worktree's ticks are invisible to the admin, the plan tools, the
   model lookup and the timing view until they merge. This is by design for
   the plan's branch (ADR D2) and wrong for anything that must see a running
   phase.

### 1. The build loop (`apps/indusk-mcp/src/lib/build/`) — the runner itself

- **BLOCKS** `lib/build/next-step.ts:77-84` — assumes the first open phase in
  document order is the one to work, and its `blocker:` or judgement item stops
  the build. Two at once: the runner never names a second phase, and a
  judgement on the first open phase stops phases that do not need it. Becomes:
  a decision over the set of open phases. Pinned by `next-step.test.ts` "stops
  at a blocker on the open phase, quoting it" and `runner.test.ts` "stops at a
  declared judgement without running a session for it".
- **BLOCKS** `lib/build/runner.ts:73-113` — assumes one step's session runs to
  its end before the plan is read again (`await deps.run(...)`, then `read()`),
  and progress is one fingerprint of the whole plan ("two steps in a row made
  no progress", `next-step.ts:63-65`). Two at once: nothing runs two sessions;
  a sibling's merge reads as this step's progress. Becomes: a work step that
  launches several sessions and returns when none is open, ready or running.
  Pinned by `runner.test.ts` "runs work, falsify, work, cleanup, work, then
  stops at review" and "stops when two steps in a row change nothing".
- **BLOCKS** `lib/build/runner.ts:97-104` with `lib/build/build-session.ts:289-298`
  — assumes a step is one session started with `cwd: opts.worktree` (the plan's
  worktree), `kind: "build"`, `plan`, no phase. Two at once: both sessions share
  one working tree and branch, and the manager refuses the second (§3).
  Becomes: a session per phase in that phase's worktree, identified by its
  phase. Pinned by `build-session.test.ts` "A30 — runs as a build session in
  the worktree, under the build's gate policy".
- **BLOCKS** `lib/build/build-session.ts:65` — the `work` prompt says "Work the
  plan's open phases in order until every one is closed". Two at once: a
  session told this works every open phase it can see in its worktree,
  including its siblings'. Becomes: a prompt naming one phase and ending when
  it is closed. No test pins the wording.
- **WRONG** `lib/build/build-session.ts:42-47` — `stepEnv` carries
  `INDUSK_BUILD_STEP` and the gate policy, no phase. Two at once: no hook can
  tell which phase a session owns, so nothing refuses it ticking a sibling's
  items. Becomes: the environment names the phase. Pinned by
  `build-session.test.ts` "A35 — work, falsify and cleanup run marked as build
  steps, under the auto gate policy".
- **WRONG** `lib/build/build-session.ts:271-274, 293` — every untold answered
  question of the plan is marked told and put in this session's prompt
  (`answersNote(told)`). Two at once: the first session to start takes the
  answers meant for the other phase. Becomes: answers routed to the phase that
  asked. Pinned by `build-session.test.ts` "the answers given while it was
  stopped are told to the next session, once".
- **WRONG** `lib/build/build-session.ts:276` — the question id is
  `nextQuestionId(worktree, plan)`, read outside the history lock, written
  later under it. Two at once: two sessions of one plan asking together can
  both get `q-7`. Becomes: an id taken under the lock. Pinned by
  `questions/history.test.ts` "T14 — every question stays, in every state"
  (one writer).
- **WRONG** `lib/build/build-session.ts:400-413` — the `a-hold-frees-the-slot`
  signal reads upheld only when `forPlan(project, plan, "build")` is undefined
  after a question. Two at once: a sibling's live session makes every hold
  read broken. Becomes: judged on the asking session alone. Pinned by
  `session/question-wait.test.ts` "T7/T8 — a held question stops the session
  and frees its slot".
- **WRONG** `lib/build/runner.ts:105-109` — a step that returns `waiting` ends
  the run as `{ step: "question" }`. Two at once: one phase's question ends the
  run while sibling sessions are still going, so their ends are never seen
  (the admin frees the build's place in its `.finally`, §4). Becomes: the run
  lets running phases finish before it ends on the question (ADR D7 says so).
  Pinned by `runner.test.ts` "stops on a question that holds, naming it,
  without reading progress or trying again".
- **WRONG** `lib/build/read-plan.ts:43-48, 68` — the build reads the impl from
  `livePlanCopy`, the plan's one worktree. Through it `indusk plans next`,
  `plans next-session`, `plans model` and `buildStepModel`
  (`lib/models/phase-model.ts:15`) answer from the plan's worktree, never a
  phase's. Two at once: a `**Tier**:` escalation or a blocker written in a
  phase worktree is unseen. Becomes: a read that takes the worktree to read
  from. Pinned by `step-model.test.ts` "A14 — a work step runs on its phase's
  own tier" and `__tests__/plan-worktrees-tools.test.ts` "get_plan_status
  reads the worktree's checkoffs and names the worktree".
- **WRONG** `lib/models/next-session.ts:47-50` — the boundary line names one
  next command, "next is `<first open phase>`" (promise
  `a-plan-boundary-names-the-next-session`, Must-not-break in the brief). Two
  at once: when a phase closes, zero, one or several phases may be ready; one
  line names one. Becomes: a line that names every phase now ready, or the
  runner that starts them. Pinned by `next-session.test.ts` "with Build Phase 1
  closed and Build Phase 2 open, names /work and Build Phase 2's tier". The
  same single step is printed by `bin/commands/plans.ts` (`plans next`).

### 2. The gate hooks (`apps/indusk-mcp/hooks/`) — what refuses a checkoff

- **BLOCKS** `hooks/check-gates.js:533-588` — assumes every phase earlier in the
  document than the item being ticked has its required gates complete
  ("complete Build Phase 1 gates first"), compared by `ordinal`. Two at once:
  in Build Phase 3's worktree, Build Phase 2 (a sibling, open on another
  branch) has unchecked gates, so every implementation tick in phase 3 is
  refused. Becomes: judged against the phases this phase depends on. Pinned by
  `__tests__/hook-cwd-independence.test.ts` "A1: the registered check-gates
  command refuses a Gate B checkoff from a subdirectory exactly as from the
  root", `__tests__/gate-policy-env.test.ts` "a skip that gives its reason lets
  the next phase start, over the plan's own ask", `__tests__/build-session-gates.test.ts`
  "a skip with its reason lets the next phase's checkoff land".
- **BLOCKS** `hooks/check-gates.js:495-529` — Gate B: every trajectory row whose
  `Passes at` ordinal is earlier than the advancing phase must be passing,
  skipped or blocked. Two at once: a sibling's rows are `written` or `planned`
  in this worktree's copy (they pass only on the sibling's branch), so the
  phase cannot advance. Becomes: rows of the phase's dependencies only. Pinned
  by the same A1 test and `trajectory/state-ops.test.ts` "T17: check-gates
  blocks phase close when Passes at tests not passing".
- **BLOCKS** `hooks/check-gates.js:444-493` — Gate A: every row `Writable at` an
  ordinal at or before the advancing phase must be at least `written`. Two at
  once: a row writable in an independent earlier-numbered sibling (state
  `planned` here) blocks this phase. Becomes: rows writable in this phase or its
  dependencies. Pinned by `__tests__/gate-a.test.ts`.
- **BLOCKS** `apps/indusk-mcp/src/lib/impl-headings.ts:317-329` and its hook
  copy `hooks/_impl-headings.js:175-185` — `phaseOrdinal`: "Document order is
  the only thing that orders them, because it is the order the work actually
  happens in." Every rule above, the temporal-coherence rule and Dawn's probe
  compare on it. Two at once: the order the work happens in is the graph, not
  the document. Becomes: an ordinal for display and a dependency relation for
  judging. Pinned by `__tests__/impl-headings.test.ts` and
  `__tests__/phase-kinds.test.ts`.
- **WRONG** `hooks/gate-reminder.js:87-98` — when a phase becomes fully checked
  and `phases[i + 1]` has nothing checked, tells the agent to call
  `advance_plan` and author the next document phase's rows. Two at once: the
  nudge points a session at a phase that is not its own and may be running
  elsewhere. Becomes: a nudge about the session's phase and the phases it
  frees. Advisory only. Pinned by `__tests__/gate-reminder-speaks.test.ts` and
  `__tests__/phase-start-nudge-single-definition.test.ts`.
- **WRONG** `hooks/validate-impl-structure.js:898-935` and
  `lib/trajectory/validator.ts:262-298` — temporal coherence: `Writable at`
  must not be later in the document than `Passes at`. Two at once: a row
  written in a later-numbered independent phase and passing in an
  earlier-numbered one is refused though the graph allows it; and the rule
  cannot say that the Passes-at phase must depend on the Writable-at phase,
  which is the constraint that matters (a test written on a branch that the
  passing phase does not merge is absent there). Becomes: `Passes at` depends
  on `Writable at`. Pinned by `validator.test.ts` "T8: validateTemporalCoherence
  rejects Writable at > Passes at".
- **COSMETIC** `hooks/validate-impl-structure.js:195-237` — the contract check
  runs `indusk promises contract` in the checkout being edited, against that
  checkout's `.indusk/promises/`. Two at once: a promise changed on the plan's
  branch by a sibling's merge is unseen until this phase merges the plan in.
  Becomes: the same, read after a merge. Pinned by `__tests__/promises-check.test.ts`.

### 3. Sessions (`apps/indusk-mcp/src/lib/session/`)

- **BLOCKS** `lib/session/manager.ts:227-236` — `refusalFor`: a second session
  of the same kind on the same plan is refused, "A build session is already
  running on this plan". Two at once: the second phase session cannot start.
  Becomes: refused only for the same plan, kind and phase (the brief's change
  to `a-session-belongs-to-its-plan`). Pinned by `manager.test.ts` "a second
  planning session on the same plan is refused, naming the first
  (sessions-per-plan A2)" and "A14 — an admitted build never gets past the
  same-plan rule".
- **BLOCKS** `lib/session/manager.ts:41-51, 305-309` — a `SessionRecord` is
  project, plan, kind; `forPlan` returns the first match. Two at once: nothing
  can name, stop, attach to or answer one phase's session rather than another's.
  Becomes: the record carries the phase. Pinned by `manager.test.ts` "a started
  session is recorded with its pid, project, plan and kind".
- **WRONG** `lib/session/manager.ts:109-117, 243-268` — `builds` is keyed
  `project\0plan`; `admitBuild` takes one place; `capRefusal` exempts every
  build session of an admitted build. Two at once: N phase sessions of one
  build count as one place, so `sessions.max` (promise `sessions-are-capped`,
  Must-not-break) is not kept. Becomes: each phase session takes a place, the
  admission covering one. Pinned by `manager.test.ts` "A14 — an admitted
  build's step starts though other plans filled the cap since" and "A15 — with
  one build admitted and no step running, the cap of 2 admits one more session,
  not two".
- **WRONG** `lib/session/manager.ts:281-297` with `lib/session/question-wait.ts:19-32`
  — `holdQuestion` and `releaseQuestion` are keyed by plan and drop the build's
  key. Two at once: the hold is whole-plan (the brief accepts that in this
  slice), but the build's still-running sibling sessions lose their admission
  mid-run and count as unadmitted. Becomes: a hold that keeps running sessions
  admitted until they end. Pinned by `question-wait.test.ts` "T8 — the manager
  lets a queued plan take the place a held question freed".
- **COSMETIC** `lib/session/start.ts:104` with `lib/session/trust.ts` — each new
  worktree path is trusted like its project, once. Two at once: one trust
  write per phase worktree; harmless. Pinned by `session/trust.test.ts`.

### 4. The admin's build host and pages (`apps/indusk-admin/src/`)

The host keys everything on `project/plan`: the in-memory build, the run
record, the cap place, the session, the question hold and the worktree. The run
it starts is `runBuild` (§1). Paths are under `apps/indusk-admin/src/`.

- **BLOCKS** `lib/build-host.ts:70-80, 556-578` — one `BuildState` per plan;
  `startBuild` throws "`<plan>` is already building" (A96). Two at once: a
  second phase's run cannot start, or overwrites the first's state. Becomes:
  one run per plan whose work step fans out (ADR D4), or state per phase.
  Pinned by `lib/build-host.record.test.ts` "A96 while it is still finding its
  worktree it reads running, and a second press is refused" and "A12 a run held
  by this daemon is still refused as already building".
- **BLOCKS** `lib/build-host.ts:535-542` (called at 560, 684, 843) —
  `assertNoBuildSession` refuses any start while `forPlan(project, plan,
  "build")` finds a session. Two at once: phase A's live session refuses phase
  B's start. Becomes: refuses only a session of the same phase. Pinned by
  `lib/build-host.test.ts` "T21 refuses a build start and a planning start,
  naming the session".
- **BLOCKS** `lib/build-host.ts:101-126, 170-181` — the run record is
  `startRunRecord(plan, kind)` with one `step`, `phase`, `process`. Two at
  once: two phase sessions write one file and clobber each other's process and
  stop. Becomes: a `phases` list on the record (ADR D7). Pinned by
  `lib/build-host.record.test.ts` "A1 a build, a planning run and a release
  each have a record naming plan, kind and process" and "A3 a build reads the
  same from its record alone while its step session lives".
- **BLOCKS** `lib/build-host.ts:477-504` with `lib/session-host.ts:99-117` —
  `planLocation` gives the plan's one worktree (`livePlanCopy`), and every step
  session runs there with no phase. Two at once: both phases edit and commit in
  one checkout. Becomes: the phase's own worktree. Pinned by
  `__tests__/http-plan-worktrees.test.ts` A1/A2 and `lib/decisions.test.ts`
  "A16 with no session running, one is started for the plan in its worktree".
- **BLOCKS** `lib/build-host.ts:623` — `void runBuild({...deps})`: one package
  runner per plan. Two at once: see §1. Pinned by `lib/build-host.record.test.ts`
  "A56 an approved plan's build runs to its stop at review".
- **BLOCKS** `lib/build-host.ts:632-634, 974-989` — a question holds the plan
  (`holdQuestion(project, plan)`), and `resumeAfterQuestion` releases and calls
  `startBuild` again. Two at once: the resume is refused "already building"
  while a sibling runs, and when it does start it restarts whatever
  `nextBuildStep` picks, not the asking phase. Becomes: a resume addressed to
  the asking phase inside a running build (ADR D7). Pinned by
  `lib/question-answer.test.ts` "a held question is recorded and the run starts
  again" and "T32 — a restart refused at the session limit keeps the answer and
  says why".
- **BLOCKS** `app/api/sessions/route.ts:67-72, 97-102` and
  `app/api/plans/build/route.ts:35-38` — a session start is `forPlan(project,
  plan, kind)` (attach to the one running, or refuse); Build is one POST with
  no phase. Two at once: the page cannot start or attach to a second phase's
  session. Becomes: session identity and the build route carry the phase.
  Pinned by `app/api/sessions/route.test.ts` "asks whether to continue it here
  when a page is already showing it" and `__tests__/sessions-per-plan.test.ts`
  "A12 the refusal says this plan has one, asks to continue it here, and hands
  back its id".
- **BLOCKS** `app/api/plans/approve/route.ts:18-28, 65` — approval starts one
  build in the plan's worktree. Two at once: the sequential runner starts, not
  every ready phase. Becomes: unchanged if the work step fans out; else per
  phase. Pinned by `app/api/plans/approve/route.test.ts` "A8 starts the build
  after the approval returned, in that order".
- **BLOCKS** `app/api/plans/[name]/question/route.ts:54`, `lib/question-answer.ts:61-95`,
  `app/api/plans/[name]/decision/route.ts:85-90`, `lib/decisions.ts:120-137, 180-184`
  — an answer resumes "the plan's run" by plan name; the question record has no
  phase. Two at once: an answer cannot reach the phase that asked. Becomes: a
  resume addressed by question id to its phase. Pinned by
  `lib/question-answer.test.ts` "T29 — an answer to a question whose session
  has gone is recorded and starts the run again".
- **WRONG** `lib/build-host.ts:599-607, 641-646` — `admitBuild(project, plan)`
  takes one place, and `.finally` sets `running = false` and frees it when the
  runner returns. Two at once: N sessions under one place; the first return
  marks the plan idle while siblings run. Becomes: a place per phase session;
  idle when the last ends. Pinned by `__tests__/sessions-per-plan.test.ts` "A14
  startBuild with the machine at its cap throws the cap's refusal and starts no
  build" and `lib/build-host.test.ts` "A11 holds one place for the run it
  started, not released by a refused second ask".
- **WRONG** `lib/build-host.ts:59-68, 297-336, 361-396, 519-529` —
  `BuildState` has one `step`/`detail`/`stop`; `buildState`, `buildView`
  (`shownPhase` plus the `shows-where-it-is` signal comparing one shown phase
  with one `build.detail`), `runOfPlan` and `onStep` all carry one phase. Two at
  once: interleaved updates overwrite each other; the signal raises false
  breaks whenever the session's phase is not the first open one. Becomes: a
  line per running phase through one function (ADR D7). Pinned by
  `lib/build-host.record.test.ts` A3 (`detail: "Build Phase 2: second"`).
- **WRONG** `lib/build-host.ts:183-184, 231-238, 271-289, 393-396, 579-598` —
  the newest record is the plan's state; a dead run restarts at `restartStep`,
  the document-order next step. Two at once: after a restart only one phase's
  state is recovered, and a dead phase is relaunched as "the plan's next step".
  Becomes: resume every launched phase with a branch (ADR D4/D5). Pinned by
  `lib/build-host.record.test.ts` "A74 a planning run that died is started
  again at its next planning step" and "A12 a build whose process is gone reads
  stopped, saying so, and is not refused".
- **WRONG** `lib/build-host.ts:454-467, 677-695` — `classifierFor` reads the
  plan's `nextBuildStep` to say why a step stopped; `startRelease` is gated on
  the one `buildState().running`. Two at once: a blocker in phase A classifies
  phase B's stop; release can start while a phase is unmerged. Becomes: per
  phase; release gated on every phase merged. Pinned by
  `lib/build-host.release.test.ts` "A37 a second accept while the release runs
  is refused, and starts no second release".
- **WRONG** `lib/active-phase.ts:8-15, 32-61`, `components/bars/ProgressLines.tsx:21-27`,
  `lib/plan-parts-view.ts:74-105`, `app/p/[project]/plan/[name]/page.tsx:190-191, 255`,
  `components/plan/PlanParts.tsx:135-151`, `components/plan/PlanStatusCard.tsx:72-88`
  — one active phase: the newest boundary record among open phases, else the
  first open in document order. Two at once: one running phase is marked, the
  other reads "not started"; "Phase N of M" names one. Becomes: a set of
  active phases. Pinned by `lib/active-phase.test.ts` "the most recent boundary
  record among open phases wins" and "with no records the first open phase in
  document order is active, and says it guessed"; `lib/plan-parts-view.test.ts`
  "names the current phase and the items done of all".
- **WRONG** `lib/planning-reader.ts:186-187, 403-406, 494-525` and
  `lib/project-reader.ts:19-32` — the plan is read from one live copy, and
  boundary records from that one root. Two at once: ticks and openings written
  in phase worktrees are invisible; the active phase falls back to a guess.
  Becomes: the plan branch plus each running phase's copy. Pinned by
  `__tests__/http-plan-worktrees.test.ts` "A1 — an item checked off in the
  assigned worktree shows as done on the next refresh" and "A4 — the active
  phase is the one opened in the worktree".
- **WRONG** `lib/plan-situation.ts:47-61, 108-124` — `liveOf` and the situation
  sentence come from one newest run and one `shownPhase` (read at the trunk
  path). Two at once: a stopped sibling as the newest record reads "not
  building" while another runs. Becomes: any live phase; all running phases
  named. No admin test; the package's `run-record/situation.test.ts`.
- **WRONG** `lib/decisions-reader.ts:52-55`, `app/api/plans/[name]/decision/route.ts:75`,
  `app/p/[project]/plan/[name]/page.tsx:68-70` — `planWaiting` gets one build
  stop per plan and the page shows `readWaiting(...)[0]`. Two at once: a second
  phase's question card never shows. Becomes: a decision per waiting phase.
  Pinned by `lib/decisions-reader.planning.test.ts` A13 and `lib/decisions.test.ts` A22.
- **WRONG** `lib/decisions.ts:51-56, 212-238, 272-289` — "the plan's agent" is
  `forPlan(planning) ?? forPlan(plan)`; a reply with no session starts one in
  the plan's worktree. Two at once: words go to an arbitrary phase session, or
  land in the wrong worktree. Becomes: addressed to the phase's session.
  Pinned by `lib/decisions.test.ts` "A16 with a session running for the plan,
  the words are said to it".
- **WRONG** `components/session/BuildControls.tsx:18-62, 115-145`,
  `app/api/plans/build/route.ts:15-19`, `app/api/sessions/route.ts:29-32`,
  `lib/session-owner.ts:15-36` — one build state, one "Running: step — phase",
  one `SessionConnector`, one session id per plan and kind. Two at once: the
  page shows and attaches to one phase's session. Becomes: per-phase controls
  and a phase in the session URL. Pinned by `lib/session-owner.test.ts` "a
  build's session belongs to the build controls, never the planning ones".
- **COSMETIC** `lib/build-host.ts:245-265, 338-344, 398-427`,
  `lib/plan-situation.ts:182-204` — the dead-reads-stopped and in-progress
  signals judge one newest record and one `heldHere` per plan. Two at once:
  the signal judges the wrong phase's record. Becomes: per phase.
- **COSMETIC** `components/bars/ProgressLines.tsx:45-87` (the hint "the active
  phase is the first open one in document order"), `components/bars/PhasesBar.tsx:7-47`,
  `components/bars/PlanBar.tsx:26-56`, `components/plan/PlanStatusCard.tsx:80-88`,
  `components/session/BuildControls.tsx:104-113` ("Works the phases, then
  falsification and cleanup"), `lib/plan-actions.ts:39-52`,
  `components/Worktrees.tsx:23-29` (one worktree per plan; phase worktrees would
  list as unassigned), `lib/phases.ts:151, 197-213` (rituals come after the
  build phases by position). Wording and one-active-segment drawing. Pinned by
  `components/bars/PhasesBar.test.tsx` "one segment per phase in order; closed
  full, active partial and named, later empty".
- **COSMETIC** `apps/indusk-admin/CLAUDE.md:36-39, 62-68, 114-117, 273-279, 305-306`
  — the rules that state the above ("one worktree", "the active phase is the
  most recent boundary record among open phases", "one `SessionManager` holds a
  session per plan and kind", "the controls name the phase `shownPhase` reads").
  Rewritten with the code.

### 5. Run records, situation and what a plan waits on (`apps/indusk-mcp/src/lib/`)

- **BLOCKS** `lib/run-record/record.ts:26-41, 61-63` — one record per plan and
  kind, with one `step`, `phase` and `process`. Two at once: see §4. Becomes: a
  `phases` list; a record without one still reads (ADR D7). Pinned by
  `run-record/record.test.ts` "A6 — records are per plan and kind" and "A1 — a
  started run leaves a record naming plan, kind, step, phase and process".
- **WRONG** `lib/run-record/liveness.ts:29-41` — running iff the one recorded
  process is alive, or this daemon holds it. Two at once: once the recorded
  session ends and a sibling still runs, the plan reads stopped (and Build is
  offered again). Becomes: running while any listed process lives. Pinned by
  `run-record/liveness.test.ts` "A9 alive, the right program, the recorded
  start: running, minutes after the run began" and "A7 a run with no process
  recorded and nothing holding it reads stopped the same way".
- **WRONG** `lib/run-record/shown-phase.ts:30-31` — the phase shown is the first
  open phase. Two at once: the page names one phase, often not the one a given
  session works. Becomes: every running phase. Pinned by
  `run-record/shown-phase.test.ts` "A14 a build started at Test Phase 1 that
  has closed three phases shows the fourth".
- **WRONG** `lib/run-record/situation.ts:192-197, 210-222` — "Building —
  `<phase>`", "Stopped — … at `<phase>`": one phase in the sentence. Becomes:
  all running phases. Pinned by `run-record/situation.test.ts` "A66 building
  names the phase the plan is on".
- **WRONG** `lib/run-record/restart.ts:36-42` — a dead build restarts at
  `nextBuildStep`, the first open phase. Becomes: resume every launched phase.
  Pinned by `run-record/restart.test.ts` "A11 a build that died in the second
  phase restarts there".
- **WRONG** `lib/run-record/situation-signals.ts:65-78` and
  `lib/run-record/signals.ts:89-106` — `shows-where-it-is` compares one shown
  phase with one session phase; `dead-reads-stopped` judges one
  `record.process`. Two at once: false breaks and the wrong process judged.
  Becomes: per running phase. Pinned by `run-record/situation-signals.test.ts`
  "is upheld when the phase shown is the phase the live session works, broken
  naming both when not" and `run-record/signals.test.ts`.
- **WRONG** `lib/plans/waiting.ts:143-169, 178-243` — "at most one thing per
  plan"; `askedOf` takes the first session with a question, `heldQuestion` the
  first waiting record. Two at once: a second phase's question is hidden until
  the first is answered. Becomes: one wait per phase (the brief keeps a
  whole-plan hold, so this is display, not scheduling). Pinned by
  `plans/waiting.test.ts` "A13 a plan waiting on nothing is absent, and each
  plan appears at most once" and "A13 a question outranks the plan's own
  approval: one decision per plan".
- **WRONG** `lib/questions/record.ts:34-61` — a `Question` carries `plan` and
  `session`, no phase. Two at once: an answer cannot be routed to the asking
  phase (§4). Becomes: the question names its phase. Pinned by
  `questions/history.test.ts` "T14 — every question stays, in every state".
- **WRONG** `src/tools/plan-tools.ts:213-238` — `advance_plan` names the first
  incomplete phase, "phase N → phase N+1", and finds it by number alone
  (`phases.find((p) => p.number === …)`). Two at once: the tool answers about a
  phase the caller is not working. Becomes: asked about a named phase. Pinned
  by `__tests__/plan-worktrees-tools.test.ts` "advance_plan no longer lists an
  item checked off in the worktree".

### 6. Worktrees, branches and landing (`lib/worktree/`, `lib/plans/`)

- **BLOCKS** `.gitattributes` (repo root) — `impl.md` has no merge driver. Two
  at once: every phase ticks boxes and rewrites State cells in one file, so two
  phase branches touching adjacent lines conflict when they join the plan's
  branch, and a merge made with no session to resolve it fails. Becomes: a
  line-by-line merge of ticks and cells (ADR D6) or a serialised join. Pinned
  by `shape/boundary.test.ts` "T24 — this repo declares merge=union for the
  boundary record" (the attributes file, not `impl.md`).
- **BLOCKS** `lib/worktree/plan-worktree-commands.ts:139-193` with
  `bin/commands/worktree.ts:160-190, 423-438` — the only way to make a plan's
  worktree: `<project>-worktrees/<plan>` on `plan/<plan>` cut from the trunk
  branch, `.mcp.json` copied (`provisionMcpJson`, line 189), then assigned; in
  a normal-mode project the install is left to the person ("Install the
  project's dependencies there"), and `post_create` runs only in a workbench.
  Two at once: nothing makes a worktree cut from the plan's branch, provisioned
  and installed, for a phase. Becomes: one provisioning function both paths
  call (ADR D5). Pinned by `__tests__/plan-worktrees-cli.test.ts` "A8 —
  `worktree create <plan>` in a normal repo creates plan/<plan> and the plan
  reads from it", `__tests__/worktree-post-create.test.ts`,
  `__tests__/mcp-config-worktree.test.ts`.
- **BLOCKS** `lib/worktree/plan-worktree-commands.ts:94-118` and
  `lib/worktree/plan-worktrees.ts:166-198` — `assignPlan` refuses a second live
  worktree for a plan; two live assignments read as `doubled` and every reader
  falls back to the trunk copy. Two at once: a phase worktree must never be
  assigned, or every plan tool and the admin read the trunk. Becomes: phase
  worktrees known to the resolver without being the plan's live copy. Pinned
  by `__tests__/plan-worktrees-cli.test.ts` "A10 — a second live assignment
  for the same plan is refused naming both, and nothing changes" and
  `__tests__/plan-worktrees-tools.test.ts` "get_plan_status reports both
  worktrees and picks neither".
- **WRONG** `lib/plans/land.ts:78-114` — landing checks only the plan's
  worktree is clean (`refuseDirtyWorktree`, line 79), merges the trunk in, runs
  the clause tests and `land_checks` there, merges to the trunk, removes the
  plan's worktree and deletes `plan/<plan>`. Two at once: a phase still running
  or unmerged is not seen, so a plan can land without its work
  (`only-the-plan-lands`), and phase branches and worktrees are left behind.
  Becomes: refuse while a phase runs or is unmerged; remove phase branches at
  landing (ADR D6). Pinned by `plans/land-own-worktree.test.ts` "a CLI
  installed from anywhere else lands" and `__tests__/plan-worktrees-skills.test.ts`
  "the retrospective's landing step releases between the merge and the worktree
  removal".
- **WRONG** `lib/plans/plan-branch.ts:54-82` — `planBranch` is the plan's one
  assigned worktree and branch, and every `plans` verb (approve, accept, land,
  reapprove, audit-inputs, review) acts there. Two at once: none can see or
  refuse on a phase branch. Becomes: the same, plus a reader of the plan's
  phase branches. Pinned by `__tests__/plan-worktrees-cli.test.ts` A8/A12.
- **WRONG** `lib/worktree/plan-worktrees.ts:273-276` — worktrees with no
  assignment are listed as `unassigned`. Two at once: every phase worktree
  shows in the admin as an unassigned worktree, and `indusk agent list` flags
  sessions in them. Becomes: a phase worktree listed under its plan. Pinned by
  `__tests__/plan-worktrees-tools.test.ts` "an unassigned hand-made worktree
  changes nothing about the trunk's answer" and the admin's
  `__tests__/http-plan-worktrees.test.ts` "A15 — a worktree with no assignment
  is listed as unassigned".
- **WRONG** `lib/audit/inputs.ts:160-173`, `lib/build/review.ts:117-121, 205-210`,
  `lib/cleanup/oversized.ts:133-143` — the audit's diff, the review's changed
  files and the cleanup scan diff the plan's branch against the trunk. Two at
  once: correct only once every phase has merged; nothing states or checks
  that precondition, so an audit or review run while a phase is unmerged is
  incomplete. Becomes: refuse or wait while a phase is unmerged. Pinned by
  `cleanup/oversized-workbench-refusal.test.ts` and `audit/*.test.ts`.
- **WRONG** `lib/plans/amendments.ts:98-153` with `hooks/check-gates.js:359-417`
  — amendments are read in the checkout being edited (`--dir <planDir>`): the
  brief there against the approval commit in its `git log HEAD`. Two at once: a
  brief amended on the plan's branch (or in the plan's worktree by a person) is
  unchanged in a phase worktree that has not merged the plan in, so the
  amendment gate lets its ticks through. Becomes: amendments read from the
  plan's branch. Pinned by `__tests__/check-gates-amendments.test.ts` "A35 a
  skip-gates marker does not let a build item be checked off while an
  amendment waits" and `plans/amendments.test.ts` "A27 lists the amendments of
  a brief changed after approval, read in the plan's worktree".
- **WRONG** `hooks/eval-trigger.js:404-412` with the persistent evaluator
  (`lib/eval/persistent-evaluator.ts`, "resumes existing session if available")
  — one stream of commits per project resumes one evaluator session. Two at
  once: commits from two phase worktrees spawn two evaluators resuming one
  session together. Not verified further in code; `apps/indusk-mcp/CLAUDE.md:271-282`
  states the one-session design. Becomes: one evaluator at a time per project,
  or one per commit with no shared session.
- **COSMETIC** `lib/promises/reopen.ts:226-227` — the Maintenance phase is
  appended as build number `max + 1` with no dependency line; under the plan's
  "no line means the phase before" rule it would wait on the last phase. The
  plan's Build Phase 1 already lists this. Pinned by `promises/reopen-*.test.ts`.
- **COSMETIC** `lib/promises/clause-signal.ts:25` and `lib/promises/mark.ts:34`
  — a signal's origin is `{ plan, phase }` as a display string. Fine as a
  label; the graph key is kind and number.

### 7. Phase boundary, Shape and timing (`lib/shape/`, `lib/timing/`)

- **WRONG** `lib/shape/changed.ts:82-109` — a phase's changed files are
  `git diff <start sha>..HEAD` in the checkout plus untracked files newer than
  the boundary. Two at once: safe while each phase has its own worktree, but a
  phase that merges the plan's branch in mid-way (to take a finished
  dependency) sees the merged sibling's files as its own, and Shape reviews
  them again. Becomes: the diff against the phase's own first-parent line.
  Pinned by `shape/changed.test.ts` "A5 — excludes files an earlier phase
  changed" and "T16 — untracked work belongs to the phase that wrote it".
- **WRONG** `lib/timing/view.ts:108-113, 201-202` — a phase with no recorded
  close ends when the next phase opened (`PhaseTime.derived`), and `between`
  is the total minus the sum of phase durations. Two at once: overlapping
  phases are cut short at a sibling's opening and counted twice, so `between`
  goes negative; since `recordPhaseClose` has no production caller, the
  derived end is the usual case. Becomes: per-phase ends and covered time, not
  a sum. Pinned by `timing/view.test.ts` "A10 a phase ends at its recorded
  close, else when the next phase opened, else it is open" and "A11 the total
  runs from acceptance to landing; the difference to the phases is shown as
  between".
- **WRONG** `lib/timing/view.ts:289, 381-387` — phase openings are read from
  the plan's one live root. Two at once: openings recorded in phase worktrees
  are missing until merged (the file is `merge=union`, so they arrive then).
  Becomes: gathered from each phase's copy. Pinned by `timing/view.test.ts`
  "A23 run from the trunk, the phase openings are read from the plan's worktree".
- **COSMETIC** `lib/timing/phase-close.ts:30-45` — a close looks up its opening
  in the closing checkout's boundary file and warns "never opened" otherwise;
  no production caller. Pinned by `timing/phase-close.test.ts` "A3 a phase
  closed without having been opened writes nothing and warns".
- **COSMETIC** `lib/timing/log.ts:21-46`, `lib/timing/test-run.ts:47` — records
  carry plan and phase, no branch; the log is one file per plan in the shared
  home, so concurrent appends are fine. Two at once: a test run cannot be told
  apart by branch.

### 8. Trajectory rows, test selection and close-out (`lib/trajectory/`, `lib/plans/test-set.ts`, `lib/cleanup/`)

- **WRONG** `lib/plans/test-set.ts:57-84` — a phase's set is the rows writable
  or passing at exactly that phase (kind and number) plus the Must-not-break
  tests: a parallel-safe selection. Two at once: a row written in phase A and
  passing in phase B is runnable in B's worktree only if B's branch contains
  A's test, which nothing checks. Becomes: `Passes at` depends on `Writable
  at` (§2), checked when the impl is saved. Pinned by `plans/test-set.test.ts`
  "T1 a phase gets its rows' files and none from a later phase" and
  `plans/plan-tests-selection.test.ts` "A18 a build phase runs its own rows'
  files, then the protected promises' files".
- **WRONG** `lib/plans/plan-tests.ts:72-74, 94-95` — the tests run in
  `resolveExecutionRoots(root, plan).codeRoot`: the checkout the command runs
  in (normal mode, fine) or the plan's one code worktree (workbench). Two at
  once: a workbench phase runs its tests in the plan's worktree. Workbench
  plans are out of this slice. Pinned by `plans/plan-tests.test.ts` T3.
- **COSMETIC** `lib/trajectory/state-ops.ts:9-40`, `lib/trajectory/audit.ts:157-169`,
  `lib/cleanup/gate.ts:255-297` — exact-phase row helpers and the close-out
  readiness read one impl; correct once every phase has merged (the rituals run
  after). Nothing states the precondition. Pinned by
  `cleanup/gate-row-terminality.test.ts` "a `written` row whose phase exists
  blocks readiness, naming the row".
- **COSMETIC** `lib/impl-parser-core.ts:255-259, 280-288` — Forward
  Intelligence belongs to the phase whose heading precedes it; the parser is
  fine. The work skill reads "the previous phase's" notes (§10), which is the
  wrong reader for a graph.

### 9. The skills and templates (prose the sessions follow)

Paths under `apps/indusk-mcp/`. A session reads these; the `work` prompt
(§1) can override some of them, but the hook rules (§2) cannot be overridden
by prose. Entries about `current.md` sections are left out: the file is the
trunk's and locked (fact 2), so sessions in phase worktrees share it.

- **BLOCKS** `skills/work.md:34-35, 43` — "Work through the checklist in order.
  Start from the first unchecked item"; "Do NOT skip ahead or work out of
  order". Two at once: every session lands on the same first open phase.
  Becomes: work the phase you were started for.
- **BLOCKS** `skills/work.md:64, 107, 114` — "if you try to check off a Phase
  N+1 implementation item while Phase N has unchecked gates, the edit will be
  blocked"; "Before advancing past Phase N (i.e., before checking the first
  implementation item in Phase N+1)". Two at once: describes the §2 rule that
  refuses a sibling's tick; closing is tied to the wrong event. Becomes: the
  dependency rule.
- **BLOCKS** `skills/work.md:76, 298` and `templates/planning/CLAUDE.md:177-184`
  — "end by running `indusk plans next-session <plan>`… Each boundary starts a
  new session"; "/work runs each phase as a subagent… each boundary ends with
  the command `indusk plans next-session` names". Two at once: one boundary,
  one next session; ready siblings get none. Becomes: the runner starts what
  is ready.
- **BLOCKS** `skills/work.md:98-99, 110` and `templates/planning/CLAUDE.md:154-156`
  — "update each row's `State` to `written`… update its `State` to `passing`
  in the trajectory table"; "do both in one edit". Two at once: the one-table
  conflict of §6. Becomes: the same instruction on a file that merges by line.
- **BLOCKS** `skills/work.md:378, 385, 389` — "It does not run phases in
  parallel (they're a dependency chain)"; workflow engine "sequential, one
  phase per stage"; unattended "/work, then /falsify… as `indusk plans next`
  decides". States the assumption outright.
- **BLOCKS** `skills/work.md:395, 424-435` — "Write only inside the plan's
  worktree. A write outside it is refused."; "one plan → one branch → one
  worktree"; `indusk worktree create <plan>` "records that the plan lives
  there"; "If you're already in a worktree for this plan, you're set." Two at
  once: a second session sitting in the plan's worktree is "set"; a phase
  worktree is "outside the plan's worktree" by the skill's words (the
  permission check itself is bounded to the session's cwd, so it allows).
  Becomes: a worktree per phase, cut from the plan's branch.
- **BLOCKS** `skills/planner.md:208` and `templates/planning/CLAUDE.md:83-89`
  — "The two sequences number independently and are ordered by their position
  in the document"; "A row left unwritten blocks every later close". The §2
  rule as the planner and the template teach it.
- **BLOCKS** `apps/indusk-mcp/CLAUDE.md:89-93, 113-121, 178-183, 324` — the
  package rules: one live copy per plan ("doubled" is an error), one
  `nextBuildStep` per plan, one run record per plan and kind, `phaseOrdinal`
  as a total order, `SessionManager.start` refuses a second session of the
  same owner. Rewritten with the code.
- **WRONG** `skills/work.md:15, 21, 25, 52` — pick "which plan"; "Scan the
  current phase for `blocker:` lines"; "If the previous phase has a
  `#### Phase N Forward Intelligence` section, read it"; add discovered work
  "in the appropriate phase". Two at once: no way to be told which phase; the
  previous-numbered phase may be a sibling still running elsewhere, so its
  notes are unwritten or unmerged and a real dependency's are skipped; the
  "appropriate" phase may be on another branch. Becomes: the session's phase
  and its dependencies.
- **WRONG** `skills/work.md:73, 354-369` — one main conversation hands phases
  to subagents one at a time, all in one worktree; autopilot "For each
  remaining phase, in order"; the subagent contract names one worktree path;
  the goalpost guard snapshots the trajectory before and after a phase and
  stops loud on any `Asserts` change. Two at once: subagents share one tree; a
  sibling's merge changes rows legitimately and reads as a gamed gate.
  Becomes: per-phase worktrees and a guard over the phase's own rows.
- **WRONG** `skills/work.md:113, 189, 288-301, 304-306` — "move its `Passes
  at` to a later phase"; Shape's "files this phase changed" (§7); Context and
  Document items edit `CLAUDE.md`, docs pages and the changelog
  `## [Unreleased]` block (no merge driver; two phases appending at one spot
  conflict); "When all phases are checked: update impl status to `completed`"
  then run `/falsify`. Two at once: a later number is not a later phase; a
  phase branch never sees all phases checked, or flips the status before the
  merge; no session knows the whole graph is done. Becomes: declared files
  (ADR D1) and a status flip by the runner after the last merge.
- **WRONG** `skills/work.md:447-478` and `skills/git.md:16-58, 82-118` — the
  git section already cuts a branch per phase, `plan/{plan}-phase-{n}` from
  `main`, rebases on `origin/main` and merges to `main`. Two at once: the
  closest existing idea to a phase branch, on the wrong base and target (a
  dependency's code is only on the plan's branch), one numbering for two
  sequences (`Test Phase 1` and `Build Phase 1` collide), and it contradicts
  `templates/planning/CLAUDE.md:200-202` ("one commit per checklist item on the
  plan's `plan/{name}` branch") and the retrospective's "do not rebase a plan
  branch". Becomes: `phase/<plan>/<kind>-<n>` from the plan's branch, merged
  back into it (ADR D5/D6).
- **WRONG** `skills/falsify.md:20-22, 40-43, 140`, `skills/cleanup.md:42, 64-67, 138`
  — the rituals investigate "the code" in the checkout they run in and append a
  phase numbered `N+1`/`Phase N` with no dependency line; the cleanup scan
  diffs the plan's branch. Two at once: run before every phase merges they
  hunt an incomplete plan; the appended phase declares no dependencies (the
  brief's `reviews-are-phases` makes them nodes). Becomes: run after the last
  merge; write `**Depends on**:` and `**Files**:` (the plan's Build Phase 1).
- **WRONG** `skills/audit.md:7, 24-27, 37, 156` — the audit reads the branch's
  diff "when the build phases have closed", adds a fix "in the build phase it
  belongs to", and "/work runs it… in the plan's open build phase". Two at
  once: an unmerged phase is missing from the diff; the phase it belongs to is
  merged and gone; "the open build phase" is none or several. Becomes: after
  the last merge; a fix as a new phase with dependencies.
- **WRONG** `skills/retrospective.md:45, 128, 336-347, 361` — "the last phase"
  is the last run; each phase "already ran its rows' tests" on code that
  includes the earlier phases; one branch opened at Phase 1 and closed when it
  is on `main`; `plans land` removes one worktree and one branch; `git
  for-each-ref refs/heads/plan/*` lists nothing afterwards. Two at once:
  document position is not completion order; parallel phases were green on
  separate branches and the joined plan is first tested at landing; phase
  worktrees are left as stale build locks; live phase branches (if named
  `plan/*`) trip `release-guard.sh` ("unmerged packaged `plan/*` branch",
  `apps/indusk-mcp/CLAUDE.md:317-321`). Becomes: the merge check of ADR D6 and
  `phase/` names outside `plan/*`.
- **WRONG** `skills/verify.md:21, 159` — "Progressive — each phase proves
  itself before the next begins. Phase 2's verification should confirm Phase 1
  still works too." Two at once: a sibling branch does not contain Phase 1.
  Becomes: a phase proves itself and its dependencies.
- **WRONG** `skills/planner.md:181-187, 197-206, 246, 272, 580-585, 611, 706-724`
  — phases "hand to the next"; the Boundary Map "Phase 2 | what it needs from
  Phase 1" (prose, linear, the closest thing to a dependency graph today);
  "Open Phase 1 with a worktree kickoff item"; a row "stays red through
  intermediate phases"; "The build continues on the same branch"; `## Files
  Affected` and `## Dependencies` at plan level only. Two at once: no
  machine-read dependency per phase, no files per phase, one worktree. Becomes:
  the two label lines per phase (ADR D1).
- **WRONG** `skills/catchup.md:130, 232` — "The current phase of each active
  plan — this is where /work will pick up"; "unchecked items from a previous
  session, that's where /work picks up". Two at once: unchecked here may be
  running on another branch; work gets duplicated. Becomes: the running phases
  from the run record.
- **WRONG** `skills/claude-md.md:131-149`, `skills/document.md:101, 221`,
  `templates/workflows/refactor.md:74-78`, `templates/planning/CLAUDE.md:90-95, 160-176, 185-202`
  — Forward Intelligence "the next phase should be aware of"; "every phase
  should produce a changelog entry under `## [Unreleased]`"; a linear Boundary
  Map; "`Writable ≤ Passes` is enforced at write time"; "Worktree-per-plan…
  Phase 1 opens with `indusk worktree create <plan>`"; "A plan is written on
  its own branch `plan/<name>`"; Context gate destinations; "one commit per
  checklist item on the plan's `plan/{name}` branch". Two at once: the reader
  of the notes is the dependent phase, not the next; the changelog conflicts;
  `≤` must mean "is an ancestor of"; phase branches are not described; commits
  go on phase branches. Becomes: rewritten with ADR D1/D5/D6.
- **WRONG** `apps/indusk-mcp/CLAUDE.md:160-168, 194-196, 234-235, 271-282, 317-321`
  and `hooks/CLAUDE.md:81-86` — Shape's scope "takes the earliest record";
  timing reads openings from the plan's live worktree; a new plan worktree
  copies `.mcp.json` (a phase worktree made otherwise lacks it); the evaluator's
  one persistent session; `release-guard.sh` refuses an unmerged `plan/*`
  branch; the budget hook judges `CLAUDE.md` growth per checkout, so two phases
  each under 60 KB can merge to a file over it with no hook firing. Becomes:
  rewritten with the code.
- **COSMETIC** `skills/work.md:3, 11, 32, 88, 156, 314, 490, 498`,
  `skills/falsify.md:130, 188, 192`, `skills/cleanup.md:28-31, 180`,
  `skills/audit.md:7`, `skills/retrospective.md:170`, `skills/planner.md:185, 611, 695, 765-766`,
  `skills/document.md:28`, `skills/toolbelt.md:25-29`,
  `templates/workflows/refactor.md:83`, `skills/claude-md.md:155`,
  `apps/indusk-mcp/CLAUDE.md:304-306` — "one item at a time, in order", "the
  previous phase's", "the same you that built the plan", "the next session's
  only memory", "Sessions spent: N", "phase by phase → next phase", "the impl
  doc is the source of truth for progress… anyone can read it and know exactly
  what's done" (true of the plan's branch only), "a phase that edits `skills/`
  resyncs `.claude/skills/` in the same phase". Wording.

### 10. Dawn's `indusk run` and `indusk verify` — a separate path

Dawn's loop (`lib/run/`) is not the admin's build: nothing outside `lib/run/`
imports `loop.ts`, `gate.ts` or `cadences.ts`. `verify/*` is imported only by
`bin/commands/verify.ts`. Shared with the admin's path: `run/probe.ts` and
`run/goalposts.ts` (through `verify/detect.ts`), the `check-gates.js` rule
(§2), `models/phase-model.ts` (§1), `timing/timed-step.ts` (safe), and `plans
tests`/`plans model` (which the work skill tells every session to run). ADR D4
asks `indusk run` to refuse a plan the admin is building; nothing refuses it
today. Paths under `apps/indusk-mcp/src/`.

- **BLOCKS** `lib/run/loop.ts:218-226` — `for (const planned of initial.phases)`
  walks every phase in document order, re-reading one `impl.md`. Becomes: the
  phases ready by their dependencies. Pinned by `run/loop.test.ts` "T5: runs
  the plan to impl-complete via the scripted Claude driver, advancing only on
  green gates" and `run/test-phase-parity.test.ts` "closes the test phase,
  then the build phase, in order".
- **BLOCKS** `lib/run/loop.ts:163-181, 248-250` and `bin/commands/run.ts:88, 109-112`
  — one run is bound to one worktree (`resolveExecutionRoots(projectRoot)`,
  called without the plan, so a workbench plan's code file is ignored).
  Becomes: a root and branch per phase. Pinned by `run/workbench-split.test.ts`
  "A7: file edits land in the code repo and checkoffs in the plan repo, neither
  in the other".
- **BLOCKS** `lib/run/loop.ts:269-275` with `lib/run/probe.ts:51-62, 89-108` —
  a phase closes only if the probe passes, and the probe truncates the document
  after this phase and asks `check-gates.js` to allow a fake `Build Phase N+1`,
  so every earlier phase in the document must be closed. Becomes: a probe over
  this phase and its dependencies. Pinned by `run/loop.test.ts` "stops RED
  (never advances) when the phase did not actually close" and
  `verify/probe-boundary.test.ts` "reports Phase 1's premature checkoff in a
  plan that opens at Phase 0".
- **BLOCKS** `lib/run/loop.ts:323` — the run ends at `complete` in the one tree;
  no step merges anything. Becomes: a merge into the plan's branch when a
  phase is green. No test covers a merge.
- **BLOCKS** `lib/run/gate.ts:91-106, 236-263, 279-302` — every edit goes
  through `check-gates.js` against that worktree's impl (§2). Pinned by
  `run/gate.test.ts` "T3: a premature phase-checkoff is blocked — exit 2, edit
  NOT applied, block message returned" and `run/swap.test.ts` "T7: a premature
  checkoff via the google driver is still blocked".
- **BLOCKS** `lib/run/cadences.ts:68-80` with `lib/run/loop.ts:164-181`
  (workbench split) — the plan-side cadence runs `git add -- <planDir>` and
  commits in the one workbench checkout, with a `Code-Commit:` trailer from the
  one code root. Two at once: two runs stage each other's checkoffs in one
  index; the trailer names another phase's commit. Becomes: a plan copy and
  branch per phase. Pinned by `run/workbench-split.test.ts` "A8… joined by a
  Code-Commit trailer" and "A17: a checkoff before any code lands a plan commit
  with no trailer".
- **WRONG** `lib/run/loop.ts:233-242, 263-265, 276-303` — the first human-gate
  pause, goalpost stop, gate question or red stop returns and ends the whole
  run. Becomes: a stop for one phase and its dependents. Pinned by
  `run/loop.test.ts` "pauses at a human gate instead of self-approving it" and
  "T6: a tool step rewriting an Asserts cell STOPS the loop and surfaces it".
- **WRONG** `lib/run/loop.ts:187-207, 245` with `lib/run/pending-evals.ts:27-55`
  — one mutable `currentPhase` labels commits and queued evals; the queued
  eval's `repo` is the run's worktree path. Two at once: commits labelled with
  the wrong phase; a drained eval handed a worktree that was merged and
  removed. Becomes: attribution per phase; a repo reference that outlives the
  worktree. Pinned by `run/pending-queue.test.ts` "appends {sha, plan, phase,
  source, timestamp} per commit, matching git log" and
  `run/pending-repo-attribution.test.ts`.
- **WRONG** `lib/run/probe.ts:94, 137-148` — "the next phase" is the next in
  the document; only its writable rows are neutralised. Becomes: rows outside
  this phase's dependencies. Pinned by `run/test-phase-parity.test.ts` A10/A11.
- **WRONG** `lib/verify/ledger.ts:126-139`, `lib/verify/verify.ts:117-127, 191-201`,
  `lib/verify/baselines.ts:54-60`, `lib/verify/git.ts:49-137` — phase N's
  baseline is the ledger record with the highest phase number below N, assumed
  an ancestor of HEAD; the bootstrap baseline is the merge-base with the trunk.
  Two at once: a sibling's sha is not an ancestor, so the diff includes its
  work reversed; a phase branch's bootstrap base is where the plan left the
  trunk, so every earlier phase counts as this one's. (The ledger file itself
  is `merge=union`, so it does not conflict.) Becomes: a baseline from this
  phase's dependencies or its branch point. Pinned by `verify/ledger.test.ts`
  "picks the highest phase below the one being verified, for this plan only"
  and "uses the recorded sha as the baseline, not the merge base".
- **WRONG** `lib/verify/phantom.ts:35-61`, `lib/verify/detect.ts:37-62, 136-173`
  — everything changed since the last clean verify is this phase's work;
  premature checkoff means "cannot close in document order"; the goalpost
  comparison reads rows a sibling added as "removed mid-phase". Becomes: a diff
  limited to the phase's branch; the probe fix above. Pinned by
  `verify/phantom.test.ts` "rejects, naming the item that was checked without
  work" and `verify/detect.test.ts` "rejects, naming the unchecked gate item
  and the phase it belongs to".
- **COSMETIC** `lib/run/loop.ts:213, 225`, `lib/run/probe.ts:104`,
  `lib/run/commit-cadence.ts:149-155, 175, 204, 267`, `lib/run/gate-question.ts:54`,
  `lib/verify/red-tests.ts:114-116` (rows with `passesAt <= phase`, a number),
  `lib/verify/phantom.ts:136` (a phase found by number alone),
  `lib/verify/report.ts:71` ("the baseline for the next phase"),
  `bin/commands/verify.ts:23-34` ("verify judges one phase boundary at a
  time", a bare build number) — a phase list fixed at start, ordinal labels,
  `item(plan P{n})` messages, "the run resumes where it paused". Wording and
  labels. Also two unrelated bugs found on the way: `bin/commands/run.ts:130-157`
  has no `paused-gate-question` case (exits 0), and line 88 drops the plan.

### Already parallel-safe (worth knowing before changing anything)

- `.indusk/current.md`, `.indusk/plan-history/<plan>.md` and the lessons are
  written to the trunk under one lock (`lib/bookkeeping/notes.ts:67`,
  `lib/plans/history.ts:75-88`); run records, timing, the eval queue and the
  slow-run record are in machine state. Sessions in different worktrees share
  them.
- `.gitattributes`: `phase-boundary.jsonl`, `verify/ledger.jsonl` and the
  highlights files merge by union; its own comment says two branches opening
  phases is the expected case.
- `lib/shape/boundary.ts:104-128` records a phase start once per phase and
  `lib/shape/shape.ts:57-76` judges a phase's own Verification gate; with a
  worktree per phase the scope is right until a mid-phase merge (§7).
- `lib/plans/test-set.ts` selects by exact phase; `plans tests --phase` and
  `plans model --phase` take kind and number (`bin/commands/plans.ts:143, 499-509`).
- `lib/session/permissions.ts:33-54` bounds a build's writes to the session's
  own cwd, so a session in a phase worktree is allowed there.
- `lib/build/judgement.ts` judges one phase; `lib/build/amendment-signal.ts`
  and the amendment gate are plan-wide by design (one waiting amendment stops
  every phase).
- `hooks/trunk-guard.js` protects trunk branches only; `hooks/stash-guard.js`
  already assumes many worktrees; `hooks/_hook-paths.js` resolves state per
  checkout and the home per project.
- `lib/lifecycle.ts:516-558` derives a phase's activity per phase;
  `lib/plans/steps.ts:81-90` reads one `live.build` boolean for the Build step,
  which stays true.
- `lib/models/tiers.ts` and `lib/build/step-model.ts` look a phase up by kind
  and number; `nextTier` counts failures per phase.

### Smallest change set that makes two independent phases run at once

The simplest case: one approved, non-workbench plan with two build phases that
name no dependency on each other and share no file. What must change, and
nothing more:

1. **A worktree and branch per phase, cut from the plan's branch**
   (`lib/worktree/plan-worktree-commands.ts:139-193`): `phase/<plan>/<kind>-<n>`
   at a path beside the plan's, with `.mcp.json`, trust and the install, and
   never assigned (`assignPlan`, lines 94-118, refuses a second live worktree).
2. **Session identity carries the phase** (`lib/session/manager.ts:41-51, 227-236,
   305-309`): refuse only the same plan, kind and phase; each phase session takes
   its own place under the cap (lines 243-268), the admission covering one.
3. **The work step launches every open phase and waits for all**
   (`lib/build/next-step.ts:77-84`, `lib/build/runner.ts:97-113`): the step
   returns the open phases without a blocker or judgement, runs a session per
   phase through `runStepSession` with that phase's worktree, and returns when
   the last ends. The admin's `startBuild`, `admitBuild` and `assertNoBuildSession`
   (§4) stay as they are because there is still one run per plan.
4. **The session is told its phase** (`lib/build/build-session.ts:65, 42-47`):
   the prompt names one phase and ends when it is closed; the environment
   carries it.
5. **The gate hook judges by dependency, not position**
   (`hooks/check-gates.js:444-588`): "earlier phases complete", Gate A and Gate
   B skip phases the ticked phase does not depend on; with
   `INDUSK_BUILD_PHASE` set, a tick in another phase is refused.
6. **A phase joins the plan by a merge of `impl.md` that keeps both sides'
   ticks and cells, then `--ff-only` in the plan's worktree** (new code beside
   `lib/plans/land.ts`; `.gitattributes` gives `impl.md` no driver): without it
   the second phase's join conflicts and nobody resolves it.
7. **The run record lists its phases and liveness reads any of them**
   (`lib/run-record/record.ts:26-41`, `lib/run-record/liveness.ts:29-41`):
   without it the admin reads the plan stopped as soon as one phase session
   ends and offers Build again.

Everything else in this inventory is a wrong label, a wrong signal, a stale
page, a ritual that must simply run after the last merge, or Dawn's separate
loop — none of it stops two independent phases from building and joining.
