---
title: "A finished ritual stays done"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "f06ef0692572c8e57b9e477c6f4201d6ed46e539cd9d0cae7c07c98aac7d2197"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T18:58:02.293Z"
---

# A finished ritual stays done

## Goal

On a plan's page, Falsify, Cleanup and Audit read done once each ritual is finished, and keep reading done when a later build phase (an audit follow-up, say) sends the plan back to building. Today `releaseStep` in `apps/indusk-mcp/src/lib/plans/steps.ts` reads each of the three only from the plan's single lifecycle position; a plan reopened to `executing` puts all three after it, so they read "not yet". See [brief.md](brief.md).

## Scope

### In Scope
- A ritual counts as finished from its own files: a closed `### Phase N: Falsification …` / `Cleanup …` phase (or a legacy falsification log), and `audit.md` for the audit. The admin's plan reader gathers it and hands it to the package's step list.
- `releaseStep` reads a finished ritual as done unless it was skipped (a skip keeps its reason).

### Out of Scope
- Review and Release steps; a ritual re-run after the plan reopened (it reads current while open).
- Any change to how a step is drawn.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the tests, failing where a reopened plan reads its rituals as not yet | `steps.ts`, `planning-reader.ts`, `cleanup/gate.ts` as they stand |
| Build Phase 1 | `PlanSnapshot.finishedRituals`; the reader computing it; `releaseStep` reading it | the tests of Test Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan whose falsification and cleanup phases are closed and whose audit is written, with a later build phase open, shows Falsify, Cleanup and Audit done and Build current | Test Phase 1 | Build Phase 1 | written | unit | promise: a-finished-ritual-stays-done | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A2 | The same plan read from its files on disk shows Falsify, Cleanup and Audit done and Build current | Test Phase 1 | Build Phase 1 | written | unit | promise: a-finished-ritual-stays-done | apps/indusk-admin/src/lib/planning-reader.rituals.test.ts |
| A3 | A plan with only its falsification closed and a build phase open shows Falsify done, and Cleanup and Audit not yet | Test Phase 1 | Build Phase 1 | written | unit | promise: a-finished-ritual-stays-done | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A4 | A plan midway through its falsification shows Falsify current, and Cleanup and Audit not yet | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over a-plan-shows-two-workflows: a ritual being worked still reads current | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A5 | A ritual skipped with a reason still reads skipped, with its reason, not done | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over a-skipped-step-shows-why-on-request | apps/indusk-mcp/src/lib/plans/steps.test.ts |

## Checklist

### Test Phase 1: Write the step tests first, failing where a reopened plan loses its rituals

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before any code changes, this phase writes the tests for what a plan's step list says once a later build phase has reopened the plan. They feed the step list a plan whose rituals are finished and whose build is open again, once from facts handed in and once read from a plan folder on disk, and check which steps read done. The ones about finished rituals fail today, because a step is read only from where the plan stands. Two pass from the start and guard what must not change: a ritual being worked still reads current, and a ritual skipped with a reason still reads skipped. The next phase makes the finished rituals count.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `plans start` made `/Users/the_dusky/code/sandbox/dusk-worktrees/finished-rituals-stay-done` and assigned it; confirm with `indusk worktree list` — worktree-per-plan default.

  </details>
- [x] Write the package tests that a reopened plan shows its finished rituals as done and its being-worked ritual as current, failing today where they should.
  <details><summary>Technical</summary>

  Add to `apps/indusk-mcp/src/lib/plans/steps.test.ts` (it already opens with `// promise: a-plan-shows-two-workflows`; add `// promise: a-finished-ritual-stays-done`), using the real `derivePlanPosition` as the file does. A1: a snapshot with position `executing`, `finishedRituals: ["falsification","cleanup","audit"]` → `planSteps(...).release` has Falsify, Cleanup, Audit `done`, Build `current`. A3: same with `["falsification"]` only → Falsify `done`, Cleanup and Audit `not-yet`. A4: position `falsify` (active), no finished → Falsify `current`, Cleanup and Audit `not-yet` (green today). A5: `skippedRituals: [{ritual:"cleanup",reason:"…"}]` → Cleanup `skipped` with that reason (green today). Red today on A1, A3: no `finishedRituals`, and the steps read `not-yet`.

  </details>
- [x] Write the admin test that the same plan read from its folder shows the rituals done, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/lib/planning-reader.rituals.test.ts` (opening `// promise: a-finished-ritual-stays-done`): build a plan folder in a temp project — `impl.md` with a closed `### Build Phase 4: Falsification — x` and `### Build Phase 5: Cleanup — y` (each with checked items), an open `### Build Phase 6: Audit follow-ups`, and `audit.md`; read it with the same reader the page uses and pass `snapshotOf(plan)` to `planSteps`. A2: Falsify, Cleanup, Audit `done`, Build `current`. Red today: they read `not-yet`. Use the harness the sibling `planning-reader` tests use.

  </details>
- [x] Confirm no new test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every import (`planSteps`, `derivePlanPosition`, the reader, `snapshotOf`) exists today; the reds fail on a step's state, an assertion.

  </details>

#### Regression Guards

- **A4** — a ritual being worked reads current today; the row holds that once finished rituals are read from files.
- **A5** — a skipped ritual reads skipped, with its reason, today; the row holds that a finished-ritual rule never turns it into done.

#### Test Phase 1 Verification

- [x] The new tests exist, the ones about finished rituals fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/lib/plans/steps.test.ts` — A1, A3 red, A4, A5 green; `cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.rituals.test.ts` — A2 red.

  </details>

### Build Phase 1: A finished ritual reads done whatever the plan is doing now

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase teaches the step list that a ritual can be finished independently of where the plan stands. The admin's plan reader decides, from the plan's own files, which of the three close-out rituals are finished: falsification and cleanup by a closed ritual phase in the impl, the audit by its written report. It hands that list to the package's step list, which now reads a finished ritual as done unless the plan skipped it with a reason. A ritual that is open, or not started, reads as before. Nothing about how a step is drawn changes.

- [ ] The step list accepts the list of finished rituals and reads each as done unless it was skipped.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`: `PlanSnapshot.finishedRituals?: ReadonlyArray<SkippedRitual>` ("Falsification, cleanup or audit finished: its phase closed or its report written"); in `releaseStep`, after the skip check, `if (ritual && plan.finishedRituals?.includes(ritual)) return named("done")`. A step whose segment is active still reads current only when its ritual is not finished.

  </details>
- [ ] The admin reads which rituals are finished from the plan's files and passes them to the step list.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/planning-reader.ts` (beside `skippedRitualsOf` at ~L373): `finishedRituals` from `isFalsificationPhaseTerminal(implRaw) || isFalsificationComplete(planRoot)`, `isCleanupPhaseTerminal(implRaw)`, `isAuditComplete(planRoot)` (all in `cleanup/gate.ts`, `falsification/log.ts`); add the field to `Plan`; `plan-snapshot.ts` `snapshotOf` passes `finishedRituals: plan.finishedRituals`. Reuse those helpers; do not re-parse the impl.

  </details>
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules.

#### Build Phase 1 Verification

- [ ] The step tests now pass: a reopened plan shows its finished rituals as done, a ritual being worked as current, and a skipped one as skipped.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/plans/steps.test.ts && pnpm exec vitest related src/lib/plans/steps.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.rituals.test.ts && pnpm exec vitest related src/lib/planning-reader.ts src/lib/plan-snapshot.ts` — A1–A5 green; `workflows.test.tsx`, `plan-stage.test.ts` and `PlanList.test.tsx` among the related, green.

  </details>

#### Build Phase 1 Context

- [ ] The package's context file records that a ritual's step is read from the ritual's own files.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, in "Run, verify, Shape, cleanup": "A release step for a ritual (Falsify, Cleanup, Audit) reads done from the ritual's own files (a closed phase, `audit.md`), never from where the plan stands now — a build phase reopened after an audit would hide it. Guarded by `steps.test.ts` — `promise: a-finished-ritual-stays-done`."

  </details>

#### Build Phase 1 Document

- [ ] The changelog records the change.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` (Unreleased, Fixed): "A plan's page keeps Falsify, Cleanup and Audit done once each is finished, even when an audit follow-up reopens the build."

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/steps.ts` | `finishedRituals` on the snapshot; `releaseStep` reads it |
| `apps/indusk-mcp/src/lib/plans/steps.test.ts` | A1, A3, A4, A5 |
| `apps/indusk-admin/src/lib/planning-reader.ts`, `plan-snapshot.ts` | compute and pass `finishedRituals` |
| `apps/indusk-admin/src/lib/planning-reader.rituals.test.ts` | new: A2 |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/changelog.md` | rule and changelog |

## Dependencies

- None.

## Notes

- Seen on `plans-are-promises`: falsification (Build Phase 4), cleanup (Build Phase 5) and the audit were finished, then Build Phase 6 (audit follow-ups) reopened the build; the plan page's Release list read Falsify, Cleanup and Audit as not yet.
