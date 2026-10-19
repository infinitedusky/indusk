---
title: "Stabilize"
description: "Get InDusk stable before anything new: three plans in a row go from accepted brief to landed and closed, unattended, with no hand fixes."
date: 2026-10-19
status: living
# In order. Each is listed here and also under its own master (a plan named
# by two Paths that do not contain one another appears under both).
subplans:
  - approval-waits-for-the-planning-run
  - audit-concerns-are-answered
  - a-brief-is-accepted-on-current-main
  - a-run-can-be-trusted
  - decisions-as-questions
---

# Stabilize — Master

Sandy, 2026-10-19: the goals kept getting pushed back by fixes to problems that
kept arising. Before anything new, the system is made stable.

**Done when** three plans in a row go from accepted brief to landed and closed,
unattended, with no hand fixes. Until then no new features, and an item joins
this list only when it actually broke a run. Ask "what's the order / what's
next / what am I waiting for" and it is answered from this list and each plan's
live state.

## In order

1. **`approval-waits-for-the-planning-run`** — landed 2026-10-19 (`6b9e5cf0`): Approve is offered only once the
   plan review is written and answered.
2. **`audit-concerns-are-answered`**: the plan reviewer runs in the foreground,
   so unattended planning runs stop failing at the review. Closes itself once a
   planning run passes its review and a real amendment stop reports.
3. **`a-brief-is-accepted-on-current-main`** — landed 2026-10-19 (`eca91fd2`): accepting a brief, or starting its planning, first merges main into its branch. Open until its three clauses report signals (with 4).
4. **`a-run-can-be-trusted`** — approved 2026-10-19, ready to Build: the impl check refuses a plan with
   clauses and no signals phase; shell writes to plan documents are refused; a
   run's state is kept on disk, a dead run shows dead with Restart; the landing
   test that fails under load is fixed; a release that does not land is not shown as
   released; the offer of approval also checks the plan review's `read:` hash.
5. **`decisions-as-questions`**: approved; main merged into its branch 2026-10-19; builds after 3 lands (both touch the admin's build host).

## Parked until done

`run-the-graph`, `activity-and-graph` (including an Up next view),
`the-sampler`, `a-promise-can-be-retired` and the tier retire,
`a-promise-claims-what-the-plan-builds`, the `fix-http-*` drafts, and the
hardening list in `.indusk/current.md`.
