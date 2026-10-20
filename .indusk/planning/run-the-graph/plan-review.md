---
plan: run-the-graph
reviewed: 2026-10-19
read: 93aaf8e30382121dcfe9cd76ae68734a0a5dc733288b0f7df95f63ad54b4fd5e
model: claude-opus-5-5
---

# Plan review — run-the-graph

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/run-the-graph/impl.md:76 — T24, T25 (the work-step and launch rows for `ready-phases-start`) and T35 (the live check) all drive stand-in or scripted sessions that tick only their own phase's boxes, so no row proves that a real `/work` session started for one phase works only that phase; the real session prompt (`build-session.ts:65`, "Work the plan's open phases in order until every one is closed") is never exercised against the graph.
  - breaks when: a real phase session is launched in its own worktree and works the first open phase of its impl copy instead of the one it was launched for.
  - answer: fix — impl.md and test-plan.md (A47): the work prompt names the one phase and `INDUSK_BUILD_PHASE` makes the gate hook refuse a tick of any other phase (rows T37, T38, written red in Test Phase 1), so a real session cannot close another phase whatever it tries; the ready-phases-start signal checks each phase end's impl diff against the launched phase
- .indusk/planning/run-the-graph/test-plan.md:170 — A29 / T19, the merge-scope selection row for `green-before-merging`, checks only that rows "not yet written" are left out; no fixture has a row written at a done phase but passing at a later one (the shape every tests-first plan has, e.g. this plan's T9: written at Test Phase 1, passes at Build Phase 3), so the row passes while the real selection includes deliberately red tests.
  - breaks when: a plan with a Test Phase 1 writes red rows that pass later, and every merge check runs them.
  - answer: fix — test-plan.md A29 and impl.md T19: the selection keeps only rows whose Passes-at phase is this one or a merged one, and T19's fixture has a row written at a done Test Phase 1 that passes at a later build phase, which must be left out
- .indusk/planning/run-the-graph/test-plan.md:54 — the `ready-phases-start` rows (A4 to A9) assert order and that a launch eventually happens; none asserts the one-minute bound while a merge check is running, and the merge (D6, one at a time per plan, running the plan's touched-clause and Must-not-break tests) is driven in tests by an instant `fixtureRunner`.
  - breaks when: a merge check takes longer than a minute and the driver does not launch a phase that became ready, or got cap room, until it returns.
  - answer: fix — adr.md D4 and impl.md Build Phase 6: merges run in their own per-plan queue that the launcher never awaits; T26 and A16 add a merge whose check never returns while a freed cap place must still be filled; the ready-phases-start fails-when list names the case

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/impl.md:629 — The work step launches each phase through `runStepSession` with `step: "work"`, but no item and no Files line touches `lib/build/build-session.ts`: the prompt still says to work every open phase in order, `manager.start` is given no `phase`, and there is no channel for "relaunch the session told why" on a retry. **Would stop the plan working entirely.**
  - breaks when: Build Phases 1 and 3 launch together; the Phase 3 session finds Build Phase 1 open in its own impl copy and works it, so two sessions build Phase 1 and Phase 3 is never worked alone.
  - answer: fix — impl.md Build Phase 6 now declares `build-session.ts` and has an item for it: `stepPrompt`/`runStepSession` take the phase and a retry note, the prompt says to work only that phase, and `stepEnv` sets `INDUSK_BUILD_PHASE`, enforced by the gate hook from Build Phase 1 (T37, T38); adr.md D4 states it
- .indusk/planning/run-the-graph/impl.md:539 — The merge scope includes "rows written or passing at this phase" and "every row of a done phase", which takes in the red-by-design rows a Test Phase writes (T5, T9, T10, T11 here). The check refuses a merge unless every test passes. **Would stop the plan working entirely.**
  - breaks when: Test Phase 1 ends; its merge check runs its own red rows, fails three times and stops, and every build phase (each depends on Test Phase 1 by D1) waits forever; any later merge also runs rows of done phases that only pass at a phase not yet merged.
  - answer: fix — adr.md D6 and impl.md Build Phase 5: the must-pass set excludes every row whose Passes-at phase is not yet merged, and a test phase is judged by the test-phase rule (its own rows pass; its later rows must fail on an assertion, a file that does not load refuses), new row T40 / assertion A49; the green-before-merging signal checks the same
- .indusk/planning/run-the-graph/impl.md:467 — The phase branch is `phase/<plan>/<n>` with `n` taken from the heading, but Test Phase N and Build Phase N share a number (`impl-parser-core.ts:44`), and merged branches are kept until landing.
  - breaks when: Build Phase 1 starts after Test Phase 1 merged and finds `phase/p/1` already there, so it "resumes" on the test phase's branch; or Test Phase 2 and Build Phase 2 run together and both reuse one branch and worktree.
  - answer: fix — adr.md D5, impl.md Build Phase 4 and T13 / A22: branches are `phase/<plan>/test-<n>` and `phase/<plan>/build-<n>` (worktree paths likewise), and T13 asserts Test Phase 2 and Build Phase 2 differ and Build Phase 1 after a merged Test Phase 1 is cut fresh
- .indusk/planning/run-the-graph/impl.md:641 — The host's 30-second `setInterval` tick "re-reads and launches" independently of `runGraphStep`'s own loop, and nothing serialises the two, though D6 merges one phase per plan at a time and A17 says a waiting phase starts once.
  - breaks when: a tick fires while the loop is handling a phase end, both pick the same ready phase, and `startPhase` runs twice (a second `git worktree add` fails and stops the phase, or two merges of one plan run at once).
  - answer: fix — adr.md D4 and impl.md Build Phase 6: one single-flight `pass()` does every launch; session ends, merge results and the tick only request a pass (coalesced), and merges go through one per-plan queue; T26 / A17 add a tick during a phase end launching each ready phase once
- .indusk/planning/run-the-graph/adr.md:141 — Workbench plans are left out of the graph, which narrows `the-work-runs-as-a-graph` ("Within an approved plan, every phase…"). This is left as an open decision "needing Sandy's word", with no amendment to the promise.
  - breaks when: any workbench plan is approved: its independent phases run one at a time, and the promise reads broken, or is wrongly read as holding.
  - answer: fix — the brief was already amended (Sandy, 2026-10-19): its promise sentence says "not a workbench plan" and Not promised lists workbench plans; adr.md drops the open decision and records the exclusion in D4, and test-plan.md's promise sentence matches the brief
- .indusk/planning/run-the-graph/impl.md:145 — The phase key is used inconsistently: dependency lines name `Build Phase 6`, the T3 body looks a node up as `Phase 7: Falsification`, `phaseLabel` (`next-step.ts:113`) gives `Build Phase 2: <name>`, and the falsify skill writes `### Phase N: Falsification —`. D1 says names are "headings as written", and an unknown name is refused at save.
  - breaks when: a falsify or cleanup phase names `Build Phase 6` while the heading reads `### Phase 6:`, or the reverse; it is refused at save or its dependency does not resolve.
  - answer: fix — adr.md D1, test-plan.md and impl.md Build Phase 1: one key, kind and number (`phaseKey`: `Phase N` is `Build Phase N`, words after the colon dropped), used by lines, nodes, branches and signals; `phaseLabel` stays display only; A3 / T2 and the parity test cover both heading forms, and the T3 body looks up `Build Phase 7`

## Which skip reason would you not accept?

- .indusk/planning/run-the-graph/test-plan.md:43 — The `ready-phases-start` signal skips a plan "whose build is stopped". After an admin restart the build's record reads stopped, nothing restarts it on its own (only `startBuild` from a button, the approve route or a question answer calls `restartFor`), and so the stranded ready phases the fails-when list says the "first tick after it starts" reports are exactly the ones exempted.
  - breaks when: the admin restarts mid-build; no phase launches until a person presses Build, and the signal judges nothing.
  - answer: fix — impl.md Build Phase 6 and adr.md D4: on start the admin (`instrumentation.ts`) resumes every build the restart ended (a dead record with no recorded stop); the signal now exempts only a build stopped on a recorded stop and judges one a restart ended; A9 / T28 assert the resume happens with nobody pressing Build
- .indusk/planning/run-the-graph/impl.md:32 — "Workbench plans: … awaiting Sandy" is an exclusion from an accepted promise with no decision behind it.
  - breaks when: the plan is approved and closed with the workbench exclusion unresolved.
  - answer: fix — impl.md Out of Scope now cites the brief's promise sentence and Not promised entry (Sandy, 2026-10-19) and ADR decision D4; nothing awaits a decision
- .indusk/planning/run-the-graph/test-plan.md:195 — For `only-the-plan-lands`, "a plan lands with its promises not verified" is left without a signal because landing runs the clause tests. Passing clause tests is not "its promises verified" in the clause's sense, so the second half of the sentence has no signal.
  - breaks when: a plan lands whose clause tests pass but whose promises were never confirmed.
  - answer: fix — test-plan.md (only-the-plan-lands) and impl.md Build Phase 5: the landing span also reads each promise the brief makes at the landing's plan-side parent and reads broken unless it is confirmed (`state: enforced`)

## What else would have to change for each promise to hold?

- apps/indusk-mcp/hooks/check-gates.js:535 — The gate hook refuses ticking an implementation item while any earlier phase in document order has unchecked gate items, and Gate B (line 495) refuses advancing past rows due at earlier phases. Neither is in any phase's Files line or item. **Would stop the plan working entirely.**
  - breaks when: Build Phase 3 runs beside an open Build Phase 1 in its own worktree; every item it ticks is refused, or the unattended session "skips" Build Phase 1's gates with reasons to get past it, so it never closes or it corrupts another phase's gates.
  - answer: fix — impl.md Build Phase 1 now declares and changes `check-gates.js`: the item loop and Gates A and B judge a phase against its declared dependencies (direct and through them) via a shared `hooks/_phase-depends.js`, unchanged for impls with no lines; T36 / A46 written red in Test Phase 1; T37 refuses a session's tick of another phase, so it cannot skip Build Phase 1's gates
- apps/indusk-mcp/src/lib/build/next-step.ts:77 — The build stops for a declared judgement or a blocker only on the first open phase, and the graph bypasses that for every other ready phase. `a-build-runs-to-review-unasked` ("stops … for a judgement the plan declared") is not in Must-not-break and no item keeps it.
  - breaks when: a phase other than the first open one carries a manual-smoke or deferred-verification item, and the graph runs it unattended past the judgement.
  - answer: fix — adr.md D3/D4 and impl.md Build Phases 1, 2, 6: each node carries `detectHumanGate`'s items and its blocker, such a phase is never launched (reason `person`), and once nothing else can run the step returns the judgement stop as today; regression-guard row T39 / A48 names `a-build-runs-to-review-unasked`
- apps/indusk-admin/src/lib/build-host.ts:974 — Under D7 the graph keeps running the other phases after a phase session stops on a question. But an answer given in that window calls `resumeAfterQuestion` → `startBuild`, which throws "already building"; when the step later returns the question, the host calls `holdQuestion` on a question already answered.
  - breaks when: the person answers while other phases are still running; the plan then waits on a held question that nobody will answer again (`the-cost-sets-the-wait`, A41).
  - answer: fix — adr.md D7 and impl.md Build Phase 6: `resumeAfterQuestion` finding the build running releases the question and returns instead of calling `startBuild`; the step checks the question record before ending and resumes the asking phase in the same run; the host holds only an unanswered question; A41 / T30 extended
- .indusk/planning/run-the-graph/adr.md:52 — The changelog and every `CLAUDE.md` are exempt from overlap so parallel phases may edit them, but D6 aborts any conflict outside `impl.md` and counts it as a failed attempt. This plan's own phases append to the changelog's Unreleased block and to `apps/indusk-mcp/CLAUDE.md` "Run the graph", and Build Phases 1, 2, 4, 5 and 6 each edit `apps/docs/src/guide/phases-in-parallel.md`, which no Files line declares.
  - breaks when: two parallel phases both append at the same point of an exempt or undeclared file; the second's merge conflicts on each try and the phase is stopped after three.
  - answer: fix — adr.md D1 and test-plan.md A14: only the impl is exempt; the changelog, `CLAUDE.md` files and docs pages are declared by the phase that edits them. impl.md: the guide page is edited only by Build Phases 1, 2 and 6 (a chain) and declared by each; the changelog entry and the package `CLAUDE.md` section are written only by Build Phase 6, which depends on all; Build Phases 1, 3, 4, 5 hold their rules as guards and each declares its own docs page
- .indusk/planning/run-the-graph/impl.md:269 — "An undeclared set overlaps every path its plan's phases declare" says nothing when the other phase is also undeclared, or when no phase declares anything: the union is empty. A13 promises such a phase "waits for its plan's running phases".
  - breaks when: two phases with `**Depends on**: none` and no files line become ready together; they run at once on unknown files.
  - answer: fix — adr.md D1, test-plan.md A13 and impl.md T7: an undeclared set overlaps every other set, declared or undeclared, so an undeclared phase never runs beside another phase of its plan; the no-needless-wait signal names two undeclared phases running at once

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/impl.md:485 — `own-worktree`: the signal checks that a path and a branch appear once in `git worktree list`. When Test Phase N and Build Phase N resolve to one `phase/<plan>/<n>` and the second "resumes" the first's worktree, the list still shows each once.
  - breaks when: two phases share one worktree and branch through the number collision, and the span reads upheld.
  - answer: fix — the collision is gone (`test-<n>` / `build-<n>`), and the own-worktree signal (test-plan.md, impl.md Build Phase 4) checks the branch is the name its own plain rule gives the phase's kind and number
- .indusk/planning/run-the-graph/test-plan.md:64 — `no-needless-wait`: the signal compares overlap by expanding declared paths against `git ls-files` on the plan's branch, so a declared path to a file not yet created matches nothing. Most of this plan's own Files lines are new files.
  - breaks when: two running phases both declare (and write) the same new file; the signal finds no concrete shared path and reads upheld.
  - answer: fix — test-plan.md and impl.md Build Phase 2: the no-needless-wait signal also compares the declared strings with each other and each running phase branch's changed files, so a shared new file is seen declared or written
- .indusk/planning/run-the-graph/impl.md:575 — `green-before-merging`: the signal requires a test file in the report only for every touched clause. The phase's own rows that are not clause rows (regression guards, Must-not-break tests) are not checked for presence, though the clause says "its own tests … pass".
  - breaks when: the merge check drops the phase's own non-clause tests or the Must-not-break tests, and the report is still all green.
  - answer: fix — test-plan.md and impl.md Build Phase 5: the green-before-merging signal's own list now holds every row of the merged and finished phases that should pass, every touched clause's tests and each Must-not-break promise's listed tests, and requires each in the report
- .indusk/planning/run-the-graph/impl.md:587 — `only-the-plan-lands`: the signal lists phase branches with `for-each-ref refs/heads/phase/` only after a landing or an approval.
  - breaks when: someone merges a phase branch into the trunk and deletes the branch before the next landing; nothing lists it.
  - answer: fix — test-plan.md and impl.md Build Phases 5 and 6: the only-the-plan-lands signal also runs on each driver tick and reads phase tips from the plan branch's reflog, which keeps them after the branch is deleted
- .indusk/planning/run-the-graph/impl.md:629 — `the-work-runs-as-a-graph`: no signal compares the phase a session was launched for with the phase it actually worked; the read, schedule, launch and merge spans all key on the launched phase.
  - breaks when: a phase session works a different open phase (the unchanged work prompt), and every span reads upheld.
  - answer: fix — test-plan.md and impl.md Build Phase 6: the ready-phases-start signal, at each phase end, reads a plain diff of the impl between the plan's branch and the phase's branch and reads broken for a box ticked outside the launched phase's section

## What let these through?

- The plan changes an invariant the whole system assumes (a plan's phases run one at a time) but listed only the modules it adds; no step asked which existing code assumes the old invariant — findings: impl.md:76, impl.md:629, impl.md:539, check-gates.js:535, next-step.ts:77, build-host.ts:974, test-plan.md:170 — highlight: h-20261020-009
- A new key (phase name, phase branch) was chosen without checking how the parser numbers phases, and the signal built on that key could not see the collision — findings: impl.md:467, impl.md:145, impl.md:485 — highlight: h-20261020-010
- No step listed the runner's own concurrent paths, and signals were planned whose exemption or source matched the failure they should catch — findings: impl.md:641, test-plan.md:54, adr.md:52, impl.md:269, test-plan.md:43, test-plan.md:64, impl.md:575, impl.md:587, test-plan.md:195 — highlight: h-20261020-011
- no process gap — the workbench open decision (adr.md:141, impl.md:32) was settled by Sandy and written into the brief before this read; the ADR and impl had not yet caught up
