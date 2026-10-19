---
title: "Decisions as questions"
date: 2026-10-19
status: draft
workflow: feature
clauses: required
description: "An unattended session puts each choice to the person as a question with its recommendation and a cost: cheap and moderate ones go ahead on a timer, expensive ones stop and wait. A late answer that disagrees opens a follow-on plan, and a release waits for it; landing never does."
---

# Decisions as questions — Brief

## Expectations

1. **Runs stop less.**
   - Measure: per unattended run, stops for the person (judgement, blocker, expensive question) against questions asked; expect most questions to proceed on their timer.
   - Look: after the next five unattended runs.

2. **The person still sees every decision.**
   - Measure: share of decisions recorded only as "decided unattended" in a document, with no question; expect none.
   - Look: after the next five plans.

3. **Few timed-out answers are wrong.**
   - Measure: follow-on plans opened by a disagreeing late answer, per question that proceeded on its timer; expect under one in ten.
   - Look: after a month.

## Promises

### This plan makes

1. **`a-decision-is-a-question`** (state). When an unattended session meets a choice the plan does not settle, it puts it to the person as a question with its options, its recommendation and a cost, under Needs you and on the plan's page.
   - **`asked-with-a-recommendation`** (split). Each question names its options, the one the agent recommends and why, and its cost: cheap, moderate or expensive.
   - **`never-decided-silently`** (limit). A session never records a choice as decided unattended without asking it as a question.

2. **`the-cost-sets-the-wait`** (state). An unanswered cheap question goes ahead with its recommendation after five minutes, a moderate one after an hour, and an expensive one stops its session and frees its slot until the person answers.
   - **`cheap-and-moderate-go-ahead`** (split). A cheap or moderate question unanswered past its time goes ahead with the recommendation, and says it did.
   - **`expensive-waits`** (split). An expensive question stops its session, frees its slot, and the run resumes when the person answers.

3. **`what-was-agreed-is-never-cheap`** (state). A question whose answer would change the brief, a promise or a look, or skip a gate, is expensive whatever cost the agent gave it.

4. **`a-late-answer-opens-a-follow-on`** (state). An answer given after its question went ahead, choosing other than the recommendation, opens a follow-on plan to make the work match it; every question stays readable with its recommendation, its answer and what was done.
   - **`disagreement-opens-a-plan`** (split). A late answer that differs from what was done opens one draft follow-on plan naming the question, the choice made and the one wanted.
   - **`every-decision-stays`** (split). Every question, answered, gone ahead or waiting, is kept with its recommendation, its answer and what was done.

5. **`a-release-waits-for-a-known-wrong`** (state). A release refuses while a follow-on plan opened by a disagreeing answer is open, naming it; landing on main never waits for one.
   - **`release-refuses`** (split). The release step refuses, naming each open follow-on, until each is closed.
   - **`landing-never-waits`** (limit). Landing a plan is never refused because a follow-on is open.

### Existing promises

**Must not break**

- **`a-change-to-what-was-agreed-needs-the-person`**. An answer that changes the brief still stops for the person's re-approval.
- **`only-a-person-reapproves`**. A timer never approves anything.
- **`sessions-are-capped`**. A waiting plan frees its slot, so it never holds one of the machine's sessions.
- **`nothing-ships-until-accepted`**. Questions change nothing about acceptance.
- **`an-unclaimed-failure-opens-a-bugfix-plan`**. The follow-on plan is opened beside it, not instead of it.

**Changes**

- **`decisions-wait-in-one-place`**. When a plan is waiting on the person it is listed under Needs you, and its page shows each open question with its recommendation, its options, its cost and a reply in words; the answer reaches the agent and is recorded in the plan's history.
- **`a-build-runs-to-review-unasked`**. An approved plan's implementation runs through its phases, falsification and cleanup without asking for approval, writing its code in the plan's code worktree and, in a workbench, checking items off at the root, and stops only when it is ready for review, for a judgement the plan declared, for an expensive question, or when it cannot continue.

**Replaces**

None.

### Not promised

- A question holding only the phases downstream of it: needs `run-the-graph`.
- Telling the person a question is waiting outside the admin: notifications come with `activity-and-graph`.
- Questions in planning conversations with the person present: they already ask.

## Looks

### This plan makes

1. **`question-row.cheap`**. A question going ahead on its timer: the question, the recommendation, the cost, the time left, and a reply.
2. **`question-row.expensive`**. A question that has stopped its plan: the same, in red, with no timer.
3. **`question-row.went-ahead`**. A question whose timer went ahead: what was done, and a late answer that opens a follow-on.

### Existing looks

**Must not break**

- **`nav.expanded`**. Needs you lists a plan waiting on an expensive question as it lists any other wait.

**Changes**

- **`plan.needs-you`**. The decision card shows every open question as a question row, the expensive ones first.

**Replaces**

None.

## Depends On

- None. (`run-the-graph` narrows the hold later.)

## Blocks

- `.indusk/planning/run-the-master/` — `activity-and-graph` shows these questions in its feed.
