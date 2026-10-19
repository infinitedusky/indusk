---
plan: a-brief-is-accepted-on-current-main
audited: 2026-10-19
model: claude-opus-5-5
---

# Audit — a-brief-is-accepted-on-current-main

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-admin/src/lib/build-host.ts:395` — The clause `main-is-merged-first` says accepting merges main "before the brief is marked accepted, in the admin and from the command line alike". Its admin rows prove something else. A7, a trajectory row, has a brief accepted by hand and then shows the admin's planning start merging main. On that path the merge happens after the brief is already committed `accepted`. The clause's own measure, `git merge-base --is-ancestor main <accept commit>`, is false for that commit. A12, the only row covering an acceptance made in the admin, is a skipped manual check.
  - breaks when: a planning conversation sets `status: accepted` by hand on a branch behind main. The accepting commit does not contain main, and only a later merge commit does.
  - answer: nothing — the admin accepts through its planning conversation running `indusk plans accept-brief`, which merges first; a status set by hand is the path the planning rules forbid, and the planning-start merge is only its backstop. Unattended run told not to act.
- `apps/indusk-admin/src/lib/build-host.ts:318` — The clause `a-conflict-refuses` says the acceptance is refused "naming each conflicting file, with the brief still a draft". A8, a trajectory row, calls `startPlanning` directly and checks that the thrown error names the file. A22, another row, checks that a conversation's end starts no run. In use, a conflict at the end of a conversation reaches `planningConversationEnded`, whose `catch { return null; }` throws the named refusal away. The brief also stays `accepted`, not draft. No row asserts that the person ever sees the file names on this path.
  - breaks when: a brief is set `accepted` by hand in a planning conversation and main conflicts with the branch. The conversation ends, no run starts, no file is named anywhere, and the brief reads `accepted`.
  - answer: nothing — real, on the forbidden by-hand path only: a conflict there is swallowed and the brief reads accepted. Left for the person; unattended run told not to act on findings.
- `apps/indusk-mcp/src/lib/plans/bring-trunk.ts:125` — The limit clause `the-person-never-merges` says accepting never asks the person to merge main by hand. A19, a trajectory row, proves only that the words merge, rebase, pull, commit and stash are absent from two refusal messages. The conflict refusal still tells the person to "Resolve them in <worktree> (or on <trunk>)". Reconciling the branch's version of a file with main's is a merge by hand under another name. A13, the row for retrying after a conflict, does exactly that: it commits main's version onto the branch.
  - breaks when: any real conflict. The person must reconcile the two sides of the files themselves before acceptance can succeed.
  - answer: nothing — the promise is that the system does the merge, not that conflicts resolve themselves; a true conflict needs a person's judgement on content. Worth the person's look at the wording.

## What does the diff change that no row touches?
- `apps/indusk-mcp/src/lib/plans/bring-trunk.ts:144` — The fallback refusal passes git's own error text through and strips only `Command failed:` and `hint:` lines. When git refuses because of a file with uncommitted changes that the uncommitted-files check misses, the person reads git's sentence "Please commit your changes or stash them before you merge." That breaks the plan's own wording rule (no merge, commit or stash), which A19, the no-merge-wording row, checks only on the two messages it constructs. Reproduced with real git: on the plan branch, `a.txt` has an uncommitted edit; on main, `a.txt` was renamed to `b.txt`. `git diff --name-only HEAD...main` lists only `b.txt`, so the uncommitted-files check matches nothing, and the merge fails with that text.
  - breaks when: the plan's worktree has an uncommitted edit to a file that main renamed, or any other git refusal the two checks do not classify, such as unrelated histories.
  - answer: nothing — real and reproduced: git's own 'commit or stash' text can reach the person on a renamed-file edge. Rare; left for falsification to pick up, unattended run told not to act.
- `apps/indusk-admin/src/lib/build-host.ts:395` — The merge runs before `sessionManager().admitBuild` (line 400) and `planLocation` (line 401), and both can throw. `admitBuild` throws `SessionBusy` when `sessions.max` is reached. The outer catch releases state but does not undo the merge, so the run is refused and the merge commit stays on the plan's branch. A8, the admin conflict row, covers only a merge that fails itself.
  - breaks when: the machine is at `sessions.max` (or `planLocation` returns an error) and a planning run is started on a branch behind main. The run does not start, but `plan(<name>): main merged before its planning run` is committed.
  - answer: nothing — real: a session-slot refusal after the merge leaves the merge commit on the branch. Harmless to correctness (main is meant to be in the branch) but contradicts 'nothing changed'. Not acted on per run instruction.
- `apps/indusk-mcp/src/lib/plans/accept-brief.ts:64` — `setImplKeys` writes and commits the accepted brief outside `bringTrunkIntoPlan`'s undo step. The workbench path's `writeFileSync` and `commitAtRoot` (lines 49–50) are outside it too. If that write or commit fails, the merge is kept, the brief stays a draft, and on a non-workbench plan the file can be left modified. No row makes the acceptance commit fail after a merge.
  - breaks when: the acceptance commit fails after a successful merge, for example a git commit hook rejects it, signing fails, or a lock is held. The person sees an error, but "nothing was changed" is false: main is already merged in.
  - answer: nothing — real but narrow: a failing acceptance commit after a clean merge keeps the merge. The merge is what acceptance wants anyway; not acted on per run instruction.

## What does the code do that the brief never promised?
- `apps/indusk-admin/src/lib/build-host.ts:395` — Every planning start merges main, not only the first one after acceptance. That includes a run restarted after earlier documents were written. The brief says that "after acceptance the branch may fall behind", and its Not promised section lists "Keeping a branch current after acceptance". The code keeps it current at every planning start and can refuse a run on an already-accepted plan because of main moving after acceptance.
  - breaks when: a planning run stops partway (for example `cannot-continue` after the test plan) and main changes a file the branch also changed. The restart is refused over a conflict that arose after acceptance, which the brief said would not block.
  - answer: nothing — merging main at every planning start is beyond the promise; a restart can be refused by a post-acceptance conflict. A scope question for the person, not acted on per run instruction.
- `apps/indusk-mcp/src/lib/plans/bring-trunk.ts:69` — Acceptance is refused when main changes any file in this plan's folder, even when the merge is clean (the impl's decision 6, tested by A28). The brief promises a refusal only "when that merge conflicts". The path filter is the whole plan folder, so main touching any file there blocks acceptance, not only a change to the brief.
  - breaks when: main holds a non-conflicting edit to a file in the plan's folder, such as `research.md` or a typo fix to the brief made on main. Acceptance is refused even though the merge would succeed.
  - answer: nothing — deliberate (impl decision 6, row A28): main touching the plan's own folder would silently change the documents being accepted, so it is refused. Broader than the brief's wording; shown to the person.

## Which rejected ADR alternative does the code quietly take?
- nothing

## What let these through?
- Rows tested each function where it starts, not the path a person actually takes, so the admin's conversation-end path and git's passed-through error text went unchecked — findings: `build-host.ts:395` (rows), `build-host.ts:318`, `bring-trunk.ts:125`, `bring-trunk.ts:144` — highlight: h-20261019-026
- "Nothing is changed" was planned and tested only for the merge step, so later steps that can refuse keep the merge — findings: `build-host.ts:395` (no row), `accept-brief.ts:64` — highlight: h-20261019-027
