---
title: "Proposal: Tests-First as the Default Shape of IMPL Documents"
date: 2026-04-16
target: indusk/plan skill + impl.md template
portable-to: the InDusk codebase (indusk-mcp package, plan skill definition)
---

# Proposal: Tests-First as the Default Shape of IMPL Documents

## One-Line Summary

Make "write the test the moment its subject-under-test has a runnable surface" the default shape of impl phases — so each phase's Verification step is trivially "the named tests pass" rather than a checkbox that can be deferred or faked.

## The Problem This Solves

Observed across two consecutive plans in a real codebase (numero — `room-state-persistence` and `chain-of-custody-2`):

- `room-state-persistence` retrospective: "Write the restart-recovery test first, not last. The most valuable test was deferred to the end and then not completed."
- `chain-of-custody-2` retrospective: "~1/3 of verification items closed via 'can I defer? yes.' Phase 6's own verification deferred to manual testing. Typechecker was green but no automated run ever executed the flow end-to-end."

Lesson captured: [gate-policy-ask-leads-to-universal-deferral](../../.claude/lessons/gate-policy-ask-leads-to-universal-deferral.md)

The lesson describes the failure but doesn't prevent it. The lesson lives in agent context; the impl document's `gate_policy: ask` actively licenses the deferral. Fixing this requires reshaping the impl template itself — the artifact the agent executes against — not just adding rules to the agent's prompt.

## The Proposed Shape

Each phase of an impl document gains a **Tests** subsection at the TOP of the phase checklist (above the implementation items), not after. The convention:

1. **If the phase produces behavior that can be tested,** the Tests subsection names the specific test files or test cases that validate it. These tests are **written first** within the phase — failing when the phase begins, passing when the phase ends.
2. **If the phase is a pure schema/migration/delete,** the Tests subsection explicitly says `(none — schema only)` or `(none — delete only)`. This makes the absence a deliberate declaration, not a forgotten step.
3. **The Verification subsection becomes trivial** in most cases: "`pnpm test:foo` — these named tests pass." No more "manual check later" items.

Tests upfront only work when the test can **execute against something real** — the current code, a stable interface, the fresh infra from a prior phase, the fault-injection flag in a harness skeleton. When the subject-under-test doesn't exist yet, the test shell (with `.skip()` and a documented unlock phase) is written upfront and the assertions get filled in at the phase that enables them.

## Concrete Before/After

### BEFORE (current shape)

```markdown
### Phase 3: Reconciler Skeleton — Fold + Compare

**Goal:** A reconciler module that ...

- [ ] New module `apps/game-server/src/shared/reconciler/`
- [ ] Fold formula (in fold.ts)
- [ ] Pool read endpoint on admin-server
- [ ] Invariant check returns pool, derived, delta

#### Phase 3 Verification
- [ ] Unit test: hand-built event sequence → expected derived map
- [ ] Integration test against running Ponder
```

Failure mode: "Verification" is a promise to write tests LATER. When time pressure hits, the items close with "deferred to Phase N" or "typecheck passes." Nothing stops this.

### AFTER (tests-first shape)

```markdown
### Phase 3: Reconciler Skeleton — Fold + Compare

**Goal:** A reconciler module that ...

**Tests (fill in before code):**
- `apps/game-server/src/__tests__/reconciler-fold.test.ts` — hand-built event sequence → expected derived map. Covers: deposit-only, deposit+withdraw, multi-player.
- `scripts/test-harness/chaos/chaos-6-stale-room-players.ts` — unlocked by this phase. Seed a stale row, assert `checkInvariant` reports the delta.

These tests are committed as failing at the start of the phase. The phase ends when they pass. No other Verification gate is needed.

#### Implementation
- [ ] New module `apps/game-server/src/shared/reconciler/`
- [ ] Fold formula (in fold.ts)
- [ ] Pool read endpoint on admin-server
- [ ] Invariant check returns pool, derived, delta

#### Phase 3 Verification
- [ ] `pnpm test:harness:reconciler` — both named tests pass.
```

The implementer cannot "defer" the test. It already exists. Making it pass is the phase.

## Why This Is Stronger Than the Existing `gate_policy: strict`

`strict` enforces that gate sections can't be pre-filled with `(none needed)`. It doesn't enforce that the gate is a real runnable check. A `strict` phase can still close with "typecheck passes + manual grep" and satisfy the letter of the policy while missing the spirit.

Tests-first makes the gate mechanically impossible to fake: the test either runs and passes, or it doesn't. There is no third state.

## When Tests-First Does NOT Apply

| Phase type | Tests subsection says |
|---|---|
| Schema migration only | `(none — schema only; verification is `\d tablename` shows the expected columns)` |
| Delete legacy code | `(none — regression check is full suite still passes after delete; grep confirms zero references)` |
| Infra setup (deploy, DB wipe) | `(none — smoke test replaces unit tests for operational phases)` |
| Pure refactor, no behavior change | `(none — full suite still passes proves behavior unchanged)` |

The `(none — reason)` form is required, not optional. Empty or missing Tests subsection fails the impl-structure validator.

## Proposed Edits to the InDusk Plan Skill

Two surgical edits to the plan skill's `SKILL.md`:

### Edit 1: Add to "What to Do When Asked to Plan" step 6

**Current:**
> 6. **If ADR is accepted** (or brief is accepted for bugfix/refactor), write the impl. Break into phased checklists with concrete tasks. For refactor workflows, include a `## Boundary Map` section. For multi-phase impls of any type, consider adding a boundary map.
>
>    **Gate policy applies when writing impls.** ...

**Proposed addition (after the Gate policy paragraph):**

```
**Tests first within each phase.** For phases that produce behavior, start the phase
checklist with a **Tests** subsection naming the specific test files or cases that
validate the phase. Those tests must be writable before the implementation — either
because the subject-under-test already exists in some form, or because a harness
skeleton from an earlier phase unlocks them. Tests are committed as failing at the
start of the phase; the phase ends when they pass.

For phases that don't produce testable behavior (schema migration, delete, pure
refactor, infra setup), the Tests subsection must explicitly state `(none — reason)`.
An empty or missing Tests subsection is a validation failure.

When a plan has a chaos / integration harness, add Phase 0.5 (between Phase 0 and
Phase 1) that builds the harness skeleton and commits test stubs with `.skip()`
markers documenting which phase unlocks each test. Subsequent phases fill them in.
This makes progress visible as test count changes from `N skipped` to `N passing`.
```

### Edit 2: Update the impl.md template

**Current template (abbreviated):**
```markdown
## Checklist
### Phase 1: {Name}
- [ ] {Task — include code snippets when syntax matters}

#### Phase 1 OTel
#### Phase 1 Verification
#### Phase 1 Context
#### Phase 1 Document
```

**Proposed template:**
```markdown
## Checklist
### Phase 1: {Name}

**Goal:** {One sentence — what this phase produces.}

**Tests (fill in before code):**
{Either:}
- `{test file path}` — {what it asserts}
- `{test file path}` — {what it asserts}

{Or, if the phase produces no testable behavior:}
(none — {schema only | delete only | refactor with no behavior change | infra operation})

{Tests in this section are committed as failing at the start of the phase.
The phase ends when they pass. If a test can't be written yet because its
subject-under-test doesn't exist, write the shell with .skip() and document
which phase will unlock it.}

#### Implementation
- [ ] {Task — include code snippets when syntax matters}
  ```typescript
  // Example: function signature that must match this shape
  function withdrawFor(wallet: address, player: address, amount: uint256, historyHash: bytes32)
  ```

#### Phase 1 OTel
- [ ] {Instrumentation check ...}

#### Phase 1 Verification
- [ ] {For phases with Tests: "`pnpm test:foo` — named tests pass."
      For phases with (none): "full suite + smoke check."}

#### Phase 1 Context
- [ ] {Concrete CLAUDE.md edit ...}

#### Phase 1 Document
- [ ] {Docs page to write or update ...}
```

### Edit 3: Add to the impl-structure validator hook

The `validate-impl-structure` hook (referenced in the plan skill) should enforce:

1. Every phase checklist starts with a `**Tests (fill in before code):**` block.
2. The Tests block contains EITHER at least one test file reference OR `(none — {reason})`.
3. If the Tests block lists test files, the Verification block should reference at least one of them. This catches "I wrote tests but don't actually run them in verification."

The validator's existing gate-policy enforcement stays unchanged — this is additive.

## Effect on the Existing Plan Skill's Templates

The template edit is additive (new subsection per phase). Existing impl documents remain valid — the validator flags missing Tests blocks as warnings on old files, errors on new ones. A migration period is trivial: old plans finish on the old shape, new plans start on the new one.

No changes needed to:
- The research.md template
- The brief.md template
- The adr.md template
- The retrospective.md template (the Quality Ratchet + Metrics sections already capture test-count deltas well)

## Rollout

1. Land the SKILL.md + template edits in the indusk-mcp package.
2. Update the impl-structure validator hook.
3. Refresh the `/plan` and `/work` skill prompts to name the convention explicitly.
4. Run one real plan under the new shape (the numero codebase's `bulletproof-state` plan is already using this pattern as a dogfood — reference it as the worked example).
5. Add a lesson: "Tests-first within each phase" — the positive counterpart to `gate-policy-ask-leads-to-universal-deferral`.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Authors skip the Tests block by writing `(none)` without a real reason. | The `(none — {reason})` form requires a reason; the validator can require the reason text matches one of a known set (schema-only, delete-only, refactor, infra) OR be blocked. |
| Tests written too early calcify a bad implementation design. | Tests describe behavior, not implementation. If a test is asserting implementation details (internal call shapes, private method signatures), it's the wrong test — feedback for the reviewer, not a reason to abandon the pattern. |
| Phase 0.5 pattern adds friction for small plans. | Phase 0.5 is optional — only when the plan has an integration/chaos harness. Bugfix and small feature plans with unit-tested behavior don't need it. |
| The "tests unlock per phase" map becomes stale if phases reorder. | Validator checks that every scenario file referenced in an unlock map is `.skip()` at the start and has no `.skip()` at the end. If a reorder moves a scenario, the map must be updated too — caught at write time. |

## Summary

Two surgical edits to the plan skill's SKILL.md plus a validator rule. Makes the "tests first" convention structural rather than aspirational. Directly addresses the failure mode documented in the numero retrospectives, and — critically — the failure mode is prevented by the artifact (impl doc) rather than by hoping the agent remembers the lesson.

The change is opt-in for existing plans, enforced for new ones.

## Reference Implementation

The numero codebase's `bulletproof-state` impl demonstrates the shape in practice:

- `bulletproof-state/impl.md` Phase 0.5 = harness + test skeletons upfront
- `bulletproof-state/impl.md` Phases 3, 4, 5, 6 = each opens with a **Tests unlocked (fill in before code):** subsection
- `bulletproof-state/impl.md` Phase 8 = what used to be "build the harness" is now "CI wiring + final check" because tests landed progressively through Phases 3-6

Copy that shape wholesale for the template.
