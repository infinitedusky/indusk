---
title: "Documentation as a final gated phase (not per-phase)"
date: 2026-06-25
status: accepted
---

# Documentation as a final gated phase — Brief

## Problem

InDusk gates documentation **per phase**: every impl phase requires a
`#### Phase N Document` section, enforced by `validate-impl-structure.js`. This is
premature by construction — a plan's user-facing shape evolves across phases, so
docs written at Phase 1 are stale by Phase 5. In practice the per-phase Document
gate gets skipped or filled with low-value items, and the real docs get rewritten
wholesale at the end anyway.

The `doppler-extension` plan was the proof: its shape kept changing across the
session (config-driven → `path` targets → token-optional auth → `post_create`),
and the skill + reference docs had to be **rewritten against the final shape** at
the end. Per-phase doc gating produced churn, not documentation.

## Proposed Direction

Split the two currently-per-phase gates by their actual nature:

- **Context** (CLAUDE.md / project memory) — **stays per-phase**. It's internal,
  written fresh, and *consumed by the next phase/agent*. Genuinely phase-local.
- **Document** (docs-site pages, skill updates, changelog) — **moves to a single
  mandatory final `Documentation` phase**, gated **before `/retrospective`**.

The retrospective skill's Step 0 refuses to run until the Documentation phase is
complete — the same hard-gate pattern the **falsification ritual** already uses
(retro blocks without a completed falsification). One hard doc gate at close beats
many soft per-phase gates that get skipped: **deferral ≠ skipped** — docs become
the last required thing before the plan can archive.

## Context

- Current gates: per-phase Verification / Context / Document (+ optional OTel),
  enforced by `validate-impl-structure.js` (structure) + `check-gates.js`
  (transitions); the retrospective skill audits docs at close.
- The falsification ritual already establishes the "hard gate before
  retrospective" precedent — the Documentation gate mirrors it exactly.
- Lived evidence (doppler-extension, this session): Context was updated
  incrementally and stayed accurate; Document was rewritten once at the end. The
  per-phase Document gate would have churned.

## Scope

### In Scope
- **Planner template**: stop emitting per-phase `#### Phase N Document`; keep
  per-phase `Context`; emit a standard closing `### Phase N: Documentation` phase.
- **`validate-impl-structure.js`** (+ `check-gates.js` + JS hook ports): stop
  requiring per-phase Document; require the final Documentation phase for
  doc-producing workflows.
- **Retrospective skill Step 0**: hard-gate on the Documentation phase being
  complete (mirror the falsification gate's refuse-to-proceed logic).
- **Grandfathering**: existing impls with per-phase Document sections must still
  validate (don't break in-flight plans).

### Out of Scope
- The **Context** gate (stays per-phase, unchanged).
- Verification / OTel gating (unchanged).
- The document skill's content guidance (Mermaid, what-to-document) — unchanged,
  just relocated to the final phase.

## Success Criteria
- A new feature impl has per-phase Context but **no** per-phase Document, plus a
  final `Documentation` phase.
- `/retrospective` refuses to run until the Documentation phase's items are checked.
- Existing impls with per-phase Document sections still validate (grandfathered).
- "Write the docs against the final shape, once" becomes the default workflow.

## Depends On
- (none)

## Blocks
- (none)

## Notes
- **ADR open question**: is the final Documentation phase *always* required, or
  skippable for docs-less plans (the way the OTel gate is role-aware via
  `otel.role`)? Lean: required for any plan whose ADR has a Documentation Plan;
  `(none needed)` + reason for genuinely docs-less plans (bugfix/refactor).
- Companion to the falsification gate — together they bracket plan close:
  **falsify** (find what's broken) → **document** (write the final shape) →
  **retrospective** (audit + archive).
