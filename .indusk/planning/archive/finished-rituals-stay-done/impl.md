---
title: "A finished ritual stays done"
date: 2026-10-16
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
falsification: skipped
falsification_reason: "Probed open phases, skips, legacy logs, out-of-order and all snapshot callers; A6–A9 pin them, none broke."
approved_brief: "6d82f23dfc43d1c35c296084982f6f433c4e96095a952aef7d9f74f176767a72"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T21:20:58.764Z"
accepted: 2026-10-16T21:21:15.869Z
accepted_by: person
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
| A1 | A plan whose falsification and cleanup phases are closed and whose audit is written, with a later build phase open, shows Falsify, Cleanup and Audit done and Build current | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A2 | The same plan read from its files on disk shows Falsify, Cleanup and Audit done and Build current | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-admin/src/lib/planning-reader.rituals.test.ts |
| A3 | A plan with only its falsification closed and a build phase open shows Falsify done, and Cleanup and Audit not yet | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A4 | A plan midway through its falsification shows Falsify current, and Cleanup and Audit not yet | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over a-plan-shows-two-workflows: a ritual being worked still reads current | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A5 | A ritual skipped with a reason still reads skipped, with its reason, not done | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over a-skipped-step-shows-why-on-request | apps/indusk-mcp/src/lib/plans/steps.test.ts |
| A6 | A plan whose falsification is a completed legacy log (no closed phase) and whose build is reopened shows Falsify done | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-admin/src/lib/planning-reader.rituals.test.ts |
| A7 | A plan whose Cleanup phase still has an unchecked item shows Cleanup not done | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-admin/src/lib/planning-reader.rituals.test.ts |
| A8 | A plan with `cleanup: skipped` and a closed Cleanup phase shows Cleanup skipped, with its reason | Build Phase 2 | Build Phase 2 | passing | unit | a regression guard over a-skipped-step-shows-why-on-request | apps/indusk-admin/src/lib/planning-reader.rituals.test.ts |
| A9 | The nav mark of the reopened plan (finished rituals, open build phase) says Build | Build Phase 2 | Build Phase 2 | passing | unit | promise: the-nav-says-where-a-plan-is | apps/indusk-admin/src/lib/plan-stage.test.ts |
| A10 | The package answers which rituals a plan has finished from its folder and impl text, and the retrospective gate agrees with it for falsification, cleanup and audit | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-finished-ritual-stays-done | apps/indusk-mcp/src/__tests__/cleanup-gate.test.ts |

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

- [x] The step list accepts the list of finished rituals and reads each as done unless it was skipped.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`: `PlanSnapshot.finishedRituals?: ReadonlyArray<SkippedRitual>` ("Falsification, cleanup or audit finished: its phase closed or its report written"); in `releaseStep`, after the skip check, `if (ritual && plan.finishedRituals?.includes(ritual)) return named("done")`. A step whose segment is active still reads current only when its ritual is not finished.

  </details>
- [x] The admin reads which rituals are finished from the plan's files and passes them to the step list.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/planning-reader.ts` (beside `skippedRitualsOf` at ~L373): `finishedRituals` from `isFalsificationPhaseTerminal(implRaw) || isFalsificationComplete(planRoot)`, `isCleanupPhaseTerminal(implRaw)`, `isAuditComplete(planRoot)` (all in `cleanup/gate.ts`, `falsification/log.ts`); add the field to `Plan`; `plan-snapshot.ts` `snapshotOf` passes `finishedRituals: plan.finishedRituals`. Reuse those helpers; do not re-parse the impl.

  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] The step tests now pass: a reopened plan shows its finished rituals as done, a ritual being worked as current, and a skipped one as skipped.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/plans/steps.test.ts && pnpm exec vitest related src/lib/plans/steps.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.rituals.test.ts && pnpm exec vitest related src/lib/planning-reader.ts src/lib/plan-snapshot.ts` — A1–A5 green; `workflows.test.tsx`, `plan-stage.test.ts` and `PlanList.test.tsx` among the related, green.

  </details>

#### Build Phase 1 Context

- [x] The package's context file records that a ritual's step is read from the ritual's own files.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, in "Run, verify, Shape, cleanup": "A release step for a ritual (Falsify, Cleanup, Audit) reads done from the ritual's own files (a closed phase, `audit.md`), never from where the plan stands now — a build phase reopened after an audit would hide it. Guarded by `steps.test.ts` — `promise: a-finished-ritual-stays-done`."

  </details>

#### Build Phase 1 Document

- [x] The changelog records the change.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` (Unreleased, Fixed): "A plan's page keeps Falsify, Cleanup and Audit done once each is finished, even when an audit follow-up reopens the build."

  </details>

### Build Phase 2: Audit follow-ups — the reopened plan's other cases

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

The audit of this plan found that the tests only proved a reopened plan for one shape: closed phases plus an audit report. This phase adds the cases it named: a falsification recorded in the older log format, a ritual phase that still has an open item, a ritual skipped with a reason but also finished, and the plan's mark in the navigation. The code already behaves this way, so the tests are expected to pass when written; they exist to keep it so.

- [x] A plan whose falsification is in the older log format reads Falsify done after the build reopens.
  <details><summary>Technical</summary>

  A6 in `apps/indusk-admin/src/lib/planning-reader.rituals.test.ts`: write `falsification.md` ending in a terminator entry (use `appendHypothesis`/`markTerminated` from `@infinitedusky/indusk-mcp/falsification/log` if exported, else the file shape in `lib/falsification/log.ts`), no Falsification phase in the impl.

  </details>
- [x] A ritual phase with an unchecked item reads not done.
  <details><summary>Technical</summary>

  A7: same folder as A2 but `### Build Phase 5: Cleanup — extract` has one `- [x]`; Cleanup is not `done`.

  </details>
- [x] A ritual both skipped with a reason and finished reads skipped, with its reason.
  <details><summary>Technical</summary>

  A8: A2's folder plus `cleanup: skipped` / `cleanup_reason: "…"` in the impl frontmatter; Cleanup is `skipped` with that reason.

  </details>
- [x] The navigation mark of a reopened plan says Build.
  <details><summary>Technical</summary>

  A9 in `apps/indusk-admin/src/lib/plan-stage.test.ts` (add `// promise: the-nav-says-where-a-plan-is` if absent): read A2's folder, call `navMarkOf(plan, false, undefined)`; `stage` is `Build`.

  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.

#### Build Phase 2 Verification

- [x] The four new tests pass, along with the rest of the plan's tests.
  <details><summary>Technical</summary>

  `cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.rituals.test.ts src/lib/plan-stage.test.ts`; A6–A9 `passing`. A row that fails reveals a real bug: fix it in this phase and say so in the item.

  </details>

#### Build Phase 2 Context

- [x] The package's context rule says what counts as finished and that a skip wins.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the rule Build Phase 1 added: append "A legacy falsification log counts as finished; a skip with a reason wins over a finished phase; an open item keeps the ritual unfinished. Guarded by `planning-reader.rituals.test.ts`."

  </details>

#### Build Phase 2 Document

- [x] The changelog entry names the cases that were checked.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, the Build Phase 1 entry: add "older falsification logs count, a skipped ritual still reads skipped, an unfinished ritual phase still reads current."

  </details>

### Build Phase 3: Cleanup — one definition of "finished"

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

The admin's plan reader and the package's retrospective gate each work out, in their own code, whether falsification is finished: a closed phase or a completed older log. Two places that must agree is how they come apart later, and the package already holds the matching list of skipped rituals. This phase moves the question into the package, next to that list, and has both the plan page and the gate ask it. When it closes there is one definition of a finished ritual and the admin only passes it on.

- [x] The package answers which rituals a plan has finished, from the plan's folder and impl text.
  <details><summary>Technical</summary>

  Add `finishedRitualsOf(planRoot, implContent)` to `apps/indusk-mcp/src/lib/cleanup/gate.ts` beside `skippedRitualsOf`, returning `Array<"falsification"|"cleanup"|"audit">` in that order, built from `isFalsificationPhaseTerminal || isFalsificationComplete`, `isCleanupPhaseTerminal`, `isAuditComplete`. Basis: the cockpit rule that a derived fact is defined once in the package (`cockpit-single-definition.test.ts`, `lesson: structural-single-definition-test-for-must-agree-invariants`); today `falsificationOk` in `checkRetrospectiveReadiness` (gate.ts ~L243) and `finishedRitualsOf` in `planning-reader.ts` ~L320 both write the same OR. Type the result with the existing `SkippableRitual`.

  </details>
- [x] The retrospective gate and the plan page both use that one answer.
  <details><summary>Technical</summary>

  `checkRetrospectiveReadiness` takes `falsificationOk`/`cleanupOk`/`auditOk` from it plus the skip checks; delete `finishedRitualsOf` and its three imports from `apps/indusk-admin/src/lib/planning-reader.ts` and call the package's, keeping the `implRaw === null` case (audit only: pass `""`). Behaviour parity: `retrospective-gate-backcompat.test.ts`, `cleanup-gate.test.ts`, A2, A6–A8 stay green.

  </details>
- [x] A structural test keeps the plan page from defining "finished" a second time.
  <details><summary>Technical</summary>

  Add `finishedRitualsOf` to `PACKAGE_ONLY` / the single-definition list in `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts` (subpath `cleanup/gate`, file `gate.ts`) so a copy in admin or the extension fails it.

  </details>
- [x] Reviewed the step list's use of the finished list and left it as it is.
  <details><summary>Technical</summary>

  `plans/steps.ts` `releaseStep` — left as-is: one line, one reason to change, reads a handed-in list; moving the check elsewhere would scatter step rules.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Verification

- [x] The package's answer matches the gate for each ritual, the plan page still reads the same, and a second copy in the admin is refused.
  <details><summary>Technical</summary>

  A10 in `cleanup-gate.test.ts` (`// promise: a-finished-ritual-stays-done`): for a folder with a closed falsification phase, a legacy log, a closed cleanup phase and an `audit.md`, `finishedRitualsOf` lists exactly what `checkRetrospectiveReadiness` calls ok (absent a skip). `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/cleanup-gate.test.ts src/__tests__/cockpit-single-definition.test.ts src/__tests__/retrospective-gate-backcompat.test.ts src/lib/plans/steps.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/lib/planning-reader.rituals.test.ts src/lib/plan-stage.test.ts`.

  </details>

#### Build Phase 3 Context

- [x] The package's context rule says the finished list is defined beside the skipped list.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the finished-ritual rule: append "`finishedRitualsOf` in `cleanup/gate.ts` is the one definition; the admin passes it on."

  </details>

#### Build Phase 3 Document

- [x] The changelog entry says the plan page and the retrospective gate now share one answer.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, the Build Phase 1 entry: append "the plan page and the retrospective gate read one definition of a finished ritual."

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
