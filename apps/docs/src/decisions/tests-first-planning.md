# Tests-First Planning — Decision Summary

Shipped in `@infinitedusky/indusk-mcp@1.15.0`. Archived at `.indusk/planning/archive/tests-first-planning/` in the repo.

## The Problem

Two consecutive plans in a real codebase closed with ~1/3 of verification items unfulfilled. Items deferred to "manual check later" and were then forgotten. The most valuable test in one of those plans — restart recovery — was deferred to the end and never completed. Typecheckers were green; no automated run ever exercised the flow.

This was structural: the impl template's Verification gate was a loose checklist of informal statements that the implementer could satisfy without running anything. A lesson documented the failure mode but could not prevent it — the artifact still licensed the behavior.

## The Decision

Every new `impl.md` opens with a `## Test Trajectory` table — the plan's testing contract — at the top of the document (between `## Boundary Map` and `## Checklist`).

```markdown
## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `fold(deposit+withdraw)` returns expected derived map | Phase 1 | Phase 1 | planned |
| T2 | stale room row → `checkInvariant` reports delta | Phase 2 | Phase 3 | planned |

### Deferred Verification

- **LLM output quality**
  - reason: cannot deterministically assert in CI
  - would require: dedicated eval harness
  - mitigation: weekly spot-check on 5 percent sample; alert on mean-score regression > 10 percent
```

Phase Verification sections reference test IDs rather than restating checks:

```markdown
#### Phase 3 Verification
- [ ] T1 passes (`pnpm test:reconciler`)
- [ ] T2 passes (`pnpm test:reconciler`)
```

## Why This Shape

| Column | Decision |
|--------|----------|
| **`Writable at`** vs **`Passes at`** | Explicit decoupling. A test can be authored at Phase 2 (its dependencies exist) but only pass at Phase 3 (the behavior ships). Novel — this distinction does not appear as a named pattern in mainstream practitioner writing. |
| **Test IDs as stable handles** | Beck's "Canon TDD" (2023) calls the test list the artifact — red-green-refactor is mechanics. IEEE 829 got ID-referencing right even if it got everything else wrong. |
| **Phase numbers (not slugs)** | Numbers make the dependency relationship legible in the data. `Phase 3 ≤ Phase 5` is a correctness invariant the validator checks. Slugs would hide the dependency behind heading-order cross-references and let reorders silently break trajectory coherence. |
| **Three-field Deferred Verification** | `reason` + `would require` + `mitigation`. The mitigation field is the compensating control — without it, deferring a test means flying blind. If an author cannot name a mitigation, that is itself plan-level feedback. |

Name "Test Trajectory" chosen over "Test Plan" to avoid IEEE 829 / ISTQB muscle memory.

## Structural Enforcement

Four validator rules run whenever an impl has `trajectory: required` in frontmatter or a `## Test Trajectory` section:

1. **trajectory-presence** — section must exist
2. **cross-reference-integrity** — every test ID in phase Verification blocks must exist in the Trajectory table; phases without test IDs must declare `(no tests flip at this phase — reason: {schema-only | delete | refactor | infra})`
3. **temporal-coherence** — `Writable at ≤ Passes at` (by phase number)
4. **deferred-completeness** — every Deferred Verification row has non-empty `reason`, `would require`, AND `mitigation`

`check-gates.js` blocks phase advancement when any `Passes at: Phase N` row is in `planned`, `writable`, or `written` state. Only `passing`, `skipped`, or `blocked` allow phase close. This is the structural guarantee that deferral is impossible by construction.

## Key Tradeoffs Accepted

- **More up-front structure at plan time.** Authors name tests before starting. Small plans may feel over-engineered; the discipline is the point.
- **Phase reordering requires trajectory updates.** Numbers are referenced directly; moving a phase means updating every row that references it. This is intentional friction — reordering is semantically significant and re-examining the trajectory is the right work at that moment. Tooling is an additive option if the pain ever materializes.
- **Two trajectory parsers to maintain.** The canonical TypeScript lives at `apps/indusk-mcp/src/lib/trajectory/` (tested). Hooks that run as plain Node scripts (`validate-impl-structure.js`, `check-gates.js`, `gate-reminder.js`) hand-port a minimal JS version of the logic. When adding fields or changing behavior, update both. Documented as a Known Gotcha.

## Rejected Alternatives

- **Tests-first within each phase (per-phase Tests subsections).** Loses the cross-phase trajectory; you can't answer "what tests pass by end of Phase 3?" without scanning the whole document.
- **Separate Test Plan document.** Two places to read, maintain, and drift. The Trajectory is integral to the impl.
- **IEEE 829 / ISO 29119 Master Test Plan compliance.** Bureaucratic; triggers negative associations in developer culture; optimizes for compliance audit rather than implementation clarity.
- **Gherkin / Given-When-Then mandated per row.** Format tax without sufficient payoff in our single-implementer context.
- **Only enforce `writable-at`, drop `passes-at`.** Recovers tests-first-per-phase but loses the progress-bar-for-the-plan insight.
- **Make `Kind` and `Scope` required columns.** Friction for small plans that don't need the distinction. Made optional instead; add when the plan benefits.

## See Also

- [Test Trajectory user guide](/guide/test-trajectory) — worked example, authoring guidance, anti-patterns
- [Trajectory parser reference](/reference/trajectory/parser) — TypeScript types, parser, four validator functions
- [Tests-first-within-each-phase lesson](/lessons/tests-first-within-each-phase) — community lesson shipped with every project
- `.indusk/planning/archive/tests-first-planning/adr.md` in the repo — full ADR with all 11 decisions and alternatives
- `.indusk/planning/archive/tests-first-planning/retrospective.md` — honest account of what shipped, what broke, and what to do differently
