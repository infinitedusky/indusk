---
title: "Rationale Baseline Frontmatter — Test Plan"
date: 2026-04-19
status: accepted
---

# Rationale Baseline Frontmatter — Test Plan

## Purpose

Behavioral assertions that, taken together, mean the `rationale_baseline` frontmatter key is honored end-to-end by every layer that enforces trajectory rationale completeness. Each assertion describes what an agent or operator editing an impl.md *experiences* — not what an internal function returns.

The user-visible "system" here is the validator: the agent edits impl.md, hits the hook (write-time gate) and the TS source (runtime checks), and either gets a green pass-through or a structured error message that names exactly what's wrong. The tests below verify both halves of that behavior — pass-through when baseline is honored, structured error when it's not — across the hook, the TS source mirror, and the actual on-disk impl.md edit-flow.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | When an impl.md frontmatter has `rationale_baseline: 1` and every trajectory row is `Writable at: Phase 1` or earlier, and the `### Trajectory Rationale` subsection is empty (or missing entirely), saving the file passes the validator with no error. | vitest unit (TS source) + hook smoke (edit a fixture impl.md) |
| A2 | When an impl.md frontmatter has `rationale_baseline: 1` and one trajectory row is `Writable at: Phase 3` and the `### Trajectory Rationale` subsection is empty, saving the file fails with an error message that names the single Phase-3 row's T-ID. | vitest unit (TS source) + hook smoke |
| A3 | When an impl.md frontmatter omits `rationale_baseline` entirely (existing plans), the validator behaves exactly as it does today: rows at `Writable at > Phase 0` require a rationale entry; rows at `Writable at: Phase 0` don't. (Regression / backward compat.) | vitest unit (TS source) + hook smoke against today's existing plans (no migration required) |
| A4 | The error message wording when a baseline-aware plan is missing rationale entries reads naturally — "later than Phase {baseline}" instead of hardcoded "Phase 0" — so an operator reading it understands the actual rule the plan declared. | vitest unit (assert error string contains the dynamic phase number) |
| A5 | The validator-source-of-truth in `apps/indusk-mcp/src/lib/trajectory/validator.ts` and the hook port at `.claude/hooks/validate-impl-structure.js` produce identical pass/fail decisions for the same impl.md content (parity check — they must agree on every input or one of them is wrong). | vitest unit (run both implementations against a shared fixture set, assert results match) |
| A6 | After upgrading global indusk-mcp on a consumer project (e.g., Numero), an impl.md that adds `rationale_baseline: 1` to its frontmatter and authors all rows at `Writable at: Phase 1` can be edited freely without the hook rejecting the edit. | manual smoke (Numero) — author one of Numero's queued plans (`restart-recovery` or similar) using the new key, edit impl.md repeatedly, observe no hook rejection |
| A7 | Indusk-shipped documentation (the trajectory guide / planner template / wherever frontmatter is documented) names the new `rationale_baseline` key, gives its default (`0`), and explains when to use a higher value (refactor / schema-migration / scaffolding plans where Phase 1 IS the enabling work). | vitest custom audit (grep the documented keys list for `rationale_baseline`) + manual review of doc page rendering |

## Untestable Assertions

(none — every assertion in this plan is either a pure-function validator test or a manual smoke against the real hook on a real project)

## Notes

- **Behavioral framing check**: every assertion above is something the agent / operator *experiences* when editing impl.md or running validations. None of them describe internal function signatures or parser shapes. ✓
- **Mechanism choice**: vitest unit tests on the TS source are the primary surface (fast, deterministic, hash-comparable to the JS port for parity). Manual hook smoke is the secondary surface — confirms the JS port matches the TS source on a real Edit operation through the actual Claude Code hook pipeline. A6 (Numero generalization) is the smoke that confirms the fix actually unblocks the real-world pain.
- **Parity check (A5) is load-bearing**. Per CLAUDE.md gotcha: "the trajectory hook JS ports are MINIMAL mirrors of `apps/indusk-mcp/src/lib/trajectory/`." Drift between the TS source and the JS hook port is the kind of bug that only surfaces when a consumer project hits the hook with a case the TS unit tests didn't cover. A5 forces the same input set against both to catch divergence.
- **A6 is the one assertion that requires post-publish action** (upgrade global indusk-mcp on Numero, then test). Same pattern as `eval-agent-mcp-access`'s generalization smoke. Marked manual smoke explicitly.
- **Consumer-side follow-up is OUT of scope** per the brief — this plan ships the mechanism; updating Numero's three plans to use `rationale_baseline: 1` happens in those plans' authoring, not here. A6 just verifies one of them can use it.
