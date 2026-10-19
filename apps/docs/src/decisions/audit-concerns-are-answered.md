# A Plan Is Read Cold Before Approval, and Every Audit Concern Is Answered

**Decided 2026-10-19.** Full ADR: `.indusk/planning/audit-concerns-are-answered/adr.md`. The [audit skill](/reference/skills/audit) and [`plans audit-answers`](/reference/cli/plans#plans-audit-answers-name-plan-review) carry it out.

## Goal

**Most concerns are caught before the build by a cold read of the plan; the code's concerns are caught when the build phases close; every concern gets an answer from the agent that knows the plan, and a person sees each one waved away and decides each one that would change what they approved.**

Today a fresh reader writes `audit.md`, the person is told to read it, and
nothing records what was decided; a concern can be read and forgotten. The last two audits raised 24 and 25 concerns, most visible in the documents
before any code existed, and the unattended build wrote its audit only after
acceptance. After this, the plan is read cold before approval, the audit runs
before falsification, and each finding carries what would show it breaking (the auditor's) and an
answer (the plan's agent's), and the dismissals are put in front of the person.

## Y-Statement

**In the context of:**
the audit step, where a reader with no context writes findings in `audit.md` after cleanup and nothing records what happens to them, and planning, where nothing reads the documents cold before the person approves them.

**Facing:**
a reader that is good at finding what is wrong but cannot weigh a remedy, and a building agent that can weigh it but is the likeliest to dismiss a concern about its own work.

**We decided for:**
the auditor writing, under each finding, what would show it breaking and no remedy; the plan's agent answering each finding in `audit.md` with a fix, a signal or nothing with the reason; one reader of `audit.md` (`readAuditAnswers`, behind `indusk plans audit-answers`) that refuses an unanswered finding and lists every dismissal; the audit skill showing that list to the person; the same reader, shape and answers for a cold read of the plan (`plan-review.md`) as the planning run's last step; the audit moved to before falsification in the build loop; and an answer that would change the brief made as an amendment, which the build loop stops on by name.

**And against:**
the auditor suggesting a remedy for the agent to accept or replace; a separate answers file; a gate that blocks the retrospective on unanswered concerns; a second skill for the plan review; a refusal in `plans approve` without a plan review; and the agent judging which concerns are significant.

**To achieve:**
concerns that end in a fix, a watched signal or a recorded reason, a person who sees every concern that was waved away, and the process gaps behind them turned into lessons.

**Accepting:**
that the building agent still chooses, so the person's look at the dismissals is the only check on its bias; that the audit stays advisory; that a plan written by hand is read cold only because the planner's instructions say so; and that the fixes the audit's answers add, and falsification and cleanup after them, are not read by a second fresh reader.

**Because:**
the fresh reader's value is in not knowing the plan, and the remedy needs knowing it; putting the answer beside the finding keeps one file a person reads; a concern about the plan is cheapest before the code exists; and a concern read before falsification and cleanup can still be acted on by them.

## Context

Split out of `mark-first` on 2026-10-17 (Sandy). Full plan: `.indusk/planning/audit-concerns-are-answered/`.

## Decision

**D1. The auditor finds; it does not prescribe.** Each finding is followed by an indented `- breaks when: <what would show it breaking>` line. A1, A2.

**D2. The plan's agent answers in `audit.md`.** Under each finding, an indented `- answer: fix — <the impl item added>`, `- answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>` or `- answer: nothing — <reason>`. A fix is also added to the impl as discovered work. A3.

**D3. One reader.** `readAuditAnswers(text)` in `apps/indusk-mcp/src/lib/audit/answers.ts` returns each finding with its `breaks` and `answer`, the incomplete and unanswered ones, and the dismissals. `indusk plans audit-answers <plan>` prints them and exits 2 naming each unanswered or incomplete finding, or a signal answer with no clause. A2, A4, A5. A `- nothing` under a heading is not a finding.

**D4. The dismissals reach the person.** The audit skill's last step runs `indusk plans audit-answers`, and shows the person every `nothing` answer with its finding and reason before handing to the retrospective. A5.

**D6. An audit teaches.** After the answers, the plan's agent writes a closing `## What let these through?` section in `audit.md`: each cause as `- <cause> — findings: <question/line refs> — highlight: <id>`, written as a `mcp__indusk__highlight` with tag `audit-cause` so the evaluator decides whether it becomes a lesson; or `- no process gap — <reason>`. One cause question per audit, not per finding, and only a gap that could recur is flagged — a one-off slip is not — so lessons do not drown in noise. `readAuditAnswers` reads the section and reports an audit with findings and none as incomplete. A9, A10. Added 2026-10-17 (Sandy).

**D7. The audit runs when the build phases close, before falsification.** `nextBuildStep` (`lib/build/next-step.ts`) checks `audit` before `falsification` and `cleanup` in the retrospective's `missing` list. The auditor's inputs are unchanged: the impl as approved (which holds no falsification or cleanup phase yet) and the diff. The audit, falsify, cleanup and retrospective skills give the order build → audit → falsify → cleanup → retrospective. `a-plan-is-audited-by-a-fresh-reader-before-it-closes` is changed with `indusk promises change` in the build phase that makes it true. The post-build reader asks the code's questions: Q1 (rows against the promise's sentence, now against the written tests) to Q4; Q5 (skip reasons) and Q6 (files a promise depends on) move to the plan review, which can see them before code exists. A14, A15.

**D8. An answer that would change what the person approved is an amendment.** A fourth answer kind, `- answer: amendment — <the part of the brief changed>`: the plan's agent edits the brief (a promise, an expectation or a look; a scope change is one of these added or dropped) and ends the session. `BuildPlan` gains `amendments: string[]` from `amendmentsOf` (`lib/plans/amendments.ts`), which `readBuildPlan` fills; `nextBuildStep` returns `{ step: "amendment", amendments }` before anything else when it is non-empty, a stop like review, so the build waits for the person's re-approval (`indusk plans reapprove`, or Approve on the plan's page) by name rather than burning two empty steps into "cannot continue" against the gate hook's refusal. The agent decides whether a concern is significant by this rule only, never by weight. A11, A12, A13.

**D9. The plan review: same reader, same shape, before approval.** `/audit {plan} --before-approval` hands a fresh subagent the output of `indusk plans review-inputs <plan>` (`planReviewInputs` in `lib/audit/inputs.ts`): the brief, test plan, ADR and impl as they stand and the tracked-file list; never `research.md`, which holds the planning conversation's decisions, and never the session. The reader writes `plan-review.md` with four `##` questions (planned tests against each promise's sentence; the impl against what each promise claims; skip reasons; files a promise depends on that the plan does not touch), each finding with `- breaks when:`. The planning agent answers each with `fix — <document changed>`, `amendment — <brief part>` (shown to the person at approval, since nothing is approved yet) or `nothing — <reason>`. The questions are exported once (`AUDIT_QUESTIONS`, `PLAN_REVIEW_QUESTIONS` in `lib/audit/answers.ts`) so the skill's wording test and the reader agree. `readAuditAnswers` reads both files; `indusk plans audit-answers <plan> --plan-review` reads `plan-review.md`. A16, A17, A18, A19.

**D10. The planning run ends with the plan review.** `plan-review` joins `PLANNING_STEPS` (`lib/build/step-env.ts`), so approving is refused inside it. `PlanningState` gains `review: { exists, complete }`, read by `readPlanningState` through `readAuditAnswers`. `nextPlanningStep` returns `plan-review` once every document passes and the contract holds, and `ready-for-approval` only when the review is complete and answered; the stop carries the review's dismissals and amendment answers so the admin's run shows them with the plan. `stepPrompt` gives the step `/audit {plan} --before-approval`. A plan written by hand gets the same read because the planner skill says to run it before presenting. A20, A21, A22, A23.

**D5. Still advisory.** The retrospective's gate still reads only that `audit.md` exists; an older `audit.md` with no answers passes it. A6.

## Alternatives Considered

### The auditor suggests a remedy
Considered and not chosen (Sandy, 2026-10-17): it would anchor the agent on a remedy chosen without context.

### A separate answers file
Rejected: two files for one concern, and a person reads one.

### A gate on unanswered concerns
Rejected against `an-audit-blocks-nothing`: the audit stays advisory; the refusal is the command's exit code, which the skill acts on.

### A second skill for the plan review
Rejected: the reader, the shape and the answers are the audit's; only the inputs and the questions differ, so one skill with a mode keeps one place to change them.

### `plans approve` refusing a plan with no plan review
Rejected: the brief promises no gate, and a person approving by hand may choose to; the unattended run cannot reach "ready for approval" without one.

### The agent judging which concerns are significant
Rejected (Sandy, 2026-10-19): the agent that missed a concern is the worst judge of its weight. Significance is a fact about the answer, whether it changes the brief, which the amendment check already computes.

### The audit after cleanup, as before
Rejected: its findings arrived after the rituals that could act on them, and in the unattended build after acceptance.

## Consequences

### Positive
- No concern is left without a decision; dismissals are visible.
### Negative
- One more step at the end of every audit, and one more planning step before approval.
### Risks
- The agent writes thin reasons: mitigated by the person seeing each.
- The agent answers "fix" for something that changes the brief to avoid stopping: the amendment check reads the brief, not the answer, so the build stops anyway.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/skills/audit.md` — the `breaks when` line, the answers (amendment included), the dismissal list, the before-approval mode, the new order.
- Update: `apps/docs/src/reference/cli/plans.md` — `plans audit-answers` (with `--plan-review`) and `plans review-inputs`.
- Update: the lifecycle order wherever the docs give it (`build → audit → falsify → cleanup → retrospective`).
### Diagrams
- None.
### Changelog
- Added: a plan is read cold before approval; the audit runs before falsification; the plan's agent answers each concern, and one that would change the brief stops the build as an amendment; dismissals are shown to the person.
### ADR in Docs
- Yes: `decisions/audit-concerns-are-answered.md`.

## References
- `apps/indusk-mcp/skills/audit.md`, `apps/indusk-mcp/src/lib/audit/inputs.ts`
- `.indusk/planning/mark-first/` (where this came from)
