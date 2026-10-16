---
title: "A nav row reads at a glance — Retrospective"
plan: nav-row-legible
date: 2026-10-16
---

# A nav row reads at a glance — Retrospective

## What We Set Out to Do

Keep a plan's row in the admin nav to two lines. The worktree stopped being a tag with its name crowded into the stage, inside the row's one link, and became a small ⎇ mark beside the stage that widens in place to the worktree's name on hover or click, without opening the plan.

## What Actually Happened

- Test Phase 1 wrote the browser tests (A1–A7) and guarded the served sidebar (A8). Build Phase 1 built `WorktreeMark` and gave `PlanRow` a `worktree` slot that draws the row as a container with its title's link stretched over it. Build Phase 2 wrote the stories.
- Falsification found three things the stretched link took from the row: the full-name tooltip on a truncated title, the whole-row keyboard focus ring, and a `worktree={null}` slot that still switched the row to the container form. Build Phase 3 fixed all three, each test red first.
- Cleanup was skipped with a reason: the changed files are small and cohesive.
- The audit (a cold reader) objected to the cleanup skip and to the Build Phase 3 document skip, and noted rows A1/A3/A6 prove less than their promise (no long-name check on the stage, collapsed nav drawn at desktop width, no numbered row with a worktree).
- Diff against trunk: 23 files, +966/−67.

## Getting to Done

- The first read of the plan was from `main`, where it showed nothing built; the worktree already held Test Phase 1 and Build Phase 1. Reading a plan from the checkout that is not its worktree gives a stale picture.
- Trajectory rows A1–A8 stayed `written` after their tests passed, and only surfaced when `plans next-session` refused. Nothing moves a row to `passing` by itself.
- `promises confirm` refused until the production code, not only the tests, carried the promise's token.
- The plan page does not show stories for approval; `plan-page-shows-its-looks` (approved, built in another session) is what changes that. This plan's story approvals were done on the Looks page.

## What We Learned

- A control inside a row whose click area is a link needs the link stretched over the row by an overlay; everything the pointer or keyboard meets then moves to the link (title, focus ring) and has to be re-asserted there.
- The story-render check needs `INDUSK_ADMIN_SYSTEM_TIER=1` with the default config; the command the plan carried (`--config vitest.system.config.ts --project storybook`) matches no project.

## What We'd Do Differently

- Write the tooltip, focus and empty-slot checks in Test Phase 1: they follow directly from choosing an overlay, and a falsification phase should not be where that consequence is first tested.
- Update trajectory states when a phase closes, not when the retrospective refuses.

## Insights Worth Carrying Forward

- The nav's worktree is a mark outside the link; guarded by `PlanList.worktree.test.tsx` and `PlanRow.worktree.test.tsx`.

## Audits

- **Shape:** the step was done as a read of the changed files each phase, not through `prepareShapeReview`; it raised nothing and a human judged nothing wrong (0 findings, 0 wrong).
- **Quality:** no Biome rule added. `pnpm check` reports errors in files this plan did not touch (`SessionPanel.tsx`, `project-reader.ts` and others).
- **Tests:** 9 tests in `PlanList.worktree.test.tsx`, 2 in `PlanRow.worktree.test.tsx`; the served-sidebar guard passes. Five other tests in `http-plan-worktrees.test.ts` fail on phase/item fields unrelated to this plan; not checked against `main`.
- **Docs:** `overview.md`, `component-conventions.md` (twenty components) and the changelog updated. No ADR, so no decisions page.
- **Release:** nothing published; this build is installed from the checkout (`pnpm install:local`).

Landed on main at cb831dbcf, 2026-10-16.
