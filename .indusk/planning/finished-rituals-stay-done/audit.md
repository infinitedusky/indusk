---
plan: finished-rituals-stay-done
audited: 2026-10-16
model: claude-sonnet-5-5
---
# Audit — finished-rituals-stay-done

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/lib/plans/steps.test.ts:187` — Promise `a-finished-ritual-stays-done` says a plan's Falsify, Cleanup and Audit read done "once their ritual is finished (its phase closed, its audit written, or a skip with a reason)" and keep so when a later build phase reopens the plan. A1 and A3 (trajectory rows asserting the step list reads done for rituals named in `finishedRituals`) feed the field in by hand, so they prove only that `releaseStep` honours a list; they say nothing about which files make a ritual finished. That half is A2 alone.
- `apps/indusk-admin/src/lib/planning-reader.rituals.test.ts:56` — A2 (a trajectory row reading a temp plan folder through the real reader) is narrower than the promise: it covers a closed falsification phase, a closed cleanup phase and `audit.md` present. It does not cover the legacy falsification log branch (`isFalsificationComplete`, `planning-reader.ts:326`), the case of a ritual phase still open in a reopened plan reading not-done, or a frontmatter skip beating a finished phase. The brief's "or a skip with a reason" leg is proven only by A5, which runs on handed-in facts, not from files.
- `apps/indusk-mcp/src/lib/plans/steps.test.ts:208` — A4 (guard: a ritual being worked reads current) is built with position `completed` and `missing: ["falsification"]`, not a plan whose falsification phase is open and partly checked, and never goes through the reader. It guards the old path of `releaseStep`, not that `isRitualPhaseTerminal` returns false for a half-checked phase. The "current while being worked" half of `a-plan-shows-two-workflows` has no row at the reader level.
- `apps/indusk-mcp/src/lib/plans/steps.test.ts:218` — A5 (guard: skipped keeps reason) exercises only cleanup, and only with no finished entry for it; it does not assert skip wins when `finishedRituals` also lists the ritual, which is the one ordering `releaseStep` (`steps.ts:145-147`) decides.
- `apps/indusk-admin/src/lib/plan-stage.test.ts` — The must-not-break promise `the-nav-says-where-a-plan-is` ("Build while an audit follow-up is built") has no new row. The plan relies on existing `plan-stage` tests running green in verification; none feeds a reopened plan with finished rituals through `stepAt`, so the nav half of the user-visible outcome is inferred, not asserted.

## What does the diff change that no row touches?
- `apps/indusk-admin/src/lib/planning-reader.ts:320-335` — A finished ritual now also moves the nav stage, the "waiting" step name and copied plan markdown, because `stage`/`stepAt` and `planWaiting` read the same `snapshotOf`. For a plan not reopened (position at falsify, falsification phase closed, cleanup not yet authored) Falsify flips from current to done and `stepAt` jumps to the next not-yet step. No row asserts that.
- `apps/indusk-mcp/src/lib/plans/steps.ts:147` — `stepCount` (n of m) now counts finished rituals as done regardless of order; a plan with Cleanup closed but Falsify not finished shows 1 done ahead of an earlier undone step. No row.
- `apps/indusk-admin/src/lib/plan-snapshot.ts:22` — `finishedRituals` is passed to every consumer of `snapshotOf` (PlanList, decisions-reader, layout waiting), not only the plan page; nothing tests them.
- `.indusk/phase-boundary.jsonl` — bookkeeping file changed (2 lines added in the plan diff); no row, expected machine state.

## What does the code do that the brief never promised?
- `apps/indusk-admin/src/lib/planning-reader.ts:324-327` — Honors the legacy falsification log (`isFalsificationComplete`) as finished. The brief names only "its phase closed, its audit written, or a skip"; the log path is extra behavior, untested.
- `apps/indusk-mcp/src/lib/plans/steps.ts:147` — Finished is read for ritual steps in every position, including plans that never reopened or whose rituals were done out of order (Cleanup done while Falsify not yet). The brief promises only "keep reading done when a later build phase reopens"; the code makes done independent of position entirely.
- `apps/indusk-mcp/src/lib/cleanup/gate.ts:134` — `audit.md` existing (content never read) is enough for "finished"; an empty or stale audit file written before follow-up work reads Audit done. The brief says "its audit written", so this is consistent but the staleness case is accepted silently.
- `apps/indusk-admin/src/lib/planning-reader.ts:452` — `finishedRituals` is omitted when empty (spread guard), so the field's absence is a rule readers must know; not mentioned in the brief.

## Which rejected ADR alternative does the code quietly take?
- nothing — no ADR exists for this plan (`adr.md` is absent from the plan folder; the workflow is `bugfix`).

## Which skip reason would you not accept?
- `impl.md` frontmatter `falsification: skipped` ("falsification skipped — no hypothesis formed") — not accepted. The diff offers several testable hypotheses: (a) a half-open Falsification phase must not read done (only covered by A4 on handed-in facts, never via `isRitualPhaseTerminal`); (b) a frontmatter skip plus a closed phase; (c) a stray or stale `audit.md` marking Audit done before cleanup finished (`planning-reader.ts:333`, `gate.ts:134`); (d) finished-out-of-order shifting `stepAt` (see question 2). "No hypothesis formed" says nobody looked, not that nothing is there.
- `impl.md` frontmatter `cleanup: skipped` ("nothing to decompose") — weak but borderline. `planning-reader.ts:315-335` composes "which rituals are finished" in the admin, beside `skippedRitualsOf` which lives in the package (`gate.ts:116`); the same triple union `"falsification" | "cleanup" | "audit"` is now written in `Plan.finishedRituals`, `Plan.skippedRituals`, `gate.ts`, `review.ts`, and `steps.ts` (`SkippedRitual` reused as the finished type). That is the inter-file decomposition the ritual exists to catch, and the plan's own `cockpit-single-definition` rule says derived facts live in the package. I would not accept it as "nothing".
- Trajectory rows A4/A5 are listed as passing at Test Phase 1 (no build change); acceptable, they are guards. No `(none needed)` gates were found in the approved impl.

## What else would have to change for each promise to hold?
- `apps/indusk-admin/src/lib/plan-stage.ts` — Untouched; `a-finished-ritual-stays-done` holds on the nav only through `snapshotOf`. No row proves the stage string for a reopened plan.
- `apps/indusk-mcp/src/lib/plans/waiting.ts` — Untouched; its `step:` field (`waiting.ts:124`) reads `stepAt`, so Needs-you cards change silently.
- `apps/indusk-mcp/src/lib/cleanup/gate.ts` — Untouched; the finished-ritual composition (phase terminal OR legacy log, `audit.md`) should live next to `skippedRitualsOf` so the admin, `list_plans`/CLI and the vscode extension share one rule. Any non-admin reader that builds a `PlanSnapshot` (none found, but `planSteps` is a public subpath export) would not get `finishedRituals` and silently keep the old bug.
- `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts` — Untouched; it guards that steps are defined once but not that "finished" is defined once, so a second computation in the admin can drift.
- `apps/docs` (plan page / workflows reference) — only the changelog changed; any reference page describing step states (done = segment passed) was not checked or updated.
