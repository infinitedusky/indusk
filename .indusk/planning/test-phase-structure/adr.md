---
title: "Test phases as structure"
date: 2026-08-11
status: proposed
---

# Test phases as structure

## Goal

**Reading an impl, you can see that the tests came first — and the system enforces it.**

Today you cannot. "Write the tests first" is InDusk's central discipline and the only one with no home in the document: it lives as a column value on a trajectory row, and `check-gates` can never enforce the default case, because `row.writableAt === advancingPhase` and `advancingPhase` is never 0. Measured across 52 impls: **260 of 444 rows are `Writable at: Phase 0`, and not one of them is checked.** In `lifecycle-rebalance`, five such rows were authored four phases late and nothing objected. This ADR gives test authoring a phase, so the rule has a moment and the deviation has a register.

## Y-Statement

**In the context of:**
authoring and executing multi-phase impls in a system whose core discipline is that tests are written before the code they test, where every other discipline — verification, context, documentation, falsification, cleanup — is legible as a section with checkboxes.

**Facing:**
the fact that test authoring is expressed only as data (`Writable at: Phase N`) rather than as structure, so the default case is unenforceable by construction, the deviation is the only path with machinery behind it, and a reader must reconstruct from a column whether the discipline was followed at all.

**We decided for:**
a second kind of phase. `### Test Phase N` and `### Build Phase N` form two independent sequences; Test Phase 1 is mandatory and first; every additional test phase requires an explicit justification entry in Test Phase 1, which may carry the deferred test's body; a test phase carries one gate whose close requires those deferrals to have been reviewed; and the `Build ` prefix is optional in the parser so all 52 existing impls keep validating with no edits.

**And against:**
overloading `Phase 0` (already used for late-discovered prerequisite build work in seven impls, plus a `Phase 0.5` — the two meanings would be indistinguishable to readers and parsers alike); leaving test authoring as an attribute and merely widening Gate A's comparison from `===` to `<=` (closes the enforcement hole, leaves the document just as illegible); a mandatory migration of all 52 impls to an explicit `Build Phase` spelling (a cost with no benefit, since those files are correct as written); and giving the test phase the full four-gate set (Context and Document are noise on a phase that changes nothing about how the project works and ships nothing user-facing).

**To achieve:**
a document where the first discipline is visible in the same vocabulary as every other, an enforcement moment for the 59% of rows that currently have none, a single register of every testing decision a plan made, and zero migration cost.

**Accepting:**
that a red which is really a load failure still cannot be detected mechanically — the exit code is identical and distinguishing them would require parsing runner output, which this project refuses on principle; that the compensating control is therefore a human-judgment review rather than a check; that this adds a second phase vocabulary to a system already accused of having too many moving parts; and that `/planner`, `/work`, three parsers and the trajectory guide all change together.

**Because:**
the phase-heading regex already exists in seven places across six files with no single-definition test, so consolidating it is required before any new heading kind can be added safely — and once there is one definition, adding a second kind of phase costs one regex instead of seven, which is what makes the honest structural fix cheaper than the operator patch that would have papered over it.

## Context

Full survey in [research.md](research.md); direction in [brief.md](brief.md); the 16 assertions this decision is constrained by in [test-plan.md](test-plan.md).

The design was settled in conversation on 2026-08-11. The research measured what it must survive:

- **59% of rows are unenforceable.** 260 of 444 are `Writable at: Phase 0`; Gate A's exact match cannot fire on them.
- **`Phase 0` is taken.** Seven impls use it for prerequisite build work discovered late — six of the eight uses are not test authoring.
- **The fan-out is worse than the gate vocabulary's.** Seven copies of the phase-heading pattern across six files. The `lifecycle-rebalance` ADR rejected a new gate type over four such sites.
- **There is already a hand-written gate item that wants a home** — *"confirm each fails on its own assertion, not an import error"* appears by convention in Verification blocks.

## Decision

### 1. Two phase kinds, two sequences

`### Test Phase N` authors tests. `### Build Phase N` builds. They number independently. Test Phase 1 is the first phase in every new impl.

`Phase 0` remains legal for prerequisite build work — it is a build phase, and the test phase does not compete for the name.

### 2. Test Phase 1 is the register

It authors every test that can honestly be authored, and it records every test that cannot, with a reason. Any `### Test Phase N` where N > 1 requires a matching entry in Test Phase 1 — validated structurally, not by prose inspection.

**Deferring means deferring.** A test whose file cannot load has not been authored; it is an absent test wearing a failure's clothes. The justification exists so the honest answer is a first-class outcome rather than something to work around.

### 3. A deferral may carry its test

The entry may include the deferred test's body as a code block. This makes the justification checkable by a reader rather than a promise, moves the thinking into the phase built for it, and reduces the later test phase's job to *"uncomment it and confirm it now fails on its own assertion."*

### 4. The test phase has one gate, and its close is a review

Verification only. Build phases keep Verification / Context / Document. This is a second phase **kind** with its own declared gate set — not an exemption from the all-or-none rule, which is about every check having a home, not about every phase carrying every gate.

**Test Phase 1 cannot close until its deferred test bodies have been reviewed** against two questions: will this compile at the phase it names, and does it assert the behavior it claims? This is the compensating control for U1, it is a human-judgment checkpoint before any build phase opens, and it is a pause point under autopilot. Its evidence is durable — the code block stays in the impl, unlike runner output.

### 5. Backward compatibility by optional prefix

```js
/^###\s+(?:Build\s+)?Phase\s+(\d+)/
```

`### Phase 1` and `### Build Phase 1` both mean build phase 1. **No existing impl changes.** A4 asserts this against the real corpus rather than a fixture.

### 6. One definition of the phase heading, first

The consolidation is the first build phase, pinned by a structural single-definition test. Adding a heading kind to seven copies is how this plan fails.

### 7. Gate A corrected

Authoring is enforced against test phases, and a row whose authoring phase has passed while still unwritten is caught when any later phase closes — not only at the phase it was due.

### 8. `Trajectory Rationale` absorbed

Deferral justification lives in Test Phase 1. The legacy section is still parsed so existing impls validate, but new impls do not author it. Two homes for one fact is the failure this codebase has three lessons about.

## Alternatives Considered

### Widen Gate A's comparison from `===` to `<=`
Rejected as insufficient, though it will be adopted as part of §7. It closes the enforcement hole for one line of code and leaves the document exactly as illegible — you still cannot read an impl and see that tests came first. It treats the symptom the measurement found, not the reason the measurement was possible.

### Reuse `Phase 0` for test authoring
Rejected on evidence. Seven impls use it for late-discovered prerequisite build work; only one of eight uses is test-shaped. Overloading it makes the two indistinguishable to readers and to parsers, and this codebase already has a lesson about labels reusing existing vocabulary.

### Migrate all 52 impls to `### Build Phase N`
Rejected. The optional prefix achieves the same end state for new work at zero cost, and the existing files are correct as written. Archived impls are read-only history; rewriting them would be editing the record.

### Give the test phase all four gates
Rejected. An authoring phase changes nothing about how the project works and ships nothing user-facing, so Context and Document would be filled with `(none needed)` — which is precisely the noise that erodes gates into ceremony.

### Detect fake reds by classifying runner output
Rejected on principle, and the principle is load-bearing. Parsing vitest's output to distinguish `AssertionError` from `Cannot find module` puts runner-specific knowledge in core, then jest's, then pytest's. It is exactly what `atdawn verify` refused in order to stay runner-agnostic. The right home for that capability is an extension exposing failure classification — a different plan.

## Consequences

### Positive
- The first discipline becomes visible in the same vocabulary as every other.
- 260 previously-unenforceable rows gain an enforcement moment.
- Every testing decision a plan made lives in one place, readable end to end.
- Deferrals become checkable artifacts rather than promises.
- The phase heading gets one definition, removing a six-file fan-out nobody had noticed.
- Zero migration; all existing impls stay correct.

### Negative
- A second phase vocabulary in a system already carrying a lot of structure.
- `/planner`, `/work`, three parsers, the validator and the guide all move together.
- The U1 control is a human review, not a check — it can be waved through.
- Test Phase 1 becomes a place where a plan can stall on judgment.

### Risks
- **The optional prefix fails against the validator.** Mitigation: A4 runs over all 52 real impls and is the plan's declared stop condition — if it cannot pass, reconsider rather than begin migrating.
- **`.skip()` turns out to survive an unresolvable import**, invalidating the deferral shape and the `/work` guidance correction. Mitigation: A15 asserts it against the real runner rather than reasoning about it.
- **The review gate becomes a rubber stamp.** Mitigation: the artifact is durable and re-readable, so a waved-through deferral is visible later — unlike an attestation about vanished output. This is the same failure class as fabricated conversation proof, and the same limit applies: structure can require the field, not the honesty.
- **Two phase kinds confuse the thin lane's loop.** Mitigation: A10 and A11 assert both-lane behavior explicitly rather than assuming the shared gate scripts cover it.

## Documentation Plan

### Pages
- **Update**: `guide/test-trajectory.md` — the test phase, the register, the deferral shape, and the real-red/fake-red distinction with the boundary rule.
- **Update**: `reference/skills/work.md` — the per-phase order gains a test phase; correct the `.skip()` advice.
- **Update**: `reference/skills/plan.md` — `/planner` authors Test Phase 1.
- **New**: `decisions/test-phase-structure.md` — this ADR at close.

### Diagrams
- The two sequences and where a deferral travels — Test Phase 1 entry → later test phase → build phase that turns it green. In `guide/test-trajectory.md`, Mermaid.

### Changelog
- "Test authoring is a phase. `### Test Phase N` alongside `### Build Phase N`, with deferrals justified in Test Phase 1 and existing impls unchanged."

### ADR in Docs
- Yes — `decisions/test-phase-structure.md`, beside the lifecycle decisions.

## References
- [research.md](research.md) — the 444-row census, the `Phase 0` survey, the fan-out count
- [brief.md](brief.md) — the seven rules
- [test-plan.md](test-plan.md) — 16 assertions, U1's control
- `.indusk/planning/archive/lifecycle-rebalance/` — the gate-vocabulary precedent, and T13–T17 as the observed drift
- `apps/indusk-mcp/hooks/check-gates.js:327` — Gate A's exact match
