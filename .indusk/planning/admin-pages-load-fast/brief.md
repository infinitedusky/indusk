---
title: "Admin pages load fast"
date: 2026-10-20
status: accepted
workflow: bugfix
clauses: required
description: "Every admin page answers in under a second: the process list and the trunk's landing history are read once per page for all plans, kept for a few seconds, and never read in a way that freezes the server."
accepted_at: "2026-10-20T02:25:42.982Z"
---

# Admin pages load fast — Brief

Measured 2026-10-19 (Sandy: "the speed is such an issue"): a plan page took
17.1 s, the promises page 18–23 s and the looks page 30 s. A CPU profile of the
running admin during one plan page: 11.4 s of 17.1 s spent starting other
programs synchronously (`spawn`) — `ps` once per run to ask whether its
process is alive (4.1 s), `git` per plan to ask whether it landed, a port check
— each freezing the whole server while it waits, on every page load and on
every five-second live refresh. Reading plan files took under a second; the
JavaScript work under a second. These checks came with `a-run-can-be-trusted`.

## Expectations

None — a bugfix; the promise below is the measure.

## Promises

### This plan makes

1. **`admin-pages-load-fast`** (behaviour). Every admin page answers in under a second.
   - **`one-read-per-page`** (split). A page reads the machine's process list and the trunk's landing history at most once, for all the plans it shows, never once per plan or per run.
   - **`kept-briefly`** (split). Those reads are kept for a few seconds, so the page's own live refresh and the other pages reuse them instead of reading again.
   - **`never-freezes`** (limit). No page starts another program in a way that stops the server answering other requests while it waits.

### Existing promises

**Must not break**

- **`a-run-is-read-from-its-record`**. A run's state, liveness and landing still read true; kept for a few seconds at most, so a run that dies reads stopped within that time.
- **`approval-waits-for-a-finished-plan`**. The offer of approval still reads the plan review and the live run.
- **`decisions-wait-in-one-place`**. Needs you still lists every plan waiting on the person.

**Changes**

None.

**Replaces**

None.

### Not promised

- Telemetry on the admin's own requests beyond the page timing this promise needs: a later plan.
- Faster planning or building runs: those are model and test time, not the admin.

## Looks

Amended 2026-10-20 after the audit: two things on a page change besides how fast it arrives. Paging the scorecards (the person's answer to q-5) was cut from this plan on 2026-10-20 to close it now; it moves to the follow-on `scorecards-are-paged`.

### This plan makes

None.

### Not drawn

- **The scorecards page shows the latest 100.** The page draws the newest 100 scorecards and its header reads "latest 100 of N"; older ones stay in the log and cannot be reached from the page until `scorecards-are-paged` pages them 25 at a time. Only the header's words change, so this has no mockup; it is listed so the person approves it or sends it back.
- **How fresh the counts are.** The red number of broken promises in the nav, a promise's own health, and the Looks page's mockups are shown from the last reading, up to 60 seconds old, while a newer one is read behind it; a promise that breaks can take up to a minute to turn the count red. Nothing is drawn differently, so this has no mockup; it is listed so the person approves it or sends it back.

## Depends On

- None.

## Blocks

- None.
