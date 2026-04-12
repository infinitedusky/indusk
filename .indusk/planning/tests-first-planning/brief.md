---
title: "Tests-First Planning — Make Testability a First-Class Planning Artifact"
date: 2026-04-16
status: accepted
blocked_by: []
blocks: [agent-roles, graph-knowledge-architecture, hermes-inspired-improvements, mcp-orchestration-layer, complementary-personas, lsp-structural-indexing, context-migration, type-edges]
---

# Tests-First Planning — Brief

## Problem

Verification at the end of each phase is ad-hoc. Items close with "typecheck passes," "manual check later," or "deferred to Phase N," and the "later" frequently never arrives. Across two consecutive numero plans (`room-state-persistence`, `chain-of-custody-2`), roughly a third of verification items never produced a runnable automated check. The most valuable test — restart recovery — was deferred to the end and then not completed at all. Typecheckers were green; no automated run ever executed the flow end-to-end.

This is not a discipline problem. It is a structural problem: the impl document itself licenses deferral. Each phase's Verification section is a loose checklist of "things to confirm" rather than a named contract of tests that must flip from failing to passing. The lesson at [gate-policy-ask-leads-to-universal-deferral](../../../.claude/lessons/gate-policy-ask-leads-to-universal-deferral.md) documents the failure; it does not prevent it.

Separately, the current shape gives developers no mental model for what is testable *now*, what is testable *later*, and what is genuinely not testable within the plan's scope. Each phase is negotiated in isolation, which means test trajectory across the plan is invisible.

## Proposed Direction

Reshape every impl document so testability is a first-class planning artifact. Each impl gains a top-level **Test Trajectory** table that lists every test the plan commits to, with explicit writable-at-phase and passes-at-phase columns. Per-phase Verification sections stop re-describing tests and just reference test IDs that flip this phase.

### The three questions every phase answers

From the top of the impl, for any phase N a reader can instantly see:

1. **What is being tested at this phase** — which test IDs exist, what state they're in, what asserts.
2. **What becomes testable at this phase** — which test IDs have `writable-at-phase: N` (the rule: if a test becomes writable, it gets written in this phase, committed as failing when the test can not yet pass).
3. **What is not testable and why** — either deferred to a later phase (`writable-at-phase: N+k`, with a `blocked by` reason) or declared genuinely untestable within this plan (in a narrow, justified escape hatch).

Expected pass/fail state across phases is visible as a trajectory — the test suite's pass count becomes the progress bar of the plan.

### Shape of the Test Trajectory

A table at the top of every impl doc:

```markdown
## Test Trajectory

| ID | Kind | Scope | What it asserts | Writable at | Passes at | State |
|----|------|-------|-----------------|-------------|-----------|-------|
| T1 | example | unit | `fold(deposit+withdraw)` returns expected derived map | Phase 0 | Phase 3 | planned |
| T2 | property | unit | `fold` idempotent under event replay | Phase 0 | Phase 3 | planned |
| T3 | example | integration | stale room row → `checkInvariant` reports delta | Phase 2 | Phase 5 | planned |
| T4 | approval | e2e | full chaos scenario 6 produces a snapshot we approve | Phase 4 | Phase 6 | planned |

### Deferred Verification

- **Real Gemini API output quality** — reason: we cannot deterministically assert LLM response quality — would require: dedicated eval harness with human-rated outputs; tracked in `graph-knowledge-architecture`.
- **Cross-machine clock skew in sync** — reason: requires multi-host test environment — would require: CI topology with two machines; out of scope for this plan.
```

### Per-phase Verification references test IDs

```markdown
#### Phase 3 Verification
- [ ] T1 passes (`pnpm test:reconciler`)
- [ ] T2 passes (`pnpm test:reconciler`)
```

No more hand-crafted verification items that don't map to a test. If a phase has no tests flipping, it must say so explicitly: `(no tests flip at this phase — reason: schema-only / delete / refactor / infra)`.

### Vocabulary (final naming to be confirmed during ADR)

- **Test Trajectory** for the top-level table — emphasizes cross-phase motion, avoids ISTQB / IEEE 829 baggage of "Test Plan." Alternatives we considered: "Assertion Ledger," "Verification Map." Research recommends avoiding "Test Plan" outright because of industry muscle memory.
- **Deferred Verification** for the escape hatch — plugs into aerospace VCRM lineage, accurately implies "tracked, not abandoned."
- **Writable at** / **Passes at** — explicit decoupling (not named anywhere in mainstream practitioner writing; genuinely novel).
- **Kind** — example / property / contract / approval / formal. Cheap metadata that prevents later arguments.
- **Scope** — unit / integration / e2e. Borrowed from Google's test size/scope taxonomy.
- **State** — planned / writable / written / passing / blocked. Replaces a single "status" column.

### Rule: if it's writable now, write it now

When a phase's `writable-at` tests come up, the phase opens by committing those tests as failing. The phase ends when they pass. "Deferred to a later phase" is only allowed when `writable-at-phase` actually names a later phase *and* the reason is structural (the test's dependencies don't exist yet), not aspirational (we haven't thought about it).

### Deliverables

1. **SKILL.md edits** to `apps/indusk-mcp/skills/planner/SKILL.md` — the planner writes impls with a Test Trajectory block at the top and per-phase Verification that references test IDs.
2. **SKILL.md edits** to `apps/indusk-mcp/skills/work/SKILL.md` — the work skill opens each phase by checking that `writable-at-phase` tests are committed as failing, refuses to advance a phase whose `passes-at-phase: N` tests are not passing.
3. **Impl template update** — the template generated when a new impl is created includes the Test Trajectory skeleton and the Deferred Verification subsection.
4. **`validate-impl-structure` hook extension** — fail write if the impl doc lacks a Test Trajectory section; fail write if any phase's Verification block neither references a test ID nor declares `(no tests flip at this phase — reason: {known-reason})`; fail write if a Deferred Verification row lacks both `reason:` and `would require:`.
5. **Lesson** — add `tests-first-within-each-phase.md` as the positive counterpart to the existing deferral-lesson. Also reference in the research finding.
6. **Documentation** — VitePress page explaining the Test Trajectory shape and the vocabulary, with a worked example.

### Worked-example dogfooding

The **`agent-roles`** plan is drafted but not started. It has 4 phases and produces behavior at every phase. It is the ideal first plan to land under the new shape — its impl gets retrofitted with a Test Trajectory, and Phase 1 executes against the new structure. This gives us real feedback on the shape before the validator goes hot on every impl.

## Context

Origin: Sandy's proposal (`proposal-origin.md` in this plan directory), authored 2026-04-16, born from two consecutive numero retrospectives where verification deferred and was never completed. See `research.md` for the full landscape survey — key insights:

- Kent Beck's "Canon TDD" (2023) calls the test list "the artifact" — red-green-refactor is mechanics. Our Test Trajectory is Beck's test list made durable and shared.
- Gojko Adzic's *Specification by Example* (2011) "key examples" pattern is the closest conceptual ancestor.
- Google's *Software Engineering at Google* gives us size/scope/hermeticity vocabulary to adopt wholesale.
- The `writable-at-phase` / `passes-at-phase` distinction is, per our research, genuinely novel — it does not appear as a named pattern in mainstream practitioner writing. That's our synthesis.
- "Test Plan" as a label is contaminated by IEEE 829 / ISTQB baggage — we're using "Test Trajectory" instead to signal a different tradition.

This plan is foundational. It reshapes the artifact every subsequent plan executes against. Every plan currently in `brief/draft` or `brief/accepted` status is in scope to use the new shape once this lands.

## Scope

### In Scope

- Planner skill edits (impl template shape, vocabulary)
- Work skill edits (enforcement of per-phase test flipping)
- Impl-structure validator hook extensions
- VitePress documentation page
- New community lesson
- One retrofit of `agent-roles/impl.md` to the new shape as the dogfood example
- CLAUDE.md context update (conventions section)

### Out of Scope

- New test runners or test frameworks — we use whatever the project already has (Vitest in dusk/numero)
- Test execution infrastructure changes — verify skill continues to run tests the same way
- Retrofitting *existing* in-progress impls beyond `agent-roles`
- Formal adoption of Gherkin / Given-When-Then — we reference Adzic's "specification by example" spirit but don't prescribe syntax
- A test-matrix UI or dashboard (the impl doc IS the artifact; no separate tool)
- Automated test generation from the trajectory table

## Success Criteria

- Every new impl doc created by the planner skill has a Test Trajectory section at the top.
- The validator hook rejects impls that lack Test Trajectory or have Verification blocks that don't reference test IDs or declare the `(no tests flip this phase — reason)` form.
- `agent-roles` impl is retrofitted and executes Phase 1 under the new shape without friction.
- In a retrospective after `agent-roles` ships, verification-item deferral rate is zero (every phase's named tests passed when the phase closed) OR every deferral traces to a `Deferred Verification` row with a real `would require`.
- A developer can answer "what tests will pass by the end of Phase 3?" by reading one table, not by scanning the whole impl.
- Documentation page is published and referenced from the planner skill.

## Depends On

- Nothing. This is foundational and unblocks agent-roles and every downstream plan.

## Blocks

- `agent-roles` — will be retrofitted and is the first plan to dogfood the new shape
- `graph-knowledge-architecture`, `hermes-inspired-improvements`, `mcp-orchestration-layer`, `complementary-personas`, `lsp-structural-indexing`, `context-migration`, `type-edges` — all benefit from the new shape and should wait

## Open Questions (for ADR)

1. **Final naming** — "Test Trajectory" is the strongest candidate but not locked. Runner-up: "Assertion Ledger." Sandy to decide at ADR time.
2. **Hermeticity as a column** — Google's `size` (small/medium/large) is a real column's worth of information. Do we adopt it verbatim, or keep `scope` (unit/integration/e2e) as a simpler proxy? Research prefers both; pragmatism might pick one.
3. **How much vocabulary to expose in the template vs. in docs** — does the template include `kind` and `scope` columns by default, or only `writable-at` / `passes-at` / `state` / `asserts`? Minimalism argues for fewer columns; completeness argues for all of them.
4. **Retroactive application** — do we require existing *accepted* impls (e.g., `react-native-support`) to adopt the new shape, or grandfather them? Proposed: grandfather accepted/approved impls; require new and drafted.
5. **Lesson phrasing** — the new lesson should be actionable: "at the start of every phase, commit writable-at-phase tests as failing, and only close the phase when passes-at-phase tests pass." Sandy to refine.
