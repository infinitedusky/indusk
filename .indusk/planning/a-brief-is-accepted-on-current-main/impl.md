---
title: "A brief is accepted on current main — Impl"
date: 2026-10-19
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "4185817c416778284c5cf8d1b9c1c31772a63b7bf55a15df86a11e7ec7702c85"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T17:32:27.817Z"
---

# A brief is accepted on current main — Impl

## Goal

`indusk plans accept-brief <plan>` first brings the project's trunk branch (main) into the plan's branch, then marks the brief accepted, so the planning run that follows writes the test plan, ADR and impl against current code. The admin's planning start brings main in the same way before its first step, so a brief accepted by hand, or a run held for looks and started later, is still planned on current main. A workbench plan's code branch is brought up to its repo's trunk at both moments. When bringing main in conflicts, or would change this plan's own documents, the merge is undone, the acceptance (or the run) is refused with each file named, and the brief stays a draft with the branch exactly as it was. The person never merges main by hand.

## Decisions made while writing this plan

The first version was written unattended (`INDUSK_GATE_POLICY=auto`); after its cold read (`plan-review.md`) the person settled the merge's places, the workbench case, the refusal's words and the live check, and this version carries those. The test plan's decisions stand as written; this list adds the build-shaped ones.

1. **The merge lives in one package function, `bringTrunkIntoPlan` in `lib/plans/bring-trunk.ts`, with two callers.** `acceptBrief` (behind `indusk plans accept-brief`) calls it before marking the brief accepted, and the admin's `startPlanning` (`apps/indusk-admin/src/lib/build-host.ts`) calls it before the first planning step. In the admin a brief is accepted inside a planning conversation — by that command, or by a hand edit the skill only advises against — and a run held for looks can start much later; the planning start is the one moment every admin path passes through, so it merges too. Exported from `lib/plans/index.ts` (the admin already imports `acceptPlan` from `@infinitedusky/indusk-mcp/plans`). Rejected: a merge inside the admin, which would be a second definition of the rule; and proving the admin path by scanning source text, which cannot see an agent setting the status by hand.
2. **Order inside `acceptBrief`: refuse inside a build step, read the draft, run the contract check, bring main in, then — inside the step that undoes the merge on any failure — re-read the draft and run the contract check again; then write and commit the acceptance.** The check first because it is the cheaper refusal and leaves the branch untouched (A18, the trajectory row asserting a failing contract refuses before any merge). The check again because main's registry can change what a brief rests on (A6, the row asserting a brief that fails once main is in is refused and the merge undone). Every read and check after the merge sits inside the undo step, so no refusal leaves the merge behind.
3. **Merge, not rebase: `git merge --no-edit -m "<message>" <trunk branch>` in the plan's worktree** (a workbench plan's code worktree). A rebase rewrites the plan's own commits (A4, the row asserting none is rewritten or dropped), and landing merges main the same way (`lib/plans/land.ts`). A branch already holding main gains no commit (A3, the row asserting no merge commit when none is needed). The message is `plan(<name>): <trunk> merged before its brief was accepted` at acceptance (A27, the row on that message) and `plan(<name>): <trunk> merged before its planning run` at planning start.
4. **"Current main" is the local trunk branch.** Nothing is fetched: `planBranch`'s `trunkBranch` (and `workbenchPlan`'s for a workbench) is the branch the local trunk checkout is on, and landing merges that same local trunk.
5. **The undo is `git merge --abort` when the merge stops, and `git reset --merge <head before>` when it finished but a later check refuses.** `--merge`, not `--hard`, so a person's unrelated uncommitted files survive. The head before is read first and compared at the end of every refusal test (A11, the row asserting a clean tree, a draft brief and an unmoved head after a refusal).
6. **Main changing this plan's own documents refuses.** After a clean merge, `git diff --name-only <head before> HEAD -- <plan folder>` lists what main changed in this plan's folder; any file there refuses, naming it, and the merge is undone (A28, the row asserting a non-conflicting edit to `brief.md` on main refuses). The person accepts only what they read. A workbench plan's documents live at the workbench root, which the code repo's trunk does not hold, so the check applies to the own-branch case.
7. **Why the merge did not happen is read from git's state, never from its message.** Unmerged paths (`git diff --name-only --diff-filter=U`, read before the abort) mean a conflict. No unmerged paths and no merge in progress means git would not start: the uncommitted files in the worktree that the trunk also changes (`git status --porcelain` paths that `git diff --name-only HEAD...<trunk>` names) are named in plain words, as belonging to whoever made them (A9, A19 — the rows on the conflict and uncommitted-files refusals). Anything else gives git's reason with its `Command failed:` line and `hint:` lines removed. Rejected: pre-refusing every dirty worktree, which refuses acceptances that work today.
8. **The refusal's words never mention merging.** Each begins `<plan>: <what was refused>, and nothing was changed.` (`its brief was not accepted`, or `its planning run did not start`). Then, for a conflict: `Bringing <trunk> into <branch> conflicts in these files:` with one `  <path>` per line and `Resolve them in <worktree> (or on <trunk>) and <try again>.`; for this plan's documents: `<trunk> changes this plan's own documents:` with the paths and `Settle which version is the plan's, on <branch> or on <trunk>, and <try again>.`; for uncommitted files: `<trunk> could not be brought into <branch> because these files in <worktree> have uncommitted changes, which belong to whoever made them:` with the paths and nothing asked. None says merge, rebase, pull, commit or stash, and none quotes a git command line.
9. **The admin shows the refusal as it shows any.** `startPlanning` calls the function inside its existing try, after the package's `nextPlanningStep` says a step is due and before it takes a build place; a refusal releases the run's state and is rethrown, so `POST /api/plans/plan` answers 409 with the message as `error` (A14, the row on what the route answers), and `askAdminToPlan` prints it as "The admin refused to plan …". A conversation's end (`planningConversationEnded`) starts no run on a refusal, as it does for any throw today (A22, the row asserting a refused acceptance starts no run).
10. **Workbench plans are merged too.** `indusk plans start` makes a workbench plan's code branch and worktree at start (`lib/plans/start.ts`), so at acceptance and at planning start `bringTrunkIntoPlan` brings the repo's trunk (`workbenchPlan`'s `trunkBranch`) into the code branch in the code worktree, with the same refusals; the brief is then written and committed at the workbench root as before (A16, A29 — the rows on a workbench plan's acceptance and planning start).
11. **No OTel gate.** `.indusk/config.json` sets `otel.role: "library"`, acceptance is a one-shot command with no `expect_every`, and the brief's expectations are `None`. Each clause's signal is the refusal it prints plus the tests at close; the manual check after landing (A12) records the first real run.
12. **No new library.** `git` is the project's primitive (`lib/git.ts`); merge, abort, reset and the path listings are git invocations through it, as `land.ts` already does.
13. **No ADR and no root Key Decisions line.** A bugfix carries brief + test plan + impl. The rule is area-specific, so it goes in `apps/indusk-mcp/CLAUDE.md` (Build Phase 1's Context item), not the root.

## Scope

### In Scope

- One package function that brings the trunk into a plan's branch (or a workbench plan's code branch), undoes itself and refuses in plain words on a conflict, on main changing the plan's own documents, or on uncommitted files in the way.
- `acceptBrief` calling it, with the contract check before and after.
- The admin's planning start calling it before its first step.
- The planner skill's description of `accept-brief`, and the docs and changelog that describe it.
- Tests for each clause, using real git in temporary repositories.

### Out of Scope

- Keeping a branch current after the planning run starts (landing merges main).
- Fetching a remote main (decision 4).
- Merging main into the ten drafted `fix-http-*` briefs now: each is merged when it is accepted or planned.
- Any change to the admin's interface files.
- Re-reading a brief whose code moved under it: the plan review, run last in the planning run, does that.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test of the three clauses and the two must-not-break promises, red where today's code fails them, green as guards where it passes; the register deferring the one test that needs the new function | `acceptBrief`, `plansAcceptBrief`, `startPlanning`, `planningConversationEnded`, the plan routes, the plan-lifecycle and versioned-workbench fixtures |
| Build Phase 1 | `bringTrunkIntoPlan`; `acceptBrief` and `startPlanning` calling it; the deferred test; the area rule in `apps/indusk-mcp/CLAUDE.md` | the tests from Test Phase 1, `git` in `lib/git.ts`, `PlanCommandRefusal`, `planBranch`, `workbenchPlan` |
| Build Phase 2 | the planner skill's and the docs' description of the new order, the changelog entry, the manual check's recipe for after landing | the behaviour from Build Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan branched before main gained a commit touching an unrelated file holds that file's new content after accepting, and the brief reads accepted | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A2 | In the branch's history the merge of main comes before the commit marking the brief accepted; main's head is an ancestor of the accepting commit | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A3 | A branch that already holds main is accepted with no merge commit: the only new commit marks the brief accepted | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A4 | A branch both ahead of and behind main keeps every one of its own commits after the merge; none is rewritten or dropped | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A5 | The brief differs from before only by `status: accepted` and `accepted_at`, while main's commits to other plans' folders arrive in the branch | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A6 | A brief that passes before the merge but fails once main's registry is in is refused and the merge undone, the branch as it was | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A7 | A brief accepted by hand on a branch behind main, started from the admin's planning start, has its first planning step run in a worktree holding main's newest commit | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A8 | A conflicting merge at the admin's planning start stops the run: no planning step begins, the refusal names each conflicting file, and the branch's head and tree are as they were | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A9 | When main and the branch changed the same lines of one file the acceptance is refused naming that path; when a file in the worktree with uncommitted changes is in the merge's way, the acceptance is refused with nothing changed and that file named | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A10 | Two files in conflict are both named, each on its own line; one conflict among several clean merges names only that file | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A11 | After the refusal the brief reads draft with no `accepted_at`, the tree is clean with no conflict markers, unmerged paths or merge in progress, and the branch's head is the commit it was at | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A12 | After landing, on the installed admin, a planning conversation accepts a draft brief on a branch left behind main on purpose; the planning run starts when it ends and the branch holds main's newest commit | Build Phase 2 | Build Phase 2 | skipped | live check | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | manual: after landing, run `pnpm install:local` and `indusk ui restart`; start a throwaway bugfix plan, commit a new file to main after it was cut, open a planning conversation on it in the admin and ask it to accept the brief; when the conversation ends, note that the planning run starts and that `git merge-base --is-ancestor main <accept commit>` exits 0 in the plan's worktree; record the date and result in this impl's Notes |
| A13 | After a refusal, accepting again once the conflict is gone succeeds: the refusal left no state that blocks a second attempt | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A14 | The refusal says what the person must do and that nothing was changed, as a refusal of the plan command, never a crash; the admin's planning route, asked to start a conflicting plan, answers 409 with that message, each file in it, as the `error` the page shows | Test Phase 1 | Build Phase 1 | passing | contract | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts, apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A15 | A conflict in `brief.md` itself (main and the branch both edited it) refuses the same way; the brief is not marked accepted | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A16 | A workbench plan whose code branch is behind its repo's trunk: accepting brings the trunk into the code branch and writes and commits the brief at the workbench root as before; a conflict there refuses naming the files, the brief still a draft and the code branch's head unchanged | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts |
| A17 | A branch behind main with no conflict is accepted in one command that asks nothing: what the command prints holds no instruction to merge, rebase, pull or update the branch, it does not exit non-zero, stdin is not read, and the branch then holds main's newest commit | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts |
| A18 | A brief that fails its contract check is refused with the check's own messages and the branch is not merged into first | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A19 | No refusal tells the person to merge main: the conflict refusal names files to resolve, the uncommitted-files refusal names the files and says they belong to whoever made them, and neither quotes git's command line nor says merge, rebase, pull, commit or stash | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A20 | A session inside a build step is refused before anything is merged: the branch is untouched | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A21 | Accepting on a branch behind main still hands the plan to the planning run once: from the command line the ask (which posts only the project and plan) is made once, after the acceptance commit, when the plan's worktree already holds main's new file; from the admin, the end of the conversation that accepted the brief starts the run once, its first step in a worktree holding main's new file | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts, apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A22 | A refused acceptance (conflict) starts no planning run: the command line makes no ask and exits through its refusal, and in the admin a conflicting plan's conversation end starts no run | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts, apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A23 | The existing accept-brief tests (non-draft refused, failing contract refused with the check's messages, build-step refusal, the commit message `plan(<name>): brief accepted`) stay green unchanged | Test Phase 1 | Test Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief.test.ts |
| A24 | After an accepted and after a refused acceptance, main's head is the commit it was at; the merge ran in the plan's worktree | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A25 | Accepting from the main checkout still merges into and commits on the plan's branch, never on main | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A26 | A branch cut before an audit skill change landed on main holds the new skill file after accepting, so the planning run reads the new skill | Test Phase 1 | Build Phase 1 | passing | unit | a regression guard over the failure that started this plan (`decisions-as-questions` against `audit-concerns-are-answered`) | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A27 | The merge commit's message names the plan and main: `plan(<name>): main merged before its brief was accepted` | Test Phase 1 | Build Phase 1 | passing | unit | a history that explains itself when read without opening it; no promise says so | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A28 | When main holds a non-conflicting change to this plan's own `brief.md`, accepting is refused naming it; the brief still reads draft, the tree is clean and the branch's head is the commit it was at | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-brief-is-accepted-on-current-main | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A29 | A workbench plan's planning start brings the repo's trunk into its code branch, through the same package function the admin's start calls | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/bring-trunk.test.ts |
| A30 | A plan with no worktree of its own (its folder on the trunk, no worktree record) still starts its planning run from the admin: no refusal, the run is called once | Build Phase 3 | Build Phase 3 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A31 | A person's own unfinished merge in the plan's worktree (an unresolved file, `MERGE_HEAD` present) survives an acceptance: the refusal names the unresolved file without saying the trunk conflicts, `MERGE_HEAD` is still the person's commit and the file still holds its conflict state | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A32 | A staged file main does not touch, which makes git refuse the merge, is named in the uncommitted-files refusal; the message holds none of git's sentence ("would be overwritten by merge") and no word merge, commit or stash, the file is still staged and the head unchanged | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A33 | An uncommitted edit to a file main renamed is named in the uncommitted-files refusal by its path in the worktree, not passed through as git's "commit your changes or stash them" | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A34 | When the admin cannot take a place for the run (`admitBuild` throws, as at `sessions.max`) on a branch behind main, no merge commit is left: the branch's head is the commit it was at | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-admin/src/lib/build-host.trunk.test.ts |
| A35 | When the acceptance commit itself is rejected after a clean merge (a `commit-msg` hook refusing `brief accepted`), the merge is undone, `brief.md` reads draft on disk and at `HEAD` with nothing staged, and accepting again once the hook is gone succeeds; the same for a workbench plan's commit at the root | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts, apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts |
| A36 | A repository configured `merge.ff=only` still accepts a branch both ahead of and behind main: main is brought in and the brief accepted, not refused with git's "Not possible to fast-forward" | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |

### Deferred Verification

- **A12, the manual check on the installed admin after landing**
  - reason: it needs the installed admin, a real `claude` conversation and a real planning run, which exist only after landing installs the build; no everyday or system-tier test starts a planning conversation.
  - would require: a slow-tier test that installs the build, starts the admin in a temporary home, holds a scripted planning conversation that accepts a fixture plan's brief behind main, and waits for the planning run.
  - mitigation: every part of the path is held by behaviour on real temporary repositories — the admin's planning start bringing main in for a brief accepted by hand (A7), a conflict there stopping the run (A8), the admin's planning route answering with the refusal (A14), the conversation's end starting the run on the merged branch and starting none after a refusal (A21, A22), and the command line's merge, refusal and printed output (A1–A6, A9–A11, A17, A19). The brief has no telemetry mark, so a regression found in use is reported by the person as a break of `a-brief-is-accepted-on-current-main`. The recipe sits in this impl's Notes for the person to run after landing.

## Checklist

### Test Phase 1: Author every test, red where today fails it

**Tier**: med — the work step's default

This phase writes every test the plan commits to before anything changes, so the build phase has a fixed target. Today neither accepting a brief nor starting its planning run touches main, so the tests of bringing main in, of the refusals and of the planning run starting from the merged branch fail on their own assertions; the tests of what must stay true (no merge commit when none is needed, the contract and build-step refusals first, main left alone, the existing acceptance tests) pass from the start and are recorded as guards. One test calls the new package function by name, so it waits for the build phase and is registered below.

- [x] Confirm this plan's own worktree and branch before any edit.
  <details><summary>Technical</summary>

  The worktree exists (`indusk plans start` made it): `git -C /Users/the_dusky/code/sandbox/dusk-worktrees/a-brief-is-accepted-on-current-main rev-parse --abbrev-ref HEAD` expects `plan/a-brief-is-accepted-on-current-main`, and `indusk worktree` records it for this plan; if not recorded, `indusk worktree assign a-brief-is-accepted-on-current-main /Users/the_dusky/code/sandbox/dusk-worktrees/a-brief-is-accepted-on-current-main`. Use absolute paths in every command. Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter.

  </details>
- [x] Write the tests of accepting bringing main in first, from the command line.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts`, headers `// clause: a-brief-is-accepted-on-current-main/main-is-merged-first`, `// clause: a-brief-is-accepted-on-current-main/the-person-never-merges` and `// promise: a-plan-is-written-on-its-own-branch`. Each case from `planLifecycleProject("accept-brief-main")` (real git, a temp home, no server): `p.makeWorktree(plan)`, a draft brief committed on the branch, then `p.commit(p.trunk, {...}, "main moves")` so main is ahead, and a commit in the worktree so the branch is ahead too. A1; A2 (`git merge-base --is-ancestor main HEAD`, and the merge commit before the acceptance commit in `git log --first-parent`); A3 (`git rev-list --count <before>..HEAD` is 1); A4 (every pre-merge commit still in `git rev-list HEAD`); A5 (the diff of `brief.md` is only the two keys); A6 (main withdraws the promise the brief rests on in the registry; expect a refusal, the brief still draft and `git rev-parse HEAD` equal to before); A18; A20; A24; A25 (`p.trunk` as `anyCheckout`); A26 (main adds `.claude/skills/audit/SKILL.md` text; the branch holds it); A27 (`git log -1 --merges --format=%s`). Test names start with the row label, `it("A1: …")`.

  </details>
- [x] Write the tests of the refusals: a conflict, uncommitted files in the way, and main changing this plan's own documents.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts`, headers `// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses`, `// clause: a-brief-is-accepted-on-current-main/the-person-never-merges` and `// promise: a-brief-is-accepted-on-current-main`. A9–A11, A13–A15, A19, A28 with the same fixture: main and the worktree both edit the same line of `docs/notes.md` (and of `brief.md` for A15; a second file for A10). Expect `rejects.toBeInstanceOf(PlanCommandRefusal)` with the path(s) in the message and `nothing was changed`; then `git status --porcelain` is `""`, `git rev-parse -q --verify MERGE_HEAD` exits 1, `git rev-parse HEAD` unchanged, and the brief still `status: draft` without `accepted_at`. A13: commit main's version on the branch, accept again, expect success. A9's second half and A19's second case: leave a tracked file modified (uncommitted) in the worktree that main also changes; expect the refusal to name that file and say it belongs to whoever made it. A19 on both messages: not `/Command failed|\bgit\b/`, and not `/\b(merge|rebase|pull|commit|stash)\b/i`. A28: main makes a non-overlapping edit to this plan's `brief.md`; expect a refusal naming `brief.md`, the head unchanged and the brief still draft. A14 here: the conflict is a `PlanCommandRefusal` (not a plain `Error`) whose message says what to resolve and `nothing was changed`.

  </details>
- [x] Write the tests of what the command prints and of the planning run being asked for only after an accepted brief.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts` (A17, `// clause: a-brief-is-accepted-on-current-main/the-person-never-merges`): drive `plansAcceptBrief` from `bin/commands/plans.ts` with the real `askAdminToPlan`, under a temp `HOME` set through `helpers/with-env.ts` so no admin is recorded (the ask prints its "admin is not running" sentence). Spy `console.info`, `console.error`, `process.exit` (throwing if called) and `process.stdin.on`/`read`; expect no exit, no stdin read, the printed text matching neither `/\b(merge|rebase|pull)\b/i` nor `/update (the|your) branch/i`, and the branch holding main's new file. `apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts` (A21 and A22 from the command line, `// promise: an-accepted-brief-is-planned-unasked`): `vi.mock("./ask-admin.js")` with a stub that records each call and, at call time, whether the brief at `HEAD` of the plan's worktree is accepted and whether the worktree holds main's new file. The real ask posts only `{ project, plan }` (`ask-admin.ts`), so the test asserts the call's `plan`, that it is made once, and the worktree's state when it is made. A22: a conflicting acceptance makes no call, and `process.exit(1)` is called after the refusal is printed.

  </details>
- [x] Write the tests of the admin's planning start bringing main in, refusing a conflict, and answering the refusal on its route.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.trunk.test.ts`, headers `// clause: a-brief-is-accepted-on-current-main/main-is-merged-first`, `// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses`, `// promise: an-accepted-brief-is-planned-unasked`. A real temporary repository: build the trunk and the plan's worktree with `planLifecycleProject` from `apps/indusk-mcp/src/__tests__/helpers/plan-lifecycle-fixture.ts` if the admin's TypeScript config resolves it by relative path, otherwise the same three steps inline (init `main`, `git worktree add -b plan/<plan>`, the worktree record in the git common dir) — no second fixture module. The package is not mocked for plans (its built output is used, so `pnpm --filter @infinitedusky/indusk-mcp build` runs first); mock, as `build-host.test.ts` does, `./registry-client` (`getProjectPath` → the trunk), `./session-host` (`planLocation` → `{ root: trunk, cwd: worktree }`, `sessionManager` with no open session, `adminOnly` → null, `refuse` → `Response.json({ error }, { status })`), and in `@infinitedusky/indusk-mcp/build` only `readPlanningState` (accepted, `acceptedAt` now, documents to write) and `runPlanning` (records the call and whether the worktree holds main's new file at that moment). A7: the brief is set `status: accepted` by hand on the branch, main gains a file, `startPlanning` → the run is called once and saw the file. A8: main and the branch conflict on one file → `startPlanning` rejects naming it, no run, head and `git status --porcelain` unchanged. A14's admin half: `POST` from `apps/indusk-admin/src/app/api/plans/plan/route.ts` on the conflicting plan → 409, `error` holding the file. A21 and A22 from the admin: `planningConversationEnded(project, plan, startedAt)` with `startedAt` before `acceptedAt` → one run that saw main's file; on the conflicting plan → `null` and no run.

  </details>
- [x] Write the test that accepting a workbench plan brings its repo's trunk into the plan's code branch.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts` (A16, `// clause: a-brief-is-accepted-on-current-main/main-is-merged-first`): a workbench from `helpers/versioned-workbench.ts` (`oneRepoAtPath` or `makeVersionedWorkbench`), the plan started with `startPlan` called directly (it makes `plan/<name>` and the code worktree), the repo's trunk then gains a file. `acceptBrief(root, plan)` → the code worktree holds the file, `brief.md` at the root reads accepted and the root's last commit is `plan(<name>): brief accepted`. Second case: the trunk and the code branch conflict on one file → a refusal naming it, the brief at the root still draft, the code branch's head unchanged and its tree clean.

  </details>
- [x] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every new test imports only symbols that exist today (`acceptBrief`, `PlanCommandRefusal`, `plansAcceptBrief`, `startPlanning`, `planningConversationEnded`, the route's `POST`, the fixtures). Run each new file once: `pnpm exec vitest run <the new files>`; the red ones must fail on an assertion (a missing merged file, a missing refusal, a run that started), never on an import or a fixture error.

  </details>

#### Deferred to Build Phase 1

- **A29** — its subject is `bringTrunkIntoPlan`, which Build Phase 1 creates; a test importing it today fails to load, not to assert. The admin's start reaches a workbench plan through the same function, and a workbench fixture is not available to the admin's tests. Body reviewed:

  ```typescript
  // clause: a-brief-is-accepted-on-current-main/main-is-merged-first
  import { bringTrunkIntoPlan } from "./bring-trunk.js";
  import { startPlan } from "./start.js";
  import { commitFile, oneRepoAtPath } from "../../__tests__/helpers/versioned-workbench.js";

  it("A29: a workbench plan's planning start brings the repo's trunk into its code branch", async () => {
  	const wb = oneRepoAtPath(/* as accept-brief-workbench.test.ts */);
  	const s = await startPlan(wb.root, "bugfix", "wb-plan", new Date(), {});
  	commitFile(/* the repo's trunk checkout */ wb.repos[0].dir, "trunk-moved.md", "new\n", "trunk moves");
  	await bringTrunkIntoPlan(wb.root, "wb-plan", PLANNING_START);
  	// resolve: code.worktree may be stored relative to the workbench root
  	expect(existsSync(resolve(wb.root, s.code!.worktree, "trunk-moved.md"))).toBe(true);
  });
  ```

#### Regression Guards

- **A3** — a branch already holding main needs no merge; today nothing merges, so this passes at once and must keep passing once the merge exists.
- **A18** — a failing contract is already refused before anything is written; the build must keep the check ahead of the merge.
- **A20** — the build-step refusal already comes first; the build must keep it ahead of the merge.
- **A23** — the existing accept-brief tests pass unchanged today and after.
- **A24** — main is never written to today; the merge must run in the plan's worktree.
- **A25** — accepting from the main checkout already commits on the plan's branch; the merge must not move that.

#### Test Phase 1 Verification

- [x] Every test of new behaviour exists and fails today on its own assertion, never on a missing import.
  <details><summary>Technical</summary>

  Red on an assertion: A1, A2, A4, A5, A6, A7, A8, A9, A10, A11, A13, A14, A15, A16, A17, A19, A21, A22, A26, A27, A28. Run `pnpm --filter @infinitedusky/indusk-mcp build && pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts apps/indusk-admin/src/lib/build-host.trunk.test.ts` and read each failure's message. A29 is deferred (register above).

  </details>
- [x] Every guard passes today, and no guard is a copy of a red test.
  <details><summary>Technical</summary>

  A3, A18, A20, A23, A24, A25 pass: `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief.test.ts` plus the guard cases of `accept-brief-main.test.ts` in the run above. A12 is a manual check after landing.

  </details>

#### Test Phase 1 Context

- [x] Record in this impl's Notes which rows are red and which are guards, so the build phase reads its target.
  <details><summary>Technical</summary>

  Add a `Test Phase 1 result` line to `## Notes` listing the red IDs and the guard IDs actually observed, and any row that behaved otherwise than the Technical fold of the Verification above says.

  </details>

#### Test Phase 1 Document

- [x] Copy the after-landing live check's steps into this impl's Notes.
  <details><summary>Technical</summary>

  The recipe in A12's `Test` cell is copied to `## Notes` with an empty `Result:` line for the person to fill after landing, so they find it in one place.

  </details>

### Build Phase 1: Bring main in at acceptance and at planning start, refuse in plain words

**Tier**: med — the work step's default

This phase adds the one package function that brings the trunk into a plan's branch, and calls it from the two places a plan can begin to be planned: accepting its brief, and the admin starting its planning run. After it, a plan is planned on current main however its brief was accepted, a workbench plan's code branch included; a conflict, main changing the plan's own documents, or uncommitted files in the way are refused in plain words with nothing changed. It hands Build Phase 2 a behaviour to describe and turns every red test from Test Phase 1 green.

- [x] Write the one function that brings the trunk into a plan's branch and undoes itself on any refusal.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/plans/bring-trunk.ts`, exported from `lib/plans/index.ts`:

  ```typescript
  export interface BringTrunkHow {
  	/** "its brief was not accepted" | "its planning run did not start" */
  	refused: string;
  	/** "accept the brief again" | "start its planning again" */
  	again: string;
  	/** "its brief was accepted" | "its planning run": the merge commit reads `plan(<name>): <trunk> merged before <when>` */
  	when: string;
  }

  export async function bringTrunkIntoPlan<T>(
  	anyCheckout: string,
  	plan: string,
  	how: BringTrunkHow,
  	after?: () => T | Promise<T>,
  ): Promise<T | undefined> {
  	const wp = await workbenchPlan(anyCheckout, plan);
  	const pb = wp ? null : await planBranch(anyCheckout, plan);
  	const at = wp
  		? { checkout: wp.code.worktree, branch: wp.code.branch, trunk: wp.trunkBranch, planDir: null }
  		: { checkout: pb!.worktree, branch: pb!.branch, trunk: pb!.trunkBranch, planDir: relative(pb!.worktree, pb!.dir) };
  	const before = await headSha(at.checkout);
  	try {
  		await git(at.checkout, "merge", "--no-edit", "-m", `plan(${plan}): ${at.trunk} merged before ${how.when}`, at.trunk);
  	} catch (err) {
  		throw new PlanCommandRefusal(await whyNotBrought(at, plan, how, err)); // reads unmerged paths, then aborts
  	}
  	try {
  		if (at.planDir) {
  			const changed = lines(await git(at.checkout, "diff", "--name-only", before, "HEAD", "--", at.planDir));
  			if (changed.length > 0) throw new PlanCommandRefusal(ownDocumentsMessage(at, plan, how, changed));
  		}
  		return await after?.();
  	} catch (err) {
  		await git(at.checkout, "reset", "--merge", before);
  		throw err;
  	}
  }
  ```

  `whyNotBrought` (decision 7): unmerged paths from `git diff --name-only --diff-filter=U`; abort when `MERGE_HEAD` exists; unmerged paths → the conflict message; else the uncommitted paths (`git status --porcelain`) that `git diff --name-only HEAD...<trunk>` names → the uncommitted-files message; else git's reason with the `Command failed:` and `hint:` lines removed. The three messages are decision 8's, word for word.

  </details>
- [x] Make accepting a brief bring main in first, with every read and check after the merge inside its undo.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/plans/accept-brief.ts`, with `ACCEPTING = { refused: "its brief was not accepted", again: "accept the brief again", when: "its brief was accepted" }`. The own-branch path:

  ```typescript
  const pb = await planBranch(anyCheckout, plan);
  readDraftBrief(pb.dir, plan);
  refuseFailingContract(pb.worktree, plan);
  const brief = await bringTrunkIntoPlan(anyCheckout, plan, ACCEPTING, () => {
  	const merged = readDraftBrief(pb.dir, plan);
  	refuseFailingContract(pb.worktree, plan);
  	return merged;
  });
  // setImplKeys sets frontmatter keys in any plan document and commits that file alone.
  await setImplKeys(pb, brief!.path, acceptedKeys(), message);
  ```

  The workbench path keeps `readDraftBrief(wp.dir, plan)` and `refuseFailingContract(wp.root, plan)`, then calls `bringTrunkIntoPlan(anyCheckout, plan, ACCEPTING)` (the code branch; the registry at the root is not changed by it, so no second check), then writes and commits the brief at the root as today.

  </details>
- [x] Make the admin's planning start bring main in before its first step, and answer a refusal on its route.
  <details><summary>Technical</summary>

  In `apps/indusk-admin/src/lib/build-host.ts` `startPlanning`, inside the existing `try`, after `nextPlanningStep(read)` has not declined and before `sessionManager().admitBuild(...)`:

  ```typescript
  await bringTrunkIntoPlan(root, plan, {
  	refused: "its planning run did not start",
  	again: "start its planning again",
  	when: "its planning run",
  });
  ```

  imported from `@infinitedusky/indusk-mcp/plans` beside `acceptPlan`. The `catch` already releases the run's state and rethrows, so `POST /api/plans/plan` answers 409 with the message (`refuse(409, …)`), and `planningConversationEnded` returns `null` with no run. No route or interface file changes.

  </details>
- [x] Write the deferred test of a workbench plan's planning start.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/bring-trunk.test.ts` from the body in Test Phase 1's register (A29), with the fixture calls taken from `accept-brief-workbench.test.ts`.

  </details>
- [x] Keep the existing refusals and commit message exactly as they are.
  <details><summary>Technical</summary>

  `refuseInsideBuildStep` stays first, `readDraftBrief` and the first contract check stay before the merge, and the acceptance commit message stays `plan(<name>): brief accepted` (A18, A20, A23).

  </details>

#### Build Phase 1 Verification

- [x] Bringing main in, every refusal and the planning run's start behave as the tests say, in the package and in the admin.
  <details><summary>Technical</summary>

  A1, A2, A4–A11, A13–A17, A19, A21, A22, A26–A29 go green: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts apps/indusk-mcp/src/lib/plans/bring-trunk.test.ts apps/indusk-admin/src/lib/build-host.trunk.test.ts apps/indusk-admin/src/lib/build-host.test.ts && pnpm exec vitest related apps/indusk-mcp/src/lib/plans/accept-brief.ts apps/indusk-mcp/src/lib/plans/bring-trunk.ts` — the whole suite runs at landing, not here.

  </details>
- [x] Every guard still passes, and the changed files type-check and lint clean.
  <details><summary>Technical</summary>

  A3, A18, A20, A23, A24, A25 stay green in the same run; then `pnpm check` (Biome), `pnpm exec tsc --noEmit -p apps/indusk-mcp` and `pnpm exec tsc --noEmit -p apps/indusk-admin` pass.

  </details>

#### Build Phase 1 Context

- [x] Record the rule in the package's area context file.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, tier: directory (it is loaded when a file there is read), near the existing plans-lifecycle rules: "A plan is brought up to its trunk where its planning can begin — `plans accept-brief` and the admin's planning start — through one function, `bringTrunkIntoPlan` (`plans/bring-trunk`): a conflict, the trunk changing the plan's own documents, or uncommitted files in the way are undone and refused naming the files, never asking the person to merge. 'Current' is the local trunk; nothing fetches." Not the root: it is an area rule. No `lesson:` token; none is created here.

  </details>

#### Build Phase 1 Document

- [x] Update the command's reference page for the new order and the refusals.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, the `accept-brief` section: the order (contract check, bring main in, check again, accept), that the admin's planning start brings main in too (workbench plans: the code branch, to its repo's trunk), the three refusals and their wording, that nothing is changed on refusal, and that the person never merges by hand.

  </details>

### Build Phase 2: Say it in the skill and the docs

**Tier**: med — the work step's default

This phase makes what people read match what the command and the admin now do, and leaves the one manual check ready for the person to run once the plan has landed and the build is installed. It follows Build Phase 1 because the words describe behaviour that must already exist.

- [x] Make the planner skill say that accepting brings main in first, that the planning run does too, and what a refusal asks.
  <details><summary>Technical</summary>

  Edit `apps/indusk-mcp/skills/planner.md` (never `.claude/skills/` directly), in step 4 where `indusk plans accept-brief` is described: it first brings main into the plan's branch; it refuses a conflict, main changing the plan's own documents, or uncommitted files in the way, naming the files with nothing changed; the planning run's start does the same, so a status set by hand is still planned on current main. Keep the skill's existing length conventions; then `indusk update` syncs `.claude/skills/`.

  </details>
- [x] Add the changelog entry and update the briefs guide.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`: "**A brief is accepted on current main** (a-brief-is-accepted-on-current-main): `indusk plans accept-brief` and the admin's planning start bring main into the plan's branch first (a workbench plan's code branch to its repo's trunk), so the plan is written against current code; a conflict is undone and refused, naming the files." `apps/docs/src/guide/briefs.md` near line 147: the accepting paragraph gains one sentence on the same.

  </details>
- [x] Leave the after-landing live check's steps where the person will find them.
  <details><summary>Technical</summary>

  The A12 recipe and its empty `Result:` line are in `## Notes` (Test Phase 1 Document). The row stays `skipped` until the person runs it after landing's `pnpm install:local` and `indusk ui restart`; a planning run that does not start, or main not an ancestor, is a break to fix, not a note.

  </details>

#### Build Phase 2 Verification

- [x] The skill and the docs describe the new order, and the manual check waits in the Notes with its recipe.
  <details><summary>Technical</summary>

  `grep -n "main" apps/indusk-mcp/skills/planner.md` shows the accept-brief paragraph; `grep -n "accept-brief" apps/docs/src/reference/cli/plans.md apps/docs/src/changelog.md` shows both entries; A12 reads `skipped` in the trajectory with its recipe and an empty `Result:` in Notes.

  </details>

#### Build Phase 2 Context

- [x] Check that no always-loaded context still says accepting only sets a status.
  <details><summary>Technical</summary>

  Tier: planning (the planner skill is the planning rules' delivery). Nothing new in root `CLAUDE.md`; `grep -n "accept-brief" CLAUDE.md .indusk/planning/CLAUDE.md` shows no line saying it only sets a status.

  </details>

#### Build Phase 2 Document

- [x] Publish the plan's page contribution at close.
  <details><summary>Technical</summary>

  The retrospective (or the plan's skip of it, with `indusk promises confirm a-brief-is-accepted-on-current-main`) carries the docs handoff; no decision page is published (no ADR). Confirm `apps/docs/src/reference/cli/plans.md` and the changelog entry are in the diff.

  </details>

### Build Phase 3: Falsification — someone else's work in the worktree, steps that refuse after the merge, and plans with no branch of their own

**Tier**: med — the work step's default

This phase tests the finished plan against the states a real worktree and a real admin can be in that the earlier tests never set up: a person's own unfinished merge, a staged file, an edit to a file main renamed, a repository that only allows fast-forwards, a commit that a hook rejects, a full set of session slots, and a plan that has no worktree at all. Each hypothesis is a test that should fail on today's code; each task below is the fix if it does. Once it closes, bringing main in never destroys or changes work it did not make, every refusal is in the plan's own plain words, nothing is left behind when a later step refuses, and a plan planned on the trunk still starts its planning run.

<details><summary>What the hunt looked at, and what it left alone</summary>

Four of these were reproduced with real git in a scratch repository before being written (git 2.x, ort): a staged unrelated file stops `git merge` with "Your local changes to the following files would be overwritten by merge"; `merge.ff=only` makes `git merge` exit 128 on a diverged branch while `git merge --ff` succeeds; a `commit-msg` hook can pass the merge commit and reject `plan(<name>): brief accepted`; and with a person's merge already stopped on a conflict, `git merge main` fails with "you have unmerged files", which `whyNotBrought` reads as the trunk conflicting and then answers with `git merge --abort` — destroying the person's merge. The rename case is the audit's, reproduced there. The admin's missing-worktree case was found by reading: `planLocation` falls back to `trunkCopy` for a plan with no worktree record, but `bringTrunkIntoPlan` calls `planBranch`, which refuses any copy whose source is not `worktree`; the existing `build-host.test.ts` mocks `bringTrunkIntoPlan` to a no-op, so nothing exercises it.

Searched without finding a way to break it: the own-documents check's path (`pb.dir` is inside the worktree, so the relative pathspec is inside the repository); a branch strictly behind main (fast-forward, no merge commit, main still an ancestor); a branch already holding main; an untracked file main adds (named by the uncommitted-files check through `ls-files --others`); a workbench code worktree's path (`workbenchPlan` resolves it absolute); `reset --merge` keeping a person's unrelated uncommitted files after an own-documents refusal; the contract check run twice around the merge.

Not authored, with reasons (decision, unattended): the refusal swallowed by `planningConversationEnded`'s `catch { return null; }` — it is reached only by a brief accepted by hand, the path the planning rules forbid, and showing it needs an admin surface this plan keeps out of scope; the audit records it for the person. A merge at every planning start, not only the first — a scope question the audit already put to the person, not a defect against what the impl decided. The conflict refusal's "Resolve them" — the audit's answer stands: a real conflict needs a person's judgement on content. Two merges in one worktree at once — the planning start runs after the conversation that accepted has ended, and `startPlanning` holds the plan's run state before its first await. Unrelated histories — a plan branch is always cut from the trunk by `git worktree add`. Paths git prints quoted (non-ASCII names) — cosmetic, the file is still named.

</details>

- [x] Refuse to bring main in while the plan's worktree is already partway through combining other changes, and leave that work exactly as it was.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/bring-trunk.ts`: before the merge, look for `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD` and the `rebase-merge`/`rebase-apply` directories (`git rev-parse --git-path <name>` in the checkout, since a worktree's git dir is not `.git`). Any present → a `PlanCommandRefusal` starting with `head(plan, how)`, saying the worktree is partway through bringing other changes in, naming the unresolved files (`git diff --name-only --diff-filter=U`) and that this belongs to whoever started it — no word merge, rebase, commit or stash. Nothing is aborted. With the pre-check in place, the `merge --abort` in `whyNotBrought` only ever undoes the merge this call started. Hypothesis A31.

  </details>
- [x] Name the files git stops on whenever no conflict and no clear overlap explains it, so git's own sentences never reach the person.
  <details><summary>Technical</summary>

  `whyNotBrought` in `bring-trunk.ts`: list the trunk's changes with `git diff --name-only --no-renames HEAD...<trunk>`, so a renamed file's old path is in the set (A33). Read staged paths too (`git diff --name-only --cached`) beside `git diff --name-only HEAD` and the untracked list. When the merge stopped with no unmerged paths and the overlap is empty but the worktree has any staged or changed file, name every such file in the uncommitted-files message (A32: ort refuses on a staged file the trunk does not touch). Only when the worktree is clean does git's reason reach the fallback.

  </details>
- [x] Bring main in the same way whatever the repository's own setting for fast-forwards says.
  <details><summary>Technical</summary>

  `bringTrunkIntoPlan`: add `--ff` to the merge arguments, which overrides `merge.ff=only` and `merge.ff=false` from config (verified: plain `git merge` exits 128 under `merge.ff=only` on a diverged branch, `--ff` succeeds). A branch already holding main still gains no commit (A3). Hypothesis A36.

  </details>
- [x] Make the acceptance commit part of what is undone when anything after the merge fails, restoring the brief to its draft.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief.ts`: move `setImplKeys(pb, brief.path, acceptedKeys(), message)` into the `after` callback, and on any throw inside it write the brief's original bytes back and unstage it (`git reset -q -- <brief>`) before rethrowing, so `bringTrunkIntoPlan`'s `reset --merge` then undoes the merge on a clean tree. Today a rejected commit leaves `brief.md` written as accepted and staged, and the next attempt is refused by `readDraftBrief` as "accepted, not a draft". The workbench path: pass the `writeFileSync` and `commitAtRoot` as its `after`, restoring the root's `brief.md` (and its index entry at the root) on a throw. Hypothesis A35.

  </details>
- [x] Make the admin take its place for the run before it brings main in, so a run that cannot start leaves the branch as it was.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `startPlanning`: move the `bringTrunkIntoPlan` call after `sessionManager().admitBuild(project, plan)` and `planLocation(project, plan)` (both throw today after the merge has committed), still inside the `try` whose `catch` releases the run state and frees the place. Hypothesis A34.

  </details>
- [x] Let a plan that has no branch of its own start its planning run as it did before this plan, with nothing to bring in.
  <details><summary>Technical</summary>

  `bringTrunkIntoPlan`'s `placeOf` calls `planBranch`, which refuses a plan whose copy is not a worktree; `planLocation` (`session-host.ts`) plans such a plan on the trunk through `livePlanCopy`'s `trunkCopy`. In `bringTrunkIntoPlan`, read the copy with `livePlanCopy` first: a copy whose source is the trunk is already on current main, so run `after` and return without merging. `acceptBrief`'s own-branch path still calls `planBranch` first, so the command line's refusal of such a plan is unchanged. Hypothesis A30.

  </details>
- [x] Review the changed files' shape against the enabled extensions' craft rules and record what was changed or that nothing was. Reviewed against the extensions' craft rules: nothing to change. `refuseUnfinishedWork` is one named unit with a test seam; the two acceptance-undo blocks differ in where the brief lives and are left for `/cleanup`.

#### Build Phase 3 Verification

- [x] Work already in the plan's worktree — a person's unfinished merge, a staged file, an edit to a file main renamed — is named in plain words and left as it was, and a repository that allows only fast-forwards still has main brought in.
  <details><summary>Technical</summary>

  A31, A32, A33, A36 go from red to green: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts`. Each is written red at phase start on its own assertion (A31 on `MERGE_HEAD` gone after the call; A32 and A33 on git's sentence in the message; A36 on the refusal).

  </details>
- [x] A step that refuses after main is in — the acceptance commit, or the admin's place for the run — leaves no merge behind and the brief still a draft, and a plan with no branch of its own still starts its planning run.
  <details><summary>Technical</summary>

  A30, A34, A35 go from red to green: `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts apps/indusk-admin/src/lib/build-host.trunk.test.ts apps/indusk-admin/src/lib/build-host.test.ts`. A35 installs the hook in the temporary repository's common `hooks/` (a worktree shares it); A34 mocks `sessionManager().admitBuild` to throw; A30 puts the plan's folder on the trunk with no worktree record and `planLocation` answering `{ root: trunk, cwd: trunk }`.

  </details>
- [x] Every earlier test still passes, and the changed files type-check and lint clean.
  <details><summary>Technical</summary>

  A1–A11, A13–A29 stay green in the runs above plus `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts apps/indusk-mcp/src/lib/plans/bring-trunk.test.ts` and `pnpm exec vitest run --config vitest.system.config.ts apps/indusk-mcp/src/lib/plans/accept-brief.test.ts`; `pnpm exec tsc --noEmit -p apps/indusk-mcp`, `pnpm exec tsc --noEmit -p apps/indusk-admin`, and Biome on the touched files.

  </details>

#### Build Phase 3 Context

- [x] Add to the package's area rule that bringing main in never undoes or rewrites work it did not start, and that every step after the merge sits inside its undo.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, tier: directory, the line Build Phase 1 added: append "It refuses, touching nothing, a worktree already partway through a merge, rebase, cherry-pick or revert; it merges with `--ff` whatever `merge.ff` says; every write and commit after the merge (the acceptance commit included) runs inside its `after`, so a refusal there leaves no merge behind."

  </details>

#### Build Phase 3 Document

- [x] Add the refusal of a worktree that is partway through other changes to the command's reference page.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, the `accept-brief` section's list of refusals: one line for a worktree partway through bringing other changes in (named files, nothing touched), and that staged files are named with the uncommitted ones.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/bring-trunk.ts` | new: bring the trunk into a plan's branch (or a workbench plan's code branch), undo and refuse in plain words |
| `apps/indusk-mcp/src/lib/plans/index.ts` | export it |
| `apps/indusk-mcp/src/lib/plans/accept-brief.ts` | call it, with the contract check before and inside its undo step |
| `apps/indusk-admin/src/lib/build-host.ts` | `startPlanning` calls it before its first step |
| `apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts` | new: merge-first, order, no-merge-needed, history kept, main untouched |
| `apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts` | new: conflict, uncommitted files, own documents, naming, clean undo, second attempt, wording |
| `apps/indusk-mcp/src/lib/plans/accept-brief-output.test.ts` | new: what the command prints asks nothing |
| `apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts` | new: the planning run is asked for after an accepted brief, and not after a refusal |
| `apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts` | new: a workbench plan's code branch is brought up at acceptance |
| `apps/indusk-mcp/src/lib/plans/bring-trunk.test.ts` | new: a workbench plan's planning start |
| `apps/indusk-admin/src/lib/build-host.trunk.test.ts` | new: the admin's planning start brings main in, refuses a conflict, its route answers the refusal |
| `apps/indusk-mcp/CLAUDE.md` | the area rule |
| `apps/indusk-mcp/skills/planner.md` | describe the new order |
| `apps/docs/src/reference/cli/plans.md`, `apps/docs/src/guide/briefs.md`, `apps/docs/src/changelog.md` | describe it |

## Dependencies

- Nothing must exist first. `accept-brief`, `startPlanning` and their fixtures exist (`a-brief-is-planned-unasked`); the registry already holds this plan's three clauses and the two promises it must not break. The limit clause `the-person-never-merges` is being amended by the person to read "Accepting never asks the person to merge main by hand."; its rows are written for that wording.

## Notes

- A `blocker:` line: none.
- Settled after the plan review: the merge at planning start (decision 1), workbench plans (decision 10), nothing changed on any refusal (decisions 2 and 5), plain refusal words (decisions 7 and 8), main changing the plan's own documents (decision 6), the admin route's answer (decision 9), local main (decision 4), the manual check after landing (A12).
- Test Phase 1 result: observed red on an assertion — A1, A2, A5, A6, A7, A8, A9, A10, A11, A13, A14, A15, A16, A17, A19, A21, A22, A26, A27, A28 (25 test cases red across the six files; A9 and A16 and A14 have two cases each). Observed passing as guards — A3, A18, A20, A24, A25, and A23 (the existing `accept-brief.test.ts`, a system-tier file, run with `vitest.system.config.ts`: 4 of 4). One row behaved otherwise than the Verification fold said: **A4 passes today** — nothing is merged, so nothing is rewritten or dropped; it is kept as a guard whose State is `written` until Build Phase 1 closes (its `Passes at`). Decision (unattended): the new test files stay in the everyday tier — they run real git in temp repositories at ~0.4s a case and start no process that outlives a call; only `accept-brief.test.ts` was already listed in the system tier and stays there.
- Build Phase 1 result: every row except A12 reads passing; the 27 cases of the six package files and the 5 of `build-host.trunk.test.ts` are green, `tsc --noEmit` is clean in both apps, and Biome is clean on every file this plan touched. `pnpm check` over the whole repo fails in this environment on the installed Biome CLI (2.5.14) against the repo's 2.4.8 config schema — a pre-existing environment mismatch, not from these files (decision, unattended: checked the touched files directly instead). Shape review of `bring-trunk.ts` and the `accept-brief.ts` change: nothing found — `bringTrunkIntoPlan` has one reason to change, its two helpers (`whyNotBrought`, `ownDocumentsMessage`) are named and separate, and the merge and the undo are one seam a test reaches. Decisions made while building: (1) dirty files are read with `git diff --name-only HEAD` plus `git ls-files --others`, not `status --porcelain`, because `lib/git.ts`'s `git()` trims output and eats the first line's leading column; (2) the existing `build-host.test.ts` mocks `@infinitedusky/indusk-mcp/plans` with only `acceptPlan` on a fake non-repository path, so it gained a no-op `bringTrunkIntoPlan` — the real behaviour is `build-host.trunk.test.ts`'s; (3) `build-host.trunk.test.ts` inlines a small copy of the package's plan-lifecycle fixture, because the admin's type-check cannot take that fixture's imports (the impl allowed this).
- A12 recipe and `Result:`: after landing, run `pnpm install:local` and `indusk ui restart`; start a throwaway bugfix plan, commit a new file to main after it was cut, open a planning conversation on it in the admin and ask it to accept the brief; when the conversation ends, note that the planning run starts and that `git merge-base --is-ancestor main <accept commit>` exits 0 in the plan's worktree; record the date and result here. `Result:` (empty until the person runs it)
