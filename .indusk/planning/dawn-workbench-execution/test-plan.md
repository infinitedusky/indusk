---
title: "Dawn Workbench Execution — Test Plan"
date: 2026-09-15
status: accepted
---

# Dawn Workbench Execution — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
floor runs where the work is: `indusk verify` and `indusk run` give honest
answers in a single-repo workbench, where the plan's documents and the code
they describe live in different repositories. Each assertion names the
mechanism by which it will be tested. The assertions become the rows of the
impl's Test Trajectory; the ADR that follows is constrained by "what makes all
of these true at once?"

Every assertion is phrased from outside: what a command prints, what a
repository's history holds, what a queue records. The two fixtures the
mechanisms name already exist — `helpers/versioned-workbench.ts` builds a
git-initialized workbench with declared repos (nested or sibling layout), and
the run suite's scripted-model harness drives the real loop against the real
gate scripts with no model in the loop. The plan adds the two layouts the
fixture lacks.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | In a workbench declaring one repo, `indusk verify <plan> --phase 1` run at the workbench root produces a verdict. With an honest phase (code committed in the code repo, checkoffs in the plan repo, tests green) the verdict is clean and the exit code is 0. | vitest integration — versioned-workbench fixture, `runVerify` |
| A2 | From the workbench root, `verify` reports a red test that lives in the code repo, naming the trajectory row, and exits non-zero. | vitest integration — same fixture, a planted failing test |
| A3 | From the workbench root, `verify` reports phantom work when an implementation item is checked off and nothing in the code repo changed since the phase's baseline. | vitest integration — same fixture, a checkoff-only change |
| A4 | The first cross-repo `verify` on a workbench whose ledger predates this plan does not fail and does not guess: it reports a merge-base baseline in the code repo. A later phase's verify chains from the code-repo sha the earlier clean verify recorded. | vitest integration — fixture with a hand-written pre-split ledger line, two phases |
| A5 | A workbench declaring two repos still refuses, naming both repos, for `verify` and for `run`. | vitest — regression guards on the existing refusal messages |
| A6 | A flat project (no workbench declaration) verifies exactly as before: the existing verify suite passes unchanged. | vitest — the existing `verify.test.ts`, untouched |
| A7 | Under `run`, a phase's file edits land in the code repo's working tree and its impl checkoffs land in the plan repo's `impl.md`; nothing from one appears in the other. | vitest integration — scripted-model loop on the fixture, real gate scripts |
| A8 | Under `run`, each checked-off item produces a commit in the code repo whose diff holds that item's code, and a commit in the workbench repo whose diff holds only the checkoff, referencing the code commit. Code is never committed to the workbench repo. | vitest integration — same harness, `git log` in both repos |
| A9 | Under `run`, a scripted model that checks off a phase while a trajectory row it depends on is non-terminal is refused, with the gate's message, read from the plan repo's impl. | vitest integration — same harness |
| A10 | Under `run`, a file write whose path is outside both the code repo and the plan's own folder is refused; a write inside either is allowed. | vitest — the loop's tool set on the fixture |
| A11 | `indusk run` at the root of a workbench declaring one repo gets past the workbench check: with no provider key configured its error is the provider-key error, not the workbench refusal. | vitest — built CLI on the fixture |
| A12 | Every eval the loop queues names the repository its commit landed in, and draining the queue evaluates that repository's commit — the evaluator is invoked against the code repo, never the workbench. | vitest — pending queue + drain with the evaluator stubbed |
| A13 | A1, A7 and A8 hold on every single-repo layout a workbench can declare: flat legacy (`wrapped_repo`, no `repos_root`), nested, sibling, and a repo at a declared `path`. | vitest — the same tests parameterized over four fixture layouts |
| A14 | Exactly one function resolves "where is the plan, where is the code" for `run`, `verify` and the cleanup scan, and each of the three reaches its refusal through it. | vitest — source pin by count, the shape `shared-resolution.test.ts` uses |
| A15 | Inside a workbench, the dawn-verify acceptance matrix holds: an uncontrolled headless agent's honest phase verifies clean (no false positive), and each of the five planted violation classes is caught. | acceptance procedure — headless `claude -p` on a workbench fixture, recorded as `matrix.md` the way component 6 recorded A16 |

## Untestable Assertions

None. A15 is expensive and manual in its driving, but it is runnable and its
record is checkable; it is an acceptance procedure, not an untestable claim.

## Notes

- A4 deliberately covers the migration story: a ledger line written before
  this plan carries one sha, the plan repo's. The assertion is that such a
  line never becomes a code baseline by accident — the command says
  "merge-base" and where it found it.
- A8 pins whichever answer the ADR gives for the checkoff commit. The brief
  left it open (commit to the workbench repo, or leave to `workbench sync`);
  the ADR settles it and the row's text is updated to match before the impl
  is written.
- A10's "plan's own folder" is `.indusk/planning/<plan>/` under the plan
  root — the loop may edit the plan's documents and the code, nothing else.
- A13's four layouts need two additions to `helpers/versioned-workbench.ts`:
  the flat legacy shape and a repo declared at a `path`. A fixture that
  cannot build the shape cannot see its failures.
- A15 reuses `archive/dawn-verify/matrix.md`'s cells verbatim (control, then
  A through E) so the two records compare cell for cell.
