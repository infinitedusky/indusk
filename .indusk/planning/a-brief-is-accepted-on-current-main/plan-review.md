---
plan: a-brief-is-accepted-on-current-main
reviewed: 2026-10-19
read: 802eb48417453f27ba3098896357efc9fd6db70d685b802509fed89ea441d725
model: claude-opus-5-5
---

# Plan review — a-brief-is-accepted-on-current-main

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:85 — A21, the trajectory row for the must-not-break promise `an-accepted-brief-is-planned-unasked` (the planning run starts from the merged branch), says "the recorded ask carries the plan's worktree path", but the ask `askAdminToPlan` makes posts only `{ project, plan }` (apps/indusk-mcp/src/lib/plans/ask-admin.ts:64). The test can show the worktree holds main's file (A1 again) and that one ask was made, not that the run starts from the merged branch.
  - breaks when: the admin's planning run resolves the plan to a different checkout (for example the trunk's copy, or a stale worktree record) while A21 stays green.
  - answer: fix — row A21 now states what the ask posts (project and plan) and checks the worktree's state at the moment of the ask (test-plan.md, impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:85 — A21 and A22 drive `plansAcceptBrief`, the command-line path. In the admin, the brief is accepted inside a planning conversation and the run starts when that conversation ends, through `planningConversationEnded` (apps/indusk-admin/src/app/api/sessions/route.ts:84, apps/indusk-admin/src/lib/build-host.ts:303). No row tests that path, so "in the admin and from the command line alike" from the clause `main-is-merged-first` (accepting merges main first, in the admin and from the command line alike) is proved only for the command line.
  - breaks when: the admin's conversation-end path starts a planning run in a way that differs from the command-line ask, and no test sees it.
  - answer: fix — rows A21 and A22 also go through the admin path, the planning conversation's end and the planning start (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:71 — A7 and A8, the contract rows that stand in for the admin half of `main-is-merged-first`, scan source text for a `merge` git argument and a `status: accepted` write. In the admin, acceptance is done by a Claude agent following the planner skill, not by admin code, so a scan of admin source cannot show that the admin's acceptance goes through `acceptBrief`.
  - breaks when: the conversation agent sets `status: accepted` in brief.md itself instead of running `indusk plans accept-brief`; no admin source changes, A7 and A8 pass, and main is never merged.
  - answer: fix — rows A7 and A8 replaced by behaviour tests on a real temporary repository: the admin's planning start merges main, and a conflict there stops the run with the branch untouched (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:80 — A16 is filed under the clause `a-conflict-refuses` (a conflicting merge is undone and refused) but asserts that a workbench acceptance attempts no merge. For workbench plans the clause `main-is-merged-first` has no test, and the one row that touches them asserts the opposite of that clause.
  - breaks when: a workbench plan is accepted on a code branch behind its repo's trunk; every row is green and the plan is written against old code.
  - answer: fix — row A16 is now a positive workbench row: the plan's code branch is brought up to its repo's trunk; row A29 covers the workbench planning start (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:81 — A17, the trajectory row for the clause `the-person-never-merges` (accepting never asks the person to merge), is planned to run "through `acceptBrief`" (impl.md:117), which returns `{ plan }` and prints nothing. The clause and the test plan's measure are about what the command prints and whether it reads stdin (test-plan.md:75), and the verb's printed output (`plansAcceptBrief`, apps/indusk-mcp/src/bin/commands/plans.ts:227) is never checked.
  - breaks when: the verb's printed text (for example the admin-ask message appended after acceptance) tells the person to update or merge their branch, and A17 still passes.
  - answer: fix — row A17 is checked through what the accept-brief command prints (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:78 — A14, the trajectory row for the refusal's wording, was narrowed from the test plan's "the admin shows that same message on the brief page" (test-plan.md:69) to "reads as a `PlanCommandRefusal`". No row checks what the person sees in the admin when acceptance conflicts. There, the refusal goes to the conversation agent's tool output, not to a brief page.
  - breaks when: the conversation agent summarises or drops the conflict refusal, and the person in the admin never sees which files conflict.
  - answer: fix — row A14 also checks that the admin's planning route returns the refusal's message as the body the page shows (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:83 — A19, the row asserting the conflict refusal never tells the person to merge, is specified only for the conflict case (impl.md:123). The non-conflict refusal (git refuses to start because of local changes) quotes git's error message, which no row checks against the clause `the-person-never-merges`.
  - breaks when: a dirty worktree makes git refuse, and the message the person reads contains `git merge …` and git's "commit your changes or stash them before you merge", with every row green.
  - answer: fix — row A19 covers both refusals: neither quotes git or tells the person to merge, commit or stash (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:69 — A5, the trajectory row asserting the brief changes only by `status` and `accepted_at`, uses a main commit that touches only other plans' folders. No row covers main changing this plan's own `brief.md` without a conflict. Under that change the merged brief silently differs from the one the person read. A15, the row for a conflict in `brief.md`, covers only a conflicting edit.
  - breaks when: main holds a non-overlapping edit to this plan's brief.md; the merge applies it cleanly and the brief is marked accepted over text the person did not read.
  - answer: fix — new row A28: main changing this plan's own documents refuses, naming the file, with the merge undone (impl.md)

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:30 — Decision 7 leaves workbench plans unmerged on the claim that "its code branch is created when the build starts". It is not: `indusk plans start` creates `plan/<name>` and its code worktree in the repo at start (apps/indusk-mcp/src/lib/plans/start.ts:131-150), and `workbenchPlan` refuses acceptance when that worktree is gone (apps/indusk-mcp/src/lib/plans/workbench-plan.ts:55-58). A branch to merge into exists at acceptance. The promise's sentence has no workbench exception, and the brief's Not promised list (brief.md:53-57) does not exclude workbench plans.
  - breaks when: a workbench plan's code branch is cut, the repo's trunk moves, and the brief is accepted; the plan is written against the old code, which is the exact failure the brief describes.
  - answer: fix — workbench plans are merged at acceptance and at planning start; the old decision 7 is removed (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:204 — In the planned code, `readDraftBrief(pb.dir, plan)` runs after `bringTrunkIn` but outside the `try` that resets the merge. If it throws, the merge commit stays on the branch, which contradicts "nothing is changed" in the promise `a-brief-is-accepted-on-current-main`. It throws when main's merge leaves the brief missing or not a draft.
  - breaks when: main holds this plan's folder with the brief removed or already accepted (a plan once committed on main, or a same-named folder); acceptance is refused and the branch keeps main's merge.
  - answer: fix — every read and check after the merge sits inside the step that undoes the merge on failure (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:235 — When the merge fails without unmerged paths, `conflictMessage` quotes `(err as Error).message`. From `execFile` that message begins `Command failed: git merge --no-edit -m … main`, followed by git's "Please commit your changes or stash them before you merge." This asks the person something other than a conflict, contrary to the clause `the-person-never-merges` ("only a conflict asks anything of them"), and puts a `git merge` command line in front of them.
  - breaks when: the plan's worktree has an uncommitted tracked edit to a file main also changed; the person is told to commit or stash before a merge.
  - answer: fix — the cause of a failed merge is read from git's state, and each refusal has fixed plain wording naming the files (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:25 — The second contract check after the merge (decision 2, held by A6, the trajectory row for a brief that fails once main's registry is in) adds a refusal the promise does not state. A brief can now be refused, with the merge undone, because of something main changed. That asks the person to reconcile with main's registry, which is not a conflict, and the clause `the-person-never-merges` says only a conflict asks anything of them.
  - breaks when: main withdraws or renames a promise the brief rests on; acceptance is refused with contract messages, and the person must act on main's change with no conflict involved.
  - answer: amendment — the limit clause the-person-never-merges is to read "Accepting never asks the person to merge main by hand.", so a refusal for a conflict, for main changing the plan's documents, or for a brief that fails its check once main is in may ask the person to act; put to Sandy
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:26 — The merge brings in `pb.trunkBranch`, the local branch the trunk checkout is on (apps/indusk-mcp/src/lib/plans/plan-branch.ts:68). Nothing fetches. "Current main" in the promise means the local trunk's main, and the plan does not say so.
  - breaks when: the local main lags its remote (another machine, or a teammate landed and pushed); acceptance merges stale main and reports success.
  - answer: nothing — "current main" is the local trunk, the same one landing merges; the impl says so, and this project has no remote-first flow

## Which skip reason would you not accept?

- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:98 — A12 is the live check on the installed admin (the brief accepted in the admin, the planning run started, the branch holding main's newest commit). Its mitigation says "the contract rows hold the admin to the one package function". They do not: admin acceptance is a conversation agent following the planner skill (apps/indusk-mcp/skills/planner.md:104), and A7/A8 only scan source text. The skip rests on a premise the code does not support.
  - breaks when: the admin's conversation accepts the brief by hand-editing its status; nothing runs the merge, and the only check that would see it is the skipped one.
  - answer: fix — the live check's mitigation names the behaviour rows, not source scans (impl.md)
- .indusk/planning/a-brief-is-accepted-on-current-main/impl.md:76 — A12 is "Writable at / Passes at Build Phase 2", but its recipe and Build Phase 2's item (impl.md:299) require landing's `pnpm install:local` and `indusk ui restart` first. Landing comes after the build phases close, so the row cannot pass where it is placed. The recipe also says to "accept its draft brief in the admin", but the admin has no accept control for briefs (impl.md:24).
  - breaks when: Build Phase 2 closes with A12 still `skipped`, as its own Verification allows (impl.md:308), and nothing after landing reopens it.
  - answer: fix — the live check is a manual row run after landing, skipped with a Deferred Verification entry (impl.md)

## What else would have to change for each promise to hold?

- apps/indusk-mcp/skills/planner.md:104 — Acceptance by hand stays open. The skill only advises running `accept-brief` "rather than setting the status by hand". No hook blocks writing `status: accepted`, and the admin starts a planning run for any brief with an `accepted_at` (apps/indusk-admin/src/lib/build-host.ts:310-313). A brief accepted by an edit never has main merged.
  - breaks when: an agent or person edits the brief's status to accepted (with or without `accepted_at`), and the plan is planned and built on a branch behind main.
  - answer: fix — the admin's planning start merges main itself through the one package function, so a brief accepted by hand is still planned on current main (impl.md)
- apps/indusk-mcp/src/lib/plans/start.ts:131 — Workbench plans: the code branch made at start would have to be brought up to the repo's trunk (`workbenchPlan`'s `trunkBranch`) at acceptance for the promise's sentence to hold there.
  - breaks when: any workbench plan is accepted after its repo's trunk moved.
  - answer: fix — the workbench plan's code branch is brought up to its repo's trunk at acceptance and at planning start (impl.md)
- apps/indusk-mcp/src/lib/plans/ask-admin.ts:79 — The planning run can be held until every look the brief names is approved, so the plan may be written well after acceptance. The brief's "Not promised" (brief.md:55) excludes keeping the branch current after acceptance, but the promise's own sentence says acceptance happens "so the plan is written against current code".
  - breaks when: a brief with looks is accepted, main moves while the looks wait for approval, and the plan is written against main as it was at acceptance.
  - answer: fix — the planning start merges main, so a run held for looks and started later is planned on current main (impl.md)
- apps/indusk-mcp/src/lib/plans/plan-branch.ts:68 — The trunk branch is read from the local checkout with no fetch, so "current" means the local main.
  - breaks when: work is landed and pushed from another machine or workbench sync, and this machine's main has not pulled it.
  - answer: nothing — the same local trunk as landing; no fetch, stated in the impl

## What let these through?
- the plan was written from the command-line path only, without listing every path that reaches acceptance (the admin's conversation, a hand edit, a held run, a workbench) — findings: A7, A8, A16, A21, A22, decision 7, start.ts:131, planner.md:104 — highlight: h-20261019-025
