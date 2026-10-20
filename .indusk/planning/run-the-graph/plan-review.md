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
- .indusk/planning/run-the-graph/test-plan.md:170 — A29 / T19, the merge-scope selection row for `green-before-merging`, checks only that rows "not yet written" are left out; no fixture has a row written at a done phase but passing at a later one (the shape every tests-first plan has, e.g. this plan's T9: written at Test Phase 1, passes at Build Phase 3), so the row passes while the real selection includes deliberately red tests.
  - breaks when: a plan with a Test Phase 1 writes red rows that pass later, and every merge check runs them.
- .indusk/planning/run-the-graph/test-plan.md:54 — the `ready-phases-start` rows (A4 to A9) assert order and that a launch eventually happens; none asserts the one-minute bound while a merge check is running, and the merge (D6, one at a time per plan, running the plan's touched-clause and Must-not-break tests) is driven in tests by an instant `fixtureRunner`.
  - breaks when: a merge check takes longer than a minute and the driver does not launch a phase that became ready, or got cap room, until it returns.

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/impl.md:629 — The work step launches each phase through `runStepSession` with `step: "work"`, but no item and no Files line touches `lib/build/build-session.ts`: the prompt still says to work every open phase in order, `manager.start` is given no `phase`, and there is no channel for "relaunch the session told why" on a retry. **Would stop the plan working entirely.**
  - breaks when: Build Phases 1 and 3 launch together; the Phase 3 session finds Build Phase 1 open in its own impl copy and works it, so two sessions build Phase 1 and Phase 3 is never worked alone.
- .indusk/planning/run-the-graph/impl.md:539 — The merge scope includes "rows written or passing at this phase" and "every row of a done phase", which takes in the red-by-design rows a Test Phase writes (T5, T9, T10, T11 here). The check refuses a merge unless every test passes. **Would stop the plan working entirely.**
  - breaks when: Test Phase 1 ends; its merge check runs its own red rows, fails three times and stops, and every build phase (each depends on Test Phase 1 by D1) waits forever; any later merge also runs rows of done phases that only pass at a phase not yet merged.
- .indusk/planning/run-the-graph/impl.md:467 — The phase branch is `phase/<plan>/<n>` with `n` taken from the heading, but Test Phase N and Build Phase N share a number (`impl-parser-core.ts:44`), and merged branches are kept until landing.
  - breaks when: Build Phase 1 starts after Test Phase 1 merged and finds `phase/p/1` already there, so it "resumes" on the test phase's branch; or Test Phase 2 and Build Phase 2 run together and both reuse one branch and worktree.
- .indusk/planning/run-the-graph/impl.md:641 — The host's 30-second `setInterval` tick "re-reads and launches" independently of `runGraphStep`'s own loop, and nothing serialises the two, though D6 merges one phase per plan at a time and A17 says a waiting phase starts once.
  - breaks when: a tick fires while the loop is handling a phase end, both pick the same ready phase, and `startPhase` runs twice (a second `git worktree add` fails and stops the phase, or two merges of one plan run at once).
- .indusk/planning/run-the-graph/adr.md:141 — Workbench plans are left out of the graph, which narrows `the-work-runs-as-a-graph` ("Within an approved plan, every phase…"). This is left as an open decision "needing Sandy's word", with no amendment to the promise.
  - breaks when: any workbench plan is approved: its independent phases run one at a time, and the promise reads broken, or is wrongly read as holding.
- .indusk/planning/run-the-graph/impl.md:145 — The phase key is used inconsistently: dependency lines name `Build Phase 6`, the T3 body looks a node up as `Phase 7: Falsification`, `phaseLabel` (`next-step.ts:113`) gives `Build Phase 2: <name>`, and the falsify skill writes `### Phase N: Falsification —`. D1 says names are "headings as written", and an unknown name is refused at save.
  - breaks when: a falsify or cleanup phase names `Build Phase 6` while the heading reads `### Phase 6:`, or the reverse; it is refused at save or its dependency does not resolve.

## Which skip reason would you not accept?

- .indusk/planning/run-the-graph/test-plan.md:43 — The `ready-phases-start` signal skips a plan "whose build is stopped". After an admin restart the build's record reads stopped, nothing restarts it on its own (only `startBuild` from a button, the approve route or a question answer calls `restartFor`), and so the stranded ready phases the fails-when list says the "first tick after it starts" reports are exactly the ones exempted.
  - breaks when: the admin restarts mid-build; no phase launches until a person presses Build, and the signal judges nothing.
- .indusk/planning/run-the-graph/impl.md:32 — "Workbench plans: … awaiting Sandy" is an exclusion from an accepted promise with no decision behind it.
  - breaks when: the plan is approved and closed with the workbench exclusion unresolved.
- .indusk/planning/run-the-graph/test-plan.md:195 — For `only-the-plan-lands`, "a plan lands with its promises not verified" is left without a signal because landing runs the clause tests. Passing clause tests is not "its promises verified" in the clause's sense, so the second half of the sentence has no signal.
  - breaks when: a plan lands whose clause tests pass but whose promises were never confirmed.

## What else would have to change for each promise to hold?

- apps/indusk-mcp/hooks/check-gates.js:535 — The gate hook refuses ticking an implementation item while any earlier phase in document order has unchecked gate items, and Gate B (line 495) refuses advancing past rows due at earlier phases. Neither is in any phase's Files line or item. **Would stop the plan working entirely.**
  - breaks when: Build Phase 3 runs beside an open Build Phase 1 in its own worktree; every item it ticks is refused, or the unattended session "skips" Build Phase 1's gates with reasons to get past it, so it never closes or it corrupts another phase's gates.
- apps/indusk-mcp/src/lib/build/next-step.ts:77 — The build stops for a declared judgement or a blocker only on the first open phase, and the graph bypasses that for every other ready phase. `a-build-runs-to-review-unasked` ("stops … for a judgement the plan declared") is not in Must-not-break and no item keeps it.
  - breaks when: a phase other than the first open one carries a manual-smoke or deferred-verification item, and the graph runs it unattended past the judgement.
- apps/indusk-admin/src/lib/build-host.ts:974 — Under D7 the graph keeps running the other phases after a phase session stops on a question. But an answer given in that window calls `resumeAfterQuestion` → `startBuild`, which throws "already building"; when the step later returns the question, the host calls `holdQuestion` on a question already answered.
  - breaks when: the person answers while other phases are still running; the plan then waits on a held question that nobody will answer again (`the-cost-sets-the-wait`, A41).
- .indusk/planning/run-the-graph/adr.md:52 — The changelog and every `CLAUDE.md` are exempt from overlap so parallel phases may edit them, but D6 aborts any conflict outside `impl.md` and counts it as a failed attempt. This plan's own phases append to the changelog's Unreleased block and to `apps/indusk-mcp/CLAUDE.md` "Run the graph", and Build Phases 1, 2, 4, 5 and 6 each edit `apps/docs/src/guide/phases-in-parallel.md`, which no Files line declares.
  - breaks when: two parallel phases both append at the same point of an exempt or undeclared file; the second's merge conflicts on each try and the phase is stopped after three.
- .indusk/planning/run-the-graph/impl.md:269 — "An undeclared set overlaps every path its plan's phases declare" says nothing when the other phase is also undeclared, or when no phase declares anything: the union is empty. A13 promises such a phase "waits for its plan's running phases".
  - breaks when: two phases with `**Depends on**: none` and no files line become ready together; they run at once on unknown files.

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/impl.md:485 — `own-worktree`: the signal checks that a path and a branch appear once in `git worktree list`. When Test Phase N and Build Phase N resolve to one `phase/<plan>/<n>` and the second "resumes" the first's worktree, the list still shows each once.
  - breaks when: two phases share one worktree and branch through the number collision, and the span reads upheld.
- .indusk/planning/run-the-graph/test-plan.md:64 — `no-needless-wait`: the signal compares overlap by expanding declared paths against `git ls-files` on the plan's branch, so a declared path to a file not yet created matches nothing. Most of this plan's own Files lines are new files.
  - breaks when: two running phases both declare (and write) the same new file; the signal finds no concrete shared path and reads upheld.
- .indusk/planning/run-the-graph/impl.md:575 — `green-before-merging`: the signal requires a test file in the report only for every touched clause. The phase's own rows that are not clause rows (regression guards, Must-not-break tests) are not checked for presence, though the clause says "its own tests … pass".
  - breaks when: the merge check drops the phase's own non-clause tests or the Must-not-break tests, and the report is still all green.
- .indusk/planning/run-the-graph/impl.md:587 — `only-the-plan-lands`: the signal lists phase branches with `for-each-ref refs/heads/phase/` only after a landing or an approval.
  - breaks when: someone merges a phase branch into the trunk and deletes the branch before the next landing; nothing lists it.
- .indusk/planning/run-the-graph/impl.md:629 — `the-work-runs-as-a-graph`: no signal compares the phase a session was launched for with the phase it actually worked; the read, schedule, launch and merge spans all key on the launched phase.
  - breaks when: a phase session works a different open phase (the unchanged work prompt), and every span reads upheld.
