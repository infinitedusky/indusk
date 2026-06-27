---
title: "Documentation as a final gated phase — Test Plan"
date: 2026-06-25
status: accepted
---

# Documentation as a final gated phase — Test Plan

## Purpose

The behavioral assertions that mean the gating model has moved correctly: docs are
no longer gated per-phase, a final Documentation phase is required, and the
retrospective won't run until it's complete. "Behavioral" here = what a **plan
author** observes when writing an impl and trying to close a plan.

## Behavioral Assertions

| ID | Assertion (what the plan author observes) | Mechanism |
|----|-------------------------------------------|-----------|
| A1 | Writing a feature impl that has per-phase Context but **no** per-phase Document sections — and a final `Documentation` phase — is **accepted** (no "missing Document" error). | vitest (subprocess hook invocation) |
| A2 | Writing a feature impl with **no Documentation phase at all** is **rejected**, with a message that a final Documentation phase is required. | vitest (subprocess hook) |
| A3 | An existing impl that still has per-phase Document sections **continues to validate** (no new error) — in-flight plans don't break. | vitest (subprocess hook) |
| A4 | A plan whose final Documentation phase has unchecked items reports as **documentation-incomplete**; once every item is checked, it reports **complete**. | vitest unit (the `isDocumentationComplete` helper) |
| A5 | Running `/retrospective` on a plan whose Documentation phase is **incomplete is refused** with a clear message; a **complete** one proceeds. | manual / integration (retro skill Step 0 + helper, mirroring the falsification gate) |
| A6 | An impl freshly authored by the planner contains a final `Documentation` phase and **no** per-phase `#### Phase N Document` sections. | vitest (assert the planner template's emitted shape) |
| A7 | A non-doc-producing workflow (bugfix/refactor, or a plan that declares no docs) can satisfy the Documentation requirement with a single documented opt-out, without a full phase. | vitest (subprocess hook) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The retrospective agent actually *stops* when docs are incomplete (vs the helper merely returning false). | The retro gate is skill-instruction-driven (markdown), like the falsification gate — agent behavior, not a hook. | A5's integration test asserts the skill contains the Step 0 doc-gate section + calls the helper (same pattern the falsification integration test uses); the helper itself (A4) is unit-tested. |

## Notes

- A1–A3, A7 exercise `validate-impl-structure.js` via subprocess (the established
  pattern for the JS hook ports) — and the TS `impl-parser.ts` mirror must agree.
- A4 is the new `isDocumentationComplete(planRoot)` helper, parallel to
  `isFalsificationComplete`.
- **Open question for the ADR (drives A7):** is the final Documentation phase
  *always* required, or role-aware / opt-out-able for docs-less plans (like the
  OTel gate keys off `otel.role`)? A7 assumes an opt-out path exists.
- Grandfathering (A3) is load-bearing — the validator gates *every* plan, so the
  change must be strictly additive for existing per-phase-Document impls.
