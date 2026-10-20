---
plan: run-the-graph
reviewed: 2026-10-19
read: 82503e799d7ed6ceab867ff4bcf0f33c947c04c1965d8adf6ac2801e7fb52e7b
model: claude-opus-5-5
---

# Plan review — run-the-graph

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/run-the-graph/impl.md:73 — T15, the trajectory row for `starts-from-its-dependencies` (carrying A28, the test-plan row "Phase 2 does not see the work of Phase 3 if it does not depend on it, even when 3 finished first"), contradicts ADR D5 (the decision that a phase's worktree is cut from the plan branch's tip) together with D6 (the decision that every finished phase is merged into the plan branch). Under that design, a phase cut after an unrelated phase merged starts with that phase's work. The row can only pass on a fixture where "finished" means "not yet merged into the plan", so it does not test the system the plan builds.
  - breaks when: Phase 3 finishes and merges into `plan/<plan>` before Phase 2 starts. Phase 2's worktree then holds Phase 3's files, which is correct under D5, and A28 is either red or written against a state the driver never produces.
- .indusk/planning/run-the-graph/impl.md:77 — T19, T20 and T21 are the rows for `green-before-merging` and `every-phase-is-checked`. Each drives `mergePhaseIntoPlan` with an injected `check` (the deferred body passes `check: () => ({ ran: 0 })`). T44 tests the touched-clause selection only through `planTestSet`, and T18 injects `tests: () => red`. No row runs the real merge: real selection, run on the merged result, then the swap. So "its own tests and the tests of every clause the plan's branch has touched pass, with the merge made" is proved in two halves, never joined.
  - breaks when: the production check is wired to the phase scope instead of the touched scope, or runs before the plan tip is merged in. Every row stays green while a phase merges on a run that left out the touched clauses.
- .indusk/planning/run-the-graph/impl.md:69 — T11 is the only unit row for `running-phases-finish`. It asserts that the scheduler's return type has no stop field. The clause's sentence is about sessions. Nothing tests the paths that do end phase sessions in the admin: `SessionManager.reapRecorded` at daemon start, and Stop, which Build Phase 5 makes stop all of a plan's phase sessions.
  - breaks when: the admin restarts while phases run. `reapRecorded` kills every recorded phase session, and T11 stays green.

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/impl.md:1206 — No task calls `mergePhaseIntoPlan`, appends `done`, calls `removePhase` or calls `onPhaseEnded` when a phase session ends. Build Phase 8 builds the merge, and Build Phase 12's driver only reads, picks, calls `startPhase` and starts sessions. Readiness (`done` gates dependents), `green-before-merging` and the landing refusal (a `launched` entry with no `done`) all depend on that missing step.
  - breaks when: the first phase session exits. Its work never reaches `plan/<plan>`, its dependents never become ready, and `plans land` refuses the plan forever as "still running".
- .indusk/planning/run-the-graph/impl.md:521 — `readGraph` admits only plans whose impl status is `approved` (ADR D3, adr.md:64). But `apps/indusk-mcp/skills/work.md:32` tells every `/work` session to change `approved` to `in-progress`, and `skills/work.md:301` later sets it to `completed`. Also, `reopenOwner` writes `status: in-progress` when the owner has no impl.
  - breaks when: the first phase's session follows the work skill and its impl change merges into the plan. The plan drops out of the graph and its remaining phases, review phases and fix phases never start. The cascade and its signal also skip it, because both filter on "approved".
- .indusk/planning/run-the-graph/impl.md:1012 — A released phase is said to resume "in the same worktree", but its only way back is the driver's normal launch through `startPhase`. `startPhase` is specified only to cut a new `phase/<plan>/<n>` branch and worktree from the plan tip. No path reuses an existing phase branch, worktree or wip commit. The same gap applies to a phase relaunched after a red check (the three-attempt retry) or after `reapRecorded`.
  - breaks when: a held phase is released, or a red phase is retried. `startPhase` either fails because the branch already exists, or cuts fresh from the plan tip and drops the wip commit, which breaks `the-held-phase-catches-up` ("carries on from where it stopped").
- .indusk/planning/run-the-graph/impl.md:905 — ADR D6 says a red merge check follows the existing three-attempt rule and its third failure becomes a question (a hold). But `nextTier` in `lib/models/tiers.ts` moves the phase up a tier after three failures and returns `"blocker"` only on strong. The record's entry kinds include no attempt count. No task relaunches a stopped phase on the next tier.
  - breaks when: a med-tier phase fails its merge check three times. Nothing counts the attempts, no tier change happens, and no question is raised, so the phase stays "stopped" with no hold. Its dependents wait indefinitely, against `a-hold-is-cheap`.
- .indusk/planning/run-the-graph/impl.md:733 — `startPhase` creates the phase worktree with git directly. It does not run the config's `post_create` commands that `indusk worktree create` runs (`bin/commands/worktree.ts:158`, install and build). The merge check then runs vitest in that worktree (impl.md:896).
  - breaks when: the project's tests need installed dependencies, as in this pnpm monorepo. Every merge check fails to run or ends red, so no phase ever merges into its plan.

## Which skip reason would you not accept?

- .indusk/planning/run-the-graph/test-plan.md:320 — For `agent-resolves-first`, the test plan gives "a merge point bypasses the resolver with a plain merge" no signal, citing the call-site test. Build Phase 7's call-site test only spies on whether `cascadeTrunk` calls `mergeWithResolution`. But Build Phase 10 specifies the cascade "using `lib/plans/bring-trunk.ts`", whose `bringTrunkIntoPlan` does a plain `git merge` and aborts on conflict.
  - breaks when: the cascade merges through `bringTrunkIntoPlan` and calls `mergeWithResolution` elsewhere. The spy passes, a cascade conflict is aborted without an agent or a question, and no span is written.
- .indusk/planning/run-the-graph/test-plan.md:132 — For `own-worktree`, the test plan calls "a failed one is removed" housekeeping with no signal. The kept worktree and branch of a phase that failed its merge are what the ADR D6 retry and the brief's "kept and listed" resume from.
  - breaks when: cleanup removes a stopped phase's worktree. Its uncommitted work is lost, and nothing reports it.

## What else would have to change for each promise to hold?

- apps/indusk-admin/src/app/api/plans/[name]/question/route.ts:54 — `a-hold-frees-its-files` says answering releases "that phase alone". But a stored `Question` (`lib/questions/record.ts:34`) has a plan and no phase. Both answer routes (`question/route.ts`, `decision/route.ts`) call `resumeAfterQuestion(project, name)` with no phase. Neither the routes nor the `Question` type are in any phase's tasks.
  - breaks when: two phases of one plan each stop on a question that holds. An answer cannot say which phase it releases, so it releases the wrong phase, both, or none. The catch-up signal, which maps answered questions to held phases, has nothing to key on.
- apps/indusk-mcp/src/lib/run/driver.ts:136 — Dawn's `indusk run <plan>` still runs a plan's phases one after another in the plan worktree, outside the admin's session manager. Nothing in the impl makes it refuse a plan the graph is running. Build Phase 12 stands down only the admin's `startBuild` loop.
  - breaks when: a person runs `indusk run` on an approved plan while the driver runs it. The same phase runs twice, its sessions are not counted against the cap (`within-the-cap`), and its commits move `plan/<plan>` without a merge check (`green-before-merging`).
- .indusk/planning/run-the-graph/impl.md:957 — The `only-the-plan-lands` signal requires every first-parent merge on the trunk to name a `plan/` branch in its subject. But `approvePlan` merges onto the trunk with the subject `plan(<name>): approved — its documents and promises` (see `git log main --merges --first-parent`).
  - breaks when: any plan is approved. The next landing's signal reports `only-the-plan-lands` broken on the approval merge, so the clause reads broken in normal use.

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/impl.md:1249 — The `ready-phases-start` signal reads a phase's ready time from `git log --first-parent --merges plan/<plan>`. But ADR D6 moves the plan branch with `update-ref` to the phase's own head: a fast-forward, with no merge commit when nothing else merged meanwhile. When there is a merge commit, its first parent is the phase branch, and its commit time comes before the check and the swap.
  - breaks when: a dependent phase is launched late after a fast-forwarded dependency. No merge commit gives its ready time, so the late launch is never reported. Where a merge commit is found, the check's duration is counted as launch delay instead.
- .indusk/planning/run-the-graph/impl.md:1255 — The `graph-is-current` signal compares `graph-read`, `done` and `launched` entries, all written by the driver whose behaviour it judges.
  - breaks when: the driver appends `graph-read` but schedules from a cached or stale graph object. The signal passes.
- .indusk/planning/run-the-graph/impl.md:1261 — The `running-phases-finish` signal reads "each session's own last event". But `SessionManager` keeps events only in memory and deletes the held entry when the session ends. Its sessions file then drops the record, and `onEnd` passes only `startedAt`. Only the `held` entry the host writes itself is left.
  - breaks when: the host ends a running phase for another merge's conflict and records `held` with a question reason. The signal cannot tell that from the session's own stop.
- .indusk/planning/run-the-graph/impl.md:618 — The `earliest-next` signal ranks contenders with `lib/plan-order.ts`, the same new function the scheduler ranks with.
  - breaks when: `plan-order.ts` mis-orders the tree, for example by reading `subplans:` in the wrong order or ranking unplaced plans first. A later plan's phase takes the contested file, and the signal agrees.
- .indusk/planning/run-the-graph/impl.md:933 — The `green-before-merging`, `every-phase-is-checked` and `phase-merges-at-its-end` signals are called only by `swapPlanBranch`, while the clauses cover every move of a plan's branch.
  - breaks when: `plan/<plan>` moves by a commit in the plan worktree, from Dawn's `indusk run`, a ritual step or a person. Unchecked work joins the plan branch and no span is written.
- .indusk/planning/run-the-graph/impl.md:1158 — The `lands-after` signal only checks the record's `pulled` entries, which `startPhase` writes. Its backstop, the `starts-from-the-work-it-waited-for` signal, only checks phases with a `waiting` entry, which the driver writes.
  - breaks when: a phase merges another plan's unlanded branch and neither entry is written, for example across an admin restart. The plan lands before its source plan and no span reports it.
