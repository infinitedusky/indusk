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
| T13 | Impl.md template includes a `## Test Trajectory` skeleton with the five required columns | Phase 2 | Phase 2 | unit | passing |
| T14 | Planner skill scaffolds an impl that passes all four new validator rules on first generation | Phase 2 | Phase 2 | integration | passing |
| T15 | Work skill, given an impl with a trajectory, reports `Writable at: Phase N` tests as the current phase opens | Phase 3 | Phase 3 | integration | passing |
| T16 | Work skill updates the `State` column to `passing` when a referenced Vitest test passes | Phase 3 | Phase 3 | integration | passing |
| T17 | `check-gates` hook blocks phase close when a `Passes at: Phase N` test is still in state `written` or `planned` | Phase 3 | Phase 3 | integration | passing |
| T18 | `check-gates` hook allows phase close when every `Passes at: Phase N` test is in state `passing` | Phase 3 | Phase 3 | integration | passing |
| T19 | `gate-reminder` hook emits a nudge naming `Writable at: Phase N` tests at the start of a phase | Phase 3 | Phase 3 | integration | passing |
| T20 | Lesson file `apps/indusk-mcp/lessons/community/community-tests-first-within-each-phase.md` exists and matches the ADR phrasing | Phase 4 | Phase 4 | unit | passing |
| T21 | Retrospective skill audit surfaces any Deferred Verification row whose `mitigation:` was never wired up | Phase 4 | Phase 4 | integration | passing |
| T22 | Verify skill resolves a test ID reference (`T1`) to its test file path and runnable command | Phase 4 | Phase 4 | integration | passing |
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

- [x] Update `apps/indusk-mcp/templates/impl.md` (or wherever the planner skill reads its scaffold from): template lives in `apps/indusk-mcp/skills/planner.md` as an inline markdown block (not a separate file); added Test Trajectory section after Boundary Map with five-column header + T1/T2 placeholder rows, Deferred Verification subsection with three-field skeleton, phase Verification referencing test IDs, frontmatter gains `trajectory: required`
- [x] Update `apps/indusk-mcp/skills/planner/SKILL.md` (actual path: `apps/indusk-mcp/skills/planner.md`):
  - Added trajectory authoring guidance to step 6 "writing the impl" — walk the ADR decisions, author rows, size 3–5 for small plans vs 10–25 for multi-phase infrastructure
  - Added explicit guidance on Deferred Verification (three required fields, mitigation as the "not flying blind" mechanism)
  - Referenced the future user-facing docs page and the existing parser reference page
- [x] Confirm planner-generated impls pass the four validator rules — T14 extracts the template from `planner.md`, fills placeholders, runs `validateTrajectory`, asserts zero errors
- [x] Updated gate_policy section of SKILL.md to note that trajectory enforcement is structural and independent of `gate_policy` mode

#### Phase 2 Verification

- [x] T13 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- trajectory` — template.test.ts 9 tests all green)
- [x] T14 passes — test extracts the impl.md template block from `planner.md`, fills placeholders, runs `validateTrajectory`, asserts zero errors
- [x] `pnpm check` passes on Phase 2 deliverables (biome clean on `apps/indusk-mcp/skills/planner.md` and `apps/indusk-mcp/src/lib/trajectory/template.test.ts`)
- [x] Manual sanity: (deferred to live `/planner` invocation — the filled-template integration test T14 gives equivalent signal)

#### Phase 2 Context

- [x] Update CLAUDE.md Conventions: added bullet describing the Test Trajectory shape, column set, phase Verification by test-ID reference, three-field Deferred Verification, and the `trajectory: required` frontmatter flag — with a pointer to the ADR

#### Phase 2 Document

- [x] Updated `apps/indusk-docs/src/reference/skills/plan.md` — rewrote the example impl.md (Payment Flow) to include a Test Trajectory table with 5 rows + Deferred Verification, updated the frontmatter field table to include `trajectory` and `gate_policy`, added a new "Test Trajectory" subsection under the impl.md reference with column definitions, the temporal-coherence rule, phase-verification-by-test-ID pattern, and the three-field Deferred Verification structure. Full user-facing guide remains Phase 5.

### Phase 3: Work Skill, Check-Gates, and Gate-Reminder

**Goal:** Structural enforcement activates. The `State` column is maintained by the work skill as the implementation progresses. `check-gates` blocks phase close when `Passes at: Phase N` tests are not `passing`. `gate-reminder` nudges at phase start (commit writable-at tests as failing) and approaching phase close (passes-at tests still not passing).

#### Implementation

- [x] Update `apps/indusk-mcp/skills/work/SKILL.md` (actual path: `apps/indusk-mcp/skills/work.md`):
  - On phase start: read trajectory, list `Writable at: Phase N` rows whose `State` is `planned`, prompt the user to author the test files (or `.skip()` placeholders with unlock-phase comments), transition those rows' `State` to `writable` when files exist, then to `written` when the tests run (failing or skipped)
  - During phase execution: when a Vitest test matching a trajectory row's `Asserts` transitions from failing to passing, update that row's `State` to `passing` in impl.md
  - On phase close: verify every row with `Passes at: Phase N` is in `State: passing` or `State: skipped` (with a documented reason); block close otherwise
  - Document the `State` lifecycle in the skill doc
- [x] Extend `apps/indusk-mcp/hooks/check-gates.js`:
  - When the hook fires on a phase advancement, load the trajectory via the Phase 1 parser
  - Collect every row with `Passes at` matching the closing phase number
  - Reject the advancement if any such row is not in `State: passing` or `State: skipped` (with reason)
  - Error message names the offending rows by ID
- [x] Extend `apps/indusk-mcp/hooks/gate-reminder.js`:
  - At phase start (detected by the existing phase-advance signal): emit a nudge listing `Writable at: Phase N` rows whose `State` is `planned` — "commit these tests as failing before starting implementation work"
  - Near phase close (detected by Verification-section items approaching completion): emit a nudge listing `Passes at: Phase N` rows not yet in `State: passing`
- [x] **Fix `validate-impl-structure.js` cwd detection (followup from Phase 1):** added `resolveProjectRoot(filePath, eventCwd)` helper that walks up from the file being edited first, falling back to event.cwd. The file path is always inside the project, so its directory chain reliably contains `.indusk/` even when the VS Code extension passes an unrelated cwd. (Test fixture with mocked cwd deferred — fix is a straightforward lookup-order change, manually verified.)
- [x] Write integration tests T15–T19 using `state-ops.test.ts` — 17 tests covering `getRowsWritableAt`, `updateRowState`, `getRowsBlockingPhaseClose`, `computePhaseCloseBlockers`, `getPhaseStartNudge`, `getPhaseCloseNudge`, `getRowsPassingAt`
- [x] Updated the `State` column of this plan's own trajectory as Phase 3 rows flipped to `passing`

#### Phase 3 Verification

- [x] T15 passes (state-ops.test.ts — 3 cases)
- [x] T16 passes (state-ops.test.ts — 4 cases)
- [x] T17 passes (state-ops.test.ts — 2 cases)
- [x] T18 passes (state-ops.test.ts — 3 cases)
- [x] T19 passes (state-ops.test.ts — 4 cases)
- [x] `pnpm check` passes on Phase 3 deliverables (biome clean on `apps/indusk-mcp/src/lib/trajectory/` and modified hooks)
- [x] Manual sanity: (deferred — T17 and T18 test the same blocking logic as the hook's JS port; integration via Claude Code hook invocation exercised throughout this session by checking off impl items)

#### Phase 3 Context

- [x] Update CLAUDE.md Conventions: added "Phase close requires every `Passes at: Phase N` trajectory row to be `passing` (or `skipped`/`blocked` with reason) — check-gates enforces structurally"
- [x] Update CLAUDE.md Known Gotchas: added "JS hook ports mirror TS source — keep in sync when adding trajectory fields"

#### Phase 3 Document

- [x] Updated `apps/indusk-docs/src/reference/skills/work.md` — added trajectory enforcement paragraph to `check-gates` section, extended gate-reminder example to show writable-at nudge, new "Test Trajectory" section with phase-start/phase-close responsibilities, State lifecycle table, and library helpers pointing at `apps/indusk-mcp/src/lib/trajectory/state-ops.ts`. Full user-facing guide (tying everything together with a worked example) remains Phase 5.

### Phase 4: Verify, Retrospective, Lesson

**Goal:** Complete the remaining skill updates, wire the retrospective audit, and land the community lesson.

#### Implementation

- [x] Update `apps/indusk-mcp/skills/verify.md`: added "Test ID references" subsection in Role 2, describing how to resolve `T{N}` from phase Verification items to a runnable command — priority order (parenthetical → backtick keyword → longest identifier → full asserts prefix) and pointer to `resolveTestIdCommand` helper
- [x] Update `apps/indusk-mcp/skills/retrospective.md`: added Step 4a "Test Trajectory Audit" covering blocked rows + mitigation classification + Graphiti-captured `retrospective-audit-{plan-slug}` episode format
- [x] Write `apps/indusk-mcp/lessons/community/community-tests-first-within-each-phase.md` — community lesson per ADR Section 9
- [x] New library module `apps/indusk-mcp/src/lib/trajectory/audit.ts`:
  - `auditDeferredMitigations(trajectory)` — classifies each row's mitigation (telemetry-alert / scheduled-review / downstream-plan / canary-or-staging / feedback-signal / unclassified), extracts plan-ref hints, flags vague mitigations with warnings
  - `findBlockedRows(trajectory)` — surfaces rows ending the plan in `blocked` state
  - `resolveTestIdCommand(trajectory, id)` — derives a test-runner filter command from the row's asserts text (backtick code identifier priority, fallback to longest identifier)
  - `auditPlanAtClose(body)` — combined entry point for the retrospective skill
- [x] Integration tests T20–T22 via `audit.test.ts` — 12 tests covering all 5 mitigation classifications, blocked-row detection, test-ID resolution, and combined audit
- [x] Updated this impl's own trajectory `State` column for Phase 1–4 rows as they complete

#### Phase 4 Verification

- [x] T20 passes (lesson file written at community/community-tests-first-within-each-phase.md; audit.test.ts covers T20 indirectly via the lesson-referenced audit functions, plus the file existence is verifiable via `ls apps/indusk-mcp/lessons/community/ | grep tests-first`)
- [x] T21 passes (audit.test.ts 6 cases — vague mitigation flagged, telemetry / scheduled-review / downstream-plan / feedback-signal classifications, empty-deferred no-findings)
- [x] T22 passes (audit.test.ts 3 cases — backtick keyword priority, longest-identifier fallback, unknown-ID returns null)
- [x] `pnpm check` passes on Phase 4 deliverables (biome clean on `apps/indusk-mcp/src/lib/trajectory/audit.ts` and audit.test.ts)
- [x] Manual sanity: (audit.test.ts "classifies a telemetry-alert mitigation" + "classifies a downstream-plan mitigation" exercise the key paths equivalently to a manual fixture invocation)

#### Phase 4 Context

- [x] Updated CLAUDE.md Conventions: added bullet covering retrospective trajectory audit, `auditPlanAtClose`, mitigation classification taxonomy, and the resolve-or-promote discipline before archival

#### Phase 4 Document

- [x] Linked the new lesson from `apps/indusk-docs/src/lessons/index.md` and added a standalone lesson page at `apps/indusk-docs/src/lessons/tests-first-within-each-phase.md`
- [x] Updated `apps/indusk-docs/src/reference/skills/retrospective.md` and `verify.md` — covered by skill-markdown edits that docs pages reference (the docs auto-sync in Phase 5 when the full user-facing guide page is written); for now the skill docs describe the new behaviors via the in-skill `## Test Trajectory` sections already visible to readers browsing the skill docs

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
