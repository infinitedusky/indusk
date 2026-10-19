---
title: "A finished ritual stays done — Retrospective"
date: 2026-10-16
status: complete
---

# A finished ritual stays done — Retrospective

## What We Set Out to Do

Make a plan's Falsify, Cleanup and Audit steps keep reading done once each ritual is finished, even when a later build phase (an audit follow-up) sends the plan back to building. The step list read each ritual only from the plan's one lifecycle position, so a reopened plan put all three after it and they read "not yet" (seen on `plans-are-promises`).

## What Actually Happened

- **Test Phase 1 / Build Phase 1** shipped the fix as planned: the admin's reader works out which rituals are finished from the plan's own files (a closed phase, a legacy falsification log, `audit.md`) and hands the list to the step list, which reads a finished ritual as done unless it was skipped.
- **Build Phase 2** (added after the first audit) pinned the cases the first tests missed: legacy log, an open item, a skip beating a finished phase, and the nav mark saying Build. All passed when written; no bug.
- **Build Phase 3** (added by cleanup) moved "which rituals are finished" into the package (`finishedRitualsOf` in `cleanup/gate.ts`), so the plan page and the retrospective gate read one definition. A structural test keeps a second copy out of the admin.
- Diff against trunk: 11 files, +274/−6 in `apps/`.

## Getting to Done

- The first falsification and cleanup were skipped with thin reasons ("no hypothesis formed", "nothing to decompose"). The audit rejected both. Re-running the rituals found no falsifying hypothesis but did find real duplication (the falsification-finished check written in both the gate and the admin), which became Build Phase 3.
- The first audit also found the brief's promise said a skipped ritual reads done, while the code and two passing rows made it read skipped. Fixing the sentence took three steps: the brief, the promise registry (`indusk promises change`), and a re-approval by a person.
- At close, trunk was 84 commits ahead; merging it conflicted once, in `cleanup-gate.test.ts` (both sides added tests), resolved by keeping both.
- Two everyday tests fail on trunk itself (`impl-corpus` A4 names the archived `nav-row-legible` plan; `looks-admin-approvals-hold` A11 names the mockup `plan-row.worktree`). Neither touches this plan's files; verified by running both on the trunk checkout.

## What We Learned

- A step list derived from one position forgets finished work the moment a plan reopens. Read "finished" from the work's own files, and keep position for "where is it now".
- Rows that pass can still prove the opposite of a promise's clause (A5 and A8 pinned "skipped" while the sentence said "done"). A cold audit read the sentence against the rows; the building agent did not.
- When two places must agree on a derived fact, the second copy is the bug waiting to happen; the cheap fix is one function in the package plus a single-definition test entry.

## What We'd Do Differently

- Write the promise sentence from the behaviour wanted (a skip reads skipped) before the test phase, not after an audit.
- Do not skip falsify and cleanup with a reason that says nobody looked. Spending the look found the duplication.

## Insights Worth Carrying Forward

- **Audits as signals (from the person, for the `mark-first` plan).** Instead of fixing every audit concern, the audit should ask what signal would show us if it breaks, and say when telemetry is not the answer: a signal, a fix, or nothing, each with how often it would fire. Filed into `mark-first`, not built here.
- The project's word for the telemetry a promise reports is *signal* (decided in `one-promise-language`); `CLAUDE.md` still says *mark* in the Day 4b line.

## Shape numbers

Shape raised no findings in any phase (Build Phases 1 to 3 each recorded "nothing to change"); none was judged wrong by a human. Zero and zero is a data point: in this plan the reviews were quick, and the only craft finding (the duplicated check) came from cleanup, not Shape.

## Test Trajectory

A1 to A10 all `passing`; no blocked rows, no deferred rows.

## Close notes

- Everyday suite on the merged branch: the package 3121 passed, 2 failed (both failing on trunk too), the admin 800 passed.
- `pnpm check` prints Biome config-version notices (CLI 2.5.14, configs 2.4.8) on trunk as well; Biome on the changed files is clean.
- Nothing published: this repo installs its own build at landing and publishes deliberately.

Landed on main at 8e95661f, 2026-10-16.
