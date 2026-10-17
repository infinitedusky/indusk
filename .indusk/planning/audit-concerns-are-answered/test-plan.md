---
title: "Audit concerns are answered by the plan's agent — Test Plan"
date: 2026-10-17
status: accepted
---

# Audit concerns are answered by the plan's agent — Test Plan

## Purpose

The clause plan: the one promise, its three clauses, each clause's signal and
the assertions that prove it before release. The audit skill's instructions are
part of the product, so some rows read what they say; the rest exercise the
reader of `audit.md` that this plan adds.

## `an-audit-concern-gets-a-solution`

Each concern an audit raises is answered by the plan's agent with a fix, a
signal that would show it breaking, or the reason nothing is needed.

### `the-audit-finds` — the auditor raises each concern and says what would show it breaking, and suggests no remedy

- Signal: emitted when the audit's answers are read after each audit. Upheld when every finding carries what would show it breaking; broken reports the finding that does not, naming the plan and the question.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | The audit's instructions tell the reader to write, under each finding, what would show it breaking, and not to suggest a remedy. | unit |
| A2 | Reading an audit whose finding has no "what would show it breaking" line reports that finding as incomplete, naming its question and line. | unit |

### `the-plan-answers` — the plan's agent answers each concern with a fix, a signal or nothing with the reason

- Signal: emitted by the same read. Upheld when every finding has an answer of one of the three kinds, and every signal answer names its invariant, where it is emitted, how often it would fire and its clause; broken reports the finding without one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | The audit's instructions tell the plan's agent, once the reader has written, to answer every finding with a fix (added to the impl), a signal (invariant, where emitted, how often it would fire, which clause) or nothing with the reason. | unit |
| A4 | Reading an audit with a finding left unanswered, or a signal answer that names no clause, refuses, naming the finding; one where every finding is answered passes. | unit |

### `a-dismissal-reaches-the-person` — every concern answered "nothing needed" is shown to the person with its reason

- Signal: emitted by the same read. Upheld when each "nothing" answer is listed in the report the person is shown; broken reports a dismissal left out.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | Reading an audit lists every "nothing needed" answer with its finding and reason, and the audit's instructions say to show that list to the person before the retrospective. | unit |

## Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A6 | An `audit.md` written before this plan, with no answers, still lets the retrospective start. | unit | a regression guard over `an-audit-blocks-nothing` |
| A7 | The reader is still handed only the plan's documents, the approved impl and the diff, never the session. | unit | a regression guard over `a-plan-is-audited-by-a-fresh-reader-before-it-closes` |
| A8 | The project's copy of the audit skill is the same text as the package's. | unit | so the change reaches every project that updates |
