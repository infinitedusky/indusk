---
title: "Audit concerns are answered by the plan's agent"
date: 2026-10-17
status: complete
workflow: feature
---

# Audit concerns are answered by the plan's agent — Research

## Question

Who decides what to do about a concern the audit raises, and where is the
answer kept?

## Background

The audit step (`apps/indusk-mcp/skills/audit.md`) spawns a fresh reader that
did not build the plan, puts six fixed questions to it, and has it write
`audit.md` in the plan folder: findings as `- <file>:<line> — <finding>` under
each question's heading. It is advisory (`an-audit-blocks-nothing`): the
retrospective reads that `audit.md` exists, never what it says. Today the skill
ends with "Read the findings with the person; whether any is acted on is their
choice" — nothing records what was decided about each finding, so a concern can
be read and forgotten.

`mark-first` (Tests and telemetry linked to clauses) carried a seventh question
in which the auditor itself answered each concern with a signal, a fix or a
reason. It was split out on 2026-10-17.

## Findings

- The auditor is chosen for having no context; that makes it good at finding
  and poor at choosing a remedy (cost, what already covers it, whether a signal
  would fire on a path that runs).
- The plan's agent — the session running `/audit`, which built the plan — has
  that context, and is also the reader most likely to dismiss a concern about
  its own work.
- `audit.md`'s shape is already read structurally by nothing; a small reader
  of its findings is new code, in `apps/indusk-mcp/src/lib/audit/` beside
  `inputs.ts`.

## Decisions

- The auditor finds each concern and says what would show it breaking; it
  suggests no remedy. The plan's agent answers each: a fix, a signal, or
  nothing with the reason. Every "nothing needed" is shown to the person
  (Sandy, 2026-10-17). Considered and not chosen: the auditor suggesting a
  solution for the agent to accept or replace.
- No resting clause on `a-clause-is-proved-twice` for now: that promise is not
  yet in the trunk's registry; the dependency is ordering, recorded in the brief.

## Open Questions

- None.
- 2026-10-19: the reader's (A2, A4, A10, A13, A17) and the review inputs' (A18) tests wait for their modules (`lib/audit/answers.ts`, `planReviewInputs`); their bodies are carried in the impl's register.
