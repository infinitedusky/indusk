---
title: "Promise timeline — Test Plan"
date: 2026-10-05
status: accepted
---

# Promise timeline — Test Plan

## Purpose

The assertions below, taken together, mean the timeline is working: a person
opening the Promises page sees each promise's history, can tell a live break
from a fixed one at a glance, and is never shown green that was not seen. Each
names how it will be tested. They become the impl's Test Trajectory rows.

Unless a row says otherwise, "the page" means the admin's Promises page,
fetched over HTTP from `next dev`, reading a **real** local Jaeger and, where
two sources are named, a **real** always-on server, loaded with marks whose
times the test chooses — the same fixtures `promise-sources` built
(`helpers/two-sources.ts`).

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Each promise that runs mark has a timeline on the page: across the window chosen — 24 hours, 7 days or 30 days — its upheld runs are green and its violations coloured, each in the cell for the time it happened. | admin over HTTP, real Jaeger, marks at chosen times |
| A2 | A promise that no run marks says so ("no runs mark this promise") rather than drawing an empty row that reads as healthy. | admin over HTTP |
| A3 | A violation is red while its incident is open or not recorded, and purple once its incident is fixed: marking the incident fixed turns that promise's past reds purple on the next refresh. | admin over HTTP; the incident file edited between two requests |
| A4 | Each incident is drawn as a band from when it opened to when it was fixed; an open incident's band runs to now. | admin over HTTP |
| A5 | Marking an incident fixed records when it was fixed, and `promises check` refuses an incident marked fixed with no time, naming the file. | vitest over the CLI, temp project |
| A6 | A promise with an unfixed violation older than the window still carries "violated N ago — open" on its row and on every group above it, until the incident is fixed — whatever window is chosen. | admin over HTTP, a violation 3 days old with the 24-hour window |
| A7 | Rows group by plan or by domain; a collapsed group shows, at each moment, the worst state among its promises (red over purple over green), and opens to its promises. | vitest browser component test |
| A8 | A project with a production server opens on production's timeline; local's is one click away and says how far back it reaches; a source that cannot be read says so in place of its timeline, and the other is still shown. | admin over HTTP, two real sources, one then stopped |
| A9 | Production's chip is red for a violation that is unrecorded or whose incident is open, and shows the fixed colour once every recent violation's incident is fixed. | admin over HTTP, two real sources |
| A10 | Local's chip is red while the newest local run is a violation and green again once a newer run holds, with no incident recorded. | admin over HTTP, two real sources |
| A11 | A window with more runs than one Jaeger query returns is still drawn across its whole length, and a cell that may be missing runs says "at least". | vitest integration, real Jaeger, the query limit lowered by setting |
| A12 | A refresh with nothing new moves almost nothing: after the first read of a window, a second refresh transfers only marks newer than those already held, not the window again. | vitest integration, a counting proxy between the admin's read and Jaeger |
| A13 | Pointed at the deployed server after a break and its fix, the page shows the red, then purple once the incident is fixed, then green runs after. | manual smoke against the Fly server, at the plan's close |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The timeline is readable at a glance by someone who has never seen InDusk — red reads as "broken now", purple as "was broken, fixed". | Visual and comprehension judgment | Sandy reviews screenshots at the close of the build phase that draws it; the demo rehearsal is the final check |

## Notes

- **A12 is the one that is easiest to fake green.** It must measure bytes or
  queries crossing the wire, not a cache hit counter inside the admin, or the
  test proves the counter rather than the transfer.
- **A13 needs a deployed app that marks promises**, which is
  [demo-app-template](../demo-app-template/brief.md)'s. Until it exists the
  smoke uses the always-on server's own smoke marks
  (`e2e/deployed-smoke.e2e.test.ts` writes them). It is manual because it is
  the real deployment, not because it cannot be scripted.
- The two incidents already fixed get their fixed time once, by hand, from
  git; no assertion covers that one-off.
- `gates-ran-at-every-checkoff` is A2's real-world case: nothing marks it yet
  (its observer, the gate ledger, is deferred — Sandy, 2026-10-05).
