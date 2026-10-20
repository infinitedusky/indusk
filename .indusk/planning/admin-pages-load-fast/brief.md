---
title: "Admin pages load fast"
date: 2026-10-20
status: draft
workflow: bugfix
clauses: required
description: "Every admin page answers in under a second: the process list and the trunk's landing history are read once per page for all plans, kept for a few seconds, and never read in a way that freezes the server."
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

None — the change is in the admin's server-side readers and the package's run-record readers; nothing on a page changes but how fast it arrives.

## Depends On

- None.

## Blocks

- None.
