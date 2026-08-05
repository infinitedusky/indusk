---
title: "Dawn Verify — Test Plan"
date: 2026-08-04
status: accepted
---

# Dawn Verify — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean `atdawn verify` is working. Each assertion names the mechanism by which it will be tested — not the test code, but the test approach. When all assertions can be made true by an architecture, we have a feature; when all are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows is constrained by "what makes all these assertions true?" rather than invented from intuition.

The observer throughout is **a developer running `atdawn verify` at a terminal after handing a phase to an agent Dawn didn't control.** Every assertion is phrased as what that developer sees.

## Behavioral Assertions

### The five detections

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Verifying a phase whose work checked off an item while an earlier phase still has an unchecked gate item reports a rejection that names the offending item and the phase it belongs to. | vitest integration (real git fixture) |
| A2 | Verifying a phase that left a trajectory row still `planned` at the phase where it was writable reports a rejection naming that row. | vitest integration |
| A3 | Verifying a phase whose trajectory assertion text was edited since the baseline reports a rejection showing both the previous and current text. | vitest integration |
| A4 | Verifying a phase containing a row marked `passing` whose test actually fails reports a rejection naming that row and the failure. | vitest integration (fixture project with a real failing test) |
| A5 | Verifying a phase where an item was checked off with no file changes since the baseline reports a rejection naming that item. | vitest integration |

### The clean path and the report-only guarantee

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A6 | Verifying an honest phase reports success, exits 0, and states which baseline commit it judged against. | vitest integration |
| A7 | A verify that rejects leaves every file in the repository byte-identical — no revert, no rewrite, no staged change. | vitest integration |
| A8 | A rejecting verify exits non-zero, so a script or CI step that runs it fails rather than continuing. | vitest integration |

A7 is the load-bearing invariant of the detect-only scope decision. It is asserted directly rather than assumed from the absence of write code, because "we didn't write a mutation" is not evidence that no mutation happens.

### The baseline ledger

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A9 | After a phase verifies clean, verifying the next phase judges against the commit recorded by that previous verification, not against the merge base. | vitest integration |
| A10 | Verifying a plan that has never been verified before reports which baseline it bootstrapped from and proceeds. | vitest integration |
| A11 | A rejecting verify records nothing — re-running it produces the identical rejection rather than treating the bad phase as an established baseline. | vitest integration |
| A12 | A corrupted or unreadable ledger causes verify to refuse loudly and name the problem, rather than silently proceeding as if the plan had never been verified. | vitest unit |

A11 and A12 are the failure-safety pair. A11 prevents a bad phase from silently becoming the yardstick for the next one; A12 prevents corruption from quietly downgrading verification to bootstrap mode — a failure that would look exactly like success.

### Test attribution and backward compatibility

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A13 | A row claiming `passing` with no test reference is reported as unverified — the report distinguishes "checked and passed" from "could not be checked." | vitest integration |
| A14 | A plan authored before test references existed verifies without error, and its report says how many rows could not be red-test-checked. | vitest integration |

A13 is the honesty requirement behind the brief's known limitation: an unverifiable row must never be silently counted as verified. A14 keeps every existing plan working.

### Environment

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A15 | Running verify where there is no git repository fails loudly naming the missing repository, rather than reporting a clean phase. | vitest integration |

Silent-empty on a non-git root is a known-hostile failure mode in this codebase — the cleanup library was changed to throw for exactly this reason, because a workbench root is deliberately not a git repo and silent `[]` made the ritual vacuous there.

### The keystone acceptance experiment

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A16 | A phase executed end-to-end by an external agent Dawn does not control, into which a specific violation was planted, is caught by verify — and the run is recorded with what was planted, what was caught, and what was missed. | manual (scripted external-agent run, recorded in `matrix.md`) |

A16 is what makes this component closeable under maxims 5 and 8. Unit tests prove verify catches violations *we constructed*; A16 is the only assertion that tests the actual claim — that boundary verification catches a real agent doing real work badly. **A miss recorded here is a valid, valuable result**, and it is the input component 7's shape depends on.

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Phase-boundary verification is *sufficient* enforcement for agents Dawn doesn't control. | This is a universal claim over all agents, all plans, and all failure modes. No finite test proves it; a single counterexample disproves it. It can only be sampled. | A16 samples it deliberately with a planted violation. The result — held or leaked — is written into the master's component 6 row as a finding, and component 7's plan branches on it explicitly rather than assuming it. Any later miss found in dogfooding reopens the question as a new falsification hypothesis. |

U1 is the keystone question itself. Naming it as untestable is the honest framing: this plan does not *prove* the assumption, it *tests it once, on purpose, and writes down what happened.* Presenting a sampled result as proof would be exactly the assertion-over-evidence failure maxim 5 exists to prevent.

## Notes

- **Row-to-test mapping (A4, A13, A14)** is the assertion set most likely to reshape the ADR. It needs a reference format precise enough to attribute a failure and loose enough not to break on refactors. The ADR should settle format and resolution-failure behavior.
- **Suite execution cost** is the maxim-4 tension flagged in the brief and still open: run the whole suite, or only the tests the trajectory references. A4 is satisfiable either way, so it does not force the decision — the ADR must make it deliberately rather than inheriting it from whatever the impl does first.
- **A16's agent choice** stays open for the ADR. The master names Cursor; a hookless `claude` session is cheaper to script and more reproducible. The assertion is phrased agent-agnostically so it stays valid either way, but the recorded run must name which was used.
- **A1/A2 reuse `check-gates` unchanged** via the existing probe primitive. If either fails, suspect the baseline reconstruction before suspecting the hook — the hook is already covered by its own tests in both lanes.
