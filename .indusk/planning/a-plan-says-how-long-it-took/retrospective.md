---
title: "A plan says how long it took — retrospective"
date: 2026-10-18
status: completed
---

# Retrospective — a-plan-says-how-long-it-took

## What We Set Out to Do

Make every phase, every unattended planning or build step, and every run of a plan's tests leave a timed record on this machine, and give one command, `indusk plans time <name>`, that prints them with a total from the brief's acceptance to the landing. Recording must never stop the work it records. Brief clauses: `phases-are-timed`, `steps-are-timed`, `test-runs-are-recorded`, `one-view`, `a-record-never-blocks`.

## What Actually Happened

- Diff against `main`: 28 files, +1988 / −97 lines. Largest new file is `apps/indusk-mcp/src/lib/timing/view.ts` (387 lines), under the 400-line cap.
- Test Phase 1 pinned the test-run selection (A18) before any recorder touched it. Build Phases 1–5 then added the log, the safe writer, the phase-close recorder, the step wrapper, the test-run recorder, and the view.
- **Phases-are-timed is only half recorded.** The close half is derived, not written: `recordPhaseClose` exists and is tested, but nothing in production calls it. The decision was taken in Build Phase 1 (its Notes, and the plan-timing decision page): the one deterministic close point is the `check-gates` hook, which is a gate this plan does not change. The view ends a phase at the next phase's opening; the last phase of a plan reads as open. The brief clause says "when it closed", so the clause is only partly delivered. See Decision 1 below.
- Build Phase 5 was falsification. It found the view counting a landed plan's last phase as growing forever, the reader not checking fields per kind, the landing search looking in the workbench root rather than the code repo, the trunk-run view finding no phase openings, and an unknown plan name printing an empty view with exit 0. All five were fixed with tests that failed first.
- Closing the promise failed at first on six refusals: the timing test files did not carry `promise: a-plan-says-how-long-it-took`, and row A13 (a manual live check) named a manual command as its test. See Decisions 2 and 3.
- The audit step (`audit.md`, written on the claude-opus-5-5 reader) raised scenarios about narrower-than-clause tests and untested wrap sites. See "Audit findings" below.

## Getting to Done

- Promise confirm: added `// promise:` to five timing test files (the clause tokens were already there), then confirmed. One refusal remained (A13), resolved per Decision 3.
- Retrospective readiness: falsification satisfied by Build Phase 5 (terminal, closed by `/work`); cleanup satisfied by skip reason (120-character limit met); audit satisfied by `audit.md`; every trajectory row terminal.

## What We Learned

- A row whose Test cell is a manual command cannot prove a clause in the promise registry. The registry needs a file. A live check is useful evidence, but it should be recorded as one, not as a clause proof.
- A test-file token is a cheap, mechanical gate. Adding `// promise:` at the top of each file that proves a promise is the whole fix; the gate exists so that a proof is findable by name.
- Falsification found real defects that the happy-path rows could not reach: a landed plan's time grows forever unless the landing ends the open phase, and an unknown plan name silently exits 0.

## What We'd Do Differently

- Decide at brief time whether "phase closed" is a recorded event or a derived one. The brief said recorded; the build derived it. The disagreement surfaced only at audit, after five build phases.
- Give the live-check row its own level in the trajectory (it already has `live check`), and have the promise gate skip it rather than refuse it. Today the gate refuses a legitimate live check.
- Make `recordTestRun` write in a `finally` or equivalent, so a runner crash still leaves a record (see audit scenarios).

## Audit findings

The audit is advisory; nothing gates on it. Each finding below is a scenario read from the code, not an observed failure, except where stated.

- **Phase close has no production caller** (observed, by read of `src/` and `hooks/`; decided in Build Phase 1). `phases-are-timed` is proved for open, not for close, in production.
- **`recordTestRun` runs only after `runFiles` resolves** (`plan-tests.ts`). A runner crash or spawn error would leave no record. Scenario; no observed crash. Follow-up candidate.
- **`reached` count is always 0** (`test-run.ts`'s `countByReason`). The field exists to match the ADR's log shape; no current input makes it non-zero. Recorded as-is.
- **Landing grep pattern not pinned to the subject `plans land` writes** (`view.ts` against `land.ts`). Scenario; `land.ts` writes the subject the view greps for, but no test pins the two together. Follow-up candidate.
- **`between` is total minus phases only**; ADR Decision 8 says "not inside any listed item", so steps and test runs are not subtracted. The test plan's `one-view` Measure expects the sum of parts to be no greater than the total. This is a documentation/ADR inconsistency; not changed here. Follow-up.
- **`classifierFor` may label a failed step `blocked`** when a blocker line already exists. Scenario only. The Build Phase 5 falsification summary said no runner starts a step on an already-blocked plan, so a blocker after the step is the step's own. Not reproduced; not changed.

## Decisions (unattended, this build)

1. **Phase close stays derived.** Reason: wiring a close into `check-gates` changes a gate, which the plan forbids; wiring only the Dawn loop would record closes for phases never opened. The brief clause is partly unmet and this is recorded as such; a person who wants exact closes amends `phases-are-timed` and adds a close instruction beside the work skill's start instruction.
2. **Five timing test files carry `// promise: a-plan-says-how-long-it-took`.** Reason: the registry requires the token on each file that proves a promise. The clause tokens were already present.
3. **Row A13's For cell no longer names the one-view clause.** Reason: A13's Test is a manual command, and `indusk promises confirm` requires a file for every row that names a clause, so it refused the close. The one-view clause stays proved by file-backed rows A10–A12 and A20–A24, all passing. A13 stays `passing` as the live check it was. The impl's Build Phase 5 notes record this decision.
4. **Audit findings are recorded, not fixed here.** Reason: they are scenarios, not observed failures, and the brief's scope excludes new wiring at close. The follow-up candidates above are for a later plan.
5. **Version bump not done; nothing published.** Reason: `workflow.steps.land.install` is declared (`pnpm install:local`), so the build reaches this machine by install; publishing is the person's deliberate call (`indusk release`), and no one has said this close is a release.

## Shape numbers

- Shape raised findings across the phases: **0** (Build Phases 1, 2, 3, 4 each record "nothing found"; Build Phase 5 has no Shape line and its cleanup review found no file over the cap).
- Findings a human judged wrong: **0**.
- The streak trigger (two consecutive plans with findings judged wrong) does not apply: this plan raised none.

## Insights Worth Carrying Forward

- A promise's proof must be a file. A manual check is evidence, not a proof; keep the two distinct in the trajectory.
- Derived-versus-recorded is a decision to make in the brief, because it decides whether a clause can be proved at all.
- Falsification in a phase that runs on the real view (not the fixture) found more than the happy-path rows did.

## Landing

Landed on main at <pending>, <pending>. (Recorded after the merge, Step 10.)
