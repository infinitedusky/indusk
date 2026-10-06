---
title: "Workbench plan authoring — research"
date: 2026-10-06
status: in-progress
---

# Workbench plan authoring — Research

## Background

admin-plan-authoring (1.63.0) lets the admin start, approve, build, review,
accept and land a plan. Every step assumes a **normal-mode** project, where
plan documents and code share one git repo and a plan lives on
`plan/<name>` in a worktree assigned to it. Of Sandy's 16 registered
projects, eight are **workbenches**: concierge, numero, avoca-next, looper,
career, writing, ursa and wt-scratch. In one, New plan refused at once:
"plan worktree assignments are for normal-mode projects: in a workbench,
plan documents live at the workbench root, never in a code worktree". The
plan never mentioned workbenches (Sandy, 2026-10-06: "we have to make this
work for workbenches").

## What the code does today

File and line references are to `apps/indusk-mcp/src` unless noted.

### A workbench

- `isWorkbench` (`lib/worktree/repos.ts:95`) is true for `shape:
  "workbench"` or any declared `worktree.repos[]`. Two other places detect a
  workbench by `shape` alone and miss a `repos[]` config without it: the
  bash helpers and the sync hook.
- Three layouts are supported, and the fixture `LAYOUTS`
  (`__tests__/helpers/versioned-workbench.ts:166`) covers all of them:
  - nested: repos inside the workbench;
  - sibling: repos beside it;
  - flat: a legacy `wrapped_repo` with a symlink.
- The workbench root is its own git repo. `indusk workbench sync`
  (`lib/worktree/sync.ts:89`) runs `git add -A`, commits, pulls `-X theirs`
  and pushes **whatever branch is checked out**. A PostToolUse hook runs it
  20 s after any Edit or Write. Plan documents are already committed this
  way, on the root's branch.

### Where a plan lives

- `resolvePlanCopies` (`lib/worktree/plan-worktrees.ts:236`) treats a
  workbench as having no assignments: every plan is read from the root.
  The plan-worktree record is inert there by design
  (`plan-worktree-record.ts:37`).
- `indusk worktree create [repo] <slug>` in a workbench runs the worktree
  extension's `setup-worktree.sh`. It makes a code worktree on a branch
  named by the slug alone, not `plan/<slug>`. **It records nothing** that
  links the plan to its code worktree. admin-plan-worktrees' retrospective
  (:131) named this link as its natural follow-on.

### What refuses, and where

- `plans start` refuses outright: `createPlanWorktree` →
  `writableRepository` (`plan-worktree-commands.ts:28`).
- `approve`, `accept` and `land` refuse in `planBranch`
  (`lib/plans/plan-branch.ts:57`) with "is not on its own branch: it has no
  worktree assigned".
- The admin's plan page renders for a workbench, but shows no actions:
  - Approve, Continue planning and Build all require `plan.worktree`
    (`apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:84-112`).
  - New plan is always shown, and then refuses.
- The build's reader (`readBuildPlan`) works from the root. The review lists
  no files, because the copy is not a worktree. A build session's writes are
  confined to one directory (`decideBuildPermission`), so in a sibling
  layout the code repo falls outside it.

### Two roots, already solved once

- `resolveExecutionRoots` (`lib/worktree/roots.ts:39`) returns
  `{planRoot, codeRoot, split}`:
  - one repo: the root and that repo;
  - no repos, or more than one: it refuses.
- `indusk run`, `verify`, `cleanup` and promises all use it. Nothing in
  `lib/plans`, `lib/build`, `lib/session` or the admin does.
- No test of `plans-*`, the build, sessions or the admin uses a workbench
  fixture.

## Questions for the brief

1. **Where are a workbench plan's documents written before approval?**
   - A `plan/<name>` branch at the root would be committed and pushed by
     sync like any branch.
   - The root's main branch is where sync already commits them, and where
     the admin reads them.
   - So "a plan is written on its own branch" may mean something different
     in a workbench: the documents on the root's main, the code on the
     plan's branch in the code repo.
2. **Which repo holds the code**, when a workbench declares more than one?
   `resolveExecutionRoots` refuses that today. Does the plan name its repo,
   say in its brief or impl, or is it asked once at New plan?
3. **How is a plan linked to its code worktree?** Nothing records it today.
   The admin needs it to read the build's state and the review's files.
4. **What does approve do** when there is nothing to merge: check the brief
   and mark the impl approved?
5. **Build sessions need two roots**: they write the code in the code
   worktree and check items off at the workbench root. The permission
   boundary has to allow both.
6. **Landing**:
   - merge the code repo's branch into its trunk;
   - archive the plan at the root, where sync commits it;
   - release the code worktree.
7. **Sync and the plan commands both write to the root.** Bookkeeping commits
   and the trunk check would race an auto-committer on the same tree.

## Design note: one contract, kept with the code

*From the conversation with Sandy, 2026-10-06.*

**What a workbench is for.** It takes the context out of the project. Plans,
lessons, skills, sessions and the agent's setup all live beside the repo
instead of inside it. "We're building the agents who work on a repo, not the
repo itself."

**The problem.** InDusk is meant to be integrated: telemetry links back to
promises, and promises back to plans. Today a workbench holds the promise
registry. The code already carries the promise names, in `promise:` tokens
and in the marks it sends in production. Two workbenches on one repo could
each define the same name differently. Then one application's telemetry
would be read against two contracts, and the premise breaks.

**The rule.** Promises belong with the code; the work belongs in the
workbench.
- **Promises in the repo.** `.indusk/promises/` is the application's
  contract. One repo has one contract, however many workbenches work on it.
  The registry, the tests and the telemetry share one history.
- **The work in the workbench.** Plans, sessions, lessons and agent setup
  live there. A plan names the promises it makes or changes.
- **A shadow contract until the repo accepts it.** A repo that has not
  adopted InDusk (a client's, typically) cannot hold the folder yet. Until
  it does, its contract lives in the workbench. It is versioned there, since
  the workbench root is a git repo ("You are versioning them so it is
  okay"), and it is watched against the application's telemetry like any
  other. The tokens in the code are harmless comments meanwhile.

**How a client comes to adopt it.**
1. You work from a workbench, under a shadow contract.
2. An incident caught, or a review's evidence, makes the case.
3. A pull request moves the contract into their repo: the folder, a CI
   check, and one paragraph of explanation. It is small, and already true.
4. Once adopted, the workbench reads the contract from the repo, and every
   workbench on that repo shares it.

**What this changes for this plan.**
- A workbench plan reads and writes promises in **the repo's contract when
  the repo holds one, and the workbench's shadow contract when it does not**,
  through one resolver.
- Moving a shadow contract into the repo (a command that writes the folder
  and opens the pull request) is its own plan.
