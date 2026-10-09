---
title: "plan-review-subagent — the audit step"
date: 2026-10-09
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# plan-review-subagent — the audit step

## Goal

Every plan is read once before it closes by a reader that did not build it, on the tier the config names, and what it finds is written to `audit.md`, which the retrospective must see exist. Findings block nothing.

## Scope

### In Scope
- The ritual word `audit` in the retrospective's readiness, in `plans next`, in `plans next-session`, and in the build runner.
- `audit: skipped` + `audit_reason` in the impl frontmatter, as the other two rituals' skip pairs.
- `indusk plans audit-inputs <plan>`: the documents and diff the auditor gets, with the impl as approved found by the approval merge.
- `indusk plans model <plan> --step audit`; `audit` in `TIER_STEPS`.
- The `/audit` skill: spawns the reader on the tier's model with the inputs and a fixed question list; `audit.md` in a fixed shape.
- The retrospective skill's Step 0 naming the audit.
- The planner writing a `**Tier**:` line under every phase (model-per-phase decided it and did not land it): the skill's impl step, the planning rules and the impl template.

### Out of Scope
- The admin showing `audit.md` (follow-up).
- `RITUAL_ORDER` and the admin's activity names: the audit is a document, not a phase.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A3, A5–A8 red over the CLI and the gate; A10–A12 as regression guards | today's `plans next`, `next-session`, `plans model`, `plans review` |
| Build Phase 1 | `isAuditSkipped`, `audit` in `checkRetrospectiveReadiness.missing`, `nextBuildStep` → `audit`, `nextSession` → `/audit`, `BuildStepName` + `stepPrompt` for `audit` | `cleanup/gate.ts`, `build/next-step.ts`, `models/next-session.ts`, `build/runner.ts` |
| Build Phase 2 | `lib/audit/inputs.ts` (`auditInputs`, `approvalMerge`), `plans audit-inputs`, `audit` in `TIER_STEPS`, `plans model --step` | `plans/plan-branch.ts` (`branchFileChanges`), `models/tiers.ts` |
| Build Phase 3 | `skills/audit.md`; the retrospective skill's Step 0; `plans next`'s wording; docs | Build Phases 1–2 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan with every phase closed, falsification and cleanup done, and no audit.md: the readiness check lists `audit` as missing, and `indusk plans next` answers `audit` rather than `review` | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A2 | The same plan with audit.md present, or with `audit: skipped` and `audit_reason` in the impl frontmatter, passes readiness and `plans next` answers `review`; a bare `audit: skipped` with no reason does not | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A3 | When the cleanup phase closes, the next-session line names `/audit <plan>`; once audit.md exists it names `/retrospective <plan>` | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/lib/models/next-session.test.ts |
| A4 | An admin build whose cleanup step has ended runs the audit step next, and still stops at the person's review without being asked | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes, promise: a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/build/runner.test.ts |
| A5 | `indusk plans audit-inputs <plan>` lists the brief, the test plan, the ADR, the impl as approved, the trajectory table as it stands, the branch's diff against the trunk, and a `--stat` of the whole tree — and nothing else: no research, no current.md | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A6 | After falsification and cleanup have appended phases to the impl, the impl the auditor gets is still the one merged at approval and holds none of those phases, while its trajectory table shows every row's final state; a plan with no approval merge is refused, naming it | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A7 | The diff the auditor gets holds the plan's code and docs and leaves out InDusk's bookkeeping (`.indusk/`) | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A8 | With `workflow.steps.audit.tier` set, `indusk plans model <plan> --step audit` answers that tier's model; with no tiers it answers `session`; `audit` is accepted by the config reader and an unknown step is refused naming it | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-auditor-runs-on-its-tier | apps/indusk-mcp/src/__tests__/plans-model.test.ts |
| A9 | Claude Code runs the audit handed to it on the named model and writes audit.md, observed once against the real `claude` on a scratch plan | Build Phase 3 | Build Phase 3 | passing | live check | a live check of Claude Code, not a unit: the model the Agent reports and the file it writes are recorded under Build Phase 3 (A8 proves the promise in code) | .indusk/planning/plan-review-subagent/impl.md |
| A10 | An audit.md full of findings leaves readiness passing and `plans next` at `review`; an empty audit.md does the same | Test Phase 1 | Test Phase 1 | passing | unit | promise: an-audit-blocks-nothing | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A11 | `indusk plans review` prints the same evidence with and without audit.md in the plan folder | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts |
| A12 | `plans model <plan> --phase <ref>` answers as before for a config with and without `steps.audit` | Test Phase 1 | Build Phase 2 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/__tests__/plans-model.test.ts |
| A13 | The planner writes a `**Tier**:` line under every phase it authors: the skill's impl step says so, the planning rules say so, and the impl template carries the line | Test Phase 1 | Build Phase 3 | passing | unit | the step model-per-phase decided ("the planner decides each phase's model when it writes the phase") and never landed — a pin over the skill's text, since prose has no other test | apps/indusk-mcp/src/__tests__/planner-tier-line.test.ts |
| A14 | An admin build runs each step's session on the model its tier names: a `work` step on its phase's model (the phase's `**Tier**:` line, or the work step's default), `falsify`/`cleanup`/`audit`/`retrospective` on their step's default tier; a project with no tiers passes no model, and the session runs on `claude`'s own | Build Phase 2 | Build Phase 2 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/build/step-model.test.ts |
| A15 | The diff the auditor gets holds none of the impl's changes since approval: a plan whose branch appended a falsification phase and a cleanup phase to its impl yields a `diff` with neither phase's title nor any line under `.indusk/`, while the code file is still there | Build Phase 4 | Build Phase 4 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A16 | The approved impl is named by a path the reader cannot mistake for the working file: `implAsApproved.path` is `<approvedAt>:<plan dir>/impl.md`, and `git show` of that path in the trunk prints `implAsApproved.text`; the working copy's `impl.md` path appears in no field but `trajectoryNow` | Build Phase 4 | Build Phase 4 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A17 | The inputs carry the files the plan did not touch: a tracked file the branch never changed appears in the inputs' `tree`, and is absent from `stat` | Build Phase 4 | Build Phase 4 | passing | unit | promise: the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A18 | A workbench plan approved with `indusk plans approve` and built on its repo's plan branch gets its inputs: `plans audit-inputs` exits 0, `implAsApproved` is the impl at the root's `plan(<plan>): approved` commit, and `diff` is the code repo's plan branch against its trunk | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/plans-workbench.test.ts |
| A19 | An impl with `audit: skipped` and `audit_reason` shows the audit among `plans review`'s skipped rituals with its reason, and the admin's review panel words it "Audit skipped", never "Cleanup skipped" | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-review-shows-its-evidence | apps/indusk-mcp/src/__tests__/plans-review.test.ts, apps/indusk-admin/src/components/session/ReviewPanel.test.tsx |

## Checklist

### Test Phase 1: The gate, the next step, the inputs and the tier, red over their boundaries

**Tier**: med

**Goal**: author every row that reaches its subject over a boundary today — the CLI (`plans next`, `plans audit-inputs`, `plans model --step`, `plans review`) and the readiness function — and register the two that cannot be.

- [x] Create/confirm this plan's worktree (`indusk worktree create plan-review-subagent`; made by `indusk plans start` on 2026-10-09 at `dusk-worktrees/plan-review-subagent`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A1, A2, A10 in `audit-gate.test.ts`: a plan-lifecycle fixture with every phase closed, falsification and cleanup phases terminal, every row passing and its promise proven; `checkRetrospectiveReadiness` (through `tsx`, as `cleanup-gate.test.ts` reads it) and `indusk plans next` over the CLI, with no audit.md, with audit.md, with the skip pair, with a bare skip. RED today: readiness never lists `audit`, `plans next` answers `review` in every case. A10 is green on arrival (see Regression Guards).
- [x] A3 in `next-session.test.ts`: `nextSession(plan, impl with every phase closed, { readiness: { missing: ["audit"] } })` names `/audit <plan>`; with `missing: []` names `/retrospective`. RED today: `audit` in `missing` falls through to `/retrospective`.
- [x] A5, A6, A7 in `plans-audit-inputs.test.ts`: a plan approved with `indusk plans approve` in the lifecycle fixture, then a commit appending a `### Build Phase 2: Falsification — x` phase to the impl and a code file outside `.indusk/`, then `indusk plans audit-inputs <plan>` read as JSON. RED today: the command does not exist (exit 1, unknown command).
- [x] A8 and A12 in `plans-model.test.ts`: `--step audit` with `steps.audit.tier: strong` answers `strong opus`; with no tiers, `session`; `--step huge` is refused naming it; `--phase "Build Phase 1"` answers the same with and without `steps.audit` in the config. RED today for A8: `--step` is an unknown option. RED today for A12's with-`steps.audit` half: the config reader refuses the key (its baseline half passes).
- [x] A11 in `plans-review.test.ts`: the review's text with and without `audit.md` in the plan folder is identical. Green on arrival.
- [x] A13 in `planner-tier-line.test.ts`: `skills/planner.md`'s impl step (7), `templates/planning/CLAUDE.md` and the impl template in `skills/planner.md` each carry `**Tier**:` with the rule that every phase names its tier. RED today: none of the three mentions it.

#### Deferred to Build Phase 1

- **A4**: its subject is `BuildStepName` gaining `"audit"` and `nextBuildStep` answering `{ step: "audit" }`; a test naming either is a type error today. Body:

  ```typescript
  // runner.test.ts — promise: a-build-runs-to-review-unasked, promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes
  // A4: read() answers a plan whose readiness.missing is ["audit"] after the cleanup step ran;
  // runBuild's fake run() records the steps it was asked for: ["work", "falsify", "cleanup", "audit"];
  // the next read() answers missing: [] and the runner stops with { step: "review" }, accept never called.
  ```

#### Deferred to Build Phase 3

- **A9**: a live check of Claude Code — `/audit` on a scratch plan spawns an Agent on the configured tier's model; the model the Agent reports and the `audit.md` it writes are recorded under Build Phase 3.

#### Regression Guards

- **A10** — the gate passes today with any audit.md because it does not read one; the row guards that the audit's content never becomes a gate input.
- **A11** — `plans review` reads the impl, the registry and the branch today and ignores audit.md; the row guards that it keeps ignoring it.

(A12 was listed here when the impl was written. It is not green on arrival: the config reader refuses `steps.audit` until Build Phase 2 adds `audit` to `TIER_STEPS`, so the with-`steps.audit` half is a real red today. Its `Passes at` moved to Build Phase 2 on 2026-10-09 — a planning error, not a test change.)

#### Test Phase 1 Verification

- [x] A1, A2, A3, A5, A6, A7, A8, A12, A13 are authored and each fails on its own assertion; A10, A11 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/audit-gate.test.ts src/lib/models/next-session.test.ts src/__tests__/plans-audit-inputs.test.ts src/__tests__/plans-model.test.ts src/__tests__/plans-review.test.ts src/__tests__/planner-tier-line.test.ts`). The deferred bodies are reviewed: will they compile at the phase they name, and do they assert what they claim?
  - Run 2026-10-09: A1, A2, A3, A5, A6, A7, A8, A13 each fail on their own assertion (no file fails to load; the CLI-reaching rows get exit 1 or an unknown-command refusal, the gate rows get the wrong `missing`/step). A10 and A11 pass. **A12 does not pass**: the config reader refuses `steps.audit` today ("workflow.steps.audit is not a step InDusk reads"), so the with-`steps.audit` half is red until Build Phase 2 adds `audit` to `TIER_STEPS`; its Passes at is Test Phase 1 and was left as written, so this item stays open and the phase cannot close until that is resolved by a person.
  - Register, A4: the body compiles at Build Phase 1 only if `ready()` in `runner.test.ts` also gains the `auditOk` field that phase adds to `RetrospectiveReadiness` (otherwise tsc fails on the existing helper, not on A4), and it asserts what it claims (step order ends `audit`, then review, `accept` never called).
  - Register, A9: it is a description of a live check rather than code, so it cannot fail to compile, and what it records (the model the Agent reports and the `audit.md` written in the fixed shape) is exactly what the row claims; it proves nothing in CI, as the register says.

### Build Phase 1: The audit as a ritual word

**Tier**: strong — edits the readiness gate every plan's close goes through, and the build runner

**Goal**: the retrospective cannot start without `audit.md` or a reason; `plans next`, `plans next-session` and the build runner all know the step.

- [x] `lib/cleanup/gate.ts`: `isAuditSkipped(implContent)` (the shape of `isFalsificationSkipped`: both `audit: skipped` and a non-empty `audit_reason`), `isAuditComplete(planRoot)` (`audit.md` exists), `auditOk` in `RetrospectiveReadiness`, and `audit` in `missing` — after `cleanup`, before `rows`
- [x] (discovered) Three existing readiness tests whose fixtures meant "every ritual satisfied" now see `audit` missing: `cleanup-gate.test.ts` T13's passing case and `gate-row-terminality.test.ts`'s fixture gain `audit: skipped` + `audit_reason` (their assertions unchanged), and `lifecycle-parity`'s corpus snapshot (admin-ui-phase-progress A13, the guard that the readers' output over the plans on disk does not change) is re-baselined over the same folders, the only change being `audit` added to `missing` in 62 of them (`passes` false in the 14 that passed) — no archived plan has an audit.md
- [x] `lib/build/next-step.ts`: `{ step: "audit" }` in `BuildStep`, answered when `missing` holds `audit` and neither `falsification` nor `cleanup`
- [x] `lib/models/next-session.ts`: `audit` → `In a new session, run: /audit <plan>`
- [x] `lib/build/runner.ts`, `build-session.ts`: `audit` in `BuildStepName`; the runner runs it as it runs `falsify` and `cleanup`; `stepPrompt("audit", plan)` is `/audit <plan>` with the unattended text; `stepEnv` marks it a build step — `stepEnv` needed no change (it marks every step but the retrospective); `/work`'s prompt now also says not to run `/audit`; the admin's `build-host.ts` typed `run`'s step as the old four-word union and now takes `BuildStepName`
- [x] `bin/commands/plans.ts`: `describeStep` words `audit`
- [x] (discovered) `plans-next.test.ts` (admin-plan-authoring A11, the CLI walk from the first phase to review, and A14, rituals skipped with reasons answer review) answered `review` straight after cleanup: A11's walk now answers `audit` for the cleaned-up plan (it answered `review`) and gains a state after it, the same plan with an audit.md, answering `review`; A14's fixture gains the audit skip pair, its expectation unchanged
- [x] A4 in `runner.test.ts`, from the register — authored first, as RED (test-first: Writable at Build Phase 1): the runner ran `work, falsify, cleanup` and stopped at review; `ready()` gained `auditOk`
- [x] Shape (`apps/indusk-mcp/src/lib/build/runner.ts`) — spell the steps the runner runs as a session once — a `SESSION_STEPS` const that the `SessionStep` type and `isSessionStep` both read — so a fifth step is added in one place, not two. Rule: typescript: `as const` for literal types; one reason to change
- [x] Shape (`apps/indusk-mcp/src/lib/cleanup/gate.ts`) — reviewed, left as-is: `isAuditSkipped` is the third copy of the two-field skip check (`isCleanupSkipped` beside it, `isFalsificationSkipped` in `falsification/skip.ts`); merging them is cross-file duplication by the rule of three, which /cleanup owns at close, not Shape

#### Build Phase 1 Verification

- [x] A1, A2, A3, A4 pass; A10, A11, A12 still do (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/audit-gate.test.ts src/lib/models/next-session.test.ts src/lib/build/runner.test.ts src/__tests__/plans-review.test.ts && pnpm exec vitest related src/lib/cleanup/gate.ts src/lib/build/next-step.ts --run`); tsc and biome clean on the files changed
  - Run 2026-10-09: build exit 0; the four files 36/36 passed (A1, A2, A3, A4, A10, A11 green, CLI rows not skipped); `vitest related` on gate.ts and next-step.ts 8 files, 70/70. Also run: `vitest related` on runner.ts, build-session.ts, next-session.ts, plans.ts (25/25), `plans-next.test.ts`, promises-confirm, plans-approve, lifecycle-derive, falsification integration and `src/lib/build` (100/100), and the admin's whole suite (414/414). `tsc --noEmit` clean in indusk-mcp and indusk-admin; biome clean on every changed `.ts`. **A12 is not claimed**: its Passes at is Build Phase 2 (moved there at Test Phase 1's close), it is not in this command, and its with-`steps.audit` half stays red until `audit` joins `TIER_STEPS`; "A12 still does" in this item's text predates that move. The A1–A4 row states were set to `passing` in the edit before this one, not the same one.

#### Build Phase 1 Context

- [x] planning (`templates/planning/CLAUDE.md`, shipped): the close-out is `/falsify` → `/cleanup` → `/audit` → `/retrospective`; `audit.md` or `audit: skipped` + `audit_reason` is what the retrospective's gate reads
- [x] root (Key Decisions): one line for the ADR — "Audit step: a fresh subagent on `workflow.steps.audit.tier` reads the approved impl, the final trajectory and the diff, writes `audit.md`; advisory — see `/decisions/plan-review-subagent`" — always-on because it is a Key Decision, as every ADR's line is. The root is at 14,628 B of a 14,745 B ceiling (80 % of the budget, `context-tiers-register` A13), so the same edit compresses one existing Key Decisions line to a rule + pointer to make room; name which in the commit

#### Build Phase 1 Document

- [x] `reference/cli/plans.md`: `plans next` and `plans next-session` answer `audit`; `reference/skills/retrospective.md`: Step 0 names the audit and its skip pair

### Build Phase 2: The inputs and the tier

**Tier**: med

**Goal**: the package says what the auditor gets, and on which model.

- [x] `lib/audit/inputs.ts`: `approvalMerge(trunk, plan)` — the first-parent merge on the trunk whose subject starts `plan(<plan>): approved` (`git log --first-parent --merges --format=%H%x00%s`), or null; `auditInputs(checkout, plan)` returns `{ documents: { brief, testPlan, adr? }, implAsApproved, trajectoryNow, diff, stat }` as texts with their paths, the diff `git diff <merge-base>...<branch> -- <branch paths less .indusk/** except the plan's folder>`, the stat `git diff --stat <merge-base>...<branch>`; refuses (`AuditInputsRefusal`) when the approval merge is absent, naming the plan
- [x] `bin/commands/plans.ts`, `bin/cli.ts`: `plans audit-inputs <name> [--approved <sha>]` prints the inputs as JSON; `--approved` names the merge by hand when history was rewritten (ADR risk)
- [x] `lib/models/tier-names.ts`: `audit` in `TIER_STEPS`; `bin/commands/plans.ts`: `plans model <name> --step <step>` answers `tierForPhase(config, step, undefined)` — the step's default tier, no override; `--step` and `--phase` together are refused
- [x] `lib/checks/steps.ts`: nothing to add — `TIER_STEPS` is read there; confirm by A8's "unknown step refused"
  - Confirmed: `steps.ts` needed no change (A8's unknown-step refusal, the `steps.audit` config and A12 pass). One thing the item did not foresee: `lib/config.ts`'s `WorkflowSteps` type had no `audit` key, so `tsc` refused `steps[step]` once `audit` joined `TIER_STEPS`; the field was added there (committed with the `TIER_STEPS` item, which would not compile without it).
- [x] Added 2026-10-09 (Sandy: "a plan can have models for the phases and them actually get used" — moved in from Out of Scope): A14 in `lib/build/step-model.test.ts`, authored RED first — `buildStepModel(checkout, plan, step, phase?)` answers the model for a `work` step from `phaseModel` (the phase string `nextBuildStep` gives, parsed to a `PhaseRef`) and for a ritual step from `tierForPhase(config, step, undefined)`; `null` with no tiers
- [x] The runner hands the step's phase to `run` (`RunnerDeps.run(step, phase?)`; `runBuild` passes `next.phase` for a `work` step); `build/index` exports `buildStepModel`; the admin's `build-host.ts` resolves it per step and passes `model` to `runStepSession` (already plumbed to `claude --model`), omitting it when `null`. Admin change committed separately from the package change
- [x] Shape (`apps/indusk-mcp/src/lib/audit/inputs.ts`) — pull the approval lookup out of `auditInputs` into a named `resolveApproval(pb, plan, approved)`, so `auditInputs` reads documents and diff and nothing else. Rule: typescript: one reason to change; a name says what a block is for
- [x] Shape (`apps/indusk-mcp/src/bin/commands/plans.ts`) — `plansModel` spells `answer ? "<tier> <model>" : "session"` twice; one named `describeModel(answer)`. Rule: typescript: an inline block repeated in one unit is a named function
- [x] Shape (`apps/indusk-admin/src/lib/build-host.ts`) — the `run` closure now resolves a model and runs a session; name the first as `stepModelOption(root, plan, step, phase)` returning `{ model } | { error }`. Rule: typescript: one reason to change; the closure stays a wiring line

#### Build Phase 2 Verification

- [x] A5, A6, A7, A8, A12, A14 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/plans-audit-inputs.test.ts src/__tests__/plans-model.test.ts src/lib/models src/lib/build && pnpm exec vitest related src/lib/audit/inputs.ts src/lib/models/tier-names.ts --run`); tsc and biome clean on the files changed, in indusk-mcp and indusk-admin
  - Run 2026-10-09: build exit 0; `plans-audit-inputs`, `plans-model`, `src/lib/models`, `src/lib/build` 10 files, 64/64; `vitest related` on `audit/inputs.ts` and `tier-names.ts` 6 files, 51/51 (A5, A6, A7, A8, A12, A14 green, CLI rows not skipped); the admin's whole suite 64 files, 414/414. `tsc --noEmit` clean in indusk-mcp and indusk-admin; biome clean on every changed `.ts`. A4 and the other runner rows still pass. One test case added beyond the rows: `runner.test.ts` pins that `run` gets a work step's phase and a ritual step none.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: `lib/audit/` — the approved impl is found by the approval merge's subject, never by a line in the plan; a rewritten history is named by the refusal and answered with `--approved`

#### Build Phase 2 Document

- [x] `reference/cli/plans.md`: `plans audit-inputs` (what each field is, the refusal, `--approved`) and `plans model --step`; `workflow.steps.audit.tier` in the tiers example

### Build Phase 3: The skill, the live check, the docs

**Tier**: med

**Goal**: `/audit` exists and runs the reader; the retrospective asks for it; the docs say so.

- [x] `skills/audit.md`: run `indusk plans model <plan> --step audit`, then `indusk plans audit-inputs <plan>`; spawn an Agent with that `model` (none when `session`) whose prompt is the inputs and the fixed question list — does each row prove its promise's sentence or something narrower; what does the diff change that no row touches; what does the code do that the brief never promised; which rejected ADR alternative does the code quietly take; which skip reason would you not accept; what else would have to change for each promise to hold (with the `--stat`) — and that writes `audit.md` in the fixed shape (one `##` per question; findings as `- <file>:<line> — <finding>` or `- nothing`); record the model the Agent reports; end with `indusk plans next-session <plan>`. Unattended: the same, without asking
- [x] `skills/retrospective.md`: Step 0 names `audit` in the gate text and the refusal, with the skip pair; `skills/cleanup.md` and `skills/falsify.md`: the hand-off line names `/audit` before `/retrospective`
- [x] `skills/planner.md` step 8: the close-out order gains `/audit`
- [x] The planner names every phase's tier (A13): `skills/planner.md` step 7 — "every phase carries `**Tier**: <tier>` under its heading, the step's default spelled out or a different tier with its reason; `indusk plans model` answers from it" — the impl template in the same skill carries the line under each phase, and `templates/planning/CLAUDE.md`'s tier rule says *every* phase names one, not *may*
- [x] A9, the live check: `/audit` on a scratch plan with `steps.audit.tier: weak` (haiku). Record here the model the Agent reported and that `audit.md` was written in the fixed shape. If the Agent is not honoured for this spawn, record that and keep the skill's `session` path
  - Run 2026-10-09: scratch plan `seat-holds` (approved with `indusk plans approve`, then a code commit) in a throwaway project with `workflow.tiers.weak: haiku`, `steps.audit.tier: weak`. `plans model seat-holds --step audit` answered `weak haiku`; `plans audit-inputs` printed the inputs; an Agent spawned with `model: "haiku"` reported `claude-haiku-5-5` and wrote `audit.md` with the frontmatter and all six question headings in order, findings as `- <file>:<line> — <finding>` or `- nothing` (it numbered the headings `## 1.` — the skill's shape now says the heading text is the question, which the fixed list gives). Scratch project removed.
- [x] `indusk update` so `.claude/skills/` takes the package's copies

#### Build Phase 3 Verification

- [x] A9 recorded; A13 passes; A1–A8, A10–A12 still pass; `skill-sync-parity` and `context-tiers-ship` pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/audit-gate.test.ts src/__tests__/plans-audit-inputs.test.ts src/__tests__/plans-model.test.ts src/__tests__/plans-review.test.ts src/__tests__/planner-tier-line.test.ts src/lib/models src/lib/build/runner.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/context-tiers-ship.test.ts`); biome clean on the files changed
  - Run 2026-10-09: build exit 0; 11 files, 93/93 passed (A1–A8, A10–A13 green, `skill-sync-parity`, `context-tiers-ship`; CLI rows not skipped); A9 recorded above; biome on the one `.ts` file changed (`apps/docs/src/.vitepress/config.ts`, one sidebar line) reports only formatting differences that were there before (the file is not biome-formatted: spaces and long lines throughout); the added line matches its neighbours. Shape: skipped — the phase changed no code file but that sidebar line (prose, templates and docs only), so `prepareShapeReview` has nothing to review.

#### Build Phase 3 Context

- [x] `current.md` (Project shared): the audit tier is unset in dusk's own config until the first five audits are read; set `workflow.steps.audit.tier: strong` and `tiers.strong` when the weekend's building starts

#### Build Phase 3 Document

- [x] `reference/skills/audit.md` (new): what the auditor gets, the question list, the shape of `audit.md`, the skip pair; `guide/plan-lifecycle.md`: the close-out diagram gains `/audit`; changelog `[Unreleased]`

### Build Phase 4: Falsification — what the auditor is handed, and what the person is shown

**Tier**: med

**Goal**: verify whether the attested state holds against four ways the auditor still sees the builder's notes or cannot be handed the plan at all, and one way a skipped audit is hidden from the person. Each row is one hypothesis; each item the fix it needs.

**Read, not run (A15):** `auditInputs` filters the diff with `isBookkeeping`, which keeps everything under the plan's own folder — so the plan's `impl.md` diff since approval is in `diff`, falsification and cleanup phases and their findings included. A7, the trajectory row asserting the diff keeps the code and drops bookkeeping, pins this: its test asserts `expect(diff).toContain(FALSIFICATION)`. The promise `the-auditor-sees-the-plan-not-the-session` says "nothing … from the builder's own findings", and the ADR chose the impl at the approval merge precisely so the reader would not get them; the diff hands them back.

**Read, not run (A16):** `implAsApproved.path` and `trajectoryNow.path` are both `<plan dir>/impl.md` — the working file. The skill's step 3 tells the reader "to read the files at the paths in the inputs rather than relying on your summary". A reader that obeys opens the current impl, with the falsification and cleanup phases, and the approved text is never read.

**Read, not run (A17):** `stat` is `git diff --stat <trunk>...<branch>` — the files the branch changed, nothing else. The ADR calls it "a repository-wide `--stat`" and the skill's question 6 asks for "files the plan did not touch that a promise depends on" using it. No file the plan did not touch is in it, so question 6 has no input.

**Read, not run (A18):** `auditInputs` goes through `planBranch`, which refuses any plan whose copy is not a worktree ("is not on its own branch"), and `approvalMerge` reads only `--merges`. A workbench plan's approval (`approveWorkbenchPlan`) is a plain commit at the workbench root with subject `plan(<plan>): approved`, and its documents are not in a worktree. Every other plan verb — start, approve, accept, review, land — dispatches through `workbenchPlan`; `audit-inputs` does not, so every workbench plan's audit refuses, and an unattended build stops at it as a blocker.

**Read, not run (A19):** `buildReview`'s `skippedRituals` lists falsification and cleanup skips only; an `audit: skipped` pair is not in `plans review`'s evidence. The admin's `ReviewPanel` words any ritual that is not `falsification` as "Cleanup", so adding `audit` to the list without the panel would mislabel it. An unattended audit that writes the skip pair is invisible to the person accepting the build.

**Not investigated further, and why:** the readiness gate (`isAuditSkipped`/`isAuditComplete` mirror the other two rituals' shape and A1, A2, A10 cover the four cases); the runner's progress check (`fingerprint` includes `readiness.missing`, so an audit that writes `audit.md` counts as progress, and one that does not falls into the existing no-progress stop); a `work` step's model when one session works several phases (`/work` spawns each phase on its own model, so the session's model does not decide the phase's); `approvalMerge`'s prefix match (the `)` in `plan(<name>)` stops one plan's name matching another's, and `impl approved` does not start with `approved`).

- [x] `lib/audit/inputs.ts`: the diff leaves out every path under `.indusk/` — the plan's documents are handed whole in `documents` and `implAsApproved`, so its folder's diff adds only what the builder wrote after approval; `isBookkeeping` goes. A7's test line `expect(diff).toContain(FALSIFICATION)` asserted the leak as behaviour: it becomes `not.toContain`, and A7's Asserts text drops "other than the plan's own folder" (A15)
- [x] `lib/audit/inputs.ts`: `implAsApproved.path` is `<approvedAt>:<plan dir>/impl.md`, the spelling `git show` reads; `skills/audit.md` step 3 says the approved impl is read from that text or with `git show <path>` in the trunk, never from the working file (A16)
- [x] `lib/audit/inputs.ts`: a `tree` field — `git ls-tree -r --name-only <branch>` less `.indusk/` — beside `stat`; `skills/audit.md` question 6 and the ADR's D2 name `tree` as the files the plan did not touch, `stat` as the ones it did (A17)
- [x] `lib/audit/inputs.ts`: `auditInputs` asks `workbenchPlan` first, as `buildReview` does: documents from `wp.dir`, the approved impl from the latest commit on the root's branch whose subject starts `plan(<plan>): approved` (merge or not — `approvalMerge` takes a `merges` flag), the diff and the tree from `wp.repoTrunk`, `<trunkBranch>...<code.branch>` (A18)
- [x] `lib/build/review.ts`: `skippedRituals` gains `{ ritual: "audit", check: isAuditSkipped(implText) }` and its type `"audit"`; `apps/indusk-admin` `ReviewPanel.tsx` (and `PlanDetail.tsx`, `FalsificationSection.tsx` where they word a ritual) name each ritual from one map rather than the falsification-or-else-cleanup ternary — admin change committed separately (A19)
  - `PlanDetail.tsx` and `FalsificationSection.tsx` word no ritual through that ternary (they pick a ritual's skip by its name and title their own section), so only `ReviewPanel.tsx` changed; the plan page's own `skippedRituals` (`planning-reader.ts`) is a separate list and is untouched.
- [x] Shape (`apps/indusk-mcp/src/lib/audit/inputs.ts`) — `auditInputs` read the documents, found the approval and ran three git reads for the code; the code reads are now a named `codeChanges(code)` returning `{ diff, stat, tree }`, so `auditInputs` is source, approval, documents, code. Rule: typescript: one reason to change; an inline block is a named function
- [x] Shape (`apps/indusk-admin/src/components/session/ReviewPanel.tsx`, `apps/indusk-mcp/src/lib/build/review.ts`) — reviewed, left as-is: each is a one-line change to a map and a list that already had their shape

#### Build Phase 4 Verification

- [x] A15–A19 pass; A5–A7, A10, A11 still do (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/plans-audit-inputs.test.ts src/__tests__/plans-workbench.test.ts src/__tests__/plans-review.test.ts src/__tests__/audit-gate.test.ts && cd ../indusk-admin && pnpm exec vitest run src/components/session/ReviewPanel.test.tsx src/components/PlanDetail.skipped-rituals.test.tsx`); tsc and biome clean on the files changed, in indusk-mcp and indusk-admin
  - Run 2026-10-09: build exit 0; indusk-mcp `plans-audit-inputs`, `plans-workbench`, `plans-review`, `audit-gate` 4 files, 52/52 (A15–A19 package halves, A5–A7, A10, A11 green; A18 in all four workbench layouts; CLI rows not skipped); also `src/lib/build` and `plans-next` 33/33; the admin's `ReviewPanel` and `PlanDetail.skipped-rituals` 6/6 and its whole suite 64 files, 415/415. `vitest related` on `audit/inputs.ts` and `build/review.ts` finds no test files in indusk-mcp (every test reaches them over the built CLI) and the admin's related run on `ReviewPanel.tsx` is 2 files, 5/5. `tsc --noEmit` clean in indusk-mcp and indusk-admin; biome clean on every changed `.ts`/`.tsx`. A7's test line flipped to `not.toContain` and its Asserts text dropped "other than the plan's own folder"; no other row text or `Passes at` changed.

#### Build Phase 4 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`, the `lib/audit/` line: nothing under `.indusk/` reaches the auditor's diff — the plan's documents are handed whole, and the folder's diff since approval is the builder's notes; a field's `path` names where its text was read (`<sha>:<path>` for a committed version), never a working file holding something else

#### Build Phase 4 Document

- [ ] `reference/cli/plans.md`: `plans audit-inputs` gains `tree`, the diff leaves out `.indusk/`, `implAsApproved.path` is `<sha>:<path>`, and a workbench plan's approval is the root's commit; `reference/skills/audit.md`: question 6 reads `tree`, the reader reads the approved impl from its text

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/cleanup/gate.ts` | `isAuditSkipped`, `isAuditComplete`, `audit` in readiness |
| `apps/indusk-mcp/src/lib/build/{next-step,runner,build-session}.ts` | the `audit` step |
| `apps/indusk-mcp/src/lib/models/{next-session,tier-names}.ts` | `/audit`; `audit` in `TIER_STEPS` |
| `apps/indusk-mcp/src/lib/audit/inputs.ts` | new; Build Phase 4: the diff without `.indusk/`, `<sha>:<path>`, `tree`, workbench plans |
| `apps/indusk-mcp/src/lib/build/review.ts`, `apps/indusk-admin/src/components/{session/ReviewPanel,PlanDetail,FalsificationSection}.tsx` | Build Phase 4: the audit among the skipped rituals |
| `apps/indusk-mcp/src/bin/{cli,commands/plans}.ts` | `plans audit-inputs`, `plans model --step`, `describeStep` |
| `apps/indusk-mcp/skills/{audit,retrospective,cleanup,falsify,planner}.md` | the skill; the hand-offs; the planner's tier line |
| `apps/indusk-mcp/templates/planning/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `CLAUDE.md` | context |
| `apps/docs/src/reference/{cli/plans,skills/audit,skills/retrospective}.md`, `guide/plan-lifecycle.md`, `changelog.md` | docs |

## Dependencies
- `model-per-phase` (landed 2026-10-09): `TIER_STEPS`, `tierForPhase`, `plans model`, `nextSession`.

## Notes
- The approval merge's subject is `plan(<plan>): approved — its documents and promises` (`lib/plans/approve.ts`); `approvalMerge` matches the prefix only.
- `RITUAL_ORDER` stays `[falsification, cleanup]`: the audit is a document, and the admin's activity names come from phase titles (ADR).
