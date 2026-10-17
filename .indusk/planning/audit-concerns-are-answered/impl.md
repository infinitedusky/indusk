---
title: "Audit concerns are answered by the plan's agent"
date: 2026-10-17
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "37fb8c344bcd9fd645863dc517edb7cf5430df3f1e7a383504d267298d829f3d"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T18:21:12.860Z"
---

# Audit concerns are answered by the plan's agent

## Goal

Every concern an audit raises gets an answer from the agent that knows the
plan — a fix, a signal or a reason — and every concern waved away is shown to
the person.

## Scope

### In Scope

- The audit skill: the reader writes what would show each finding breaking;
  the plan's agent answers each; the dismissals are shown to the person.
- A reader of `audit.md`'s findings and answers, and the command behind it.

### Out of Scope

- Any gate on unanswered concerns.
- Emitting the clauses' signals from InDusk's own commands: that needs the
  tracer `mark-first` adds; this plan builds after it lands and uses it then.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the skill-wording tests, red; the reader's tests recorded with their bodies | the brief, the ADR |
| Build Phase 1 | `readAuditAnswers` in `lib/audit/answers.ts`; `indusk plans audit-answers` | the `audit.md` shape |
| Build Phase 2 | the audit skill's new steps; its project copy; docs | Build Phase 1's command |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | The audit's instructions tell the reader to write what would show each finding breaking, and no remedy | Test Phase 1 | Build Phase 2 | planned | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A2 | Reading an audit reports a finding with no "breaks when" line as incomplete, naming its question and line | Build Phase 1 | Build Phase 1 | planned | unit | clause: an-audit-concern-gets-a-solution/the-audit-finds | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A3 | The audit's instructions tell the plan's agent to answer every finding with a fix, a signal or nothing with the reason | Test Phase 1 | Build Phase 2 | planned | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A4 | Reading an audit refuses an unanswered finding or a signal answer naming no clause, naming the finding; a fully answered one passes | Build Phase 1 | Build Phase 1 | planned | unit | clause: an-audit-concern-gets-a-solution/the-plan-answers | apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A5 | Reading an audit lists every "nothing needed" answer with its finding and reason, and the instructions say to show the list to the person | Test Phase 1 | Build Phase 2 | planned | unit | clause: an-audit-concern-gets-a-solution/a-dismissal-reaches-the-person | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts, apps/indusk-mcp/src/lib/audit/answers.test.ts |
| A6 | An `audit.md` written before this plan still lets the retrospective start | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard over an-audit-blocks-nothing | apps/indusk-mcp/src/__tests__/audit-gate.test.ts |
| A7 | The reader is still handed only the documents, the approved impl and the diff | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard over a-plan-is-audited-by-a-fresh-reader-before-it-closes | apps/indusk-mcp/src/__tests__/plans-audit-inputs.test.ts |
| A8 | The project's copy of the audit skill matches the package's | Test Phase 1 | Build Phase 2 | planned | unit | so the change reaches every project that updates | apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts |
| A9 | The audit's instructions tell the plan's agent to ask once what let the findings through, group them by cause, flag each recurring process gap for a lesson, or say there is none | Test Phase 1 | Build Phase 2 | planned | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts |
| A10 | Reading an audit with findings but no "What let these through?" section reports it incomplete; one naming each cause with its findings and highlight, or no gap with a reason, passes | Build Phase 1 | Build Phase 1 | planned | unit | clause: an-audit-concern-gets-a-solution/an-audit-teaches | apps/indusk-mcp/src/lib/audit/answers.test.ts |

## Checklist

### Test Phase 1: Write the tests first

**Tier**: med — the work step's default

This phase writes the tests that read the audit skill's instructions, which
fail until the skill says the new steps, and records the reader's tests with
their bodies, since the reader they import does not exist until Build Phase 1.

- [ ] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start feature audit-concerns-are-answered`; `indusk worktree list`.

  </details>
- [ ] Write the tests that read the audit skill for the reader's "what would show it breaking" line, the plan's agent's answers and the dismissal list, and see them fail.
  <details><summary>Technical</summary>

  A1, A3 and the instruction half of A5 in `apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts`, reading `skills/audit.md` as text in the style of `planner-impl-summary-template.test.ts`: the reader's prompt asks for `- breaks when:` under each finding and no remedy; a step tells the plan's agent to answer with `- answer: fix —`, `- answer: signal — …; clause: <promise>/<clause>` or `- answer: nothing —`; the last step runs `indusk plans audit-answers {plan}` and shows the dismissals. A9 in the same file: a step tells the plan's agent, after answering, to ask once across all findings what let them through, group findings by cause, write each recurring process gap as a `mcp__indusk__highlight` (tag `audit-cause`) and record it under `## What let these through?`, or write `- no process gap — <reason>`.

  </details>

#### Deferred to Build Phase 1

- **A2, A4, the reader half of A5, and A10** (an audit with findings and no `## What let these through?` section is incomplete) — their subject, `readAuditAnswers` in `lib/audit/answers.ts`, is a new module; the test file would fail to load, not to assert. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { readAuditAnswers } from "./answers.js";

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
  });
  ```

#### Regression Guards

- **A6** — the retrospective's gate test over an older `audit.md`; passes now and must stay passing.
- **A7** — the audit inputs test; passes now and must stay passing.

#### Test Phase 1 Verification

- [ ] The skill-wording tests fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/audit-skill-answers.test.ts src/__tests__/audit-gate.test.ts src/__tests__/plans-audit-inputs.test.ts` — A1, A3, A5 red on assertions; A6, A7 green. The deferred body above reviewed: it loads once `answers.ts` exports `readAuditAnswers`.

  </details>

#### Test Phase 1 Context

- [ ] Record in this session's section that the plan is at Test Phase 1.
  <details><summary>Technical</summary>

  current.md: via `mcp__indusk__update_current_section` at handoff.

  </details>

#### Test Phase 1 Document

- [ ] Note in the research file that the reader's tests wait for its module.
  <details><summary>Technical</summary>

  `research.md` Findings, one line.

  </details>

### Build Phase 1: Read an audit's findings and answers

**Tier**: med — the work step's default

This phase adds the one reader of `audit.md` that tells a complete, answered
audit from one with a finding left open, and the command the audit skill runs
to show the person what was dismissed.

- [ ] Write the reader's tests from the recorded bodies.
  <details><summary>Technical</summary>

  A2, A4, A5 (reader half) and A10 in `apps/indusk-mcp/src/lib/audit/answers.test.ts`, from the bodies above; A10 also checks that a cause naming its findings and highlight, or `- no process gap — <reason>`, passes.

  </details>
- [ ] Add the reader that returns each finding with what would show it breaking and its answer, and lists the incomplete, the unanswered, the signal answers with no clause and the dismissals, and reads the causes section.
  <details><summary>Technical</summary>

  `readAuditAnswers(text: string): AuditAnswers` in `apps/indusk-mcp/src/lib/audit/answers.ts`; a `- nothing` line under a heading is not a finding; findings are top-level `- ` lines under a `##` heading, their `breaks when:` and `answer:` lines indented beneath. The `## What let these through?` section is the plan's agent's, not a question: each `- <cause> — findings: <refs> — highlight: <id>` or `- no process gap — <reason>`; an audit with at least one finding and no such section is incomplete.

  </details>
- [ ] Add the command that prints the dismissals and refuses an audit with an open finding.
  <details><summary>Technical</summary>

  `indusk plans audit-answers <plan>` in `apps/indusk-mcp/src/bin/cli.ts`, reading `.indusk/planning/<plan>/audit.md` from the plan's live copy; exit 2 naming each incomplete, unanswered or clause-less finding; prints each dismissal as `<question> — <finding> — nothing: <reason>`.

  </details>
- [ ] Review the new reader and command against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 1 Verification

- [ ] The reader's tests pass.
  <details><summary>Technical</summary>

  A2, A4, A5 (reader half), A10: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/audit/answers.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/audit/answers.ts src/bin/cli.ts`

  </details>

#### Build Phase 1 Context

- [ ] Add the reader to the package's rules as the one home of an audit's answers.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Run, verify, Shape, cleanup — the `lib/audit/` entry): `readAuditAnswers` is the one reader of `audit.md`'s findings and answers.

  </details>

#### Build Phase 1 Document

- [ ] Describe the new command in the plans reference.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`: `plans audit-answers`.

  </details>

### Build Phase 2: Tell the reader and the plan's agent what to write

**Tier**: med — the work step's default

This phase changes the audit skill so the reader writes what would show each
finding breaking and no remedy, the plan's agent answers each finding, and the
dismissals are shown to the person; then syncs the project's copy and writes
the docs.

- [ ] Change the reader's instructions to add what would show each finding breaking, and to suggest no remedy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/audit.md`, "The shape of `audit.md`": each finding followed by `  - breaks when: …`; the reader's prompt says no remedy.

  </details>
- [ ] Add a step where the plan's agent answers every finding in the audit file.
  <details><summary>Technical</summary>

  After "Record the model": answer each finding with `  - answer: fix — <the impl item added>`, `  - answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>` or `  - answer: nothing — <reason>`; a fix is also added to the impl as discovered work.

  </details>
- [ ] Make the last step run the answers command and show the person every dismissal.
  <details><summary>Technical</summary>

  Before it, a step: ask once across all findings what in the planning or building let them through; group findings by cause; for each process gap that could recur, write `mcp__indusk__highlight({ tag: "audit-cause", note, level: "important" })` and list it under `## What let these through?` with its findings and highlight id; a one-off slip is not a gap; with none, write `- no process gap — <reason>`. Then `indusk plans audit-answers {plan}`; on exit 2, answer what it names and run it again; print the dismissals to the person before `indusk plans next-session`. Replace "Read the findings with the person; whether any is acted on is their choice."

  </details>
- [ ] Resync the project's copy of the audit skill.
  <details><summary>Technical</summary>

  `.claude/skills/audit.md` from the package; `skill-sync-parity.test.ts` passes.

  </details>
- [ ] Review the changed skill against the extensions' writing rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 2 Verification

- [ ] The skill-wording tests, the copy check and both guards pass.
  <details><summary>Technical</summary>

  A1, A3, A5, A6, A7, A8, A9: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/audit-skill-answers.test.ts src/lib/audit/answers.test.ts src/__tests__/audit-gate.test.ts src/__tests__/plans-audit-inputs.test.ts src/__tests__/skill-sync-parity.test.ts`

  </details>

#### Build Phase 2 Context

- [ ] Add the root's Key Decisions line for this decision.
  <details><summary>Technical</summary>

  root (Key Decisions): "Audit concerns are answered by the plan's agent — the auditor finds, the agent answers, the person sees each dismissal — see /decisions/audit-concerns-are-answered" — always-on because every plan runs the audit step.

  </details>

#### Build Phase 2 Document

- [ ] Update the audit skill's reference page, publish the decision and add the changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/audit.md`; `apps/docs/src/decisions/audit-concerns-are-answered.md` from the ADR, with its sidebar entry; `apps/docs/src/changelog.md`.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/audit/answers.ts` | new: `readAuditAnswers` |
| `apps/indusk-mcp/src/lib/audit/answers.test.ts` | A2, A4, A5 |
| `apps/indusk-mcp/src/__tests__/audit-skill-answers.test.ts` | A1, A3, A5 |
| `apps/indusk-mcp/src/bin/cli.ts` | `plans audit-answers` |
| `apps/indusk-mcp/skills/audit.md`, `.claude/skills/audit.md` | the new steps |
| `apps/indusk-mcp/CLAUDE.md`, root `CLAUDE.md` | context |
| `apps/docs/src/reference/skills/audit.md`, `apps/docs/src/reference/cli/plans.md`, `apps/docs/src/decisions/audit-concerns-are-answered.md`, `apps/docs/src/changelog.md` | docs |

## Dependencies

- `mark-first` lands first: a signal answer names the clause it upholds.
