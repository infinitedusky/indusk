---
plan: run-the-graph
reviewed: 2026-10-19
read: ec6d326c909501ffd1c7389bfe258a43429395f3f1bdd14411027e41a3257c06
model: claude-opus-5-5
---

# Plan review — run-the-graph

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/run-the-graph/impl.md:62 — T6, the trajectory row for the clause `ready-phases-start` (a ready phase's session is launched within a minute while the cap has room), runs only the pure scheduler `pickPhasesToStart` (body at impl.md:186). It shows the function returns the phase. It does not show that a session gets launched. Driver to session manager is tested only by A9, a live check that by the plan's own rule (test-plan.md:445) proves no clause.
  - breaks when: the session manager refuses or never runs the launch the driver asks for, for example because of the plan-level `builds` admission in `lib/session/manager.ts:233`, and every unit row stays green.
  - answer: fix — test-plan.md adds A104 and impl.md adds row T43 (Build Phase 12, clause `ready-phases-start`): the driver launches through the real `SessionManager` with a stand-in process, a second phase of a running plan starts, a fifth at a cap of four is refused; Build Phase 5 keys admission by phase so plan-level `builds` no longer exempts or blocks.
- .indusk/planning/run-the-graph/impl.md:226 — T26, the trajectory row for `a-hold-frees-its-files` (a held phase gives up its files at once), builds its `held` input by hand as bare phase names (`held: ["Build Phase 1"]`), with no plan. It also never takes a hold from the record through `readGraph` or the driver. So the path from "a phase is put on hold" to "the scheduler sees it held" is untested, and the plan-less key is approved as the shape.
  - breaks when: two plans each have a "Build Phase 1" and holding one drops the other from `running` as well, or a `held` entry in `runner.jsonl` never reaches the scheduler's input.
  - answer: fix — adr.md D3/D11 and impl.md Build Phases 3 and 4 key `running` and `held` as `{ plan, phase }`, derived by `readGraph` from the record; T26's asserts and deferred body now hold through `holdPhase` → record → `readGraph` → `pickPhasesToStart`, with a same-named phase of another plan untouched.
- .indusk/planning/run-the-graph/impl.md:206 — T18 and T19 cover `agent-resolves-first` (a resolution is kept only with the plan's tests passing) and `green-before-merging` (a merge only after the merged result's tests and every touched clause's tests pass). Their bodies inject the test outcome (`tests: () => red`, `check: () => ({ ran: 0 })`). No row runs the real selection, meaning `planTestSet` with the new "touched clauses" and "built so far" scopes, against a real plan.
  - breaks when: `TestSetRow` (lib/plans/test-set.ts:23), which has no `For` field today, selects too few tests in real use, and both clauses pass their rows.
  - answer: fix — adr.md D6 gives `TestSetRow` a `For` field and two scopes; test-plan.md adds A105 and impl.md adds row T44 (Build Phase 8, clause `green-before-merging`) running the real `planTestSet` touched and built-so-far selection on a fixture plan with nothing injected.
- .indusk/planning/run-the-graph/impl.md:84 — T28, the row for `branches-follow-the-trunk` (every idle open plan's branch has merged a landing within five minutes), calls `cascadeTrunk` directly with a hand-made plan list. No row proves the five-minute pass is scheduled anywhere. T31 tests only the 60-second readiness tick.
  - breaks when: a landing's own cascade call is missed (the plan landed from a worktree, or the runner was off) and the five-minute pass is never hosted, so a branch stays behind indefinitely.
  - answer: fix — adr.md D3/D8 put both ticks in the admin's build host; test-plan.md adds A106 and impl.md adds row T45 (Build Phase 12, clause `branches-follow-the-trunk`): the host starts the ticks and each five-minute pass hands the cascade every open plan.
- .indusk/planning/run-the-graph/test-plan.md:90 — A17 asserts that a phase waiting on a landed plan's files "starts with the landed work". ADR D8 (adr.md:96), however, skips the cascade for any plan branch with a running phase. New phases are cut from that plan branch, so they start without the landing until some running phase ends. No row covers a plan that is busy at the moment of the landing.
  - breaks when: a plan always has one phase running, and every phase it starts after a landing begins from a plan branch that lacks it.
  - answer: fix — adr.md D5 has `startPhase` merge the trunk into a new phase whose plan branch is behind it; test-plan.md A17 now covers the busy plan, impl.md Build Phase 6 adds the task and row T46 (clause `graph-is-current`).
- .indusk/planning/run-the-graph/test-plan.md:111 — the `reviews-are-phases` sentence (brief.md:97) names "the audit" among the writers of graph phases. A19 states instead that the audit writes `audit.md` and is not a phase. Nothing proves the brief's sentence as written.
  - breaks when: someone reads the clause as promising that audit findings run as graph phases, and nothing schedules them.
  - answer: fix — test-plan.md A19, adr.md D4 and impl.md T4 and Build Phase 3 now name an Audit phase (a phase the audit's answers add to the impl) as a graph node with its dependencies and files, and only the audit step itself as not a phase, which is the brief's sentence.

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/adr.md:100 — D9, the ADR decision on conflicts, puts "only phases whose declared files overlap those files, and the phases that depend on them" on hold. Build Phase 9's `holdPhase` (impl.md:918) ends the phase's session. A phase that is running when another merge conflicts is therefore stopped. That contradicts the brief's rule that "a running phase always finishes" (brief.md:70, `running-phases-finish` at brief.md:117).
  - breaks when: a trunk-cascade or start-merge conflict names a file that a running phase of the same plan declares, and that running phase's session is ended mid-work.
  - answer: fix — adr.md D9/D11, test-plan.md A70/A88 and impl.md Build Phases 7 and 9 and T18: an unresolved conflict holds only phases not yet running; an affected running phase finishes and is held at its merge; `holdPhase` never ends a session.
- .indusk/planning/run-the-graph/impl.md:918 — Build Phase 9 states "the decisions-as-questions plan is not built" and wires release only to amendment re-approval and conflict answers. But decisions-as-questions has landed on main (commit 3ec670c8). So the brief's first named hold trigger, a question that holds (brief.md:116, story 5), is not built into `holdPhase`/`releasePhase`.
  - breaks when: a phase asks a question that holds, and it either holds the whole plan through the existing plan-level `SessionManager.holdQuestion`, or is never released by the answer.
  - answer: fix — adr.md D11 wires all three triggers; impl.md Build Phase 9 adds the question-hold task (build-host holds and releases the asking phase only), Build Phase 5 keys `holdQuestion`/`releaseQuestion` by phase, row T52 (A112) proves it and T41 is back to a question hold; test-plan.md's out-of-scope note is replaced.
- .indusk/planning/run-the-graph/impl.md:1216 — Build Phase 13 makes the `/work` skill refuse "a changed file outside the phase's declared set". No promise names this. It also contradicts A102 / T33, the regression guard that the manual one-phase `/work` path is unchanged.
  - breaks when: a person runs `/work` by hand on a phase whose `**Files**:` line is incomplete (as several in this impl are; see the next heading) and has a legitimate edit refused.
  - answer: fix — adr.md D2 drops the refusal (no promise names it and A102 forbids changing the manual path); impl.md Build Phase 13 now says `/work` refuses nothing new, and a changed file outside the declaration is listed in the phase's merge entry.
- .indusk/planning/run-the-graph/impl.md:833 — Build Phase 8 resolves `impl.md` checkbox and State-cell conflicts with a scripted union, with no agent. Clause `agent-resolves-first` says "a conflicting merge is resolved by an agent". The impl does not say whether these mechanical merges are recorded as conflicts.
  - breaks when: the brief's second expectation (merges rarely need a person) is read from a record where every parallel phase's `impl.md` conflict is uncounted or counted as an "agent" resolution.
  - answer: fix — adr.md D6, impl.md Build Phases 2 and 8 and test-plan.md A73: the tick-union is kept only with the merge check green and recorded as `conflicted, resolvedBy: script`, which `countMerges` counts apart from agent resolutions.
- .indusk/planning/run-the-graph/impl.md:1125 — Build Phase 12 has the driver start the ritual steps "(audit, falsify, cleanup, retrospective)". The clause `reviews-are-phases` says those steps are not phases, and no promise says the runner starts them.
  - breaks when: the driver launches a retrospective that lands or archives the plan while a falsification phase it just authored is still unscheduled.
  - answer: fix — adr.md D3 and impl.md Build Phase 12: the driver never starts a ritual step; the existing step loop runs them as today, and only while none of the plan's phases is ready, running or held, with a test that a retrospective waits for an unscheduled falsification phase.

## Which skip reason would you not accept?

- .indusk/planning/run-the-graph/test-plan.md:97 — `within-the-cap` (the graph never runs more phase sessions than the cap) has no signal "of its own" because "`sessions-are-capped` already reports the count". It does not. `.indusk/promises/sessions-are-capped.md` lists only tests, and `lib/session/limits.ts` and `manager.ts` write no mark.
  - breaks when: phase sessions exceed `sessions.max` in use and nothing reports it.
  - answer: fix — test-plan.md gives `within-the-cap` a signal and a Fails-when list; impl.md Build Phase 12 adds its signal task in `graph-driver-signals.ts`, reading the session manager's own held sessions against `sessions.max` at each launch; adr.md D14 and impl.md Notes say so.
- .indusk/planning/run-the-graph/impl.md:1280 — the live checks use a scripted agent because "a build that runs unattended and cheaply cannot spend model calls". By ADR D14 (adr.md:122), however, the live checks run in `test:system` at landing and release, not in the unattended build. So the only test of a real agent resolving a conflict (A74) never uses an agent.
  - breaks when: the real resolver session cannot be started, given permission, or made to produce a commit, and every row passes.
  - answer: fix — adr.md D14, test-plan.md A74 and impl.md T39, Build Phase 13 and Notes: the conflict check runs a real resolver session in `pnpm e2e` (`e2e/run-graph-conflict.e2e.test.ts`); the other seven keep a scripted agent.
- .indusk/planning/run-the-graph/test-plan.md:396 — for `the-held-phase-catches-up`, "nothing releases it — no signal here … what raises and answers a question is `decisions-as-questions`'". That plan is now built, so the reason no longer holds. A question-held phase that is never released is a failure this plan owns.
  - breaks when: the person answers a phase's question and the phase stays held, listed only in a printout nobody reads.
  - answer: fix — test-plan.md `the-held-phase-catches-up` Fails-when now has the hold signal read answered questions from `decisions-as-questions`' own store on each tick and report a phase still held a minute after its answer; impl.md Build Phase 9's signal task does it.
- .indusk/planning/run-the-graph/test-plan.md:46 — for `ready-phases-start`, "with no driver at all no span arrives, which is itself the gap the close reads". The close happens once, and after it nothing reads absence.
  - breaks when: the admin daemon that hosts the ticks (impl.md:1131) is not running for a day after the plan closes, and no phase starts, with no broken span.
  - answer: fix — test-plan.md `ready-phases-start` and impl.md Build Phase 12: ready time is read from git, so the admin's first tick after it starts reports every phase ready since before it with its gap as broken, and `plans approve`/`plans land` say plainly when the admin is not running (adr.md D3, A109).

## What else would have to change for each promise to hold?

- .indusk/planning/run-the-graph/impl.md:1131 — `approve.ts` and `land.ts`, both CLI processes, call `onPlanApproved` and `onPlanLanded`, and those launch sessions. `SessionManager` keeps running sessions and admitted builds in memory (`lib/session/manager.ts:312`). A CLI-side manager therefore cannot see the admin daemon's sessions, and sessions launched from the CLI are owned by a process that exits. Event-driven launches would have to be routed into the one admin-hosted manager.
  - breaks when: a plan is approved from the terminal while the admin runs four sessions, and the CLI launches more past the cap (`within-the-cap`), or its sessions die with the command.
  - answer: fix — adr.md D3: the driver runs only inside the admin; impl.md Build Phase 12 has `approve.ts`/`land.ts` call `askAdminToSchedule` (an admin route calls the one driver), never a session manager; test-plan.md A109 and row T47 prove it.
- .indusk/planning/run-the-graph/impl.md:609 — the existing run record (`lib/run-record/record.ts:22`, one file per plan and kind, with one `phase` and one `process`) is what the admin's liveness, status and Restart read (promise `a-run-is-read-from-its-record`). The plan adds `runner.jsonl` but leaves that record keyed by plan and kind.
  - breaks when: two phase sessions of one plan run and each overwrites the other's run record, so the admin shows one phase and judges the other dead.
  - answer: fix — adr.md D12 and impl.md Build Phase 5: the run record becomes one per running phase (path keyed by plan, kind and phase; the admin's liveness, status and Restart read each); test-plan.md A110 and row T48, written red in Test Phase 1.
- apps/indusk-mcp/src/lib/session/manager.ts:281 — question holds (`holdQuestion` and `releaseQuestion`) and build admission (`buildKey`) are keyed by plan, not by phase. For a hold to free only one phase's files and session, both would need to be per phase.
  - breaks when: one phase's question takes every phase of its plan out of `builds`, and the other running phases lose their places under the cap.
  - answer: fix — adr.md D11/D13 and impl.md Build Phase 5 key `buildKey`, `admitBuild`, `holdQuestion`, `releaseQuestion` and `waitingOnQuestion` by phase; T52 proves a question frees only its phase, and T53 (A113) guards `decisions-as-questions`' slot rule under the new keys.
- .indusk/planning/run-the-graph/impl.md:451 — `readGraph` takes "only plans whose impl is approved". Maintenance phases are appended in place to the owning plan's impl, often under `.indusk/planning/archive/` (`lib/promises/reopen.ts`, `ownerDir`). Such a plan has no plan branch. Including reopened archived plans and creating their branch would have to change.
  - breaks when: a promise owned by a shipped plan breaks overnight, and its fix phase never enters the graph (story 3, `a-broken-promise-jumps-the-line`).
  - answer: fix — adr.md D3/D4 and impl.md Build Phases 3 and 6: `readGraph` includes each open Maintenance phase of an archived plan as a fix node, and its start cuts `plan/<owner>` from the trunk for that fix; test-plan.md A107 and row T49.
- apps/indusk-mcp/src/lib/promises/reopen.ts:1 — the Maintenance-phase writer is `lib/promises/reopen.ts`. The impl (impl.md:349) edits `src/bin/cli.ts` and `record_breaks` instead. The writer also adds no `**Depends on**:` line, so by D1 a fix phase depends on the owner's previous phase.
  - breaks when: the owner plan is mid-build and its fix phase waits on an unrelated unfinished phase instead of taking the next free session, and it declares no files, so nothing depends on it.
  - answer: fix — adr.md D4 and impl.md Build Phase 1 name `lib/promises/reopen.ts` as the writer, which writes `**Depends on**: none` and `**Files**:` from the promise's `sites:`; test-plan.md A111 and row T50, written red in Test Phase 1.
- apps/indusk-mcp/src/lib/plans/land.ts:62 — `landPlan` neither refuses a plan with running or held phases nor routes its own trunk merge (line 83) through the resolver unless the plan pulled work. It then deletes the plan branch and the worktree.
  - breaks when: a plan lands while a phase still runs, and that phase's compare-and-swap `update-ref` recreates or orphans the deleted plan branch, or its work is lost.
  - answer: fix — adr.md D8 and impl.md Build Phase 11: landing refuses a plan with a running or held phase, naming them, and its own trunk merge always goes through `mergeWithResolution` (Build Phase 7's call-site test names `landPlan`/`landWorkbenchPlan`); test-plan.md A108 and row T51.
- .indusk/planning/run-the-graph/impl.md:355 — every phase edits `apps/indusk-mcp/CLAUDE.md`, the docs page and the changelog for its gates. The addendum excludes those files from overlap but not from the `/work` out-of-set refusal. Many phases' `**Files**:` lines (for example impl.md:317, 517, 644, 898 and 1093) also omit test files and edited sources (`plan-tools.ts`, `approve.ts`, `build-host.ts`, `amendment-signal.ts`).
  - breaks when: the refusal from Build Phase 13 rejects ordinary gate edits, or parallel phases that edit one `CLAUDE.md` section collide at every merge.
  - answer: fix — adr.md D2 makes shared gate files undeclared and excluded from overlap, with conflicts there going to the tick-union or the resolver, and drops the refusal; impl.md's `**Files**:` lines now list each phase's test files and edited sources (`plan-tools.ts`, `approve.ts`, `build-host.ts`, `amendment-signal.ts`, `ask-admin.ts`, and the rest).
- .indusk/planning/run-the-graph/impl.md:316 — Build Phases 1, 2 and 5 declare `**Depends on**: none`. Under D1 that means they start before Test Phase 1 finishes. No rule keeps Test Phase 1 first, which the test-phase-structure decision requires.
  - breaks when: a planner writes `none` on early build phases and the graph builds them before their red tests exist.
  - answer: fix — adr.md D1: in an impl with a Test Phase 1 every build phase depends on it whatever its line says; impl.md Build Phase 1 and T1, and test-plan.md A4, assert it.

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/impl.md:542 — the `no-needless-wait` judge re-derives overlap with `fileSetsOverlap` from `declarations.ts`, the same function the scheduler uses. It also takes the same `held` and `running` inputs. The test plan (test-plan.md:64) claims "the span re-checks overlap".
  - breaks when: a glob bug or a mis-keyed `held` entry lets two phases run on one file, and the judge agrees with the scheduler.
  - answer: fix — test-plan.md `no-needless-wait` signal and impl.md Build Phase 4: the judge reads holds from the record by plan and phase, running phases from the sessions file, and overlap by expanding globs against `git ls-files`, never `fileSetsOverlap` or the call's inputs.
- .indusk/planning/run-the-graph/impl.md:839 — the `green-before-merging` and `every-phase-is-checked` signals recompute the touched set with `planTestSet`, the check's own selector. They also read "the recorded run" from the record that `mergePhaseIntoPlan` itself wrote.
  - breaks when: the selector leaves out a clause's tests, or the merge records a run it did not make, and both signals report upheld.
  - answer: fix — test-plan.md `green-before-merging`/`every-phase-is-checked` and impl.md Build Phase 8: both signals read the test runner's own report for the swapped-in commit, and recompute touched clauses by a plain scan of `For` cells and tokens in the diff, never `planTestSet` or the record.
- .indusk/planning/run-the-graph/impl.md:1143 — the `ready-phases-start` signal measures from `ready` entries that the driver writes itself, and fires only from the driver.
  - breaks when: the driver never judges a phase ready (a `done` entry it did not write) or is not running, and no ready entry and no span ever exist.
  - answer: fix — test-plan.md `ready-phases-start` and impl.md Build Phase 12: ready time comes from git (the merge of the last dependency, or approval), launch time from the sessions file, and the signal also runs on the admin's first tick after it starts.
- .indusk/planning/run-the-graph/impl.md:1155 — the `running-phases-finish` signal accepts any `held` entry as a lawful end of a running session.
  - breaks when: the runner ends running phases by holding them for a conflict elsewhere (ADR D9), and the signal reads upheld.
  - answer: fix — test-plan.md `running-phases-finish` and impl.md Build Phase 12: a `held` entry is lawful only when the session's own last event is its question or amendment stop; a conflict hold of a running phase is broken (and adr.md D9 no longer makes one).
- .indusk/planning/run-the-graph/impl.md:554 — the start half of `a-broken-promise-jumps-the-line` iterates fix nodes in the graph.
  - breaks when: the fix phase sits in an archived owner plan that `readGraph` never includes, so there is no fix node and no span, and the incident goes unworked.
  - answer: fix — impl.md Build Phase 4's start-half signal now also reads the open incident files and each owner's impl, active or archived, and reports an open incident with an open Maintenance phase and no fix node; test-plan.md adds that failure; Build Phase 3 brings archived fixes into the graph.

## What let these through?

- A plan's claims that another plan is unbuilt are not re-read when that plan lands — findings: impl.md:918, test-plan.md:396, manager.ts:281 — highlight: h-20261020-005
- Each clause signal's source is not checked against the code it judges, so signals read the decider's own function, inputs or record — findings: impl.md:542, impl.md:839, impl.md:1143, impl.md:1155, impl.md:554, test-plan.md:46, test-plan.md:97 — highlight: h-20261020-006
- The impl does not trace which process a call runs in or what in-memory state it shares, so one plan was assumed to be one session — findings: impl.md:1131, impl.md:609, manager.ts:281, land.ts:62, impl.md:451, reopen.ts:1 — highlight: h-20261020-007
- Clause rows inject the seam they claim to prove, and earlier review fixes were appended without reconciling them with the ADR and brief — findings: impl.md:62, impl.md:226, impl.md:206, impl.md:84, test-plan.md:90, test-plan.md:111, adr.md:100, impl.md:1216, impl.md:833, impl.md:1125, impl.md:1280, impl.md:355, impl.md:316 — highlight: h-20261020-008
