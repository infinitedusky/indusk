---
title: "Promise timeline"
date: 2026-10-05
status: accepted
---

# Promise timeline

## Goal

**The Promises page shows each promise's history — every run, every break,
and whether each break is fixed — read from the source that keeps it, without
re-reading the whole window on every refresh.**

Today the page shows one chip per source, and the chip cannot tell a live
break from a fixed one: `every-commit-evaluated` reads *violated* for a week
after its incident was fixed, because any violation in the window turns it
red. There is no way to see when a promise broke, how long it stayed broken,
or that it recovered — the picture the demo needs, and the one a status page
gives.

## Y-Statement

**In the context of:**
the admin's Promises page, which reads marks from up to two Jaeger sources
(the laptop's daemon and the production server), and incidents from the
registry, and refreshes every few seconds.

**Facing:**
Jaeger returns whole traces and cannot count, so a week of one promise's
marks is 10.9 MB and a busy window exceeds what one query returns; an
incident does not record when it was fixed; and the chip's rule cannot tell
fixed from unfixed.

**We decided for:**
one package reader that returns each source's marks for a window as compact
records, slicing the window when a query fills; an admin-side store that
keeps what it has read and asks each refresh only for what is newer; one
rule, in the package, for whether a violation is unrecorded, open or fixed,
shared by the chip and the timeline; a `fixed` time on incidents, written by a
new `promises fix` command and required by `promises check`; and a
server-rendered timeline of about a hundred cells per row.

**And against:**
running the collector's span-metrics connector and a metrics store to get
counts from Jaeger; re-reading the whole window on a longer cache; deriving
the fixed time from git history; and drawing every mark as its own element.

**To achieve:**
a page that draws weeks of production history from a remote server at a
cost of one full read per admin start, a chip and a timeline that cannot
disagree about a break's state, and a band for every incident with both ends.

**Accepting:**
the first read of a window still transfers whole traces (seconds and
megabytes for a busy production promise, once); an admin restart reads again;
and the cell, not the mark, is the smallest thing drawn.

**Because:**
the expensive part is the transfer, not the drawing, and only the first read
of a window must pay it. A metrics store would remove that cost and add a
second backend to every laptop and server — the opposite of the loop's
"one backend, local or deployed".

## Context

[research.md](research.md) measured: 368 marks a week for
`every-commit-evaluated`, 10.9 MB because whole traces come back, a
1,500-trace query limit, no aggregation in Jaeger's query API, local history
that ends at the daemon's restart, and incidents with no fixed time.
[brief.md](brief.md) set the direction (Sandy, 2026-10-03, revised
2026-10-05); [test-plan.md](test-plan.md) holds A1–A13 and U1.

## Decision

**D1 — An incident records when it was fixed.** Incidents gain `fixed:
<ISO time>`. `indusk promises fix <incident-id>` sets `status: fixed` and
`fixed` to now, and returns the promise to `enforced` when no other incident
of it is open (the edits made by hand today). `promises check` refuses
`status: fixed` without `fixed`, naming the file (A5). The two incidents
already fixed get their time once, from the commit that fixed them.

**D2 — One rule for a violation's state.** The package's incident module
gains `violationState(traceId, incidents)` → `unrecorded | open | fixed`,
read through the registry's incidents and their recorded traces. The chip and
the timeline both call it; neither restates it (A3, A9).

**D3 — The chips.** Production's chip (and a one-source project's, which is
local): **red** when any violation in the window is unrecorded or open;
**fixed** — a new health, drawn purple — when the window holds violations
and every one is fixed; otherwise as today (A9). Local's chip when production
exists follows the **newest run**: red when the newest local mark is a
violation, green when it is upheld (A10). `PROMISE_HEALTHS` gains `fixed`,
with its entry in the chip map.

**D4 — One reader for a window.** `readTimeline(root, registry, { source,
from, to })` in `lib/promises/timeline.ts`, exported through the package's
`promises/timeline` subpath, returns for each behaviour promise the marks in
the range as `{ at, outcome, traceId }` — no spans, no logs. A query that
returns as many traces as the limit is split in two at its midpoint and each
half read again, down to a minimum slice; a slice still full at the minimum
is returned with `atLeast: true` (A11). Per source, through the same source
resolution and failure-per-source as `readSources`; the probe is not repeated
(the health read already proved the watcher).

**D5 — The admin keeps what it has read.** `apps/indusk-admin/src/lib/
promise-timeline.ts` holds, per project, source and promise, the marks read
so far and the range they cover. A request for a window reads only the parts
of it not yet covered: the whole window the first time, then from the newest
mark held (less one minute, for late-indexed spans) to now. Marks are kept
deduplicated by trace and pruned to the longest window offered (30 days). An
admin restart starts empty (A12).

**D6 — Drawing.** Each row is a strip of cells — 96 for 24 hours (15 min),
84 for 7 days (2 h), 90 for 30 days (8 h) — each coloured by the worst state
among its marks (red over purple over green; empty when none), server
rendered, with each incident drawn as a band beneath it from `opened` to
`fixed` or now (A1, A4). The window and the source are URL parameters
(`?window=7d&source=local`), so a refresh keeps them and the page stays a
server read; the default source is the alarm source, and local's view says
how far back its marks reach (A8). A promise with no marks says so (A2).

**D7 — Groups and the old-break marker.** The page's existing grouping (by
plan, domain, state, kind) keeps its button row; a group gains a summary
strip — at each cell the worst state among its promises — and collapses to
it, in a small client island (A7). A promise whose incident is open, or whose
health read (the quiet window) holds an unrecorded violation older than the
drawn window, carries "violated N ago — open" on its row and every group
above it (A6).

## Alternatives Considered

### Span metrics and a metrics store

The collector's span-metrics connector can count marks per promise per
outcome into Prometheus, and the page would read counts instead of traces.
Rejected: it adds a second backend to every laptop daemon and the always-on
server, a second thing to probe and to be blind, for a cost that the store in
D5 already pays once.

### Re-read the window on a longer cache

Simplest; a five-minute cache would cut the transfer sixty-fold. Rejected:
the page would be up to five minutes stale — the demo's "watch it turn red"
moment would wait — and every five minutes it would still move the whole
window.

### The fixed time from git history

`git log` on the incident file finds when `status` changed. Rejected: it is a
git walk per incident per read, it fails outside a git checkout and after a
history rewrite, and an incident edited twice reads the wrong commit.

### One element per mark

Exact, and simple for a sparse promise. Rejected: a request-rate promise has
thousands of marks a day; the cell strip keeps the page the same size at any
volume.

## Consequences

### Positive
- The chip stops calling a fixed incident's promise *violated*.
- Weeks of production history at the cost of one read per admin start.
- `promises fix` replaces three hand edits with one command, which the
  demo's production-break step uses.

### Negative
- The first read of a busy production window is seconds and megabytes.
- The store lives in the admin process: an admin restart reads again.

### Risks
- **Store drift**: a store that misses a range reads green where there were
  runs. Mitigated by reading by covered range rather than by "since last
  time", and by A12, which measures the transfer itself.
- **Late-indexed spans** arrive after the store moved past them. Mitigated
  by re-reading the last minute on each refresh.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/admin-ui/overview.md` — the timeline, its
  colours, windows and sources.
- Update: `apps/docs/src/reference/cli/promises.md` — `promises fix`, the
  `fixed` field and `check`'s refusal; the `promises/timeline` subpath.
- Update: `apps/docs/src/guide/promises.md` — "The loop" ends with
  `promises fix`.

### Diagrams
- Mermaid in the overview: a mark's colour from its incident's state
  (unrecorded / open → red, fixed → purple).

### Changelog
- Added: the promise timeline; `indusk promises fix`. Fixed: a fixed
  incident's promise no longer reads *violated*.

### ADR in Docs
- Yes: `apps/docs/src/decisions/promise-timeline.md` at close.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [promise-sources](../archive/promise-sources/adr.md) — the sources and
  `readSources` this reads beside.
- [indusk-demo](../indusk-demo/master.md) — script steps 5 and 6 end on this
  plan's chip rules.
