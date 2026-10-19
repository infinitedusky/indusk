---
title: "A brief is accepted on current main — Impl"
date: 2026-10-19
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
---

# A brief is accepted on current main — Impl

## Goal

`indusk plans accept-brief <plan>` first brings the project's trunk branch (main) into the plan's branch, then marks the brief accepted, so the planning run that follows writes the test plan, ADR and impl against current code. When bringing main in conflicts, the merge is undone, the acceptance is refused with each conflicting file named, and the brief stays a draft with the branch exactly as it was. The person never merges main by hand; only a conflict asks anything of them.

## Decisions made while writing this plan

This was written unattended (`INDUSK_GATE_POLICY=auto`); nobody could be asked. Each decision is mine, with its reason, for the person to read at approval. The test plan's own decisions and open decisions stand as written; this list settles the ones it left to the ADR (a bugfix has none) and adds the build-shaped ones.

1. **The merge lives in `acceptBrief`, in `plans/accept-brief.ts`, and nowhere else.** `indusk plans accept-brief` (the verb in `bin/commands/plans.ts`) calls it, and the admin has no brief-accept route of its own: the admin's accept is a planning conversation running that same command (`apps/indusk-admin/src/app/api/plans/` holds `accept` for built plans, `approve`, `build`, `plan` and `review`, none of which accepts a brief). So "in the admin and from the command line alike" is one code path, and the test plan's two contract rows (the admin and the command line reach the same function; neither defines a merge of its own) hold it there. Rejected: a merge helper beside the admin's routes, which is a second definition of the rule.
2. **Order inside `acceptBrief`: read the draft, run the contract check, merge main, re-read the brief, run the contract check again, then write and commit the acceptance.** The check first because it is the cheaper refusal and leaves the branch untouched (A18, the test-plan row for that). The check again after the merge because main's registry can change what a brief rests on (A6). Rejected: merging first, which would move a branch only to refuse the brief for a reason that never needed main.
3. **Merge, not rebase, and the merge uses `git merge --no-edit -m "<message>" <trunk branch>` run in the plan's worktree.** A rebase rewrites the plan's own planning commits (A4 forbids it) and the project's landing already merges main into the branch the same way (`lib/plans/land.ts`). A branch that already holds main is left alone (git prints "Already up to date" and adds nothing, A3); a branch with no commits of its own may fast-forward, which also adds no merge commit. The message, used only when a merge commit is made, is `plan(<name>): main merged before its brief was accepted` (A27).
4. **The undo is `git merge --abort` for a conflict and `git reset --merge <head before>` for a merge that finished but then fails the second contract check.** `reset --merge` and not `--hard`, because a clean merge can leave the person's unrelated uncommitted files in place and `--hard` would destroy them. The head before the merge is read first and compared at the end of every refusal test (A11).
5. **Conflicting files come from git, not from parsing its message.** After a failed merge, `git diff --name-only --diff-filter=U` lists the unmerged paths, read before the abort. A failure with no unmerged paths and no merge in progress (git refused to start, such as local changes a merge would overwrite) is refused with git's own message and the words "nothing was changed" (A9). Rejected: pre-refusing every dirty worktree, which would refuse acceptances that work today (a conversation's worktree often holds an unrelated untracked file).
6. **The refusal's wording** (A14, A19): `<plan>'s brief was not accepted: bringing <trunk> into <branch> conflicts in these files, and nothing was changed:` then one `  <path>` per line, then `Resolve them in <worktree> (or on <trunk>) and accept again.` It never says to run a merge. The admin shows a `PlanCommandRefusal`'s message as it shows any (the brief names no look change), so no admin code changes.
7. **The workbench path is not changed.** In a workbench the plan's documents live at the workbench root and no plan branch holds them, so there is no branch to bring main into at acceptance; its code branch is created when the build starts. Accepting there writes and commits the brief at the root exactly as before (A16, a regression guard). This settles the test plan's open decision on workbench plans: not merged at acceptance, recorded here so the person sees it. Moving a workbench plan's code branch up to main is landing's, which already merges main.
8. **A dirty plan worktree is git's call** (decision 5), settling the test plan's open decision: acceptance is refused with git's reason only when git itself refuses the merge.
9. **No OTel gate.** `.indusk/config.json` sets `otel.role: "library"`, and acceptance is a one-shot command with no `expect_every`; the brief's expectations are `None`. Each clause's signal is the refusal it prints plus the tests at close (the test plan says so); the live check records the first real run.
10. **No new library.** `git` is already the project's primitive (`lib/git.ts`); the merge, the abort and the unmerged-path listing are three git invocations through it, and no package wraps them better (checked: the repo's own `land.ts` does the same two calls).
11. **No ADR and no root Key Decisions line.** A bugfix carries brief + test plan + impl. The rule is area-specific, so it goes in `apps/indusk-mcp/CLAUDE.md` (the Context item of Build Phase 1), not the root.

## Scope

### In Scope

- `acceptBrief`: merge main first, re-check the contract, undo and refuse on a conflict naming the files.
- The wording of the refusal.
- The planner skill's description of `accept-brief`, and the docs and changelog that describe it.
- Tests for each clause, using real git in temporary repositories.

### Out of Scope

- Keeping a branch current after acceptance (landing merges main).
- Merging main into the ten drafted `fix-http-*` briefs now: each is merged when it is accepted.
- Any change to the admin's interface files or routes.
- Re-reading a brief whose code moved under it: the plan review, run last in the planning run, does that.
- The workbench plan's code branch (decision 7).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test of the three clauses and the two must-not-break promises, red where today's code fails them, green as guards where it passes | `acceptBrief`, `planBranch`, the plan-lifecycle fixture, the `ask-admin` seam |
| Build Phase 1 | `acceptBrief` merging main first, undoing and refusing on a conflict, re-checking the contract; the area rule in `apps/indusk-mcp/CLAUDE.md` | the tests from Test Phase 1, `git` in `lib/git.ts`, `PlanCommandRefusal` |
| Build Phase 2 | the planner skill's and the docs' description of the new order, the changelog entry, the recorded live check | the behaviour from Build Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan branched before main gained a commit touching an unrelated file holds that file's new content after accepting, and the brief reads accepted | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A2 | In the branch's history the merge of main comes before the commit marking the brief accepted; main's head is an ancestor of the accepting commit | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A3 | A branch that already holds main is accepted with no merge commit: the only new commit marks the brief accepted | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A4 | A branch both ahead of and behind main keeps every one of its own commits after the merge; none is rewritten or dropped | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A5 | The brief differs from before only by `status: accepted` and `accepted_at`, while main's commits to other plans' folders arrive in the branch | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A6 | A brief that passes before the merge but fails once main's registry is in is refused and the merge undone, the branch as it was | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A7 | Every caller that accepts a brief, the command-line verb and any other, reaches the one package function; a plan accepted either way ends with the same history | Test Phase 1 | Test Phase 1 | planned | contract | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts |
| A8 | Neither the admin's source nor the command-line verb runs `git merge` or names a branch operation for accepting; both call the package's accept | Test Phase 1 | Test Phase 1 | planned | contract | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts |
| A9 | When main and the branch changed the same lines of one file the acceptance is refused naming that path; a merge git refuses for another reason is refused with nothing changed and git's reason in the message | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A10 | Two files in conflict are both named, each on its own line; one conflict among several clean merges names only that file | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A11 | After the refusal the brief reads draft with no `accepted_at`, the tree is clean with no conflict markers, unmerged paths or merge in progress, and the branch's head is the commit it was at | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A12 | On the installed admin, with a branch left behind main on purpose, accepting a draft brief ends with the brief accepted, the planning run starting and the branch holding main's newest commit | Build Phase 2 | Build Phase 2 | skipped | live check | clause: a-brief-is-accepted-on-current-main/main-is-merged-first | manual: after landing run `pnpm install:local` and `indusk ui restart`; make a throwaway bugfix plan, commit to main after it was cut, accept its draft brief in the admin; note the planning run starting and `git merge-base --is-ancestor main <accept commit>`; record the result with the date in this impl's Notes |
| A13 | After a refusal, accepting again once the conflict is gone succeeds: the refusal left no state that blocks a second attempt | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A14 | The refusal says what the person must do and that nothing was changed, and a conflict reads as a refusal of the plan command (the kind the admin shows as any other), never a crash | Test Phase 1 | Build Phase 1 | planned | contract | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A15 | A conflict in `brief.md` itself (main and the branch both edited it) refuses the same way; the brief is not marked accepted | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A16 | In a workbench plan, accepting still writes the brief at the workbench root and commits it as before | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/a-conflict-refuses | apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts |
| A17 | A branch behind main with no conflict is accepted in one command that asks nothing: exit 0, no prompt, and the branch holds main's newest commit | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A18 | A brief that fails its contract check is refused with the check's own messages and the branch is not merged into first | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A19 | The conflict refusal asks for the conflict only: it names files to resolve and never tells the person to run a merge, rebase or update | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts |
| A20 | A session inside a build step is refused before anything is merged: the branch is untouched | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-brief-is-accepted-on-current-main/the-person-never-merges | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A21 | Accepting on a branch behind main still hands the plan to the planning run once, after acceptance, from the merged branch (the run's directory holds main's new file) | Test Phase 1 | Build Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts |
| A22 | A refused acceptance (conflict) starts no planning run | Test Phase 1 | Build Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts |
| A23 | The existing accept-brief tests (non-draft refused, failing contract refused with the check's messages, build-step refusal, the commit message `plan(<name>): brief accepted`) stay green unchanged | Test Phase 1 | Test Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/plans/accept-brief.test.ts |
| A24 | After an accepted and after a refused acceptance, main's head is the commit it was at; the merge ran in the plan's worktree | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A25 | Accepting from the main checkout still merges into and commits on the plan's branch, never on main | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-plan-is-written-on-its-own-branch | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A26 | A branch cut before an audit skill change landed on main holds the new skill file after accepting, so the planning run reads the new skill | Test Phase 1 | Build Phase 1 | planned | unit | a regression guard over the failure that started this plan (`decisions-as-questions` against `audit-concerns-are-answered`) | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |
| A27 | The merge commit's message names the plan and main: `plan(<name>): main merged before its brief was accepted` | Test Phase 1 | Build Phase 1 | planned | unit | a history that explains itself when read without opening it; no promise says so | apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts |

### Deferred Verification

- **A12, the live check**
  - reason: it needs the installed admin, a real `claude` and a real planning run; no everyday or system-tier test starts a planning run or the admin.
  - would require: a slow-tier test that installs the build, starts the admin in a temporary home and accepts a fixture plan's brief behind main.
  - mitigation: every rule is held from its inputs by the unit rows on real temporary git repositories, and the contract rows hold the admin to the one package function. The brief has no telemetry mark, so a regression found in use is reported by the person as a break of `a-brief-is-accepted-on-current-main`, not detected. Build Phase 2 runs the check once and records the date.

## Checklist

### Test Phase 1: Author every test, red where today fails it

**Tier**: med — the work step's default

This phase writes every test the plan commits to before `accept-brief` changes, so the build phase has a fixed target. Today accepting a brief never touches main, so the tests of merging first, of the refusal and of the planning run starting from the merged branch fail on their own assertions; the tests of what must stay true (no merge commit when none is needed, the contract refusal first, the build-step refusal, the workbench path, main left alone, the single path) pass from the start and are recorded as guards. Nothing here waits for a symbol that does not exist yet, so no test is deferred.

- [ ] Confirm this plan's own worktree and branch before any edit.
  <details><summary>Technical</summary>

  The worktree exists (`indusk plans start` made it): `git -C /Users/the_dusky/code/sandbox/dusk-worktrees/a-brief-is-accepted-on-current-main rev-parse --abbrev-ref HEAD` expects `plan/a-brief-is-accepted-on-current-main`, and `indusk worktree` records it for this plan; if not recorded, `indusk worktree assign a-brief-is-accepted-on-current-main /Users/the_dusky/code/sandbox/dusk-worktrees/a-brief-is-accepted-on-current-main`. Use absolute paths in every command. Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter.

  </details>
- [ ] Write the tests of merging main first and of the person never merging.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts` carries the header `// clause: a-brief-is-accepted-on-current-main/main-is-merged-first` and `// promise: a-plan-is-written-on-its-own-branch`. Build each case from `planLifecycleProject("accept-brief-main")` (real git, a temp home, no server): `p.makeWorktree(plan)`, then `p.commit(p.trunk, {...}, "main moves")` so main is ahead of the branch, a commit in the worktree so the branch is ahead too. A1, A2 (`git merge-base --is-ancestor main HEAD`; the merge commit's index in `git log --first-parent`), A3 (count `git rev-list --count <before>..HEAD` is 1), A4 (every pre-merge commit still in `git rev-list HEAD`), A5 (diff of `brief.md` before and after is only the two keys), A6 (main commits a registry change that makes the brief's `rests on` promise vanish; expect rejection and `git rev-parse HEAD` equal to before), A17 (`exit 0` through `acceptBrief`, the branch holds main's file), A18, A20, A24, A25 (call with `p.trunk` as `anyCheckout`), A26 (main adds `.claude/skills/audit/SKILL.md` text; the branch holds it), A27 (`git log -1 --merges --format=%s`). Row labels A1…A27 appear as test names `it("A1: …")`.

  </details>
- [ ] Write the tests of a conflict refusing and undoing itself.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts`, header `// clause: a-brief-is-accepted-on-current-main/a-conflict-refuses` and `// clause: a-brief-is-accepted-on-current-main/the-person-never-merges`. A9–A11, A13–A15, A19 with the same fixture: main and the worktree both edit the same line of `docs/notes.md` (and of `brief.md` for A15; a second file for A10). Expect `rejects.toBeInstanceOf(PlanCommandRefusal)` with the path(s) in the message; then `git status --porcelain` is `""`, `test ! -e <worktree .git>/MERGE_HEAD` (read `git rev-parse -q --verify MERGE_HEAD` exiting 1), `git rev-parse HEAD` unchanged and the brief still `status: draft` without `accepted_at`. A13: resolve by committing main's version on the branch, accept again, expect success. A19: message does not match `/\b(git merge|rebase|git pull)\b/`. A9's second half: leave a tracked file modified in the worktree that main also changes so git refuses to start; expect a refusal with `nothing was changed` and that file's name.

  </details>
- [ ] Write the tests that the verb starts the planning run from the merged branch only when the brief is accepted.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts`, `// promise: an-accepted-brief-is-planned-unasked`. Drive `plansAcceptBrief` (in `bin/commands/plans.ts`) with the seam `ask-admin.test.ts` already uses for the admin's answer, so no server starts. A21: after acceptance the recorded ask carries the plan's worktree path and that path holds main's new file; the ask is made once. A22: a conflicting acceptance makes no ask and the verb exits through its refusal path (non-zero). Look at `ask-admin.test.ts` first and reuse its stub rather than adding a second one.

  </details>
- [ ] Write the tests that accepting has one code path, and that the workbench path is unchanged.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts` (A7, A8; headers `// clause: …/main-is-merged-first`): read the source of `bin/commands/plans.ts` and every file under `apps/indusk-admin/src` and assert that none contains `"merge"` as a git argument or writes `status: accepted` into a brief, and that `plansAcceptBrief` calls `acceptBrief` (follow `cockpit-single-definition.test.ts` for how that suite reads sources). `accept-brief-workbench.test.ts` (A16): a workbench fixture as `workbench-plan` tests build one; accepting writes `brief.md` at the workbench root and commits `plan(<name>): brief accepted` there, with no merge attempted. A23 is the existing `accept-brief.test.ts`, left unedited.

  </details>
- [ ] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every new test imports only symbols that exist today (`acceptBrief`, `PlanCommandRefusal`, `plansAcceptBrief`, the fixtures). Run each new file once: `pnpm exec vitest run <the new files>`; the red ones must fail on an assertion (a missing merged file, a missing refusal), never on an import or a fixture error.

  </details>

#### Regression Guards

- **A3** — a branch already holding main needs no merge; today nothing merges, so this passes at once and must keep passing once the merge exists.
- **A7** — the one-path contract holds today (nothing but the verb accepts) and guards against a second path being added.
- **A8** — neither the admin nor the verb runs a merge today; guards against one being added there.
- **A16** — the workbench acceptance is unchanged by this plan.
- **A18** — a failing contract is already refused before anything is written; the build must keep the check ahead of the merge.
- **A20** — the build-step refusal already comes first; the build must keep it ahead of the merge.
- **A23** — the existing accept-brief tests pass unchanged today and after.
- **A24** — main is never written to today; the merge must run in the plan's worktree.
- **A25** — accepting from the main checkout already commits on the plan's branch; the merge must not move that.

#### Test Phase 1 Verification

- [ ] Every test of new behaviour exists and fails today on its own assertion, never on a missing import.
  <details><summary>Technical</summary>

  Red on an assertion: A1, A2, A4, A5, A6, A9, A10, A11, A13, A14, A15, A17, A19, A21, A22, A26, A27. Run `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts` and read each failure's message.

  </details>
- [ ] Every guard passes today, and no guard is a copy of a red test.
  <details><summary>Technical</summary>

  A3, A7, A8, A16, A18, A20, A23, A24, A25 pass: `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts apps/indusk-mcp/src/lib/plans/accept-brief.test.ts` plus the guard cases of `accept-brief-main.test.ts`. A12 is the plan's one live check, run in Build Phase 2.

  </details>

#### Test Phase 1 Context

- [ ] Record in this impl's Notes which rows are red and which are guards, so the build phase reads its target.
  <details><summary>Technical</summary>

  Add a `Test Phase 1 result` line to `## Notes` listing the red IDs and the guard IDs actually observed, and any row that behaved otherwise than the Technical fold of the Verification above says.

  </details>

#### Test Phase 1 Document

- [ ] Write the live check's recipe into this impl's Notes.
  <details><summary>Technical</summary>

  The recipe in A12's `Test` cell is copied to `## Notes` with an empty `Result:` line for Build Phase 2 to fill, so the person finds it in one place.

  </details>

### Build Phase 1: Merge main first, refuse a conflict

**Tier**: med — the work step's default

This phase changes the one function that accepts a brief. After it, accepting a plan's draft brief runs the contract check, brings main into the plan's branch, runs the check again on the merged branch, and only then writes and commits the acceptance; a conflict is undone and refused with each conflicting file named. It hands Build Phase 2 a behaviour to describe in the skill and the docs, and turns every red test from Test Phase 1 green.

- [ ] Make accepting a brief bring main into the plan's branch before the brief is marked accepted.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/plans/accept-brief.ts`, in the non-workbench path after `refuseFailingContract(pb.worktree, plan)`:

  ```typescript
  const before = await headSha(pb.worktree);
  await bringTrunkIn(pb, `plan(${plan}): main merged before its brief was accepted`);
  const merged = readDraftBrief(pb.dir, plan);
  try {
  	refuseFailingContract(pb.worktree, plan);
  } catch (err) {
  	await git(pb.worktree, "reset", "--merge", before);
  	throw err;
  }
  // setImplKeys sets frontmatter keys in any plan document and commits that file alone.
  await setImplKeys(pb, merged.path, acceptedKeys(), message);
  ```

  `headSha` and `git` come from `../git.js`. The workbench branch above it is not touched (decision 7).

  </details>
- [ ] Write the step that merges and, on a conflict, undoes the merge and refuses naming each file.
  <details><summary>Technical</summary>

  A function in the same file (it has one caller; the rule of three is not met, so no new module):

  ```typescript
  async function bringTrunkIn(pb: PlanBranch, message: string): Promise<void> {
  	try {
  		await git(pb.worktree, "merge", "--no-edit", "-m", message, pb.trunkBranch);
  	} catch (err) {
  		const files = (await git(pb.worktree, "diff", "--name-only", "--diff-filter=U")).split("\n").filter(Boolean);
  		await git(pb.worktree, "merge", "--abort").catch(() => undefined);
  		throw new PlanCommandRefusal(conflictMessage(pb, files, err));
  	}
  }
  ```

  `conflictMessage` follows decision 6: with `files` non-empty it lists each path on its own line after "nothing was changed" and ends "Resolve them in <worktree> (or on <trunk>) and accept again."; with none it quotes git's own message (`(err as Error).message.trim()`) and still says "nothing was changed". Import `PlanBranch` as a type from `./plan-branch.js`.

  </details>
- [ ] Keep the existing refusals and commit message exactly as they are.
  <details><summary>Technical</summary>

  `refuseInsideBuildStep` stays first, `readDraftBrief` and the first contract check stay before the merge, and the acceptance commit message stays `plan(<name>): brief accepted` (A18, A20, A23).

  </details>

#### Build Phase 1 Verification

- [ ] Merging main first, the refusal and the planning run's start all behave as the tests say.
  <details><summary>Technical</summary>

  A1, A2, A4, A5, A6, A9, A10, A11, A13, A14, A15, A17, A19, A21, A22, A26, A27 go green: `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts && pnpm exec vitest related apps/indusk-mcp/src/lib/plans/accept-brief.ts` — the whole suite runs at landing, not here.

  </details>
- [ ] Every guard still passes.
  <details><summary>Technical</summary>

  A3, A7, A8, A16, A18, A20, A23, A24, A25 stay green in the same run; then `pnpm check` (Biome) and `pnpm exec tsc --noEmit -p apps/indusk-mcp` pass on the changed files.

  </details>

#### Build Phase 1 Context

- [ ] Record the rule in the package's area context file.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, tier: directory (it is loaded when a file there is read), near the existing plans-lifecycle rules: "Accepting a brief brings the trunk into the plan's branch first (`plans/accept-brief`): a conflict is aborted and refused naming the files, the person is never asked to merge. No other code merges at acceptance." Not the root: it is an area rule, and a test (A8) enforces the single path, so the failure message there is the delivery. Add `lesson:` token only if a lesson exists for it; none is created here.

  </details>

#### Build Phase 1 Document

- [ ] Update the command's reference page for the new order and the refusal.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, the `accept-brief` section: the order (contract check, bring main in, check again, accept), the conflict refusal and its wording, that nothing is changed on refusal, and that the person never merges by hand.

  </details>

### Build Phase 2: Say it in the skill and the docs, and run the live check

**Tier**: med — the work step's default

This phase makes what people read match what the command now does, and runs the plan's one live check on the installed build. It follows Build Phase 1 because the words describe behaviour that must already exist.

- [ ] Make the planner skill say that accepting brings main in first and that a conflict is the only thing asked of the person.
  <details><summary>Technical</summary>

  Edit `apps/indusk-mcp/skills/planner.md` (never `.claude/skills/` directly), in step 4 where `indusk plans accept-brief` is described: add that it first merges main into the plan's branch, refuses a conflict naming the files with nothing changed, and that "read what `accept-brief` prints" now includes a conflict to resolve before accepting again. Keep the skill's existing length conventions; then `indusk update` syncs `.claude/skills/`.

  </details>
- [ ] Add the changelog entry and update the briefs guide.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`: "**A brief is accepted on current main** (a-brief-is-accepted-on-current-main): `indusk plans accept-brief` brings main into the plan's branch first, so the plan is written against current code; a conflict is undone and refused, naming the files." `apps/docs/src/guide/briefs.md` near line 147: the accepting paragraph gains one sentence on the same.

  </details>
- [ ] Run the live check on the installed admin and record the result.
  <details><summary>Technical</summary>

  After landing's `pnpm install:local` and `indusk ui restart`, follow A12's recipe from this impl's Notes; fill the `Result:` line with the date, the plan used and what was observed. If the planning run does not start or main is not an ancestor, that is a break to fix, not a note.

  </details>

#### Build Phase 2 Verification

- [ ] The skill and the docs describe the new order, and the live check ran.
  <details><summary>Technical</summary>

  `grep -n "main" apps/indusk-mcp/skills/planner.md` shows the accept-brief paragraph; `pnpm exec vitest run apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts` still passes; A12's row is updated from `skipped` to `passing` with its `Result:` in Notes, or stays `skipped` with the reason it could not run recorded for the person.

  </details>

#### Build Phase 2 Context

- [ ] Record that the skill's source is the package's file and the docs name the new order.
  <details><summary>Technical</summary>

  Tier: planning (the planner skill is the planning rules' delivery). Nothing new in root `CLAUDE.md`; the only line to check is that no existing text there says `accept-brief` only sets a status.

  </details>

#### Build Phase 2 Document

- [ ] Publish the plan's page contribution at close.
  <details><summary>Technical</summary>

  The retrospective (or the plan's skip of it, with `indusk promises confirm a-brief-is-accepted-on-current-main`) carries the docs handoff; no decision page is published (no ADR). Confirm `apps/docs/src/reference/cli/plans.md` and the changelog entry from the earlier items are in the diff.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/accept-brief.ts` | merge main first, re-check the contract, undo and refuse a conflict naming the files |
| `apps/indusk-mcp/src/lib/plans/accept-brief-main.test.ts` | new: merge-first, order, no-merge-needed, history kept, main untouched |
| `apps/indusk-mcp/src/lib/plans/accept-brief-conflict.test.ts` | new: refusal, naming, clean undo, second attempt, wording |
| `apps/indusk-mcp/src/lib/plans/accept-brief-verb.test.ts` | new: the planning run starts from the merged branch, and not after a refusal |
| `apps/indusk-mcp/src/lib/plans/accept-brief-single-path.test.ts` | new: one code path, no merge in the admin or the verb |
| `apps/indusk-mcp/src/lib/plans/accept-brief-workbench.test.ts` | new: the workbench acceptance is unchanged |
| `apps/indusk-mcp/CLAUDE.md` | the area rule |
| `apps/indusk-mcp/skills/planner.md` | describe the new order of `accept-brief` |
| `apps/docs/src/reference/cli/plans.md`, `apps/docs/src/guide/briefs.md`, `apps/docs/src/changelog.md` | describe it |

## Dependencies

- Nothing must exist first. `accept-brief` and its fixtures exist (`a-brief-is-planned-unasked`); the registry already holds this plan's three clauses and the two promises it must not break.

## Notes

- A `blocker:` line: none.
- Open decisions, all settled above with reasons: the workbench path (decision 7), a dirty worktree (decisions 5 and 8), the order of the check and the merge (decision 2).
- Test Phase 1 result: (written by the Test Phase 1 Context item)
- A12 recipe and `Result:` (written by Test Phase 1 Document and Build Phase 2).
