---
title: "Impl tasks are written as instructions"
date: 2026-10-17
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
falsification: skipped
falsification_reason: "Only instruction text and the tests that read it changed; no code path to break."
cleanup: skipped
cleanup_reason: "One small test helper duplicated across two files; left as is (Sandy)."
approved_brief: "68e5c8933f4f0c3d3c62ba16ecb0537a828ef0a60d5cdfd59f16450e51517ea8"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T17:44:15.988Z"
---

# Impl tasks are written as instructions

## Goal

A task in a new impl reads as work to do and a verification item as what must
hold, so a person reading a phase can tell the work from the checks.

## Scope

### In Scope

- The planner's impl instructions and template, the falsify and cleanup phase
  templates, and the planning rules shipped to projects.
- The promise `an-impl-phase-explains-itself` says the new sentence.

### Out of Scope

- A check that refuses a task written as a state.
- Rewriting impls already written.
- Clauses listed per task or per phase: `a-plan-page-shows-its-clauses`.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the wording tests, red | the brief |
| Build Phase 1 | the new wording in the skills and the planning rules; the changed promise | the wording tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | The planner's impl instructions say a task is an instruction and a verification item what must hold, with a before-and-after pair | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts |
| A2 | Every task placeholder in the impl, falsify and cleanup templates asks for an instruction; every verification placeholder for what must hold | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts, apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts |
| A3 | The planning rules a project is shipped say the same, and its copy matches the package's | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts |
| A4 | The templates still pass the save check as written, and an impl written before still validates | Test Phase 1 | Test Phase 1 | passing | unit | promise: hidden-detail-is-only-read | apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts, apps/indusk-mcp/src/__tests__/phase-summary-existing-impls.test.ts |
| A5 | No file outside the archives and history teaches a task as a statement of what will be true | Build Phase 2 | Build Phase 2 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/task-wording-gone.test.ts |
| A6 | The gate tasks under each phase's OTel, Context and Document headings in the templates also ask for instructions | Build Phase 2 | Build Phase 2 | passing | unit | promise: an-impl-phase-explains-itself | apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts, apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts |

## Checklist

### Test Phase 1: Write the wording tests, red

**Tier**: med — the work step's default

This phase writes the tests that read the planner's instructions and fail
while they still tell a task to say what will be true. Build Phase 1 changes
the wording until they pass.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start bugfix impl-tasks-are-instructions`; check with `indusk worktree list`.

  </details>
- [x] Write the tests that read the planner's impl instructions, its templates and the shipped planning rules for the instruction wording, and see them fail.
  <details><summary>Technical</summary>

  A1 and A3 in `planner-impl-summary-template.test.ts`: step 7's phase-summary paragraph says "one plain instruction saying what to do" and "what must hold", carries a before-and-after pair, and no longer says "what will be true when it is done"; `templates/planning/CLAUDE.md` says the same. A2: every `- [ ] {…}` placeholder under a task position in the impl template (in `planner-impl-summary-template.test.ts`) and in the falsify and cleanup templates (in `ritual-templates-phase-summary.test.ts`) asks for an instruction; verification placeholders ask for what must hold.

  </details>
- [x] Shape — reviewed a file this phase changed and left it as it is
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts`: its placeholder-lines helper repeats the one in planner-impl-summary-template.test.ts; cross-file duplication is /cleanup's at plan close, and each test file reads on its own

  </details>

#### Regression Guards

- **A4** — the existing save-check and older-impl tests; they pass now and must stay passing.

#### Test Phase 1 Verification

- [x] The new wording tests fail on their own assertions, and the existing save-check tests pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/planner-impl-summary-template.test.ts src/__tests__/ritual-templates-phase-summary.test.ts src/__tests__/phase-summary-existing-impls.test.ts` — A1–A3 red on assertions; A4 green.

  </details>

#### Test Phase 1 Context

- [x] Record in this session's section that the plan is at Test Phase 1 with its wording tests red.
  <details><summary>Technical</summary>

  current.md: via `mcp__indusk__update_current_section` at handoff.

  </details>

#### Test Phase 1 Document

- [x] Note in the test plan that the tests read instructions as text.
  <details><summary>Technical</summary>

  Already in `test-plan.md` Purpose; confirm it still matches the tests written.

  </details>

### Build Phase 1: Change the wording everywhere an impl is written from

**Tier**: med — the work step's default

This phase rewrites the planner's instructions, its impl template, the falsify
and cleanup templates and the planning rules so a task is an instruction and a
verification item an end state, then changes the promise's sentence to match.

- [x] Rewrite the planner's phase-summary paragraph so a task is an instruction and a verification item states what must hold, with a before-and-after pair.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md` step 7, "Open each phase with a summary": replace "Each task is one plain sentence saying what will be true when it is done" with "Each task is one plain instruction saying what to do ("Make the prompt box's text area use the app's font"); each verification item is one plain statement of what must hold". Before/after pair: "The prompt box draws in the app's font" → "Make the prompt box's text area use the app's font".

  </details>
- [x] Reword every task placeholder in the planner's impl template, and in the falsify and cleanup templates, as an instruction.
  <details><summary>Technical</summary>

  `planner.md` `### impl.md` block; `skills/falsify.md` and `skills/cleanup.md` phase-summary shapes. Verification placeholders keep "what must hold".

  </details>
- [x] Reword the shipped planning rules to match.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/planning/CLAUDE.md`, the `phase_summary: required` entry: "each task is one plain instruction … each verification item a plain statement of what must hold".

  </details>
- [x] Resync the project's copies of the skills and the planning rules from the package.
  <details><summary>Technical</summary>

  `.claude/skills/{planner,falsify,cleanup}.md` and `.indusk/planning/CLAUDE.md` from the package (`indusk update` or the sync script); `skill-sync-parity.test.ts` must pass.

  </details>
- [x] Change the promise's sentence to say tasks are instructions and verification items what must hold.
  <details><summary>Technical</summary>

  `indusk promises change an-impl-phase-explains-itself --plan impl-tasks-are-instructions --statement "Every phase of a new impl opens with a plain summary saying what it does for the whole plan; every task is one plain instruction saying what to do, and every verification item one plain statement of what must hold, each with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused." --reason "a checklist of outcomes hid the work from the checks (Sandy)"`

  </details>
- [x] Review the changed instructions against the extensions' writing rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 1 Verification

- [x] The wording tests, the save-check tests and the skill copy check all pass.
  <details><summary>Technical</summary>

  A1–A4: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/planner-impl-summary-template.test.ts src/__tests__/ritual-templates-phase-summary.test.ts src/__tests__/phase-summary-existing-impls.test.ts src/__tests__/skill-sync-parity.test.ts`

  </details>

#### Build Phase 1 Context

- [x] Make the shipped planning rules carry the new wording, which is where an agent writing an impl reads it.
  <details><summary>Technical</summary>

  planning: `templates/planning/CLAUDE.md` (done above); nothing for the root.

  </details>

#### Build Phase 1 Document

- [x] Update the planner's reference page and the changelog.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/plan.md`, "Phase summaries for a reader without the shorthand": tasks as instructions, with the before-and-after pair; `apps/docs/src/changelog.md`.

  </details>

### Build Phase 2: Fix what the audit found

**Tier**: med — the work step's default

The cold audit found the old wording still taught in places this plan never
listed: the bugfix and refactor impl templates, the gate tasks inside the
three skills' templates, the Shape step's code, the save check's refusal
messages and three docs pages. This phase first writes one test that fails
while any file outside the archives still teaches a task as an outcome, then
rewords every place it names, so the change cannot be partial again.

- [x] Write a test that fails while any file outside the archives and history still teaches a task as a statement of what will be true, and see it fail.
  <details><summary>Technical</summary>

  A5 in `apps/indusk-mcp/src/__tests__/task-wording-gone.test.ts`, carrying `promise: an-impl-phase-explains-itself`: scan the package's `skills/`, `templates/`, `hooks/`, `src/lib/` (non-test) and `apps/docs/src/` (excluding `changelog.md`, `decisions/`, `lessons/`) and the project's `.claude/`; fail naming each file and line where a task (not a promise, brief or ADR line) is taught as "what will be true" or "one plain sentence" without "instruction". Grep first: `grep -rn -i 'what will be true\|one plain sentence' apps/indusk-mcp/{skills,templates,hooks,src/lib} apps/docs/src .claude`. Promise and brief wording is correct and exempt.

  </details>
- [x] Widen the template test so the gate tasks under each phase's other headings also ask for instructions, and see it fail.
  <details><summary>Technical</summary>

  A6: extend A2's tests in `planner-impl-summary-template.test.ts` and `ritual-templates-phase-summary.test.ts` to the OTel, Context and Document task placeholders.

  </details>
- [x] Reword the bugfix, refactor and feature impl templates' task placeholders as instructions.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/workflows/{bugfix,refactor,feature}.md`.

  </details>
- [x] Reword the gate task placeholders in the planner, falsify and cleanup templates as instructions.
  <details><summary>Technical</summary>

  OTel, Context and Document placeholders in `skills/planner.md`, `skills/falsify.md`, `skills/cleanup.md`.

  </details>
- [x] Reword the Shape step's written item and the save check's refusal messages.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/shape/` (the item it writes), `apps/indusk-mcp/hooks/_phase-summary.js`, `apps/indusk-mcp/hooks/validate-impl-structure.js`, and `src/__tests__/helpers/phase-summary-fixture.ts` if it carries the old text; keep any test asserting a refusal message in step.

  </details>
- [x] Reword the docs guide pages that still teach the old rule.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/test-trajectory.md`, `apps/docs/src/guide/briefs.md`, and any other page A5 names.

  </details>
- [x] Resync the project's copies of the skills and hooks.
  <details><summary>Technical</summary>

  `.claude/skills/{planner,falsify,cleanup}/SKILL.md`, `.claude/hooks/{_phase-summary,validate-impl-structure}.js` from the package; `skill-sync-parity.test.ts` and any hook parity test pass.

  </details>
- [x] Review the changed text and code against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] The gone test, the widened template tests and every earlier row pass, and the hooks' own tests still pass.
  <details><summary>Technical</summary>

  A1–A6: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/task-wording-gone.test.ts src/__tests__/planner-impl-summary-template.test.ts src/__tests__/ritual-templates-phase-summary.test.ts src/__tests__/phase-summary-existing-impls.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/phase-summary-rule.test.ts`, then `pnpm --filter @infinitedusky/indusk-mcp exec vitest related` on the changed files.

  </details>

#### Build Phase 2 Context

- [x] Make the gone test name what it guards, so the old wording cannot return unnoticed.
  <details><summary>Technical</summary>

  guard: `task-wording-gone.test.ts` carries `promise: an-impl-phase-explains-itself`, and `lesson: <name>` once the evaluator writes the lesson from this plan's highlight.

  </details>

#### Build Phase 2 Document

- [x] Extend the changelog line to cover the audit's fixes.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`: the templates, the Shape item, the save check's messages and the guides.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/skills/planner.md` | task wording, template placeholders |
| `apps/indusk-mcp/skills/falsify.md`, `apps/indusk-mcp/skills/cleanup.md` | template placeholders |
| `apps/indusk-mcp/templates/planning/CLAUDE.md` | the shipped rule |
| `.claude/skills/*`, `.indusk/planning/CLAUDE.md` | resynced copies |
| `apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts`, `ritual-templates-phase-summary.test.ts` | A1–A3 |
| `apps/docs/src/reference/skills/plan.md`, `apps/docs/src/changelog.md` | docs |

## Dependencies

- None.
