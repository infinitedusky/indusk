---
title: "A brief is accepted on current main — Test Plan"
date: 2026-10-19
status: draft
---

# A brief is accepted on current main — Test Plan

## Purpose

This document is the clause plan of the brief: the behavioral assertions that, taken together, mean the fix works. Accepting a brief first brings main into the plan's branch; a merge that conflicts is undone and the acceptance refused, naming each conflicting file, with the brief still a draft; and the person is never asked to merge anything by hand. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove, and under it by clause.

The assertions here become the rows of the impl's `## Test Trajectory` table, with the same IDs. The brief is `clauses: required`, so each row will name its clause (`clause: <promise>/<clause>`).

## Decisions made while writing this plan

This build ran unattended (`INDUSK_GATE_POLICY=auto`); nobody could be asked. Each decision below is mine, with its reason, for the person to read at approval.

1. **`research.md` does not exist for this plan.** The workflow is `bugfix` (brief + test plan + impl), which does not require one; the brief carries the problem. Nothing was skipped that the workflow asks for.
2. **Tests use real git in temporary repositories, not mocks.** Whether a merge conflicts, is aborted and leaves the draft brief untouched is a fact git decides; a mock would only restate what we assume. Each such test builds a temp trunk and plan branch in a fresh temp home, starts no server or daemon, and is fast, so every row is `unit` or `contract`, never the slow tier (`/decisions/tests-never-make-us-wait`).
3. **The admin is proved once, as a `live check`, plus a code-reading `contract`.** The brief says the admin and the command line alike. Both reach the same package function (`acceptBrief` in `plans/accept-brief`); the contract row proves the admin has no merge of its own, and one live check proves the refusal's words reach the person.
4. **A merge that is already up to date is not a commit.** When the branch already holds main there is nothing to merge; acceptance proceeds as today and writes no merge commit. This is an assertion (A3) rather than an open question, because a merge commit on every acceptance would be noise nobody asked for.
5. **Conflicts are undone before the refusal is thrown, and the refusal is checked for "nothing changed" by three facts:** the brief's status is still `draft`, the working tree is clean, and the branch's head is the commit it was at. A conflict that left a half-merge would break the person's next attempt, so this is the clause's heart, not a detail.
6. **A dirty plan worktree is not in the brief; I treat it as out of scope and record it as an open decision for the ADR.** See Open decisions.
7. **Signals: no telemetry mark exists for these clauses** (`otel.role` is `library`; acceptance is a one-shot command, not something that happens regularly, so no `expect_every`). Each clause's signal is the refusal it prints and the tests that run at close; the `mark-first` rule asks a real run to report the clause upheld, and the live check (A12) is that run.

## Open decisions

Recorded for the ADR; none blocks this test plan.

- **Workbench plans.** In a workbench, a plan's documents live at the workbench root (no plan branch for them) and only its code gets `plan/<name>` in a repo. Accepting there writes the brief at the root (`workbenchPlan` in `accept-brief.ts`). Which branch main is merged into — the code branch, if one exists — is for the ADR to decide. A15 and A16 below state the assertion for the case the brief covers (a plan branch holding its documents) and require that the workbench path does not regress; they do not decide the workbench merge.
- **A dirty plan worktree.** If the plan's worktree has uncommitted changes, git may refuse the merge for a reason that is not a conflict. The ADR decides whether that refuses with git's words or with its own; A9 asserts only that it is refused with nothing changed and the reason named.
- **Where in the order the merge sits relative to the contract check.** Decided here: the check runs before the merge (the cheaper refusal first, branch untouched, A18) and again after it (A6), because main can change the registry. The ADR may change the order; it must keep both assertions true.

## Behavioral Assertions

**Every assertion is observable from outside the system:** what `indusk plans accept-brief` prints and exits with, what the brief's status reads, what the branch's history holds. None names an internal function except where the assertion is that no second implementation exists.

## `a-brief-is-accepted-on-current-main`

Accepting a brief first brings main into its plan's branch, so the plan is written against current code; when that merge conflicts, the acceptance is refused, naming the conflicting files, and nothing is changed.

### `main-is-merged-first` — accepting a brief merges main into the plan's branch before the brief is marked accepted, in the admin and from the command line alike

- Signal: the plan branch's history, read after acceptance. Upheld when the accepted brief's commit has main's head as an ancestor, in the admin and from the command line alike; broken reports the plan whose accepted brief's commit does not contain main. Measure: for the plan's branch, `git merge-base --is-ancestor main <accept commit>` exits 0.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan branched before main gained a commit that touches an unrelated file: after `accept-brief`, the plan's branch holds that file's new content and the brief reads `accepted`. | unit |
| A2 | Order: in the plan branch's history the merge of main comes before the commit that marks the brief accepted, never after; main's head is an ancestor of the accepting commit. | unit |
| A3 | A plan branch that already holds main's head is accepted with no merge commit added: the only new commit is the one that marks the brief accepted. | unit |
| A4 | A plan whose branch is ahead of main as well as behind it (its own planning commits plus main's new ones) keeps every one of its own commits after the merge; none is rewritten or dropped (the history is merged, not rebased). | unit |
| A5 | Main's merge does not change the brief: a main commit that touched other plans' folders arrives in the branch, and this plan's `brief.md` differs from before only by `status: accepted` and `accepted_at`. | unit |
| A6 | The contract check runs again on the merged branch: a brief that passed before the merge but fails once main's registry is in (a promise it rests on was withdrawn on main) is refused, not accepted, and the merge is undone so the branch is as it was. | unit |
| A7 | The admin's accept control and `indusk plans accept-brief` reach the same one function: a plan accepted from the admin ends with the same history (main merged, then accepted) as the same plan accepted from the command line. | contract |
| A8 | The admin's accept route and the command line define no merge of their own: neither source file runs `git merge` or names a branch operation; both call the package's accept. | contract |
| A12 | On the installed admin, with a plan branch left behind main on purpose: pressing accept on its draft brief ends with the brief accepted, the planning run starting, and the plan's branch holding main's newest commit. | live check |

### `a-conflict-refuses` — a merge that conflicts is undone and the acceptance refused, naming each conflicting file, with the brief still a draft

- Signal: the refusal printed to the person (command line) or shown on the brief page (admin), and the brief's status. Upheld when a conflicting merge leaves the brief `draft`, the tree clean and the head unmoved, and the message lists every conflicting path; broken reports the plan whose conflict left the brief accepted, a half-merge, or a path missing from the message. Measure: after a forced conflict, `accept-brief` exits non-zero, `git status --porcelain` is empty, `git rev-parse HEAD` equals its value before, and the message contains each of the conflicting paths.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | When main and the plan's branch both changed the same lines of one file, `accept-brief` is refused, and the refusal names that file's path. A merge git refuses for a reason that is not a conflict (a dirty worktree) is also refused, with nothing changed and git's reason in the message. | unit |
| A10 | With two files in conflict, the refusal names both, each on its own line; with one conflict among several merged cleanly, only the conflicting file is named. | unit |
| A11 | After the refusal the brief still reads `draft`, with no `accepted_at`; the working tree is clean (no conflict markers, no unmerged paths, no `MERGE_HEAD`); and the branch's head is the commit it was at before. | unit |
| A13 | After a refusal, accepting again once the conflict is gone (the person fixes it on the branch or main moves) succeeds: the refusal left no state that blocks a second attempt. | unit |
| A14 | The refusal's wording says what the person must do and that nothing was changed ("nothing was changed"), and the admin shows that same message on the brief page as it shows any refusal; a conflict does not read as a crash. | contract |
| A15 | A conflict in a file that is the brief itself (main and the branch both edited `brief.md`) refuses the same way; the brief is not marked accepted over a text the person has not read. | unit |
| A16 | In a workbench plan, accepting still writes the brief at the workbench root and commits it as before; the refusal path and the merge path add nothing that breaks that flow (the workbench merge is an open decision above). | unit |

### `the-person-never-merges` — accepting never asks the person to merge main by hand; only a conflict asks anything of them

- Signal: the command's own output and the admin's accept screen. Upheld when an acceptance on a branch behind main, without conflict, completes with no prompt, no "merge main first" refusal and no second step; broken reports the plan and the instruction that asked. Measure: an `accept-brief` on a behind-main branch with no conflict exits 0 without reading stdin and prints no instruction to merge.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | A branch behind main with no conflict is accepted in one command that asks nothing: it exits 0 with no prompt, and its output contains no instruction to merge, rebase or update the branch. | unit |
| A18 | A brief that fails its contract check is refused with the check's own messages, as before, and the plan's branch is not merged into first (the cheaper refusal comes first), so a refused brief leaves the branch untouched. | unit |
| A19 | Where the refusal does ask something (a conflict), it asks for the conflict only: the message names files to resolve and never tells the person to run the merge command. | unit |
| A20 | A session inside a build step is still refused acceptance before anything is merged, as `refuseInsideBuildStep` did: the branch is untouched. | unit |

## Existing promises

### Must not break: `an-accepted-brief-is-planned-unasked`

The planning run still starts on acceptance, now on a branch holding main.

- Signal: the existing promise's own signal, read where that promise is read.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | Accepting a brief on a branch behind main still hands the plan to the planning run: the run starts once, after the brief is accepted, and starts from the merged branch (the run's working directory holds main's new file). | unit |
| A22 | A refused acceptance (conflict) starts no planning run. | unit |
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

## Notes

- Levels: every row but A12 is `unit` or `contract`, using temp git repos; A12 is the one `live check`, on the installed admin, and runs at landing, never in the phase loop.
- No row is `promise` level: the brief's expectations are `None`, and no production mark exists for a one-shot command.
- Row names `clause:` for each of A1–A8, A12 (`main-is-merged-first`), A9–A11, A13–A16 (`a-conflict-refuses`) and A17–A20 (`the-person-never-merges`); the impl's rows carry the `clause: a-brief-is-accepted-on-current-main/<clause>` token in their test files.
