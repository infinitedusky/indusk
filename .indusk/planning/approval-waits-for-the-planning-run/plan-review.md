---
plan: approval-waits-for-the-planning-run
reviewed: 2026-10-19
model: claude-opus-5-5
---

# Plan review — approval-waits-for-the-planning-run

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/approval-waits-for-the-planning-run/test-plan.md:58 — Row A6 (in the test plan and in the impl's trajectory at impl.md:65) asserts that approval is offered after a run that ended any other way (an error, a blocker). That is the opposite of the changed promise's third condition, "any planning run for it has stopped ready for approval" (brief.md:39). The tests prove a weaker rule: the run is no longer going.
  - breaks when: a planning run ends `cannot-continue` because a step wrote a blocker, a step's session failed, or two steps in a row changed nothing. The draft impl is then listed under Needs you with Approve, the run never stopped ready for approval, and A6 passes.
  - answer: amendment — the brief's Changes entry now offers approval only once plan-review.md is written with every finding answered; a run that stopped without one is listed as needing it (rows A4, A5)
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:118 — Row A5, the only test of the admin's reader, mocks `planningState` with a flag the test flips. No everyday test checks that the real `build-host` state stays `running` through the gap between one step's session ending and the next starting, which is the gap the bug report describes. Only the live check A7 covers it, and A7 is never written as a test.
  - breaks when: `startPlanning` in apps/indusk-admin/src/lib/build-host.ts changes so the state clears or `release()` deletes the key between steps. A3, A4 and A5 all stay green while Needs you offers Approve in the gap again.
  - answer: fix — rows A12 and A13 test the admin host's real planning state across the gap between steps, and through readWaiting on a run the host started; nothing of the host's state is mocked
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:65 — A6, A4 and A13 feed `planWaiting` a hand-written `running: boolean`. They show what the rule does with the flag. They do not show that the flag reaches `false` at every way a run ends, which is what A6's "does not hide approval indefinitely" claims.
  - breaks when: a run's promise never settles (a hung step session). `finally` at build-host.ts:432 never runs, `running` stays true, approval is hidden forever, and every unit row passes.
  - answer: nothing — a run that never settles keeps the plan off Needs you until the admin restarts, after which the file rule lists it as needing its plan review, never as ready; recorded in the impl's Notes
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:70 — A11, the guard for `an-accepted-brief-is-planned-unasked`, is the existing case at apps/indusk-mcp/src/lib/build/planning-runner.test.ts:56. It drives `runPlanning` with a fake step runner. It does not go through the admin host that starts and holds the run (`startPlanning`), so "waiting does not stop or restart it" is proven only because the two never meet in the test.
  - breaks when: a change in the admin host (for example the approve route or the decision route) stops or restarts a run while it is going. A11 cannot see that.
  - answer: fix — row A13 drives a real planning run the admin's host started through readWaiting; row A21 guards the run's own stop

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/approval-waits-for-the-planning-run/impl.md:24 — Decision 1 reads the run's `running` flag and rejects reading its stop step. The promise sentence the plan registers (impl.md:211, from brief.md:39) says "stopped ready for approval". The build produces "not running", and the registered sentence claims more than the code checks.
  - breaks when: a run stops on a blocker or a failed step after the draft impl is written but before plan-review has run. The plan is listed for approval while the registered promise says it would not be.
  - answer: amendment — same as the first finding: approval is read from an answered plan review, not from the run's flag
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:251 — The docs row adds "a run that ended any way, including a failure, no longer holds it back". This states a rule the changed promise's sentence does not make and in fact contradicts, so the reference page and the registry disagree.
  - breaks when: a person reads the reference page and the promise side by side after a failed run. One says Approve is offered and the other says it is not.
  - answer: fix — the impl's Document items state the brief's rule exactly; nothing says a failed run offers approval
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:275 — The reader sees only the admin's in-memory planning state (apps/indusk-admin/src/lib/build-host.ts:276-291). A restart drops it, and the impl accepts showing approval then. The promise's "any planning run for it has stopped ready for approval" does not hold for a run that a restart cut off.
  - breaks when: the admin daemon restarts during the plan-review step. After the restart the plan with a draft impl and no `plan-review.md` is listed under Needs you with Approve.
  - answer: amendment — approval is read from plan-review.md, which survives an admin restart (row A5)

## Which skip reason would you not accept?

- .indusk/planning/approval-waits-for-the-planning-run/impl.md:79 — The deferral of A7 and A12 says they would require `pnpm e2e`. The e2e suite (apps/indusk-mcp/vitest.e2e.config.ts, files under apps/indusk-mcp/e2e/) contains no planning-run or admin test, so running it exercises neither row. The rows' Test column (impl.md:66, impl.md:71) names the same command.
  - breaks when: Build Phase 1's last verification item runs `pnpm e2e`, it passes, and A7 and A12 are written down as run although nothing touched a planning run.
  - answer: fix — the live check is a manual row with its procedure (A16) and a Deferred Verification entry; `pnpm e2e` is no longer named
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:80 — The mitigation says "a break reaches the person as the promise `approval-waits-for-a-finished-plan` reading broken". The promise has no mark: .indusk/promises/approval-waits-for-a-finished-plan.md lists only a code site and tests, and nothing under apps/indusk-admin/src emits a span for it. So no detector would report it broken.
  - breaks when: the gap returns in a live run. Nothing records a break, and the promise reads holding.
  - answer: fix — the Deferred Verification mitigation no longer claims a broken reading: it says the promise has no mark and a regression in use is reported by the person
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:32 — Decision 9 skips the OTel gates because `.indusk/config.json` sets `otel.role: "library"`. This promise's domain is `admin` and it is felt in the admin's Needs you, a running app. The test plan names that as the signal (test-plan.md:51). The repo-wide role is used to excuse an app-level promise from having any production signal.
  - breaks when: the only proof left after landing is fakes and a live check that does not run. The promise is confirmed without anything having watched it hold.
  - answer: nothing — the project's otel.role is project configuration, outside this plan; the changed promise is a state promise held by its tests
- .indusk/planning/approval-waits-for-the-planning-run/impl.md:29 — Decision 6 moves A5 from contract to unit because "nothing they touch is owned by someone else". A5's subject is the reader's use of `planningState`, which `a-brief-is-planned-unasked` owns, and the impl mocks it (impl.md:118). The reclassification removes the one row that would have joined the reader to the real host.
  - breaks when: `planningState`'s shape or meaning changes in build-host.ts, for example `running` being true only while a step's session is live. The mocked A5 stays green.
  - answer: fix — rows A10 and A13 use the admin's real plan reader and planning host; no mock of the planning state

## What else would have to change for each promise to hold?

- apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:98 — The plan page shows `PlanSession`'s own Approve button whenever `planActions(...).canApprove` is true and the waiting card is not approval. `canApprove` (apps/indusk-admin/src/lib/plan-actions.ts:40) looks only at the impl's status. Withholding the approval card while the run is going leaves this Approve visible for the whole run. The brief's outcome (brief.md:22, "the Approve button appearing only after the run stops") does not hold on the plan page.
  - breaks when: a person opens the plan page during the plan-review step. Approve is on the page, and clicking it gets a 409 from apps/indusk-admin/src/app/api/plans/approve/route.ts:54.
  - answer: amendment — every Approve asks planWaiting's answer (rows A14, A15); the brief lists plan.working as a look it must not break
- apps/indusk-admin/src/app/p/[project]/plan/[name]/brief/page.tsx:116 — The brief page passes `canApprove={actions.canApprove}` with no waiting or planning-run check at all.
  - breaks when: a person opens the plan's brief page while its planning run is writing the ADR or the impl, or running plan-review. Approve is offered there.
  - answer: amendment — same: the brief page's Approve passes planWaiting's answer into canApprove (row A15)
- apps/indusk-admin/src/lib/build-host.ts:430 — A run that ends on a blocker, a failed session or a crash records `stop.step = "cannot-continue"` and sets `running = false`. For "stopped ready for approval" to hold as written, what the reader passes would have to distinguish that stop from `ready-for-approval`. Under the impl it does not.
  - breaks when: a run ends `cannot-continue` with a draft impl. The plan is listed for approval.
  - answer: amendment — a run stopped cannot-continue lists the plan as needing its plan review, with the reason it stopped (row A4)
- apps/indusk-admin/src/lib/build-host.ts:282 — Planning-run state lives only in a `globalThis` map in the admin process. For "any planning run … has stopped" to be read after a restart, the state would have to survive the process.
  - breaks when: the daemon restarts mid-run (an update, a crash, `indusk ui` restarted). The interrupted run is invisible and the plan is offered for approval.
  - answer: amendment — the rule reads the plan review file, so a restart cannot drop it (row A5)
- apps/indusk-admin/src/lib/build-host.ts:310 — `planningConversationEnded` awaits `readPlanningState` before `startPlanning` records the run (line 356). Between the planning conversation's session ending and that record there is no run and no open turn. A plan whose impl draft that conversation already wrote reads as ready during this window.
  - breaks when: Needs you renders during that await, after a planning conversation that wrote the impl and accepted the brief. Approve shows briefly before the run that will review the plan starts.
  - answer: fix — the file rule closes the window: with no answered plan review there is no offer (row A1)

## What let these through?
- a choice the test plan left "for the ADR" in a bugfix with no ADR, so the impl took a weaker reading of the brief's sentence than it says — findings: Q1 row A6, Q2 decision 1, Q4 build-host.ts:430 and :282 — highlight: h-20261019-016
- deferrals and mitigations named checks without confirming they run the case — findings: Q3 the e2e deferral and the mitigation's broken reading — highlight: h-20261019-017
