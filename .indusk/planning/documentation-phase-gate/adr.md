---
title: "Documentation as a final gated phase, not per-phase"
date: 2026-06-25
status: proposed
---

# Documentation as a final gated phase, not per-phase

## Goal

**Move user-facing documentation from a per-phase gate to a single mandatory final
Documentation phase, gated before `/retrospective`.**

Today every impl phase must carry a `#### Phase N Document` section. Because a
plan's user-facing shape evolves across phases, those per-phase docs go stale and
get rewritten wholesale at the end — so the gate produces churn, skipped sections,
and fluff, not documentation. After this ships, docs are written once against the
*final* shape and are the last required thing before a plan can close.

## Y-Statement

**In the context of:**
InDusk plans that ship user-facing surface (features, refactors), where the impl
template gates documentation per phase and `validate-impl-structure.js` requires a
`#### Phase N Document` section on every phase.

**Facing:**
Per-phase documentation is premature by construction — a plan's shape changes
across phases (the `doppler-extension` plan's skill + reference were rewritten
wholesale at the end after config-driven / `path` / token-optional / `post_create`
landed), so the per-phase Document gate gets skipped or filled with low-value items
while the real docs are written once at the close anyway.

**We decided for:**
Drop the per-phase `Document` gate; keep `Context` per-phase; add a **mandatory
final `Documentation` phase** to the impl, **required with a documented opt-out**
(a single `skip-reason:` line for genuinely docs-less plans, the same shape the
existing gate opt-outs use). Gate `/retrospective` on that phase being complete via
a new `isDocumentationComplete(planRoot)` helper, mirroring `isFalsificationComplete`.

**And against:**
Keeping per-phase docs (the churn we're removing); a role-aware skip keyed off
config like the OTel gate (more moving parts than a documented opt-out); and
always-required-no-opt-out (forces a docs decision onto trivial plans).

**To achieve:**
Documentation written once against the shipped shape; a single hard gate at close
that's stronger than many soft per-phase gates (deferral ≠ skipped — docs become
the last required thing before archive); and `falsify → document → retrospective`
as a coherent three-gate close-out.

**Accepting:**
Docs are no longer captured incrementally while freshest (mitigated: `Context`
stays per-phase — the internal memory that *is* phase-local is unchanged); and the
retro gate is skill-instruction-enforced (markdown + helper), not a hard hook —
same enforcement model the falsification gate already relies on.

**Because:**
Documentation describes the *shipped* artifact, so it belongs after the artifact
settles; Context describes *in-progress* internal state, so it belongs per-phase.
Splitting the two by that nature removes a whole class of doc churn, and the
falsification gate already proves the "hard gate before retrospective" pattern works.

## Context

- `validate-impl-structure.js` requires `Verification` / `Context` / `Document`
  (+ conditional OTel) per phase; `impl-parser.ts` is its TS mirror; `check-gates.js`
  blocks phase transitions on incomplete gates.
- The falsification ritual already gates `/retrospective` via
  `isFalsificationComplete(planRoot)` + `isFalsificationSkipped(implContent)` — the
  exact pattern this mirrors for docs.
- Lived evidence: `doppler-extension`, this session (per-phase Context stayed
  accurate; Document was rewritten once at the end).

## Decision

1. **`validate-impl-structure.js` + `impl-parser.ts`**: stop requiring a per-phase
   `Document` section; require the impl to contain a final `### Phase N: Documentation`
   phase (for impl-shipping workflows) OR a documented opt-out (`skip-reason:`).
2. **planner `SKILL.md` template**: remove the per-phase `#### Phase N Document`
   block; keep `#### Phase N Context`; emit a standard closing
   `### Phase N: Documentation` phase with its own checklist items.
3. **New helper** `isDocumentationComplete(planRoot)` (parallel to
   `isFalsificationComplete`): true when the impl's Documentation phase items are all
   checked, or a documented opt-out is present.
4. **retrospective `SKILL.md` Step 0**: refuse to proceed unless
   `isDocumentationComplete(planRoot)` — same shape as the falsification gate.
5. **Grandfather**: impls that still carry per-phase `Document` sections continue to
   validate (the change is strictly additive — never errors on an *extra* Document).

## Alternatives Considered

### Keep per-phase Document
Rejected: the churn we're removing. Premature docs go stale; the gate gets skipped.

### Role-aware skip (key off config like `otel.role`)
Rejected: more config + moving parts than needed. A documented `skip-reason:` opt-out
is simpler and matches the existing gate-opt-out shape.

### Always required, no opt-out
Rejected: forces a docs decision onto trivial/internal plans (bugfix/refactor) that
genuinely produce nothing user-facing.

## Consequences

### Positive
- Docs describe the final shape; no per-phase churn.
- One hard gate at close > many soft per-phase gates that get skipped.
- `Context` (internal memory) and `Document` (user-facing) split by their real nature.
- Coherent close-out: `falsify → document → retrospective`.

### Negative
- Docs no longer captured incrementally (mitigated: Context stays per-phase).
- The Documentation phase, like falsification, is skill-enforced, not hook-enforced.

### Risks
- **The validator gates every plan** — a bug breaks all planning. Mitigation: the
  change is strictly additive (grandfather existing Document sections), and A1–A3/A7
  test accept/reject + non-breakage directly via subprocess hook invocation.
- **Chicken-and-egg**: this impl is authored under the old model but implements the
  new one. It dogfoods the new shape (carries a final Documentation phase) even though
  the validator won't enforce it until this ships.

## Documentation Plan

### Pages
- Update `apps/docs/src/guide/test-trajectory.md` (or the planning/gating guide) with
  the "Context per-phase, Document as a final gated phase" model.
- Update CLAUDE.md Conventions: the gate model + the `falsify → document → retro` close-out.

### Diagrams
- (optional) a small close-out flow: impl phases → Documentation phase → falsify → retrospective.

### Changelog
- "Documentation moved from a per-phase gate to a mandatory final Documentation phase,
  gated before `/retrospective` (with a documented opt-out)."

### ADR in Docs
- Publish to `apps/docs/src/decisions/documentation-phase-gate.md`.

## References
- [Brief](brief.md) · [Test plan](test-plan.md)
- `.indusk/planning/archive/falsification-ritual/adr.md` — the gate pattern this mirrors
- `src/lib/falsification/log.ts` (`isFalsificationComplete`) — the helper precedent
