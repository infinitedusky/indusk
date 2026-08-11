# A gate validator that finds zero phases must reject, not vacuously pass

`validate-impl-structure.js` and `check-gates.js` gate an impl on whether it has *any* checklist items or a `### Phase N` header (`hasPhaseHeader || hasChecklistItem`) before running phase-scoped checks. But the actual phase-parsing loop only recognizes `### Phase N` (level-3). An impl authored with `## Phase N` (level-2) still has checklist items, so the initial gate lets validation proceed — but the phase loop parses zero phases, so every phase-scoped check (Verification headers, trajectory gate requirements, check-gates enforcement) silently never fires. The file passes validation and gating with no real enforcement having happened.

**Why it matters:** this was found live during the `work-autopilot` rollout (dawn-external-orchestrator, 2026-07-27) — an entire Phase 0 ran under autopilot with zero gate enforcement because of this exact mismatch, and nothing flagged it. A validator that can find 0 of the structure it's supposed to check must treat that as a hard failure, not a silent all-clear. This is a distinct failure mode from the existing gotcha about `new_string` triggering full re-validation (that one over-triggers; this one silently under-enforces).

**Fix direction:** any impl with `trajectory: required` (or with checklist items present) that parses to exactly 0 phases should be rejected outright by both `validate-impl-structure.js` and `check-gates.js`, not passed through. Apply to both hook JS ports and the underlying `apps/indusk-mcp/src/lib/trajectory/` TS source per the existing "change TS + every JS port together" rule.

See `.indusk/planning/indusk-v2-dawn/` and `.indusk/current.md` (2026-07-26 handoff) for the incident context.
