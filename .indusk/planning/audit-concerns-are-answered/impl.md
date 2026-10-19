---
title: "A plan is read cold before approval, and every audit concern is answered"
date: 2026-10-17
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "10e33497fe2547bc8280c84f1f881f61ca76d5ab74899ec489b8f60057e3bc74"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T13:23:23.241Z"
---

# A plan is read cold before approval, and every audit concern is answered

## Goal

A plan is read cold before the person approves it, and the code is audited when
the build phases close, before falsification. Every concern from either read is
answered by the agent that knows the plan — a fix, a signal or a reason — and
one whose answer would change what the person approved stops for them as an
amendment. Every concern waved away is shown to the person.

## Scope

### In Scope

- The audit skill: the reader writes what would show each finding breaking;
  the plan's agent answers each, an amendment answer stopping the session; the
  dismissals are shown to the person; a before-approval mode for the plan review;
  the new order (build, audit, falsify, cleanup, retrospective) in the audit,
  falsify, cleanup and retrospective skills; the planner skill runs the plan
  review before presenting a plan written by hand.
- One reader of `audit.md` and `plan-review.md`, and the command behind it.
- The plan review's inputs and command.
- The build loop: the audit before falsification, and a named stop while an
  amendment waits.
- The planning loop: the plan review as its last step, and its dismissals in
  the ready-for-approval stop.

### Out of Scope

- Any gate on unanswered concerns, in the retrospective or in `plans approve`.
- Showing the plan review in the admin's approval card (no look changes; the
  run's stop carries the dismissals).
- A second fresh read of the fixes, falsification and cleanup after the audit.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the skill-wording tests and the two loops' tests, red; the reader's and the review inputs' tests recorded with their bodies | the brief, the ADR |
| Build Phase 1 | `readAuditAnswers`, `AUDIT_QUESTIONS`, `PLAN_REVIEW_QUESTIONS` in `lib/audit/answers.ts`; `indusk plans audit-answers [--plan-review]` | the `audit.md` and `plan-review.md` shape |
| Build Phase 2 | the audit before falsification and the `amendment` stop in `nextBuildStep`; `amendments` on `BuildPlan`; the changed promise | `amendmentsOf` |
| Build Phase 3 | `planReviewInputs` and `indusk plans review-inputs`; the `plan-review` planning step, its state and its prompt | Build Phase 1's reader |
| Build Phase 4 | the audit and planner skills' new steps, the order in four skills, the project copies, docs | Build Phases 1 to 3 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | The audit's instructions tell the reader to write what would show each finding breaking, and no remedy | Test Phase 1 | Build Phase 4 | written | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A2 | Reading an audit reports a finding with no "breaks when" line as incomplete, naming its question and line | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A3 | The audit's instructions tell the plan's agent to answer every finding with a fix, a signal or nothing with the reason | Test Phase 1 | Build Phase 4 | written | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A4 | Reading an audit refuses an unanswered finding or a signal answer naming no clause, naming the finding; a fully answered one passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A5 | Reading an audit lists every "nothing needed" answer with its finding and reason, and the instructions say to show the list to the person | Test Phase 1 | Build Phase 4 | written | unit | clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts, apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A6 | An `audit.md` written before this plan still lets the retrospective start | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over an-audit-blocks-nothing | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A7 | The auditor is still handed only the documents, the approved impl and the diff | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A8 | The project's copies of the audit, planner, falsify, cleanup and retrospective skills match the package's | Test Phase 1 | Build Phase 4 | written | unit | so the change reaches every project that updates | apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts |
| A9 | The audit's instructions tell the plan's agent to ask once what let the findings through, group them by cause, flag each recurring process gap for a lesson, or say there is none | Test Phase 1 | Build Phase 4 | written | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A10 | Reading an audit with findings but no "What let these through?" section reports it incomplete; one naming each cause with its findings and highlight, or no gap with a reason, passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A11 | The audit's instructions say an answer that would change a promise, an expectation, a look or the scope is an edit of the brief recorded as an amendment answer, after which the session stops, and every other concern is answered without asking | Test Phase 1 | Build Phase 4 | written | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A12 | With an amendment waiting, the unattended build stops for re-approval naming it, instead of running a step or ending "cannot continue" | Test Phase 1 | Build Phase 2 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A13 | Reading an audit accepts an amendment answer and lists each with its finding, beside the dismissals | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A14 | With every build phase closed and falsification, cleanup and the audit to do, the build's next step is the audit; once the audit file exists, it is falsification | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A15 | The audit, falsify, cleanup and retrospective instructions give the order build, audit, falsify, cleanup, retrospective | Test Phase 1 | Build Phase 4 | written | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A16 | The audit's before-approval instructions put the four plan questions to the reader, as the reader's exported list names them | Test Phase 1 | Build Phase 4 | written | unit | clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A17 | Reading a plan review with one of the four questions missing reports it incomplete, naming the question; one with all four passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A18 | The plan review's inputs are the brief, test plan, ADR and impl as they stand and the tracked-file list, and nothing else | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-is-read-cold-before-approval/the-reader-sees-documents-only | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A19 | The audit's instructions tell the planning agent to answer each plan-review finding by changing a document or with a reason and to show the dismissals; the planner's tell it to run the plan review before presenting a plan written by hand | Test Phase 1 | Build Phase 4 | written | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A20 | The planning run's ready-for-approval stop lists each plan-review dismissal with its finding and reason | Test Phase 1 | Build Phase 3 | written | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A21 | Once the impl and the contract pass, the planning run's next step is the plan review; while it is missing, incomplete or unanswered it stays next; once answered, the run is ready for approval | Test Phase 1 | Build Phase 3 | written | unit | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A22 | The plan review is a planning step, so approving is refused from inside it | Test Phase 1 | Build Phase 3 | written | unit | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | apps/indusk-mcp/src/lib/build/step-env.test.ts |
| A23 | The next unattended planning run after landing writes an answered plan review before it stops for approval | Build Phase 4 | Build Phase 4 | planned | live check | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | manual: after landing, `pnpm install:local` and `indusk ui restart`, accept a brief in the admin; read the run's steps for a plan-review step after plan-impl, `plan-review.md` in the plan folder with every finding answered, and the ready-for-approval stop listing its dismissals |

### Deferred Verification

- **A23, the live check**
  - reason: it needs the installed package and the admin restarted after landing, which a plan's own tests never do.
  - would require: a planning run in a real admin over a real accepted brief.
  - mitigation: the next unattended planning run after landing; a ready-for-approval stop with no plan-review step before it breaks the planning-run clause and is recorded in this plan's retrospective.

## Checklist

### Test Phase 1: Write the tests first

**Tier**: med — the work step's default

This phase writes the tests that read the skills' instructions and the tests of
the build and planning loops' next step, all failing on their own assertions
until the build phases land, and records the bodies of the tests whose subject
does not exist yet: the reader of the audit and plan-review files, and the
plan review's inputs.

- [x] Confirm this plan has its own worktree and holds main's latest promises.
  <details><summary>Technical</summary>

  `indusk worktree list`; main merged in 2026-10-19, so `an-accepted-brief-is-planned-unasked` is in the registry and `indusk promises contract audit-concerns-are-answered` passes.

  </details>
- [x] Write the tests that read the audit, planner, falsify, cleanup and retrospective instructions, and see them fail.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts`, reading `skills/*.md` as text in the style of `planner-impl-summary-template.test.ts`. A1: the reader's prompt asks for `- breaks when:` under each finding and no remedy. A3: a step tells the plan's agent to answer with `- answer: fix —`, `- answer: signal — …; clause: <promise>/<clause>` or `- answer: nothing —`. A5 (instruction half): the last step runs `indusk plans audit-answers {plan}` and shows the dismissals. A9: the cause step, `mcp__indusk__highlight` with tag `audit-cause`, `## What let these through?`, `- no process gap — <reason>`. A11: `- answer: amendment —`, the brief edited, the session ends; every other concern answered without asking. A15: each of `audit.md`, `falsify.md`, `cleanup.md`, `retrospective.md` gives the sequence `/work` → `/audit` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective` and no other. A16: the before-approval section contains each string in a literal copy of the four plan questions (the test pins the wording; Build Phase 1 exports the same list and the reader's tests compare against it). A19: that section's answer kinds (`fix — <document changed>`, `amendment —`, `nothing —`) and the dismissals shown when presenting; `planner.md` says to run `/audit {plan} --before-approval` before presenting a plan for approval.

  </details>
- [x] Write the tests of the build loop's next step for the audit's new place and the amendment stop, and see them fail.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/build/next-step.test.ts`. A14: every phase closed, `readiness.missing` = `["falsification", "cleanup", "audit"]` → `{ step: "audit" }` (today `falsify`); `missing` = `["falsification", "cleanup"]` → `falsify`. A12: `amendments: ["promise a-x"]` on the plan, with an open phase → `{ step: "amendment", amendments: ["promise a-x"] }` (today `work`). Extra fields on the plan object load today (types are stripped), so both fail on their assertions.

  </details>
- [x] Write the tests of the planning loop's last step and its stop, and see them fail.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/build/next-planning-step.test.ts`. A21: documents and contract ok, `review: { exists: false, complete: false, dismissals: [], amendments: [] }` → `{ step: "plan-review" }`; `exists: true, complete: false` → `plan-review`; `complete: true` → `ready-for-approval`. A20: `complete: true` with one dismissal → the stop's `dismissals` holds it. `apps/indusk-mcp/src/lib/build/step-env.test.ts` (new; imports the existing module). A22: `PLANNING_STEPS` includes `plan-review`; `planningStepRefusal("approving", { INDUSK_BUILD_STEP: "plan-review" })` is not null.

  </details>
- [x] Make sure no test fails only because a file or function it loads is missing.
  <details><summary>Technical</summary>

  Every file above imports modules and names that exist today; each red is an assertion. The reader's and the review inputs' tests are deferred below.

  </details>

#### Deferred to Build Phase 1

- **A2, A4, the reader half of A5, A10, A13 and A17** — their subject, `readAuditAnswers` in `lib/audit/answers.ts`, is a new module; the test file would fail to load, not to assert. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { AUDIT_QUESTIONS, PLAN_REVIEW_QUESTIONS, readAuditAnswers } from "./answers.js";

  const audit = (body: string) => `---\nplan: p\n---\n\n# Audit — p\n\n## What does the diff change that no row touches?\n${body}\n`;

  describe("readAuditAnswers", () => {
    it("A2 — a finding with no breaks-when line is incomplete", () => {
      const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - answer: nothing — fine"));
      expect(r.incomplete.map((f) => f.line)).toEqual([10]);
    });
    it("A4 — an unanswered finding, or a signal with no clause, is refused", () => {
      const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - breaks when: y\n- `b.ts:1` — z\n  - breaks when: w\n  - answer: signal — inv; here; daily"));
      expect(r.unanswered.length + r.noClause.length).toBe(2);
    });
    it("A5 — every nothing answer is listed with its reason", () => {
      const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — too unlikely"));
      expect(r.dismissals).toEqual([expect.objectContaining({ reason: "too unlikely" })]);
    });
    it("A13 — an amendment answer is an answer, listed beside the dismissals", () => {
      const r = readAuditAnswers(audit("- `a.ts:3` — x\n  - breaks when: y\n  - answer: amendment — promise a-x narrowed"));
      expect(r.unanswered).toEqual([]);
      expect(r.amendments).toEqual([expect.objectContaining({ part: "promise a-x narrowed" })]);
    });
    it("A10 — findings with no causes section are incomplete; a no-gap line passes", () => {
      const body = "- `a.ts:3` — x\n  - breaks when: y\n  - answer: nothing — fine";
      expect(readAuditAnswers(audit(body)).missingCauses).toBe(true);
      expect(readAuditAnswers(`${audit(body)}\n## What let these through?\n- no process gap — one-off\n`).missingCauses).toBe(false);
    });
    it("A17 — a plan review missing one of its four questions is incomplete, naming it", () => {
      const all = PLAN_REVIEW_QUESTIONS.map((q) => `## ${q}\n- nothing\n`).join("\n");
      expect(readAuditAnswers(all, { questions: PLAN_REVIEW_QUESTIONS }).missingQuestions).toEqual([]);
      const three = PLAN_REVIEW_QUESTIONS.slice(1).map((q) => `## ${q}\n- nothing\n`).join("\n");
      expect(readAuditAnswers(three, { questions: PLAN_REVIEW_QUESTIONS }).missingQuestions).toEqual([PLAN_REVIEW_QUESTIONS[0]]);
      expect(AUDIT_QUESTIONS).toHaveLength(4);
    });
  });
  ```

#### Deferred to Build Phase 3

- **A18** — its subject, `planReviewInputs` in `lib/audit/inputs.ts`, is a new export; the call would fail as "not a function", not on an assertion. Body reviewed (added to `plans-audit-inputs.test.ts`, on the fixture plan the file already builds):

  ```typescript
  it("A18 — the plan review is handed the four documents and the tracked files, nothing else", async () => {
    const inputs = await planReviewInputs(root, "p");
    expect(Object.keys(inputs).sort()).toEqual(["documents", "plan", "tree"]);
    expect(Object.keys(inputs.documents).sort()).toEqual(["adr", "brief", "impl", "testPlan"]);
    expect(JSON.stringify(inputs)).not.toContain("research.md");
  });
  ```

#### Regression Guards

- **A6** — the retrospective's gate test over an older `audit.md`; passes now and must stay passing.
- **A7** — the audit inputs test; passes now and must stay passing.

#### Test Phase 1 Verification

- [x] The skill-wording and loop tests fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `indusk plans tests audit-concerns-are-answered --phase "Test Phase 1"` — A1, A3, A5, A9, A11, A12, A14, A15, A16, A19, A20, A21, A22 red on assertions; A6, A7 green. The deferred bodies above reviewed: each loads once its module or export exists.

  </details>

#### Test Phase 1 Context

- [x] (none needed — an unattended build writes no session section; the plan's own checklist and `indusk plans next` carry the cursor) Record in this session's section that the plan is at Test Phase 1.
  <details><summary>Technical</summary>

  current.md: via `mcp__indusk__update_current_section` at handoff.

  </details>

#### Test Phase 1 Document

- [x] Note in the research file that the reader's and the inputs' tests wait for their modules.
  <details><summary>Technical</summary>

  `research.md` Findings, one line.

  </details>

### Build Phase 1: Read an audit's or a plan review's findings and answers

**Tier**: med — the work step's default

This phase adds the one reader of the audit file and the plan-review file that
tells a complete, answered read from one with a finding left open, accepts an
amendment as an answer, and lists the dismissals, plus the command the skill
runs to show them to the person.

- [x] Write the reader's tests from the recorded bodies. Decision: the recorded A2 body expected line 10 for a finding that sits on line 8 of its own fixture (a miscount, not an assertion about the reader); corrected to 8. Every other assertion is as recorded, plus a pass case for A4 and a `describeAnswers` test.
  <details><summary>Technical</summary>

  A2, A4, A5 (reader half), A10, A13, A17 in `apps/indusk-mcp/src/lib/audit/answers.test.ts`, from the bodies above; A10 also checks that a cause naming its findings and highlight passes.

  </details>
- [x] Add the reader and the two question lists it checks against.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/audit/answers.ts`: `AUDIT_QUESTIONS` (the post-build four: rows against the promise's sentence; what the diff changes that no row touches; what the code does that the brief never promised; which rejected ADR alternative the code takes) and `PLAN_REVIEW_QUESTIONS` (the four of the plan review). `readAuditAnswers(text, { questions = AUDIT_QUESTIONS } = {}): AuditAnswers` returns `findings`, `incomplete`, `unanswered`, `noClause`, `dismissals`, `amendments`, `missingQuestions`, `missingCauses`. A `- nothing` line under a heading is not a finding; findings are top-level `- ` lines under a `##` heading, their `breaks when:` and `answer:` lines indented beneath; answer kinds `fix`, `signal`, `amendment`, `nothing`. The `## What let these through?` section is the agent's, not a question; required only of an audit with at least one finding and only for the post-build audit.

  </details>
- [x] Add the command that prints the dismissals and amendment answers and refuses a read with an open finding.
  <details><summary>Technical</summary>

  `indusk plans audit-answers <plan> [--plan-review]` in `apps/indusk-mcp/src/bin/commands/plans.ts`, reading `audit.md` or `plan-review.md` from the plan's live copy; exit 2 naming each incomplete, unanswered or clause-less finding and each missing question; prints each dismissal as `<question> — <finding> — nothing: <reason>` and each amendment answer as `<question> — <finding> — amendment: <part>`.

  </details>
- [x] Review the new reader and command against the extensions' rules. Shape: reviewed, nothing found — `readAuditAnswers` is one pure parse, the command only reads, prints and exits; `describeAnswers` holds the wording so the command has no logic to test.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 1 Verification

- [x] The reader's tests pass.
  <details><summary>Technical</summary>

  A2, A4, A5 (reader half), A10, A13, A17: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 1"`.

  </details>

#### Build Phase 1 Context

- [x] Add the reader to the package's rules as the one home of an audit's and a plan review's answers.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Run, verify, Shape, cleanup — the `lib/audit/` entry): `readAuditAnswers` is the one reader of `audit.md` and `plan-review.md`; the question lists live beside it.

  </details>

#### Build Phase 1 Document

- [x] Describe the new command in the plans reference.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`: `plans audit-answers`, with `--plan-review`.

  </details>

### Build Phase 2: Audit before falsification, and stop for an amendment

**Tier**: med — the work step's default

This phase moves the audit in the unattended build to the moment the build
phases close, before falsification and cleanup, and makes the build stop by
name, for the person's re-approval, while a change to the approved brief
waits. It then rewrites the audit promise's sentence to say when the audit
runs.

- [x] Make the build run the audit before falsification and cleanup.
  <details><summary>Technical</summary>

  `nextBuildStep` in `apps/indusk-mcp/src/lib/build/next-step.ts`: check `audit` before `falsification` and `cleanup`; move the `promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes` comment to the new line, saying "when the build phases close, before falsification". The skip-reason loop is unchanged. A14.

  </details>
- [x] Make the build stop for the person while an amendment waits.
  <details><summary>Technical</summary>

  `BuildPlan` gains `amendments: string[]`; `readBuildPlan` (`lib/build/read-plan.ts`) fills it from `amendmentsOf(dir)` as `<part> <name>` (an `AmendmentsUnreadable` becomes `cannot-continue` with its message, never an empty list). `BuildStep` gains `{ step: "amendment"; amendments: string[] }`, returned first when non-empty, after the error and no-progress checks. It is not a session step, so `runBuild` stops on it; add its case to `next-session.ts` and the `plans next` printer in `bin/commands/plans.ts` ("waits for re-approval: …"). Every other `BuildPlan` literal in tests gains `amendments: []`. A12.

  </details>
- [x] Rewrite the audit promise's sentence now that the build makes it true.
  <details><summary>Technical</summary>

  `indusk promises change a-plan-is-audited-by-a-fresh-reader-before-it-closes --plan audit-concerns-are-answered --statement "When a plan's build phases close, before falsification, a reader that has not seen the building session reads the plan and writes what it finds to audit.md in the plan folder, and the retrospective refuses to start until that document exists or the impl says why the audit was skipped." --reason "the audit's findings are answered before falsification and cleanup (Sandy, 2026-10-19)"`.

  </details>
- [x] Review the changed loop against the extensions' rules. Shape: reviewed, nothing found — the order change is two moved lines, and the amendment stop is one early return over an input the reader fills. Decision: the admin's `describeStop` (`BuildControls.tsx`) gained an `amendment` case so its exhaustive switch still compiles; it is one sentence, not a new component or state, so no look is drawn. The admin's own ritual rail (`RITUAL_ORDER`) keeps falsify, cleanup, audit — the plan lists no admin rendering change; recorded as forward intelligence below.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 2 Verification

- [x] The build loop's tests pass, the audit's new place and the amendment stop included.
  <details><summary>Technical</summary>

  A12, A14: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 2"` (with the Must-not-break promises' tests: `a-build-runs-to-review-unasked` among them); the package's type check is clean.

  </details>

#### Build Phase 2 Context

- [x] Add the amendment stop to the package's rules for the build loop.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the build-loop entry: the loop stops on a waiting amendment by name (`amendment`), read through `amendmentsOf`, never a second reader.

  </details>

#### Build Phase 2 Document

- [x] Describe the new order and the amendment stop in the build reference. Decision: `guide/plan-lifecycle.md` still draws falsify → cleanup → audit, the admin's rail order, which this plan does not change; only the build loop's order moved.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (`plans next` steps) and wherever the lifecycle order is given (`grep -rn "falsify.*cleanup.*audit" apps/docs/src`).

  </details>

#### Build Phase 2 Forward Intelligence

- **Watch out**: `RITUAL_ORDER` in `lib/lifecycle.ts` and the admin's step rail still list falsification, cleanup, audit; `nextBuildStep` now runs the audit first. Nothing reads the two against each other today.
- **Fragile**: `readBuildPlan` now calls `amendmentsOf` (a git read) on every runner read; an unreadable approval throws `BuildPlanUnreadable`, which every caller already catches.

### Build Phase 3: Read the plan cold before approval

**Tier**: med — the work step's default

This phase adds what the plan review's reader is handed and the command that
prints it, makes the review the unattended planning run's last step, and puts
its dismissals in the stop that asks the person for approval.

- [ ] Write the review inputs' test from the recorded body.
  <details><summary>Technical</summary>

  A18 in `apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts`, from the body above.

  </details>
- [ ] Add what the plan review's reader is handed and the command that prints it.
  <details><summary>Technical</summary>

  `planReviewInputs(anyCheckout, plan)` in `apps/indusk-mcp/src/lib/audit/inputs.ts`: `{ plan, documents: { brief, testPlan, adr, impl }, tree }`, each document as `{ path, text }` from the plan's live copy (absent ones `null`), `tree` as `auditInputs` builds it; never `research.md`. `indusk plans review-inputs <plan>` prints it as JSON. A18.

  </details>
- [ ] Make the plan review the planning run's last step, and its dismissals part of the stop.
  <details><summary>Technical</summary>

  `PLANNING_STEPS` gains `plan-review` (`lib/build/step-env.ts`). `PlanningState` gains `review: { exists; complete; dismissals; amendments }`; `readPlanningState` (`lib/build/read-planning.ts`) fills it from `plan-review.md` through `readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS })`, complete when nothing is incomplete, unanswered or missing. `nextPlanningStep` returns `plan-review` after the contract check passes while the review is not complete, and `{ step: "ready-for-approval", dismissals, amendments }` once it is. `stepPrompt` (`lib/build/build-session.ts`) gives `plan-review`: run `/audit {plan} --before-approval`, write only `plan-review.md` and the documents its answers change. The admin's run shows the stop's dismissals in its event text. A20, A21, A22.

  </details>
- [ ] Review the planning loop's changes against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 3 Verification

- [ ] The review inputs and the planning loop's tests pass.
  <details><summary>Technical</summary>

  A18, A20, A21, A22: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 3"` (with `an-accepted-brief-is-planned-unasked`'s tests); type check clean.

  </details>

#### Build Phase 3 Context

- [ ] Add the plan review to the planning rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/planning/CLAUDE.md` (shipped; resync `.indusk/planning/CLAUDE.md`): a plan is read cold (`/audit {plan} --before-approval`, `plan-review.md`) and answered before it is presented for approval.

  </details>

#### Build Phase 3 Document

- [ ] Describe the plan review command and the planning run's new step.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`: `plans review-inputs`; the planning run's steps.

  </details>

### Build Phase 4: Tell the readers and the agents what to write

**Tier**: med — the work step's default

This phase changes the audit skill so each reader writes what would show a
finding breaking and no remedy, the agent answers each finding and stops on an
amendment, the dismissals are shown, and a plan can be read before approval; it
gives the new order in the four ritual skills, tells the planner to run the
plan review, syncs the project's copies and writes the docs.

- [ ] Change the reader's instructions to add what would show each finding breaking, and to suggest no remedy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/audit.md`, "The questions" and "The shape of `audit.md`": the post-build questions are `AUDIT_QUESTIONS` verbatim; each finding followed by `  - breaks when: …`; the reader's prompt says no remedy. A1.

  </details>
- [ ] Add a step where the agent answers every finding, and stops when an answer would change the brief.
  <details><summary>Technical</summary>

  After "Record the model": answer each finding with `  - answer: fix — <the impl item added>`, `  - answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>`, `  - answer: amendment — <the part of the brief changed>` or `  - answer: nothing — <reason>`; a fix is added to the impl as discovered work; an amendment is an edit of a promise, an expectation or a look in the brief (a scope change is one of these added or dropped), after which the session ends and the build waits for the person; every other concern is answered without asking. A3, A11.

  </details>
- [ ] Make the last steps name the causes, run the answers command and show the person every dismissal.
  <details><summary>Technical</summary>

  The cause step: ask once across all findings what in the planning or building let them through; group by cause; for each process gap that could recur, `mcp__indusk__highlight({ tag: "audit-cause", note, level: "important" })` and list it under `## What let these through?` with its findings and highlight id; a one-off slip is not a gap; with none, `- no process gap — <reason>`. Then `indusk plans audit-answers {plan}`; on exit 2, answer what it names and run it again; print the dismissals and amendment answers to the person before `indusk plans next-session`. Replace "Read the findings with the person; whether any is acted on is their choice." A5, A9.

  </details>
- [ ] Add the before-approval mode that reads the plan's documents cold.
  <details><summary>Technical</summary>

  A section "Before approval (`/audit {plan} --before-approval`)": inputs from `indusk plans review-inputs {plan}`, never `research.md` or the conversation; the four `PLAN_REVIEW_QUESTIONS` verbatim; the reader writes `plan-review.md` in the same shape; the planning agent answers with `fix — <document changed>`, `amendment — <brief part>` or `nothing — <reason>`; `indusk plans audit-answers {plan} --plan-review`; the dismissals and amendment answers are shown with the plan when it is presented. A16, A19.

  </details>
- [ ] Give the new order in the audit, falsify, cleanup and retrospective instructions.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/{audit,falsify,cleanup,retrospective}.md`: every sequence line becomes `/work` → `/audit` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`; the audit skill's opening says it runs when the build phases close, before falsification; falsify and cleanup hand off to each other and then to the retrospective. A15.

  </details>
- [ ] Tell the planner to run the plan review before presenting a plan for approval.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md`, the step that presents the impl: run `/audit {plan} --before-approval` first and present the dismissals and amendment answers with the plan. A19.

  </details>
- [ ] Resync the project's copies of the changed skills.
  <details><summary>Technical</summary>

  `.claude/skills/{audit,falsify,cleanup,retrospective,planner}.md` from the package; `skill-sync-parity.test.ts` passes. A8.

  </details>
- [ ] Review the changed skills against the extensions' writing rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 4 Verification

- [ ] The skill-wording tests, the copy check and both guards pass.
  <details><summary>Technical</summary>

  A1, A3, A5, A6, A7, A8, A9, A11, A15, A16, A19: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 4"`.

  </details>
- [ ] The live check of the planning run is written down and waits for the installed build.
  <details><summary>Technical</summary>

  A23 stays `skipped` with its procedure in the trajectory table; run after landing and recorded in the retrospective.

  </details>

#### Build Phase 4 Context

- [ ] Add the root's Key Decisions line for this decision.
  <details><summary>Technical</summary>

  root (Key Decisions): "A plan is read cold before approval and audited before falsification; the agent answers every concern, one that changes the brief stops as an amendment, the person sees each dismissal — see /decisions/audit-concerns-are-answered" — always-on because every plan runs both reads.

  </details>

#### Build Phase 4 Document

- [ ] Update the audit skill's reference page, publish the decision and add the changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/audit.md`; `apps/docs/src/decisions/audit-concerns-are-answered.md` from the ADR, with its sidebar entry; `apps/docs/src/changelog.md`.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/audit/answers.ts` | new: `readAuditAnswers`, `AUDIT_QUESTIONS`, `PLAN_REVIEW_QUESTIONS` |
| `apps/indusk-mcp/src/lib/audit/answers.test.ts` | A2, A4, A5, A10, A13, A17 |
| `apps/indusk-mcp/src/lib/audit/inputs.ts` | `planReviewInputs` |
| `apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts` | A18 |
| `apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts` | A1, A3, A5, A9, A11, A15, A16, A19 |
| `apps/indusk-mcp/src/lib/build/next-step.ts`, `read-plan.ts`, `next-step.test.ts` | the audit before falsification; the amendment stop; A12, A14 |
| `apps/indusk-mcp/src/lib/build/next-planning-step.ts`, `read-planning.ts`, `step-env.ts`, `build-session.ts`, their tests | the plan-review step; A20, A21, A22 |
| `apps/indusk-mcp/src/lib/models/next-session.ts`, `src/bin/commands/plans.ts` | the amendment stop's case; `plans audit-answers`, `plans review-inputs` |
| `apps/indusk-mcp/skills/{audit,falsify,cleanup,retrospective,planner}.md`, `.claude/skills/` copies | the new steps and order |
| `apps/indusk-mcp/templates/planning/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, root `CLAUDE.md` | context |
| `apps/docs/src/reference/skills/audit.md`, `apps/docs/src/reference/cli/plans.md`, `apps/docs/src/decisions/audit-concerns-are-answered.md`, `apps/docs/src/changelog.md` | docs |
| `.indusk/promises/a-plan-is-audited-by-a-fresh-reader-before-it-closes.md` | changed through `indusk promises change` |

## Dependencies

- `mark-first` lands first: a signal answer names the clause it upholds. (Accepted 2026-10-19; landing.)
- `the-admin-knows-the-package-root` lands before the live check: until then the planning run stops before approval on the package-root lookup.
