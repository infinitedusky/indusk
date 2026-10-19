---
title: "Decisions as questions — Test Plan"
date: 2026-10-19
status: draft
---

# Decisions as questions — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. The brief opts into `clauses: required`, so this is the clause plan: one section per promise, one per clause, each clause with its signal, its measure and its table. The assertions become the source rows for the impl's `## Test Trajectory`.

## Behavioral Assertions

**Every assertion is observable from outside the system:** what the person sees under Needs you and on the plan's page, what the agent is told, what a release or a landing does, what a plan's folder holds. Wording follows the brief: a clause is upheld or broken; a session is "unattended" when it runs without the person.

## `a-decision-is-a-question`

When an unattended session meets a choice the plan does not settle, it puts it to the person as a question with its options, its recommendation and a cost, under Needs you and on the plan's page.

### `asked-with-a-recommendation` — each question names its options, the one the agent recommends and why, and its cost

- Signal: the question record the admin shows on the plan's page, read by the admin and by `indusk plans` output. Upheld when every question recorded in a real unattended run carries at least two options, one marked recommended with a reason, and a cost of cheap, moderate or expensive; broken reports the question's id and the missing part.
- Measure: share of questions in the next five unattended runs missing an option list, a recommendation, a reason or a cost; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A question an unattended session asks appears on the plan's page with its options, the recommended one marked with its reason, and its cost. | contract |
| A2 | A question asked without a recommendation, without a reason, with fewer than two options, or with a cost other than cheap / moderate / expensive is refused: the session is told what is missing and nothing reaches the person. | unit |
| A3 | A plan with open questions is listed under Needs you, and a plan with only cheap or moderate questions is listed with the time left. | live check |

### `never-decided-silently` — a session never records a choice as decided unattended without asking it as a question

- Signal: the plan's documents and the question record, read by a check over the plan folder at landing. Upheld when no document written by an unattended session says "decided unattended" for a choice that has no matching question; broken reports the document and line.
- Measure: share of decisions recorded only as "decided unattended" in a document with no question, over the next five plans; expect none (the brief's second expectation).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A planning or build run that records a choice in a document as decided unattended, with no question asked for it, is refused at save, naming the line. | unit |
| A5 | The same choice, recorded with a reference to its question, saves. | unit |
| A6 | In a real unattended planning run over an accepted brief, every choice the run records in its documents has a question on the plan's page. | live check |

## `the-cost-sets-the-wait`

An unanswered cheap question goes ahead with its recommendation after five minutes, a moderate one after an hour, and an expensive one stops its session and frees its slot until the person answers.

### `cheap-and-moderate-go-ahead` — a cheap or moderate question unanswered past its time goes ahead with the recommendation, and says it did

- Signal: the question record's state and the session's events, read in the admin. Upheld when a cheap question left unanswered five minutes, and a moderate one left an hour, are both recorded as having gone ahead with the recommendation, with the time it did so; broken reports a question past its time still waiting, or gone ahead early.
- Measure: for each cheap or moderate question, minutes between its deadline and the session being told to continue; expect under one minute while the admin runs.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A cheap question unanswered at five minutes goes ahead with its recommendation; one answered at four minutes does not, and the answer is used. | unit |
| A8 | A moderate question goes ahead at an hour, not at five minutes. | unit |
| A9 | A question that went ahead says so on its row: what was done and when. | contract |
| A10 | When the admin was not running at a question's deadline, the question goes ahead on the admin's next read, not at the moment the admin starts counting afresh: the deadline is a stored time, so a restart never gives a question more time. | unit |
| A11 | A real unattended run that asks a cheap question and is left alone continues on its own after five minutes. | live check |

### `expensive-waits` — an expensive question stops its session, frees its slot, and the run resumes when the person answers

- Signal: the session list and the question record. Upheld when an expensive question's session is stopped, the machine's running-session count drops by one, and the run resumes with the person's answer; broken reports a stopped plan still holding a slot, or a run that went ahead without an answer.
- Measure: sessions held by plans waiting on an expensive question, at any time; expect zero. Time from answer to the run resuming; expect under a minute.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | A session that asks an expensive question stops, and the plan is listed under Needs you with no timer. | contract |
| A13 | While it waits, the machine counts one fewer running session, and a queued plan can take the freed slot. | unit |
| A14 | Left unanswered for any length of time, an expensive question never goes ahead. | unit |
| A15 | When the person answers, the plan's run resumes and the agent is told the answer. | contract |
| A16 | A real run stopped by an expensive question, once answered in the admin, finishes its phase using the answer. | live check |

## `what-was-agreed-is-never-cheap`

A question whose answer would change the brief, a promise or a look, or skip a gate, is expensive whatever cost the agent gave it.

### `never-timed-out` — a question whose answer would change the brief, a promise or a look, or skip a gate, never goes ahead on a timer

- Signal: the question record's cost as shown on the page, against what each option would change. Upheld when every such question shows as expensive, whatever cost the agent gave it; broken reports a question with such an option that has a timer or went ahead.
- Measure: questions with an option that changes the brief, a promise, a look or a gate that carried a timer or went ahead; expect none, ever.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | A question given as cheap by the agent, one of whose options changes the brief, is shown as expensive with no timer. | unit |
| A18 | The same holds for an option that changes a promise, one that changes a look, and one that skips a gate: each is shown as expensive. | unit |
| A19 | A question whose options change none of these keeps the cost the agent gave it. | unit |
| A20 | A question like A17, left unanswered past five minutes and past an hour, is still waiting. | unit |

## `a-late-answer-opens-a-follow-on`

An answer given after its question went ahead, choosing other than the recommendation, opens a follow-on plan to make the work match it; every question stays readable with its recommendation, its answer and what was done.

### `disagreement-opens-a-plan` — a late answer that differs from what was done opens one draft follow-on plan naming the question, the choice made and the one wanted

- Signal: the planning folder and the question record. Upheld when a late answer that differs from the recommendation is followed by exactly one draft plan whose brief names the question, the choice made and the one wanted; broken reports a late disagreement with no plan, or two.
- Measure: follow-on plans opened per question that went ahead on its timer; expect under one in ten (the brief's third expectation). Late disagreements with no plan, or with more than one; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | A late answer choosing other than what was done opens one draft plan whose brief names the question, the choice made and the one wanted. | unit |
| A22 | A late answer matching what was done opens no plan. | unit |
| A23 | Answering the same late question twice opens one plan, not two. | unit |
| A24 | A disagreeing answer to a question that has not yet gone ahead opens no plan: the answer is simply used. | unit |
| A25 | The follow-on plan is a draft: it is not accepted, approved or started by the answer. | unit |
| A26 | On the question's row, the opened follow-on is linked. | contract |

### `every-decision-stays` — every question, answered, gone ahead or waiting, is kept with its recommendation, its answer and what was done

- Signal: the plan's history record and the plan's page. Upheld when every question asked in a plan, in any state, is still readable after the plan lands, with recommendation, answer (if any) and what was done; broken reports a question missing or a field lost.
- Measure: questions asked against questions readable on the plan's page and in its history at landing; expect equal.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A27 | A question in each state — waiting, answered in time, gone ahead, answered late — is readable on the plan's page with its recommendation, its answer and what was done. | contract |
| A28 | After the plan lands and archives, its questions are still readable in its history. | contract |
| A29 | A question answered in time is recorded in the plan's history like any decision the person answers today. | unit |

## `a-release-waits-for-a-known-wrong`

A release refuses while a follow-on plan opened by a disagreeing answer is open, naming it; landing on main never waits for one.

### `release-refuses` — the release step refuses, naming each open follow-on, until each is closed

- Signal: the release command's output. Upheld when a release with an open follow-on exits refused and names every open one, and proceeds once each is closed; broken reports a release that went through with one open, or one that names too few.
- Measure: releases made with an open follow-on; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A30 | A release with one open follow-on refuses and names its plan. | unit |
| A31 | A release with three open follow-ons names all three. | unit |
| A32 | Once each follow-on is closed (landed, abandoned or archived), the release proceeds. | unit |
| A33 | A follow-on not opened by a disagreeing answer (an ordinary plan) never blocks a release. | unit |
| A34 | `indusk release` run in a real repository with an open follow-on refuses before any publish step. | live check |

### `landing-never-waits` — landing a plan is never refused because a follow-on is open

- Signal: the landing command's output. Upheld when `plans land` of any accepted plan succeeds with a follow-on open; broken reports the landing refused naming a follow-on.
- Measure: landings refused because of an open follow-on; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A35 | Landing an accepted plan with an open follow-on succeeds. | unit |
| A36 | Landing the plan that is itself the follow-on succeeds while it is open. | unit |

## Existing promises that must not break

Each below is an existing promise from earlier plans, listed in the brief under Must-not-break; its tests are named in its file under `.indusk/promises/` and run through `indusk plans tests`. This plan adds no clause to any, and gives each one assertion where the new behavior touches it.

| ID | Assertion (user-visible behavior) | Level | For |
|----|-----------------------------------|-------|-----|
| A37 | A late answer that changes the brief still stops for the person's re-approval; the follow-on, not the answer, carries the change. | unit | promise: a-change-to-what-was-agreed-needs-the-person |
| A38 | No timer, however long it runs, approves a brief, a test plan, a look or an ADR. | unit | promise: only-a-person-reapproves |
| A39 | With the cap reached, a plan waiting on an expensive question holds none of the slots, and a plan waiting on a timer does hold one. | unit | promise: sessions-are-capped |
| A40 | A plan with questions open is no more or less accepted than the same plan without; questions change nothing about acceptance. | unit | promise: nothing-ships-until-accepted |
| A41 | A failure no promise claims still opens its bugfix plan, and the follow-on is opened beside it. | unit | promise: an-unclaimed-failure-opens-a-bugfix-plan |

## Changed promises

Both are existing promises this plan changes; the impl gives the phase that makes the new sentence true the `indusk promises change` item.

| ID | Assertion (user-visible behavior) | Level | For |
|----|-----------------------------------|-------|-----|
| A42 | A plan waiting on the person is listed under Needs you, and its page shows each open question with its recommendation, options, cost and a reply in words; the answer reaches the agent and is recorded in the plan's history. | live check | promise: decisions-wait-in-one-place |
| A43 | An approved plan's build runs through its phases, falsification and cleanup without asking approval, and stops only when ready for review, for a declared judgement, for an expensive question, or when it cannot continue; a cheap or moderate question does not stop it. | live check | promise: a-build-runs-to-review-unasked |

## Looks

The three new looks are held by value in Chromium and approved as mockups by a person before the build; no assertion here approves one. The looks' behavior is below.

| ID | Assertion (user-visible behavior) | Level | For |
|----|-----------------------------------|-------|-----|
| A44 | `question-row.cheap`: a question going ahead on its timer shows the question, the recommendation, the cost, the time left and a reply field. | live check | look: question-row.cheap |
| A45 | `question-row.expensive`: a question that stopped its plan shows the same in red with no timer. | live check | look: question-row.expensive |
| A46 | `question-row.went-ahead`: a question whose timer went ahead shows what was done, and a late answer that differs offers to open the follow-on. | live check | look: question-row.went-ahead |
| A47 | `plan.needs-you`: the decision card lists every open question as a row, expensive first. | live check | look: plan.needs-you |
| A48 | `nav.expanded`: a plan waiting on an expensive question is listed under Needs you as any other wait is. | live check | look: nav.expanded |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A49 | A conversation session with the person present asks as it does today, with no cost and no timer. | unit | a regression guard: the brief leaves planning conversations out; they already ask |
| A50 | Review and acceptance stay stops: no question is made for them. | unit | a regression guard on the research decision that review and acceptance are not questions |
| A51 | A reply that is empty or only spaces is not an answer and leaves the question open. | unit | an input edge no promise names |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Runs stop less: most questions proceed on their timer. | Needs several real unattended runs. | The brief's first expectation, looked at after the next five runs. |
| U2 | The agent's recommendation is a good one, and its cost honest. | Judgement of model output. | The brief's third expectation: follow-on plans per timed-out question, looked at after a month. |

## Decisions

Decided unattended (`INDUSK_GATE_POLICY=auto`); each with its reason, for the reviewer to approve with the plan.

1. **The deadline is a stored time, counted in wall-clock.** This settles the research's open question (does a moderate question's hour count only while the admin runs?): it does not. A question goes ahead on the admin's next read after its deadline (A10). Reason: counting only while the admin runs would give a question a different length each restart, and a person who leaves for an hour expects an hour; the cost is a question that goes ahead late if the admin was down.
2. **The cost is checked, not trusted.** The agent states a cost; the admin raises it to expensive when an option changes the brief, a promise, a look or a gate (A17–A19). Reason: the brief's third promise says the cost is "whatever cost the agent gave it" is overridden, so the check cannot live in the agent's judgement.
3. **A late-disagreement plan is opened once per question** (A23). Reason: a person who answers twice has changed their mind, not asked for two plans; the second answer updates the one plan.
4. **Rows are small and mostly unit.** The timer, the cost rule, the follow-on and the release refusal are pure rules over a question record and the planning folder, so they are unit rows that run in the phase loop. Live checks (A3, A6, A11, A16, A34, A42–A48) need a running admin or a real unattended run; they run in the slow tier after landing and never block landing or release (`/decisions/release-checks-run-once`; a failure there reads as a broken promise). Reason: `/decisions/tests-never-make-us-wait`.
5. **No `promise`-level row.** Each clause has rows of lower level, and the signals are the proof a clause is upheld in a real run. Reason: a `promise` row would restate a clause the unit and live rows already prove.
6. **Dependent on no other plan.** The brief says `run-the-graph` narrows the hold later; here an expensive question stops the plan's session whole (A12). Reason: the brief's Not-promised list.

## Notes

- A10 and Decision 1 are the one place the brief is silent; if the person wants the hour to count only while the admin runs, A10 changes and nothing else.
- A43 shares the live check with the existing build-runs-unasked promise; if that plan's live check already covers it, the impl folds A43 into it rather than writing a second.
- The release step is configurable by project (research: a team whose main deploys would block at the pull request); the assertions here cover the default, release, only.
