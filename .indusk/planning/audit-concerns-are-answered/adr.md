---
title: "Audit concerns are answered by the plan's agent"
date: 2026-10-17
status: accepted
---

# Audit concerns are answered by the plan's agent

## Goal

**Every concern an audit raises gets an answer from the agent that knows the plan, and a person sees each one waved away.**

Today a fresh reader writes `audit.md`, the person is told to read it, and
nothing records what was decided; a concern can be read and forgotten. After
this, each finding carries what would show it breaking (the auditor's) and an
answer (the plan's agent's), and the dismissals are put in front of the person.

## Y-Statement

**In the context of:**
the audit step, where a reader with no context writes findings in `audit.md` and nothing records what happens to them.

**Facing:**
a reader that is good at finding what is wrong but cannot weigh a remedy, and a building agent that can weigh it but is the likeliest to dismiss a concern about its own work.

**We decided for:**
the auditor writing, under each finding, what would show it breaking and no remedy; the plan's agent answering each finding in `audit.md` with a fix, a signal or nothing with the reason; one reader of `audit.md` (`readAuditAnswers`, behind `indusk plans audit-answers`) that refuses an unanswered finding and lists every dismissal; and the audit skill showing that list to the person.

**And against:**
the auditor suggesting a remedy for the agent to accept or replace; a separate answers file; and a gate that blocks the retrospective on unanswered concerns.

**To achieve:**
concerns that end in a fix, a watched signal or a recorded reason, a person who sees every concern that was waved away, and the process gaps behind them turned into lessons.

**Accepting:**
that the building agent still chooses, so the person's look at the dismissals is the only check on its bias; and that the audit stays advisory.

**Because:**
the fresh reader's value is in not knowing the plan, and the remedy needs knowing it; putting the answer beside the finding keeps one file a person reads.

## Context

[research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md).
Split out of `mark-first` on 2026-10-17 (Sandy).

## Decision

**D1. The auditor finds; it does not prescribe.** Each finding is followed by an indented `- breaks when: <what would show it breaking>` line. A1, A2.

**D2. The plan's agent answers in `audit.md`.** Under each finding, an indented `- answer: fix — <the impl item added>`, `- answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>` or `- answer: nothing — <reason>`. A fix is also added to the impl as discovered work. A3.

**D3. One reader.** `readAuditAnswers(text)` in `apps/indusk-mcp/src/lib/audit/answers.ts` returns each finding with its `breaks` and `answer`, the incomplete and unanswered ones, and the dismissals. `indusk plans audit-answers <plan>` prints them and exits 2 naming each unanswered or incomplete finding, or a signal answer with no clause. A2, A4, A5. A `- nothing` under a heading is not a finding.

**D4. The dismissals reach the person.** The audit skill's last step runs `indusk plans audit-answers`, and shows the person every `nothing` answer with its finding and reason before handing to the retrospective. A5.

**D6. An audit teaches.** After the answers, the plan's agent writes a closing `## What let these through?` section in `audit.md`: each cause as `- <cause> — findings: <question/line refs> — highlight: <id>`, written as a `mcp__indusk__highlight` with tag `audit-cause` so the evaluator decides whether it becomes a lesson; or `- no process gap — <reason>`. One cause question per audit, not per finding, and only a gap that could recur is flagged — a one-off slip is not — so lessons do not drown in noise. `readAuditAnswers` reads the section and reports an audit with findings and none as incomplete. A9, A10. Added 2026-10-17 (Sandy).

**D5. Still advisory.** The retrospective's gate still reads only that `audit.md` exists; an older `audit.md` with no answers passes it. A6.

## Alternatives Considered

### The auditor suggests a remedy
Considered and not chosen (Sandy, 2026-10-17): it would anchor the agent on a remedy chosen without context.

### A separate answers file
Rejected: two files for one concern, and a person reads one.

### A gate on unanswered concerns
Rejected against `an-audit-blocks-nothing`: the audit stays advisory; the refusal is the command's exit code, which the skill acts on.

## Consequences

### Positive
- No concern is left without a decision; dismissals are visible.
### Negative
- One more step at the end of every audit.
### Risks
- The agent writes thin reasons: mitigated by the person seeing each.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/skills/audit.md` — the `breaks when` line, the answers, the dismissal list.
- New: `apps/docs/src/reference/cli/plans.md` entry for `plans audit-answers`.
### Diagrams
- None.
### Changelog
- Added: the plan's agent answers each audit concern; dismissals are shown to the person.
### ADR in Docs
- Yes: `decisions/audit-concerns-are-answered.md`.

## References
- `apps/indusk-mcp/skills/audit.md`, `apps/indusk-mcp/src/lib/audit/inputs.ts`
- `.indusk/planning/mark-first/` (where this came from)
