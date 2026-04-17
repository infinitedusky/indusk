# Test Trajectory

The Test Trajectory is the canonical shape for the testing contract inside every InDusk impl document. It's a single table at the top of `impl.md` that lists every test the plan commits to, with explicit phase-by-phase `Writable at` and `Passes at` columns. Phase Verification sections reference test IDs from this table rather than restating the checks in prose.

This guide covers what the Trajectory is, how to author one, the rules the validator enforces, how untestable items are declared, and the anti-patterns to avoid.

## Why this exists

Across two consecutive plans in a real codebase (`room-state-persistence`, `chain-of-custody-2` in numero), roughly a third of verification items closed without any runnable automated check. Items deferred to "manual check later" or "typecheck passes" and were then forgotten. The most valuable test — restart recovery — was deferred to the end and never completed.

This was not a discipline problem. The old Verification gate was a loose checklist of informal statements that the implementer could satisfy without running anything. The Test Trajectory reshapes the artifact structurally: Verification items must reference named tests from a table, and the `check-gates` hook rejects phase advancement when those tests aren't passing.

The shape draws on:

- **Kent Beck's "Canon TDD" (2023)** — the test list is the artifact; red-green-refactor is mechanics
- **Gojko Adzic's *Specification by Example* (2011)** — "key examples" as a curated, minimal set that defines behavior
- **Google's *Software Engineering at Google* (2020)** — test size/scope/hermeticity vocabulary
- **Aerospace Verification Cross-Reference Matrix** — every requirement gets a verification method + phase, or an explicit deferral with justification

The `Writable at` vs `Passes at` distinction — making it explicit that a test can be authored at one phase and only flip to passing at a later phase — does not appear as a named pattern in mainstream practitioner writing. That's our synthesis.

## The shape

Every impl document that opts in (via `trajectory: required` in the frontmatter) has a `## Test Trajectory` section positioned after `## Boundary Map` and before `## Checklist`.

```markdown
## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `fold(deposit+withdraw)` returns expected derived map | Phase 1 | Phase 1 | planned |
| T2 | stale room row → `checkInvariant` reports delta | Phase 2 | Phase 3 | planned |
| T3 | full chaos scenario 6 produces an approved snapshot | Phase 4 | Phase 5 | planned |

### Deferred Verification

- **End-to-end Stripe production behavior**
  - reason: we cannot hit live Stripe in CI without cost
  - would require: Stripe test account with budget approval
  - mitigation: staging smoke run before each release; recorded fixtures replayed daily in CI
```

### Required columns

| Column | Purpose |
|--------|---------|
| `ID` | Stable handle — `T1`, `T2`, … Used by phase Verification references |
| `Asserts` | One-sentence description of what the test claims is true |
| `Writable at` | Phase number at which the test can be authored (dependencies exist) |
| `Passes at` | Phase number at which the test flips to passing |
| `State` | `planned`, `writable`, `written`, `passing`, `skipped`, or `blocked` |

### Optional columns

Add when the plan benefits from the extra dimension; the template does not include them by default:

| Column | Values | When to add |
|--------|--------|-------------|
| `Kind` | `example`, `property`, `contract`, `approval`, `formal` | The plan mixes kinds and the distinction matters |
| `Scope` | `unit`, `integration`, `e2e` | Phase cost/runtime varies meaningfully by scope |

## Authoring a Trajectory

When writing an impl (the planner skill does this automatically), walk the accepted ADR's Decision section and ask: "what would prove this decision works?" For each answer, add a row with specific `Asserts` text, phase placement, and initial state `planned`.

Sizing:

- **3–5 rows** for a bugfix or small feature
- **10–25 rows** for a multi-phase infrastructure plan
- **More rows than lines of new code** — over-specified; consolidate
- **Fewer than one row per phase** — likely untested phases; add rows or explicitly declare `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})`

Prefer one property test over five example tests when the same invariant applies to many inputs.

## Phase Verification references test IDs

Rather than restating the checks in prose, each phase's Verification block lists the test IDs whose `Passes at` equals that phase:

```markdown
#### Phase 3 Verification
- [ ] T1 passes (`pnpm turbo test --filter=reconciler`)
- [ ] T2 passes (`pnpm turbo test --filter=reconciler`)
```

If a phase has no tests flipping at it, declare so explicitly — NOT silently:

```markdown
#### Phase 2 Verification
- [ ] (no tests flip at this phase — reason: schema-only)
```

The allowed reasons are: `schema-only`, `delete`, `refactor`, `infra`. Any other reason fails the validator.

## The four validator rules

The `validate-impl-structure.js` hook enforces four rules when the impl has a Test Trajectory section or `trajectory: required` in frontmatter:

1. **Trajectory presence** — the `## Test Trajectory` section must exist.
2. **Cross-reference integrity** — every test ID referenced in a phase Verification block must exist in the Trajectory table. Orphaned IDs fail the validator. Phases without test-ID references must declare the `(no tests flip…)` form with an allowed reason.
3. **Temporal coherence** — `Writable at ≤ Passes at` (by phase number) for every row. A test cannot pass before its dependencies exist. Reordering phases that breaks this fails at write time — which is the feedback you want.
4. **Deferred Verification completeness** — every row in `### Deferred Verification` must have non-empty `reason:`, `would require:`, AND `mitigation:` fields.

## Phase close is structurally enforced

The `check-gates` hook blocks phase advancement when any trajectory row with `Passes at: Phase N` (for N ≤ the phase being advanced into, minus one) is still in state `planned`, `writable`, or `written`. Only `passing`, `skipped`, or `blocked` states allow phase close.

This is the structural guarantee that deferral is impossible by construction. The implementer cannot close Phase 3 and start Phase 4 while Phase-3-committed tests are still unwritten or failing.

## State lifecycle

The work skill maintains the `State` column as the implementation progresses.

```
planned → writable → written → passing
                              ↘ skipped (with reason)
                              ↘ blocked (needs investigation)
```

| State | Meaning |
|-------|---------|
| `planned` | Row exists in the trajectory, no file yet |
| `writable` | Dependencies exist; test can now be authored |
| `written` | Test file exists and runs (fails or `.skip()`) |
| `passing` | Test runs and passes |
| `skipped` | Intentionally `.skip()` with a documented reason |
| `blocked` | Was writable/written, now regressed; needs investigation |

At **phase start**, the work skill reads the Trajectory, commits `Writable at: Phase N` tests as failing (or `.skip()` with an unlock-phase comment), and transitions each row to `written`. At **phase close**, it runs the tests, transitions passing rows to `passing`, skipped rows to `skipped` with a reason, and blocked rows (regressions) to `blocked` for investigation.

## Deferred Verification — untestability as a declaration

Some items genuinely cannot be unit-tested within a plan's scope: LLM output quality, paid external integrations, UX judgment, multi-machine behavior. For these, add a `### Deferred Verification` subsection below the main table. Every row requires three fields:

- `reason:` — why this cannot be tested in this plan
- `would require:` — what would unlock a proper test
- `mitigation:` — the compensating control that keeps us from flying blind in the meantime

The `mitigation:` field is the most important of the three. It forces articulating how we'll notice if the deferred thing breaks. Acceptable mitigation shapes:

- **Telemetry alert** — OTel metric + threshold, Dash0 alert, Grafana trigger
- **Scheduled human review** — weekly/monthly/quarterly spot-check with a named owner
- **Downstream plan** — "a proper test lands in plan `graph-knowledge-architecture`; until then, manual check at release"
- **Canary / staging procedure** — documented smoke run in staging before each release
- **User feedback signal** — support channel routing, feedback widget, tracked ticket category

If you cannot name a mitigation, that is itself a signal — the plan is shipping a capability that cannot be observed. Either reshape the plan so the capability becomes testable, or scope it out. The validator rejecting a mitigation-less row forces this decision at plan time rather than at production-surprise time.

The retrospective skill audits every Deferred Verification row at plan close, classifying each mitigation (telemetry-alert / scheduled-review / downstream-plan / canary-or-staging / feedback-signal / unclassified) and flagging vague ones as retrospective findings that must be resolved or promoted before archive.

## Worked example: a small plan across three phases

Imagine a plan to add a `withdrawFor` function to a smart contract escrow module. Three phases: deploy the escrow, add the withdraw logic, add the admin-gated withdrawal flow.

```markdown
---
title: "withdrawFor — escrow withdrawal path"
trajectory: required
gate_policy: ask
---

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Escrow deploys with correct owner + token address | Phase 1 | Phase 1 | planned |
| T2 | `withdrawFor(wallet, player, amount, historyHash)` transfers the tokens | Phase 2 | Phase 2 | planned |
| T3 | `withdrawFor` reverts when caller is not the admin | Phase 2 | Phase 2 | planned |
| T4 | Admin role can be granted and revoked by owner | Phase 3 | Phase 3 | planned |
| T5 | Non-admin attempting admin flow hits revert path T3 | Phase 2 | Phase 3 | planned |

### Deferred Verification

- **Mainnet gas costs**
  - reason: gas costs depend on mainnet state; cannot deterministically assert in CI
  - would require: mainnet fork environment with pinned state
  - mitigation: hardhat gas reporter logged on every PR with threshold alerts on regression >20 percent

## Checklist

### Phase 1: Deploy escrow
- [ ] Escrow contract compiles
- [ ] Deploy script with owner + token address
#### Phase 1 Verification
- [ ] T1 passes (`pnpm hardhat test --grep deploys`)

### Phase 2: Withdraw logic
- [ ] `withdrawFor` implementation
- [ ] Admin modifier
#### Phase 2 Verification
- [ ] T2 passes (`pnpm hardhat test --grep withdraws`)
- [ ] T3 passes (`pnpm hardhat test --grep reverts`)

### Phase 3: Admin flow
- [ ] Admin role storage
- [ ] Grant/revoke functions
#### Phase 3 Verification
- [ ] T4 passes (`pnpm hardhat test --grep admin`)
- [ ] T5 passes (`pnpm hardhat test --grep non-admin`)
```

Note T5's `Writable at: Phase 2` but `Passes at: Phase 3`. The test *can* be authored in Phase 2 (it just calls `withdrawFor` without admin privileges and expects a revert) but cannot pass until Phase 3 adds the admin role machinery. The work skill will commit T5 as failing in Phase 2 and flip it to `passing` in Phase 3.

## Anti-patterns

1. **"(none needed)" in phase Verification.** The old template allowed this. The new template does not. A phase with no tests flipping declares `(no tests flip at this phase — reason: {allowed-reason})` where the reason is one of `schema-only`, `delete`, `refactor`, `infra`. Anything else fails the validator.
2. **Test Trajectory as the compliance artifact nobody reads.** IEEE 829's fate. Mitigation: the Trajectory lives *at the top* of the impl, not in a separate document. Every phase's Verification re-reads it via test IDs.
3. **Over-specifying at plan time.** A 40-row trajectory for a 200-line-of-code plan is over-engineered. Prefer property tests to collapse many example tests into one row. Allow the trajectory to grow during implementation as new tests are discovered.
4. **Deferred Verification as a dumping ground.** Once an escape hatch exists, it gets abused. Mitigation: mitigation field is mandatory and audited by retrospective. Vague mitigations (too short, unclassifiable) must be sharpened before the plan archives.
5. **Tests calcify a bad design.** The classic critique. Mitigation: `Writable at` explicitly defers test authoring until the shape is known. A phase with `Writable at: "after phase 2"` for everything says "we don't know the shape yet, let's spike before writing tests."
6. **Phase boundaries drive false test granularity.** If phases are arbitrary, `Writable at` becomes arbitrary. Mitigation: phases in InDusk impls correspond to natural implementation checkpoints. A phase that exists only to house a test is a planning smell — fold the test into the phase that produces the thing being tested.

## See also

- [Planner skill reference](/reference/skills/plan) — how the Trajectory is authored when an impl is written
- [Work skill reference](/reference/skills/work) — phase-start and phase-close responsibilities
- [Trajectory parser reference](/reference/trajectory/parser) — the TypeScript types, parser, and four validator functions
- [Tests-first-within-each-phase lesson](/lessons/tests-first-within-each-phase) — the community lesson every project inherits
- `.indusk/planning/tests-first-planning/adr.md` in the repo — full design rationale with alternatives considered
