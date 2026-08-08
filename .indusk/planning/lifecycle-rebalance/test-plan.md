---
title: "Lifecycle Rebalance — Test Plan"
date: 2026-08-08
status: accepted
---

# Lifecycle Rebalance — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the Shape check is working. Each names the mechanism that will verify it — not the test code, but the approach.

The observer throughout is **a developer running `/work` on a plan**. What they see is the impl.md changing: items appearing in the phase they're working on, or a recorded note that the review happened and found nothing.

One structural note that shapes the mechanisms below: Shape ships as *executor behavior*, and the executor in this lane is a skill — markdown, not code. Prose cannot be unit-tested. So the plan puts every decision that can be made deterministically into a **library** (`lib/shape/`) and leaves the skill to orchestrate it, exactly as `/cleanup` already does with `lib/cleanup/oversized.ts`. The assertions below target the library and the observable effect on the plan document; the judgment layer is declared untestable in its own section rather than pretended into a unit test.

## Behavioral Assertions

### The finding mechanism

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | When a phase writes a unit that violates a craft rule, that phase gains a checklist item naming both the change to make and the rule it came from. | vitest integration (real git fixture) |
| A2 | The item lands in the phase that produced the code — not in a new phase, and not at plan close. | vitest integration |
| A3 | A phase whose Shape items are unchecked cannot be closed. | vitest integration (existing `check-gates` behavior, pinned) |
| A4 | When the code a phase wrote is well-shaped, no extraction items are added and the phase records that the review ran and found nothing. | vitest integration |

A4 is the false-positive guard and the answer to "what stops this becoming a nag." A check that always finds something is noise; "nothing to do" has to be a common, recorded outcome.

### Scoping — what gets reviewed

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A5 | Shape reviews only files the current phase changed — code written in earlier phases is not re-flagged. | vitest integration |
| A6 | A phase that changed no code files is recorded as skipped with the reason, never silently passed over. | vitest integration |
| A7 | Reviewing a file and deliberately leaving it alone records the decision and its reason, distinct from not reviewing it. | vitest integration |

A6 and A7 are the same principle the `dawn-verify` plan established the hard way: **a check that cannot distinguish "nothing to do" from "did not run" reports the shape of success without doing the work.**

### The boundary against Cleanup

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A8 | Logic duplicated across two separate files is not flagged by Shape. | vitest integration |
| A9 | `/cleanup` at plan close still flags that same cross-file duplication. | vitest integration |

A8 and A9 are a pair and must be read together: they pin the intra-unit / inter-file line from opposite sides. Without A9, "Shape ignores it" could mean nobody catches it.

### Ordering and sourcing

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A10 | Shape runs only after the phase's verification is green — a phase with failing tests is not asked to refactor. | vitest integration |
| A11 | Turning off a domain extension changes what Shape flags; its rules trace to an enabled extension rather than to hardcoded knowledge. | vitest integration |

A10 encodes the same ordering `/cleanup` already obeys ("refactor under the green coverage falsification hardened"). Restructuring code whose correctness is unproven is how a refactor hides a bug.

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Shape flags the things a thoughtful reviewer would flag, and not much else. | Judgment quality. There is no oracle for "should this have been extracted" — it depends on the codebase, the domain, and taste that the extensions encode only partially. A fixture proves the mechanism fires, never that it fired *wisely*. | Every plan run with Shape records its finding count and false-positive count in the retrospective's Quality Ratchet section. **Trigger: if two consecutive plans report findings a human judged wrong, calibration reopens as a falsification hypothesis against this plan.** The first three plans after this ships are the calibration sample. |
| U2 | Shape reduces the work `/cleanup` finds at plan close. | Longitudinal and confounded — it needs several comparable plans before and after, and plans differ in size and kind. A single before/after is anecdote. | Recorded as a metric, not a claim: each retrospective notes cleanup's finding count, and the comparison is made after three post-Shape plans rather than asserted now. |

U1 is the honest core of the risk. The brief's third open question — "what stops Shape from becoming a nag?" — has no test that can answer it, only a stated trigger for noticing the answer is *no*.

## Notes

- **A1's fixture needs a craft violation that is genuinely local**, not merely long. The `dawn-verify` renderer is the reference case: it was not an oversized file, it was inline rendering that should have been a named pure function — invisible to a line-count heuristic. If A1's fixture can be satisfied by counting lines, the assertion is weaker than the feature it is meant to prove.
- **A11 is what keeps craft knowledge out of core.** If Shape hardcodes "extract functions over 40 lines," it stops being extension-sourced and the project loses the ability to set its own standard — the same maxim-7 argument that kept runner-specific parsing out of `atdawn verify`.
- The mechanism column says "vitest integration (real git fixture)" for most rows because Shape's input is *what a phase changed*, which is a git question. Mocking git would test nothing, the same conclusion `dawn-verify` reached.
- **Open, and it belongs in the ADR rather than here:** whether the judgment layer is a model call or heuristics. A1 and A11 are satisfiable either way, so the test plan does not force the choice — but the ADR must make it deliberately, since it decides both recall and per-phase cost.
