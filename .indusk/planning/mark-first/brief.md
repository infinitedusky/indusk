---
title: "Mark first"
date: 2026-10-14
status: accepted
workflow: feature
description: "Promises are proved by what the running system reports, not by tests alone. A promise is made of clauses — split times along the way and limits that always hold — each with its own mark, layered by component so a break leads down to its cause, and an agent reads the broken mark's trace and proposes the fix."
---

# Mark first — Brief

InDusk becomes telemetry-driven: a promise is kept when its marks say so in
real use, tests support it, and a break is narrowed to its cause by following
marks down. Background, the 100 m dash, the cost and the first worked example
are in [research.md](research.md).

## Expectations

1. **Breaks are found by marks, not by people.**
   - Measure: of incidents opened on this project's promises, the share opened by a mark in a running system against those opened by a failing test or reported by a person, read from the incident records.
   - Look: 60 days after release.

2. **A break is narrowed to its cause quickly.**
   - Measure: time from an incident opening to the clause and the cause being named in it, from the incident record's timestamps; expect under ten minutes for most.
   - Look: after the first ten incidents with clauses.

3. **Marks cost little.**
   - Measure: on the project conversation, the time each split takes with its marks on and off, and the trace storage the daemon uses per day; expect a few percent at most.
   - Look: at the close of this plan, and 30 days after release.

4. **Promises gain marks.**
   - Measure: the share of promises in force with at least one clause that has a mark, from the registry; 4 of 127 today.
   - Look: 30 and 90 days after release.

5. **The agent's diagnosis is usually right.**
   - Measure: the share of diagnoses whose proposed fix a person accepts, read from the incident records.
   - Look: after the first ten diagnoses.

## Promises

### This plan makes

1. **`a-promise-is-made-of-clauses`** (state). A promise can be stated as named clauses — splits, each a point reached within its budget on the way to the promise's goal, and limits, each a bound that always holds — and each clause has its own mark, its own health and the tests that support it.

2. **`a-clause-is-kept-by-its-mark`** (state). A clause counts as kept only when its mark has reported it kept in a run of the real system; a passing test supports a clause but never stands in for its mark.

3. **`a-promise-can-rest-on-another`** (state). A clause can be another promise, of the part beneath it, and its health is that promise's health.

4. **`a-break-leads-to-its-cause`** (behaviour). When a promise breaks, its incident names the first clause that broke along the way and every clause beneath it that broke in the same trace.

5. **`a-page-can-mark-a-promise`** (state). A mark set in a browser — on the admin's pages or a project's own — reaches the same telemetry as a server's and counts the same.

6. **`every-broken-trace-is-kept`** (behaviour). Every trace that carries a broken mark is kept whole; traces where every mark held may be thinned.

7. **`a-break-comes-with-a-diagnosis`** (behaviour). When a clause breaks, an agent reads the broken mark and its trace, and the incident holds the cause it found and the fix it proposes before anyone asks.

8. **`a-message-sent-gets-a-reply`** (behaviour). Every message a person sends in a project conversation shows in the thread at once and is answered there within thirty seconds, or the thread says why not.

### Existing promises

**Must not break**

- **`a-break-reaches-the-working-agent`**. A broken clause reaches the agent the same way a broken promise does today.
- **`a-production-break-is-recorded-unasked`**. A broken clause becomes an incident the same way, with nobody running a command.
- **`an-incident-names-its-tests`**. An incident still names the tests that supported the promise, beside its clauses.
- **`a-click-and-its-server-work-share-a-trace`**. Browser marks ride the same trace a click already carries.
- **`everyday-suite-stays-fast`**. Marks add no waiting to the everyday suite.

**Changes**

- **`a-closed-plan-kept-its-promises`**. A plan cannot close while a clause of a promise it made has no mark that has reported in a run; the tests that name the promise are listed as its support. When it closes, its promises are enforced.
- **`a-promise-page-shows-its-proof`**. Each promise has a page showing its clauses — each with its mark, how it was last seen and the tests that support it — thirty days held and broken per source, and its dated history; when it is broken while every test passes, the page says the tests miss the case.

**Replaces**

None.

### Not promised

- **Removing tests.** Tests stay as support; nothing is deleted. Sandy, 2026-10-14.
- **The no-tests Homework Gate challenge.** It waits on this plan and is its own piece of work.
- **Marks on every line.** Line-level "where" comes from a sampling profiler, a later plan if incidents ask for it.
- **Gradual rollout** (send a release to a share of users and watch the marks before widening). Follows once marks are in place.
- **Fixing without a person.** The agent proposes the fix; applying it stays with the reopened plan's normal flow.

## Looks

### This plan makes

1. **`promise.clauses`**. A promise's page with its clauses: each split or limit with its budget or bound, its dot (held, broken, not yet seen), when its mark last reported, and the tests that support it.
2. **`clause-row.held`**. A new component: one clause, held — its name, its budget or bound, a green dot, last seen.
3. **`clause-row.broken`**. The same row broken: a red dot, the symptom, and the clause beneath it that broke.
4. **`clause-row.unseen`**. The same row whose mark has never reported: a grey dot and "not seen in a run yet".
5. **`incident.diagnosis`**. An incident with the first broken clause, the trace walked down to the cause, and the agent's diagnosis and proposed fix.

### Existing looks

**Must not break**

None.

**Changes**

- **`promise.broken`**. The broken promise's page leads with its first broken clause and the diagnosis; the approved look stays held until a person approves this.
- **`promise.enforced`**. The kept promise's page lists its clauses held; the approved look stays held until a person approves this.

**Replaces**

None.

## Depends On

- `.indusk/planning/new-project-flow/` — its project conversation is the first worked example, so it lands first; marking the conversation must not change what the person sees (`a-project-conversation-is-a-back-and-forth`, which that plan makes).

## Blocks

- The Homework Gate no-tests challenge.
