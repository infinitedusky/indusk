---
title: "A plan is read cold before approval, and every audit concern is answered — Test Plan"
date: 2026-10-17
status: accepted
---

# A plan is read cold before approval, and every audit concern is answered — Test Plan

## Purpose

The clause plan: the two promises this plan makes, their clauses, each
clause's signal and the assertions that prove it before release, and the
assertions for the promise it changes (the audit now runs before falsification). The audit skill's instructions are
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

### `an-audit-teaches` — each process gap behind an audit's findings is named and flagged for a lesson; an audit with none says so

- Signal: emitted by the same read. Upheld when an audit with findings carries a "What let these through?" section naming each cause with the findings it covers and its highlight, or "no process gap" with the reason; broken reports an audit with findings and no such section.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | The audit's instructions tell the plan's agent, after answering, to ask once across all findings what in the planning or building let them through, to group findings by cause, to flag each recurring process gap as a highlight for a lesson, and to say "no process gap" with a reason when there is none. | unit |
| A10 | Reading an audit with findings but no "What let these through?" section reports it incomplete; one whose causes each name their findings and highlight, or that says "no process gap" with a reason, passes. | unit |

### `a-significant-concern-goes-to-the-person` — a concern whose answer would change what the person approved is written as an amendment, which stops the build; every other concern is answered without asking

- Signal: the build's stop. Upheld when an audit carrying an amendment answer is followed by a build that stops for the person's re-approval; broken reports a build that ran a step past a waiting amendment, or an amendment answer with no change in the brief.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | The audit's instructions tell the plan's agent that an answer which would change a promise, an expectation, a look or the plan's scope is made as an edit of the brief, recorded as an amendment answer, after which the session stops; and that every other concern is answered without asking. | unit |
| A12 | With an amendment waiting for the person, the unattended build stops for re-approval, naming the amendment, instead of running another step or ending "cannot continue". | unit |
| A13 | Reading an audit accepts an amendment answer as an answer and lists each one with its finding, beside the dismissals. | unit |

## `a-plan-is-read-cold-before-approval`

Before a plan is put to the person for approval, a reader that has not seen the
planning conversation reads its brief, test plan, ADR and impl against each
other, and the planning agent answers each concern it raises.

### `the-reader-checks-the-plan` — the reader asks the four plan questions

- Signal: emitted when the plan review's answers are read. Upheld when the plan review carries each of the four questions as a heading with findings or "nothing"; broken reports the question left out.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | The audit's instructions, for a plan before approval, put four questions to the reader: whether each planned test proves its promise's sentence or something narrower, whether the impl builds what each promise claims, which skip reason it would not accept, and which files a promise depends on that the plan does not touch. | unit |
| A17 | Reading a plan review with one of the four questions missing reports it incomplete, naming the question; one with all four passes. | unit |

### `the-reader-sees-documents-only` — the reader is never handed the planning conversation or the planning agent's notes

- Signal: emitted when the reader's inputs are produced. Upheld when they hold exactly the brief, test plan, ADR, impl and the list of tracked files; broken reports any other field.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | The plan review's inputs are the plan's brief, test plan, ADR and impl as they stand, and the list of tracked files, and nothing else: no research notes, no session. | unit |

### `the-plan-is-answered-before-approval` — each concern is answered before the plan is presented, and the answers are shown with it

- Signal: the planning run's stop. Upheld when it stops "ready for approval" only with every plan-review finding answered, and its stop names each dismissal; broken reports a ready-for-approval stop with an unanswered finding.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | The audit's instructions tell the planning agent to answer each plan-review finding by changing a plan document or with the reason nothing is needed, and to show the dismissals when presenting the plan; the planner's instructions say to run the plan review before presenting a plan written by hand. | unit |
| A20 | The planning run's "ready for approval" stop lists each plan-review dismissal with its finding and reason. | unit |

### `the-planning-run-reads-it-cold` — the unattended planning run reads the plan cold as its last step

- Signal: the planning run's steps. Upheld when a run that reaches "ready for approval" ran the plan review after the impl; broken reports a run that stopped for approval without one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | Once the impl and the plan's contract check pass, the planning run's next step is the plan review; while the review is missing, incomplete or unanswered it stays the next step; once answered, the run is ready for approval. | unit |
| A22 | The plan review is a planning step, so approving the plan is refused from inside it. | unit |
| A23 | The next unattended planning run after landing writes an answered plan review before it stops for approval. | live check |

## `a-plan-is-audited-by-a-fresh-reader-before-it-closes` (changes)

Now: when a plan's build phases close, before falsification, a reader that has
not seen the building session reads the plan and writes `audit.md`.

- Signal: the build's steps. Upheld when the audit step runs after the last build phase and before the falsify step; broken reports a falsify or cleanup step that ran while `audit.md` was missing.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A14 | With every build phase closed and falsification, cleanup and the audit all to do, the unattended build's next step is the audit; once `audit.md` exists, it is falsification. | unit |
| A15 | The audit, falsify, cleanup and retrospective instructions all give the order: build, audit, falsify, cleanup, retrospective. | unit |

## Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A6 | An `audit.md` written before this plan, with no answers, still lets the retrospective start. | unit | a regression guard over `an-audit-blocks-nothing` |
| A7 | The reader is still handed only the plan's documents, the approved impl and the diff, never the session. | unit | a regression guard over `a-plan-is-audited-by-a-fresh-reader-before-it-closes` |
| A8 | The project's copy of the audit skill is the same text as the package's. | unit | so the change reaches every project that updates |
