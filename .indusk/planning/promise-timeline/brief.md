---
title: "Promise timeline — a promise's history, drawn"
date: 2026-10-04
status: draft
workflow: feature
---

# Promise timeline — Brief

*Moved verbatim on 2026-10-04 from item 6 of
[day-always-on-deploy's brief](../day-always-on-deploy/brief.md), where it was
written on 2026-10-03, so the smoke test does not wait on a UI build.*

## Problem and direction

**Show the promise's history as a timeline** (Sandy, 2026-10-03: the
deploy has to demonstrate its value visually). On the admin's Promises
page, one row per promise: time left to right, a green mark for every
upheld run and a red one for every violation, each incident a band from
the time it opened to the time it was fixed — the uptime chart a status
page shows. The data already exists: every evaluation marks its span
upheld or violated in Jaeger, and `promises status` reads both; what is
missing is a reader that returns every mark with its time (today
`readPromiseMarks` keeps every violation but only the newest upheld) and
the chart. It belongs to this plan rather than beside it because the
deployed server is where the history lasts: the local daemon keeps traces
in memory and loses them on restart, while the server keeps them on its
volume — a timeline read from the deployed Jaeger shows weeks, not the
hours since the last restart. Only a promise whose code emits marks has a
line; a hollow promise says so rather than drawing an empty row as health.

**Grouped and collapsible** (Sandy, 2026-10-03). The rows group two ways,
chosen on the page: **by plan** — every promise a plan owns under that
plan — or **by domain**. A group collapses to one summary row, its runs
combined so each moment shows the worst state in the group — red over
purple over green — and opens
to its promises; a promise opens to its own timeline and incidents. A
viewer starts at "is anything broken, and where" and drills down to which
promise and when.

**Fixed or unfixed is a state of the violation, drawn as its colour**
(Sandy, 2026-10-03). Three colours: **green** an upheld run, **red** a
violation whose incident is unfixed — open, or not yet recorded — and
**purple** a violation whose incident has been fixed. The colour follows
the incident's state, so the moment an incident is marked fixed its past
reds turn purple: history keeps every break, and only an unfixed one reads
as a live problem.

**The window decides what is drawn, never what is reported.** A busy
display may show only the last twelve hours; an unfixed violation older
than that would scroll off and leave the row looking green. So a promise
with any unfixed violation carries a red unfixed marker on its row and on
every group above it, naming how long ago it broke ("violated 2 d ago —
open"), until the incident is fixed — read from the incident's state, not
from the marks inside the window, so no window length can hide it.

**The health chip follows the same rule** (Sandy, 2026-10-03). Today
`healthOf` (`apps/indusk-admin/src/lib/promise-health.ts`) colours a
behaviour promise red whenever any violation sits in the seven-day window,
whether or not its incident is fixed — so `every-commit-evaluated` read
*violated* after `i-2026-10-03-every-commit-evaluated` was fixed and newer
runs were upheld, and will until its last violation ages out
(2026-10-10). A violation whose trace belongs to a fixed incident stops
counting toward red: the chip is red only for an unrecorded violation or
one whose incident is open, and a promise whose recent violations are all
fixed shows the fixed colour, not *violated*. The chip and the timeline
read one definition of a violation's state, never two.

First real data to show: `every-commit-evaluated` — red through the
evening of 2026-10-02 (`i-2026-10-03-every-commit-evaluated`), green from
05:40 on 2026-10-03.

## Test assertions carried over

Drafted in day-always-on-deploy's test plan on 2026-10-04 and moved with the
item; they become this plan's test plan once the brief is accepted.

- The admin's Promises page shows each marked promise as a timeline: every
  upheld run green and every violation coloured over time, each incident a
  band from opened to fixed; a promise with no marks says so rather than
  drawing an empty row.
- A violation reads red while its incident is unfixed (open, or not
  recorded) and purple once the incident is fixed — marking an incident fixed
  turns its past reds purple.
- Rows group by plan or by domain, chosen on the page; a collapsed group
  shows the worst state in it at each moment (red over purple over green)
  and opens to its promises.
- A promise with an unfixed violation older than the drawn window still
  carries a red "violated N ago — open" marker on its row and every group
  above it, until the incident is fixed.
- Pointed at the deployed server after the deploy smoke's break-and-recover,
  the page shows the red and the return to green.

## Part of

[indusk-demo](../indusk-demo/master.md), step 2: the visual of promises holding in production while you build.

## Depends on

- [day-always-on-deploy](../day-always-on-deploy/brief.md) for the last
  assertion only: the history that lasts weeks lives on the deployed server's
  volume. Everything else can be built and tested against a local Jaeger.
