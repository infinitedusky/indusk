---
title: "Run the graph — Test Plan"
date: 2026-10-19
status: draft
---

# Run the graph — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. The brief opts into `clauses: required`, so this is the clause plan: one section per promise, one per clause, each clause with its signal, its measure and its table. The assertions become the source rows for the impl's `## Test Trajectory`.

## Behavioral Assertions

**Every assertion is observable from outside the system:** which phases are running at a moment, what a phase's worktree holds when it starts, what a merge into a plan's branch or the trunk does, what a landing refuses and says, and what the runner's record shows. Wording follows the brief: a clause is upheld or broken; a "phase" is a build phase of a plan; "the runner" is the command that starts phases' sessions.

**How the levels were chosen (decision, auto policy).** The runner decides from a graph, a clock and a list of running sessions, so each rule is a `unit` test that feeds it those as inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`) — no test starts a daemon or waits on the wall clock. Merges are tested against real throwaway git repositories, which is still `unit` (a temp directory, no server). A `live check` appears only where the claim is that a real run, with real sessions and a real worktree, behaves so; those run in the system tier at landing and release, never in a phase's loop (`feedback-slow-at-release-fast-per-phase`). There is no `contract` row except where a store this plan does not own (git, the session registry) is read the way we expect.

## `the-work-runs-as-a-graph`

Every phase whose dependencies are done and whose files no running phase touches is running, up to the session cap, and no phase waits on one it does not depend on.

### `a-phase-names-what-it-needs` — each phase in a plan names the phases it depends on; one that names none depends on the phase before it

- Signal: the graph the runner reads from the impl, shown by `indusk plans` output for the plan. Upheld when every phase of a plan in a real run has a dependency list that matches its `needs` line, or the phase before it when it has none; broken reports the plan and the phase whose dependencies differ from what its impl says.
- Measure: share of phases in the next twenty parallel phases whose recorded dependencies differ from what their impl declared; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan with six build phases where Phases 1 and 3 name no dependencies, Phase 2 names 1 and Phase 5 names 2 and 3, shows exactly those dependencies. | unit |
| A2 | A plan written before this one, whose phases name nothing, shows each phase depending on the phase before it, and runs one phase at a time as it does today. | unit |
| A3 | A phase that names a phase which does not exist, or names itself, or whose dependencies form a loop, is refused when the impl is saved, naming the phase and the problem. | unit |
| A4 | The first phase of a plan, naming nothing, has no dependency and is ready as soon as the plan is approved. | unit |
| A5 | A test phase is read the same way as a build phase: a test phase's dependencies are shown as declared, and a build phase may depend on one. | unit |

### `ready-phases-start` — a phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room

- Signal: the runner's record of each phase, with the time it became ready and the time its session was launched, read by `indusk plans` output and the admin's plan page. Upheld when every phase's launch is within one minute of its becoming ready whenever the cap had room at that moment; broken reports the phase, the ready time and the launch time. Setting up its worktree is the phase's own time and is not counted.
- Measure: seconds from a phase becoming ready to its session being launched, for every phase in the next twenty parallel phases that had cap room; expect under sixty for all of them.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | Approving a plan whose Phases 1 and 3 need nothing starts both sessions at once; Phase 2 starts when 1 finishes and not before; Phase 5 starts only when both 2 and 3 have finished. | unit |
| A7 | A phase that becomes ready while the cap has room is launched within a minute on the clock the runner is given; the minute does not include creating the worktree. | unit |
| A8 | A phase that becomes ready when the cap is full is launched when a session ends, not before, and is not recorded as late. | unit |
| A9 | A real approved plan with two independent phases starts two sessions in two worktrees without the person running a command for the second. | live check |

### `no-needless-wait` — no phase is held back by a phase it neither depends on nor shares a file with

- Signal: the runner's record of why each waiting phase waits (a phase, a file, the cap, a hold). Upheld when every waiting phase in a real run names a reason that is one of those; broken reports a ready phase that waited with no reason, or whose reason is a phase it does not depend on and shares no file with.
- Measure: minutes a phase waited whose reason was none of its dependencies, a shared file, the cap or a hold; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | With a running phase touching `a.ts`, a ready phase touching only `b.ts` and depending on nothing running starts at once. | unit |
| A11 | A phase later in document order than a running phase, which does not depend on it and shares no file with it, starts without waiting for it. | unit |
| A12 | A ready phase that shares a file with a running phase waits, and the reason the record gives for it names that phase and that file. | unit |
| A13 | A phase that declares no files it touches is treated as touching every file of its plan, and waits for running phases of that plan; this is shown as its reason. | unit |
| A14 | A waiting phase whose reason has ended (the other phase finished, the file is free) starts on the next read of the graph, not on a timer. | unit |

### `graph-is-current` — when a phase ends, a plan is approved or a plan lands, the graph is read again before any next phase starts

- Signal: the runner's record, which shows a graph read before each launch. Upheld when no phase is launched from a graph older than the latest phase end, approval or landing; broken reports the launch and the event it did not account for.
- Measure: launches made from a graph older than the latest of those three events; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | A phase that ends frees its files and the next waiting phase on them starts from the graph as it is after that phase ended. | unit |
| A16 | A plan approved while other plans' phases are running has its ready phases considered at once, in the order the rules give, without waiting for a running phase to end. | unit |
| A17 | A plan that lands changes the graph: a phase of another plan that waited on its files is ready afterwards, and starts with the landed work. | unit |
| A18 | Two phases ending at the same moment cannot both claim the same freed file: one starts, the other waits and says why. | unit |

### `within-the-cap` — rests on `sessions-are-capped`

- Signal: the promise it rests on, `sessions-are-capped`, read where that promise is read (the machine's running-session count against `sessions.max`). Upheld while that promise is in force and a real parallel run never shows more phase sessions than the cap.

### `reviews-are-phases` — falsify, cleanup, the audit and an incident write are build phases of the graph like any other

- Signal: the plan's impl and the runner's record. Upheld when each review phase (a Falsification, Cleanup or Audit phase, or a Maintenance phase for an incident) appears in the graph with dependencies, files and order, and is launched by the same rule as a build phase; the steps that write them do not appear as phases. Broken reports a review phase launched outside the graph, or a step shown as a phase.
- Measure: review phases in the next five plans that were launched by something other than the graph; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | A Falsification Phase, a Cleanup Phase and an Audit Phase in an impl are listed in the graph with the dependencies they name, and start when those finish. | unit |
| A20 | A review phase that touches a file a running build phase touches waits for it, as a build phase would. | unit |
| A21 | The step that writes a Falsification Phase is not a node in the graph and takes no session slot. | unit |
| A22 | A Maintenance phase for an incident is a phase of the graph and obeys `a-broken-promise-jumps-the-line` for order. | unit |

## `a-phase-builds-on-its-own-branch`

Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified.

### `own-worktree` — every running phase has its own worktree and branch, cut from its plan's branch

- Signal: `git worktree list` and the runner's record. Upheld when every running phase has a worktree of its own on its own branch whose first commit's parent is on its plan's branch; broken reports a running phase sharing a worktree or branched from elsewhere.
- Measure: running phases sharing a worktree or branched off something other than their plan's branch, at any time; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A23 | Two phases of one plan running together are in two different worktrees on two different branches, both cut from the plan's branch. | unit |
| A24 | A phase's branch name says its plan and its phase, and two phases never get the same name. | unit |
| A25 | Work done by one running phase is not visible in another running phase's worktree. | unit |
| A26 | When a phase finishes and merges, its worktree and branch are removed; one that fails to merge is kept and listed. | unit |

### `starts-from-its-dependencies` — a phase starts with every finished phase it depends on merged into its worktree

- Signal: the phase's worktree at its first commit, read against the plan's branch. Upheld when every dependency's work is present in a phase's worktree when its session starts; broken reports the phase and the dependency whose work is missing.
- Measure: phases started without a finished dependency's work in their worktree; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A27 | Phase 5, depending on 2 and 3, starts with both phases' files present in its worktree. | unit |
| A28 | Phase 2 does not see the work of Phase 3 if it does not depend on it, even when 3 finished first. | unit |
| A29 | A dependency whose merge into the plan's branch conflicts with the phase's start is resolved by the same rule as any conflict (`agent-resolves-first`); the phase does not start with half a merge. | unit |
| A30 | A real plan with a dependent pair: the later phase's session, started by the runner, reads a file only the earlier phase wrote. | live check |

### `starts-from-the-work-it-waited-for` — a phase that waited on another plan's phase for a file starts with that phase's finished work merged in, landed or not

- Signal: the phase's worktree and the runner's record naming the phase it waited on. Upheld when a phase that waited on another plan's phase starts with that phase's work in its worktree; broken reports the phase and the missing work.
- Measure: phases that waited on another plan's phase and started without its work; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A31 | A phase in `homework-gate-reports` that waited for a phase in `homework-gate-login` on `auth.ts` starts with that phase's change to `auth.ts` in its worktree. | unit |
| A32 | The same holds when the earlier plan has not landed: the work is taken from the earlier plan's branch. | unit |
| A33 | The waiting phase's plan is recorded as having pulled the earlier plan's unlanded work (what `landing-follows-what-it-pulled` reads). | unit |

### `green-before-merging` — a phase merges into its plan's branch only when, with the merge made, its own tests and the tests of every clause the plan's branch has touched pass

- Signal: the runner's record of each merge, with the tests it ran and their result. Upheld when every merge into a plan's branch shows a green run of the phase's tests and of every touched clause's tests, run on the merged result; broken reports a merge with a red or missing run.
- Measure: merges into a plan's branch whose recorded run was red or absent; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A34 | A phase whose tests pass alone but fail once merged with another finished phase is not merged; the record names the failing tests and the phase it was joined with. | unit |
| A35 | Two phases that each pass alone and break something only together: the second to finish is stopped at its merge, the first stays merged. | unit |
| A36 | A phase that passes, with every touched clause's tests passing, merges into the plan's branch. | unit |
| A37 | A phase that fails its merge check is kept (worktree and branch) and listed as stopped with the failing tests, and the phases that do not depend on it keep running. | unit |
| A38 | The tests run for the merge include those of clauses the plan's branch touched through other phases, not only the clauses of the phase being merged. | unit |
| A39 | A real plan where two phases collide only in combination is stopped at the join. | live check |

### `every-phase-is-checked` — a phase that runs no test never merges, and a phase that touches a clause carries that clause's signal

- Signal: the runner's record and the phase's rows. Upheld when every merged phase ran at least one test and every phase touching a clause carries that clause's signal; broken reports the merged phase that ran none, or the clause without its signal.
- Measure: phases merged with no test run, and phases touching a clause without its signal, over the next twenty parallel phases; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A40 | A phase whose check runs no test is not merged; it is listed as unchecked with that reason. | unit |
| A41 | A phase that touches a clause without carrying the clause's signal is not merged; the record names the clause. | unit |
| A42 | A phase whose rows are all deferred is refused a merge the same way as one with no rows. | unit |
| A43 | A phase touching a clause with its signal and a passing test merges. | unit |

### `only-the-plan-lands` — nothing reaches the trunk from a phase's branch; only a plan's branch, once its promises are verified

- Signal: the trunk's history. Upheld when every commit that reached the trunk through the runner came from a plan's branch landing, never from a phase's branch; broken reports the commit and its source branch.
- Measure: phase branches merged into the trunk directly; expect none, ever.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A44 | A phase's finished work is on the plan's branch and not on the trunk until the plan lands. | unit |
| A45 | An attempt to land a phase's branch is refused, naming the plan it belongs to. | unit |
| A46 | A plan whose promises are not verified is refused landing even when every phase merged. | unit |

## `earlier-plans-go-first`

When phases of different plans are ready and want the same file, the phase of the plan that comes first runs next: earlier in the plan tree, read top-down from the root master through each parent's ordered children; a plan with no place in the tree comes after every plan that has one, and among those the one approved earlier.

### `earliest-next` — of ready phases that want a file a running phase holds, the earliest plan's runs next when that file is free

- Signal: the runner's record of each start with the ready phases that wanted the same file. Upheld when each start of a contested file is the earliest plan's phase; broken reports the phase that started and the earlier plan's phase it passed over.
- Measure: starts of a contested file where a later plan's phase went before an earlier plan's; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A47 | Two ready phases of `homework-gate-login` and `homework-gate-reports` both want `auth.ts`, which a running phase holds: when it frees, the earlier plan's phase starts and the other keeps waiting. | unit |
| A48 | Every other phase of both plans, not touching `auth.ts`, keeps running while the contest is open. | unit |
| A49 | A plan with no place in the tree goes after every plan that has one; two such plans go in the order they were approved. | unit |
| A50 | The place of a plan is read from the tree on every graph read: a plan reordered between reads takes its new place at the next contest. | unit |
| A51 | Two phases of the same plan wanting the same file go in the order of the plan's phases, not by an arbitrary rule. | unit |
| A52 | The record names the order used and why (the plan's place), so a person reading why a phase waited can follow it. | unit |

### `a-broken-promise-jumps-the-line` — a fix phase gets the next free session ahead of every phase that is not a fix, and the phases touching its files depend on it

- Signal: the runner's record and the dependency list of the phases touching the fix's files. Upheld when a fix phase is launched at the first free session ahead of every non-fix phase, every not-yet-started phase touching its files lists it as a dependency, and every running phase touching them merged the fix before merging into its plan; broken reports the fix passed over, or the phase that started without or merged without it.
- Measure: minutes from a fix phase becoming ready to its session launching when any non-fix phase was waiting; expect the same as for a phase with cap room (under one minute after a session frees). Fix phases passed over by a non-fix phase; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A53 | With the cap full and one free session coming, a ready fix phase from the latest plan takes it ahead of a ready non-fix phase from the earliest plan. | unit |
| A54 | A phase not yet started that touches the fix's files is shown depending on the fix, and starts with the fix merged in. | unit |
| A55 | A phase already running that touches the fix's files is not stopped; it merges the fix before it merges into its plan. | unit |
| A56 | A phase that touches none of the fix's files is unaffected and starts as it would have. | unit |
| A57 | Two fixes ready together take sessions in the order of their plans' places. | unit |
| A58 | A real broken promise with its Maintenance phase written overnight starts at the first free session and its dependents start with the fix present. | live check |

### `never-interrupted` — rests on `a-hold-is-cheap`

- Signal: the promise it rests on, `a-hold-is-cheap`, read where that promise is read. Upheld while it is in force.

## `trunk-cascades`

When anything lands on the trunk, every open plan's branch merges it, and a running phase's worktree merges it when that phase ends; a conflict is resolved by an agent with the plan's tests as the check, or becomes a question when it cannot be.

### `branches-follow-the-trunk` — within five minutes of a landing, every open plan's branch with no running phase has merged it

- Signal: the trunk's head against each open plan's branch, read with the time of the landing. Upheld when, five minutes after a landing, every open plan's branch with no running phase contains the landing; broken reports the plan and how long its branch has been behind.
- Measure: minutes from a landing to the last idle open plan's branch containing it, over the next ten landings; expect under five for all of them.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A59 | A plan lands; five minutes later, three open plans with no running phase each contain the landed work. | unit |
| A60 | An open plan with a running phase is not merged into at that moment and is not interrupted; its branch follows when the phase ends. | unit |
| A61 | A landing that happens while the runner is not running is caught up on the runner's next read, not forgotten. | unit |
| A62 | A plan not yet approved, or already landed, is not merged into. | unit |
| A63 | In a workbench, the trunk is each repo's own: a landing in one repo is merged only into open plans' branches of that repo. | unit |
| A64 | A real landing, with two open plans idle, brings both branches up to date within five minutes. | live check |

### `phase-merges-at-its-end` — a running phase merges the trunk when it ends, before it merges into its plan

- Signal: the runner's record of each phase's end, showing the trunk merge before the plan merge. Upheld when every phase that ended after a landing it had not seen merged the trunk first; broken reports the phase merged into its plan without the landing.
- Measure: phases merged into their plan without the trunk's latest landing; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A65 | A phase running when a plan lands is not interrupted; when it ends, the landed work is in its worktree before it merges into its plan. | unit |
| A66 | A phase that started after the landing does not merge it again, and nothing is recorded as a merge. | unit |
| A67 | A phase that ends with a trunk merge that conflicts is handled by `agent-resolves-first`, and does not merge into its plan until that is settled. | unit |

### `agent-resolves-first` — a conflicting merge is resolved by an agent and kept only with the plan's tests passing; otherwise it becomes a question naming the files, and only that plan's affected phases go on hold

- Signal: the runner's record of each conflict, its resolution, the tests run on it and the outcome. Upheld when every conflict is either resolved with the plan's tests recorded passing, or recorded as a question naming the files with only that plan's affected phases on hold; broken reports a resolution kept with failing or missing tests, or a hold wider than the plan's affected phases.
- Measure: the share of merges that conflict, and of those the share an agent resolved with the plan's tests passing, read from the runner's record after the first twenty parallel phases (the brief's second expectation). Resolutions kept with a red or missing test run; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A68 | A conflicting merge the agent resolves, with the plan's tests then passing, is kept and the phase goes on. | unit |
| A69 | A resolution after which the plan's tests fail is thrown away: the branch is as it was before the merge. | unit |
| A70 | A conflict the agent cannot resolve becomes a question naming the conflicting files, and only the affected phases of that plan go on hold. | unit |
| A71 | The plan's other phases, and every phase of every other plan, keep running while that question is open. | unit |
| A72 | A conflict at any of the four merge points (phase start, phase into plan, trunk cascade, before landing) is handled the same way. | unit |
| A73 | The runner's record counts merges, conflicts, and agent resolutions with tests passing, so the brief's second expectation can be read from it. | unit |
| A74 | A real conflict between two phases' edits to one file is resolved by an agent and the plan's tests still pass. | live check |

## `landing-follows-what-it-pulled`

A plan whose phase pulled another plan's unlanded work cannot land before that plan, and merges that work again before it lands.

### `lands-after` — a plan holding another plan's unlanded work is refused landing, naming that plan, until it has landed

- Signal: the output of the landing command and the plan's pulled-work record. Upheld when a plan with another plan's unlanded work in its branch is refused landing, with the other plan named, and lands once that plan has landed; broken reports a plan that landed first.
- Measure: plans landed while holding another plan's unlanded work; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A75 | `homework-gate-reports`, whose phase pulled `homework-gate-login`'s unlanded change to `auth.ts`, is refused landing and told to wait for `homework-gate-login`. | unit |
| A76 | The same plan lands after `homework-gate-login` has landed. | unit |
| A77 | A plan that pulled only work that has since landed is not refused. | unit |
| A78 | A plan that pulled nothing from another plan lands as it does today. | unit |

### `merges-again-before-landing` — before it lands, such a plan merges the trunk with the other plan's landed work in it

- Signal: the plan's branch against the trunk at landing. Upheld when a plan that pulled another plan's work contains the trunk with that work landed before it lands; broken reports the plan that landed without the merge.
- Measure: plans that pulled unlanded work and landed without merging the trunk after the other plan's landing; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A79 | After `homework-gate-login` lands, `homework-gate-reports` merges the trunk before it lands, and its landing branch contains `homework-gate-login`'s work as landed. | unit |
| A80 | If that merge conflicts, `agent-resolves-first` applies and the landing waits for it. | unit |
| A81 | The plan's tests are run on the merged result before the landing proceeds. | unit |

## `a-hold-is-cheap`

Nothing stops: a running phase always finishes, and a phase put on hold is set aside so the rest of the graph goes on without it; it does its own catching up when it is ready again.

### `running-phases-finish` — a running phase is never stopped to let another in

- Signal: the runner's record of each session's start and end. Upheld when no session was ended by the runner while its phase was running, for any reason other than the phase finishing, failing or being put on hold by a question or amendment; broken reports the phase and what stopped it.
- Measure: running phases stopped by the runner to make room for another; expect none, ever.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A82 | With the cap full and a fix phase ready, no running phase is stopped; the fix waits for the first free session. | unit |
| A83 | A plan landing, a plan being approved, or an earlier plan wanting a running phase's file does not stop that running phase. | unit |
| A84 | A real running phase continues to its end while the trunk changes and a fix is queued. | live check |

### `a-hold-frees-its-files` — a phase put on hold gives up its turn on its files at once, so phases waiting only for those files go ahead; phases that need its output still wait

- Signal: the runner's record of a hold and the waiting phases' reasons. Upheld when a phase put on hold is no longer given as the reason any phase waits for a file, and phases that depend on it still show it as their reason; broken reports a phase still waiting on a held phase's file, or a dependent starting without the held phase's output.
- Measure: seconds from a hold to the next phase waiting only for its files starting; expect under sixty (the same as a ready phase).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A85 | A phase waiting only for `auth.ts` starts as soon as the phase holding it is put on hold. | unit |
| A86 | A phase that depends on the held phase keeps waiting, and the record says it waits for the held phase's output. | unit |
| A87 | A held phase's session slot is released and a ready phase can take it. | unit |
| A88 | A phase put on hold by a conflict it could not resolve frees its files in the same way, and the question that caused it is listed. | unit |
| A89 | A phase put on hold for an amendment frees its files the same way. | unit |

### `the-held-phase-catches-up` — when a held phase is ready again it waits for any active phase it now depends on, merges what finished meanwhile that touches its files, and carries on from where it stopped

- Signal: the held phase's record after it is released, with the phases it waited for, the work it merged and where it resumed. Upheld when a released phase waits for every active phase it now depends on, merges the finished work touching its files, and resumes from its stopping point; broken reports the phase that resumed without a dependency's work or restarted from the beginning.
- Measure: held phases that resumed without merging finished work touching their files, or that restarted rather than resuming; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A90 | A held phase released after another phase finished a change to its files resumes with that change merged in. | unit |
| A91 | A held phase released while an active phase it now depends on is still running waits for it, then merges its work and resumes. | unit |
| A92 | A held phase resumes from where it stopped: work it did before the hold is kept, not redone. | unit |
| A93 | A held phase released when nothing touched its files resumes at once with nothing to merge. | unit |
| A94 | A hold lasting across a landing is caught up with the trunk as part of its catching up. | unit |
| A95 | A real phase held on a question and released by the answer resumes and finishes. | live check |

## Not for a promise

Assertions that prove no promise of this plan, each with why it is still worth a test.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A96 | A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the session already running; a plan can have a planning session and several phases building at once. | unit | The existing promise `a-session-belongs-to-its-plan` is one this plan changes; this row proves the new behaviour. |
| A97 | A second session of the same kind on the same phase is refused, naming the one already running. | unit | The remaining half of the changed promise; it must still hold. |
| A98 | A plan that is not approved has no phase in the graph, and no phase of it starts. | unit | Must-not-break: `a-plan-builds-only-after-approval`. |
| A99 | A plan's documents are still written on its own branch, and phases branch from that branch, not from the trunk. | unit | Must-not-break: `a-plan-is-written-on-its-own-branch`. |
| A100 | A phase boundary still names the command for what runs next, and the runner runs it. | unit | Must-not-break: `a-plan-boundary-names-the-next-session`. |
| A101 | Running with the cap at one yields the same order and the same result as today's one-phase-at-a-time run for a plan whose phases name nothing. | unit | A regression guard: the zero-migration claim of `a-phase-names-what-it-needs`. |
| A102 | The existing manual `/work` path for one phase still works unchanged when no runner is active. | unit | A regression guard: the runner is added beside the manual path, not instead of it. |

## Expectations

Neither brief expectation is a test; each is read from the runner's record or from phase start and end times after the work is used. They are listed so their measure is not lost.

| ID | Expectation | How it is read | When |
|----|-------------|----------------|------|
| E1 | A master finishes in about the time of its longest chain of dependent phases, not the sum of its phases. | For Homework Gate's first milestone, the time from its first plan's approval to its last plan's landing, against the sum of its phases' durations and against its longest dependent chain, from phase start and end times. | When that milestone's last plan lands. |
| E2 | Merging at phase boundaries rarely needs a person. | The share of the runner's merges that conflict, and of those the share an agent resolved with the plan's tests passing (A73 makes the record say so). | After the first twenty phases run in parallel. |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A master finishes in about the time of its longest chain (the first expectation). | The time depends on real plans' durations over days; no test can compress it. | A figure read from phase start and end times at the milestone's last landing (E1 above). |
| U2 | An agent's merge resolution is correct beyond the plan's tests passing. | Whether a resolution is right is a judgment tests cannot fully give; the check is the plan's tests, which the brief names as the keep-rule. | A74 proves a real resolution keeps tests passing; the retrospective reads the runner's record of conflicts; E2's share shows whether people end up resolving after all. |

## Notes

- **Decision (auto policy): the effort-in-the-tier idea from `research.md` has no rows here.** The research's "Proposed shape" is marked "not decided", and the accepted brief holds no promise for it, so a row would prove something no promise names. It stays an open item for a later brief change. Reason: a test plan proves the accepted brief; adding rows for an undecided design would invent a promise.
- **Decision: dependencies are declared with a phase's own line, and a phase naming none depends on the one before it.** Chosen because the brief says so (`a-phase-names-what-it-needs`); the exact spelling of the line is the ADR's, and A1 to A5 are written against behaviour, not spelling.
- **Decision: a phase with no declared files is treated as touching all its plan's files.** The brief does not say. Chosen as the safe reading (A13): an unknown set of files cannot be shown free, and treating it as empty would let two phases collide unseen. Reversible by the ADR; if it declares otherwise, A13 changes with it.
- **Decision: a hold's trigger is out of scope.** Questions that hold belong to `decisions-as-questions`, and amendments to `brief-as-the-contract`. This plan's rows (A85 to A95) prove what a hold does to the graph given one; A88 and A89 use a conflict and an amendment because both exist today, so no row waits on a plan not yet built.
- **Decision: live checks (A9, A30, A39, A58, A64, A74, A84, A95) run in the system tier, never in a phase's loop.** Each needs real sessions and worktrees. They run at landing and by `indusk release`, as the system tier does for the other plans.
- **Open decision: a failed merge check (A37) keeps the phase listed as stopped and does not start a repair.** The brief says a phase merges only when green but not what follows a red; the ADR should decide whether a stopped phase is retried, put on hold or raised as a question. The row asserts only what is certain: it is kept, listed and does not stop unrelated phases.
- **Open decision: how a plan "touching" a clause is read for `green-before-merging` (A38).** The row says "every clause the plan's branch has touched", following the brief; the ADR must say whether touching is read from the plan's rows, from changed files, or both.
- The signal for each clause leans on the runner's record; the ADR must name where that record lives. If it is machine state (`~/.indusk/projects/…`), the admin reads it; the brief's "this plan changes no screen" means the record is read through `indusk plans` output, which A12 and A52 assume.
