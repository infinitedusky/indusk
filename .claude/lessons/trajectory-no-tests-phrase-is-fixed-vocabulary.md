# Trajectory's "no tests flip at this phase" declaration requires exact phrasing from a fixed vocabulary

The Test Trajectory validator's cross-reference-integrity rule (`validate-impl-structure.js` / `apps/indusk-mcp/src/lib/trajectory/validator.ts`) requires a phase's Verification section to have either a test-ID reference OR the exact phrase `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})` — one of exactly four allowed reason values. This rule fires regardless of workflow type (bugfix/feature/hotfix/etc.) and regardless of `gate_policy`.

A generic, well-intentioned skip-reason like `(none needed — skip-reason: hotfix — deferred to Phase 2 backfill)` does NOT satisfy this rule, even though it reads as equivalent in spirit — the validator checks for the literal phrase pattern and one of the four allowed words, not just "does this section explain why there's no test."

Discovered authoring the `planner-hotfix-mode` workflow's embedded template: Ship/Close phases (which legitimately have no tests) need `(no tests flip at this phase — reason: infra)`, not a bespoke skip-reason — `infra` is the best-fit existing value for "this phase is process/scaffolding, not testable business logic." When designing any new plan-template shape with test-free phases, use this exact phrasing from the start rather than discovering the mismatch at write time.
