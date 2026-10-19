# When code is about to reverse a recorded decision, revisit the decision first — phase verification was changed to read Vitest's JSON report against the Dawn verify decision, and only the audit noticed

tests-never-make-us-wait, 2026-10-18: the Dawn verify decision says verification reads files and exit codes, never runner output. The Build Phase 5 cleanup made `detectRedTests` run through a shared module that reads Vitest's JSON report for per-file results, without revisiting that decision; the audit caught it and the published decision page now records the reversal.

Why: a decision that the code quietly contradicts leaves two pages disagreeing and the next agent following the older one. How to apply: when a change touches code a decision page or ADR constrains, search the decisions for the constraint before editing; if the change is right, state the reversal in the plan (ADR or impl note) and update or link the old decision in the same plan.

See apps/docs/src/decisions/tests-never-make-us-wait.md ("One way to run a test file") and /decisions/dawn-verify.
