---
title: "Tests-First Planning — Test Trajectory as First-Class Impl Artifact"
date: 2026-04-16
status: accepted
---

# Tests-First Planning

## Y-Statement

In the context of **InDusk impl documents where Verification sections close with "deferred to later" or "manual check" and real tests never get written**,
facing **the structural failure mode where each phase's Verification is a loose checklist the implementer can satisfy without actually running anything — and the separate, related failure that developers have no shared mental model for what is testable now, what is testable later, and what is genuinely not testable**,
we decided for **a top-level Test Trajectory table in every impl document with explicit writable-at-phase and passes-at-phase columns, per-phase Verification that references test IDs by number, and a narrow Deferred Verification escape hatch with mandatory reason and would-require fields**,
and against **a Test Plan stored in a separate document, per-phase Tests subsections without cross-phase visibility, and loose Verification items that describe "what to check" rather than "which named test must flip"**,
to achieve **a single visible artifact — the test suite's pass count across phases — that serves as both the plan's progress bar and a mental model for developers of the testing surface**,
accepting **more structure at plan time (authors must name tests before starting), a small migration cost on one drafted impl (agent-roles) to dogfood the shape, and some tests being written against subject-under-test that will be refactored within the plan**,
because **testability must be a first-class planning concern to prevent the universal-deferral failure mode — the artifact must license the right behavior structurally rather than relying on the implementer to remember the lesson, and the plan's test trajectory is the strongest signal to the author of whether the plan's phases are well-shaped**.

## Context

Two consecutive retrospectives in the numero codebase (`room-state-persistence`, `chain-of-custody-2`) documented roughly a third of verification items closing without any runnable automated check. Items deferred to "manual check later" or "typecheck passes" and were then forgotten. The most valuable test — restart recovery — was deferred to the end and not completed. This is not a discipline failure; it is a structural failure of the impl document template, which licenses deferral by making Verification a loose checklist of informal checks.

Sandy's original proposal (see `proposal-origin.md`) argued for Tests-first within each phase — each phase opens with a Tests subsection naming specific test files that must flip from failing to passing. The research note (`research.md`) surveyed the landscape and surfaced three key insights:

1. **Kent Beck's "Canon TDD" (2023)** calls the *test list* the artifact — red-green-refactor is mechanics. Our Test Trajectory is Beck's test list made durable, shared across a team, and tagged with phase information.
2. **The `writable-at-phase` vs `passes-at-phase` distinction** is genuinely novel — it appears nowhere as a named pattern in mainstream practitioner writing. BDD scenarios are assumed to be writable at spec time. Aerospace VCRMs conflate writable with ready-to-execute. This split is our synthesis.
3. **"Test Plan" as a term is contaminated** by IEEE 829 / ISTQB baggage. We need different vocabulary to signal a different tradition.

This ADR resolves the five open questions from the brief and specifies the exact shape of the artifact, the validator rules that enforce it, and the migration policy for existing plans.

## Decision

### 1. Name the artifact **Test Trajectory**

The top-level table at the start of every impl document is called the **Test Trajectory**. Runner-up alternatives ("Assertion Ledger," "Verification Map") were considered; Test Trajectory wins because it emphasizes the novel contribution (cross-phase motion of test states) and avoids industry muscle memory around "Test Plan."

The escape hatch is called **Deferred Verification** — plugs into the aerospace VCRM lineage and accurately signals "tracked, not abandoned."

### 2. Required columns: five. Optional columns: two.

**Required** (every Test Trajectory row must have these):

| Column | Purpose |
|--------|---------|
| **ID** | Stable handle for cross-reference. Convention: `T1, T2, T3, ...` |
| **Asserts** | One-sentence description of what the test claims is true |
| **Writable at** | The phase at which the test can be authored. `Phase N` or `Phase 0` if writable from the start |
| **Passes at** | The phase at which the test flips from failing to passing. May equal `Writable at` |
| **State** | One of: `planned`, `writable`, `written`, `passing`, `blocked`, `skipped` |

**Optional** (add when useful, not required by default):

| Column | Purpose | When to add |
|--------|---------|-------------|
| **Kind** | `example`, `property`, `contract`, `approval`, `formal` | When the plan mixes kinds and the distinction matters |
| **Scope** | `unit`, `integration`, `e2e` | When phase cost/runtime varies meaningfully by scope |

Minimalism over completeness. Authors can add optional columns when the plan benefits from them. The template generates the required columns only; the docs page explains when to add Kind and Scope.

Google's `size` taxonomy (small/medium/large) is rejected — it's redundant with `scope` at our team scale and adds cognitive load without signal.

### 3. Shape of the Test Trajectory section

Every impl document opens with:

```markdown
## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `fold(deposit+withdraw)` returns expected derived map | Phase 0 | Phase 3 | planned |
| T2 | stale room row → `checkInvariant` reports delta | Phase 2 | Phase 5 | planned |

### Deferred Verification

- **LLM output quality for Gemini summaries**
  - reason: we cannot deterministically assert LLM response quality
  - would require: dedicated eval harness with human-rated outputs; tracked in `graph-knowledge-architecture`
  - mitigation: weekly eval-judge spot-check on 5% sample; alert on mean-score regression > 10%; user feedback signal routed to `#quality` channel
- **Cross-machine clock skew in sync**
  - reason: requires multi-host test environment
  - would require: CI topology with two machines; out of scope for this plan
  - mitigation: OTel metric `sync.skew_ms` with Dash0 alert when p99 > 5s; manual two-host verification in staging before each release
```

The Deferred Verification subsection is optional (absent if there are no genuinely untestable items), but when present every row requires three fields: `reason:` (why it isn't testable here), `would require:` (what would unlock a proper test), and `mitigation:` (what compensating control keeps us from flying blind in the meantime).

The `mitigation:` field is the most important of the three. It forces the author to articulate how we'll notice if the deferred thing breaks in production. Mitigations can take several shapes:

- **Telemetry alert** — OTel metric + threshold (e.g., `sync.skew_ms p99 > 5s` fires an alert)
- **Scheduled human review** — weekly/monthly spot-check with a named owner and rubric
- **Downstream plan** — "a proper test lands in plan X; until then, manual check at each release"
- **Canary / staging procedure** — documented smoke run in staging before each release
- **User feedback signal** — support tickets, in-app feedback, named channel routing

If an author cannot name a mitigation, that is itself a signal — the plan is shipping a capability we cannot observe. The right answer then is usually to change the plan (reshape phases so the thing becomes testable) or explicitly scope the capability out. The validator rejecting a `mitigation:`-less Deferred Verification row forces this decision at plan time rather than at production-surprise time.

### 4. Per-phase Verification references test IDs

Every phase's Verification subsection changes from hand-crafted checks to test ID references:

```markdown
#### Phase 3 Verification
- [ ] T1 passes (`pnpm test:reconciler`)
- [ ] T2 passes (`pnpm test:reconciler`)
```

If a phase has no tests flipping at it, it must explicitly say so with one of four allowed reasons:

```markdown
#### Phase 2 Verification
- [ ] (no tests flip at this phase — reason: schema-only)
```

The allowed reasons are: `schema-only`, `delete`, `refactor`, `infra`. Any other reason fails the validator.

### 5. Rule: if it becomes writable at this phase, it gets written at this phase

When a phase's `writable-at: Phase N` tests come up, the phase opens by committing those tests. They're committed as failing (or `.skip()` with a documented unlock phase if they can't yet compile). The phase ends when the phase's `passes-at: Phase N` tests pass.

"Deferred to a later phase" is only allowed when `writable-at` actually names a later phase *and* the reason is structural (the test's dependencies don't exist yet), not aspirational ("we'll get to it"). This is the rule that prevents the deferral-cascade observed in the numero retrospectives.

### 6. Validator enforcement (four new rules, additive)

The `validate-impl-structure` hook gains four rules:

1. **Trajectory presence**: every impl document must have a `## Test Trajectory` section as its first section (after the frontmatter and document-level context, before phase checklists). Missing section = write-blocked.
2. **Cross-reference integrity**: every test ID referenced in a phase Verification block must exist in the Trajectory table. Orphaned IDs = write-blocked. Phases with no trajectory IDs must declare `(no tests flip at this phase — reason: {allowed-reason})`.
3. **Temporal coherence**: for every Trajectory row, the phase number in `Writable at` must be less than or equal to the phase number in `Passes at`. A test cannot pass before its dependencies exist. Violating = write-blocked, with an error message naming the offending row. This also catches reorder bugs: if an author reorders phases and a trajectory row's `Writable at` ends up after its `Passes at`, the validator fails, which is the feedback the author needs.
4. **Deferred Verification completeness**: every Deferred Verification row must have all three fields — `reason:`, `would require:`, and `mitigation:`. Missing any = write-blocked.

Existing gate-policy rules stay unchanged. These are additive.

### 6a. Phase references are numbers, not slugs

The Trajectory columns `Writable at` and `Passes at` reference phases by number (`Phase 1`, `Phase 2`, ...). Numbers make the dependency relationship legible directly in the data — `Phase 3 ≤ Phase 5` is a correctness invariant a validator can check. Slugs (stable IDs that travel with phases across reorders) were considered but rejected: they would hide the dependency relationship behind heading-order cross-references, and a reorder that made a trajectory row incoherent would pass silently.

Consequence: reordering phases requires updating Trajectory references. This is intentional. Reordering is a semantically significant event — you are changing the phase dependency graph. Re-examining the Trajectory at that moment is the right work, not overhead to avoid. In practice, most reordering happens early in planning (before the Trajectory is finalized) or mid-plan because a real dependency shifted (in which case the Trajectory genuinely does need to change). Tooling (`indusk plan reorder N M` that renumbers phases and rewrites Trajectory references) is an additive future option if the pain ever materializes; v1 is manual.

### 7. Migration policy: grandfather accepted/approved, require new and drafted

- **New impls** (created after this plan ships): required to have a Test Trajectory. Validator enforces.
- **Drafted impls** (currently `status: draft`): required to adopt the shape before advancing to `approved`. Validator warns on the existing state, blocks the draft→approved transition.
- **Accepted/approved impls** (e.g., `react-native-support`): grandfathered. The validator warns but doesn't block. If the impl is already executing, it finishes on the old shape.
- **Special case — `agent-roles`**: drafted but not started. Will be retrofitted with a Test Trajectory as the dogfood example. This is the first plan to execute under the new shape and gives us real feedback before the validator goes hot on every impl.

### 8. State vocabulary

The `State` column values form a lifecycle:

- `planned` — exists in the trajectory, not yet written
- `writable` — dependencies exist, can be authored now (often set at the phase it's unlocked)
- `written` — test code exists and runs, but fails or is `.skip()`
- `passing` — test runs and passes
- `blocked` — was writable, but a dependency regressed or the plan changed; needs investigation
- `skipped` — intentionally `.skip()` in code, tracked but not run (rare; usually for approval tests waiting on a first run)

The work skill is responsible for updating State as the impl progresses. Phase close requires all `passes-at: Phase N` tests to be in state `passing`.

### 9. Lesson phrasing

Add `tests-first-within-each-phase.md` as a community lesson:

> # Tests first within each phase
>
> Every impl document opens with a Test Trajectory table listing every test the plan commits to, with `Writable at` and `Passes at` columns.
>
> At the start of a phase, commit any test whose `Writable at` equals this phase — as failing. Close the phase only when every test whose `Passes at` equals this phase is passing. If a test isn't writable yet, that's fine — but its `Writable at` must name a later phase, and the reason must be structural.
>
> If a plan has items that are genuinely not testable — LLM quality, UX judgment, paid external integrations — put them in Deferred Verification with `reason:` and `would require:` fields. Untestability is a declaration, not an omission.
>
> The test suite's pass count across phases is the plan's progress bar. Read it to know where you are.

### 10. Template update

`apps/indusk-mcp/skills/planner/SKILL.md` and the impl.md template emit this structure:

```markdown
---
title: "{Plan Name} — Impl"
date: YYYY-MM-DD
status: draft
---

# {Plan Name} — Implementation

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | {what does this test claim is true} | Phase N | Phase M | planned |

### Deferred Verification

(omit subsection if nothing deferred)

- **{short name}**
  - reason: {why untestable in this plan}
  - would require: {what would unlock a proper test}
  - mitigation: {compensating control — alert, scheduled review, downstream plan, staging check, feedback signal}

## Checklist

### Phase 1: {Name}

**Goal:** {one sentence — what this phase produces}

#### Implementation
- [ ] {Task}

#### Phase 1 Verification
- [ ] T1 passes (`{runnable command}`)
- [ ] T2 flips to `written` state (skipped until Phase 3)

#### Phase 1 Context
- [ ] {CLAUDE.md edit}

#### Phase 1 Document
- [ ] {Docs page}
```

### 11. What Changes in Code

Comprehensive inventory of code changes. The impl document will structure its phases around this list.

#### Skills (`apps/indusk-mcp/skills/`)

1. **`planner/SKILL.md`** — the planner emits impls that include a Test Trajectory table and a Deferred Verification section. The planner is also responsible for authoring the initial trajectory rows when producing an impl from an accepted ADR; it walks the ADR's decisions and proposes test IDs for each one.
2. **`work/SKILL.md`** — when the work skill opens a phase, it reads the Trajectory, identifies every test with `Writable at: Phase N` where N is the current phase, and commits those tests as failing (or `.skip()` with a comment naming the unlock phase) before starting implementation work. When it closes a phase, it verifies every test with `Passes at: Phase N` is in state `passing` and updates the `State` column accordingly.
3. **`retrospective/SKILL.md`** — the retrospective audit includes a pass over the Trajectory: did every Deferred Verification row's `mitigation:` get wired up? Did any rows end the plan in `blocked` state without explanation? Did the `State` column accurately reflect reality at each phase close? These become retrospective findings.
4. **`verify/SKILL.md`** — the verify skill learns to resolve `T1` (test ID) into a runnable command by looking at the Trajectory row's `Asserts` column and the associated test file. This is mostly a doc update — the verify skill already runs arbitrary commands; it just needs to know trajectory references are a first-class input.

#### Hooks (`apps/indusk-mcp/hooks/` → installed into `.claude/hooks/` by `indusk init`)

1. **`validate-impl-structure.js`** — the four new validator rules land here:
   - Trajectory presence (rule 1 in Section 6)
   - Cross-reference integrity between phase Verification and Trajectory IDs (rule 2)
   - Temporal coherence: `Writable at ≤ Passes at` using phase numbers (rule 3)
   - Deferred Verification completeness: `reason:`, `would require:`, and `mitigation:` all present (rule 4)
   - Fires on Write/Edit of any `impl.md` file. Existing gate-section checks stay unchanged.
2. **`check-gates.js`** — phase-close enforcement is extended. Currently it blocks phase advancement if gate sections (Verification/Context/Document) have unchecked items. New behavior: when advancing past a phase, also read the Trajectory and verify every row with `Passes at: Phase N` where N is the phase being closed is in state `passing` (or `skipped` with a documented reason). A phase cannot close with `passes-at` tests still in `planned`, `writable`, or `written` state. This is the structural enforcement of "deferral becomes impossible."
3. **`gate-reminder.js`** — extended with two nudges:
   - When a phase starts, remind the author of `Writable at: Phase N` tests that need to be committed as failing.
   - When a phase is close to closing, remind about `Passes at: Phase N` tests still not in `passing` state.
   - Nudges only; not blocking. Blocking belongs in the other two hooks.
4. **`check-plan-order.js`** — no change. Already handles the pipeline ordering.
5. **`eval-trigger.js`** — no change.
6. **`check-catchup.js`** — no change.

#### Templates (`apps/indusk-mcp/templates/`)

1. **`impl.md` template** (or whatever the planner skill uses to scaffold an impl) — updated to emit the Test Trajectory section, a Deferred Verification subsection skeleton, and phase Verification blocks that reference test IDs rather than free-text checks. Shape specified in Section 10.

#### Lessons (`apps/indusk-mcp/lessons/`)

1. **`tests-first-within-each-phase.md`** — new community lesson. Content drafted in Section 9.

#### Docs (`apps/indusk-docs/`)

1. **VitePress page on Test Trajectory** — worked example, vocabulary, anti-patterns. Cross-linked from the planner skill docs and the verify skill docs. Referenced from the sidebar under "Process."
2. **Updated planner skill docs page** — include a "Test Trajectory" section linking to the new page.

#### Tests (dogfooding applies here)

1. **`validate-impl-structure` tests** — each of the four new rules gets vitest cases: valid inputs pass, each failure mode rejects with a specific error message, edge cases (empty trajectory, single-phase plan, phase with no tests flipping) behave correctly.
2. **`check-gates` trajectory tests** — cases for phase-close behavior with various trajectory states.
3. **End-to-end integration test** — take the retrofitted `agent-roles/impl.md`, run it through the validator and gate hooks, verify behavior at phase transitions. This is the plan's own Trajectory exemplar.

#### CLAUDE.md (dusk project context)

1. **Conventions section** — add a bullet about Test Trajectory and Deferred Verification as impl-doc requirements.
2. **Key Decisions section** — add a bullet linking to this ADR.
3. **Known Gotchas** — add notes on the temporal-coherence rule and the `mitigation:` requirement (likely points of confusion in early adoption).

#### agent-roles retrofit (the dogfood)

1. **`agent-roles/impl.md`** — gets a Test Trajectory added at the top. Each of the 4 existing phases gets its Verification block rewritten to reference test IDs. This happens as Phase N of the `tests-first-planning` impl (probably the last phase, so everything upstream is built), and is the signal that the system works end-to-end.

## Alternatives Considered

### Tests-first within each phase (Sandy's original proposal shape)

Per-phase `**Tests (fill in before code):**` subsections at the top of each phase's checklist, with no cross-phase table.

**Why rejected:** loses the trajectory. A reader can't answer "what tests pass by end of Phase 3?" without scanning the whole document. The proposal's own "Phase 0.5 + unlock map" pattern is an implicit trajectory — making it explicit at the top of the doc is strictly more useful.

### Separate Test Plan document (plan-dir/test-plan.md)

Test trajectory in its own file, referenced by impl.md.

**Why rejected:** two places to read, two places to maintain, two places to drift. The test trajectory is integral to the impl, not a sidecar. Keeping it inline also means every time someone opens the impl to check the current phase's verification, they see the trajectory — re-reading builds familiarity.

### IEEE 829 / ISO 29119 "Master Test Plan" compliance

Adopt the enterprise-QA structure verbatim with traceability matrices, test priority fields, author/reviewer signatures, etc.

**Why rejected:** bureaucratic, triggers negative associations in developer culture, optimizes for compliance audit rather than implementation clarity. We borrow the structure (test IDs, trajectory) but not the ceremony.

### Gherkin / Given-When-Then for every test row

Every row of the Trajectory written as a Gherkin scenario.

**Why rejected:** format tax without enough payoff in our context (single-implementer, non-business-facing). We reference Adzic's "specification by example" spirit but don't prescribe Gherkin syntax. Authors can write Gherkin-style prose in the `Asserts` column if it helps, but it's not mandated.

### Only enforce writable-at, drop passes-at

Simpler: just say when a test can be written. Let passing happen organically.

**Why rejected:** passes-at is where the progress-bar-for-the-plan payoff lives. Without it, there's no way to answer "are we on track?" at the plan level. Writable-at alone recovers tests-first-per-phase but not the trajectory insight.

### Make Kind and Scope required columns

Every row must specify kind (example/property/etc.) and scope (unit/integration/e2e).

**Why rejected:** friction at plan time for small plans that don't need the distinction. Making them optional means the columns appear when they earn their place. Projects with complex test kinds can make them required in their own project conventions.

## Consequences

### Positive

- **Deferral becomes structurally impossible.** The validator rejects impls that lack a trajectory or have verification blocks that don't reference real test IDs. The implementer cannot close a phase whose `passes-at` tests aren't passing.
- **Untestability becomes observable.** The `mitigation:` requirement on every Deferred Verification row forces the author to articulate how we'll notice if a deferred thing breaks. "We can't test it" is no longer a terminal statement — it must come with "and here's what catches it in the meantime." If the author cannot name a mitigation, that itself is plan-level feedback.
- **Phase dependency bugs surface at validation time.** The temporal-coherence rule (`Writable at ≤ Passes at`) catches reorder errors immediately. An author reordering phases whose Trajectory references break silently is a class of bug the validator eliminates.
- **Progress is legible.** `/work` can report "Phase 3 complete — T1, T2 now passing, T3 skipped until Phase 5" from the trajectory alone.
- **Testability becomes a design signal.** If a plan's trajectory has many `Deferred Verification` rows, that's a warning the plan is hard to test — which usually means it's hard to reason about. Authors see this at plan time and can restructure phases before writing code.
- **Shared vocabulary across plans.** "T2 in blocked state" is a concrete thing with a meaning. No more hand-waving about "we should have a test for that."
- **Retrofitting shape is incremental.** Existing impls stay valid; new ones adopt the shape; drafted ones migrate at advance-to-approved time.
- **Dogfooding is built in.** `agent-roles` retrofits and executes Phase 1 under the new shape before the validator goes hot, giving real friction signal before enforcement.

### Negative

- **More up-front structure at plan time.** Authors must name tests before starting a phase. This is the point, but it is also a tax — small plans may feel over-engineered.
- **State column maintenance.** `State` must be updated as the impl progresses. If the work skill doesn't automate this, it drifts. Mitigation: the work skill is part of the deliverables and will update State at phase-close.
- **Trajectory can become stale during execution.** Discovered mid-plan tests need to be added; dropped tests need to be crossed out. Not automated. Mitigation: treat the trajectory as a living artifact (clarified in lesson); audit in retrospective.
- **Grandfathering creates two shapes temporarily.** Until `react-native-support` is archived or revived, the codebase has one impl with the old shape. Acceptable.

### Risks

- **Authors game the `(no tests flip this phase — reason: refactor)` escape.** A cynical author could declare every phase as `refactor` to skip testing. Mitigation: allowed reasons are whitelisted (`schema-only`, `delete`, `refactor`, `infra`), and retrospective explicitly audits whether the reason was honest. Repeated abuse is a lesson candidate.
- **The Test Trajectory grows unwieldy on large plans.** A 12-phase plan with 40 tests is a lot of rows. Mitigation: the trajectory is still one table; wide plans use property tests to compress (one ID, many cases). If a plan has 40 distinct example tests, the plan itself is probably over-scoped.
- **Dogfooding `agent-roles` surfaces shape problems that block the plan.** If retrofitting shows the shape doesn't work for that plan, we have to iterate on the shape before agent-roles can start. Mitigation: this is actually a feature — finding shape problems before enforcement is the whole point of dogfooding.
- **Validator rules become brittle.** Cross-reference integrity between phase verification and trajectory IDs requires parsing both. Mitigation: clear error messages when a reference is orphaned; fail-fast at write time, not advance time.

## References

- `.indusk/planning/tests-first-planning/brief.md`
- `.indusk/planning/tests-first-planning/research.md`
- `.indusk/planning/tests-first-planning/proposal-origin.md` — Sandy's original proposal from the numero codebase
- `/Users/the_dusky/code/sandbox/numero/.indusk/retro/room-state-persistence.md` — origin retrospective (deferred restart-recovery test)
- `/Users/the_dusky/code/sandbox/numero/.indusk/retro/chain-of-custody-2.md` — origin retrospective (~1/3 verification deferral)
- Kent Beck, "Canon TDD" (2023) — https://tidyfirst.substack.com/p/canon-tdd
- Gojko Adzic, *Specification by Example* (Manning, 2011)
- Winters, Manshreck, Wright, *Software Engineering at Google* (O'Reilly, 2020) — https://abseil.io/resources/swe-book
