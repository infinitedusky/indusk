---
title: "A brief is accepted on current main — Test Plan"
date: 2026-10-19
status: draft
---

# A brief is accepted on current main — Test Plan

## Purpose

This document is the clause plan of the brief: the behavioral assertions that, taken together, mean the fix works. Accepting a brief first brings main into the plan's branch, and so does the start of the plan's planning run; a merge that conflicts is undone and the acceptance (or the run) refused, naming each conflicting file, with the brief still a draft; and the person is never asked to merge main by hand. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove, and under it by clause.

The assertions here become the rows of the impl's `## Test Trajectory` table, with the same IDs. The brief is `clauses: required`, so each row will name its clause (`clause: <promise>/<clause>`) or the promise (`promise: <promise>`).

## Decisions made while writing this plan

The first version of this plan was written unattended (`INDUSK_GATE_POLICY=auto`); after its cold read (`plan-review.md`) the person settled the points below, and this version carries them.

1. **`research.md` does not exist for this plan.** The workflow is `bugfix` (brief + test plan + impl), which does not require one; the brief carries the problem. Nothing was skipped that the workflow asks for.
2. **Tests use real git in temporary repositories, not mocks.** Whether a merge conflicts, is aborted and leaves the draft brief untouched is a fact git decides; a mock would only restate what we assume. Each such test builds a temp trunk and plan branch in a fresh temp home, starts no server or daemon, and is fast, so every row but the one manual check is `unit` or `contract`, never the slow tier (`/decisions/tests-never-make-us-wait`).
3. **Main is brought in where planning starts, as well as at acceptance.** In the admin a brief is accepted by a planning conversation (which may run `indusk plans accept-brief`, or may set the status by hand), and a run held for looks can start long after acceptance. So the admin's planning start brings main into the plan's branch before the first planning step, through the same package function and with the same refusal. The admin half of `main-is-merged-first` (accepting merges main first, in the admin and from the command line alike) is proved by behaviour on a real repository at that start (A7, A8), not by reading source text.
4. **A merge that is already up to date is not a commit.** When the branch already holds main there is nothing to merge; acceptance proceeds as today and writes no merge commit (A3).
5. **Conflicts are undone before the refusal is given, and "nothing changed" is checked by three facts:** the brief's status is still `draft`, the working tree is clean, and the branch's head is the commit it was at. Every read and check that follows the merge sits inside the step that undoes it on failure, so no refusal leaves the merge behind.
6. **Workbench plans are merged too.** A workbench plan's code branch exists from `indusk plans start`; at acceptance and at planning start it is brought up to its repo's trunk the same way (A16, A29). Its documents live at the workbench root, which main of the code repo does not hold.
7. **Uncommitted files in the plan's worktree are named, not git's words.** When git will not start the merge because files in the worktree have uncommitted changes main also touches, the refusal names those files in plain words and says they belong to whoever made them; it never quotes git's command line and never tells the person to merge, commit or stash (A9, A19).
8. **Main changing this plan's own documents refuses.** If bringing main in would change any file in this plan's folder — even without a conflict — the acceptance is refused naming the file and the merge undone: the person accepts only what they read (A28).
9. **"Current main" is the local trunk branch.** Nothing is fetched; landing merges the same local trunk.
10. **When a refusal may ask the person to act.** The limit clause `the-person-never-merges` reads "Accepting never asks the person to merge main by hand." A refusal for a conflict, for main changing this plan's documents, or for a brief that fails its contract check once main is in may ask the person to act (resolve the files, settle which document is the plan's, fix the brief); none of them asks the person to merge main.
11. **Signals: no telemetry mark exists for these clauses** (`otel.role` is `library`; acceptance is a one-shot command, not something that happens regularly, so no `expect_every`). Each clause's signal is the refusal it prints and the tests that run at close; the one live run on the installed admin (A12) is a manual check after landing.

## Behavioral Assertions

**Every assertion is observable from outside the system:** what `indusk plans accept-brief` prints and exits with, what the admin's planning route answers, what the brief's status reads, what the branch's history holds.

## `a-brief-is-accepted-on-current-main`

Accepting a brief first brings main into its plan's branch, so the plan is written against current code; when that merge conflicts, the acceptance is refused, naming the conflicting files, and nothing is changed.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A28 | When main holds a change to this plan's own `brief.md` that does not conflict, accepting is refused naming `brief.md`; the brief still reads `draft`, the tree is clean and the branch's head is the commit it was at. | unit |

### `main-is-merged-first` — accepting a brief merges main into the plan's branch before the brief is marked accepted, in the admin and from the command line alike

- Signal: the plan branch's history, read after acceptance. Upheld when the accepted brief's commit has main's head as an ancestor, in the admin and from the command line alike; broken reports the plan whose accepted brief's commit does not contain main. Measure: for the plan's branch, `git merge-base --is-ancestor main <accept commit>` exits 0.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan branched before main gained a commit that touches an unrelated file: after `accept-brief`, the plan's branch holds that file's new content and the brief reads `accepted`. | unit |
| A2 | Order: in the plan branch's history the merge of main comes before the commit that marks the brief accepted, never after; main's head is an ancestor of the accepting commit. | unit |
| A3 | A plan branch that already holds main's head is accepted with no merge commit added: the only new commit is the one that marks the brief accepted. | unit |
| A4 | A plan whose branch is ahead of main as well as behind it keeps every one of its own commits after the merge; none is rewritten or dropped (merged, not rebased). | unit |
| A5 | Main's merge does not change the brief: a main commit that touched other plans' folders arrives in the branch, and this plan's `brief.md` differs from before only by `status: accepted` and `accepted_at`. | unit |
| A6 | The contract check runs again on the merged branch: a brief that passed before the merge but fails once main's registry is in is refused, and the merge is undone so the branch is as it was. | unit |
| A7 | The admin's planning start brings main in: a plan whose brief was accepted by hand (no `accept-brief`, so no merge at acceptance) on a branch behind main is started from the admin, and the first planning step runs in a worktree that holds main's newest commit. | unit |
| A16 | A workbench plan whose code branch is behind its repo's trunk: accepting brings the trunk into the code branch (its worktree holds the trunk's new file), and the brief is written and committed at the workbench root as before. A conflict in the code branch refuses naming the files, with the brief still a draft and the code branch's head unchanged. | unit |
| A29 | A workbench plan's planning start brings the repo's trunk into its code branch, through the same package function the admin's start calls. | unit |
| A12 | After landing, on the installed admin, with a plan branch left behind main on purpose: a planning conversation accepts the draft brief, the planning run starts when it ends, and the plan's branch holds main's newest commit. | live check |

### `a-conflict-refuses` — a merge that conflicts is undone and the acceptance refused, naming each conflicting file, with the brief still a draft

- Signal: the refusal printed to the person (command line) or answered by the admin's planning route, and the brief's status. Upheld when a conflicting merge leaves the brief `draft`, the tree clean and the head unmoved, and the message lists every conflicting path; broken reports the plan whose conflict left the brief accepted, a half-merge, or a path missing from the message. Measure: after a forced conflict, `accept-brief` exits non-zero, `git status --porcelain` is empty, `git rev-parse HEAD` equals its value before, and the message contains each of the conflicting paths.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A conflicting merge at the admin's planning start stops the run: no planning step begins, the refusal names each conflicting file, and the plan's branch head is the commit it was at with a clean tree. | unit |
| A9 | When main and the plan's branch both changed the same lines of one file, `accept-brief` is refused, and the refusal names that file's path. When git will not start the merge because a file in the plan's worktree has uncommitted changes main also touches, the acceptance is refused with nothing changed and that file named. | unit |
| A10 | With two files in conflict, the refusal names both, each on its own line; with one conflict among several merged cleanly, only the conflicting file is named. | unit |
| A11 | After the refusal the brief still reads `draft`, with no `accepted_at`; the working tree is clean (no conflict markers, no unmerged paths, no `MERGE_HEAD`); and the branch's head is the commit it was at before. | unit |
| A13 | After a refusal, accepting again once the conflict is gone succeeds: the refusal left no state that blocks a second attempt. | unit |
| A14 | The refusal's wording says what the person must do and that nothing was changed, and reads as a refusal of the plan command, never a crash; the admin's planning route, asked to start a conflicting plan, answers with that refusal's message as the response body the page shows (status 409, `error` holding the message with each file). | contract |
| A15 | A conflict in a file that is the brief itself (main and the branch both edited `brief.md`) refuses the same way; the brief is not marked accepted over a text the person has not read. | unit |

### `the-person-never-merges` — accepting never asks the person to merge main by hand

- Signal: what the command prints and the admin's planning route answers. Upheld when an acceptance on a branch behind main, without conflict, completes with no prompt, no "merge main first" refusal and no second step, and no refusal ever tells the person to merge main; broken reports the plan and the instruction that asked. Measure: `indusk plans accept-brief` on a behind-main branch with no conflict exits 0 without reading stdin and prints no instruction to merge.

A refusal for a conflict, for main changing this plan's documents (A28), or for a brief that fails its check once main is in (A6) may ask the person to act; none of them asks the person to merge main.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | A branch behind main with no conflict is accepted in one command that asks nothing: what `indusk plans accept-brief` prints (the acceptance line and the admin-ask line) contains no instruction to merge, rebase, pull or update the branch, it does not exit non-zero, stdin is not read, and afterwards the branch holds main's newest commit. | unit |
| A18 | A brief that fails its contract check is refused with the check's own messages, as before, and the plan's branch is not merged into first, so a refused brief leaves the branch untouched. | unit |
| A19 | No refusal tells the person to merge main: the conflict refusal names files to resolve, and the uncommitted-files refusal names the files and says they belong to whoever made them; neither quotes git's command line (`Command failed`, `git merge`) nor tells the person to merge, rebase, pull, commit or stash. | unit |
| A20 | A session inside a build step is still refused acceptance before anything is merged, as `refuseInsideBuildStep` did: the branch is untouched. | unit |

## Existing promises

### Must not break: `an-accepted-brief-is-planned-unasked`

The planning run still starts on acceptance, now on a branch holding main.

- Signal: the existing promise's own signal, read where that promise is read.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | Accepting a brief on a branch behind main still hands the plan to the planning run, from the command line and from the admin. Command line: the ask `askAdminToPlan` posts (`{ project, plan }` only, no path) is made once, after the brief is committed accepted, and at that moment the plan's worktree — the checkout the admin's planning run resolves for the plan — holds main's new file. Admin: when a planning conversation that accepted the brief ends, `planningConversationEnded` starts the run once, and its first step runs in a worktree holding main's new file. | unit |
| A22 | A refused acceptance (conflict) starts no planning run: the command line makes no ask and exits through its refusal; in the admin, a conflicting plan's conversation end starts no run. | unit |
| A23 | The existing accept-brief tests (non-draft refused, failing contract refused with the check's messages, build-step refusal, commit message `plan(<name>): brief accepted`) stay green unchanged. | unit |

### Must not break: `a-plan-is-written-on-its-own-branch`

Main is merged into the plan's branch; nothing is written on main.

- Signal: the existing promise's own signal (the recorded break when a plan commit lands on main).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A24 | After an accepted and after a refused acceptance, main's head is exactly the commit it was at before; the merge ran in the plan's worktree, not in the checkout that holds main. | unit |
| A25 | Accepting from the main checkout (`anyCheckout` is the repo root) still merges into and commits on the plan's branch, never on main. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A26 | The seen case: a branch cut before an audit skill change landed on main holds the new skill file after `accept-brief`, so the planning run that follows reads the new skill. | unit | the failure that started this plan (`decisions-as-questions` against `audit-concerns-are-answered`), kept as a regression guard |
| A27 | The commit message of the merge names the plan and main (`plan(<name>): main merged before its brief was accepted`), so the history reads without opening it. | unit | a history that explains itself; no promise says so |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The ten drafted `fix-http-*` briefs, 1,203 commits behind main, merge cleanly when each is accepted. | Their content and main's drift differ per plan and change daily; a test cannot hold a future merge. | Each is merged when accepted (brief's Not promised); a conflict there is the refusal A9–A11 prove. |
| U2 | A plan reviewed on the now-current branch is read against main's code by its plan review. | A cold reader's judgment, not a measurable fact. | The plan review, the planning run's last step (`audit-concerns-are-answered`), answers it. |
| U3 | A planning conversation in the admin relays a refusal from `accept-brief` to the person rather than summarising it away. | The conversation is an agent's prose, not a fixed output. | The command prints the refusal as its own output; the planning start refuses again with the same words if the brief was accepted some other way, and the admin's route returns that message (A14). |

## Notes

- Levels: every row but A12 is `unit` or `contract`, using temp git repos; A12 is the one `live check`, run by hand on the installed admin after landing and recorded as skipped until then.
- No row is `promise` level: the brief's expectations are `None`, and no production mark exists for a one-shot command.
- Rows name `clause:` for A1–A7, A12, A16, A29 (`main-is-merged-first`), A8–A11, A13–A15 (`a-conflict-refuses`) and A17–A20 (`the-person-never-merges`); A28 names `promise: a-brief-is-accepted-on-current-main`. The impl's rows carry the token in their test files.
- The limit clause's rows (A17–A20) are written for its amended wording, "Accepting never asks the person to merge main by hand."
