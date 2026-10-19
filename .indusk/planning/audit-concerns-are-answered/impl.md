---
title: "A plan is read cold before approval, and every audit concern is answered"
date: 2026-10-17
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "039c825041a95b4f5e214b2fe371d82f4ea93772b2daf9ec3796392d91480085"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T14:45:43.819Z"
accepted: 2026-10-19T14:01:50.024Z
accepted_by: person
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
| A1 | The audit's instructions tell the reader to write what would show each finding breaking, and no remedy | Test Phase 1 | Build Phase 4 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A2 | Reading an audit reports a finding with no "breaks when" line as incomplete, naming its question and line | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A3 | The audit's instructions tell the plan's agent to answer every finding with a fix, a signal or nothing with the reason | Test Phase 1 | Build Phase 4 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A4 | Reading an audit refuses an unanswered finding or a signal answer naming no clause, naming the finding; a fully answered one passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A5 | Reading an audit lists every "nothing needed" answer with its finding and reason, and the instructions say to show the list to the person | Test Phase 1 | Build Phase 4 | passing | unit | clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts, apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A6 | An `audit.md` written before this plan still lets the retrospective start | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over an-audit-blocks-nothing | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A7 | The auditor is still handed only the documents, the approved impl and the diff | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over the-auditor-sees-the-plan-not-the-session | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A8 | The project's copies of the audit, planner, falsify, cleanup and retrospective skills match the package's | Test Phase 1 | Build Phase 4 | passing | unit | so the change reaches every project that updates | apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts |
| A9 | The audit's instructions tell the plan's agent to ask once what let the findings through, group them by cause, flag each recurring process gap for a lesson, or say there is none | Test Phase 1 | Build Phase 4 | passing | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A10 | Reading an audit with findings but no "What let these through?" section reports it incomplete; one naming each cause with its findings and highlight, or no gap with a reason, passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A11 | The audit's instructions say an answer that would change a promise, an expectation, a look or the scope is an edit of the brief recorded as an amendment answer, after which the session stops, and every other concern is answered without asking | Test Phase 1 | Build Phase 4 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A12 | With an amendment waiting, the unattended build stops for re-approval naming it, instead of running a step or ending "cannot continue" | Test Phase 1 | Build Phase 2 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A13 | Reading an audit accepts an amendment answer and lists each with its finding, beside the dismissals | Build Phase 1 | Build Phase 1 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A14 | With every build phase closed and falsification, cleanup and the audit to do, the build's next step is the audit; once the audit file exists, it is falsification | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A15 | The audit, falsify, cleanup and retrospective instructions give the order build, audit, falsify, cleanup, retrospective | Test Phase 1 | Build Phase 4 | passing | unit | promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A16 | The audit's before-approval instructions put the four plan questions to the reader, as the reader's exported list names them | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A17 | Reading a plan review with one of the four questions missing reports it incomplete, naming the question; one with all four passes | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-reader-checks-the-plan | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A18 | The plan review's inputs are the brief, test plan, ADR and impl as they stand and the tracked-file list, and nothing else | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-reader-sees-documents-only | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A19 | The audit's instructions tell the planning agent to answer each plan-review finding by changing a document or with a reason and to show the dismissals; the planner's tell it to run the plan review before presenting a plan written by hand | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A20 | The planning run's ready-for-approval stop lists each plan-review dismissal with its finding and reason | Test Phase 1 | Build Phase 3 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A21 | Once the impl and the contract pass, the planning run's next step is the plan review; while it is missing, incomplete or unanswered it stays next; once answered, the run is ready for approval | Test Phase 1 | Build Phase 3 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A22 | The plan review is a planning step, so approving is refused from inside it | Test Phase 1 | Build Phase 3 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | apps/indusk-mcp/src/lib/build/step-env.test.ts |
| A23 | The next unattended planning run after landing writes an answered plan review before it stops for approval | Build Phase 4 | Build Phase 4 | skipped | live check | a live check of the planning run after landing, recorded in the retrospective; the clause is proved by A21 and A22 | manual: after landing, `pnpm install:local` and `indusk ui restart`, accept a brief in the admin; read the run's steps for a plan-review step after plan-impl, `plan-review.md` in the plan folder with every finding answered, and the ready-for-approval stop listing its dismissals |
| A24 | A finding that quotes a diff or markdown in a fenced block is one finding: a `- ` or `## ` line inside the fence is neither a finding nor a heading, so the file still reads as answered | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A25 | An answer line with no text after its kind (`- answer: nothing`, `- answer: nothing — `, `- answer: fix`, `- answer: amendment`) is unanswered, naming the finding; no dismissal is listed with an empty reason | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A26 | A signal answer naming a clause the registry does not hold — the skill's own placeholder `<promise>/<clause>` included — is refused as naming no clause when the reader is handed the registry's clauses | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A27 | A question the reader marks empty as `- Nothing.`, `- none` or `- nothing.` is not a finding, the same as `- nothing` | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A28 | Reading an audit's answers reports one signal for each of the four audit clauses: upheld when the read found that part complete, broken naming the finding when not | Build Phase 7 | Build Phase 7 | passing | unit | the signal writer for the audit's clauses; each clause's upheld signal is read from a real run at close | apps/indusk-mcp/src/lib/audit/answers-signal.test.ts |
| A29 | A build that stops on a waiting amendment reports the significant-concern clause upheld; a step started while one waits reports it broken | Build Phase 7 | Build Phase 7 | passing | unit | the signal writer for the significant-concern clause | apps/indusk-mcp/src/lib/build/amendment-signal.test.ts |
| A30 | Printing the plan review's inputs reports the documents-only clause upheld when they hold only the four documents and the file list, and broken naming any other field | Build Phase 7 | Build Phase 7 | passing | unit | the signal writer for the documents-only clause | apps/indusk-mcp/src/lib/audit/review-signal.test.ts |
| A31 | Reading a plan review reports the four-questions clause; a planning run reaching ready for approval reports the answered-before-approval and reads-it-cold clauses, broken when no plan review ran before it | Build Phase 7 | Build Phase 7 | passing | unit | the signal writers for the plan review's clauses | apps/indusk-mcp/src/lib/audit/review-signal.test.ts |
| A32 | Closing the plan reads every one of its nine clauses upheld by a signal from a real run | Build Phase 7 | Build Phase 7 | skipped | live check | the close itself: `indusk promises confirm` refuses a clause no real run reported | manual: run `indusk plans audit-answers audit-concerns-are-answered` on this plan's audit, one unattended planning run (its plan review and `plans audit-answers <plan> --plan-review`), and one build stopped on an amendment, with the local daemon up; then `indusk promises confirm audit-concerns-are-answered` |
| A33 | The build counts the audit done only when its answers read complete; an audit file with an unanswered finding sends the build back to the audit step | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A34 | A causes section line that names no findings or no highlight, and is not a no-gap line with a reason, is incomplete | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A35 | A finding written as a star or numbered list item counts as a finding, so an unanswered one is refused | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A36 | An edit to the brief's Not promised section after approval is an amendment that waits for the person | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person | apps/indusk-mcp/src/lib/plans/amendments.test.ts |
| A37 | A plan review written before a plan document last changed is out of date, and the planning run reads the plan cold again | Build Phase 8 | Build Phase 8 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A38 | A build whose approval record cannot be read stops saying so and what to do, instead of failing the read with nothing waiting | Build Phase 8 | Build Phase 8 | passing | unit | a regression guard over a-build-runs-to-review-unasked | apps/indusk-mcp/src/lib/build/next-step.test.ts |
| A39 | The answers command checks a signal answer's clause against the plan's own registry, not the one where the command was run | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/__tests__/plans-audit-answers.test.ts |
| A40 | A clause named with trailing punctuation in a signal answer is read without it | Build Phase 8 | Build Phase 8 | passing | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A41 | A signal answer in a plan review is refused, naming the finding | Build Phase 8 | Build Phase 8 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A42 | Before approval, a brief changed since it was accepted is listed with the plan review's dismissals at the ready-for-approval stop | Build Phase 8 | Build Phase 8 | passing | unit | clause: a-plan-is-read-cold-before-approval/the-plan-is-answered-before-approval | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |

### Deferred Verification

- **A23, the live check**
  - reason: it needs the installed package and the admin restarted after landing, which a plan's own tests never do.
  - would require: a planning run in a real admin over a real accepted brief.
  - mitigation: the next unattended planning run after landing; a ready-for-approval stop with no plan-review step before it breaks the planning-run clause and is recorded in this plan's retrospective.
- **A32, the nine clauses upheld by real runs**
  - reason: a signal from a real run is what closing reads; no test stands in for it.
  - would require: the installed build, the local daemon, and the real runs named in the row, one of them a build stopped on an amendment.
  - mitigation: `indusk promises confirm audit-concerns-are-answered` refuses, naming each clause no real run reported; the plan stays open, not archived, until it passes.

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

- [x] (none needed — an unattended build writes no session section; the plan's own checklist and the plan's next-step command carry the cursor) Record in this session's section that the plan is at Test Phase 1.
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

- [x] Write the reader's tests from the recorded bodies.
  <details><summary>Technical</summary>

  Decision: the recorded A2 body expected line 10 for a finding that sits on line 8 of its own fixture (a miscount, not an assertion about the reader); corrected to 8. Every other assertion is as recorded, plus a pass case for A4 and a `describeAnswers` test.

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
- [x] Review the new reader and command against the extensions' rules.
  <details><summary>Technical</summary>

  Shape: reviewed, nothing found — `readAuditAnswers` is one pure parse, the command only reads, prints and exits; `describeAnswers` holds the wording so the command has no logic to test.

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
- [x] Review the changed loop against the extensions' rules.
  <details><summary>Technical</summary>

  Shape: reviewed, nothing found — the order change is two moved lines, and the amendment stop is one early return over an input the reader fills. Decision: the admin's `describeStop` (`BuildControls.tsx`) gained an `amendment` case so its exhaustive switch still compiles; it is one sentence, not a new component or state, so no look is drawn. The admin's own ritual rail (`RITUAL_ORDER`) keeps falsify, cleanup, audit — the plan lists no admin rendering change; recorded as forward intelligence below.

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

- [x] Describe the new order and the amendment stop in the build reference.
  <details><summary>Technical</summary>

  Decision: `guide/plan-lifecycle.md` still draws falsify → cleanup → audit, the admin's rail order, which this plan does not change; only the build loop's order moved.

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

- [x] Write the review inputs' test from the recorded body.
  <details><summary>Technical</summary>

  Decision: written over the file's own fixture plan (a worktree with committed documents), through `planReviewInputs` directly, rather than the recorded `planReviewInputs(root, "p")` placeholder; the file is system-tier, run with `vitest.system.config.ts`.

  A18 in `apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts`, from the body above.

  </details>
- [x] Add what the plan review's reader is handed and the command that prints it.
  <details><summary>Technical</summary>

  `planReviewInputs(anyCheckout, plan)` in `apps/indusk-mcp/src/lib/audit/inputs.ts`: `{ plan, documents: { brief, testPlan, adr, impl }, tree }`, each document as `{ path, text }` from the plan's live copy (absent ones `null`), `tree` as `auditInputs` builds it; never `research.md`. `indusk plans review-inputs <plan>` prints it as JSON. A18.

  </details>
- [x] Make the plan review the planning run's last step, and its dismissals part of the stop.
  <details><summary>Technical</summary>

  `PLANNING_STEPS` gains `plan-review` (`lib/build/step-env.ts`). `PlanningState` gains `review: { exists; complete; dismissals; amendments }`; `readPlanningState` (`lib/build/read-planning.ts`) fills it from `plan-review.md` through `readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS })`, complete when nothing is incomplete, unanswered or missing. `nextPlanningStep` returns `plan-review` after the contract check passes while the review is not complete, and `{ step: "ready-for-approval", dismissals, amendments }` once it is. `stepPrompt` (`lib/build/build-session.ts`) gives `plan-review`: run `/audit {plan} --before-approval`, write only `plan-review.md` and the documents its answers change. The admin's run shows the stop's dismissals in its event text. A20, A21, A22.

  </details>
- [x] Review the planning loop's changes against the extensions' rules.
  <details><summary>Technical</summary>

  Shape: reviewed, nothing found. Decisions: the stop carries `dismissals` and `amendments` only when non-empty, so every existing consumer and test of a bare `ready-for-approval` is unchanged; a `blocker:` line in `plan-review.md` stops the run like one in any planning document; the runner's progress fingerprint includes the review, so an answered review counts as progress.

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 3 Verification

- [x] The review inputs and the planning loop's tests pass.
  <details><summary>Technical</summary>

  A18, A20, A21, A22: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 3"` (with `an-accepted-brief-is-planned-unasked`'s tests); type check clean.

  </details>

#### Build Phase 3 Context

- [x] Add the plan review to the planning rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/planning/CLAUDE.md` (shipped; resync `.indusk/planning/CLAUDE.md`): a plan is read cold (`/audit {plan} --before-approval`, `plan-review.md`) and answered before it is presented for approval.

  </details>

#### Build Phase 3 Document

- [x] Describe the plan review command and the planning run's new step.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`: `plans review-inputs`; the planning run's steps.

  </details>

#### Build Phase 3 Forward Intelligence

- **Watch out**: three older tests encoded the old planning end (`planning-runner.test.ts`'s run to approval) and the old build order (`runner.test.ts`); both moved with A14 and A21, not weakened — the run now ends `plan-review` then ready.
- **Assumption**: the admin's planning stop is stored as the package returns it, so `dismissals` reach the page's JSON; no card draws them (out of scope: no look changes).

### Build Phase 4: Tell the readers and the agents what to write

**Tier**: med — the work step's default

This phase changes the audit skill so each reader writes what would show a
finding breaking and no remedy, the agent answers each finding and stops on an
amendment, the dismissals are shown, and a plan can be read before approval; it
gives the new order in the four ritual skills, tells the planner to run the
plan review, syncs the project's copies and writes the docs.

- [x] Change the reader's instructions to add what would show each finding breaking, and to suggest no remedy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/audit.md`, "The questions" and "The shape of `audit.md`": the post-build questions are `AUDIT_QUESTIONS` verbatim; each finding followed by `  - breaks when: …`; the reader's prompt says no remedy. A1.

  </details>
- [x] Add a step where the agent answers every finding, and stops when an answer would change the brief.
  <details><summary>Technical</summary>

  After "Record the model": answer each finding with `  - answer: fix — <the impl item added>`, `  - answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>`, `  - answer: amendment — <the part of the brief changed>` or `  - answer: nothing — <reason>`; a fix is added to the impl as discovered work; an amendment is an edit of a promise, an expectation or a look in the brief (a scope change is one of these added or dropped), after which the session ends and the build waits for the person; every other concern is answered without asking. A3, A11.

  </details>
- [x] Make the last steps name the causes, run the answers command and show the person every dismissal.
  <details><summary>Technical</summary>

  The cause step: ask once across all findings what in the planning or building let them through; group by cause; for each process gap that could recur, `mcp__indusk__highlight({ tag: "audit-cause", note, level: "important" })` and list it under `## What let these through?` with its findings and highlight id; a one-off slip is not a gap; with none, `- no process gap — <reason>`. Then `indusk plans audit-answers {plan}`; on exit 2, answer what it names and run it again; print the dismissals and amendment answers to the person before `indusk plans next-session`. Replace "Read the findings with the person; whether any is acted on is their choice." A5, A9.

  </details>
- [x] Add the before-approval mode that reads the plan's documents cold.
  <details><summary>Technical</summary>

  A section "Before approval (`/audit {plan} --before-approval`)": inputs from `indusk plans review-inputs {plan}`, never `research.md` or the conversation; the four `PLAN_REVIEW_QUESTIONS` verbatim; the reader writes `plan-review.md` in the same shape; the planning agent answers with `fix — <document changed>`, `amendment — <brief part>` or `nothing — <reason>`; `indusk plans audit-answers {plan} --plan-review`; the dismissals and amendment answers are shown with the plan when it is presented. A16, A19.

  </details>
- [x] Give the new order in the audit, falsify, cleanup and retrospective instructions.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/{audit,falsify,cleanup,retrospective}.md`: every sequence line becomes `/work` → `/audit` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`; the audit skill's opening says it runs when the build phases close, before falsification; falsify and cleanup hand off to each other and then to the retrospective. A15.

  </details>
- [x] Tell the planner to run the plan review before presenting a plan for approval.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md`, the step that presents the impl: run `/audit {plan} --before-approval` first and present the dismissals and amendment answers with the plan. A19.

  </details>
- [x] Resync the project's copies of the changed skills.
  <details><summary>Technical</summary>

  `.claude/skills/{audit,falsify,cleanup,retrospective,planner}.md` from the package; `skill-sync-parity.test.ts` passes. A8.

  </details>
- [x] Review the changed skills against the extensions' writing rules.
  <details><summary>Technical</summary>

  Shape: reviewed, nothing found; the audit skill's two modes share one answers step and one command, as the ADR's rejected-alternative (a second skill) required. Decisions: the project's skill copies live at `.claude/skills/<name>/SKILL.md`, not `<name>.md`, and were synced there; the docs sidebar (`.vitepress/config.ts`) lists no decision pages, so the new decision page needs no sidebar entry.

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 4 Verification

- [x] The skill-wording tests, the copy check and both guards pass.
  <details><summary>Technical</summary>

  A1, A3, A5, A6, A7, A8, A9, A11, A15, A16, A19: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 4"`.

  </details>
- [x] The live check of the planning run is written down and waits for the installed build.
  <details><summary>Technical</summary>

  A23 stays `planned` in the table with its manual procedure; the Deferred Verification block above carries its reason, requirement and mitigation. Decision: the row's `Passes at` is Build Phase 4 yet it cannot pass here, so it is recorded `skipped` (a manual live check awaiting the installed build) rather than left `planned`.

  A23 stays `skipped` with its procedure in the trajectory table; run after landing and recorded in the retrospective.

  </details>

#### Build Phase 4 Context

- [x] Add the root's Key Decisions line for this decision.
  <details><summary>Technical</summary>

  root (Key Decisions): "A plan is read cold before approval and audited before falsification; the agent answers every concern, one that changes the brief stops as an amendment, the person sees each dismissal — see /decisions/audit-concerns-are-answered" — always-on because every plan runs both reads.

  </details>

#### Build Phase 4 Document

- [x] Update the audit skill's reference page, publish the decision and add the changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/audit.md`; `apps/docs/src/decisions/audit-concerns-are-answered.md` from the ADR, with its sidebar entry; `apps/docs/src/changelog.md`.

  </details>

#### Build Phase 4 Forward Intelligence

- **Watch out**: the package's full everyday suite has failures that are not this plan's — `timing/test-run.test.ts` (starts git, flagged by `everyday-tests-never-wait`), `steps-name-project-commands.test.ts` (no `what a phase runs` heading in `work.md`), and the `lib/run/*` loop tests (`stopped-red`). None touch a file this plan changed; not confirmed against a clean tree.
- **Watch out**: `indusk plans tests --phase` also runs `apps/indusk-admin` tests, which fail in a worktree with an unbuilt `indusk-mcp` (`Cannot find module '@infinitedusky/indusk-mcp/...'`); run the package's own files directly.
- **Assumption**: the audit skill's `--before-approval` mode is run by the planning agent as `/audit {plan} --before-approval`; the live check A23 is the first real proof.

### Build Phase 5: Falsification — what the reader of an audit miscounts: quoted code, empty answers, invented clauses, a capitalised nothing

**Tier**: med — the work step's default

This phase tests the one reader of the audit and plan-review files against what a real reader and a real agent write, not the tidy fixtures it was built on. A finding that quotes a diff turns every removed line into a new unanswered finding, so the planning run can never reach approval; an answer with no reason is accepted and the person is shown a blank dismissal; a telemetry answer naming a clause that does not exist, even the skill's own placeholder, is accepted as naming one; and an empty question written in a slightly different way becomes a finding. Once it closes, each of these is read the way the person would read it.

- [x] Make the reader ignore every line inside a fenced code block when it looks for headings, findings and answers.
  <details><summary>Technical</summary>

  `readAuditAnswers` in `apps/indusk-mcp/src/lib/audit/answers.ts` splits on lines and matches `^##\s+` and `^- ` with no fence mask. A reader answering "What does the diff change that no row touches?" naturally quotes a ```` ```diff ```` hunk under a finding; each removed line (`- const x = 1;`) is a column-zero `- ` line and becomes a finding with no `breaks when:` and no answer. `indusk plans audit-answers` then exits 2 naming lines that are not findings, and in the planning run `readReview` keeps `complete: false`, so `nextPlanningStep` keeps returning `plan-review` until two runs make no progress and the run ends "cannot continue" — the plan never reaches the person. A `## ` line inside a quoted markdown fence likewise changes the section. Fix: compute `fencedLineMask(lines)` (`lib/impl-headings.ts`, the project's one fence rule) once and `continue` on every masked line. Answers A24 (fixture: a finding whose answer is followed by a fenced diff holding `- old` and `## Heading` lines; expect one finding, `isAnswered` true, no missing question).

  </details>
- [x] Count an answer with nothing written after its kind as no answer, so no blank dismissal reaches the person.
  <details><summary>Technical</summary>

  `ANSWER` is `/^\s+- answer:\s*(fix|signal|amendment|nothing)\b\s*(?:[—–-]+\s*)?(.*)$/`; `(.*)` accepts the empty string, so `  - answer: nothing` is an answer and `dismissals` gets `{ reason: "" }`, printed as `… — nothing: ` — exactly the waved-away concern with no reason the goal says the person must see. Fix: in `readAuditAnswers`, set `current.answer` only when the captured text is non-empty after trim; an empty one leaves the finding in `unanswered` (the command already names it "has no answer"). Answers A25.

  </details>
- [x] Let the reader be handed the registry's clauses, refuse a telemetry answer naming one that does not exist, and have the answers command hand them in.
  <details><summary>Technical</summary>

  `CLAUSE` is `/clause:\s*[^\s/;]+\/[^\s;]+/`: any `x/y` passes, including the skill's own template text `clause: <promise>/<clause>` (copied unedited, `<promise>` matches `[^\s/;]+`) and a misspelt or never-declared clause. Fix: `ReadOptions` gains `clauses?: ReadonlySet<string>` (`<promise>/<clause>` pairs); when given, a signal answer whose named pair is not in the set goes to `noClause`. The reader stays pure. `plansAuditAnswers` (`apps/indusk-mcp/src/bin/commands/plans.ts`) builds the set from the registry (`readPromises` in `lib/promises/registry.ts`, each promise's `clauses[].name`) for the post-build audit only; an unreadable registry refuses the command by name (exit 1), never reads as an empty set that would refuse every signal. `describeAnswers`'s wording becomes "answers with a signal naming no clause the registry holds". Answers A26 (pure test: a set holding `a-x/holds`; `clause: a-x/holds` passes, `clause: a-x/nope` and `clause: <promise>/<clause>` are refused; with no set given, today's shape check is unchanged).

  </details>
- [x] Read a question marked empty in any ordinary spelling of "nothing" as having no findings.
  <details><summary>Technical</summary>

  The skip is `item[1].trim() === "nothing"`. A cold reader on the audit tier writing `- Nothing.` or `- None` under a question creates a finding with no `breaks when:`; the plan's agent must then answer a non-finding, and in the planning run the review stays incomplete for a session. Fix: skip when `/^(nothing|none)\.?$/i` matches the trimmed text. Answers A27.

  </details>

#### Build Phase 5 Verification

- [x] The reader counts a fenced diff, a reasonless answer, an invented clause and a capitalised "nothing" the way the person would, failing today and passing after the fixes, and every earlier reader test still passes.
  <details><summary>Technical</summary>

  A24, A25, A26, A27 in `apps/indusk-mcp/src/lib/audit/answers.test.ts`, written red first; then `indusk plans tests audit-concerns-are-answered --phase "Build Phase 5"` (or `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/audit src/lib/build/next-planning-step src/lib/build/read-planning`), A2, A4, A5, A10, A13, A17, A20, A21 still green; the package's type check clean.

  </details>

#### Build Phase 5 Context

- [x] Add to the package's rules that the audit reader skips fenced blocks and checks a telemetry answer's clause against the registry.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the `lib/audit/` entry: `readAuditAnswers` masks fences with `fencedLineMask` (never a second fence rule), an answer with no text is no answer, and `plans audit-answers` checks a signal's clause against the registry, an unreadable registry refusing by name.

  </details>

#### Build Phase 5 Document

- [x] Say in the plans reference that the answers command refuses a reasonless answer and a clause the registry does not hold.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`, `plans audit-answers`: exit 2 also names an answer with no text and a signal whose clause is not declared; fenced blocks are not read as findings.

  </details>

- [x] Review the audit reader and the answers command for craft — nothing found.
  <details><summary>Technical</summary>

  Shape: reviewed `lib/audit/answers.ts` and the `plansAuditAnswers` change; `namesClause` is the one new named unit and the registry read stays in the command so the reader stays pure.

  </details>
- Decisions (unattended): the clause set is built only for the post-build audit, from `readPromises(cwd)`; the plan-review has no clauses to check. Phase tests: 14 of 17 files pass; the three failures (`build-host.test.ts`, `plans/approve/route.test.ts` — unresolved `@infinitedusky/indusk-mcp/plans` because this worktree has no built `dist/`; `gate-policy-env.test.ts` passes when run alone) are must-not-break files this phase does not touch.

#### Build Phase 5 Hunt record

What was investigated, and why some suspicions were not written as hypotheses (`INDUSK_GATE_POLICY=auto`; the decisions below are the falsifier's own):

- **Investigated with hypotheses above**: `lib/audit/answers.ts` (every regex and the line loop), `plans audit-answers` in `bin/commands/plans.ts`, `readReview` in `lib/build/read-planning.ts` and the planning runner's progress fingerprint.
- **Investigated, nothing found**: `nextBuildStep`'s new order and amendment stop (`lib/build/next-step.ts`) — the amendment check sits after the error and no-progress checks and before every step, and `readBuildPlan` turns an unreadable approval into `BuildPlanUnreadable`, never an empty list; `planReviewInputs` (`lib/audit/inputs.ts`) hands only the four documents and the tree; `PLANNING_STEPS` gains `plan-review`, so approving is refused inside it; `nextSession`'s and `describeStep`'s new cases.
- **Considered and not written, with reasons**:
  - The unattended build moves from the audit to falsification once `audit.md` exists, answered or not (`isAuditComplete` reads existence only). Not a defect of this plan: ADR decision D5 keeps the audit advisory and existence-only, and the ADR rejected a gate on unanswered concerns; a build-loop gate would reverse that decision, which is the person's, not a falsification fix.
  - An `amendment` answer written in `audit.md` without the matching brief edit is not stopped on, since the build loop reads amendments from the brief (`amendmentsOf`), not from `audit.md`. Not written: no reader can tell, after a re-approval, an amendment already approved from one never made, so any detector would stop forever or never; the skill's instruction to edit the brief is the only workable carrier.
  - `planReviewInputs` computes the full diff and stat through `codeChanges` only to keep `tree` — wasted work, not a wrong result; left to `/cleanup`.
  - A heading the reader numbers (`## 1. Does each row…`) reads as a missing question. The skill says "unnumbered" and the command names the missing question, so the agent can fix it in the same session; no liveness loss beyond one rerun.
- **Not investigated**: the admin's rendering of the new stop (`BuildControls.tsx`, one sentence) and the skill-copy sync, both covered by type checks and the parity test; the live planning run (A23), which waits for the installed build by design.

### Build Phase 6: Cleanup — the plan review stops computing a diff it throws away

**Tier**: med — the work step's default

The only code worth changing across this plan's files is in the audit inputs: the plan review is handed the tracked-file list, but it gets it by running the same function that builds the full diff and diff summary for the post-build audit, then discards both. Splitting the file-list step out leaves the audit's output identical and stops the plan review doing git work it never uses. Everything else this plan changed is cohesive or under the file-size focus point, and each is recorded below with the reason it stays.

- [x] Lift the tracked-file list out of the function that also builds the diff, so the plan review asks only for the list.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/audit/inputs.ts`, extract the `git ls-tree -r --name-only <branch>` + `isBookkeeping` filter from `codeChanges` into `trackedTree(code)`; `codeChanges` calls it for `tree`, `planReviewInputs` calls it directly and no longer runs `branchFileChanges`, `git diff` or `git diff --stat`. Basis: single responsibility, and the falsification hunt record's "wasted work, left to /cleanup". Function-local, so no new public export.

  </details>
- [x] (reviewed the post-build audit's answers command — left as-is: it reads the file, the promises registry and the reader in one place on purpose, so the reader stays a pure function of text.)
  <details><summary>Technical</summary>

  Reviewed `plansAuditAnswers` in `apps/indusk-mcp/src/bin/commands/plans.ts`. The file is 477 lines, over the 400 focus point, but it is a collection of one-verb command wrappers; this plan added ~55 lines to it, 50 of them this one function. Moving the registry read into `lib/audit/` would make `answers.ts` depend on the registry and break the Build Phase 5 Shape decision that kept it pure. Extracting the function alone would only relocate it. No second copy of the clause-set or the refusal pattern exists elsewhere (searched `src/` for the `${p.name}/${c.name}` build), so the rule of three is not met.

  </details>
- [x] (reviewed the other changed source files — left as-is: each is under the focus point and was Shape-reviewed in its phase.)
  <details><summary>Technical</summary>

  `lib/audit/answers.ts` (195), `lib/audit/inputs.ts` (241), `build-session.ts` (220), `read-planning.ts` (216), `next-planning-step.ts` (104), `next-step.ts` (102), `next-session.ts` (109), `step-env.ts` (46), `read-plan.ts` (47): all under 400, each with one responsibility; no helper appears in two files. The five skill files and the docs pages are prose, not decomposable units. Not investigated: `BuildControls.tsx` (one added sentence).

  </details>

#### Build Phase 6 Verification

- [x] The audit's inputs for a finished plan are unchanged, and the plan review's inputs are still the four documents and the file list.
  <details><summary>Technical</summary>

  No row flips — behaviour-preserving refactor with existing coverage: A7 (`plans-audit-inputs.test.ts`, the auditor is still handed only the documents, approved impl and diff) and A18 (the plan review's inputs are the four documents and the tracked-file list) stay green; the package's type check is clean.

  </details>

#### Build Phase 6 Context

- [x] (none needed — internal decomposition of one function; no rule, path or module boundary changes.)

#### Build Phase 6 Document

- [x] (none needed — internal decomposition; the plan review's printed inputs, which the docs describe, are unchanged.)

### Build Phase 7: Each clause reports its signal

**Tier**: med — the work step's default

Added after landing (Sandy, 2026-10-19). Since the plan that links clauses to their telemetry landed, a plan with clauses closes only when each clause's signal has reported it upheld in a real run, and this plan's code reports none. This phase makes each check this plan built report the clause it checks, through the commands' one tracer, then runs each check for real so the close can read them. It hands the next phase a plan whose promises can close.

- [x] Make the audit answers command report the four audit clauses each time it reads an audit.
  <details><summary>Technical</summary>

  New `markAuditAnswers(projectRoot, plan, answers, tracer?)` in `apps/indusk-mcp/src/lib/audit/answers-signal.ts`, in the shape of `markClosing` (`lib/promises/closing-signal.ts`): one `markPromise` span per clause of `an-audit-concern-gets-a-solution` — `the-audit-finds` (broken when `incomplete` is non-empty), `the-plan-answers` (`unanswered` or `noClause`), `a-dismissal-reaches-the-person` (upheld when every dismissal was printed), `an-audit-teaches` (`missingCauses`); `signal: { plan: "audit-concerns-are-answered", phase: "Build Phase 7" }`; best-effort, never fails the command; `flushCommandTracer()` at the end. Called from `plansAuditAnswers` in `bin/commands/plans.ts` for `audit.md`. Each file carries its `clause:` tokens. A28.

  </details>
- [x] Make the build report the significant-concern clause when it stops on a waiting amendment.
  <details><summary>Technical</summary>

  `markAmendmentStop` in `apps/indusk-mcp/src/lib/build/amendment-signal.ts`: upheld when `nextBuildStep` returns `amendment` while `amendments` is non-empty; broken when it returns a session step while non-empty. Called by `runBuild` (`lib/build/runner.ts`) after each decision and by `plans next`. A29.

  </details>
- [x] Make the plan review's inputs and its reader report their clauses, and the planning run report reaching approval.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/audit/review-signal.ts`: `the-reader-sees-documents-only` from `plans review-inputs` (upheld when the printed keys are exactly plan, documents, tree); `the-reader-checks-the-plan` from `plans audit-answers --plan-review` (`missingQuestions`); `the-plan-is-answered-before-approval` and `the-planning-run-reads-it-cold` from `runPlanning` (`lib/build/planning-runner.ts`) when it stops `ready-for-approval` — broken when no `plan-review` step ran in the run or the review was incomplete. A30, A31.

  </details>
- [x] Run each check for real with the local daemon up, so each clause has a real signal.
  <details><summary>Technical</summary>

  The worktree's own build, not the installed one (landing refuses an install from the worktree): `node apps/indusk-mcp/dist/bin/cli.js plans audit-answers audit-concerns-are-answered`, `... plans review-inputs <a plan with a draft impl>` and `... plans audit-answers <that plan> --plan-review`. The planning-run and amendment-stop clauses report from the admin once this phase lands and is installed. A32 is checked at close.

  </details>
- [x] Review the signal writers against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 7 Verification

- [x] Each signal writer reports upheld and broken as its clause says, and no writer can fail its command.
  <details><summary>Technical</summary>

  A28, A29, A30, A31: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 7"`; type check clean.

  </details>
- [x] The close's own check of the real signals is written down and waits for the real runs.
  <details><summary>Technical</summary>

  A32 stays `skipped` with its procedure until `indusk promises confirm audit-concerns-are-answered` passes at close.

  </details>

#### Build Phase 7 Context

- [x] Add to the package's rules that each check this plan built reports its clause.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the `lib/audit/` entry: the answers command, the review inputs and the planning run report their clauses through the commands' tracer (`answers-signal.ts`, `review-signal.ts`, `amendment-signal.ts`).

  </details>

#### Build Phase 7 Document

- [x] Say in the audit skill's reference page which commands report which clause.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/audit.md`: a short "Signals" section.

  </details>

  Build Phase 7 notes (unattended): Shape: reviewed, nothing found — the four writers share `lib/promises/clause-signal.ts` (one span-per-verdict loop). Decisions: (1) the tests were written beside the writers, not before — the rows were added after landing and the writers are small; they pass on their own assertions. (2) `reviewed` for the planning run counts a plan review that stood complete when the run began, so a resumed run is not marked broken for a review an earlier run did. (3) The runners take an optional `signals: { root, plan }` and the admin's `build-host.ts` passes it; absent, nothing is reported. (4) Real runs: `plans audit-answers` and `plans review-inputs` ran from the worktree build with the daemon up and their spans reached it; `--plan-review`, the planning-run stop and the amendment stop report from real runs after this lands and is installed (A32 stays skipped until the close). (5) `plans-next.test.ts` A11 still expected the old order (audit after cleanup, before Build Phase 2 moved it before falsification); updated to the current order.

### Build Phase 8: Close what the audit left open

**Tier**: med — the work step's default

The audit of this plan ran under the old instruction not to act on findings, so it answered all fifteen concerns "nothing", ten of them named real. This phase fixes those ten: the build waits for a complete audit, the reader stops letting other list shapes and bare causes through, an edit to what was not promised waits for the person, a stale plan review is redone, an unreadable approval stops plainly, the clause check reads the plan's own registry and forgives trailing punctuation, a plan review refuses signal answers, and a brief changed before approval is shown with the dismissals.

- [x] Make the build count the audit done only when its answers read complete.
  <details><summary>Technical</summary>

  `readBuildPlan` reads `audit.md` through `readAuditAnswers`; while it exists but is incomplete or unanswered, `nextBuildStep` returns `audit` again. The retrospective's gate is unchanged (`an-audit-blocks-nothing`: it still reads existence). A33.

  </details>
- [x] Make a cause that names no findings or no highlight incomplete.
  <details><summary>Technical</summary>

  `readAuditAnswers`: each line under `## What let these through?` matches `- <cause> — findings: <refs> — highlight: <id>` or `- no process gap — <reason>`; anything else sets `missingCauses`. A34.

  </details>
- [x] Make star and numbered list items count as findings.
  <details><summary>Technical</summary>

  `readAuditAnswers`: a top-level `* ` or `1. ` line under a question heading is a finding like `- `. A35.

  </details>
- [x] Make an edit to the brief's Not promised section an amendment.
  <details><summary>Technical</summary>

  `amendmentsBetween` (`lib/plans/amendments.ts`): a `scope` part comparing the Not promised list; the gate hook and the build's amendment stop pick it up unchanged. A36.

  </details>
- [x] Make a plan review written before the documents last changed count as out of date.
  <details><summary>Technical</summary>

  The plan review records the hash of the four documents it read in its frontmatter (`read:`); `readPlanningState` marks the review incomplete when the documents' hash differs, so `nextPlanningStep` returns `plan-review` again. The audit skill's before-approval section writes the field from `plans review-inputs` (which prints it). A37.

  </details>
- [x] Make an unreadable approval record stop the build with a plain reason.
  <details><summary>Technical</summary>

  `readBuildPlan`: an `AmendmentsUnreadable` becomes `cannot-continue` with "the approval record cannot be read: … — re-approve the plan", rather than a thrown read. A38.

  </details>
- [x] Make the answers command check signal clauses against the plan's own registry.
  <details><summary>Technical</summary>

  `plansAuditAnswers` reads `.indusk/promises/` from the plan's live copy (`livePlanCopy`), not `process.cwd()`. A39.

  </details>
- [x] Make a clause name read without trailing punctuation.
  <details><summary>Technical</summary>

  `readAuditAnswers`: strip trailing `.,;:)` from the `clause:` value before comparing. A40.

  </details>
- [x] Make a plan review refuse a signal answer.
  <details><summary>Technical</summary>

  `readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS })`: a `signal` answer is listed as refused, naming the finding. A41.

  </details>
- [x] Show a brief changed since acceptance with the dismissals when the plan is ready for approval.
  <details><summary>Technical</summary>

  `readPlanningState` compares the brief with its accepted version (the `accept-brief` commit, as `amendmentsBetween` compares with approval) and puts the differences on the `ready-for-approval` stop beside `dismissals`. A42.

  </details>
- [x] Review the changed reader and loops against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 8 Verification

- [x] Each of the ten fixes holds, and the earlier rows stay green.
  <details><summary>Technical</summary>

  A33–A42: `indusk plans tests audit-concerns-are-answered --phase "Build Phase 8"` (with the Must-not-break promises' tests); type check clean.

  </details>

#### Build Phase 8 Context

- [x] Add to the package's rules that the build waits for a complete audit and a plan review goes stale with its documents.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the build-loop and `lib/audit/` entries.

  </details>

#### Build Phase 8 Document

- [x] Update the audit skill's reference page for the stale plan review and the scope amendment.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/audit.md`; `apps/docs/src/changelog.md` unreleased line.

  </details>

  Build Phase 8 notes (unattended): Shape: reviewed, nothing found. Decisions: (1) the build reads the audit through `BuildPlan.auditOpen` (set by `readBuildPlan`, shape plus the plan's own registry) and an unreadable approval through `approvalUnreadable`; `nextBuildStep` reads both, so the retrospective gate stays an existence check. (2) `audit-gate.test.ts` and `plans-next.test.ts` expected `plans next` to answer `review` for any `audit.md`; they now expect `audit` for one that is not answered (A33's behaviour) and the walk's fixture writes an answered audit; the retrospective readiness assertions are unchanged. (3) A review with no `read:` hash counts as out of date (a cold read must be tied to its documents); `plans review-inputs` now prints `read`, so the documents-only clause's allowed keys and A18's assertion include it. (4) A fix to a document after a review makes that review stale, so the planning run reads the plan cold again; the loop ends at a pass that needs no fix. (5) `briefChanges` is compared with the brief at the newest `plan(<plan>): brief accepted` commit and is empty when no such commit or no git; the admin's rendering of the new `ready-for-approval` field is not part of this phase. (6) The audit skill and its synced copy now tell the planning agent to write `read:`.

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
