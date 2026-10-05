---
title: "Promise timeline — a promise's history, drawn"
date: 2026-10-04
status: accepted
workflow: feature
---

# Promise timeline — Brief

*Moved verbatim on 2026-10-04 from item 6 of
[day-always-on-deploy's brief](../archive/day-always-on-deploy/brief.md), where it was
written on 2026-10-03, so the smoke test does not wait on a UI build.*

*Revised 2026-10-05, after [promise-sources](../archive/promise-sources/brief.md)
closed and the demo script was reviewed: two stale sentences corrected in
place, and the section "After promise-sources" added. Sandy's dated direction
is unchanged.*

## Problem and direction

**Show the promise's history as a timeline** (Sandy, 2026-10-03: the
deploy has to demonstrate its value visually). On the admin's Promises
page, one row per promise: time left to right, a green mark for every
upheld run and a red one for every violation, each incident a band from
the time it opened to the time it was fixed — the uptime chart a status
page shows. The data already exists: every evaluation marks its span
upheld or violated in Jaeger, and `promises status` reads both; what is
missing is a reader that returns every mark with its time (today
`markedSpans`, in `apps/indusk-mcp/src/lib/promises/telemetry.ts`, keeps
every violation but only the newest upheld) and the chart. The
deployed server is where the history lasts: the local daemon keeps traces
in memory and loses them on restart, while the server keeps them on its
volume — a timeline read from the deployed Jaeger shows weeks, not the
hours since the last restart. Only a promise whose code emits marks has a
line; a hollow promise says so rather than drawing an empty row as health.

**Grouped and collapsible** (Sandy, 2026-10-03). *Moved 2026-10-05 (Sandy) to [contract-ui](../contract-ui/brief.md), which reorganises the admin around premises, promises and phases; groups follow that hierarchy there.* The rows group two ways,
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

## After promise-sources (2026-10-05)

A project now has up to two sources, `local` (the laptop's daemon) and
`production` (the server `promises.jaeger` names), and the Promises page
draws a chip for each. Three things follow for this plan.

**The timeline draws one source at a time, production first.** Production
is where the history lasts and it is the source that raises the alarm, so a
project that names a server opens on production's timeline. Local's is one
click away and says how far back it reaches, since the daemon forgets on
restart. A project with one source draws that one. The reader that returns
every mark is per source, beside `readSources`
(`apps/indusk-mcp/src/lib/promises/sources.ts`), and a source that cannot be
read says so in place of its timeline, as its chip does.

**The two chips follow different rules, because they answer different
questions** (Sandy, 2026-10-05, deciding how the demo shows a local break).

- **Production's chip** follows the fixed-incident rule above: red for a
  violation that is unrecorded or whose incident is open, the fixed colour
  once every recent violation's incident is fixed.
- **Local's chip follows the newest run**: red when the newest local mark is
  a violation, green once a newer run upholds. A local break during
  development is work in progress. Nobody records an incident for it, so the
  fixed-incident rule would leave it red for the whole seven-day window after
  the fix. Recording one to clear it would reopen the plan that owns the
  promise, for a break another plan's unfinished work caused.

Both rules live in one place, the function that already decides a chip's
colour (`healthOf`, `apps/indusk-admin/src/lib/promise-health.ts`), which is
already called once per source.

**The marks are drawn in buckets.** One query returns at most 1,500 traces
per promise and service (`TRACE_LIMIT`). An application that marks a promise
on every request passes that in days, so "a mark for every run" cannot be
read back for weeks of history. The reader asks per time bucket and returns,
for each, how many runs were upheld and how many violated; the row draws a
bucket in its worst colour. A bucket whose query hit the limit says "at
least", as `promises status` already does.

This plan is what lets both break steps of the
[demo script](../indusk-demo/master.md) end on something other than red:
the local break goes green by the newest-run rule, and the production break
goes to the fixed colour by the fixed-incident rule.

## From the research (2026-10-05)

[research.md](research.md) measured what the direction rests on. Three
things follow.

**An incident records when it was fixed.** Today marking an incident fixed
changes `status` and nothing else, so a band "from opened to fixed" has no
end. Marking an incident fixed also writes `fixed: <time>`, and `promises
check` refuses `status: fixed` without it. The two incidents already fixed get
their time from the commit that fixed them, once, by hand.

**The timeline reads what is new, not the whole window again.** A week of
one promise's marks is 368 traces and 10.9 MB, because Jaeger returns whole
traces. Re-read every five seconds from the Fly server, that is megabytes a
second. The admin keeps what it has read per source and promise and, on each
refresh, asks only for marks since the newest one it holds. The window is
read in full once per admin start.

**The window is drawn in a fixed number of buckets.** One query returns at
most 1,500 traces and Jaeger cannot count for us, so a busy window is read in
time slices that split when one fills, and drawn as a fixed number of cells:
**24 hours, 7 days or 30 days**, chosen on the page, each drawn as about 100
cells. A cell takes the worst colour among its runs.

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

Added 2026-10-05, from "After promise-sources":

- A project with two sources opens on production's timeline, and local's is
  selectable; a source that cannot be read says so in place of its timeline.
- Production's chip is red for an unrecorded violation or an open incident's,
  and the fixed colour once every recent violation's incident is fixed.
- Local's chip is red when the newest local mark is a violation and green
  once a newer run upholds, with no incident recorded.
- A promise with more marks in the window than one query returns is still
  drawn across the whole window, in buckets, and a bucket that hit the limit
  says "at least".

Added 2026-10-05, from "From the research":

- Marking an incident fixed records when; an incident marked fixed without a
  time is refused by `promises check`. The band ends at that time.
- A refresh of the Promises page moves only the marks that are new since the
  last refresh, not the whole window again.
- The page offers 24 hours, 7 days and 30 days.

## Part of

[indusk-demo](../indusk-demo/master.md), step 2 in its build order: the
visual of promises holding in production while you build, and the chip rules
both of the script's break steps end on.

## Depends on

- [day-always-on-deploy](../archive/day-always-on-deploy/brief.md) for the last
  assertion only: the history that lasts weeks lives on the deployed server's
  volume. Everything else can be built and tested against a local Jaeger.
