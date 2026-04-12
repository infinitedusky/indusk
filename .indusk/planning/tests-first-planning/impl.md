---
title: "Tests-First Planning — Test Trajectory as First-Class Impl Artifact"
date: 2026-04-16
status: in-progress
gate_policy: strict
---

# Tests-First Planning

## Goal

Reshape every InDusk impl document so testability is a first-class planning artifact. Every impl gains a top-level Test Trajectory table listing tests with `Writable at` / `Passes at` columns, per-phase Verification that references test IDs, and a narrow Deferred Verification escape hatch with required `reason:` / `would require:` / `mitigation:` fields. The validator enforces the shape structurally so verification-item deferral becomes impossible by construction.

This impl itself follows the new shape end-to-end. The Test Trajectory below is authoritative — if any row's `Passes at: Phase N` test is not in state `passing` when Phase N closes, the check-gates hook blocks the phase transition.

## Scope

### In Scope
- Test Trajectory parser (reads impl.md, extracts table + deferred rows)
- Four new `validate-impl-structure` rules (trajectory presence, cross-reference integrity, temporal coherence, deferred verification completeness)
- Impl template update to emit Test Trajectory + Deferred Verification skeleton
- Planner skill update to author initial trajectory from an accepted ADR
- Work skill updates to manage `State` column at phase start and phase close
- `check-gates` hook extension to block phase close when `Passes at: Phase N` tests aren't `passing`
- `gate-reminder` hook nudges at phase start and near phase close
- Verify skill resolves test ID references
- Retrospective skill audits trajectory and mitigation completeness
- New community lesson `tests-first-within-each-phase.md`
- VitePress docs page on Test Trajectory
- CLAUDE.md updates (Conventions, Key Decisions, Known Gotchas)
- `agent-roles/impl.md` retrofit as the dogfood exemplar

### Out of Scope
- New test runners or frameworks (we use whatever the project already has — Vitest in dusk)
- Automated State column updates across arbitrary test runners (only Vitest output is parsed in v1; other runners are future work)
- A UI or dashboard for the trajectory (the impl document is the artifact)
- Retroactive enforcement on already-accepted impls (`react-native-support` is grandfathered)
- Migration of non-impl plan documents (research, brief, ADR, retrospective) — only impls are affected

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `TestTrajectory` parser + types in indusk-mcp; four new rules in `validate-impl-structure.js`; unit tests | `.indusk/config.json`, existing validator structure |
| Phase 2 | Updated impl.md template; planner SKILL.md emits and authors trajectory rows | Phase 1 parser, validator |
| Phase 3 | Work SKILL.md manages `State`; `check-gates.js` enforces phase-close; `gate-reminder.js` nudges | Phase 1 parser, Phase 2 templates |
| Phase 4 | Verify SKILL.md resolves test IDs; Retrospective SKILL.md audits trajectory; lesson file | Phases 1–3 |
| Phase 5 | VitePress docs page; CLAUDE.md updates; `agent-roles/impl.md` retrofit | All prior phases |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | Scope | State |
|----|---------|-------------|-----------|-------|-------|
| T1 | Trajectory parser extracts the `## Test Trajectory` table from an impl.md into typed rows | Phase 1 | Phase 1 | unit | passing |
| T2 | Trajectory parser extracts `### Deferred Verification` rows with `reason` / `would require` / `mitigation` fields | Phase 1 | Phase 1 | unit | passing |
| T3 | Trajectory parser returns empty trajectory (not error) when section is absent | Phase 1 | Phase 1 | unit | passing |
| T4 | Validator rule "trajectory presence" rejects an impl.md lacking `## Test Trajectory` | Phase 1 | Phase 1 | unit | passing |
| T5 | Validator rule "cross-reference integrity" rejects a phase Verification referencing a test ID not in the trajectory | Phase 1 | Phase 1 | unit | passing |
| T6 | Validator rule "cross-reference integrity" accepts `(no tests flip at this phase — reason: schema-only)` with whitelisted reason | Phase 1 | Phase 1 | unit | passing |
| T7 | Validator rule "cross-reference integrity" rejects a non-whitelisted `no-tests-flip` reason | Phase 1 | Phase 1 | unit | passing |
| T8 | Validator rule "temporal coherence" rejects a row where `Writable at` phase number > `Passes at` phase number | Phase 1 | Phase 1 | unit | passing |
| T9 | Validator rule "temporal coherence" accepts a row where `Writable at` equals `Passes at` | Phase 1 | Phase 1 | unit | passing |
| T10 | Validator rule "deferred verification completeness" rejects a row missing `mitigation:` | Phase 1 | Phase 1 | unit | passing |
| T11 | Validator rule "deferred verification completeness" rejects a row missing `would require:` | Phase 1 | Phase 1 | unit | passing |
| T12 | Validator rule "deferred verification completeness" rejects a row missing `reason:` | Phase 1 | Phase 1 | unit | passing |
| T13 | Impl.md template includes a `## Test Trajectory` skeleton with the five required columns | Phase 2 | Phase 2 | unit | planned |
| T14 | Planner skill scaffolds an impl that passes all four new validator rules on first generation | Phase 2 | Phase 2 | integration | planned |
| T15 | Work skill, given an impl with a trajectory, reports `Writable at: Phase N` tests as the current phase opens | Phase 3 | Phase 3 | integration | planned |
| T16 | Work skill updates the `State` column to `passing` when a referenced Vitest test passes | Phase 3 | Phase 3 | integration | planned |
| T17 | `check-gates` hook blocks phase close when a `Passes at: Phase N` test is still in state `written` or `planned` | Phase 3 | Phase 3 | integration | planned |
| T18 | `check-gates` hook allows phase close when every `Passes at: Phase N` test is in state `passing` | Phase 3 | Phase 3 | integration | planned |
| T19 | `gate-reminder` hook emits a nudge naming `Writable at: Phase N` tests at the start of a phase | Phase 3 | Phase 3 | integration | planned |
| T20 | Lesson file `apps/indusk-mcp/lessons/tests-first-within-each-phase.md` exists and matches the ADR phrasing | Phase 4 | Phase 4 | unit | planned |
| T21 | Retrospective skill audit surfaces any Deferred Verification row whose `mitigation:` was never wired up | Phase 4 | Phase 4 | integration | planned |
| T22 | Verify skill resolves a test ID reference (`T1`) to its test file path and runnable command | Phase 4 | Phase 4 | integration | planned |
| T23 | `CLAUDE.md` Conventions section mentions Test Trajectory as an impl-doc requirement | Phase 5 | Phase 5 | unit | planned |
| T24 | VitePress page `apps/indusk-docs/src/guide/test-trajectory.md` exists and is linked from planner skill docs and sidebar | Phase 5 | Phase 5 | unit | planned |
| T25 | `agent-roles/impl.md` validates successfully under the four new rules after retrofit (the end-to-end dogfood) | Phase 5 | Phase 5 | e2e | planned |

### Deferred Verification

- **Developer adoption and subjective usefulness of the Test Trajectory shape**
  - reason: we cannot deterministically assert that developers find the shape useful or less friction-laden than the old template
  - would require: usability study with rated feedback from 5+ developers across multiple plans
  - mitigation: retrospective after `agent-roles` ships includes an explicit question "did the Trajectory help you know where you were in the plan?"; 2–3 subsequent plans (`mcp-orchestration-layer`, `hermes-inspired-improvements`, `graph-knowledge-architecture`) use the shape before we declare it settled; friction captured in `indusk eval findings` flows into subsequent lessons.

- **Real-world prevention of the universal-deferral failure mode**
  - reason: we can prove the validator rejects syntactically invalid trajectories, but not that it prevents every form of real-world deferral-by-typecheck-only
  - would require: production-scale data across many teams and plan durations
  - mitigation: retrospective gate on every plan using the new shape explicitly asks "did any verification item close without a real test? if yes, was it captured as a Deferred Verification row with a real mitigation?"; eval judge rubric gains a check for hidden deferrals by cross-referencing trajectory `State` column against actual test-run evidence in commit diffs.

## Checklist

### Phase 1: Trajectory Parser and Validator Rules

**Goal:** Build the library-level primitives — a typed parser for the `## Test Trajectory` and `### Deferred Verification` sections, plus the four new `validate-impl-structure` rules. This phase is self-standing: no skills or hooks beyond the validator change yet. By end of phase, the validator rejects invalid impls but no impls emit trajectories yet (Phase 2 does that).

#### Implementation

- [x] Create `apps/indusk-mcp/src/lib/trajectory/parser.ts`:
  - Types: `TrajectoryRow { id, asserts, writableAt, passesAt, state, kind?, scope? }`, `DeferredRow { name, reason, wouldRequire, mitigation }`, `Trajectory { rows: TrajectoryRow[], deferred: DeferredRow[] }`
  - `parseTrajectory(impl: string): Trajectory` — reads markdown, locates `## Test Trajectory` section, parses the table (GFM markdown table), parses the optional `### Deferred Verification` subsection (bulleted list where each item has three sub-bullets: `reason:`, `would require:`, `mitigation:`)
  - Phase references parsed as numeric: `"Phase 3"` → `3`. Reject non-numeric phases at parse time with a structured error
  - `State` values parsed as enum; unknown values become `state: "unknown"` (the validator rule catches it, not the parser)
  - Return empty `Trajectory { rows: [], deferred: [] }` when the section is absent — do not throw
- [x] Create `apps/indusk-mcp/src/lib/trajectory/validator.ts`:
  - `validateTrajectoryPresence(impl: string): ValidationError[]` — errors if `## Test Trajectory` is missing
  - `validateCrossReferenceIntegrity(impl: string, trajectory: Trajectory): ValidationError[]` — parses each phase's Verification block, extracts test ID references (pattern: `\bT\d+\b` in checklist items), confirms each exists in `trajectory.rows`. Allows `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})` as an explicit empty-phase declaration
  - `validateTemporalCoherence(trajectory: Trajectory): ValidationError[]` — for every row, asserts `writableAt <= passesAt` using phase numbers
  - `validateDeferredCompleteness(trajectory: Trajectory): ValidationError[]` — asserts every `DeferredRow` has non-empty `reason`, `wouldRequire`, `mitigation`
  - Composite `validateTrajectory(impl: string): ValidationError[]` that runs all four and returns combined errors
- [x] Extend `apps/indusk-mcp/hooks/validate-impl-structure.js`:
  - Load `validateTrajectory` from compiled output (the hook is JS and runs via node; resolve path via existing hook-loading pattern)
  - After existing gate-section checks, run `validateTrajectory` on the impl content
  - Combine errors; write-block the edit if any returned
  - Keep error messages specific: name the offending row, line number if feasible, and the rule that failed
- [x] Write Vitest tests for T1–T12:
  - Fixture impl.md files under `apps/indusk-mcp/src/lib/trajectory/__tests__/fixtures/` (one per test case — valid minimum, missing section, orphan reference, whitelisted empty-phase, non-whitelisted empty-phase, writable-after-passes, writable-equals-passes, missing mitigation, missing would-require, missing reason)
  - Each test parses the fixture, calls the appropriate validator function, asserts expected errors

#### Phase 1 Verification

- [x] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- trajectory`)
- [x] T2 passes (same command)
- [x] T3 passes (same command)
- [x] T4 passes (same command)
- [x] T5 passes (same command)
- [x] T6 passes (same command)
- [x] T7 passes (same command)
- [x] T8 passes (same command)
- [x] T9 passes (same command)
- [x] T10 passes (same command)
- [x] T11 passes (same command)
- [x] T12 passes (same command)
- [x] `pnpm check` passes on Phase 1 deliverables (`npx @biomejs/biome check apps/indusk-mcp/src/lib/trajectory apps/indusk-mcp/hooks/validate-impl-structure.js` — clean. Repo-wide `pnpm check` has pre-existing formatting errors in `package.json` etc., tracked separately.)
- [x] Manual sanity: ran `validateTrajectory` against this plan's own `impl.md` via `tsx --eval` — zero errors across all four rules

#### Phase 1 Context

- [x] Add to CLAUDE.md Known Gotchas: Test Trajectory parser strictness on phase references (two bullets added: one on numeric-only phase refs + temporal coherence, one on validate-impl-structure.js's broad phase-header regex triggering full-file validation)

#### Phase 1 Document

- [x] Write reference page `apps/indusk-docs/src/reference/trajectory/parser.md` documenting the `Trajectory`, `TrajectoryRow`, `DeferredRow` types, the four validator functions, and the composite `validateTrajectory`. User-facing guide remains Phase 5.

### Phase 2: Template and Planner Skill

**Goal:** New impls generated by the planner skill include a Test Trajectory skeleton and pass the four validator rules on first scaffolding. The impl.md template becomes the source of the new shape.

#### Implementation

- [ ] Update `apps/indusk-mcp/templates/impl.md` (or wherever the planner skill reads its scaffold from):
  - Add a `## Test Trajectory` section after `## Boundary Map` and before `## Checklist`
  - Include the five-column table header with one `T1` placeholder row
  - Include the `### Deferred Verification` subsection as a commented-out skeleton so authors see it exists but aren't forced to populate
  - Phase Verification blocks reference placeholder test IDs (`T1 passes (...)`) rather than generic "tests pass"
- [ ] Update `apps/indusk-mcp/skills/planner/SKILL.md`:
  - Add explicit instruction in the "writing an impl" step: "walk the ADR's Decision section; for each decision produce one or more Trajectory rows with specific `Asserts` text, phase placement, and scope"
  - Add guidance on minimum-viable trajectory (3–5 rows for small plans) vs comprehensive (15+ rows for multi-phase infrastructure plans)
  - Reference the new VitePress docs page (placeholder link, filled in Phase 5)
- [ ] Confirm planner-generated impls pass the four validator rules via Phase 1 testing infrastructure
- [ ] Update the `gate_policy` section of SKILL.md to reference how Test Trajectory complements strict gate enforcement

#### Phase 2 Verification

- [ ] T13 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- template`)
- [ ] T14 passes — integration test that runs the planner skill's scaffold routine on a mock accepted ADR and asserts the resulting impl.md passes `validateTrajectory` with zero errors
- [ ] `pnpm check` passes
- [ ] Manual sanity: use `/planner` to scaffold a throwaway impl from an accepted ADR, verify the generated file has a Test Trajectory section and passes the validator

#### Phase 2 Context

- [ ] Update CLAUDE.md Conventions: add bullet "Every impl.md includes a `## Test Trajectory` table at the top, before `## Checklist`. Test IDs (`T1`, `T2`, ...) are referenced by phase Verification blocks. Deferred Verification rows require `reason:`, `would require:`, and `mitigation:`. See `.indusk/planning/tests-first-planning/adr.md`."

#### Phase 2 Document

- [ ] Update `apps/indusk-docs/src/reference/skills/planner.md` (or equivalent planner skill doc page) to mention the Test Trajectory responsibility. Full user-facing guide is Phase 5.

### Phase 3: Work Skill, Check-Gates, and Gate-Reminder

**Goal:** Structural enforcement activates. The `State` column is maintained by the work skill as the implementation progresses. `check-gates` blocks phase close when `Passes at: Phase N` tests are not `passing`. `gate-reminder` nudges at phase start (commit writable-at tests as failing) and approaching phase close (passes-at tests still not passing).

#### Implementation

- [ ] Update `apps/indusk-mcp/skills/work/SKILL.md`:
  - On phase start: read trajectory, list `Writable at: Phase N` rows whose `State` is `planned`, prompt the user to author the test files (or `.skip()` placeholders with unlock-phase comments), transition those rows' `State` to `writable` when files exist, then to `written` when the tests run (failing or skipped)
  - During phase execution: when a Vitest test matching a trajectory row's `Asserts` transitions from failing to passing, update that row's `State` to `passing` in impl.md
  - On phase close: verify every row with `Passes at: Phase N` is in `State: passing` or `State: skipped` (with a documented reason); block close otherwise
  - Document the `State` lifecycle in the skill doc
- [ ] Extend `apps/indusk-mcp/hooks/check-gates.js`:
  - When the hook fires on a phase advancement, load the trajectory via the Phase 1 parser
  - Collect every row with `Passes at` matching the closing phase number
  - Reject the advancement if any such row is not in `State: passing` or `State: skipped` (with reason)
  - Error message names the offending rows by ID
- [ ] Extend `apps/indusk-mcp/hooks/gate-reminder.js`:
  - At phase start (detected by the existing phase-advance signal): emit a nudge listing `Writable at: Phase N` rows whose `State` is `planned` — "commit these tests as failing before starting implementation work"
  - Near phase close (detected by Verification-section items approaching completion): emit a nudge listing `Passes at: Phase N` rows not yet in `State: passing`
- [ ] **Fix `validate-impl-structure.js` cwd detection (followup from Phase 1):** the hook's `findProjectRoot(event.cwd ?? process.cwd())` sometimes returns a directory that's not the project root when invoked from VS Code, causing OTel role-aware gate detection to fall back to its default (gate enabled) even on `otel.role: library` projects. Fix by walking up from `toolInput.file_path` instead — the file being edited is always inside the project, so its directory chain reliably contains `.indusk/`. Add a test fixture that mocks `event.cwd` set to `/` (outside any project) and asserts the hook still reads the correct `otel.role`.
- [ ] Write integration tests T15–T19 using a fixture impl.md and mock phase-transition events
- [ ] Update the `State` column of this plan's own trajectory during execution (self-referential; the work skill's behavior in Phase 3 applies to its own trajectory starting Phase 4)

#### Phase 3 Verification

- [ ] T15 passes
- [ ] T16 passes
- [ ] T17 passes
- [ ] T18 passes
- [ ] T19 passes
- [ ] `pnpm check` passes
- [ ] Manual sanity: simulate a Phase 1 close on a throwaway impl where one `Passes at: Phase 1` test is still `written`; verify `check-gates` blocks with a clear error naming the row

#### Phase 3 Context

- [ ] Update CLAUDE.md Conventions: add bullet "Phase close requires every `Passes at: Phase N` trajectory row to be in `State: passing` (or `skipped` with a reason). The `check-gates` hook enforces this structurally — deferral is impossible by construction."
- [ ] Update CLAUDE.md Known Gotchas: add "The work skill's automatic `State` column updates depend on Vitest output format. Tests in runners that don't emit Vitest-compatible JSON reporter output must update their `State` manually; document which runners are auto-tracked in the VitePress guide."

#### Phase 3 Document

- [ ] Update `apps/indusk-docs/src/reference/skills/work.md` with the State-lifecycle diagram and the phase-close enforcement contract. User-facing guide tying skills + hooks + trajectory together remains Phase 5.

### Phase 4: Verify, Retrospective, Lesson

**Goal:** Complete the remaining skill updates, wire the retrospective audit, and land the community lesson.

#### Implementation

- [ ] Update `apps/indusk-mcp/skills/verify/SKILL.md`:
  - Add handling for test ID references: when the user says "run T1" or when a Verification item says "T1 passes", resolve the ID to its test file via the trajectory's `Asserts` column + convention-based file path
  - Document the resolution algorithm and fallback (prompt the user if ambiguous)
- [ ] Update `apps/indusk-mcp/skills/retrospective/SKILL.md`:
  - Add an audit step: walk the trajectory, report any row that ended the plan in `blocked` state without explanation, report any Deferred Verification row whose `mitigation:` text was never wired up (grep for telemetry names, linked plan IDs, doc paths — if none exist in the codebase, flag it)
  - Audit finding format: Graphiti-captured as `retrospective-audit-{plan-slug}` with structured fields
- [ ] Write `apps/indusk-mcp/lessons/tests-first-within-each-phase.md` — content per ADR Section 9
- [ ] Integration tests T20–T22
- [ ] Update this impl's own trajectory `State` column for Phase 1–3 rows as they complete (dogfood the work skill behavior)

#### Phase 4 Verification

- [ ] T20 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- lesson`)
- [ ] T21 passes
- [ ] T22 passes
- [ ] `pnpm check` passes
- [ ] Manual sanity: invoke `/retrospective` on a fixture impl that has a Deferred Verification row with a fake `mitigation:` (non-existent telemetry name); confirm the audit flags it

#### Phase 4 Context

- [ ] Update CLAUDE.md Conventions: add bullet "Retrospectives audit the trajectory — any `blocked` rows without resolution and any `Deferred Verification` row whose mitigation is not implemented become retrospective findings."

#### Phase 4 Document

- [ ] Link the new lesson from the lessons registry page
- [ ] Update `apps/indusk-docs/src/reference/skills/retrospective.md` and `verify.md` with the new behaviors

### Phase 5: Docs, CLAUDE.md, and Agent-Roles Retrofit

**Goal:** User-facing documentation lands, project context is updated comprehensively, and `agent-roles/impl.md` is retrofitted as the dogfood exemplar — the visible proof that the pipeline works end-to-end.

#### Implementation

- [ ] Write `apps/indusk-docs/src/guide/test-trajectory.md`:
  - Motivation (origin story: universal deferral in numero retrospectives)
  - The shape (table columns, Deferred Verification structure, phase references)
  - Rules (four validator rules + `check-gates` enforcement)
  - Worked example (a small plan with 5 tests across 3 phases, showing the full State lifecycle)
  - Vocabulary mapping (where `writable-at-phase` comes from, Beck's "test list" lineage, etc.)
  - Anti-patterns and how to avoid them
- [ ] Add the new page to `apps/indusk-docs/.vitepress/config.ts` sidebar under "Process"
- [ ] Update `apps/indusk-docs/src/reference/skills/planner.md` to link the guide
- [ ] Update `CLAUDE.md` Key Decisions section with a bullet linking to this ADR
- [ ] Update `CLAUDE.md` Known Gotchas with: "Test Trajectory `Writable at ≤ Passes at` (by phase number) is enforced by the validator — if a reorder breaks this, the hook fails at write time. This is intentional friction, not overhead."
- [ ] Retrofit `.indusk/planning/agent-roles/impl.md`:
  - Insert a Test Trajectory section after the Boundary Map
  - For each of the 4 existing phases, enumerate tests that would validate it and assign `Writable at` / `Passes at` phase numbers
  - Rewrite each phase's Verification block to reference test IDs
  - Ensure the resulting file passes all four new validator rules
- [ ] Update this plan's own trajectory `State` column for Phase 1–4 rows to `passing` as they complete; finalize Phase 5 rows at end

#### Phase 5 Verification

- [ ] T23 passes (`grep -q "Test Trajectory" /Users/the_dusky/code/sandbox/dusk/CLAUDE.md`)
- [ ] T24 passes (file existence check + sidebar entry check + link-from-planner-skill check)
- [ ] T25 passes — the retrofit test. Run `validateTrajectory` against `agent-roles/impl.md`; expect zero errors
- [ ] `pnpm check` passes
- [ ] `pnpm turbo test` passes (full suite)
- [ ] Manual sanity: open `agent-roles/impl.md` in the IDE, visually confirm the Test Trajectory is present and sensible; attempt an edit that violates a validator rule (e.g., introduce an orphan test ID reference) and verify the validator blocks it

#### Phase 5 Context

- [ ] Update CLAUDE.md Current State paragraph with a bullet "Test Trajectory is now the canonical shape for every new impl document. `tests-first-planning` plan archived — see docs site for the guide. `agent-roles` is the first plan executing under the new shape."

#### Phase 5 Document

- [ ] Publish the VitePress docs page (happens automatically on merge to main if docs build passes)
- [ ] Add a changelog entry to the docs site noting the new shape and its enforcement
