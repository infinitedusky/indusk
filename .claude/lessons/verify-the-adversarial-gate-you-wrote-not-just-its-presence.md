# Checking off a "none fails on a missing import" gate requires actually re-running the suite and reading each failure — not just observing the count is red

In versioned-workbench's Test Phase 1 (commit 8c33a96a), the phase Verification gate item read: "Each red row fails on its own assertion or on a genuinely-absent CLI command — none fails on a missing import, which would mean the test was never authored." This is a well-framed adversarial gate — exactly the kind [[verification-gates-need-adversarial-framing]] asks for.

It was checked `[x]` in the same commit. But one of the 22 authored tests (`workbench-verify-refusal.test.ts`, the "A17 — does not call honestly-done work phantom" case) actually fails with `ReferenceError: mkdirSync is not defined` — a missing import from `node:fs`. That is precisely the failure mode the gate text was written to rule out, and it was the single most narratively important row in the commit (four paragraphs of commit-message prose about it being "the sharpest trap").

## Why

Writing an adversarially-framed gate is necessary but not sufficient. The gate still has to be *executed* — every row's failure reason read individually, not just "the suite is red, tests: N failed" glanced at in a terminal summary. It is easy to see 22/22 failing and conclude the gate passed, when 21 fail for the intended structural reason and 1 fails on a banal `ReferenceError` that happens to also produce a non-zero exit and a red checkmark in the runner's summary line.

## How to apply

When a phase's Verification gate says "none fails on X" (missing import, wrong error message, wrong exit code, etc.), that gate cannot be satisfied by running the suite and observing the aggregate red count. It requires opening the actual per-test error for every row named in the trajectory and confirming each one's failure text matches the *intended* boundary (unknown command, missing config field, assertion on real output) rather than an incidental one (undefined identifier, import typo, syntax error). This is exactly the kind of check `indusk verify` or a `/falsify` pass should be able to catch mechanically — a per-row failure-reason classifier — rather than relying on the authoring agent's read-through.

